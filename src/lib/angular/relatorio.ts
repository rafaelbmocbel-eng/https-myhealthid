import jsPDF from 'jspdf';
import '@/lib/pdf/patchJsPdf';
import { molduraEmTodasPaginas } from '@/lib/pdf/moldura';
import { nomeDocumento } from '@/lib/pdf/entrega';
import { addLogoToDoc } from '@/utils/pdfLogoHelper';
import { compararMedidas, grau, variacaoTexto, type MedidaSalva } from './comparar';
import { nomeDoResultado } from './medidas';
import { ROTULO_CONFIRMAR, ehMedidaParaConfirmar, fraseDosPontos, type PontosDaPosicao } from './sessao';

export const AZUL: [number, number, number] = [30, 58, 95];
export const CAB: [number, number, number] = [230, 237, 245];
export const BORDA: [number, number, number] = [208, 214, 222];
export const DOURADO: [number, number, number] = [234, 170, 20];

/** Troca os caracteres que a Helvetica do PDF não desenha por equivalentes simples. */
export const seguro = (s: string) => String(s).replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/−/g, '-').replace(/–/g, '-').replace(/—/g, '-').replace(/·/g, '-').replace(/→/g, '>').replace(/≈/g, '~').replace(/[‐‑]/g, '-').replace(/[“”″]/g, '"').replace(/[‘’′]/g, "'");

const PASSO_DA_FONTE = 0.5;
/** Largura do nome do paciente: termina antes da logo (que começa em x = 180 mm). */
const LARGURA_ATE_A_LOGO = 160;
/** Largura útil da página, entre as margens. */
const LARGURA_DA_PAGINA = 210 - 2 * 14;

function reduzirAteCaber(doc: jsPDF, txt: string, largura: number, tamanho: number, minimo: number): number {
  let tam = tamanho;
  doc.setFontSize(tam);
  while (tam > minimo && doc.getTextWidth(txt) > largura) {
    tam = Math.max(minimo, Math.round((tam - PASSO_DA_FONTE) * 10) / 10);
    doc.setFontSize(tam);
  }
  return tam;
}

/** Corta o fim do texto até caber em `largura`, trocando o que sobrou por "..."; a fonte atual do documento vale para a medida. */
function cortarAoCaber(doc: jsPDF, txt: string, largura: number): string {
  if (doc.getTextWidth(txt) <= largura) return txt;
  let corte = txt.trimEnd();
  while (corte.length > 1 && doc.getTextWidth(`${corte}...`) > largura) corte = corte.slice(0, -1).trimEnd();
  return `${corte}...`;
}

/**
 * Texto em até `linhasMax` linhas de `largura` mm, com a fonte e o negrito que o documento já está usando. Primeiro reduz o corpo
 * (de `tamanho` até `minimo`) para caber em uma linha; se ainda não couber, quebra no corpo mínimo e o que passar de `linhasMax`
 * linhas (ou uma palavra sem espaços maior que a linha) termina em "...". O documento fica com o corpo devolvido.
 */
export function ajustarTexto(doc: jsPDF, txt: string, o: { largura: number; tamanho: number; minimo: number; linhasMax?: number }): { linhas: string[]; tamanho: number } {
  const linhasMax = o.linhasMax ?? 2;
  const seguroTxt = seguro(txt);
  const tamanho = reduzirAteCaber(doc, seguroTxt, o.largura, o.tamanho, o.minimo);
  if (doc.getTextWidth(seguroTxt) <= o.largura) return { linhas: [seguroTxt], tamanho };
  const quebradas = doc.splitTextToSize(seguroTxt, o.largura) as string[];
  const linhas = quebradas.slice(0, linhasMax);
  if (quebradas.length > linhasMax) linhas[linhasMax - 1] = `${linhas[linhasMax - 1]}...`;
  return { linhas: linhas.map((ln) => cortarAoCaber(doc, ln, o.largura)), tamanho };
}

/**
 * Uma linha só: reduz o corpo até o mínimo e, se mesmo assim não couber, corta a parte variável (o nome) com "...", mantendo o resto
 * da linha (a data) à vista.
 */
export function ajustarLinha(doc: jsPDF, montar: (variavel: string) => string, variavel: string, o: { largura: number; tamanho: number; minimo: number }): { texto: string; tamanho: number } {
  const tamanho = reduzirAteCaber(doc, seguro(montar(variavel)), o.largura, o.tamanho, o.minimo);
  let corte = variavel.trimEnd();
  let texto = seguro(montar(corte));
  while (doc.getTextWidth(texto) > o.largura && corte.length > 1) {
    corte = corte.slice(0, -1).trimEnd();
    texto = seguro(montar(`${corte}...`));
  }
  return { texto, tamanho };
}

