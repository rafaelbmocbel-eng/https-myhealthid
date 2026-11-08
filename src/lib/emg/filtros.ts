/**
 * Filtros IIR para EMG, projetados por código (sem coeficientes copiados) e
 * aplicados em cascata de seções de 2ª ordem (SOS) em Float64.
 *
 * Uma cascata de 6ª ordem em polinômio único (forma direta) é mal condicionada
 * quando fc << fs; por isso o estado vive por seção.
 */

/** Seção biquad com a0 = 1: H(z) = (b0 + b1 z⁻¹ + b2 z⁻²) / (1 + a1 z⁻¹ + a2 z⁻²). */
export interface Secao {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export interface OpcoesFiltroEmg {
  fsHz: number;
  /** Corte do passa-alta (padrão 20 Hz). */
  passaAltaHz?: number;
  /** Ordem do passa-alta, par (padrão 6). */
  ordem?: number;
  /** Frequência da rede elétrica (padrão 60 Hz, como no Brasil). */
  redeHz?: 50 | 60;
  /** Quantos múltiplos da rede (contando a fundamental) recebem notch (padrão 3 → 60/120/180). */
  harmonicos?: number;
  /** Fator de qualidade dos notches (padrão 30). */
  qNotch?: number;
}

const FRACAO_NYQUIST_NOTCH = 0.9;
const Q_NOTCH_PADRAO = 30;
// Quanto o transiente das bordas pode restar no filtfilt (amplitude relativa).
const RESIDUO_BORDA = 1e-4;

function validarFs(fsHz: number): void {
  if (!Number.isFinite(fsHz) || fsHz <= 0) {
    throw new RangeError(`fsHz deve ser finito e > 0 (recebido ${fsHz})`);
  }
}

function validarAbaixoDeNyquist(nome: string, fHz: number, fsHz: number): void {
  validarFs(fsHz);
  if (!(fHz > 0) || !(fHz < fsHz / 2)) {
    throw new RangeError(`${nome} deve estar em (0, fs/2) = (0, ${fsHz / 2}) Hz (recebido ${fHz})`);
  }
}

export function projetarPassaAltaButterworth(ordem: number, fcHz: number, fsHz: number): Secao[] {
  if (!Number.isInteger(ordem) || ordem < 2 || ordem % 2 !== 0) {
    throw new RangeError(`ordem deve ser um inteiro par >= 2 (recebido ${ordem})`);
  }
  validarAbaixoDeNyquist('fcHz', fcHz, fsHz);

  // t = Ωc/(2·fs) com Ωc pré-distorcido; normalizar por K² = (2·fs)² deixa só t na conta.
  const t = Math.tan((Math.PI * fcHz) / fsHz);
  const t2 = t * t;
  const secoes: Secao[] = [];
  for (let k = 1; k <= ordem / 2; k++) {
    // Polos do protótipo passa-baixa: s² + 2·sin(θk)·s + 1; passa-alta troca s por Ωc/s.
    const theta = (Math.PI * (2 * k - 1)) / (2 * ordem);
    const dt = 2 * Math.sin(theta) * t;
    const d0 = 1 + dt + t2;
    secoes.push({
      b0: 1 / d0,
      b1: -2 / d0,
      b2: 1 / d0,
      a1: (2 * (t2 - 1)) / d0,
      a2: (1 - dt + t2) / d0,
    });
  }
  return secoes;
}

export function projetarNotch(f0Hz: number, fsHz: number, q = Q_NOTCH_PADRAO): Secao {
  validarAbaixoDeNyquist('f0Hz', f0Hz, fsHz);
  if (!Number.isFinite(q) || q <= 0) {
    throw new RangeError(`q deve ser finito e > 0 (recebido ${q})`);
  }
  const w0 = (2 * Math.PI * f0Hz) / fsHz;
  const alfa = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const a0 = 1 + alfa;
  // Zeros em e^{±jw0} (sobre o círculo unitário) e soma dos b == soma dos a → ganho 1 em DC.
  return {
    b0: 1 / a0,
    b1: (-2 * cos) / a0,
    b2: 1 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alfa) / a0,
  };
}

