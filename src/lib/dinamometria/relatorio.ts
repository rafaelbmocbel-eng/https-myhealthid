import jsPDF from 'jspdf';
import { addLogoToDoc } from '@/utils/pdfLogoHelper';
import {
  type Analise, type Avaliacao, type Criterios, type Lado, type Slot, type Sujeito, type Unidade,
  SLOTS, SLOTS_POR_LADO, simetriaSlot, falhaPlato, UF, fmt, nomeSlot, dataBR, stLSI, stDesvio, stFadiga, stOsc, stZ, interpretar, type Status,
} from './analise';
import { MUSCULOS, COR_STATUS, mapaMuscularSVG, svgParaPNG, proporcaoSVG, itensAvatar, focoArticulacaoSVG } from './anatomia';
import { achadosDor, AVISO_DOR } from './dor';
import { REFERENCIAS, citar, citarCurto } from './referencias';

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

// Barras horizontais direito × esquerdo por movimento, com a faixa normal
// para idade e sexo (média ± 1 DP) ao fundo. Canvas só para o PDF.
export interface GrupoBarras { nome: string; D: number | null; E: number | null; min: number | null; ref: number | null }
function barrasPNG(grupos: GrupoBarras[], unidade: string, W = 640): string {
  const linhaH = 22, gap = 14, T = 26, B = 24, L = 168, Rm = 56;
  const H = T + B + grupos.length * (2 * linhaH + gap);
  const esc = 2, cv = document.createElement('canvas');
  cv.width = W * esc; cv.height = H * esc;
  const x = cv.getContext('2d');
  if (!x) return '';
  x.scale(esc, esc);
  x.fillStyle = COR.fundo; x.fillRect(0, 0, W, H);
  const vals = grupos.flatMap(g => [g.D, g.E, g.ref == null || g.min == null ? null : 2 * g.ref - g.min]).filter((v): v is number => v != null);
  const bruto = Math.max(...vals, 1) * 1.08, p10 = Math.pow(10, Math.floor(Math.log10(bruto / 4))), r = bruto / 4 / p10;
  const passo = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * p10, x1 = Math.ceil(bruto / passo) * passo;
  const pw = W - L - Rm, X = (v: number) => L + (v / x1) * pw;
  x.font = '11px Helvetica, Arial, sans-serif'; x.textBaseline = 'middle';
  for (let v = 0; v <= x1 + 1e-9; v += passo) {
    x.strokeStyle = COR.grade; x.lineWidth = 1; x.beginPath(); x.moveTo(X(v), T - 4); x.lineTo(X(v), H - B); x.stroke();
    x.fillStyle = COR.ink2; x.textAlign = 'center'; x.fillText(fmt(v, 0), X(v), H - B + 11);
  }
  grupos.forEach((g, i) => {
    const y0 = T + i * (2 * linhaH + gap);
    if (g.ref != null && g.min != null) {
      x.fillStyle = 'rgba(34,163,90,0.13)'; x.fillRect(X(g.min), y0 - 3, X(2 * g.ref - g.min) - X(g.min), 2 * linhaH + 6);
      x.strokeStyle = '#22A35A'; x.setLineDash([4, 3]); x.lineWidth = 1.5; x.beginPath(); x.moveTo(X(g.ref), y0 - 3); x.lineTo(X(g.ref), y0 + 2 * linhaH + 3); x.stroke(); x.setLineDash([]);
    }
    x.fillStyle = COR.ink; x.textAlign = 'right'; x.font = 'bold 12px Helvetica, Arial, sans-serif';
    x.fillText(g.nome, L - 20, y0 + linhaH);
    (['D', 'E'] as const).forEach((l, k) => {
      const v = g[l], yy = y0 + k * linhaH + 3, h = linhaH - 6;
      x.font = 'bold 11px Helvetica, Arial, sans-serif'; x.fillStyle = COR.ink2; x.textAlign = 'right'; x.fillText(l, L - 2, yy + h / 2);
      if (v == null) return;
      x.fillStyle = COR[l]; x.beginPath(); x.roundRect(L, yy, Math.max(2, X(v) - L), h, 3); x.fill();
      x.fillStyle = COR.ink; x.textAlign = 'left'; x.fillText(`${fmt(v, 1)} ${unidade}`, X(v) + 5, yy + h / 2);
    });
  });
  x.font = '11px Helvetica, Arial, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'middle';
  let lx = L;
  for (const [cor, txt] of [[COR.D, 'Direito'], [COR.E, 'Esquerdo']] as const) { x.fillStyle = cor; x.fillRect(lx, 7, 10, 10); x.fillStyle = COR.ink2; x.fillText(txt, lx + 14, 12); lx += x.measureText(txt).width + 30; }
  if (grupos.some(g => g.ref != null)) { x.fillStyle = 'rgba(34,163,90,0.25)'; x.fillRect(lx, 7, 14, 10); x.fillStyle = COR.ink2; x.fillText('Faixa normal para idade e sexo (linha = média)', lx + 18, 12); }
  return cv.toDataURL('image/png');
}

export function gruposBarras(A: Analise, u: Unidade): GrupoBarras[] {
  const dv = (N?: number | null) => (N == null ? null : N / UF[u]);
  return (['ag', 'an'] as const).flatMap(g => {
    const sD = A.slots[`${g}D` as Slot], sE = A.slots[`${g}E` as Slot];
    if (!sD && !sE) return [];
    const ref = sD?.esperado ?? sE?.esperado ?? null, min = sD?.minimo ?? sE?.minimo ?? null;
    return [{ nome: g === 'ag' ? A.R.ag : A.R.an, D: dv(sD?.pico), E: dv(sE?.pico), ref: dv(ref), min: dv(min) }];
  });
}

