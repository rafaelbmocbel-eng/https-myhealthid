export type MetodoSuavizacao = 'media_movel' | 'savitzky_golay';

export interface OpcoesSuavizacao {
  /** Média móvel ou Savitzky–Golay (padrão). O Savitzky–Golay preserva melhor os picos, que dão a amplitude. */
  metodo?: MetodoSuavizacao;
  /** Grau do polinômio do Savitzky–Golay (padrão 2). */
  ordem?: number;
  /** Série de ângulos que dá a volta em ±180°: desenrola antes de suavizar e volta ao intervalo (−180, 180] depois. */
  circular?: boolean;
}

export type Serie = readonly (number | null | undefined)[];

const valido = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** Janela em amostras para `segundos` de duração: sempre ímpar e pelo menos 3. */
export function janelaEmAmostras(segundos: number, fps: number): number {
  const n = Math.round(segundos * fps);
  const impar = n % 2 === 0 ? n + 1 : n;
  return Math.max(3, impar);
}

/** Resolve A·x = b por eliminação de Gauss com pivô parcial. null se a matriz for singular. */
function resolver(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((linha, i) => [...linha, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

/** Valor em 0 do polinômio de grau `ordem` ajustado por mínimos quadrados aos pares (posição relativa, valor). */
function ajusteLocal(xs: number[], ys: number[], ordem: number): number | null {
  const grau = Math.min(ordem, xs.length - 1);
  if (grau <= 0) return ys.reduce((s, v) => s + v, 0) / ys.length;
  const m = grau + 1;
  const A: number[][] = Array.from({ length: m }, () => new Array<number>(m).fill(0));
  const b = new Array<number>(m).fill(0);
  for (let i = 0; i < xs.length; i++) {
    const pot: number[] = [1];
    for (let k = 1; k < 2 * m; k++) pot.push(pot[k - 1] * xs[i]);
    for (let r = 0; r < m; r++) {
      b[r] += ys[i] * pot[r];
      for (let c = 0; c < m; c++) A[r][c] += pot[r + c];
    }
  }
  const coef = resolver(A, b);
  return coef ? coef[0] : null;
}

const cachePesos = new Map<string, number[]>();

/** Pesos do Savitzky–Golay para uma janela completa de 2h+1 amostras: o ajuste é linear, então vale uma convolução fixa. */
function pesosSG(h: number, ordem: number): number[] {
  const chave = `${h}:${ordem}`;
  const guardado = cachePesos.get(chave);
  if (guardado) return guardado;
  const xs = Array.from({ length: 2 * h + 1 }, (_, k) => k - h);
  const pesos = xs.map((_, j) => ajusteLocal(xs, xs.map((__, k) => (k === j ? 1 : 0)), ordem) ?? (j === h ? 1 : 0));
  cachePesos.set(chave, pesos);
  return pesos;
}

function desenrolar(serie: Serie): (number | null)[] {
  const saida: (number | null)[] = [];
  let anterior: number | null = null;
  let somado = 0;
  for (const v of serie) {
    if (!valido(v)) { saida.push(null); continue; }
    if (anterior !== null) {
      const d = v - anterior;
      if (d > 180) somado -= 360 * Math.round(d / 360);
      else if (d < -180) somado += 360 * Math.round(-d / 360);
    }
    anterior = v;
    saida.push(v + somado);
  }
  return saida;
}

const enrolar = (v: number): number => {
  let x = v % 360;
  if (x > 180) x -= 360;
  if (x <= -180) x += 360;
  return x;
};

/**
 * Suaviza uma série (uma amostra por quadro). `janela` é em amostras (forçada a ímpar). Lacunas (null) são mantidas
 * como null — nada é inventado —, e as amostras válidas vizinhas continuam sendo usadas. Nas pontas a janela é cortada.
 * Nunca altera a série recebida nem a trilha de onde ela veio.
 */
export function suavizar(serie: Serie, janela: number, opcoes: OpcoesSuavizacao = {}): (number | null)[] {
  const base = opcoes.circular ? desenrolar(serie) : Array.from(serie, (v) => (valido(v) ? v : null));
  const w = Math.floor(janela);
  if (!(w >= 3) || base.length < 3) return base.map((v) => (opcoes.circular && v !== null ? enrolar(v) : v));
  const h = Math.floor((w % 2 === 0 ? w + 1 : w) / 2);
  const metodo = opcoes.metodo ?? 'savitzky_golay';
  const ordem = Math.max(0, Math.floor(opcoes.ordem ?? 2));
  const n = base.length;
  const saida: (number | null)[] = new Array(n).fill(null);
  const nulosAte = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) nulosAte[i + 1] = nulosAte[i] + (base[i] === null ? 1 : 0);
  const pesos = metodo === 'savitzky_golay' && ordem > 0 && ordem < 2 * h + 1 ? pesosSG(h, ordem) : null;

  for (let i = 0; i < n; i++) {
    const centro = base[i];
    if (centro === null) continue;
    if (pesos && i - h >= 0 && i + h < n && nulosAte[i + h + 1] - nulosAte[i - h] === 0) {
      let v = 0;
      for (let k = -h; k <= h; k++) v += pesos[k + h] * (base[i + k] as number);
      saida[i] = opcoes.circular ? enrolar(v) : v;
      continue;
    }
    const xs: number[] = [], ys: number[] = [];
    for (let j = Math.max(0, i - h); j <= Math.min(n - 1, i + h); j++) {
      const v = base[j];
      if (v !== null) { xs.push(j - i); ys.push(v); }
    }
    let v: number | null;
    if (metodo === 'media_movel' || ordem === 0) v = ys.reduce((s, y) => s + y, 0) / ys.length;
    else v = ajusteLocal(xs, ys, ordem) ?? centro;
    saida[i] = opcoes.circular ? enrolar(v) : v;
  }
  return saida;
}

/** Preenche lacunas curtas (até `maxLacuna` amostras seguidas) por interpolação linear; lacunas maiores e as pontas ficam null. */
export function preencherLacunas(serie: Serie, maxLacuna: number): (number | null)[] {
  const saida: (number | null)[] = Array.from(serie, (v) => (valido(v) ? v : null));
  const n = saida.length;
  let i = 0;
  while (i < n) {
    if (saida[i] !== null) { i++; continue; }
    let j = i;
    while (j < n && saida[j] === null) j++;
    const antes = i > 0 ? saida[i - 1] : null, depois = j < n ? saida[j] : null;
    if (antes !== null && depois !== null && j - i <= maxLacuna) {
      for (let k = i; k < j; k++) saida[k] = antes + ((depois - antes) * (k - i + 1)) / (j - i + 1);
    }
    i = j;
  }
  return saida;
}

/** Estatísticas das amostras válidas. */
export function estatisticas(valores: Serie): { n: number; media: number | null; dp: number | null; min: number | null; max: number | null } {
  const v = Array.from(valores).filter(valido);
  if (!v.length) return { n: 0, media: null, dp: null, min: null, max: null };
  const media = v.reduce((s, x) => s + x, 0) / v.length;
  const dp = v.length > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - media) ** 2, 0) / (v.length - 1)) : null;
  return { n: v.length, media, dp, min: Math.min(...v), max: Math.max(...v) };
}
