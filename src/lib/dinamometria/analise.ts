// Análise de dinamometria isométrica a partir da curva força × tempo exportada
// pelo dinamômetro: detecção de colunas, repetições, pico, RFD, impulso,
// índice de fadiga, oscilação do platô, simetria e razões. Cada valência é
// classificada separadamente; não há nota única que as some.

import type { Celula } from './planilha';

export const G = 9.80665;
export type Unidade = 'N' | 'kgf' | 'lbf';
export const UF: Record<Unidade, number> = { N: 1, kgf: G, lbf: 4.44822 };
export const SLOTS = ['agD', 'agE', 'anD', 'anE'] as const;
export type Slot = typeof SLOTS[number];
export type Lado = 'D' | 'E';

// McKay 2017 (1000 Norms), tabela 1 — média e DP do membro dominante, por faixa
// etária, [homem, mulher]. Joelho em N·m (dinamômetro fixo); demais em N.
type Faixa = 'c' | 'a' | 'ad' | 'o';
type Norma = { nm?: boolean } & Record<Faixa, [[number, number], [number, number]]>;
export const MCK: Record<string, Norma> = {
  an_df: { c: [[87.1, 38.2], [81.6, 29.2]], a: [[197.2, 56.6], [166.0, 37.8]], ad: [[224.6, 48.9], [166.5, 41.6]], o: [[173.3, 44.0], [131.5, 38.9]] },
  an_pf: { c: [[151.7, 52.3], [142.7, 45.9]], a: [[309.9, 74.9], [261.2, 52.7]], ad: [[338.8, 66.8], [243.9, 59.2]], o: [[281.4, 62.7], [216.3, 60.3]] },
  kn_flex: { nm: true, c: [[27.0, 13.9], [25.2, 11.5]], a: [[89.8, 34.6], [65.9, 19.7]], ad: [[106.3, 28.6], [64.4, 18.9]], o: [[76.3, 20.1], [45.8, 13.3]] },
  kn_ext: { nm: true, c: [[34.9, 18.1], [34.2, 14.9]], a: [[152.8, 71.1], [116.9, 36.6]], ad: [[202.1, 56.1], [122.6, 33.6]], o: [[136.2, 35.6], [81.9, 26.8]] },
  hip_ir: { c: [[63.3, 31.7], [61.1, 25.8]], a: [[178.5, 67.2], [143.2, 45.0]], ad: [[217.7, 62.4], [136.1, 44.6]], o: [[169.7, 55.0], [108.4, 33.8]] },
  hip_er: { c: [[49.7, 22.7], [43.8, 16.8]], a: [[141.7, 53.7], [104.0, 28.7]], ad: [[169.4, 45.8], [100.7, 29.1]], o: [[125.5, 33.9], [76.3, 23.7]] },
  hip_abd: { c: [[52.3, 23.1], [52.4, 21.9]], a: [[143.4, 47.2], [116.6, 31.9]], ad: [[170.7, 43.9], [113.1, 32.4]], o: [[124.8, 32.8], [83.8, 23.5]] },
  el_flex: { c: [[71.7, 29.1], [66.0, 26.4]], a: [[213.8, 81.1], [148.5, 36.8]], ad: [[270.2, 59.6], [164.4, 42.3]], o: [[209.4, 48.4], [129.7, 33.9]] },
  el_ext: { c: [[66.8, 24.4], [62.0, 19.7]], a: [[159.3, 56.8], [118.3, 30.0]], ad: [[203.2, 46.1], [121.2, 30.2]], o: [[162.1, 36.8], [102.8, 25.3]] },
  sh_ir: { c: [[56.1, 27.1], [47.7, 17.4]], a: [[151.5, 63.2], [101.6, 27.7]], ad: [[202.4, 55.9], [109.7, 33.6]], o: [[159.7, 42.9], [86.0, 27.5]] },
  sh_er: { c: [[38.7, 19.5], [34.7, 13.0]], a: [[100.6, 38.8], [73.4, 19.1]], ad: [[134.7, 39.6], [82.2, 20.9]], o: [[96.7, 25.3], [63.3, 19.2]] },
};

