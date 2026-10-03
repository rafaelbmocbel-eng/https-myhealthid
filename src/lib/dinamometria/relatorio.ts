import jsPDF from 'jspdf';
import { addLogoToDoc } from '@/utils/pdfLogoHelper';
import {
  type Analise, type Avaliacao, type Criterios, type Lado, type Slot,
  SLOTS, UF, fmt, nomeSlot, dataBR, stLSI, stDesvio, interpretar,
} from './analise';

const COR = { D: '#2A78D6', E: '#EB6834', ink: '#141922', ink2: '#4A5262', grade: '#E6E8EC', eixo: '#C3C6CE', fundo: '#FFFFFF' };

interface Serie { nome: string; cor: string; pts: [number, number][] }

// Gráfico de linhas desenhado em canvas só para o PDF (a tela usa Recharts).
function graficoPNG(series: Serie[], o: { xFmt: (v: number) => string; yFmt: (v: number) => string; xTicks?: [number, string][]; pontos?: boolean; yMin100?: boolean; W?: number; H?: number }): string {
  const W = o.W ?? 760, H = o.H ?? 260, esc = 2;
  const cv = document.createElement('canvas');
  cv.width = W * esc; cv.height = H * esc;
  const x = cv.getContext('2d');
  if (!x) return '';
  x.scale(esc, esc);
  x.fillStyle = COR.fundo; x.fillRect(0, 0, W, H);
  const L = 50, Rm = 14, T = 14, B = 30, pw = W - L - Rm, ph = H - T - B;
  const todos = series.flatMap(s => s.pts);
  if (!todos.length) return cv.toDataURL('image/png');
  let x0 = Math.min(...todos.map(p => p[0])), x1 = Math.max(...todos.map(p => p[0]));
  if (o.xTicks) { x0 = -0.3; x1 = o.xTicks.length - 0.7; }
  if (x1 === x0) x1 = x0 + 1;
  const ymaxBruto = Math.max(...todos.map(p => p[1]), o.yMin100 ? 100 : 0) * 1.08 || 1;
  const passoBruto = ymaxBruto / 4, p10 = Math.pow(10, Math.floor(Math.log10(passoBruto))), r = passoBruto / p10;
  const ys = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * p10;
  const y1 = Math.ceil(ymaxBruto / ys) * ys;
  const X = (v: number) => L + ((v - x0) / (x1 - x0)) * pw, Y = (v: number) => T + ph - (v / y1) * ph;
  x.font = '11px Helvetica, Arial, sans-serif'; x.textBaseline = 'middle';
  for (let v = 0; v <= y1 + 1e-9; v += ys) {
    x.strokeStyle = COR.grade; x.lineWidth = 1; x.beginPath(); x.moveTo(L, Y(v)); x.lineTo(L + pw, Y(v)); x.stroke();
    x.fillStyle = COR.ink2; x.textAlign = 'right'; x.fillText(o.yFmt(v), L - 6, Y(v));
  }
  x.strokeStyle = COR.eixo; x.beginPath(); x.moveTo(L, T + ph); x.lineTo(L + pw, T + ph); x.stroke();
  x.textAlign = 'center'; x.textBaseline = 'top';
  if (o.xTicks) o.xTicks.forEach(([v, l]) => x.fillText(l, X(v), T + ph + 8));
  else {
    const passo = Math.max(0.5, Math.round((x1 - x0) / 6));
    for (let v = Math.ceil(x0 / passo) * passo; v <= x1 + 1e-9; v += passo) x.fillText(o.xFmt(v), X(v), T + ph + 8);
  }
  for (const s of series) {
    x.strokeStyle = s.cor; x.lineWidth = 2; x.lineJoin = 'round'; x.beginPath();
    s.pts.forEach((p, i) => (i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1]))));
    x.stroke();
    if (o.pontos) for (const p of s.pts) { x.beginPath(); x.arc(X(p[0]), Y(p[1]), 4.5, 0, 7); x.fillStyle = s.cor; x.fill(); x.lineWidth = 2; x.strokeStyle = COR.fundo; x.stroke(); }
  }
  return cv.toDataURL('image/png');
}