export function projetarFiltroEmg(opcoes: OpcoesFiltroEmg): Secao[] {
  const {
    fsHz,
    passaAltaHz = 20,
    ordem = 6,
    redeHz = 60,
    harmonicos = 3,
    qNotch = Q_NOTCH_PADRAO,
  } = opcoes;
  if (redeHz !== 50 && redeHz !== 60) {
    throw new RangeError(`redeHz deve ser 50 ou 60 (recebido ${redeHz})`);
  }
  if (!Number.isInteger(harmonicos) || harmonicos < 0) {
    throw new RangeError(`harmonicos deve ser um inteiro >= 0 (recebido ${harmonicos})`);
  }

  const secoes = projetarPassaAltaButterworth(ordem, passaAltaHz, fsHz);
  const limite = FRACAO_NYQUIST_NOTCH * (fsHz / 2);
  for (let k = 1; k <= harmonicos; k++) {
    const f = k * redeHz;
    // Notch colado ao Nyquist fica distorcido pela transformada bilinear.
    if (f >= limite) break;
    secoes.push(projetarNotch(f, fsHz, qNotch));
  }
  return secoes;
}

const COEF_POR_SECAO = 5;
const ESTADO_POR_SECAO = 2;

export class FiltroIIR {
  private readonly nSecoes: number;
  private readonly coef: Float64Array;
  private readonly estado: Float64Array;

  constructor(secoes: Secao[]) {
    this.nSecoes = secoes.length;
    this.coef = new Float64Array(this.nSecoes * COEF_POR_SECAO);
    this.estado = new Float64Array(this.nSecoes * ESTADO_POR_SECAO);
    secoes.forEach((s, i) => {
      const valores = [s.b0, s.b1, s.b2, s.a1, s.a2];
      if (!valores.every(Number.isFinite)) {
        throw new RangeError(`seção ${i} tem coeficiente não finito`);
      }
      this.coef.set(valores, i * COEF_POR_SECAO);
    });
  }

  /**
   * Amostra não finita devolve NaN sem tocar no estado, para um glitch isolado
   * não envenenar o filtro até o próximo `resetar()`.
   */
  processar(x: number): number {
    if (!Number.isFinite(x)) return Number.NaN;
    const { coef, estado } = this;
    let v = x;
    for (let s = 0, c = 0, e = 0; s < this.nSecoes; s++, c += COEF_POR_SECAO, e += ESTADO_POR_SECAO) {
      const y = coef[c] * v + estado[e];
      estado[e] = coef[c + 1] * v - coef[c + 3] * y + estado[e + 1];
      estado[e + 1] = coef[c + 2] * v - coef[c + 4] * y;
      v = y;
    }
    return v;
  }

  processarBloco(x: ArrayLike<number>): Float64Array {
    const saida = new Float64Array(x.length);
    for (let i = 0; i < x.length; i++) {
      saida[i] = this.processar(x[i]);
    }
    return saida;
  }

  resetar(): void {
    this.estado.fill(0);
  }
}

function raioMaximoDosPolos(secoes: Secao[]): number {
  let maximo = 0;
  for (const { a1, a2 } of secoes) {
    const disc = a1 * a1 - 4 * a2;
    let raio: number;
    if (disc < 0) {
      raio = Math.sqrt(a2);
    } else {
      const raiz = Math.sqrt(disc);
      raio = Math.max(Math.abs(-a1 + raiz), Math.abs(-a1 - raiz)) / 2;
    }
    if (raio > maximo || Number.isNaN(raio)) maximo = raio;
  }
  return maximo;
}

function extensaoPadrao(secoes: Secao[]): number {
  const minimo = 3 * (2 * secoes.length + 1);
  const raio = raioMaximoDosPolos(secoes);
  if (!(raio < 1)) return minimo;
  const assentamento = Math.ceil(Math.log(RESIDUO_BORDA) / Math.log(raio));
  return Math.max(minimo, assentamento);
}

