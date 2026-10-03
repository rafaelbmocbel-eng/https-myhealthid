import jsPDF from 'jspdf';
import { addLogoToDoc } from '@/utils/pdfLogoHelper';
import {
  type Analise, type Avaliacao, type Criterios, type Lado, type Slot, type Sujeito,
  SLOTS, UF, fmt, nomeSlot, dataBR, stLSI, stDesvio, interpretar,
} from './analise';
import { MUSCULOS, COR_STATUS, mapaMuscularSVG, svgParaPNG, statusLado, type ItemMapa } from './anatomia';

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

const nomeArquivo = (paciente: string, sufixo: string, data: string) => `${sufixo}_${paciente.replace(/[^\wÀ-ú]+/g, '_')}_${data}.pdf`;

function linhaSujeito(s: Sujeito) {
  return [s.sexo === 'M' ? 'Masculino' : 'Feminino', s.idade != null ? `${s.idade} anos` : '', s.peso ? `${s.peso} kg` : '', s.modalidade || '', `dominante ${s.dominante === 'E' ? 'esquerdo' : 'direito'}`].filter(Boolean).join(', ');
}

export interface ItemRelatorio { av: Avaliacao; A: Analise; anterior?: { data: string; av: Avaliacao } | null; historico: { data: string; score: number | null }[] }
export interface DadosRelatorio { paciente: string; profissional?: string; logoUrl?: string; data: string; c: Criterios; itens: ItemRelatorio[]; scoreGeral: number | null }

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

    doc.setTextColor(20); doc.setFontSize(9); t(`SCORE DE FORÇA · ${R.l.toUpperCase()}`, M, y - 5);
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
    if (historico.length > 1) {
      const h = ((W - 2 * M) * 220) / 760;
      if (y + h + 10 > 284) { doc.addPage(); y = 18; }
      y += 3; doc.setFont('helvetica', 'bold'); doc.setFontSize(10); t(`Evolução do score · ${R.l}`, M, y); doc.setFont('helvetica', 'normal'); y += 3;
      const img = graficoPNG([{ nome: 'Score', cor: COR.D, pts: historico.map((x, i) => [i, x.score ?? 0]) }], { xFmt: String, yFmt: v => fmt(v, 0), xTicks: historico.map((x, i) => [i, dataBR(x.data).slice(0, 5)]), pontos: true, yMin100: true, H: 220 });
      doc.addImage(img, 'PNG', M, y, W - 2 * M, h); y += h + 4;
    }
    doc.setFontSize(7.4); doc.setTextColor(110);
    const rod = doc.splitTextToSize(seguro('O score de força é um índice interno do serviço, com faixas ajustáveis; não é uma escala validada. Normas: McKay et al., Neurology 2017 (membro dominante). Simetria >= 90%: Grindem et al., Br J Sports Med 2016. Adução/abdução do quadril >= 0,80: Tyler et al., Am J Sports Med 2001.'), W - 2 * M);
    if (y > 270) { doc.addPage(); y = 18; }
    doc.text(rod, M, Math.max(y + 4, 286 - rod.length * 3.3));
  }
  doc.save(nomeArquivo(d.paciente, 'Dinamometria', d.data));
}

// ───────── Mapa muscular para tela e relatório do cliente ─────────
export function itensMapa(itens: { av: Avaliacao; A: Analise }[]): ItemMapa[] {
  const out: ItemMapa[] = [];
  let n = 1;
  for (const { av, A } of itens) {
    for (const g of ['ag', 'an'] as const) {
      if (!A.slots[`${g}D` as Slot] && !A.slots[`${g}E` as Slot]) continue;
      out.push({ regiao: av.regiao, g, numero: n++, D: statusLado(A, g, 'D'), E: statusLado(A, g, 'E') });
    }
  }
  return out;
}

