import jsPDF from 'jspdf';
import '@/lib/pdf/patchJsPdf';
import { molduraEmTodasPaginas } from '@/lib/pdf/moldura';
import { nomeDocumento } from '@/lib/pdf/entrega';
import { addLogoToDoc } from '@/utils/pdfLogoHelper';
import { compararMedidas, grau, variacaoTexto, type MedidaSalva } from './comparar';
import type { Ponto } from './medidas';

const seguro = (s: string) => String(s).replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/−/g, '-').replace(/–/g, '-').replace(/—/g, '-').replace(/·/g, '-');

export interface DadosRelatorioAngular {
  paciente: string;
  profissional?: string;
  logoUrl?: string;
  /** dd/mm/aaaa */
  data: string;
  vistaNome: string;
  medidas: MedidaSalva[];
  metodo: 'automatica_conferida' | 'marcacao_manual';
  anterior?: { data: string; medidas: MedidaSalva[] } | null;
  /** Foto com as marcações já desenhadas (data URL JPEG), se o profissional quiser incluí-la. */
  imagem?: { url: string; w: number; h: number } | null;
  /** Frase extra para o rodapé (ex.: correção de nível aplicada). */
  notaExtra?: string;
}

const dataArquivo = (br: string) => br.split('/').reverse().join('-');

export interface GrupoDesenho { pontos: Ponto[]; segmentos: [number, number][]; cor: string; rotulo?: string }

/** Desenha a foto com as retas, os pontos e os valores marcados e devolve um JPEG reduzido (data URL). */
export function fotoComMarcacoes(img: HTMLImageElement | HTMLVideoElement, grupos: GrupoDesenho[], larguraMax = 1100): { url: string; w: number; h: number } | null {
  const largura = img instanceof HTMLVideoElement ? img.videoWidth : img.naturalWidth;
  const altura = img instanceof HTMLVideoElement ? img.videoHeight : img.naturalHeight;
  const esc = Math.min(1, larguraMax / largura);
  const w = Math.round(largura * esc), h = Math.round(altura * esc);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  if (!c) return null;
  c.drawImage(img, 0, 0, w, h);
  const raio = Math.max(w, h) / 110;
  const cores = ['#ef4444', '#3b82f6', '#10b981', '#a855f7'];
  c.lineJoin = 'round';
  for (const g of grupos) {
    c.strokeStyle = g.cor; c.lineWidth = raio / 4;
    for (const [i, j] of g.segmentos) {
      const A = g.pontos[i], B = g.pontos[j];
      if (!A || !B) continue;
      c.beginPath(); c.moveTo(A.x * esc, A.y * esc); c.lineTo(B.x * esc, B.y * esc); c.stroke();
    }
    g.pontos.forEach((p, i) => {
      c.beginPath(); c.arc(p.x * esc, p.y * esc, raio, 0, Math.PI * 2);
      c.fillStyle = cores[i % cores.length]; c.fill(); c.lineWidth = raio / 5; c.strokeStyle = '#fff'; c.stroke();
    });
    if (g.rotulo && g.pontos.length) {
      const cx = (g.pontos.reduce((s, p) => s + p.x, 0) / g.pontos.length) * esc;
      const cy = (g.pontos.reduce((s, p) => s + p.y, 0) / g.pontos.length) * esc - raio * 2;
      c.font = `700 ${Math.round(raio * 1.7)}px Helvetica, Arial, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = raio / 2.5; c.strokeStyle = '#000'; c.strokeText(g.rotulo, cx, cy);
      c.fillStyle = '#fff'; c.fillText(g.rotulo, cx, cy);
    }
  }
  return { url: cv.toDataURL('image/jpeg', 0.85), w, h };
}

const AZUL: [number, number, number] = [30, 58, 95];
const CAB: [number, number, number] = [230, 237, 245];
const BORDA: [number, number, number] = [208, 214, 222];
const DOURADO: [number, number, number] = [234, 170, 20];

export async function gerarRelatorioAngular(d: DadosRelatorioAngular): Promise<{ blob: Blob; nome: string }> {
  const paciente = nomeDocumento(d.paciente);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14, LARG = W - 2 * M;
  const t = (txt: string, x: number, y: number, op?: Parameters<jsPDF['text']>[3]) => doc.text(seguro(txt), x, y, op);
  const novaPagina = () => { doc.addPage(); return 18; };

  // Cabeçalho
  let y = 18;
  try { await addLogoToDoc(doc, W - M - 16, 10, 16, d.logoUrl); } catch { /* logo é opcional */ }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...AZUL); t('Análise angular', M, y); y += 7;
  doc.setFontSize(11.5); doc.setTextColor(20); t(paciente, M, y); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  t(`Vista ${d.vistaNome} · ${d.data}${d.profissional ? ` · ${d.profissional}` : ''}`, M, y); y += 4;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.5); doc.line(M, y, M + 28, y);
  doc.setDrawColor(...BORDA); doc.setLineWidth(0.25); doc.line(M + 28, y, W - M, y); y += 7;
  doc.setTextColor(20);

  const titulo = (txt: string) => {
    doc.setFillColor(...AZUL); doc.roundedRect(M, y - 3.6, 1.4, 5, 0.7, 0.7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...AZUL); t(txt, M + 4, y); doc.setTextColor(20);
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
  const linhas = compararMedidas(d.medidas, d.anterior?.medidas ?? []).filter((l) => l.atual);
  const comAnterior = !!d.anterior;
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
  if (comAnterior) { t(`Antes (${d.anterior!.data})`, cols[2], y + 4.7); t('Variação', cols[3], y + 4.7); }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20);
  linhas.forEach((l, i) => {
    const yy = y + alturaCab + alturaLinha * i;
    if (i > 0) { doc.setDrawColor(...BORDA); doc.setLineWidth(0.15); doc.line(M + 2, yy, W - M - 2, yy); }
    const base = yy + 4.4;
    t(l.nome, cols[0], base); t(grau(l.atual!.graus, l.atual!.unidade), cols[1], base);
    if (comAnterior) { t(grau(l.anterior?.graus, l.atual!.unidade), cols[2], base); doc.setFont('helvetica', 'bold'); t(variacaoTexto(l.variacao, l.atual!.unidade), cols[3], base); doc.setFont('helvetica', 'normal'); }
  });
  y += altTab + 8;

  // Leitura
  const itens = linhas.filter((l) => l.atual?.texto).map((l) => doc.splitTextToSize(seguro(l.atual!.texto!), LARG - 12) as string[]);
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
      const f = doc.splitTextToSize(seguro('A variação é a diferença numérica entre as duas avaliações; nos desníveis o número não mostra o lado, que está na leitura de cada avaliação.'), LARG);
      doc.text(f, M, y + 2); doc.setTextColor(20);
    }
  }

  // Rodapé de método
  const rodape = doc.splitTextToSize(seguro(`${d.metodo === 'automatica_conferida' ? 'Pontos sugeridos por detecção automática de pose e conferidos pelo profissional.' : 'Pontos marcados manualmente pelo profissional.'} ${d.notaExtra ?? 'Os ângulos usam a horizontal e a vertical da foto como referência e valem para acompanhar a evolução entre fotos feitas do mesmo jeito.'} Medida de acompanhamento, não é diagnóstico.`), LARG);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(110);
  doc.text(rodape, M, 287 - rodape.length * 3.3);

  molduraEmTodasPaginas(doc);
  return { blob: doc.output('blob'), nome: `Analise_angular_${paciente.replace(/[^\w]+/g, '_')}_${dataArquivo(d.data)}.pdf` };
}