// Avatar recortado na região avaliada (esquerda) + barras D × E (direita).
async function blocoVisual(doc: jsPDF, av: Avaliacao, A: Analise, c: Criterios, x0: number, y: number, larg: number): Promise<number> {
  const u = c.unidade;
  const R = A.R;
  const larAv = 84, gap = 6, larDir = larg - larAv - gap, xDir = x0 + larAv + gap;
  const aneis = achadosDor([{ av, A }], c).flatMap(a => a.aneis);
  const itens = itensAvatar([{ av, A }], c, u);
  // Avatar inteiro (frente e costas) — cabe exame com várias articulações.
  const svgCorpo = mapaMuscularSVG(itens, aneis, false);
  const altAv = larAv * proporcaoSVG(svgCorpo);
  const hFoco = 26;
  if (y + Math.max(altAv + hFoco + 14, 70) > 285) { doc.addPage(); y = 18; }
  const yTopo = y;
  doc.setDrawColor(...hexRgb('#D6DEE8')); doc.setLineWidth(0.3);
  doc.roundedRect(x0, y, larAv, altAv + hFoco + 10, 2.2, 2.2, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.4); doc.setTextColor(...hexRgb(AZUL));
  doc.text('MAPA MUSCULAR · FRENTE E COSTAS', x0 + 3, y + 4.4);
  try { doc.addImage(await svgParaPNG(svgCorpo, 900), 'PNG', x0 + 1, y + 5.5, larAv - 2, altAv - 2); } catch { /* sem o avatar, segue com os gráficos */ }
  // Close da articulação com a relação antagonista/agonista de cada lado.
  const yFoco = y + altAv + 6;
  doc.setDrawColor(...hexRgb('#E3E9F0')); doc.line(x0 + 3, yFoco - 1.5, x0 + larAv - 3, yFoco - 1.5);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.4); doc.setTextColor(...hexRgb(AZUL));
  doc.text(seguro(`${R.l.toUpperCase()} EM DESTAQUE · ${R.an.toUpperCase()}/${R.ag.toUpperCase()}`), x0 + 3, yFoco + 2.4);
  const razao: Partial<Record<Lado, { txt: string; st: Status }>> = {};
  for (const l of ['D', 'E'] as Lado[]) {
    const rz = A.razoes[l];
    if (rz) razao[l] = { txt: `${l} ${fmt(rz.r * 100, 0)}%`, st: rz.desvio == null ? ['info', 'Sem referência'] : stDesvio(rz.desvio, c) };
  }
  try {
    const svgFoco = focoArticulacaoSVG(av.regiao, itens, razao);
    const wF = larAv - 4, hF = Math.min(hFoco, wF * proporcaoSVG(svgFoco));
    const wImg = hF / proporcaoSVG(svgFoco);
    doc.addImage(await svgParaPNG(svgFoco, 900), 'PNG', x0 + (larAv - wImg) / 2, yFoco + 3.5, wImg, hF);
  } catch { /* close opcional */ }

  // Direita: comparação unilateral (barras D × E) e razão antagonista/agonista D e E.
  let yd = yTopo;
  const grupos = gruposBarras(A, u);
  if (grupos.length) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.4); doc.setTextColor(...hexRgb(AZUL));
    doc.text('FORÇA DIREITO X ESQUERDO', xDir, yd + 4.4);
    const img = barrasPNG(grupos, u);
    const pr = new Image(); pr.src = img;
    await new Promise(ok => { pr.onload = ok; pr.onerror = ok; });
    const altBar = pr.width ? (larDir * pr.height) / pr.width : larDir * 0.35;
    doc.addImage(img, 'PNG', xDir, yd + 6, larDir, altBar);
    yd += altBar + 10;
  }
  if (A.razoes.D || A.razoes.E) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.4); doc.setTextColor(...hexRgb(AZUL));
    doc.text(seguro(`RELAÇÃO ${R.an.toUpperCase()}/${R.ag.toUpperCase()} (ANTAGONISTA/AGONISTA)`), xDir, yd + 2);
    yd += 7;
    const nomeArt = R.l.split(' (')[0];
    for (const l of ['D', 'E'] as Lado[]) {
      yd = trilhoRazao(doc, `${nomeArt} ${l === 'D' ? 'direito' : 'esquerdo'}`, A.razoes[l], c, R.modo === 'min', R.min ?? null, xDir, yd, larDir);
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(120);
    yd = par2(doc, R.modo === 'min' ? `Verde: a partir do mínimo de referência (${fmt((R.min ?? 0.8) * 100, 0)}%).` : `Faixa verde: referência ±${c.razaoTol}% (linha = média para idade e sexo). Acima de ±${c.razaoLimite}%: desequilíbrio.`, xDir, yd - 1, larDir, 3);
    doc.setTextColor(20);
  }
  doc.setLineWidth(0.2); doc.setTextColor(20);
  return Math.max(yTopo + altAv + hFoco + 10, yd) + 4;
}

// ───────── Peças de layout do relatório técnico ─────────
const hexRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const AZUL = '#1E3A5F';
// Fundo claro + texto escuro de cada status (pílulas e cartões).
const TOM: Record<string, { bg: string; fg: string }> = {
  ok: { bg: '#E3F5EA', fg: '#15803D' }, warn: { bg: '#FFF3D1', fg: '#A16207' },
  bad: { bg: '#FDE5E2', fg: '#C0362C' }, info: { bg: '#EEF2F7', fg: '#5B6B7F' },
};
const tomDe = (st: Status) => TOM[st?.[0] ?? 'info'];

// Pílula colorida com o valor; devolve a largura usada.
function pilula(doc: jsPDF, txt: string, st: Status, x: number, yBase: number, fonte = 7.6, h = 4.6): number {
  const tm = tomDe(st);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(fonte);
  const w = doc.getTextWidth(seguro(txt)) + 3.6;
  doc.setFillColor(...hexRgb(tm.bg)); doc.roundedRect(x, yBase - h + 1.1, w, h, h / 2, h / 2, 'F');
  doc.setTextColor(...hexRgb(tm.fg)); doc.text(seguro(txt), x + 1.8, yBase);
  doc.setTextColor(20); doc.setFont('helvetica', 'normal');
  return w;
}

// Título de seção com barra de destaque.
function secao(doc: jsPDF, titulo: string, sub: string | null, x: number, y: number): number {
  doc.setFillColor(...hexRgb(AZUL)); doc.roundedRect(x, y - 3.6, 1.4, 5, 0.7, 0.7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...hexRgb(AZUL));
  doc.text(seguro(titulo), x + 3.4, y);
  if (sub) { const w = doc.getTextWidth(seguro(titulo)); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(120); doc.text(seguro(sub), x + 5.4 + w, y); }
  doc.setTextColor(20); doc.setFont('helvetica', 'normal');
  return y + 4.5;
}

// Direção da razão em relação à referência (acima/abaixo/dentro do padrão).
export function direcaoRazao(rz: { r: number; ref: number | null; desvio: number | null }, c: Criterios, modoMin: boolean): string {
  if (rz.desvio == null || rz.ref == null) return 'sem referência';
  if (modoMin) return rz.r >= rz.ref ? 'dentro do padrão' : 'abaixo do padrão';
  if (rz.desvio <= c.razaoTol / 100) return 'dentro do padrão';
  const muito = rz.desvio > c.razaoLimite / 100 ? 'muito ' : '';
  return rz.r > rz.ref ? `${muito}acima do padrão` : `${muito}abaixo do padrão`;
}