export interface Regiao { l: string; ag: string; an: string; razaoL: string; mAg: string; mAn: string | null; modo: 'mck' | 'min'; min?: number; torque?: boolean }
export const REGIOES: Record<string, Regiao> = {
  joelho: { l: 'Joelho', ag: 'Quadríceps', an: 'Posteriores', razaoL: 'Posteriores / Quadríceps (I/Q)', mAg: 'kn_ext', mAn: 'kn_flex', modo: 'mck', torque: true },
  quadril: { l: 'Quadril (abdução/adução)', ag: 'Abdutores', an: 'Adutores', razaoL: 'Adutores / Abdutores', mAg: 'hip_abd', mAn: null, modo: 'min', min: 0.8 },
  quadrilRot: { l: 'Quadril (rotações)', ag: 'Rotadores internos', an: 'Rotadores externos', razaoL: 'RE / RI do quadril', mAg: 'hip_ir', mAn: 'hip_er', modo: 'mck' },
  ombro: { l: 'Ombro (rotações)', ag: 'Rotadores internos', an: 'Rotadores externos', razaoL: 'RE / RI do ombro', mAg: 'sh_ir', mAn: 'sh_er', modo: 'mck' },
  tornozelo: { l: 'Tornozelo', ag: 'Flexores plantares', an: 'Dorsiflexores', razaoL: 'Dorsiflexores / Flexores plantares', mAg: 'an_pf', mAn: 'an_df', modo: 'mck' },
  cotovelo: { l: 'Cotovelo', ag: 'Flexores', an: 'Extensores', razaoL: 'Extensores / Flexores', mAg: 'el_flex', mAn: 'el_ext', modo: 'mck' },
};

// Faixas de cada valência: até o primeiro limite é adequado (verde), até o
// segundo é atenção (amarelo), além dele é alterado (vermelho).
export interface Criterios {
  unidade: Unidade;
  lsiAdequado: number; lsiImportante: number;
  razaoTol: number; razaoLimite: number;
  fadBaixa: number; fadAlta: number;
  oscEstavel: number; oscInstavel: number;
  mudanca: number; platoMin: number;
}
export const CRITERIOS_PADRAO: Criterios = {
  unidade: 'kgf', lsiAdequado: 90, lsiImportante: 80, razaoTol: 10, razaoLimite: 20,
  fadBaixa: 15, fadAlta: 30, oscEstavel: 3, oscInstavel: 8, mudanca: 15, platoMin: 4,
};

export interface Metricas { pico: number; ttp: number | null; rfd100: number | null; rfd200: number | null; impulso: number | null; duracao: number | null; plato: number | null; fadiga: number | null; oscilacao: number | null; hz: number | null; reps: number[]; fonte?: 'curva' | 'pico' }
export interface SlotDados { arquivo: string; metricas: Metricas; curva?: { t: number[]; f: number[] } | null }
export interface Sujeito { idade: number | null; sexo: 'M' | 'F'; peso: number | null; dominante: Lado; acometido: Lado | 'N'; modalidade?: string }
// Uma articulação avaliada. Sessões antigas (versao 1) guardavam uma só; a
// versao 2 guarda várias em `movimentos`, todas com o mesmo `sujeito`.
export interface Avaliacao { versao: 1; regiao: string; braco: number | null; sujeito: Sujeito; slots: Partial<Record<Slot, SlotDados>> }
export interface Movimento { regiao: string; braco: number | null; slots: Partial<Record<Slot, SlotDados>> }
export interface Sessao { versao: 2; sujeito: Sujeito; movimentos: Movimento[] }

export function movimentosDaAnalise(a: unknown): Avaliacao[] {
  const x = a as { versao?: number; movimentos?: Movimento[]; sujeito?: Sujeito; regiao?: string; slots?: Avaliacao['slots'] } | null;
  if (!x) return [];
  const suj = x.sujeito;
  if (x.versao === 2 && Array.isArray(x.movimentos) && suj) return x.movimentos.map((m): Avaliacao => ({ versao: 1, regiao: m.regiao, braco: m.braco ?? null, sujeito: suj, slots: m.slots || {} }));
  if (x.versao === 1 && x.regiao && x.slots && suj) return [x as Avaliacao];
  return [];
}

// Dinamômetros que só mostram o valor máximo: as tentativas viram repetições.
export function metricasDePico(valoresN: number[]): Metricas | null {
  const v = valoresN.filter(n => Number.isFinite(n) && n > 0);
  if (!v.length) return null;
  return { pico: +Math.max(...v).toFixed(2), ttp: null, rfd100: null, rfd200: null, impulso: null, duracao: null, plato: null, fadiga: null, oscilacao: null, hz: null, reps: v.map(n => +n.toFixed(1)), fonte: 'pico' };
}