/**
 * Cabeçalho comum dos relatórios angulares: logo, título, paciente e filete dourado. Devolve o y onde o conteúdo começa.
 * Nome do paciente e linha de baixo (data e profissional) encolhem e, se preciso, quebram: nada passa da página nem encosta na logo.
 */
export async function cabecalhoDoRelatorio(doc: jsPDF, o: { titulo: string; paciente: string; subtitulo: string; logoUrl?: string }): Promise<number> {
  const W = 210, M = 14;
  let y = 18;
  try { await addLogoToDoc(doc, W - M - 16, 10, 16, o.logoUrl); } catch { /* logo é opcional */ }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...AZUL); doc.text(seguro(o.titulo), M, y); y += 7;
  doc.setTextColor(20);
  const nome = ajustarTexto(doc, o.paciente, { largura: LARGURA_ATE_A_LOGO, tamanho: 11.5, minimo: 8.5 });
  nome.linhas.forEach((ln, i) => doc.text(ln, M, y + i * 4));
  y += 5 + (nome.linhas.length - 1) * 4;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(90);
  const subtitulo = ajustarTexto(doc, o.subtitulo, { largura: LARGURA_DA_PAGINA, tamanho: 9, minimo: 7 });
  subtitulo.linhas.forEach((ln, i) => doc.text(ln, M, y + i * 3.6));
  y += 4 + (subtitulo.linhas.length - 1) * 3.6;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.5); doc.line(M, y, M + 28, y);
  doc.setDrawColor(...BORDA); doc.setLineWidth(0.25); doc.line(M + 28, y, W - M, y); y += 7;
  doc.setTextColor(20);
  return y;
}

/** Título de seção: barrinha azul e texto em negrito na linha de base `y`. */
export function tituloDeSecao(doc: jsPDF, txt: string, y: number) {
  const M = 14;
  doc.setFillColor(...AZUL); doc.roundedRect(M, y - 3.6, 1.4, 5, 0.7, 0.7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...AZUL); doc.text(seguro(txt), M + 4, y); doc.setTextColor(20);
}

export interface DadosRelatorioAngular {
  paciente: string;
  profissional?: string;
  logoUrl?: string;
  /** dd/mm/aaaa */
  data: string;
  vistaNome: string;
  medidas: MedidaSalva[];
  metodo: 'automatica_conferida' | 'marcacao_manual';
  /** Como os pontos foram marcados (sugeridos pelo modelo, ajustados à mão, só à mão); omitir quando não se sabe. */
  pontos?: PontosDaPosicao;
  /** `data` (dd/mm/aaaa) vem vazia quando a data da avaliação anterior não é conhecida. */
  anterior?: { data: string; medidas: MedidaSalva[] } | null;
  /** Avisos de comparabilidade com a avaliação anterior (os mesmos que a tela mostra); saem sob a tabela. */
  avisos?: string[];
  /** Foto com as marcações já desenhadas (data URL JPEG), se o profissional quiser incluí-la. */
  imagem?: { url: string; w: number; h: number } | null;
  /** Frase extra para o rodapé (ex.: correção de nível aplicada). */
  notaExtra?: string;
}

const dataArquivo = (br: string) => br.split('/').reverse().join('-');