// Gráfico da razão antagonista/agonista de um lado: trilho 0–máx, faixa de
// referência em verde, marcador e valor na cor do status.
function trilhoRazao(doc: jsPDF, rotulo: string, rz: { r: number; ref: number | null; desvio: number | null } | undefined, c: Criterios, modoMin: boolean, minRef: number | null, x: number, y: number, w: number): number {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.4); doc.setTextColor(40); doc.text(seguro(rotulo), x, y);
  if (!rz) { doc.setFont('helvetica', 'normal'); doc.setTextColor(130); doc.text('sem dados', x + w, y, { align: 'right' }); doc.setTextColor(20); return y + 11; }
  const st: Status = rz.desvio == null ? ['info', 'Sem referência'] : stDesvio(rz.desvio, c);
  const val = rz.r * 100;
  pilula(doc, `${fmt(val, 0)}% · ${direcaoRazao(rz, c, modoMin)}`, st, x + doc.getTextWidth(seguro(rotulo)) + 3, y, 7.2);
  const ty = y + 3.4, th = 3.2;
  const lo = modoMin ? (minRef ?? 0.8) * 100 : rz.ref != null ? rz.ref * (1 - c.razaoTol / 100) * 100 : null;
  const hi = modoMin ? null : rz.ref != null ? rz.ref * (1 + c.razaoTol / 100) * 100 : null;
  const max = Math.max(100, val * 1.15, (hi ?? 0) * 1.3);
  const X = (v: number) => x + (Math.min(v, max) / max) * w;
  doc.setFillColor(...hexRgb('#E8EDF3')); doc.roundedRect(x, ty, w, th, th / 2, th / 2, 'F');
  if (lo != null) {
    doc.setFillColor(...hexRgb('#BFE7CF'));
    const x0 = X(lo), x1 = hi != null ? X(hi) : x + w;
    doc.rect(x0, ty, Math.max(0.6, x1 - x0), th, 'F');
  }
  if (rz.ref != null && !modoMin) { doc.setDrawColor(...hexRgb('#22A35A')); doc.setLineWidth(0.4); doc.line(X(rz.ref * 100), ty - 0.8, X(rz.ref * 100), ty + th + 0.8); }
  const cor = hexRgb(COR_STATUS[st?.[0] ?? 'info']);
  doc.setFillColor(...cor); doc.circle(X(val), ty + th / 2, 1.9, 'F');
  doc.setFillColor(255, 255, 255); doc.circle(X(val), ty + th / 2, 0.8, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.6); doc.setTextColor(130);
  doc.text('0%', x, ty + th + 3.4);
  doc.text(`${fmt(max, 0)}%`, x + w, ty + th + 3.4, { align: 'right' });
  if (lo != null) doc.text(modoMin ? `mín. ${fmt(lo, 0)}%` : `faixa ${fmt(lo, 0)}-${fmt(hi as number, 0)}%`, (X(lo) + (hi != null ? X(hi) : x + w)) / 2, ty + th + 3.4, { align: 'center' });
  doc.setTextColor(20); doc.setLineWidth(0.2);
  return ty + th + 7.5;
}

function par2(doc: jsPDF, txt: string, x: number, y: number, larg: number, alt = 3.7) {
  const ls = doc.splitTextToSize(seguro(txt), larg);
  doc.text(ls, x, y);
  return y + ls.length * alt;
}

const seguro = (s: string) => String(s)
  .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/≈/g, '~').replace(/−/g, '-').replace(/–/g, '-')
  .replace(/·/g, '-').replace(/×/g, 'x').replace(/÷/g, '/');

const nomeArquivo = (paciente: string, sufixo: string, data: string) => `${sufixo}_${paciente.replace(/[^\wÀ-ú]+/g, '_')}_${data}.pdf`;