export const num = (v: unknown): number | null => {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/\s/g, '');
  if (!/^[-+]?\d*[.,]?\d+(e[-+]?\d+)?$/i.test(s)) return null;
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const fmt = (n: number | null | undefined, d = 1) => (n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const nomeSlot = (regiao: string, k: Slot) => {
  const r = REGIOES[regiao] || REGIOES.joelho;
  return `${k.startsWith('ag') ? r.ag : r.an} ${k.endsWith('D') ? 'D' : 'E'}`;
};

// ───────── Detecção de colunas ─────────
export interface Coluna { idx: number; nome: string; mono: boolean; faixa: number }
export interface Mapa { inicio: number; tempo: number | null; forca: number | null; unidade: Unidade; unidadeTempo: 'auto' | 's' | 'ms'; hz: number }
export interface Inspecao { colunas: Coluna[]; mapa: Mapa; unidadeCerta: boolean }

export function inspecionar(linhas: Celula[][]): Inspecao | null {
  const ehNum = (r: Celula[] | undefined) => !!r && r.filter(c => num(c) != null).length >= 1;
  let inicio = -1;
  for (let i = 0; i < linhas.length && i < 500; i++) {
    let ok = true;
    for (let j = i; j < Math.min(linhas.length, i + 8); j++) if (!ehNum(linhas[j])) { ok = false; break; }
    if (ok) { inicio = i; break; }
  }
  if (inicio < 0) return null;
  let cab: Celula[] | null = null;
  for (let j = inicio - 1; j >= Math.max(0, inicio - 6); j--) {
    const r = linhas[j];
    if (r && r.some(c => c != null && num(c) == null && String(c).trim() !== '')) { cab = r; break; }
  }
  const largura = Math.max(...linhas.slice(inicio, inicio + 50).map(r => (r ? r.length : 0)));
  const colunas: Coluna[] = [];
  for (let c = 0; c < largura; c++) {
    const vals: number[] = [];
    for (let i = inicio; i < linhas.length; i++) { const v = num(linhas[i]?.[c]); if (v != null) vals.push(v); }
    if (vals.length < (linhas.length - inicio) * 0.6 || vals.length < 10) continue;
    let mono = true;
    for (let i = 1; i < vals.length; i++) if (vals[i] <= vals[i - 1]) { mono = false; break; }
    let mn = Infinity, mx = -Infinity;
    for (const v of vals) { if (v < mn) mn = v; if (v > mx) mx = v; }
    const nome = cab && cab[c] != null ? String(cab[c]).trim() : `Coluna ${String.fromCharCode(65 + (c % 26))}`;
    colunas.push({ idx: c, nome, mono, faixa: mx - mn });
  }
  if (!colunas.length) return null;
  const reTempo = /tempo|time|^t$|^t[\s([]|seg|^ms$|\(ms\)|\(s\)/i;
  const reForca = /for[cç]a|force|kgf|\bkg\b|\bn\b|newton|carga|load|lbf|torque/i;
  const tcol = colunas.find(c => c.mono && reTempo.test(c.nome)) || colunas.find(c => c.mono) || null;
  const resto = colunas.filter(c => c !== tcol);
  const fcol = resto.find(c => reForca.test(c.nome) && !reTempo.test(c.nome)) || [...resto].sort((a, b) => b.faixa - a.faixa)[0] || null;
  let unidade: Unidade = 'kgf';
  let unidadeCerta = false;
  const fn = fcol ? fcol.nome : '';
  if (/lbf|\blb\b/i.test(fn)) { unidade = 'lbf'; unidadeCerta = true; }
  else if (/kgf|\bkg\b/i.test(fn)) { unidade = 'kgf'; unidadeCerta = true; }
  else if (/\bn\b|newton|\(n\)/i.test(fn)) { unidade = 'N'; unidadeCerta = true; }
  return {
    colunas,
    unidadeCerta,
    mapa: { inicio, tempo: tcol ? tcol.idx : null, forca: fcol ? fcol.idx : null, unidade, unidadeTempo: tcol && /ms/i.test(tcol.nome) ? 'ms' : 'auto', hz: 100 },
  };
}

export function extrair(linhas: Celula[][], m: Mapa): { t: number[]; f: number[] } {
  const t: number[] = [], f: number[] = [];
  if (m.forca == null) return { t, f };
  for (let i = m.inicio; i < linhas.length; i++) {
    const r = linhas[i];
    if (!r) continue;
    const fv = num(r[m.forca]);
    if (fv == null) continue;
    if (m.tempo != null) {
      const tv = num(r[m.tempo]);
      if (tv == null) continue;
      t.push(tv);
    }
    f.push(fv * UF[m.unidade]);
  }
  if (m.tempo == null) {
    for (let i = 0; i < f.length; i++) t[i] = i / (m.hz || 100);
  } else {
    let tu = m.unidadeTempo;
    if (tu === 'auto') {
      const dts: number[] = [];
      for (let i = 1; i < Math.min(t.length, 200); i++) dts.push(t[i] - t[i - 1]);
      dts.sort((a, b) => a - b);
      const md = dts[Math.floor(dts.length / 2)] || 0;
      tu = md >= 0.5 && t[t.length - 1] > 60 ? 'ms' : 's';
    }
    if (tu === 'ms') for (let i = 0; i < t.length; i++) t[i] /= 1000;
    const t0 = t[0];
    for (let i = 0; i < t.length; i++) t[i] -= t0;
  }
  return { t, f };
}

// ───────── Métricas da curva ─────────
function mediaMovel(a: number[], w: number): number[] {
  if (w <= 1) return a.slice();
  const n = a.length, h = Math.floor(w / 2);
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + a[i];
  const o = new Array<number>(n);
  for (let i = 0; i < n; i++) { const lo = Math.max(0, i - h), hi = Math.min(n, i + h + 1); o[i] = (pre[hi] - pre[lo]) / (hi - lo); }
  return o;
}
function percentil(a: number[], p: number) { const s = [...a].sort((x, y) => x - y); return s[Math.floor(clamp(p, 0, 1) * (s.length - 1))]; }
function dp(a: number[]) { const m = a.reduce((s, x) => s + x, 0) / a.length; return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); }
function regLinear(x: number[], y: number[]) {
  const n = x.length; let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; sxy += x[i] * y[i]; }
  const b = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  return { a: (sy - b * sx) / n, b };
}
const maxDe = (a: number[]) => { let m = -Infinity; for (const v of a) if (v > m) m = v; return m; };

export type ResultadoCurva = { erro: string } | { metricas: Metricas; curva: { t: number[]; f: number[] } };

export function analisarCurva(t: number[], fBruta: number[], platoMin: number): ResultadoCurva {
  const n = t.length;
  if (n < 20) return { erro: 'Poucos pontos na curva.' };
  const dts: number[] = [];
  for (let i = 1; i < Math.min(n, 500); i++) dts.push(t[i] - t[i - 1]);
  dts.sort((a, b) => a - b);
  const dt = dts[Math.floor(dts.length / 2)];
  if (!(dt > 0)) return { erro: 'Coluna de tempo inválida.' };
  const hz = 1 / dt;
  const base = percentil(fBruta, 0.05);
  const f = fBruta.map(v => v - base);
  const f20 = mediaMovel(f, Math.max(1, Math.round(0.02 * hz)));
  const f50 = mediaMovel(f, Math.max(1, Math.round(0.05 * hz)));
  const max = maxDe(f50);
  if (!(max > 0)) return { erro: 'Não encontrei contração na curva.' };
  const lim = 0.15 * max;
  const limInicio = Math.max(0.02 * max, 3 * dp(f.slice(0, Math.max(5, Math.round(0.3 * hz)))));

  const reps: [number, number][] = [];
  let i = 0;
  while (i < n) {
    if (f50[i] > lim) { let j = i; while (j < n && f50[j] > lim) j++; reps.push([i, j - 1]); i = j; } else i++;
  }
  const unidas: [number, number][] = [];
  for (const r of reps) {
    const ult = unidas[unidas.length - 1];
    if (ult && (r[0] - ult[1]) * dt < 0.2) ult[1] = r[1]; else unidas.push([r[0], r[1]]);
  }
  const validas = unidas.filter(r => (r[1] - r[0]) * dt >= 0.25);
  if (!validas.length) return { erro: 'Contração muito curta.' };
  const info = validas.map(([a, b]) => { let pk = a; for (let k = a; k <= b; k++) if (f50[k] > f50[pk]) pk = k; return { a, b, pk, pico: f50[pk] }; });
  const melhor = info.reduce((x, y) => (y.pico > x.pico ? y : x));
  let ini = melhor.a; while (ini > 0 && f20[ini] > limInicio) ini--;
  let fim = melhor.b; while (fim < n - 1 && f20[fim] > limInicio) fim++;
  const pico = melhor.pico;
  const ttp = (melhor.pk - ini) * dt;
  const em = (s: number) => { const k = ini + Math.round(s / dt); return k < n ? f20[k] - f20[ini] : null; };
  const rfdOk = dt <= 0.02;
  const g100 = em(0.1), g200 = em(0.2);
  const rfd100 = rfdOk && g100 != null ? g100 / 0.1 : null;
  const rfd200 = rfdOk && g200 != null ? g200 / 0.2 : null;
  let impulso = 0;
  for (let k = ini + 1; k <= fim; k++) impulso += ((Math.max(0, f[k]) + Math.max(0, f[k - 1])) / 2) * dt;

  let pa = ini; while (pa < fim && f50[pa] < 0.5 * pico) pa++;
  let pb = fim; while (pb > pa && f50[pb] < 0.5 * pico) pb--;
  const plato = (pb - pa) * dt;
  let fadiga: number | null = null;
  if (plato >= platoMin) {
    const w = Math.round(1 / dt);
    const m1 = mediaMovel(f.slice(pa, pb + 1), w);
    const fmax1 = maxDe(m1.slice(Math.floor(w / 2), m1.length - Math.floor(w / 2)));
    let s = 0, c = 0;
    for (let k = pb - w; k <= pb; k++) { s += f[k]; c++; }
    fadiga = ((fmax1 - s / c) / fmax1) * 100;
  }
  let oscilacao: number | null = null;
  const ca = pa + Math.round(0.5 / dt), cb = pb - Math.round(0.5 / dt);
  if ((cb - ca) * dt >= 1.5) {
    const xs: number[] = [], ys: number[] = [];
    for (let k = ca; k <= cb; k++) { xs.push(k * dt); ys.push(f[k]); }
    const lr = regLinear(xs, ys);
    let ss = 0, mn = 0;
    for (let k = 0; k < xs.length; k++) { const r = ys[k] - (lr.a + lr.b * xs[k]); ss += r * r; mn += ys[k]; }
    mn /= xs.length;
    oscilacao = (Math.sqrt(ss / (xs.length - 2)) / mn) * 100;
  }
  const c0 = Math.max(0, ini - Math.round(0.3 / dt)), c1 = Math.min(n - 1, fim + Math.round(0.3 / dt));
  const passo = Math.max(1, Math.ceil((c1 - c0 + 1) / 450));
  const ct: number[] = [], cf: number[] = [];
  for (let k = c0; k <= c1; k += passo) { ct.push(+((k - ini) * dt).toFixed(3)); cf.push(+f50[k].toFixed(1)); }
  const tp = +((melhor.pk - ini) * dt).toFixed(3);
  const pos = ct.findIndex(x => x >= tp);
  if (pos >= 0) { ct.splice(pos, 0, tp); cf.splice(pos, 0, +pico.toFixed(1)); }
  const r1 = (v: number | null, d: number) => (v == null ? null : +v.toFixed(d));
  return {
    metricas: {
      pico: +pico.toFixed(2), ttp: +ttp.toFixed(3), rfd100: r1(rfd100, 1), rfd200: r1(rfd200, 1), impulso: +impulso.toFixed(1),
      duracao: +((fim - ini) * dt).toFixed(2), plato: +plato.toFixed(2), fadiga: r1(fadiga, 1), oscilacao: r1(oscilacao, 2),
      hz: Math.round(hz), reps: info.map(r => +r.pico.toFixed(1)), fonte: 'curva',
    },
    curva: { t: ct, f: cf },
  };
}

// ───────── Resultado ─────────
export type Status = ['ok' | 'warn' | 'bad' | 'info', string] | null;
const faixa = (idade: number | null): Faixa | null => (idade == null ? null : idade < 10 ? 'c' : idade < 20 ? 'a' : idade < 60 ? 'ad' : 'o');
export function norma(chave: string | null, s: Sujeito) {
  const m = chave ? MCK[chave] : null;
  const g = faixa(s.idade);
  if (!m || !g) return null;
  const [media, desvio] = m[g][s.sexo === 'M' ? 0 : 1];
  return { media, desvio, nm: !!m.nm };
}
export interface LSI { v: number; fraco: Lado; forte: Lado }
export function lsi(s: Sujeito, d: number | null | undefined, e: number | null | undefined): LSI | null {
  if (d == null || e == null || d <= 0 || e <= 0) return null;
  if (s.acometido === 'D') return { v: (d / e) * 100, fraco: 'D', forte: 'E' };
  if (s.acometido === 'E') return { v: (e / d) * 100, fraco: 'E', forte: 'D' };
  return d < e ? { v: (d / e) * 100, fraco: 'D', forte: 'E' } : { v: (e / d) * 100, fraco: 'E', forte: 'D' };
}
export const stLSI = (v?: number | null, c: Criterios = CRITERIOS_PADRAO): Status => (v == null ? null : v >= c.lsiAdequado ? ['ok', 'Adequado'] : v >= c.lsiImportante ? ['warn', 'Déficit moderado'] : ['bad', 'Déficit importante']);
// Tabela agrupada por lado: a razão antagonista/agonista ocupa as duas linhas do lado.
export const SLOTS_POR_LADO: Slot[] = ['agD', 'anD', 'agE', 'anE'];
// Simetria por músculo: o lado mais forte vale 100% e o outro, a % dele.
export function simetriaSlot(A: { slots: Partial<Record<Slot, { pico: number }>> }, k: Slot, c: Criterios = CRITERIOS_PADRAO): { v: number; st: Status } | null {
  const g = k.slice(0, 2);
  const d = A.slots[`${g}D` as Slot]?.pico, e = A.slots[`${g}E` as Slot]?.pico, eu = A.slots[k]?.pico;
  if (!d || !e || !eu || d <= 0 || e <= 0) return null;
  const v = (eu / Math.max(d, e)) * 100;
  return { v, st: stLSI(v, c) };
}
export const stDesvio = (d: number | null | undefined, c: Criterios): Status => (d == null ? null : d <= c.razaoTol / 100 ? ['ok', 'Adequada'] : d <= c.razaoLimite / 100 ? ['warn', 'Limítrofe'] : ['bad', 'Desequilíbrio']);
export const stFadiga = (v: number | null | undefined, c: Criterios): Status => (v == null ? null : v <= c.fadBaixa ? ['ok', 'Baixa'] : v <= c.fadAlta ? ['warn', 'Moderada'] : ['bad', 'Alta']);
export const stOsc = (v: number | null | undefined, c: Criterios): Status => (v == null ? null : v <= c.oscEstavel ? ['ok', 'Estável'] : v <= c.oscInstavel ? ['warn', 'Oscilante'] : ['bad', 'Instável']);
export const stZ = (z: number | null | undefined): Status => (z == null ? null : z >= -1 ? ['ok', 'Na norma'] : z >= -2 ? ['warn', 'Abaixo da média'] : ['bad', 'Fraqueza (z < −2)']);

// esperado/minimo: força (N) média e limite inferior do normal (média − 1 DP) para idade e sexo.
export interface SlotAnalise extends Metricas { z: number | null; pctNorma: number | null; precisaBraco: boolean; nkg: number | null; esperado: number | null; minimo: number | null }
export interface Razao { r: number; ref: number | null; refTxt: string; desvio: number | null }
export interface Analise {
  R: Regiao; slots: Partial<Record<Slot, SlotAnalise>>; lsiAg: LSI | null; lsiAn: LSI | null; razoes: Partial<Record<Lado, Razao>>;
  valencias: Record<ValenciaId, Valencia | null>;
}

// Cada valência mostra o pior caso da articulação (o que precisa de atenção).
export type ValenciaId = 'simetria' | 'razao' | 'fadiga' | 'estabilidade';
export interface Valencia { valor: number; texto: string; status: Status; onde: string }
export const VALENCIAS: { id: ValenciaId; nome: string; explica: string }[] = [
  { id: 'simetria', nome: 'Simetria entre lados', explica: 'Força do lado mais fraco em % do mais forte (menor valor entre os grupos).' },
  { id: 'razao', nome: 'Agonista × antagonista', explica: 'Relação entre os músculos opostos; mostra o lado mais distante da referência.' },
  { id: 'fadiga', nome: 'Fadiga', explica: 'Perda de força na contração sustentada (maior valor entre os músculos).' },
  { id: 'estabilidade', nome: 'Estabilidade da curva', explica: 'Oscilação da força no platô (maior valor entre os músculos).' },
];

export function analisar(av: Avaliacao, c: Criterios): Analise {
  const R = REGIOES[av.regiao] || REGIOES.joelho;
  const s = av.sujeito;
  const pk = (k: Slot) => av.slots[k]?.metricas.pico ?? null;
  const slots: Analise['slots'] = {};
  for (const k of SLOTS) {
    const m = av.slots[k]?.metricas;
    if (!m) continue;
    const ref = norma(k.startsWith('ag') ? R.mAg : R.mAn, s);
    let z: number | null = null, pctNorma: number | null = null, precisaBraco = false, esperado: number | null = null, minimo: number | null = null;
    if (ref) {
      let v = m.pico;
      if (ref.nm) { if (av.braco) v = (m.pico * av.braco) / 100; else precisaBraco = true; }
      if (!precisaBraco) {
        z = (v - ref.media) / ref.desvio; pctNorma = (v / ref.media) * 100;
        const fator = ref.nm ? 100 / (av.braco as number) : 1;
        esperado = ref.media * fator; minimo = (ref.media - ref.desvio) * fator;
      }
    }
    slots[k] = { ...m, z, pctNorma, precisaBraco, nkg: s.peso ? m.pico / s.peso : null, esperado, minimo };
  }
  const razoes: Analise['razoes'] = {};
  for (const lado of ['D', 'E'] as Lado[]) {
    const a = pk(`ag${lado}` as Slot), b = pk(`an${lado}` as Slot);
    if (a == null || b == null || a <= 0) continue;
    const r = b / a;
    if (R.modo === 'min') {
      const min = R.min ?? 0.8;
      razoes[lado] = { r, ref: min, refTxt: `≥ ${fmt(min * 100, 0)}%`, desvio: r >= min ? 0 : (min - r) / min };
    } else {
      const x = norma(R.mAn, s), y = norma(R.mAg, s);
      if (x && y) { const ref = x.media / y.media; razoes[lado] = { r, ref, refTxt: `≈ ${fmt(ref * 100, 0)}%`, desvio: Math.abs(r - ref) / ref }; }
      else razoes[lado] = { r, ref: null, refTxt: '', desvio: null };
    }
  }
  const lsiAg = lsi(s, pk('agD'), pk('agE')), lsiAn = lsi(s, pk('anD'), pk('anE'));
  const valencias: Analise['valencias'] = { simetria: null, razao: null, fadiga: null, estabilidade: null };
  const sims = ([[R.ag, lsiAg], [R.an, lsiAn]] as [string, LSI | null][]).filter((x): x is [string, LSI] => x[1] != null);
  if (sims.length) {
    const [nome, L] = sims.reduce((a, b) => (b[1].v < a[1].v ? b : a));
    valencias.simetria = { valor: L.v, texto: `${fmt(L.v, 0)}%`, status: stLSI(L.v, c), onde: `${nome}, lado ${L.fraco === 'D' ? 'direito' : 'esquerdo'} mais fraco` };
  }
  const rzs = (Object.entries(razoes) as [Lado, Razao][]).filter(([, x]) => x.desvio != null);
  if (rzs.length) {
    const [l, x] = rzs.reduce((a, b) => ((b[1].desvio as number) > (a[1].desvio as number) ? b : a));
    valencias.razao = { valor: x.r * 100, texto: `${fmt(x.r * 100, 0)}%`, status: stDesvio(x.desvio, c), onde: `lado ${l === 'D' ? 'direito' : 'esquerdo'}, referência ${x.refTxt}` };
  }
  const pior = (campo: 'fadiga' | 'oscilacao') => {
    const v = SLOTS.filter(k => slots[k]?.[campo] != null).map(k => [k, slots[k]![campo] as number] as const);
    return v.length ? v.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
  };
  const pf = pior('fadiga');
  if (pf) valencias.fadiga = { valor: pf[1], texto: `${fmt(pf[1], 0)}%`, status: stFadiga(pf[1], c), onde: nomeSlot(av.regiao, pf[0]) };
  const po = pior('oscilacao');
  if (po) valencias.estabilidade = { valor: po[1], texto: `${fmt(po[1], 1)}%`, status: stOsc(po[1], c), onde: nomeSlot(av.regiao, po[0]) };
  return { R, slots, lsiAg, lsiAn, razoes, valencias };
}

const ladoNome = (l: Lado) => (l === 'D' ? 'direito' : 'esquerdo');

export function interpretar(av: Avaliacao, A: Analise, c: Criterios, anterior?: { data: string; av: Avaliacao } | null): string[] {
  const R = A.R, out: string[] = [];
  const sim = (nome: string, L: LSI | null) => {
    if (!L) return;
    const q = L.v >= c.lsiAdequado ? `dentro do critério de simetria (≥ ${c.lsiAdequado}%)` : L.v >= c.lsiImportante ? 'déficit moderado' : 'déficit importante';
    out.push(`${nome}: o lado ${ladoNome(L.fraco)} produz ${fmt(L.v, 0)}% da força do lado ${ladoNome(L.forte)}, ${q}.`);
  };
  sim(R.ag, A.lsiAg);
  sim(R.an, A.lsiAn);
  const rr = Object.entries(A.razoes) as [Lado, Razao][];
  if (rr.length) {
    const partes = rr.map(([l, x]) => `${fmt(x.r * 100, 0)}% à ${l === 'D' ? 'direita' : 'esquerda'}`);
    const fora = rr.filter(([, x]) => x.desvio != null && x.desvio > c.razaoTol / 100).map(([l]) => (l === 'D' ? 'direita' : 'esquerda'));
    const ref = rr[0][1].refTxt ? ` (referência ${rr[0][1].refTxt}${R.modo === 'min' ? '' : ' para idade e sexo'})` : '';
    out.push(`Relação ${R.razaoL}: ${partes.join(' e ')}${ref}${fora.length ? `; fora da referência à ${fora.join(' e à ')}` : '; dentro da referência'}.`);
  }
  const fads = SLOTS.filter(k => A.slots[k]?.fadiga != null).map(k => [k, A.slots[k]!.fadiga as number] as const);
  if (fads.length) {
    const w = fads.reduce((a, b) => (b[1] > a[1] ? b : a));
    out.push(`Índice de fadiga: maior perda de força na contração sustentada em ${nomeSlot(av.regiao, w[0])} (${fmt(w[1], 0)}%)${w[1] > c.fadBaixa ? `, acima do limite de ${c.fadBaixa}% definido nos critérios` : ''}.`);
    for (const g of ['ag', 'an'] as const) {
      const a = A.slots[`${g}D`]?.fadiga, b = A.slots[`${g}E`]?.fadiga;
      if (a != null && b != null && Math.abs(a - b) > 10) out.push(`${g === 'ag' ? R.ag : R.an}: a fadiga difere ${fmt(Math.abs(a - b), 0)} pontos entre os lados, maior à ${a > b ? 'direita' : 'esquerda'}; sugere trabalho específico de resistência desse lado.`);
    }
  } else if (SLOTS.some(k => av.slots[k]?.curva)) {
    out.push(`Fadiga não calculada: as contrações duraram menos de ${c.platoMin} s em força alta. Para medir fadiga, peça contração máxima sustentada por 5 a 10 s.`);
  } else {
    out.push('Teste registrado só com os valores de pico: fadiga, taxa de desenvolvimento de força e estabilidade da curva exigem o arquivo com a curva força × tempo.');
  }
  const oscs = SLOTS.filter(k => A.slots[k]?.oscilacao != null).map(k => [k, A.slots[k]!.oscilacao as number] as const);
  if (oscs.length) {
    const w = oscs.reduce((a, b) => (b[1] > a[1] ? b : a));
    if (w[1] > c.oscEstavel) out.push(`Curva menos estável em ${nomeSlot(av.regiao, w[0])} (oscilação de ${fmt(w[1], 1)}% em torno da tendência), o que pode indicar dificuldade de controle motor ou dor durante a contração.`);
  }
  for (const g of ['ag', 'an'] as const) {
    const a = A.slots[`${g}D`]?.rfd200, b = A.slots[`${g}E`]?.rfd200;
    if (a && b) {
      const L = (Math.min(a, b) / Math.max(a, b)) * 100;
      if (L < 80) out.push(`${g === 'ag' ? R.ag : R.an}: a taxa de desenvolvimento de força (0–200 ms) do lado ${a < b ? 'direito' : 'esquerdo'} é ${fmt(L, 0)}% da do outro lado; a capacidade de gerar força rápido está mais comprometida que a força máxima.`);
    }
  }
  const baixos = SLOTS.filter(k => { const z = A.slots[k]?.z; return z != null && z < -2; }).map(k => nomeSlot(av.regiao, k));
  if (baixos.length) out.push(`Força abaixo da norma para idade e sexo (z < −2, McKay 2017) em: ${baixos.join(', ')}.`);
  if (anterior) {
    const mud: string[] = [];
    for (const k of SLOTS) {
      const a = anterior.av.slots[k]?.metricas.pico, b = av.slots[k]?.metricas.pico;
      if (a && b) { const d = ((b - a) / a) * 100; if (Math.abs(d) >= c.mudanca) mud.push(`${nomeSlot(av.regiao, k)} ${d > 0 ? '+' : ''}${fmt(d, 0)}%`); }
    }
    const dt = dataBR(anterior.data);
    out.push(mud.length ? `Desde ${dt}, mudanças acima de ${c.mudanca}%: ${mud.join('; ')}.` : `Desde ${dt}, nenhuma mudança de força ultrapassou ${c.mudanca}%, o limite adotado para mudança real.`);
  }
  return out;
}

export const dataBR = (s: string) => { if (!s) return ''; const [y, m, d] = s.slice(0, 10).split('-'); return `${d}/${m}/${y}`; };

// Frase curta gravada em exames_presenciais.resumo (lida pelos motores de IA).
export function resumoCurtoAnalise(av: Avaliacao, A: Analise, c: Criterios): string {
  const R = A.R, u = c.unidade, d = (N?: number | null) => fmt(N == null ? null : N / UF[u], 1);
  const partes: string[] = [`Dinamometria (${R.l})`];
  const pk = (k: Slot) => av.slots[k]?.metricas.pico;
  if (pk('agD') || pk('agE')) partes.push(`${R.ag} D ${d(pk('agD'))} / E ${d(pk('agE'))} ${u}${A.lsiAg ? ` (simetria ${fmt(A.lsiAg.v, 0)}%)` : ''}`);
  if (pk('anD') || pk('anE')) partes.push(`${R.an} D ${d(pk('anD'))} / E ${d(pk('anE'))} ${u}${A.lsiAn ? ` (simetria ${fmt(A.lsiAn.v, 0)}%)` : ''}`);
  const rz = (Object.entries(A.razoes) as [Lado, Razao][]).map(([l, x]) => `${l} ${fmt(x.r * 100, 0)}%`);
  if (rz.length) partes.push(`${R.razaoL}: ${rz.join(', ')}`);
  const fad = SLOTS.filter(k => A.slots[k]?.fadiga != null).map(k => `${nomeSlot(av.regiao, k)} ${fmt(A.slots[k]!.fadiga, 0)}%`);
  if (fad.length) partes.push(`fadiga: ${fad.join(', ')}`);
  return partes.join('; ');
}

// ───────── Dados simulados (botão "Usar dados de exemplo") ─────────
export function curvaSimulada(picoKgf: number, fadigaPct: number, semente: number, hz = 100, dur = 6) {
  let s = semente;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const t: number[] = [], f: number[] = [];
  const P = picoKgf * G, T0 = 1.0, tau = 0.18;
  for (let i = 0; i < Math.round((dur + 2.6) * hz); i++) {
    const x = i / hz;
    t.push(x);
    let v = 0;
    if (x >= T0 && x < T0 + dur) { const sub = 1 - Math.exp(-(x - T0) / tau); const prog = clamp((x - T0 - 0.6) / (dur - 0.6), 0, 1); v = P * sub * (1 - (fadigaPct / 100) * prog); }
    else if (x >= T0 + dur) { v = P * (1 - fadigaPct / 100) * Math.exp(-(x - T0 - dur) / 0.12); }
    v += (rnd() - 0.5) * P * 0.03 + 3;
    f.push(v);
  }
  return { t, f };
}