/**
 * Fase zero (passa a frente e depois para trás: o ganho vira |H|²). Só para
 * análise offline — não serve para streaming.
 *
 * A extensão ímpar (reflexão em torno do primeiro/último ponto) preserva valor e
 * inclinação nas bordas. O padrão cobre o assentamento do polo mais lento, porque
 * o notch de 60 Hz com Q=30 demora centenas de amostras; fica limitado a n − 1.
 */
export function filtfilt(
  secoes: Secao[],
  x: ArrayLike<number>,
  opcoes: { extensaoAmostras?: number } = {},
): Float64Array {
  const n = x.length;
  const saida = new Float64Array(n);
  if (n === 0) return saida;
  if (secoes.length === 0) {
    for (let i = 0; i < n; i++) saida[i] = x[i];
    return saida;
  }

  const { extensaoAmostras } = opcoes;
  if (extensaoAmostras !== undefined && (!Number.isInteger(extensaoAmostras) || extensaoAmostras < 0)) {
    throw new RangeError(`extensaoAmostras deve ser um inteiro >= 0 (recebido ${extensaoAmostras})`);
  }
  const pad = Math.min(n - 1, extensaoAmostras ?? extensaoPadrao(secoes));

  const total = n + 2 * pad;
  const buf = new Float64Array(total);
  for (let i = 0; i < n; i++) buf[pad + i] = x[i];
  for (let k = 1; k <= pad; k++) {
    buf[pad - k] = 2 * x[0] - x[k];
    buf[pad + n - 1 + k] = 2 * x[n - 1] - x[n - 1 - k];
  }

  const filtro = new FiltroIIR(secoes);
  for (let i = 0; i < total; i++) buf[i] = filtro.processar(buf[i]);
  filtro.resetar();
  for (let i = total - 1; i >= 0; i--) buf[i] = filtro.processar(buf[i]);

  for (let i = 0; i < n; i++) saida[i] = buf[pad + i];
  return saida;
}

function multiplicarPolinomios(p: number[], q: number[]): number[] {
  const r = new Array<number>(p.length + q.length - 1).fill(0);
  for (let i = 0; i < p.length; i++) {
    for (let j = 0; j < q.length; j++) {
      r[i + j] += p[i] * q[j];
    }
  }
  return r;
}

/** Coeficientes em potências crescentes de z⁻¹. Só para comparação/inspeção: não filtre com isto. */
export function secoesParaPolinomio(secoes: Secao[]): { b: number[]; a: number[] } {
  let b = [1];
  let a = [1];
  for (const s of secoes) {
    b = multiplicarPolinomios(b, [s.b0, s.b1, s.b2]);
    a = multiplicarPolinomios(a, [1, s.a1, s.a2]);
  }
  return { b, a };
}

/**
 * `ganhoDb` vale −Infinity quando um zero cai exatamente em `fHz`; `faseRad` fica em [−π, π].
 */
export function respostaEmFrequencia(
  secoes: Secao[],
  fHz: number,
  fsHz: number,
): { ganhoDb: number; faseRad: number } {
  validarFs(fsHz);
  if (!Number.isFinite(fHz)) {
    throw new RangeError(`fHz deve ser finito (recebido ${fHz})`);
  }
  const w = (2 * Math.PI * fHz) / fsHz;
  // e^{-jw} e e^{-2jw}
  const c1 = Math.cos(w);
  const s1 = -Math.sin(w);
  const c2 = Math.cos(2 * w);
  const s2 = -Math.sin(2 * w);

  // Produto das seções (e não do polinômio) para não perder precisão na banda de rejeição.
  let ganhoDb = 0;
  let fase = 0;
  for (const s of secoes) {
    const nr = s.b0 + s.b1 * c1 + s.b2 * c2;
    const ni = s.b1 * s1 + s.b2 * s2;
    const dr = 1 + s.a1 * c1 + s.a2 * c2;
    const di = s.a1 * s1 + s.a2 * s2;
    ganhoDb += 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
    fase += Math.atan2(ni, nr) - Math.atan2(di, dr);
  }
  return { ganhoDb, faseRad: Math.atan2(Math.sin(fase), Math.cos(fase)) };
}
