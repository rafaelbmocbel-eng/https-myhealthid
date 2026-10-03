import jsPDF from 'jspdf';
import { addLogoToDoc } from '@/utils/pdfLogoHelper';
import {
  type Analise, type Avaliacao, type Criterios, type Lado, type Slot, type Sujeito, type Unidade,
  SLOTS, UF, fmt, nomeSlot, dataBR, stLSI, stDesvio, stFadiga, stZ, interpretar, type Status,
} from './analise';
import { MUSCULOS, COR_STATUS, mapaMuscularSVG, svgParaPNG, proporcaoSVG, itensAvatar } from './anatomia';
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
  const larAv = Math.min(80, larg * 0.46), larBar = larg - larAv - 4;
  let altAv = 0, altBar = 0;
  try {
    const svg = mapaMuscularSVG(itensAvatar([{ av, A }], c, u), achadosDor([{ av, A }], c).flatMap(a => a.aneis), true);
    altAv = larAv * proporcaoSVG(svg);
    if (y + altAv > 285) { doc.addPage(); y = 18; }
    doc.addImage(await svgParaPNG(svg, 760), 'PNG', x0, y, larAv, altAv);
  } catch { /* sem o avatar, segue com o gráfico */ }
  const grupos = gruposBarras(A, u);
  if (grupos.length) {
    const img = barrasPNG(grupos, u);
    const pr = new Image();
    pr.src = img;
    await new Promise(ok => { pr.onload = ok; pr.onerror = ok; });
    altBar = pr.width ? (larBar * pr.height) / pr.width : larBar * 0.35;
    doc.addImage(img, 'PNG', x0 + larAv + 4, y + Math.max(0, (altAv - altBar) / 2), larBar, altBar);
  }
  return y + Math.max(altAv, altBar) + 3;
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
export async function gerarRelatorioDinamometria(d: DadosRelatorio) {
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

    // Referências teóricas (janela fisiológica) — não são resultados do paciente.
    doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    t(`REFERÊNCIAS TEÓRICAS · ${R.l.toUpperCase()} (janela fisiológica baseada em evidências)`, M, y - 5);
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
    const cxR = [M, M + 46, M + 112];
    doc.setFontSize(7.6); doc.setTextColor(100); doc.setFont('helvetica', 'bold');
    ['Parâmetro', 'Janela fisiológica', 'Base científica'].forEach((h, k) => t(h, cxR[k], y));
    let yr = y + 4.4;
    for (const [nome, jan, base] of linhasRef) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.6); doc.setTextColor(20);
      const ln = doc.splitTextToSize(seguro(nome), 44); doc.text(ln, cxR[0], yr);
      doc.setFont('helvetica', 'normal');
      const lj = doc.splitTextToSize(seguro(jan), 64); doc.text(lj, cxR[1], yr);
      doc.setFontSize(7.6); doc.setTextColor(100);
      const lb = doc.splitTextToSize(seguro(base), W - M - cxR[2]); doc.text(lb, cxR[2], yr);
      yr += Math.max(ln.length, lj.length, lb.length) * 3.7 + 1.4;
    }
    // Curva de referência normalizada (% da força máxima), ilustrativa.
    const ct: [number, number][] = [];
    for (let s0 = 0; s0 <= 7; s0 += 0.02) {
      const sub = s0 < 0.5 ? 0 : 1 - Math.exp(-(s0 - 0.5) / 0.18);
      const queda = s0 < 1.5 ? 0 : Math.min(1, (s0 - 1.5) / 4.5) * 0.08;
      const fim = s0 > 6 ? Math.max(0, 1 - (s0 - 6) / 0.6) : 1;
      ct.push([s0, 100 * sub * (1 - queda) * fim * (1 + (s0 > 1 && s0 < 6 ? 0.012 * Math.sin(s0 * 9) : 0))]);
    }
    const imgRef = graficoPNG([{ nome: 'ref', cor: '#22A35A', pts: ct }], { xFmt: v => `${fmt(v, 0)} s`, yFmt: v => `${fmt(v, 0)}%`, yMin100: true, W: 520, H: 200 });
    yr += 1;
    doc.addImage(imgRef, 'PNG', M, yr, 70, 26.9);
    doc.setFontSize(8.2); doc.setTextColor(60);
    par2(doc, `Curva de contração de referência (ilustrativa, % da força máxima): subida rápida até o pico, com a taxa de desenvolvimento de força medida em 0-100 e 0-200 ms (${citarCurto(['maffiuletti'])}); platô estável, com oscilação até ${c.oscEstavel}%; e queda da força até ${c.fadBaixa}% no fim da contração sustentada.`, M + 74, yr + 4, W - 2 * M - 74);
    doc.setTextColor(20);
    y = yr + 30;
    doc.setFontSize(7.4); doc.setTextColor(110); t('Estes valores são referências teóricas baseadas em evidências, não resultados do paciente.', M, y); doc.setTextColor(20);
    y += 3; doc.setDrawColor(225); doc.line(M, y, W - M, y); y += 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); t(`RESULTADOS DO PACIENTE · ${R.l.toUpperCase()}`, M, y); doc.setFont('helvetica', 'normal'); y += 6;

    // Simetria D/E (mesmo músculo, um valor por par) e razão antagonista/agonista
    // de cada lado ficam na própria tabela, com a cor do status.
    const cab = ['Músculo', `Pico (${u})`, 'Simetria D/E', 'An/Ag (lado)', 'N/kg', 'z', `RFD200 (${u}/s)`, 'Fadiga', 'Oscilação'];
    const cols = [M, 50, 68, 92, 116, 130, 142, 168, 184];
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.4); cab.forEach((h, i) => t(h, cols[i], y)); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8);
    y += 2; doc.line(M, y, W - M, y); y += 5;
    const valorSt = (txt: string, st: Status, x: number, yy: number) => {
      bolinha(doc, st, x + 1.4, yy - 1.1, 1.2);
      doc.setFont('helvetica', 'bold'); corStatus(doc, st); t(txt, x + 3.6, yy); doc.setFont('helvetica', 'normal'); doc.setTextColor(20);
    };
    for (const k of SLOTS) {
      const m = A.slots[k];
      if (!m) continue;
      const lado: Lado = k.endsWith('D') ? 'D' : 'E';
      const grupo = k.startsWith('ag') ? 'ag' : 'an';
      const temPar = !!A.slots[`${grupo}D` as Slot] && !!A.slots[`${grupo}E` as Slot];
      const linha = [nomeSlot(av.regiao, k), fmt(disp(m.pico), 1), '', '', m.nkg == null ? '-' : fmt(m.nkg, 1), m.z == null ? '-' : fmt(m.z, 1), m.rfd200 == null ? '-' : fmt(disp(m.rfd200), 0), m.fadiga == null ? '-' : `${fmt(m.fadiga, 0)}%`, m.oscilacao == null ? '-' : `${fmt(m.oscilacao, 1)}%`];
      linha.forEach((v, i) => { if (v) t(v, cols[i], y); });
      const L = grupo === 'ag' ? A.lsiAg : A.lsiAn;
      if (!temPar || lado === 'D') {
        if (L) valorSt(`${fmt(L.v, 0)}%`, stLSI(L.v, c), cols[2], temPar ? y + 2.75 : y);
        else t('-', cols[2], y);
        // Chave ligando as duas linhas do par D/E.
        if (temPar) { doc.setDrawColor(170); doc.line(cols[2] - 1.5, y - 3.2, cols[2] - 1.5, y + 7.5); doc.setDrawColor(225); }
      }
      const rz = A.razoes[lado];
      if (rz) valorSt(`${fmt(rz.r * 100, 0)}%`, rz.desvio == null ? ['info', 'Sem referência'] : stDesvio(rz.desvio, c), cols[3], y);
      else t('-', cols[3], y);
      y += 5.5;
    }
    doc.setFontSize(7.4); doc.setTextColor(110);
    t(`Simetria D/E: lado mais fraco em % do mais forte (verde >= ${c.lsiAdequado}%). An/Ag: ${R.razaoL} do mesmo lado.`, M, y); doc.setTextColor(20);
    y += 3;
    y += 2; doc.setFont('helvetica', 'bold'); doc.setFontSize(10); t('Simetria e equilíbrio', M, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.3); y += 5.5;
    const linhas = [
      `Simetria ${R.ag}: ${A.lsiAg ? `${fmt(A.lsiAg.v, 0)}% (${stLSI(A.lsiAg.v, c)?.[1]})` : '-'}`,
      `Simetria ${R.an}: ${A.lsiAn ? `${fmt(A.lsiAn.v, 0)}% (${stLSI(A.lsiAn.v, c)?.[1]})` : '-'}`,
    ];
    for (const l of ['D', 'E'] as Lado[]) {
      const x = A.razoes[l];
      if (x) linhas.push(`${R.razaoL} ${l === 'D' ? 'direito' : 'esquerdo'}: ${fmt(x.r * 100, 0)}% (referência ${x.refTxt || '-'}${x.desvio != null ? `, ${stDesvio(x.desvio, c)?.[1].toLowerCase()}` : ''})`);
    }
    for (const l of linhas) { t(l, M, y); y += 5; }
    y = await blocoVisual(doc, av, A, c, M, y + 2, W - 2 * M);

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
  doc.save(nomeArquivo(d.paciente, 'Dinamometria', d.data));
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
export async function gerarRelatorioCliente(d: DadosRelatorio) {
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
  doc.save(nomeArquivo(d.paciente, 'Avaliacao_de_forca', d.data));
}