const seguro = (s: string) => String(s)
  .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/≈/g, '~').replace(/−/g, '-').replace(/–/g, '-')
  .replace(/·/g, '-').replace(/×/g, 'x').replace(/÷/g, '/');

export interface DadosRelatorio {
  paciente: string; profissional?: string; logoUrl?: string; data: string; av: Avaliacao; A: Analise; c: Criterios;
  anterior?: { data: string; av: Avaliacao } | null; historico: { data: string; score: number | null }[];
}

export async function gerarRelatorioDinamometria(d: DadosRelatorio) {
  const { av, A, c } = d;
  const R = A.R, u = c.unidade, s = av.sujeito;
  const disp = (N?: number | null) => (N == null ? null : N / UF[u]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14;
  let y = 14;
  const t = (txt: string, xx: number, yy: number, op?: Parameters<jsPDF['text']>[3]) => doc.text(seguro(txt), xx, yy, op);
  try { await addLogoToDoc(doc, W - M - 16, 8, 16, d.logoUrl); } catch { /* logo é opcional no relatório */ }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(20); t('Avaliação de dinamometria isométrica', M, y + 4);
  y += 11;
  doc.setFontSize(11); t(d.paciente, M, y); doc.setFont('helvetica', 'normal'); y += 5;
  doc.setFontSize(9.5); doc.setTextColor(70);
  const idade = s.idade != null ? `${s.idade} anos` : '';
  t([s.sexo === 'M' ? 'Masculino' : 'Feminino', idade, s.peso ? `${s.peso} kg` : '', s.modalidade || '', `dominante ${s.dominante === 'E' ? 'esquerdo' : 'direito'}`].filter(Boolean).join(', ') + ` | ${R.l} | ${dataBR(d.data)}`, M, y);
  if (d.profissional) { y += 4.5; t(`Profissional: ${d.profissional}`, M, y); }
  y += 4; doc.setDrawColor(210); doc.line(M, y, W - M, y); y += 11;

  doc.setTextColor(20); doc.setFontSize(9); t('SCORE DE FORÇA', M, y - 5);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(38); const sc = String(A.score ?? '-'); t(sc, M, y + 7);
  doc.setFontSize(12); t('/100', M + sc.length * 8.2 + 1, y + 7); t((A.categoria ? A.categoria[1] : 'Sem dados').toUpperCase(), M, y + 14);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  const cx = 92;
  const comps: [string, number | null][] = [['Simetria bilateral', A.comps.sim], ['Agonista x antagonista', A.comps.raz], ['Resistência à fadiga', A.comps.fad], ['Estabilidade da curva', A.comps.est]];
  comps.forEach(([l, v], i) => {
    const yy = y - 5 + i * 7.5;
    t(l, cx, yy); t(v == null ? 'n/d' : `${fmt(v, 0)}/25`, W - M, yy, { align: 'right' });
    doc.setFillColor(232, 234, 238); doc.rect(cx, yy + 1.4, W - M - cx, 2, 'F');
    if (v != null) { doc.setFillColor(20, 25, 34); doc.rect(cx, yy + 1.4, ((W - M - cx) * v) / 25, 2, 'F'); }
  });
  y += 26;

  const cab = ['Músculo', `Pico (${u})`, 'N/kg', 'z (norma)', `RFD 0-200 (${u}/s)`, 'Fadiga', 'Oscilação'];
  const cols = [M, 66, 90, 108, 130, 164, 184];
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.8); cab.forEach((h, i) => t(h, cols[i], y)); doc.setFont('helvetica', 'normal');
  y += 2; doc.line(M, y, W - M, y); y += 5;
  for (const k of SLOTS) {
    const m = A.slots[k];
    if (!m) continue;
    const linha = [nomeSlot(av.regiao, k), fmt(disp(m.pico), 1), m.nkg == null ? '-' : fmt(m.nkg, 1), m.z == null ? '-' : fmt(m.z, 1), m.rfd200 == null ? '-' : fmt(disp(m.rfd200), 0), m.fadiga == null ? '-' : `${fmt(m.fadiga, 0)}%`, m.oscilacao == null ? '-' : `${fmt(m.oscilacao, 1)}%`];
    linha.forEach((v, i) => t(v, cols[i], y));
    y += 5.5;
  }
  y += 2; doc.setFont('helvetica', 'bold'); doc.setFontSize(10); t('Simetria e equilíbrio', M, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.3); y += 5.5;
  const linhas = [
    `Simetria ${R.ag}: ${A.lsiAg ? `${fmt(A.lsiAg.v, 0)}% (${stLSI(A.lsiAg.v)?.[1]})` : '-'}`,
    `Simetria ${R.an}: ${A.lsiAn ? `${fmt(A.lsiAn.v, 0)}% (${stLSI(A.lsiAn.v)?.[1]})` : '-'}`,
  ];
  for (const l of ['D', 'E'] as Lado[]) {
    const x = A.razoes[l];
    if (x) linhas.push(`${R.razaoL} ${l === 'D' ? 'direito' : 'esquerdo'}: ${fmt(x.r * 100, 0)}% (referência ${x.refTxt || '-'}${x.desvio != null ? `, ${stDesvio(x.desvio, c)?.[1].toLowerCase()}` : ''})`);
  }
  for (const l of linhas) { t(l, M, y); y += 5; }

  const serie = (g: 'ag' | 'an'): Serie[] => (['D', 'E'] as Lado[]).flatMap(l => {
    const sl = av.slots[`${g}${l}` as Slot];
    return sl ? [{ nome: l, cor: COR[l], pts: sl.curva.t.map((tt, i) => [tt, sl.curva.f[i] / UF[u]] as [number, number]) }] : [];
  });
  const opC = { xFmt: (v: number) => `${fmt(v, 0)} s`, yFmt: (v: number) => fmt(v, 0) };
  const meia = (W - 2 * M) / 2 - 2;
  y += 3;
  doc.addImage(graficoPNG(serie('ag'), opC), 'PNG', M, y, meia, meia * 260 / 760);
  doc.addImage(graficoPNG(serie('an'), opC), 'PNG', M + meia + 4, y, meia, meia * 260 / 760);
  doc.setFontSize(8); doc.setTextColor(90);
  t(`Curva ${R.ag} (${u}): azul = direito, laranja = esquerdo`, M, y + meia * 260 / 760 + 4);
  t(`Curva ${R.an} (${u})`, M + meia + 4, y + meia * 260 / 760 + 4);
  doc.setTextColor(20); y += meia * 260 / 760 + 11;

  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); t('Interpretação', M, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.4); y += 5.5;
  for (const p of interpretar(av, A, c, d.anterior)) {
    const ls = doc.splitTextToSize(seguro(p), W - 2 * M);
    if (y + ls.length * 4.5 > 284) { doc.addPage(); y = 18; }
    doc.text(ls, M, y); y += ls.length * 4.5 + 1.5;
  }
  if (d.historico.length > 1) {
    const h = (W - 2 * M) * 220 / 760;
    if (y + h + 10 > 284) { doc.addPage(); y = 18; }
    y += 3; doc.setFont('helvetica', 'bold'); doc.setFontSize(10); t('Evolução do score de força', M, y); doc.setFont('helvetica', 'normal'); y += 3;
    const img = graficoPNG([{ nome: 'Score', cor: COR.D, pts: d.historico.map((x, i) => [i, x.score ?? 0]) }], { xFmt: String, yFmt: v => fmt(v, 0), xTicks: d.historico.map((x, i) => [i, dataBR(x.data).slice(0, 5)]), pontos: true, yMin100: true, H: 220 });
    doc.addImage(img, 'PNG', M, y, W - 2 * M, h); y += h + 4;
  }
  doc.setFontSize(7.4); doc.setTextColor(110);
  const rod = doc.splitTextToSize(seguro('O score de força é um índice interno do serviço, com faixas ajustáveis; não é uma escala validada. Normas: McKay et al., Neurology 2017 (membro dominante). Simetria >= 90%: Grindem et al., Br J Sports Med 2016. Adução/abdução do quadril >= 0,80: Tyler et al., Am J Sports Med 2001.'), W - 2 * M);
  if (y > 270) { doc.addPage(); y = 18; }
  doc.text(rod, M, Math.max(y + 4, 286 - rod.length * 3.3));
  doc.save(`Dinamometria_${d.paciente.replace(/[^\wÀ-ú]+/g, '_')}_${d.data}.pdf`);
}
