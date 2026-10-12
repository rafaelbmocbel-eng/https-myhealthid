import type { FormatoSocial, LayoutArte } from './formatos';

/** Data de hoje (aaaa-mm-dd) no fuso de São Paulo. */
export function dataParaArquivo(data: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(data);
}

/** Nome do arquivo da arte: só o tipo, o formato e a data, nunca dados do paciente. */
export function nomeArquivoSocial(formato: FormatoSocial, layout: LayoutArte, data: Date = new Date(), extensao = 'png'): string {
  const tipo = layout === 'unica' ? 'analise-postural' : 'antes-depois';
  return `${tipo}-${formato}-${dataParaArquivo(data)}.${extensao}`;
}

/** PNG do canvas. O PNG do navegador não leva metadados, então nada do paciente vai junto. */
export function canvasParaPng(cv: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, falha) => {
    try {
      cv.toBlob((b) => (b ? ok(b) : falha(new Error('Não consegui gerar a imagem.'))), 'image/png');
    } catch (e) {
      falha(e instanceof Error ? e : new Error('Não consegui gerar a imagem.'));
    }
  });
}

/** Baixa o arquivo no aparelho (no celular, vai para Arquivos ou Fotos). */
export function baixarBlob(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export type ResultadoCompartilhar = 'compartilhado' | 'cancelado' | 'indisponivel';

type NavegadorComShare = Navigator & { canShare?: (dados: ShareData) => boolean; share?: (dados: ShareData) => Promise<void> };

/** O navegador aceita compartilhar este arquivo pela Web Share API? */
export function podeCompartilharArquivo(arquivo: File, nav: NavegadorComShare | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({ files: [arquivo] });
  } catch {
    // Alguns navegadores lançam erro para tipos que não suportam: tratam como indisponível.
    return false;
  }
}

/**
 * Abre a folha de compartilhamento do aparelho com o arquivo. Sem texto nem título: só a imagem sai.
 * "indisponivel" pede ao chamador que caia no download.
 */
export async function compartilharArquivo(arquivo: File, nav: NavegadorComShare | undefined = typeof navigator === 'undefined' ? undefined : navigator): Promise<ResultadoCompartilhar> {
  if (!nav || !podeCompartilharArquivo(arquivo, nav)) return 'indisponivel';
  try {
    await nav.share!({ files: [arquivo] });
    return 'compartilhado';
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return 'cancelado';
    return 'indisponivel';
  }
}