function corStatus(doc: jsPDF, st: Status) {
  const hex = COR_STATUS[st?.[0] ?? 'info'];
  doc.setTextColor(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
}

function bolinha(doc: jsPDF, st: Status, x: number, y: number, r = 1.5) {
  const hex = COR_STATUS[st?.[0] ?? 'info'];
  doc.setFillColor(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
  doc.circle(x, y, r, 'F');
}

function linhaSujeito(s: Sujeito) {
  return [s.sexo === 'M' ? 'Masculino' : 'Feminino', s.idade != null ? `${s.idade} anos` : '', s.peso ? `${s.peso} kg` : '', s.modalidade || '', `dominante ${s.dominante === 'E' ? 'esquerdo' : 'direito'}`].filter(Boolean).join(', ');
}

export interface ItemRelatorio { av: Avaliacao; A: Analise; anterior?: { data: string; av: Avaliacao } | null; historico: { data: string; lsiAg: number | null; lsiAn: number | null }[] }
export interface DadosRelatorio { paciente: string; profissional?: string; logoUrl?: string; data: string; c: Criterios; itens: ItemRelatorio[] }

// ───────── Relatório técnico (uma página por articulação) ─────────
// apenasGerar: devolve o PDF (Blob) sem baixar — usado na pré-visualização.
export async function gerarRelatorioDinamometria(d: DadosRelatorio, apenasGerar = false): Promise<{ blob: Blob; nome: string } | void> {
  const { c } = d;
  const u = c.unidade;
  const disp = (N?: number | null) => (N == null ? null : N / UF[u]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14;
  const t = (txt: string, xx: number, yy: number, op?: Parameters<jsPDF['text']>[3]) => doc.text(seguro(txt), xx, yy, op);

  for (let n = 0; n < d.itens.length; n++) {
    const { av, A, anterior, historico } = d.itens[n];
    const R = A.R;
    if (n > 0) doc.addPage();
    let y = 14;
    try { await addLogoToDoc(doc, W - M - 16, 8, 16, d.logoUrl); } catch { /* logo é opcional no relatório */ }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(20); t('Avaliação de dinamometria isométrica', M, y + 4);
    y += 11;
    doc.setFontSize(11); t(d.paciente, M, y); doc.setFont('helvetica', 'normal'); y += 5;
    doc.setFontSize(9.5); doc.setTextColor(70);
    t(`${linhaSujeito(av.sujeito)} | ${R.l} | ${dataBR(d.data)}${d.itens.length > 1 ? ` | articulação ${n + 1} de ${d.itens.length}` : ''}`, M, y);
    if (d.profissional) { y += 4.5; t(`Profissional: ${d.profissional}`, M, y); }
    y += 4; doc.setDrawColor(210); doc.line(M, y, W - M, y); y += 11;

    const larg = W - 2 * M;
    const garantir = (h: number) => { if (y + h > 284) { doc.addPage(); y = 18; } };

    // ── 1. Referências teóricas (janela fisiológica) — não são resultados do paciente.
    y = secao(doc, `Referências teóricas · ${R.l}`, 'janela fisiológica baseada em evidências', M, y - 4);
    const razRef = (A.razoes.D || A.razoes.E)?.ref;
    const janelaRazao = R.modo === 'min'
      ? `>= ${fmt((R.min ?? 0.8) * 100, 0)}%`
      : razRef != null ? `${fmt(razRef * (1 - c.razaoTol / 100) * 100, 0)}% a ${fmt(razRef * (1 + c.razaoTol / 100) * 100, 0)}% (média ~${fmt(razRef * 100, 0)}%)` : 'depende de idade e sexo';
    const linhasRef: [string, string, string][] = [
      ['Simetria bilateral', `>= ${c.lsiAdequado}% (diferença até ${100 - c.lsiAdequado}%); atenção ${c.lsiImportante}-${c.lsiAdequado}%`, citarCurto(['grindem', 'kyritsis', 'parkinson'])],
      [`Agonista x antagonista (${R.razaoL.split(' (')[0]})`, janelaRazao, citarCurto(R.modo === 'min' ? ['tyler', 'whittaker'] : R.mAg === 'kn_ext' ? ['mckay', 'ishoi', 'taketomi'] : ['mckay', 'cools'])],
      ...gruposBarras(A, u).filter(g => g.ref != null && g.min != null).map(g => [
        `Força - ${g.nome}`, `${fmt(g.min, 1)} a ${fmt(2 * (g.ref as number) - (g.min as number), 1)} ${u} (média ${fmt(g.ref, 1)})`, citarCurto(['mckay', 'machado']),
      ] as [string, string, string]),
      ['Índice de fadiga', `<= ${c.fadBaixa}%; atenção ${c.fadBaixa}-${c.fadAlta}%`, 'Critério do serviço (sem norma publicada)'],
      ['Curva de contração', `subida rápida e contínua; platô estável (oscilação <= ${c.oscEstavel}%)`, `${citarCurto(['maffiuletti'])}; oscilação: critério do serviço`],
    ];
    {
      const wC = [46, 70, larg - 116 - 4];
      const xC = [M + 3, M + 3 + wC[0], M + 3 + wC[0] + wC[1]];
      const linhasMed = linhasRef.map(([a, b, cc]) => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.3); const la = doc.splitTextToSize(seguro(a), wC[0] - 3);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.3); const lb = doc.splitTextToSize(seguro(b), wC[1] - 3);
        doc.setFontSize(7.2); const lc = doc.splitTextToSize(seguro(cc), wC[2]);
        return { la, lb, lc, h: Math.max(la.length, lb.length, lc.length) * 3.55 + 3.2 };
      });
      const hTab = 7 + linhasMed.reduce((s2, l) => s2 + l.h, 0);
      garantir(hTab + 4);
      doc.setDrawColor(...hexRgb('#D6DEE8')); doc.setLineWidth(0.3);
      doc.setFillColor(...hexRgb('#F4F7FB')); doc.roundedRect(M, y, larg, hTab, 2.2, 2.2, 'FD');
      doc.setFillColor(...hexRgb('#E6EDF5')); doc.roundedRect(M, y, larg, 7, 2.2, 2.2, 'F'); doc.rect(M, y + 4, larg, 3, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.4); doc.setTextColor(...hexRgb(AZUL));
      ['PARÂMETRO', 'JANELA FISIOLÓGICA', 'BASE CIENTÍFICA'].forEach((h, k) => doc.text(h, xC[k], y + 4.7));
      let yy = y + 7;
      linhasMed.forEach((l, k) => {
        if (k % 2 === 1) { doc.setFillColor(255, 255, 255); doc.rect(M + 0.3, yy, larg - 0.6, l.h, 'F'); }
        if (k > 0) { doc.setDrawColor(...hexRgb('#E3E9F0')); doc.line(M + 2, yy, M + larg - 2, yy); }
        const yt = yy + 4.4;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.3); doc.setTextColor(30); doc.text(l.la, xC[0], yt);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.3); doc.setTextColor(45); doc.text(l.lb, xC[1], yt);
        doc.setFont('helvetica', 'italic'); doc.setFontSize(7.2); doc.setTextColor(115); doc.text(l.lc, xC[2], yt);
        yy += l.h;
      });
      doc.setFont('helvetica', 'normal'); doc.setTextColor(20); doc.setLineWidth(0.2);
      y += hTab + 3;
    }
    // Curva de referência normalizada (% da força máxima), ilustrativa.
    const ct: [number, number][] = [];
    for (let s0 = 0; s0 <= 7; s0 += 0.02) {
      const sub = s0 < 0.5 ? 0 : 1 - Math.exp(-(s0 - 0.5) / 0.18);
      const queda = s0 < 1.5 ? 0 : Math.min(1, (s0 - 1.5) / 4.5) * 0.08;
      const fim = s0 > 6 ? Math.max(0, 1 - (s0 - 6) / 0.6) : 1;
      ct.push([s0, 100 * sub * (1 - queda) * fim * (1 + (s0 > 1 && s0 < 6 ? 0.012 * Math.sin(s0 * 9) : 0))]);
    }
    garantir(32);
    const imgRef = graficoPNG([{ nome: 'ref', cor: '#22A35A', pts: ct }], { xFmt: v => `${fmt(v, 0)} s`, yFmt: v => `${fmt(v, 0)}%`, yMin100: true, W: 520, H: 200 });
    doc.addImage(imgRef, 'PNG', M, y, 66, 25.4);
    doc.setFontSize(8); doc.setTextColor(70);
    par2(doc, `Curva de contração de referência (ilustrativa, % da força máxima): subida rápida até o pico, com a taxa de desenvolvimento de força medida em 0-100 e 0-200 ms (${citarCurto(['maffiuletti'])}); platô estável, com oscilação até ${c.oscEstavel}%; e queda da força até ${c.fadBaixa}% no fim da contração sustentada.`, M + 70, y + 5, larg - 70);
    doc.setFontSize(7); doc.setTextColor(130); t('Referências teóricas baseadas em evidências, não resultados do paciente.', M + 70, y + 23);
    doc.setTextColor(20);
    y += 31;

    // ── 2. Resultados do paciente: todos os achados com a marcação de cada um.
    garantir(50);
    y = secao(doc, `Resultados do paciente · ${R.l}`, null, M, y);
    {
      const cab = ['Músculo', `Pico (${u})`, 'Simetria', `${R.an}/${R.ag}`, 'N/kg', 'Norma (z)', 'RFD 200ms', 'Fadiga', 'Queda platô', 'Oscilação'];
      const wC = [27, 14, 22, 30, 11, 16, 17, 15, 15, 15];
      const xC: number[] = []; wC.reduce((acc, w0) => { xC.push(acc); return acc + w0; }, M);
      const hL = 7.4;
      const nLinhas = SLOTS_POR_LADO.filter(k => A.slots[k]).length;
      const hTab = 7 + nLinhas * hL + 1;
      doc.setDrawColor(...hexRgb('#D6DEE8')); doc.setLineWidth(0.3);
      doc.roundedRect(M, y, larg, hTab, 2.2, 2.2, 'S');
      doc.setFillColor(...hexRgb('#E6EDF5')); doc.roundedRect(M, y, larg, 7, 2.2, 2.2, 'F'); doc.rect(M, y + 4, larg, 3, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.9); doc.setTextColor(...hexRgb(AZUL));
      cab.forEach((h, k) => doc.text(seguro(h), xC[k] + 1.5, y + 4.6));
      let yy = y + 7;
      for (const lado of ['D', 'E'] as Lado[]) {
        const doLado = SLOTS_POR_LADO.filter(k => k.endsWith(lado) && A.slots[k]);
        if (!doLado.length) continue;
        const y0 = yy;
        if (lado === 'E' && yy > y + 7) { doc.setDrawColor(...hexRgb('#B9C6D6')); doc.setLineWidth(0.45); doc.line(M + 1, yy, M + larg - 1, yy); doc.setLineWidth(0.3); }
        for (const k of doLado) {
          const m = A.slots[k]!;
          const yb = yy + 4.9;
          if (k !== doLado[0]) { doc.setDrawColor(...hexRgb('#E8EDF3')); doc.line(M + 1, yy, xC[3], yy); doc.line(xC[4], yy, M + larg - 1, yy); }
          doc.setFillColor(...hexRgb(COR[lado])); doc.circle(xC[0] + 2.4, yb - 1.1, 1, 'F');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(30); doc.text(seguro(nomeSlot(av.regiao, k)), xC[0] + 4.4, yb);
          doc.text(fmt(disp(m.pico), 1), xC[1] + 1.5, yb);
          doc.setFont('helvetica', 'normal');
          const sim = simetriaSlot(A, k, c);
          if (!sim) doc.text('-', xC[2] + 1.5, yb);
          else if (sim.v >= 99.5) pilula(doc, '100% forte', ['info', ''], xC[2] + 1.2, yb, 7);
          else pilula(doc, `${fmt(sim.v, 0)}%`, sim.st, xC[2] + 1.2, yb, 7.4);
          doc.setFontSize(8); doc.setTextColor(40);
          doc.text(m.nkg == null ? '-' : fmt(m.nkg, 1), xC[4] + 1.5, yb);
          if (m.z == null) doc.text('-', xC[5] + 1.5, yb); else pilula(doc, fmt(m.z, 1), stZ(m.z), xC[5] + 1.2, yb, 7.2);
          doc.setFontSize(8); doc.setTextColor(40);
          doc.text(m.rfd200 == null ? '-' : fmt(disp(m.rfd200), 0), xC[6] + 1.5, yb);
          if (m.fadiga == null) doc.text('-', xC[7] + 1.5, yb); else pilula(doc, `${fmt(m.fadiga, 0)}%`, stFadiga(m.fadiga, c), xC[7] + 1.2, yb, 7.2);
          const q = falhaPlato(av.slots[k]?.curva)?.queda;
          doc.setFontSize(8); doc.setTextColor(40); doc.text(q == null ? '-' : `${fmt(q, 1)}%/s`, xC[8] + 1.5, yb);
          if (m.oscilacao == null) doc.text('-', xC[9] + 1.5, yb); else pilula(doc, `${fmt(m.oscilacao, 1)}%`, stOsc(m.oscilacao, c), xC[9] + 1.2, yb, 7.2);
          yy += hL;
        }
        // Razão do lado: uma célula que ocupa as linhas daquele lado.
        const rz = A.razoes[lado];
        const ym = (y0 + yy) / 2;
        doc.setDrawColor(...hexRgb('#D6DEE8')); doc.line(xC[3], y0 + 1, xC[3], yy - 1); doc.line(xC[4], y0 + 1, xC[4], yy - 1);
        if (rz) {
          const st: Status = rz.desvio == null ? ['info', 'Sem referência'] : stDesvio(rz.desvio, c);
          pilula(doc, `${lado} ${fmt(rz.r * 100, 0)}%`, st, xC[3] + 1.5, ym - 0.6, 7.8, 5);
          doc.setFontSize(6.4); doc.setTextColor(...hexRgb(tomDe(st).fg)); doc.text(seguro(direcaoRazao(rz, c, R.modo === 'min')), xC[3] + 1.5, ym + 3.4);
          doc.setTextColor(20);
        } else { doc.setFontSize(8); doc.text('-', xC[3] + 1.5, ym + 1); }
      }
      doc.setLineWidth(0.2);
      y += hTab + 3.2;
      doc.setFontSize(6.8); doc.setTextColor(120);
      y = par2(doc, `RFD em ${u}/s. Simetria: lado mais forte de cada músculo = 100%. ${R.an}/${R.ag}: razão do mesmo lado (referência ${A.razoes.D?.refTxt || A.razoes.E?.refTxt || '-'}). Cores: verde adequado, amarelo atenção, vermelho alterado.`, M, y, larg, 3);
      doc.setTextColor(20); y += 2;
    }

    // Simetria e equilíbrio: cartões com valor, cor e o que significa.
    {
      const cards: { titulo: string; valor: string; st: Status; sub: string }[] = [];
      for (const [nome, L] of [[R.ag, A.lsiAg], [R.an, A.lsiAn]] as const) {
        if (!L) continue;
        const st = stLSI(L.v, c);
        cards.push({ titulo: `Simetria · ${nome}`, valor: `${fmt(L.v, 0)}%`, st, sub: `${st?.[1] ?? ''} · lado ${L.fraco === 'D' ? 'direito' : 'esquerdo'} em % do ${L.forte === 'D' ? 'direito' : 'esquerdo'}` });
      }
      for (const l of ['D', 'E'] as Lado[]) {
        const rz = A.razoes[l];
        if (!rz) continue;
        const st: Status = rz.desvio == null ? ['info', 'Sem referência'] : stDesvio(rz.desvio, c);
        cards.push({ titulo: `${R.an}/${R.ag} · ${l === 'D' ? 'direito' : 'esquerdo'}`, valor: `${fmt(rz.r * 100, 0)}%`, st, sub: `${st?.[1] ?? ''} · ${direcaoRazao(rz, c, R.modo === 'min')} (ref. ${rz.refTxt || '-'})` });
      }
      if (cards.length) {
        garantir(8 + Math.ceil(cards.length / 2) * 17);
        y = secao(doc, 'Simetria e equilíbrio', null, M, y + 1);
        const wc = (larg - 4) / 2, hc = 14.5;
        cards.forEach((cd, k) => {
          const cx = M + (k % 2) * (wc + 4), cy = y + Math.floor(k / 2) * (hc + 2.5);
          const tm = tomDe(cd.st);
          doc.setFillColor(...hexRgb(tm.bg)); doc.roundedRect(cx, cy, wc, hc, 2, 2, 'F');
          doc.setFillColor(...hexRgb(COR_STATUS[cd.st?.[0] ?? 'info'])); doc.roundedRect(cx, cy, 1.6, hc, 0.8, 0.8, 'F');
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(90); doc.text(seguro(cd.titulo.toUpperCase()), cx + 4.5, cy + 4.6);
          doc.setFontSize(14); doc.setTextColor(...hexRgb(tm.fg)); doc.text(cd.valor, cx + 4.5, cy + 11.4);
          const wv = doc.getTextWidth(cd.valor);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(60);
          doc.text(doc.splitTextToSize(seguro(cd.sub), wc - wv - 11), cx + 7.5 + wv, cy + 8.6);
        });
        doc.setTextColor(20);
        y += Math.ceil(cards.length / 2) * (hc + 2.5) + 2;
      }
    }

    // ── 3 e 4. Avatar inteiro + articulação em destaque | gráficos unilateral e agonista × antagonista.
    y = await blocoVisual(doc, av, A, c, M, y + 2, larg);

    const serie = (g: 'ag' | 'an'): Serie[] => (['D', 'E'] as Lado[]).flatMap(l => {
      const cv = av.slots[`${g}${l}` as Slot]?.curva;
      return cv ? [{ nome: l, cor: COR[l], pts: cv.t.map((tt, i) => [tt, cv.f[i] / UF[u]] as [number, number]) }] : [];
    });
    const sAg = serie('ag'), sAn = serie('an');
    if (sAg.length || sAn.length) {
      const opC = { xFmt: (v: number) => `${fmt(v, 0)} s`, yFmt: (v: number) => fmt(v, 0) };
      const meia = (W - 2 * M) / 2 - 2, h = (meia * 260) / 760;
      y += 3;
      if (sAg.length) doc.addImage(graficoPNG(sAg, opC), 'PNG', M, y, meia, h);
      if (sAn.length) doc.addImage(graficoPNG(sAn, opC), 'PNG', M + meia + 4, y, meia, h);
      doc.setFontSize(8); doc.setTextColor(90);
      if (sAg.length) t(`Curva ${R.ag} (${u}): azul = direito, laranja = esquerdo`, M, y + h + 4);
      if (sAn.length) t(`Curva ${R.an} (${u})`, M + meia + 4, y + h + 4);
      doc.setTextColor(20); y += h + 11;
      // Curva de falha do platô: % do pico, do pico até o fim do platô.
      const falha = (g: 'ag' | 'an'): Serie[] => (['D', 'E'] as Lado[]).flatMap(l => {
        const fp = falhaPlato(av.slots[`${g}${l}` as Slot]?.curva);
        return fp && fp.pts.length > 3 ? [{ nome: l, cor: COR[l], pts: fp.pts }] : [];
      });
      const fAg = falha('ag'), fAn = falha('an');
      if (fAg.length || fAn.length) {
        if (y + h + 12 > 284) { doc.addPage(); y = 18; }
        const opF = { xFmt: (v: number) => `${fmt(v, 0)} s`, yFmt: (v: number) => `${fmt(v, 0)}%`, yMin100: true };
        if (fAg.length) doc.addImage(graficoPNG(fAg, opF), 'PNG', M, y, meia, h);
        if (fAn.length) doc.addImage(graficoPNG(fAn, opF), 'PNG', M + meia + 4, y, meia, h);
        doc.setFontSize(8); doc.setTextColor(90);
        const qd = (g: 'ag' | 'an', l: Lado) => { const q = falhaPlato(av.slots[`${g}${l}` as Slot]?.curva)?.queda; return q == null ? '-' : `${fmt(q, 1)}%/s`; };
        if (fAg.length) t(`Falha do platô ${R.ag} (% do pico): queda D ${qd('ag', 'D')}, E ${qd('ag', 'E')}`, M, y + h + 4);
        if (fAn.length) t(`Falha do platô ${R.an}: queda D ${qd('an', 'D')}, E ${qd('an', 'E')}`, M + meia + 4, y + h + 4);
        doc.setTextColor(20); y += h + 11;
      }
    } else y += 4;

    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); t('Interpretação', M, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.4); y += 5.5;
    for (const p of interpretar(av, A, c, anterior)) {
      const ls = doc.splitTextToSize(seguro(p), W - 2 * M);
      if (y + ls.length * 4.5 > 284) { doc.addPage(); y = 18; }
      doc.text(ls, M, y); y += ls.length * 4.5 + 1.5;
    }
    const dores = achadosDor([{ av, A }], c);
    if (dores.length) {
      if (y > 260) { doc.addPage(); y = 18; }
      y += 2; doc.setFontSize(10); doc.setFont('helvetica', 'bold'); t('Relação com dores', M, y); y += 5.5;
      for (const a of dores) {
        const ls = doc.splitTextToSize(seguro(a.texto), W - 2 * M - 5);
        if (y + 5 + ls.length * 4.4 > 284) { doc.addPage(); y = 18; }
        bolinha(doc, a.st, M + 1.4, y - 1.2);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.2); t(a.titulo, M + 5, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(ls, M + 5, y + 4.4); y += 4.4 + ls.length * 4.4;
        if (a.refs.length) { doc.setFontSize(7.6); doc.setTextColor(110); t(`Ref.: ${citar(a.refs)}`, M + 5, y + 0.6); doc.setTextColor(20); y += 3.4; }
        y += 1.5;
      }
    }
    const evo: Serie[] = ([['lsiAg', COR.D], ['lsiAn', COR.E]] as const).flatMap(([k, cor]) => {
      const pts = historico.flatMap((x, i) => (x[k] == null ? [] : [[i, x[k] as number] as [number, number]]));
      return pts.length ? [{ nome: k, cor, pts }] : [];
    });
    if (historico.length > 1 && evo.length) {
      const h = ((W - 2 * M) * 220) / 760;
      if (y + h + 14 > 284) { doc.addPage(); y = 18; }
      y += 3; doc.setFont('helvetica', 'bold'); doc.setFontSize(10); t(`Evolução da simetria · ${R.l}`, M, y); doc.setFont('helvetica', 'normal'); y += 3;
      const img = graficoPNG(evo, { xFmt: String, yFmt: v => `${fmt(v, 0)}%`, xTicks: historico.map((x, i) => [i, dataBR(x.data).slice(0, 5)]), pontos: true, yMin100: true, H: 220 });
      doc.addImage(img, 'PNG', M, y, W - 2 * M, h); y += h + 3;
      doc.setFontSize(8); doc.setTextColor(90); t(`Azul = ${R.ag}, laranja = ${R.an}. Critério de simetria: ${c.lsiAdequado}%.`, M, y + 1); doc.setTextColor(20); y += 5;
    }
    doc.setFontSize(7.4); doc.setTextColor(110);
    const rod = doc.splitTextToSize(seguro(`Faixas das valências (ajustáveis): simetria adequada >= ${c.lsiAdequado}%, déficit importante < ${c.lsiImportante}%; razão até ${c.razaoTol}% de desvio adequada, acima de ${c.razaoLimite}% desequilíbrio; fadiga baixa <= ${c.fadBaixa}%, alta > ${c.fadAlta}%; oscilação estável <= ${c.oscEstavel}%, instável > ${c.oscInstavel}%. Normas: McKay et al. 2017 (faixa normal = média ± 1 DP); simetria >= 90%: Grindem et al. 2016; adução/abdução >= 0,80: Tyler et al. 2001; fadiga e oscilação: faixas do serviço. Referências completas na última página.`), W - 2 * M);
    if (y > 270) { doc.addPage(); y = 18; }
    doc.text(rod, M, Math.max(y + 4, 286 - rod.length * 3.3));
  }
  doc.addPage();
  let yr = 18;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(20); t('Referências (conferidas no PubMed)', M, yr); yr += 7;
  REFERENCIAS.forEach((x, i) => {
    const ls = doc.splitTextToSize(seguro(`${i + 1}. ${x.completa} PMID ${x.pmid}${x.doi ? `. doi:${x.doi}` : ''}`), W - 2 * M);
    const uso = doc.splitTextToSize(seguro(x.uso), W - 2 * M - 4);
    if (yr + (ls.length + uso.length) * 3.8 > 285) { doc.addPage(); yr = 18; }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.4); doc.setTextColor(20); doc.text(ls, M, yr); yr += ls.length * 3.7;
    doc.setFontSize(7.8); doc.setTextColor(100); doc.text(uso, M + 4, yr); yr += uso.length * 3.5 + 2;
  });
  const nomeT = nomeArquivo(d.paciente, 'Dinamometria', d.data);
  if (apenasGerar) return { blob: doc.output('blob'), nome: nomeT };
  doc.save(nomeT);
}

