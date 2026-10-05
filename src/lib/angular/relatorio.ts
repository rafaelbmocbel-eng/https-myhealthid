import jsPDF from 'jspdf';
import '@/lib/pdf/patchJsPdf';
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
}

const dataArquivo = (br: string) => br.split('/').reverse().join('-');

/** Desenha a foto com as retas e os pontos marcados e devolve um JPEG reduzido (data URL). */
export function fotoComMarcacoes(img: HTMLImageElement, grupos: Ponto[][], larguraMax = 1100): { url: string; w: number; h: number } | null {
  const esc = Math.min(1, larguraMax / img.naturalWidth);
  const w = Math.round(img.naturalWidth * esc), h = Math.round(img.naturalHeight * esc);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  if (!c) return null;
  c.drawImage(img, 0, 0, w, h);
  const raio = Math.max(w, h) / 110;
  const cores = ['#ef4444', '#3b82f6', '#10b981'];
  for (const g of grupos) {
    if (g.length > 1) {
      c.strokeStyle = '#facc15'; c.lineWidth = raio / 4; c.beginPath();
      g.forEach((p, i) => (i ? c.lineTo(p.x * esc, p.y * esc) : c.moveTo(p.x * esc, p.y * esc)));
      c.stroke();
    }
    g.forEach((p, i) => {
      c.beginPath(); c.arc(p.x * esc, p.y * esc, raio, 0, Math.PI * 2);
      c.fillStyle = cores[i % cores.length]; c.fill(); c.lineWidth = raio / 5; c.strokeStyle = '#fff'; c.stroke();
    });
  }
  return { url: cv.toDataURL('image/jpeg', 0.85), w, h };
}

export async function gerarRelatorioAngular(d: DadosRelatorioAngular): Promise<{ blob: Blob; nome: string }> {
  const paciente = nomeDocumento(d.paciente);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14;
  const t = (txt: string, x: number, y: number, op?: Parameters<jsPDF['text']>[3]) => doc.text(seguro(txt), x, y, op);
  let y = 16;
  try { await addLogoToDoc(doc, W - M - 16, 8, 16, d.logoUrl); } catch { /* logo é opcional */ }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(20); t('Análise angular', M, y); y += 7;
  doc.setFontSize(11); t(paciente, M, y); doc.setFont('helvetica', 'normal'); y += 5;
  doc.setFontSize(9); doc.setTextColor(90);
  t(`Vista ${d.vistaNome} - ${d.data}${d.profissional ? ` - ${d.profissional}` : ''}`, M, y); y += 7;
  doc.setTextColor(20);

  if (d.imagem) {
    const maxH = 120, maxW = W - 2 * M;
    const prop = d.imagem.w / d.imagem.h;
    const h = Math.min(maxH, maxW / prop), w = h * prop;
    doc.addImage(d.imagem.url, 'JPEG', M, y, w, h, undefined, 'FAST');
    y += h + 6;
  }

  const linhas = compararMedidas(d.medidas, d.anterior?.medidas ?? []).filter((l) => l.atual);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); t('Medidas', M, y); y += 5;
  doc.setFontSize(8.5);
  const comAnterior = !!d.anterior;
  const cols = comAnterior ? [M, 92, 118, 148, 172] : [M, 92];
  doc.setTextColor(90);
  t('Medida', cols[0], y); t('Agora', cols[1], y);
  if (comAnterior) { t(`Antes (${d.anterior!.data})`, cols[2], y); t('Variação', cols[3], y); }
  y += 2; doc.setDrawColor(200); doc.line(M, y, W - M, y); y += 4; doc.setTextColor(20); doc.setFont('helvetica', 'normal');
  for (const l of linhas) {
    if (y > 262) { doc.addPage(); y = 18; }
    t(l.nome, cols[0], y); t(grau(l.atual!.graus), cols[1], y);
    if (comAnterior) { t(grau(l.anterior?.graus), cols[2], y); t(variacaoTexto(l.variacao), cols[3], y); }
    y += 5;
  }
  y += 3;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); t('Leitura', M, y); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  for (const l of linhas) {
    if (!l.atual?.texto) continue;
    const quebra = doc.splitTextToSize(seguro(`- ${l.atual.texto}`), W - 2 * M);
    if (y + quebra.length * 4 > 272) { doc.addPage(); y = 18; }
    doc.text(quebra, M, y); y += quebra.length * 4 + 1;
  }
  if (comAnterior) {
    const frase = doc.splitTextToSize(seguro('A variação é a diferença numérica entre as duas avaliações; nos desníveis o número não mostra o lado, que está na leitura de cada avaliação.'), W - 2 * M);
    doc.setTextColor(90); doc.text(frase, M, y + 2); doc.setTextColor(20);
  }

  const rodape = doc.splitTextToSize(seguro(`${d.metodo === 'automatica_conferida' ? 'Pontos sugeridos por detecção automática de pose e conferidos pelo profissional.' : 'Pontos marcados manualmente pelo profissional.'} Os ângulos usam a horizontal e a vertical da foto como referência e valem para acompanhar a evolução entre fotos feitas do mesmo jeito. Medida de acompanhamento, não é diagnóstico.`), W - 2 * M);
  doc.setFontSize(7.4); doc.setTextColor(110);
  doc.text(rodape, M, 286 - rodape.length * 3.3);

  return { blob: doc.output('blob'), nome: `Analise_angular_${paciente.replace(/[^\w]+/g, '_')}_${dataArquivo(d.data)}.pdf` };
}
