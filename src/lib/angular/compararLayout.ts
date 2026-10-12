export const RAZAO_CAIXA_MIN = 0.55;
export const RAZAO_CAIXA_MAX = 1.6;
export const RAZAO_CAIXA_PADRAO = 3 / 4;

const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * Proporção (largura/altura) da caixa onde as duas fotos são mostradas. Usa a da primeira foto que
 * existir, dentro de limites, para que as duas caixas tenham o mesmo tamanho mesmo com fotos de
 * proporções diferentes.
 */
export function razaoDaCaixa(proporcoes: (number | null | undefined)[]): number {
  const p = proporcoes.find((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  return p === undefined ? RAZAO_CAIXA_PADRAO : limitar(p, RAZAO_CAIXA_MIN, RAZAO_CAIXA_MAX);
}

/** Maior tamanho da imagem que cabe inteiro na caixa, sem distorcer. */
export function ajustarNaCaixa(caixaW: number, caixaH: number, imgW: number, imgH: number): { w: number; h: number } {
  if (caixaW <= 0 || caixaH <= 0 || imgW <= 0 || imgH <= 0) return { w: 0, h: 0 };
  const esc = Math.min(caixaW / imgW, caixaH / imgH);
  return { w: imgW * esc, h: imgH * esc };
}

/** Posição de rolagem como fração (0–1) do que dá para rolar; sem rolagem possível, 0. */
export function fracaoDeRolagem(posicao: number, conteudo: number, visivel: number): number {
  const max = conteudo - visivel;
  return max <= 0 ? 0 : limitar(posicao / max, 0, 1);
}

export function posicaoDeRolagem(fracao: number, conteudo: number, visivel: number): number {
  const max = conteudo - visivel;
  return max <= 0 ? 0 : limitar(fracao, 0, 1) * max;
}

/** "2026-10-11" -> "11/10/2026". Sem usar Date, para não deslocar o dia pelo fuso. */
export function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Hoje como "aaaa-mm-dd" no fuso de São Paulo, para preencher o campo de data. */
export function hojeISO(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}
