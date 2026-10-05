import jsPDF from 'jspdf';
import '@/lib/pdf/patchJsPdf';
import { molduraEmTodasPaginas } from '@/lib/pdf/moldura';
import { nomeDocumento } from '@/lib/pdf/entrega';
import { addLogoToDoc } from '@/utils/pdfLogoHelper';

const AZUL: [number, number, number] = [30, 58, 95];
const CAB: [number, number, number] = [230, 237, 245];
const BORDA: [number, number, number] = [208, 214, 222];
const DOURADO: [number, number, number] = [234, 170, 20];

const seguro = (s: string) => String(s).replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/−/g, '-').replace(/–/g, '-').replace(/—/g, '-').replace(/·/g, '-');

export interface CapturaRelatorio {
  /** segundos no vídeo */
  t: number;
  quadro: number;
  nome: string;
  valorTexto: string;
  texto: string;
  /** JPEG do quadro com as marcações */
  imagem?: { url: string; w: number; h: number } | null;
}

export interface DadosRelatorioVideo {
  paciente: string;
  profissional?: string;
  logoUrl?: string;
  data: string;
  fps: number;
  capturas: CapturaRelatorio[];
  notaExtra?: string;
}

export async function gerarRelatorioVideo(d: DadosRelatorioVideo): Promise<{ blob: Blob; nome: string }> {
  const paciente = nomeDocumento(d.paciente);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14, LARG = W - 2 * M;
  const t = (txt: string, x: number, y: number, op?: Parameters<jsPDF['text']>[3]) => doc.text(seguro(txt), x, y, op);
  const novaPagina = () => { doc.addPage(); return 18; };
  const seg = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let y = 18;
  try { await addLogoToDoc(doc, W - M - 16, 10, 16, d.logoUrl); } catch { /* logo é opcional */ }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...AZUL); t('Análise angular em vídeo', M, y); y += 7;
  doc.setFontSize(11.5); doc.setTextColor(20); t(paciente, M, y); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  t(`Medidas ponto a ponto · ${d.data}${d.profissional ? ` · ${d.profissional}` : ''}`, M, y); y += 4;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.5); doc.line(M, y, M + 28, y);
  doc.setDrawColor(...BORDA); doc.setLineWidth(0.25); doc.line(M + 28, y, W - M, y); y += 8;
  doc.setTextColor(20);

  const titulo = (txt: string) => {
    doc.setFillColor(...AZUL); doc.roundedRect(M, y - 3.6, 1.4, 5, 0.7, 0.7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...AZUL); t(txt, M + 4, y); doc.setTextColor(20);
    y += 5;
  };

  // Tabela de medidas
  const altL = 6.4, altC = 7;
  titulo('Medidas');
  const porPagina = Math.max(1, Math.floor((276 - y - altC) / altL));
  for (let ini = 0; ini < d.capturas.length; ini += porPagina) {
    const fatia = d.capturas.slice(ini, ini + porPagina);
    const alt = altC + altL * fatia.length;
    doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
    doc.roundedRect(M, y, LARG, alt, 2.2, 2.2, 'FD');
    doc.setFillColor(...CAB); doc.roundedRect(M, y, LARG, altC, 2.2, 2.2, 'F'); doc.rect(M, y + altC - 2.2, LARG, 2.2, 'F');
    doc.setDrawColor(...BORDA); doc.line(M, y + altC, W - M, y + altC);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...AZUL);
    t('Tempo', M + 4, y + 4.7); t('Quadro', M + 28, y + 4.7); t('Medida', M + 50, y + 4.7); t('Valor', M + 140, y + 4.7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20);
    fatia.forEach((c, i) => {
      const yy = y + altC + altL * i;
      if (i > 0) { doc.setDrawColor(...BORDA); doc.setLineWidth(0.15); doc.line(M + 2, yy, W - M - 2, yy); }
      t(`${seg(c.t)} s`, M + 4, yy + 4.4); t(String(c.quadro), M + 28, yy + 4.4); t(c.nome, M + 50, yy + 4.4);
      doc.setFont('helvetica', 'bold'); t(c.valorTexto, M + 140, yy + 4.4); doc.setFont('helvetica', 'normal');
    });
    y += alt + 8;
    if (ini + porPagina < d.capturas.length) y = novaPagina();
  }

  // Quadros marcados, dois por linha
  const comImagem = d.capturas.filter((c) => c.imagem);
  if (comImagem.length) {
    if (y + 60 > 282) y = novaPagina();
    titulo('Quadros marcados');
    const wc = (LARG - 5) / 2, hMax = 82;
    for (let i = 0; i < comImagem.length; i += 2) {
      const par = comImagem.slice(i, i + 2);
      const hs = par.map((c) => Math.min(hMax, wc / (c.imagem!.w / c.imagem!.h)));
      const hLinha = Math.max(...hs) + 11;
      if (y + hLinha > 282) y = novaPagina();
      par.forEach((c, k) => {
        const x = M + k * (wc + 5);
        const h = hs[k], w = h * (c.imagem!.w / c.imagem!.h);
        doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA); doc.setLineWidth(0.4);
        doc.roundedRect(x, y, w + 3, h + 3, 2.5, 2.5, 'FD');
        doc.addImage(c.imagem!.url, 'JPEG', x + 1.5, y + 1.5, w, h, undefined, 'FAST');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(70);
        const leg = doc.splitTextToSize(seguro(`${seg(c.t)} s · ${c.nome}: ${c.valorTexto}`), wc);
        doc.text(leg, x, y + h + 7); doc.setTextColor(20);
      });
      y += hLinha;
    }
  }

  const rodape = doc.splitTextToSize(seguro(`Pontos marcados pelo profissional em quadros do vídeo, a ${d.fps} quadros por segundo. ${d.notaExtra ?? 'Os ângulos usam a horizontal e a vertical da imagem como referência.'} Medida de acompanhamento, não é diagnóstico.`), LARG);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(110);
  doc.text(rodape, M, 287 - rodape.length * 3.3);

  molduraEmTodasPaginas(doc);
  return { blob: doc.output('blob'), nome: `Analise_angular_video_${paciente.replace(/[^\w]+/g, '_')}_${d.data.split('/').reverse().join('-')}.pdf` };
}
