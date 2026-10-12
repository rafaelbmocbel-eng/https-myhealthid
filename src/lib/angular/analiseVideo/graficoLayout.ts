/*
 * Layout puro do gráfico "ângulo x tempo" da análise em vídeo: converte séries, eventos e bandas de
 * referência em primitivas (caminhos, marcas, retângulos) já em coordenadas do gráfico. O SVG da tela, o
 * canvas do PDF e o do vídeo exportado só pintam estas primitivas, então saem iguais.
 */

export type LadoGrafico = 'D' | 'E';

export interface PontoSerie { t: number; v: number | null }

export interface SerieGrafico {
  id: string;
  rotulo: string;
  cor: string;
  lado?: LadoGrafico;
  pontos: PontoSerie[];
}

export interface MarcadorGrafico {
  id: string;
  t: number;
  tipo: 'contato' | 'saida' | 'outro';
  lado?: LadoGrafico | null;
  rotulo?: string;
  /** Texto da legenda dos marcadores de tipo "outro" (ex.: "pico da repetição"). */
  legenda?: string;
}

/** Faixa de referência confirmada em fonte; só entra no gráfico com a fonte nomeada. */
export interface BandaGrafico {
  id: string;
  min?: number;
  max?: number;
  rotulo: string;
}

export interface OpcoesLayoutGrafico {
  largura: number;
  altura: number;
  /** Duração do trecho analisado, em segundos: o eixo vai de `t0` a `t0 + duracao`. */
  t0?: number;
  duracao: number;
  /** Tamanho da fonte dos rótulos dos eixos, na mesma unidade da largura. */
  fonte?: number;
  unidade?: string;
}

export interface MargemGrafico { esq: number; dir: number; topo: number; base: number }

export interface LayoutGrafico {
  largura: number;
  altura: number;
  fonte: number;
  margem: MargemGrafico;
  area: { x0: number; y0: number; x1: number; y1: number };
  dominioY: { min: number; max: number };
  ticksY: { v: number; y: number; rotulo: string }[];
  ticksX: { t: number; x: number; rotulo: string }[];
  caminhos: { id: string; rotulo: string; cor: string; d: string; lado?: LadoGrafico }[];
  marcadores: { id: string; x: number; tipo: MarcadorGrafico['tipo']; lado?: LadoGrafico | null; rotulo?: string }[];
  bandas: { id: string; y0: number; y1: number; rotulo: string }[];
  xDoTempo: (t: number) => number;
  tempoDoX: (x: number) => number;
  yDoValor: (v: number) => number;
}

const PASSOS_BONITOS = [1, 2, 2.5, 5, 10];

/** Passo "redondo" (1, 2, 2,5, 5 × 10ⁿ) para cerca de `alvo` divisões num intervalo. */
export function passoBonito(intervalo: number, alvo = 4): number {
  if (!(intervalo > 0) || !Number.isFinite(intervalo)) return 1;
  const bruto = intervalo / Math.max(1, alvo);
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const frac = bruto / pot;
  const f = PASSOS_BONITOS.find((p) => frac <= p + 1e-9) ?? 10;
  return f * pot;
}

/** Marcas do eixo: múltiplos do passo dentro de [min, max]. */
export function ticksDoEixo(min: number, max: number, alvo = 4): number[] {
  const passo = passoBonito(max - min, alvo);
  const ini = Math.ceil(min / passo - 1e-9) * passo;
  const out: number[] = [];
  for (let v = ini; v <= max + passo * 1e-6 && out.length < 40; v += passo) out.push(Math.round(v / passo) * passo + 0);
  return out;
}

