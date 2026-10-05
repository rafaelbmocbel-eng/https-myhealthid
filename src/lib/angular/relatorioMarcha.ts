import jsPDF from 'jspdf';
import '@/lib/pdf/patchJsPdf';
import { molduraEmTodasPaginas } from '@/lib/pdf/moldura';
import { nomeDocumento } from '@/lib/pdf/entrega';
import { addLogoToDoc } from '@/utils/pdfLogoHelper';
import type { Lado, ResultadoMarcha } from './marcha';

const AZUL: [number, number, number] = [30, 58, 95];
const CAB: [number, number, number] = [230, 237, 245];
const BORDA: [number, number, number] = [208, 214, 222];
const DOURADO: [number, number, number] = [234, 170, 20];
const COR_LADO: Record<Lado, string> = { D: '#2A78D6', E: '#EB6834' };

const seguro = (s: string) => String(s).replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/−/g, '-').replace(/–/g, '-').replace(/—/g, '-').replace(/·/g, '-').replace(/→/g, '>');
const n2 = (v: number | null | undefined, un = '') => (v == null ? '-' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${un}`);
const n1 = (v: number | null | undefined, un = '') => (v == null ? '-' : `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${un}`);

export interface DadosRelatorioMarcha {
  paciente: string;
  profissional?: string;
  logoUrl?: string;
  /** dd/mm/aaaa */
  data: string;
  resultado: ResultadoMarcha;
  fps: number;
}

// Gráfico de linhas desenhado em canvas só para o PDF (a tela usa SVG). Sem canvas (testes), devolve null.
function curvaPNG(d: number[] | null, e: number[] | null): string | null {
  if (typeof document === 'undefined') return null;
  const W = 520, H = 280, esc = 2;
  const cv = document.createElement('canvas');
  cv.width = W * esc; cv.height = H * esc;
  const x = cv.getContext('2d');
  if (!x) return null;
  const todos = [...(d ?? []), ...(e ?? [])];
  if (!todos.length) return null;
  x.scale(esc, esc);
  x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, H);
  const L = 44, R = 14, T = 14, B = 30, pw = W - L - R, ph = H - T - B;
  const min = Math.min(...todos), max = Math.max(...todos), span = max - min || 1;
  const X = (i: number) => L + (i / 100) * pw, Y = (v: number) => T + (1 - (v - min) / span) * ph;
  x.font = '12px Helvetica, Arial, sans-serif';
  x.textBaseline = 'middle'; x.textAlign = 'right';
  for (const v of [min, (min + max) / 2, max]) {
    x.strokeStyle = '#E6E8EC'; x.lineWidth = 1; x.beginPath(); x.moveTo(L, Y(v)); x.lineTo(L + pw, Y(v)); x.stroke();
    x.fillStyle = '#4A5262'; x.fillText(`${Math.round(v)}°`, L - 6, Y(v));
  }
  x.textAlign = 'center'; x.textBaseline = 'top';
  for (const p of [0, 50, 100]) x.fillText(`${p}%`, X(p), T + ph + 8);
  x.strokeStyle = '#C3C6CE'; x.beginPath(); x.moveTo(L, T + ph); x.lineTo(L + pw, T + ph); x.stroke();
  x.lineJoin = 'round'; x.lineWidth = 2.5;
  for (const [c, cor] of [[d, COR_LADO.D], [e, COR_LADO.E]] as const) {
    if (!c) continue;
    x.strokeStyle = cor; x.beginPath();
    c.forEach((v, i) => (i ? x.lineTo(X(i), Y(v)) : x.moveTo(X(i), Y(v))));
    x.stroke();
  }
  return cv.toDataURL('image/png');
}

export async function gerarRelatorioMarcha(d: DadosRelatorioMarcha): Promise<{ blob: Blob; nome: string }> {
  const r = d.resultado;
  const paciente = nomeDocumento(d.paciente);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14, LARG = W - 2 * M;
  const t = (txt: string, x: number, y: number, op?: Parameters<jsPDF['text']>[3]) => doc.text(seguro(txt), x, y, op);
  const novaPagina = () => { doc.addPage(); return 18; };

  let y = 18;
  try { await addLogoToDoc(doc, W - M - 16, 10, 16, d.logoUrl); } catch { /* logo é opcional */ }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...AZUL); t('Análise da marcha', M, y); y += 7;
  doc.setFontSize(11.5); doc.setTextColor(20); t(paciente, M, y); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  t(`Vídeo lateral · ${d.data}${d.profissional ? ` · ${d.profissional}` : ''}`, M, y); y += 4;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.5); doc.line(M, y, M + 28, y);
  doc.setDrawColor(...BORDA); doc.setLineWidth(0.25); doc.line(M + 28, y, W - M, y); y += 8;
  doc.setTextColor(20);

  const titulo = (txt: string) => {
    doc.setFillColor(...AZUL); doc.roundedRect(M, y - 3.6, 1.4, 5, 0.7, 0.7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...AZUL); t(txt, M + 4, y); doc.setTextColor(20);
    y += 5;
  };

  // Cartões de resumo
  titulo('Resumo');
  const cartoes: [string, string, string][] = [
    ['PASSOS', String(r.passos), `em ${n1(r.duracaoS, ' s')} de vídeo`],
    ['CADÊNCIA', n1(r.cadencia), 'passos por minuto'],
    ['TEMPO DO PASSO', n2(r.tempoPassoMedioS), 'segundos, em média'],
    ['SIMETRIA DO TEMPO', n1(r.simetriaTempoPct), '% (menor ÷ maior)'],
  ];
  const gap = 3, wc = (LARG - gap * 3) / 4, hc = 24;
  cartoes.forEach(([rot, val, sub], i) => {
    const x = M + i * (wc + gap);
    doc.setFillColor(247, 249, 252); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
    doc.roundedRect(x, y, wc, hc, 2.2, 2.2, 'FD');
    doc.setFillColor(...AZUL); doc.roundedRect(x, y, 1.4, hc, 0.7, 0.7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor(100); t(rot, x + 4, y + 5.2);
    doc.setFontSize(15); doc.setTextColor(...AZUL); t(val, x + 4, y + 13.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(100); t(sub, x + 4, y + 19.5);
  });
  doc.setTextColor(20);
  y += hc + 8;

  // Tabela direito x esquerdo
  const linhas: [string, string, string][] = [
    ['Ciclos analisados', String(r.ciclos.D), String(r.ciclos.E)],
    ['Fase de apoio (estimada)', n1(r.apoioPct.D, '%'), n1(r.apoioPct.E, '%')],
    ['Flexão máxima do joelho', n1(r.flexaoMaxJoelho.D, '°'), n1(r.flexaoMaxJoelho.E, '°')],
    ['Amplitude do joelho', n1(r.amplitude.joelho.D, '°'), n1(r.amplitude.joelho.E, '°')],
    ['Amplitude do quadril', n1(r.amplitude.quadril.D, '°'), n1(r.amplitude.quadril.E, '°')],
    ['Tempo do passo (a partir do contato do lado)', n2(r.tempoPasso.D, ' s'), n2(r.tempoPasso.E, ' s')],
  ];
  const altL = 6.4, altC = 7, altTab = altC + altL * linhas.length;
  if (y + altTab + 10 > 282) y = novaPagina();
  titulo('Direito e esquerdo');
  const c1 = M + 4, c2 = 128, c3 = 160;
  doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
  doc.roundedRect(M, y, LARG, altTab, 2.2, 2.2, 'FD');
  doc.setFillColor(...CAB); doc.roundedRect(M, y, LARG, altC, 2.2, 2.2, 'F'); doc.rect(M, y + altC - 2.2, LARG, 2.2, 'F');
  doc.setDrawColor(...BORDA); doc.line(M, y + altC, W - M, y + altC);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...AZUL);
  t('Medida', c1, y + 4.7); t('Direito', c2, y + 4.7); t('Esquerdo', c3, y + 4.7);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20);
  linhas.forEach(([nome, vd, ve], i) => {
    const yy = y + altC + altL * i;
    if (i > 0) { doc.setDrawColor(...BORDA); doc.setLineWidth(0.15); doc.line(M + 2, yy, W - M - 2, yy); }
    t(nome, c1, yy + 4.4); t(vd, c2, yy + 4.4); t(ve, c3, yy + 4.4);
  });
  y += altTab + 8;

  // Curvas
  const joelho = curvaPNG(r.curvas.joelho.D, r.curvas.joelho.E);
  const quadril = curvaPNG(r.curvas.quadril.D, r.curvas.quadril.E);
  if (joelho || quadril) {
    const wg = (LARG - 4) / 2, hg = (wg * 280) / 520;
    if (y + hg + 22 > 282) y = novaPagina();
    titulo('Curvas médias do ciclo da marcha');
    [['Joelho (flexão)', joelho], ['Quadril (coxa × vertical)', quadril]].forEach(([nome, img], i) => {
      const x = M + i * (wg + 4);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(60); t(nome as string, x, y + 1);
      if (img) {
        doc.setDrawColor(...BORDA); doc.setLineWidth(0.3); doc.roundedRect(x, y + 3, wg, hg, 2, 2, 'S');
        doc.addImage(img as string, 'PNG', x + 0.5, y + 3.5, wg - 1, hg - 1, undefined, 'FAST');
      }
    });
    y += hg + 8;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.setFillColor(COR_LADO.D); doc.circle(M + 1.5, y - 0.8, 1.2, 'F'); doc.setTextColor(60); t('Direito', M + 4, y);
    doc.setFillColor(COR_LADO.E); doc.circle(M + 24, y - 0.8, 1.2, 'F'); t('Esquerdo', M + 26.5, y);
    t('Média dos ciclos, de contato a contato do mesmo pé (0 a 100%).', M + 50, y);
    doc.setTextColor(20);
    y += 8;
  }

  // Observações
  if (y + 30 > 282) y = novaPagina();
  titulo('Observações');
  const itens = (doc.splitTextToSize(seguro(r.avisos.map((a) => `- ${a}`).join('\n')), LARG - 12) as string[]);
  const altBox = itens.length * 4 + 5;
  doc.setFillColor(247, 249, 252); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
  doc.roundedRect(M, y, LARG, altBox, 2.2, 2.2, 'FD');
  doc.setFillColor(...AZUL); doc.roundedRect(M, y, 1.4, altBox, 0.7, 0.7, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(20);
  doc.text(itens, M + 6, y + 5);

  const rodape = doc.splitTextToSize(seguro(`Pontos do corpo detectados automaticamente em vídeo gravado de lado, analisado a ${d.fps} quadros por segundo; com câmera comum o tempo de cada passo tem erro de cerca de ${(1 / d.fps).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} s. Os eventos da marcha são estimados pelo movimento do pé em relação ao quadril; o comprimento do passo não é medido (sem escala). Medida de acompanhamento, não é diagnóstico.`), LARG);
  doc.setFontSize(7.4); doc.setTextColor(110);
  doc.text(rodape, M, 287 - rodape.length * 3.3);

  molduraEmTodasPaginas(doc);
  return { blob: doc.output('blob'), nome: `Analise_marcha_${paciente.replace(/[^\w]+/g, '_')}_${d.data.split('/').reverse().join('-')}.pdf` };
}