export async function gerarRelatorioAngular(d: DadosRelatorioAngular): Promise<{ blob: Blob; nome: string }> {
  const paciente = nomeDocumento(d.paciente);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14, LARG = W - 2 * M;
  const t = (txt: string, x: number, y: number, op?: Parameters<jsPDF['text']>[3]) => doc.text(seguro(txt), x, y, op);
  const novaPagina = () => { doc.addPage(); return 18; };

  const subtitulo = `Vista ${d.vistaNome} · ${d.data}${d.profissional ? ` · ${d.profissional}` : ''}`;
  let y = await cabecalhoDoRelatorio(doc, { titulo: 'Análise angular', paciente, subtitulo, logoUrl: d.logoUrl });

  const titulo = (txt: string) => {
    tituloDeSecao(doc, txt, y);
    y += 5;
  };

  // Foto com moldura própria
  if (d.imagem) {
    const maxH = 118;
    const prop = d.imagem.w / d.imagem.h;
    const h = Math.min(maxH, LARG / prop), w = h * prop;
    const x = M + (LARG - w) / 2;
    doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA); doc.setLineWidth(0.4);
    doc.roundedRect(x - 1.5, y - 1.5, w + 3, h + 3, 2.5, 2.5, 'FD');
    doc.addImage(d.imagem.url, 'JPEG', x, y, w, h, undefined, 'FAST');
    y += h + 8;
  }

  // Tabela de medidas
  const linhas = compararMedidas(d.medidas, d.anterior?.medidas ?? []).filter((l) => l.atual).map((l) => ({ ...l, nome: nomeDoResultado(l.id) ?? l.nome }));
  const comAnterior = !!d.anterior;
  const dataAnterior = d.anterior?.data?.trim() ?? '';
  const alturaLinha = 6.4, alturaCab = 7;
  if (y + alturaCab + alturaLinha * Math.min(linhas.length, 3) + 10 > 280) y = novaPagina();
  titulo('Medidas');
  const cols = comAnterior ? [M + 4, 92, 120, 152] : [M + 4, 130];
  const altTab = alturaCab + alturaLinha * linhas.length;
  if (y + altTab > 282) y = novaPagina();
  doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
  doc.roundedRect(M, y, LARG, altTab, 2.2, 2.2, 'FD');
  doc.setFillColor(...CAB); doc.roundedRect(M, y, LARG, alturaCab, 2.2, 2.2, 'F'); doc.rect(M, y + alturaCab - 2.2, LARG, 2.2, 'F');
  doc.setDrawColor(...BORDA); doc.line(M, y + alturaCab, W - M, y + alturaCab);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...AZUL);
  t('Medida', cols[0], y + 4.7); t('Agora', cols[1], y + 4.7);
  if (comAnterior) { t(dataAnterior ? `Antes (${dataAnterior})` : 'Antes', cols[2], y + 4.7); t('Variação', cols[3], y + 4.7); }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20);
  linhas.forEach((l, i) => {
    const yy = y + alturaCab + alturaLinha * i;
    if (i > 0) { doc.setDrawColor(...BORDA); doc.setLineWidth(0.15); doc.line(M + 2, yy, W - M - 2, yy); }
    const base = yy + 4.4;
    t(l.nome, cols[0], base); t(grau(l.atual!.graus, l.atual!.unidade), cols[1], base);
    if (comAnterior) { t(grau(l.anterior?.graus, l.atual!.unidade), cols[2], base); doc.setFont('helvetica', 'bold'); t(variacaoTexto(l.variacao, l.atual!.unidade), cols[3], base); doc.setFont('helvetica', 'normal'); }
  });
  y += altTab + 8;
  const notasDaTabela = [...(comAnterior && !dataAnterior ? ['Data da avaliação anterior não informada.'] : []), ...(d.avisos ?? [])];
  if (notasDaTabela.length) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(100);
    const linhasDasNotas = notasDaTabela.flatMap((n) => doc.splitTextToSize(seguro(n), LARG) as string[]);
    if (y - 3.8 + linhasDasNotas.length * 3.3 > 272) y = novaPagina() + 3.8;
    let yy = y - 3.8;
    for (const ln of linhasDasNotas) { doc.text(ln, M, yy); yy += 3.3; }
    y = Math.max(y, yy + 2.5);
    doc.setTextColor(20);
  }

  // Leitura
  const itens = linhas.filter((l) => l.atual?.texto).map((l) => doc.splitTextToSize(seguro(`${l.atual!.texto!}${ehMedidaParaConfirmar(l.id) ? ` (${ROTULO_CONFIRMAR})` : ''}`), LARG - 12) as string[]);
  if (itens.length) {
    const altBox = itens.reduce((s, q) => s + q.length * 4 + 1.6, 0) + 5;
    if (y + altBox + 8 > 282) y = novaPagina();
    titulo('Leitura');
    doc.setFillColor(247, 249, 252); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
    doc.roundedRect(M, y, LARG, altBox, 2.2, 2.2, 'FD');
    doc.setFillColor(...AZUL); doc.roundedRect(M, y, 1.4, altBox, 0.7, 0.7, 'F');
    let yy = y + 5.2;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8); doc.setTextColor(20);
    for (const q of itens) { doc.text(q, M + 6, yy); yy += q.length * 4 + 1.6; }
    y += altBox + 3;
    if (comAnterior) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(100);
      const f = doc.splitTextToSize(seguro('A variação é a diferença numérica entre as duas avaliações. O número não mostra o lado (direito ou esquerdo, anterior ou posterior, varo ou valgo, à frente ou atrás do fio), que está na leitura de cada avaliação; se o lado mudou, a variação não é calculada.'), LARG);
      doc.text(f, M, y + 2); doc.setTextColor(20);
    }
  }

  // Rodapé de método
  const rodape = doc.splitTextToSize(seguro(`${d.metodo === 'automatica_conferida' ? fraseDosPontos(d.metodo, d.pontos) : 'Pontos marcados manualmente pelo profissional.'} ${d.notaExtra ?? 'Os ângulos usam a horizontal e a vertical da foto como referência e valem para acompanhar a evolução entre fotos feitas do mesmo jeito.'} Medida de acompanhamento, não é diagnóstico.`), LARG);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(110);
  doc.text(rodape, M, 287 - rodape.length * 3.3);

  molduraEmTodasPaginas(doc);
  return { blob: doc.output('blob'), nome: `Analise_angular_${paciente.replace(/[^\w]+/g, '_')}_${dataArquivo(d.data)}.pdf` };
}