const fmtInt = (v: number) => (Math.abs(v) < 1e-9 ? '0' : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
const fmtS = (t: number) => t.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Domínio do eixo Y: dados (e bandas que cruzam os dados) com 8% de folga, arredondado às marcas. */
export function dominioDoEixoY(series: SerieGrafico[], bandas: BandaGrafico[] = []): { min: number; max: number } {
  const vals: number[] = [];
  for (const s of series) for (const p of s.pontos) if (p.v !== null && Number.isFinite(p.v)) vals.push(p.v);
  if (!vals.length) return { min: 0, max: 1 };
  let min = Math.min(...vals), max = Math.max(...vals);
  // Uma faixa só entra no domínio se tocar os dados: uma faixa distante achataria a curva.
  for (const b of bandas) {
    const lo = b.min ?? -Infinity, hi = b.max ?? Infinity;
    if (hi < min - (max - min) * 0.5 || lo > max + (max - min) * 0.5) continue;
    if (Number.isFinite(lo)) min = Math.min(min, lo);
    if (Number.isFinite(hi)) max = Math.max(max, hi);
  }
  if (max - min < 1e-6) { min -= 1; max += 1; }
  const folga = (max - min) * 0.08;
  const passo = passoBonito(max - min + 2 * folga, 4);
  return { min: Math.floor((min - folga) / passo + 1e-9) * passo, max: Math.ceil((max + folga) / passo - 1e-9) * passo };
}

function caminhoDaSerie(s: SerieGrafico, x: (t: number) => number, y: (v: number) => number): string {
  let d = '';
  let aberto = false;
  for (const p of s.pontos) {
    if (p.v === null || !Number.isFinite(p.v)) { aberto = false; continue; }
    d += `${aberto ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`;
    aberto = true;
  }
  return d;
}

export function layoutDoGrafico(series: SerieGrafico[], marcadores: MarcadorGrafico[], bandas: BandaGrafico[], o: OpcoesLayoutGrafico): LayoutGrafico {
  const fonte = o.fonte ?? Math.max(8, o.altura * 0.058);
  const margem: MargemGrafico = { esq: fonte * 3.4, dir: fonte * 0.8, topo: fonte * 1.1, base: fonte * 2.2 };
  const area = { x0: margem.esq, y0: margem.topo, x1: o.largura - margem.dir, y1: o.altura - margem.base };
  const t0 = o.t0 ?? 0;
  const dur = o.duracao > 0 ? o.duracao : 1;
  const dom = dominioDoEixoY(series, bandas);
  const xDoTempo = (t: number) => area.x0 + ((t - t0) / dur) * (area.x1 - area.x0);
  const tempoDoX = (x: number) => t0 + ((x - area.x0) / (area.x1 - area.x0)) * dur;
  const yDoValor = (v: number) => area.y1 - ((v - dom.min) / (dom.max - dom.min)) * (area.y1 - area.y0);
  const un = o.unidade ?? '°';

  const ticksY = ticksDoEixo(dom.min, dom.max, 4).map((v) => ({ v, y: yDoValor(v), rotulo: `${fmtInt(v)}${un}` }));
  const ticksX = ticksDoEixo(t0, t0 + dur, o.largura > 300 ? 5 : 4).map((t) => ({ t, x: xDoTempo(t), rotulo: `${fmtS(t)} s` }));

  const faixas = bandas.map((b) => {
    const hi = Math.min(b.max ?? dom.max, dom.max), lo = Math.max(b.min ?? dom.min, dom.min);
    return { id: b.id, y0: yDoValor(hi), y1: yDoValor(lo), rotulo: b.rotulo, vazia: hi <= lo };
  }).filter((b) => !b.vazia).map(({ vazia: _v, ...b }) => b);

  return {
    largura: o.largura, altura: o.altura, fonte, margem, area, dominioY: dom, ticksY, ticksX,
    caminhos: series.map((s) => ({ id: s.id, rotulo: s.rotulo, cor: s.cor, d: caminhoDaSerie(s, xDoTempo, yDoValor), lado: s.lado })),
    marcadores: marcadores.filter((m) => m.t >= t0 - 1e-6 && m.t <= t0 + dur + 1e-6).map((m) => ({ id: m.id, x: xDoTempo(m.t), tipo: m.tipo, lado: m.lado, rotulo: m.rotulo })),
    bandas: faixas, xDoTempo, tempoDoX, yDoValor,
  };
}

/** Valor da série no instante `t` (interpolado entre os dois pontos vizinhos); null se faltar dado ao redor. */
export function valorNoTempo(s: SerieGrafico, t: number): number | null {
  const p = s.pontos;
  if (!p.length) return null;
  let lo = 0, hi = p.length - 1;
  if (t <= p[0].t) return p[0].v;
  if (t >= p[hi].t) return p[hi].v;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (p[mid].t <= t) lo = mid; else hi = mid;
  }
  const a = p[lo], b = p[hi];
  if (a.v === null || b.v === null) return null;
  const f = (t - a.t) / ((b.t - a.t) || 1);
  return a.v + (b.v - a.v) * f;
}

/** Tempo (s) sob o dedo num gráfico desenhado numa caixa de largura `larguraCss` px, limitado ao trecho. */
export function tempoDoToque(layout: LayoutGrafico, xCss: number, larguraCss: number, t0: number, duracao: number): number {
  const x = (xCss / Math.max(1, larguraCss)) * layout.largura;
  return Math.min(Math.max(layout.tempoDoX(x), t0), t0 + duracao);
}