function fraseSimetria(v: number, c: Criterios) {
  if (v >= c.lsiAdequado) return 'os dois lados estão equilibrados';
  if (v >= c.lsiImportante) return 'há uma diferença moderada entre os lados';
  return 'há uma diferença importante entre os lados';
}
function fraseNorma(z: number) {
  if (z >= -1) return 'dentro do esperado para sua idade e sexo';
  if (z >= -2) return 'um pouco abaixo da média para sua idade e sexo';
  return 'bem abaixo do esperado para sua idade e sexo';
}

// ───────── Relatório para o cliente (linguagem simples + mapa muscular) ─────────
export async function gerarRelatorioCliente(d: DadosRelatorio, apenasGerar = false): Promise<{ blob: Blob; nome: string } | void> {
  const { c } = d;
  const u = c.unidade;
  const disp = (N?: number | null) => (N == null ? null : N / UF[u]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 16;
  const t = (txt: string, xx: number, yy: number, op?: Parameters<jsPDF['text']>[3]) => doc.text(seguro(txt), xx, yy, op);
  const par = (txt: string, x: number, yy: number, larg: number, alt = 4.7) => { const ls = doc.splitTextToSize(seguro(txt), larg); doc.text(ls, x, yy); return yy + ls.length * alt; };
  let y = 16;
  try { await addLogoToDoc(doc, W - M - 16, 9, 16, d.logoUrl); } catch { /* logo é opcional no relatório */ }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(20); t('Sua avaliação de força', M, y + 3);
  y += 10; doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(70);
  t(`${d.paciente} · ${dataBR(d.data)}`, M, y);
  if (d.itens[0]) { y += 5; t(linhaSujeito(d.itens[0].av.sujeito), M, y); }
  if (d.profissional) { y += 5; t(`Avaliador: ${d.profissional}`, M, y); }
  y += 2; doc.setDrawColor(210); doc.line(M, y, W - M, y);
  y += 9;

  doc.setTextColor(20);
  const celula = (txt: string, st: Status, x: number, yy: number) => {
    if (!st || st[0] === 'info') { t(txt, x, yy); return; }
    bolinha(doc, st, x + 1.3, yy - 1.1, 1.3);
    doc.setFont('helvetica', 'bold'); corStatus(doc, st); t(txt, x + 3.8, yy);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(20);
  };

  doc.setFontSize(8.8); doc.setTextColor(80);
  let lx = M;
  for (const [k, l] of [['ok', 'Bom'], ['warn', 'Atenção'], ['bad', 'Ruim']] as [string, string][]) {
    bolinha(doc, [k as 'ok', ''], lx + 1.5, y - 1.1, 1.6); t(l, lx + 4.5, y); lx += doc.getTextWidth(l) + 10;
  }
  doc.setDrawColor(120); doc.setLineDashPattern([0.8, 0.6], 0); doc.circle(lx + 2, y - 1.1, 1.8); doc.setLineDashPattern([], 0); t('Possível ponto de dor', lx + 5.5, y);
  y += 4.5;
  y = par(`D = direito, E = esquerdo. Diferença entre os lados: até ${100 - c.lsiAdequado}% bom, até ${100 - c.lsiImportante}% atenção, acima disso ruim. A cor de cada músculo no desenho junta a força para a idade e o sexo, a diferença entre os lados e o equilíbrio entre músculos opostos.`, M, y, W - 2 * M, 3.9);
  doc.setTextColor(20); y += 4;

  const cx = [M, 66, 94, 122, 156];
  for (const { av, A } of d.itens) {
    const R = A.R;
    if (y > 200) { doc.addPage(); y = 18; }
    doc.setFillColor(243, 245, 247); doc.rect(M, y - 4.6, W - 2 * M, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); t(R.l, M + 2, y); y += 5;
    y = await blocoVisual(doc, av, A, c, M, y, W - 2 * M);
    doc.setFontSize(8.4); doc.setTextColor(90); doc.setFont('helvetica', 'bold');
    ['Movimento', 'Direito', 'Esquerdo', 'Referência', 'Direito x esquerdo'].forEach((h, k) => t(h, cx[k], y));
    doc.setTextColor(20); y += 1.6; doc.setDrawColor(215); doc.line(M, y, W - M, y); y += 4.6;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    for (const g of ['ag', 'an'] as const) {
      const sD = A.slots[`${g}D` as Slot], sE = A.slots[`${g}E` as Slot];
      if (!sD && !sE) continue;
      t(`Força - ${g === 'ag' ? R.ag : R.an}`, cx[0], y);
      ([[sD, 1], [sE, 2]] as const).forEach(([sl, k]) => { if (sl) celula(`${fmt(disp(sl.pico), 1)} ${u}`, stZ(sl.z), cx[k], y); else t('-', cx[k], y); });
      const ref = sD?.esperado ?? sE?.esperado, min = sD?.minimo ?? sE?.minimo;
      t(ref != null && min != null ? `~${fmt(disp(ref), 1)} (mín. ${fmt(disp(min), 1)})` : '-', cx[3], y);
      const L = g === 'ag' ? A.lsiAg : A.lsiAn;
      if (L) { const st = stLSI(L.v, c); celula(st?.[0] === 'ok' ? 'Equilibrado' : `${L.fraco} ${fmt(100 - L.v, 0)}% mais fraco`, st, cx[4], y); }
      else t('-', cx[4], y);
      y += 5.2;
    }
    if (A.razoes.D || A.razoes.E) {
      t(R.razaoL.split(' (')[0], cx[0], y);
      (['D', 'E'] as const).forEach((l, k) => { const x = A.razoes[l]; if (x) celula(`${fmt(x.r * 100, 0)}%`, x.desvio == null ? null : stDesvio(x.desvio, c), cx[k + 1], y); else t('-', cx[k + 1], y); });
      t((A.razoes.D || A.razoes.E)?.refTxt || '-', cx[3], y);
      doc.setFontSize(7.8); doc.setTextColor(100); t('agonista x antagonista', cx[4], y); doc.setTextColor(20); doc.setFontSize(9);
      y += 5.2;
    }
    for (const g of ['ag', 'an'] as const) {
      const fd = A.slots[`${g}D` as Slot]?.fadiga, fe = A.slots[`${g}E` as Slot]?.fadiga;
      if (fd == null && fe == null) continue;
      t(`Fadiga - ${g === 'ag' ? R.ag : R.an}`, cx[0], y);
      [fd, fe].forEach((f, k) => { if (f == null) t('-', cx[k + 1], y); else celula(`${fmt(f, 0)}%`, stFadiga(f, c), cx[k + 1], y); });
      t(`até ${c.fadBaixa}%`, cx[3], y);
      y += 5.2;
    }
    const kgs = (['D', 'E'] as Lado[]).flatMap(l => (['ag', 'an'] as const).map(g => A.slots[`${g}${l}` as Slot]?.nkg)).some(v => v != null);
    if (!kgs && !A.slots.agD?.esperado && !A.slots.agE?.esperado) { doc.setFontSize(7.8); doc.setTextColor(110); t('Referência de força indisponível: informe idade e sexo (e o braço de alavanca no joelho).', M, y); doc.setTextColor(20); y += 4; }
    y += 5;
  }

  const dores = achadosDor(d.itens, c);
  if (y > 250) { doc.addPage(); y = 18; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); t('Relação com dores', M, y); y += 5.5;
  if (!dores.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9.6); y = par('Não apareceram desequilíbrios que sugiram sobrecarga nas articulações avaliadas.', M, y, W - 2 * M); }
  for (const a of dores) {
    const ls = doc.splitTextToSize(seguro(a.texto), W - 2 * M - 6);
    if (y + 6 + ls.length * 4.4 > 282) { doc.addPage(); y = 18; }
    bolinha(doc, a.st, M + 1.6, y - 1.2, 1.7);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.6); t(a.titulo.replace(' esquerdo', ' E').replace(' direito', ' D'), M + 6, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.2); doc.text(ls, M + 6, y + 4.4); y += 4.4 + ls.length * 4.4;
    if (a.refs.length) { doc.setFontSize(7.4); doc.setTextColor(110); t(`Ref.: ${citar(a.refs)}`, M + 6, y + 0.4); doc.setTextColor(20); y += 3.2; }
    y += 2.2;
  }
  doc.setFontSize(7.8); doc.setTextColor(110); y = par(AVISO_DOR, M, y + 1, W - 2 * M, 3.5); doc.setTextColor(20); y += 5;

  if (y > 255) { doc.addPage(); y = 18; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); t('Os músculos avaliados', M, y); y += 7;
  const pk = (av: Avaliacao, k: Slot) => av.slots[k]?.metricas.pico ?? null;
  for (const { av, A } of d.itens) {
    for (const g of ['ag', 'an'] as const) {
      const info = MUSCULOS[av.regiao]?.[g];
      const d1 = pk(av, `${g}D` as Slot), e1 = pk(av, `${g}E` as Slot);
      if (!info || (d1 == null && e1 == null)) continue;
      const frases: string[] = [];
      frases.push(`Fica na ${info.local} e ${info.funcao}.`);
      frases.push(`Força medida: direito ${fmt(disp(d1), 1)} ${u}, esquerdo ${fmt(disp(e1), 1)} ${u}.`);
      const L = g === 'ag' ? A.lsiAg : A.lsiAn;
      if (L) frases.push(`O lado ${L.fraco === 'D' ? 'direito' : 'esquerdo'} tem ${fmt(L.v, 0)}% da força do outro: ${fraseSimetria(L.v, c)}.`);
      const zs = (['D', 'E'] as Lado[]).map(l => A.slots[`${g}${l}` as Slot]?.z).filter((z): z is number => z != null);
      if (zs.length) frases.push(`A força está ${fraseNorma(Math.min(...zs))}.`);
      const texto = frases.join(' ');
      const ls = doc.splitTextToSize(seguro(texto), W - 2 * M - 6);
      if (y + 8 + ls.length * 4.6 > 282) { doc.addPage(); y = 18; }
      doc.setFillColor(31, 41, 55); doc.circle(M + 2, y - 1.3, 1.4, 'F');
      doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); t(info.nome, M + 6, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.6);
      doc.text(ls, M + 6, y + 4.8);
      y += 4.8 + ls.length * 4.4 + 3;
    }
  }

  if (y > 262) { doc.addPage(); y = 18; }
  y += 2; doc.setFont('helvetica', 'bold'); doc.setFontSize(11); t('O que isso significa para você', M, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.8); y += 6;
  if (dores.length) y = par('Os pontos em amarelo e vermelho mostram onde trabalhar. Seu fisioterapeuta vai usar estes números para direcionar os exercícios e comparar na próxima avaliação.', M, y, W - 2 * M);
  else y = par('Seus resultados estão equilibrados. Manter os exercícios ajuda a preservar a força e prevenir lesões; a próxima avaliação vai mostrar a evolução.', M, y, W - 2 * M);
  y += 3; doc.setFontSize(8); doc.setTextColor(110);
  par(`Este relatório resume uma avaliação de força feita com dinamômetro e não substitui a consulta com o profissional que acompanha você. Valores normais: ${citar(['mckay', 'machado'])}.`, M, Math.max(y, 276), W - 2 * M, 3.6);
  const nomeC = nomeArquivo(d.paciente, 'Avaliacao_de_forca', d.data);
  if (apenasGerar) return { blob: doc.output('blob'), nome: nomeC };
  doc.save(nomeC);
}