function fraseSimetria(v: number) {
  if (v >= 90) return 'os dois lados estão equilibrados';
  if (v >= 80) return 'há uma diferença moderada entre os lados';
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
  t(`${d.paciente} · ${dataBR(d.data)} · ${d.itens.map(i => i.A.R.l).join(', ')}`, M, y);
  if (d.profissional) { y += 5; t(`Avaliado por ${d.profissional}`, M, y); }
  y += 9;

  doc.setTextColor(20);
  if (d.scoreGeral != null) {
    const cat = d.scoreGeral >= 90 ? 'Excelente' : d.scoreGeral >= 75 ? 'Bom' : d.scoreGeral >= 60 ? 'Regular' : 'Precisa de atenção';
    doc.setFont('helvetica', 'bold'); doc.setFontSize(34); t(String(d.scoreGeral), M, y + 8);
    doc.setFontSize(12); t('/100', M + String(d.scoreGeral).length * 7.4 + 1, y + 8);
    doc.setFontSize(13); t(cat, M + 34, y + 2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(70);
    par('Seu score de força vai de 0 a 100 e junta quatro coisas: o equilíbrio entre os lados direito e esquerdo, o equilíbrio entre músculos que trabalham em sentidos opostos, a resistência e a firmeza da contração.', M + 34, y + 7, W - 2 * M - 34, 4.3);
    doc.setTextColor(20); y += 24;
  }

  const itensMap = itensMapa(d.itens);
  try {
    const png = await svgParaPNG(mapaMuscularSVG(itensMap));
    const larg = 118, alt = (larg * 480) / 460;
    doc.addImage(png, 'PNG', M, y, larg, alt);
    let ly = y + 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); t('Como ler o mapa', M + larg + 6, ly); doc.setFont('helvetica', 'normal'); ly += 6;
    const legenda: [string, string][] = [['ok', 'Bom resultado'], ['warn', 'Merece atenção'], ['bad', 'Precisa ser trabalhado'], ['info', 'Medido, sem comparação']];
    doc.setFontSize(9.3);
    for (const [k, l] of legenda) {
      const hex = COR_STATUS[k];
      doc.setFillColor(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
      doc.roundedRect(M + larg + 6, ly - 3.2, 5, 4, 1, 1, 'F'); t(l, M + larg + 13, ly); ly += 6;
    }
    ly += 2; doc.setFontSize(8.6); doc.setTextColor(80);
    ly = par('Os números no desenho correspondem aos músculos descritos abaixo. Na vista de frente, o seu lado direito aparece à esquerda da imagem.', M + larg + 6, ly, W - M - (M + larg + 6), 4);
    doc.setTextColor(20);
    y += alt + 4;
  } catch { /* sem o mapa, o relatório segue só com o texto */ }

  const pk = (av: Avaliacao, k: Slot) => av.slots[k]?.metricas.pico ?? null;
  let n = 0;
  for (const { av, A } of d.itens) {
    for (const g of ['ag', 'an'] as const) {
      const info = MUSCULOS[av.regiao]?.[g];
      const d1 = pk(av, `${g}D` as Slot), e1 = pk(av, `${g}E` as Slot);
      if (!info || (d1 == null && e1 == null)) continue;
      n++;
      const frases: string[] = [];
      frases.push(`Fica na ${info.local} e ${info.funcao}.`);
      frases.push(`Força medida: direito ${fmt(disp(d1), 1)} ${u}, esquerdo ${fmt(disp(e1), 1)} ${u}.`);
      const L = g === 'ag' ? A.lsiAg : A.lsiAn;
      if (L) frases.push(`O lado ${L.fraco === 'D' ? 'direito' : 'esquerdo'} tem ${fmt(L.v, 0)}% da força do outro: ${fraseSimetria(L.v)}.`);
      const zs = (['D', 'E'] as Lado[]).map(l => A.slots[`${g}${l}` as Slot]?.z).filter((z): z is number => z != null);
      if (zs.length) frases.push(`A força está ${fraseNorma(Math.min(...zs))}.`);
      const texto = frases.join(' ');
      const ls = doc.splitTextToSize(seguro(texto), W - 2 * M - 10);
      if (y + 8 + ls.length * 4.6 > 282) { doc.addPage(); y = 18; }
      doc.setFillColor(31, 41, 55); doc.circle(M + 3.5, y - 1.3, 3.5, 'F');
      doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); t(String(n), M + 3.5, y - 0.1, { align: 'center' });
      doc.setTextColor(20); doc.setFontSize(11); t(info.nome, M + 10, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.6);
      doc.text(ls, M + 10, y + 5.2);
      y += 5.2 + ls.length * 4.6 + 4;
    }
  }

  const atencao = itensMap.filter(i => (['D', 'E'] as Lado[]).some(l => i[l] && (i[l]![0] === 'warn' || i[l]![0] === 'bad'))).map(i => MUSCULOS[i.regiao]?.[i.g]?.nome).filter(Boolean);
  if (y > 250) { doc.addPage(); y = 18; }
  y += 2; doc.setFont('helvetica', 'bold'); doc.setFontSize(11); t('O que isso significa para você', M, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.8); y += 6;
  if (atencao.length) y = par(`Os pontos a trabalhar são: ${atencao.join(', ')}. Seu fisioterapeuta vai usar estes números para direcionar os exercícios e comparar na próxima avaliação.`, M, y, W - 2 * M);
  else y = par('Seus resultados estão equilibrados. Manter os exercícios ajuda a preservar a força e prevenir lesões; a próxima avaliação vai mostrar a evolução.', M, y, W - 2 * M);
  y += 3; doc.setFontSize(8); doc.setTextColor(110);
  par('Este relatório resume uma avaliação de força feita com dinamômetro e não substitui a consulta com o profissional que acompanha você.', M, Math.max(y, 280), W - 2 * M, 3.6);
  doc.save(nomeArquivo(d.paciente, 'Avaliacao_de_forca', d.data));
}

