import { describe, expect, it } from 'vitest';
import {
  FiltroIIR, filtfilt, projetarFiltroEmg, projetarNotch, projetarPassaAltaButterworth,
  respostaEmFrequencia, secoesParaPolinomio,
  type Secao,
} from '../lib/emg/filtros';

// Coeficientes do fabricante (docs/emg-protocolo-runew2.md, seção 4) = scipy.signal.butter(6, 20, 'highpass', fs=fs).
const REF_500 = {
  b: [0.614371537726035, -3.68622922635621, 9.21557306589052, -12.2874307545207, 9.21557306589052, -3.68622922635621, 0.614371537726035],
  a: [1, -5.02943835142161, 10.6070421837797, -11.9993158162167, 7.67547454820020, -2.63105512847395, 0.377452386374089],
};
const REF_1000 = {
  b: [0.784297852893036, -4.70578711735822, 11.7644677933955, -15.6859570578607, 11.7644677933955, -4.70578711735822, 0.784297852893036],
  a: [1, -5.51453512116617, 12.6891130565151, -15.5936352107041, 10.7932966704854, -3.98935940423088, 0.615123122052628],
};

function mulberry32(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ruidoBranco(n: number, sigma: number, semente: number): Float64Array {
  const rnd = mulberry32(semente);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const u1 = 1 - rnd();
    const u2 = rnd();
    x[i] = sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  return x;
}

function senoide(n: number, fHz: number, fsHz: number, amp = 1): Float64Array {
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = amp * Math.sin((2 * Math.PI * fHz * i) / fsHz);
  return x;
}

function somar(...sinais: Float64Array[]): Float64Array {
  const r = new Float64Array(sinais[0].length);
  for (const s of sinais) for (let i = 0; i < r.length; i++) r[i] += s[i];
  return r;
}

function rms(x: ArrayLike<number>, ini = 0, fim = x.length): number {
  let soma = 0;
  for (let i = ini; i < fim; i++) soma += x[i] * x[i];
  return Math.sqrt(soma / (fim - ini));
}

// Amplitude da componente em fHz (correlação com e^{-jwn}); a janela deve ter ciclos inteiros.
function amplitudeEm(x: ArrayLike<number>, fHz: number, fsHz: number, ini: number, fim: number): number {
  let re = 0;
  let im = 0;
  for (let i = ini; i < fim; i++) {
    const w = (2 * Math.PI * fHz * i) / fsHz;
    re += x[i] * Math.cos(w);
    im += x[i] * Math.sin(w);
  }
  return (2 / (fim - ini)) * Math.hypot(re, im);
}

function diferencaMaxima(a: ArrayLike<number>, b: ArrayLike<number>): number {
  expect(a.length).toBe(b.length);
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

// Forma direta I (a do fabricante): y = (Σ b·x − Σ a[1:]·y) / a0.
function lfilterDiretaI(b: number[], a: number[], x: ArrayLike<number>): Float64Array {
  const y = new Float64Array(x.length);
  for (let n = 0; n < x.length; n++) {
    let acc = 0;
    for (let k = 0; k < b.length; k++) if (n - k >= 0) acc += b[k] * x[n - k];
    for (let k = 1; k < a.length; k++) if (n - k >= 0) acc -= a[k] * y[n - k];
    y[n] = acc / a[0];
  }
  return y;
}

// Módulo dos polos de z² + a1·z + a2 = 0 pela fórmula de Bhaskara.
function modulosDosPolos({ a1, a2 }: Secao): number[] {
  const disc = a1 * a1 - 4 * a2;
  if (disc < 0) return [Math.sqrt(a2), Math.sqrt(a2)];
  const r = Math.sqrt(disc);
  return [Math.abs((-a1 + r) / 2), Math.abs((-a1 - r) / 2)];
}

// H(e^{jw}) de um polinômio em z⁻¹ (Horner em aritmética complexa).
function avaliarPolinomio(coef: number[], fHz: number, fsHz: number): { re: number; im: number } {
  const w = (2 * Math.PI * fHz) / fsHz;
  const zr = Math.cos(-w);
  const zi = Math.sin(-w);
  let re = 0;
  let im = 0;
  for (let k = coef.length - 1; k >= 0; k--) {
    const nr = re * zr - im * zi + coef[k];
    const ni = re * zi + im * zr;
    re = nr;
    im = ni;
  }
  return { re, im };
}

function ganhoPolinomioDb(p: { b: number[]; a: number[] }, fHz: number, fsHz: number): { ganhoDb: number; faseRad: number } {
  const n = avaliarPolinomio(p.b, fHz, fsHz);
  const d = avaliarPolinomio(p.a, fHz, fsHz);
  const re = (n.re * d.re + n.im * d.im) / (d.re * d.re + d.im * d.im);
  const im = (n.im * d.re - n.re * d.im) / (d.re * d.re + d.im * d.im);
  return { ganhoDb: 20 * Math.log10(Math.hypot(re, im)), faseRad: Math.atan2(im, re) };
}

// |H|² do passa-alta Butterworth digital (bilinear com pré-distorção): 1 / (1 + (tan(π fc/fs) / tan(π f/fs))^(2N)).
function potenciaButterworthPassaAlta(ordem: number, fcHz: number, fHz: number, fsHz: number): number {
  const razao = Math.tan((Math.PI * fcHz) / fsHz) / Math.tan((Math.PI * fHz) / fsHz);
  return 1 / (1 + Math.pow(razao, 2 * ordem));
}

function indiceDoMaximo(x: ArrayLike<number>): number {
  let melhor = 0;
  for (let i = 1; i < x.length; i++) if (x[i] > x[melhor]) melhor = i;
  return melhor;
}

describe('projetarPassaAltaButterworth', () => {
  const casos = [
    { fs: 500, ref: REF_500 },
    { fs: 1000, ref: REF_1000 },
  ];

  it.each(casos)('reproduz os coeficientes do fabricante (ordem 6, 20 Hz, fs=$fs)', ({ fs, ref }) => {
    const { b, a } = secoesParaPolinomio(projetarPassaAltaButterworth(6, 20, fs));
    expect(b).toHaveLength(7);
    expect(a).toHaveLength(7);
    ref.b.forEach((esperado, i) => {
      expect(Math.abs(b[i] - esperado) / Math.abs(esperado), `b[${i}]`).toBeLessThan(1e-9);
    });
    ref.a.forEach((esperado, i) => {
      expect(Math.abs(a[i] - esperado) / Math.abs(esperado), `a[${i}]`).toBeLessThan(1e-9);
    });
  });

  it.each([2, 4, 6, 8, 10])('devolve ordem/2 seções (ordem %i)', (ordem) => {
    expect(projetarPassaAltaButterworth(ordem, 20, 1000)).toHaveLength(ordem / 2);
  });

  it('numerador é (1 − z⁻¹)^6 escalado: proporção binomial 1, −6, 15, −20, 15, −6, 1', () => {
    const { b } = secoesParaPolinomio(projetarPassaAltaButterworth(6, 20, 500));
    const binomial = [1, -6, 15, -20, 15, -6, 1];
    binomial.forEach((c, i) => expect(b[i] / b[0]).toBeCloseTo(c, 9));
  });

  it('ganho 0 em DC e 1 no Nyquist', () => {
    const secoes = projetarPassaAltaButterworth(6, 20, 500);
    expect(respostaEmFrequencia(secoes, 0, 500).ganhoDb).toBeLessThan(-200);
    expect(respostaEmFrequencia(secoes, 250, 500).ganhoDb).toBeCloseTo(0, 9);
  });

  it.each([2, 4, 6, 8])('ganho em fc é −3,01 dB (ordem %i)', (ordem) => {
    for (const fs of [250, 500, 1000, 2000]) {
      const { ganhoDb } = respostaEmFrequencia(projetarPassaAltaButterworth(ordem, 20, fs), 20, fs);
      expect(ganhoDb).toBeGreaterThan(-3.06);
      expect(ganhoDb).toBeLessThan(-2.96);
    }
  });

  it.each([500, 1000])('ordem 6, 20 Hz, fs=%i: 5 Hz abaixo de −60 dB e 100 Hz perto de 0 dB', (fs) => {
    const secoes = projetarPassaAltaButterworth(6, 20, fs);
    expect(respostaEmFrequencia(secoes, 5, fs).ganhoDb).toBeLessThan(-60);
    expect(Math.abs(respostaEmFrequencia(secoes, 100, fs).ganhoDb)).toBeLessThan(0.01);
  });

  it('segue a curva de Butterworth em forma fechada para várias ordens, fc e fs', () => {
    for (const ordem of [2, 4, 6, 8]) {
      for (const fs of [250, 500, 1000, 2000]) {
        for (const fc of [5, 20, 40]) {
          const secoes = projetarPassaAltaButterworth(ordem, fc, fs);
          for (const mult of [0.5, 0.8, 1, 1.5, 2, 3]) {
            const f = fc * mult;
            if (f >= fs / 2) continue;
            const esperadoDb = 10 * Math.log10(potenciaButterworthPassaAlta(ordem, fc, f, fs));
            const obtidoDb = respostaEmFrequencia(secoes, f, fs).ganhoDb;
            expect(Math.abs(obtidoDb - esperadoDb), `ordem ${ordem} fs ${fs} fc ${fc} f ${f}`).toBeLessThan(1e-6);
          }
        }
      }
    }
  });

  it('ordem mínima (2) funciona e é uma única seção estável', () => {
    const secoes = projetarPassaAltaButterworth(2, 20, 500);
    expect(secoes).toHaveLength(1);
    modulosDosPolos(secoes[0]).forEach((m) => expect(m).toBeLessThan(1));
  });

  it('corte muito baixo ou colado no Nyquist ainda dá coeficientes finitos com ganho −3 dB em fc', () => {
    const baixo = projetarPassaAltaButterworth(6, 0.05, 1000);
    const alto = projetarPassaAltaButterworth(6, 249.5, 500);
    for (const [secoes, fc, fs] of [[baixo, 0.05, 1000], [alto, 249.5, 500]] as const) {
      secoes.forEach((s) => [s.b0, s.b1, s.b2, s.a1, s.a2].forEach((v) => expect(Number.isFinite(v)).toBe(true)));
      expect(respostaEmFrequencia(secoes, fc, fs).ganhoDb).toBeCloseTo(-3.0103, 1);
    }
  });

  it.each([0, 1, 3, 5, 7, -2, 2.5, Number.NaN, Number.POSITIVE_INFINITY])('rejeita ordem %s', (ordem) => {
    expect(() => projetarPassaAltaButterworth(ordem, 20, 500)).toThrow(RangeError);
  });

  it.each([0, -5, 250, 251, 1000, Number.NaN, Number.POSITIVE_INFINITY])('rejeita fc=%s com fs=500', (fc) => {
    expect(() => projetarPassaAltaButterworth(6, fc, 500)).toThrow(RangeError);
  });

  it.each([0, -500, Number.NaN, Number.POSITIVE_INFINITY])('rejeita fs=%s', (fs) => {
    expect(() => projetarPassaAltaButterworth(6, 20, fs)).toThrow(RangeError);
  });
});

describe('projetarNotch', () => {
  it.each([500, 1000])('tem ganho 1 em DC (fs=%i)', (fs) => {
    const n = projetarNotch(60, fs);
    expect(n.b0 + n.b1 + n.b2).toBeCloseTo(1 + n.a1 + n.a2, 12);
    expect(respostaEmFrequencia([n], 0, fs).ganhoDb).toBeCloseTo(0, 9);
  });

  it('tem os zeros sobre o círculo unitário, no ângulo de f0', () => {
    for (const [f0, fs] of [[60, 500], [60, 1000], [120, 1000], [50, 500]] as const) {
      const n = projetarNotch(f0, fs);
      // Zeros complexos conjugados: discriminante negativo e produto das raízes (b2/b0) = módulo² = 1.
      expect(n.b1 * n.b1 - 4 * n.b0 * n.b2).toBeLessThan(0);
      expect(n.b2 / n.b0).toBeCloseTo(1, 12);
      const anguloDoZero = Math.acos(-n.b1 / (2 * n.b0));
      expect((anguloDoZero * fs) / (2 * Math.PI)).toBeCloseTo(f0, 9);
    }
  });

  it.each([500, 1000])('atenua mais de 30 dB em 60 Hz e perde menos de 0,5 dB em 80 Hz (fs=%i)', (fs) => {
    const n = projetarNotch(60, fs);
    expect(respostaEmFrequencia([n], 60, fs).ganhoDb).toBeLessThan(-30);
    const em80 = respostaEmFrequencia([n], 80, fs).ganhoDb;
    expect(em80).toBeLessThan(0);
    expect(em80).toBeGreaterThan(-0.5);
  });

  it('largura de −3 dB ≈ f0/Q: ±f0/(2Q) cai perto de −3 dB e a atenuação cresce rumo a f0', () => {
    const fs = 1000;
    const n = projetarNotch(60, fs, 30);
    for (const f of [59, 61]) {
      const g = respostaEmFrequencia([n], f, fs).ganhoDb;
      expect(g).toBeGreaterThan(-4);
      expect(g).toBeLessThan(-2);
    }
    const g58 = respostaEmFrequencia([n], 58, fs).ganhoDb;
    const g59 = respostaEmFrequencia([n], 59, fs).ganhoDb;
    const g595 = respostaEmFrequencia([n], 59.5, fs).ganhoDb;
    expect(g58).toBeGreaterThan(g59);
    expect(g59).toBeGreaterThan(g595);
  });

  it('Q menor deixa o notch mais largo', () => {
    const fs = 500;
    const largo = respostaEmFrequencia([projetarNotch(60, fs, 5)], 50, fs).ganhoDb;
    const estreito = respostaEmFrequencia([projetarNotch(60, fs, 30)], 50, fs).ganhoDb;
    expect(largo).toBeLessThan(estreito);
    expect(largo).toBeLessThan(-0.5);
  });

  it('o padrão de Q é 30', () => {
    expect(projetarNotch(60, 500)).toEqual(projetarNotch(60, 500, 30));
  });

  it('polos dentro do círculo unitário', () => {
    for (const q of [1, 5, 30, 200]) {
      for (const [f0, fs] of [[60, 500], [60, 1000], [180, 500], [0.5, 1000], [249, 500]] as const) {
        modulosDosPolos(projetarNotch(f0, fs, q)).forEach((m) => expect(m).toBeLessThan(1));
      }
    }
  });

  it.each([0, -60, 250, 300, Number.NaN])('rejeita f0=%s com fs=500', (f0) => {
    expect(() => projetarNotch(f0, 500)).toThrow(RangeError);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejeita q=%s', (q) => {
    expect(() => projetarNotch(60, 500, q)).toThrow(RangeError);
  });

  it.each([0, -500, Number.NaN])('rejeita fs=%s', (fs) => {
    expect(() => projetarNotch(60, fs)).toThrow(RangeError);
  });
});

describe('projetarFiltroEmg', () => {
  it.each([500, 1000])('padrão (fs=%i): passa-alta de 3 seções + notches em 60, 120 e 180 Hz', (fs) => {
    const secoes = projetarFiltroEmg({ fsHz: fs });
    expect(secoes).toHaveLength(6);
    for (const f of [60, 120, 180]) {
      expect(respostaEmFrequencia(secoes, f, fs).ganhoDb, `${f} Hz`).toBeLessThan(-30);
    }
    for (const f of [30, 50, 80, 100, 150, 200]) {
      expect(respostaEmFrequencia(secoes, f, fs).ganhoDb, `${f} Hz`).toBeGreaterThan(-0.5);
    }
    expect(respostaEmFrequencia(secoes, 5, fs).ganhoDb).toBeLessThan(-60);
  });

  it('o passa-alta vem primeiro e é o mesmo projetarPassaAltaButterworth(6, 20, fs)', () => {
    const secoes = projetarFiltroEmg({ fsHz: 500 });
    expect(secoes.slice(0, 3)).toEqual(projetarPassaAltaButterworth(6, 20, 500));
  });

  it('rede de 50 Hz: notches em 50/100/150 e 60 Hz fica livre', () => {
    const secoes = projetarFiltroEmg({ fsHz: 1000, redeHz: 50 });
    expect(secoes).toHaveLength(6);
    for (const f of [50, 100, 150]) {
      expect(respostaEmFrequencia(secoes, f, 1000).ganhoDb, `${f} Hz`).toBeLessThan(-30);
    }
    expect(respostaEmFrequencia(secoes, 60, 1000).ganhoDb).toBeGreaterThan(-0.5);
  });

  it('rede de 60 Hz deixa 50 Hz passar (o comb de 50 Hz do fabricante não é usado)', () => {
    const secoes = projetarFiltroEmg({ fsHz: 500, redeHz: 60 });
    expect(respostaEmFrequencia(secoes, 50, 500).ganhoDb).toBeGreaterThan(-0.5);
  });

  it.each([
    [1000, 6],
    [500, 6],
    [420, 6],
    [380, 5],
    [300, 5],
    [200, 4],
    [100, 3],
  ])('só entram notches abaixo de 0,9 × Nyquist (fs=%i → %i seções)', (fs, esperado) => {
    expect(projetarFiltroEmg({ fsHz: fs })).toHaveLength(esperado);
  });

  it('com fs=300 o notch de 180 Hz não existe, mas 60 e 120 sim', () => {
    const secoes = projetarFiltroEmg({ fsHz: 300 });
    expect(respostaEmFrequencia(secoes, 60, 300).ganhoDb).toBeLessThan(-30);
    expect(respostaEmFrequencia(secoes, 120, 300).ganhoDb).toBeLessThan(-30);
  });

  it('harmonicos controla quantos notches (contando a fundamental)', () => {
    expect(projetarFiltroEmg({ fsHz: 1000, harmonicos: 0 })).toHaveLength(3);
    expect(projetarFiltroEmg({ fsHz: 1000, harmonicos: 1 })).toHaveLength(4);
    expect(projetarFiltroEmg({ fsHz: 1000, harmonicos: 5 })).toHaveLength(8);
    const so60 = projetarFiltroEmg({ fsHz: 1000, harmonicos: 1 });
    expect(respostaEmFrequencia(so60, 60, 1000).ganhoDb).toBeLessThan(-30);
    expect(respostaEmFrequencia(so60, 120, 1000).ganhoDb).toBeGreaterThan(-0.5);
  });

  it('com harmonicos = 0 sobra só o passa-alta', () => {
    expect(projetarFiltroEmg({ fsHz: 500, harmonicos: 0 })).toEqual(projetarPassaAltaButterworth(6, 20, 500));
  });

  it('respeita passaAltaHz e ordem', () => {
    const secoes = projetarFiltroEmg({ fsHz: 1000, passaAltaHz: 10, ordem: 4, harmonicos: 0 });
    expect(secoes).toHaveLength(2);
    expect(respostaEmFrequencia(secoes, 10, 1000).ganhoDb).toBeCloseTo(-3.0103, 1);
  });

  it('qNotch maior deixa o notch mais estreito', () => {
    const largo = projetarFiltroEmg({ fsHz: 500, qNotch: 5, harmonicos: 1 });
    const estreito = projetarFiltroEmg({ fsHz: 500, qNotch: 60, harmonicos: 1 });
    expect(respostaEmFrequencia(largo, 55, 500).ganhoDb).toBeLessThan(respostaEmFrequencia(estreito, 55, 500).ganhoDb);
  });

  it('é estável para várias taxas, ordens e redes', () => {
    for (const fs of [250, 500, 1000, 2000]) {
      for (const ordem of [2, 4, 6, 8]) {
        for (const redeHz of [50, 60] as const) {
          const secoes = projetarFiltroEmg({ fsHz: fs, ordem, redeHz });
          secoes.forEach((s, i) => {
            modulosDosPolos(s).forEach((m) => expect(m, `fs ${fs} ordem ${ordem} seção ${i}`).toBeLessThan(1));
          });
        }
      }
    }
  });

  it.each([55, 0, 100])('rejeita redeHz=%s', (rede) => {
    expect(() => projetarFiltroEmg({ fsHz: 500, redeHz: rede as unknown as 60 })).toThrow(RangeError);
  });

  it.each([-1, 1.5, Number.NaN])('rejeita harmonicos=%s', (h) => {
    expect(() => projetarFiltroEmg({ fsHz: 500, harmonicos: h })).toThrow(RangeError);
  });

  it('propaga os erros de projeto do passa-alta e da taxa', () => {
    expect(() => projetarFiltroEmg({ fsHz: 40 })).toThrow(RangeError);
    expect(() => projetarFiltroEmg({ fsHz: 500, ordem: 5 })).toThrow(RangeError);
    expect(() => projetarFiltroEmg({ fsHz: 500, passaAltaHz: 0 })).toThrow(RangeError);
    expect(() => projetarFiltroEmg({ fsHz: 0 })).toThrow(RangeError);
    expect(() => projetarFiltroEmg({ fsHz: Number.NaN })).toThrow(RangeError);
  });
});

describe('FiltroIIR: exatidão', () => {
  it('seção só com ganho/atraso: resposta ao impulso conhecida', () => {
    const impulso = [1, 0, 0, 0, 0];
    expect(Array.from(new FiltroIIR([{ b0: 1, b1: 2, b2: 3, a1: 0, a2: 0 }]).processarBloco(impulso))).toEqual([1, 2, 3, 0, 0]);
  });

  it('média móvel de 2 pontos', () => {
    const f = new FiltroIIR([{ b0: 0.5, b1: 0.5, b2: 0, a1: 0, a2: 0 }]);
    expect(Array.from(f.processarBloco([1, 2, 3, 4]))).toEqual([0.5, 1.5, 2.5, 3.5]);
  });

  it('realimentação de 1ª ordem: y[n] = x[n] + 0,5·y[n−1]', () => {
    const f = new FiltroIIR([{ b0: 1, b1: 0, b2: 0, a1: -0.5, a2: 0 }]);
    expect(Array.from(f.processarBloco([1, 0, 0, 0]))).toEqual([1, 0.5, 0.25, 0.125]);
  });

  it('realimentação de 2ª ordem: y[n] = y[n−1] − 0,5·y[n−2] + x[n]', () => {
    const f = new FiltroIIR([{ b0: 1, b1: 0, b2: 0, a1: -1, a2: 0.5 }]);
    expect(Array.from(f.processarBloco([1, 0, 0, 0, 0]))).toEqual([1, 1, 0.5, 0, -0.25]);
  });

  it('cascata de duas seções = produto das respostas', () => {
    const f = new FiltroIIR([
      { b0: 1, b1: 0, b2: 0, a1: -0.5, a2: 0 },
      { b0: 0.5, b1: 0.5, b2: 0, a1: 0, a2: 0 },
    ]);
    // 1, 0.5, 0.25, 0.125 passando por média móvel de 2 pontos.
    expect(Array.from(f.processarBloco([1, 0, 0, 0]))).toEqual([0.5, 0.75, 0.375, 0.1875]);
  });

  it.each([
    { fs: 500, ref: REF_500 },
    { fs: 1000, ref: REF_1000 },
  ])('bate com a forma direta I do fabricante, coeficientes de referência (fs=$fs)', ({ fs, ref }) => {
    const x = somar(ruidoBranco(2000, 1, 11), senoide(2000, 35, fs, 2), senoide(2000, 3, fs, 4));
    const esperado = lfilterDiretaI(ref.b, ref.a, x);
    const obtido = new FiltroIIR(projetarPassaAltaButterworth(6, 20, fs)).processarBloco(x);
    // Os 15 dígitos da referência bastam para os coeficientes (1e-9), mas a forma direta de 6ª ordem amplifica
    // esse arredondamento (≈1e-7 em fs=1000, polos perto de z=1) sobre um sinal de amplitude ~5.
    expect(diferencaMaxima(obtido, esperado)).toBeLessThan(1e-6);
  });

  it('cascata EMG completa bate com a forma direta I do polinômio equivalente', () => {
    const secoes = projetarFiltroEmg({ fsHz: 500 });
    const { b, a } = secoesParaPolinomio(secoes);
    const x = somar(ruidoBranco(1500, 1, 5), senoide(1500, 60, 500, 3));
    expect(diferencaMaxima(new FiltroIIR(secoes).processarBloco(x), lfilterDiretaI(b, a, x))).toBeLessThan(1e-6);
  });
});

describe('FiltroIIR: streaming e estado', () => {
  const secoes = projetarFiltroEmg({ fsHz: 500 });
  const entrada = somar(ruidoBranco(1000, 1, 21), senoide(1000, 60, 500, 2));

  it('processarBloco em pedaços de tamanhos diferentes é idêntico a uma chamada só', () => {
    const inteiro = new FiltroIIR(secoes).processarBloco(entrada);
    const f = new FiltroIIR(secoes);
    const tamanhos = [1, 7, 0, 64, 333, 2, 1, 5, 0, 587];
    const saida = new Float64Array(entrada.length);
    let pos = 0;
    for (const t of tamanhos) {
      saida.set(f.processarBloco(entrada.subarray(pos, pos + t)), pos);
      pos += t;
    }
    expect(pos).toBe(entrada.length);
    expect(diferencaMaxima(saida, inteiro)).toBe(0);
  });

  it('amostra a amostra é idêntico ao bloco', () => {
    const bloco = new FiltroIIR(secoes).processarBloco(entrada);
    const f = new FiltroIIR(secoes);
    const unitario = new Float64Array(entrada.length);
    for (let i = 0; i < entrada.length; i++) unitario[i] = f.processar(entrada[i]);
    expect(diferencaMaxima(unitario, bloco)).toBe(0);
  });

  it('resetar volta ao estado inicial', () => {
    const f = new FiltroIIR(secoes);
    const primeira = f.processarBloco(entrada);
    f.resetar();
    expect(diferencaMaxima(f.processarBloco(entrada), primeira)).toBe(0);
  });

  it('sem resetar o estado continua (a segunda passada difere da primeira)', () => {
    const f = new FiltroIIR(secoes);
    const primeira = f.processarBloco(entrada);
    const segunda = f.processarBloco(entrada);
    expect(diferencaMaxima(primeira, segunda)).toBeGreaterThan(1e-3);
  });

  it('instâncias têm estados independentes', () => {
    const a = new FiltroIIR(secoes);
    const b = new FiltroIIR(secoes);
    a.processarBloco(entrada);
    const refe = new FiltroIIR(secoes).processarBloco(entrada);
    expect(diferencaMaxima(b.processarBloco(entrada), refe)).toBe(0);
  });

  it('copia as seções: alterar o vetor depois do construtor não muda o filtro', () => {
    const mutavel = projetarFiltroEmg({ fsHz: 500 });
    const f = new FiltroIIR(mutavel);
    mutavel[0].b0 = 999;
    mutavel.pop();
    const refe = new FiltroIIR(projetarFiltroEmg({ fsHz: 500 })).processarBloco(entrada);
    expect(diferencaMaxima(f.processarBloco(entrada), refe)).toBe(0);
  });

  it('não altera a entrada e aceita Array, Float32Array e Float64Array', () => {
    const original = [0.1, -0.2, 0.3, 0.4, -0.5, 0.6];
    const copia = original.slice();
    const doArray = new FiltroIIR(secoes).processarBloco(original);
    expect(original).toEqual(copia);
    const doF32 = new FiltroIIR(secoes).processarBloco(Float32Array.from(original));
    const doF64 = new FiltroIIR(secoes).processarBloco(Float64Array.from(original));
    expect(doF64).toBeInstanceOf(Float64Array);
    expect(diferencaMaxima(doArray, doF64)).toBe(0);
    expect(diferencaMaxima(doF32, doF64)).toBeLessThan(1e-6);
  });

  it('bloco vazio devolve Float64Array vazio e não mexe no estado', () => {
    const f = new FiltroIIR(secoes);
    const vazio = f.processarBloco([]);
    expect(vazio).toBeInstanceOf(Float64Array);
    expect(vazio).toHaveLength(0);
    expect(diferencaMaxima(f.processarBloco(entrada), new FiltroIIR(secoes).processarBloco(entrada))).toBe(0);
  });

  it('cascata vazia é identidade', () => {
    const f = new FiltroIIR([]);
    expect(Array.from(f.processarBloco([3, -1, 4, 1, -5]))).toEqual([3, -1, 4, 1, -5]);
    expect(f.processar(7)).toBe(7);
  });

  it('amostra não finita devolve NaN sem contaminar o estado', () => {
    const f = new FiltroIIR(secoes);
    const limpo = new FiltroIIR(secoes);
    f.processarBloco(entrada.subarray(0, 100));
    limpo.processarBloco(entrada.subarray(0, 100));
    expect(f.processar(Number.NaN)).toBeNaN();
    expect(f.processar(Number.POSITIVE_INFINITY)).toBeNaN();
    expect(f.processar(Number.NEGATIVE_INFINITY)).toBeNaN();
    const depois = f.processarBloco(entrada.subarray(100, 300));
    expect(diferencaMaxima(depois, limpo.processarBloco(entrada.subarray(100, 300)))).toBe(0);
  });

  it.each([
    ['b0', { b0: Number.NaN, b1: 0, b2: 0, a1: 0, a2: 0 }],
    ['b1', { b0: 1, b1: Number.POSITIVE_INFINITY, b2: 0, a1: 0, a2: 0 }],
    ['b2', { b0: 1, b1: 0, b2: Number.NaN, a1: 0, a2: 0 }],
    ['a1', { b0: 1, b1: 0, b2: 0, a1: Number.NaN, a2: 0 }],
    ['a2', { b0: 1, b1: 0, b2: 0, a1: 0, a2: Number.NEGATIVE_INFINITY }],
  ])('rejeita coeficiente %s não finito', (_nome, secao) => {
    expect(() => new FiltroIIR([secao])).toThrow(RangeError);
  });
});

describe('Filtros sobre sinais', () => {
  it.each([500, 1000])('senoide de 60 Hz + ruído branco sai atenuada mais de 30 dB depois do aquecimento (fs=%i)', (fs) => {
    const n = 8000;
    const entrada = somar(senoide(n, 60, fs, 1), ruidoBranco(n, 0.3, 77));
    const ini = 3000;
    const emEntrada = amplitudeEm(entrada, 60, fs, ini, n);
    expect(emEntrada).toBeGreaterThan(0.9);

    const saida = new FiltroIIR(projetarFiltroEmg({ fsHz: fs })).processarBloco(entrada);
    const atenuacaoDb = 20 * Math.log10(amplitudeEm(saida, 60, fs, ini, n) / emEntrada);
    expect(atenuacaoDb).toBeLessThan(-30);

    const soNotch = new FiltroIIR([projetarNotch(60, fs)]).processarBloco(entrada);
    expect(20 * Math.log10(amplitudeEm(soNotch, 60, fs, ini, n) / emEntrada)).toBeLessThan(-30);
  });

  it('harmônicos de 120 e 180 Hz também saem atenuados', () => {
    const fs = 1000;
    const n = 8000;
    const entrada = somar(senoide(n, 120, fs), senoide(n, 180, fs), ruidoBranco(n, 0.3, 3));
    const saida = new FiltroIIR(projetarFiltroEmg({ fsHz: fs })).processarBloco(entrada);
    for (const f of [120, 180]) {
      const razao = amplitudeEm(saida, f, fs, 3000, n) / amplitudeEm(entrada, f, fs, 3000, n);
      expect(20 * Math.log10(razao), `${f} Hz`).toBeLessThan(-30);
    }
  });

  it('sinal de banda útil (30 Hz e 100 Hz) passa praticamente intacto', () => {
    const fs = 500;
    const n = 6000;
    for (const f of [30, 100]) {
      const saida = new FiltroIIR(projetarFiltroEmg({ fsHz: fs })).processarBloco(senoide(n, f, fs));
      const amp = amplitudeEm(saida, f, fs, 2000, n);
      expect(amp).toBeGreaterThan(0.95);
      expect(amp).toBeLessThan(1.01);
    }
  });

  it('remove a deriva lenta de 1 Hz e preserva o sinal de 80 Hz', () => {
    const fs = 500;
    const n = 3000;
    const entrada = somar(senoide(n, 1, fs, 5), senoide(n, 80, fs, 0.5));
    const saida = new FiltroIIR(projetarFiltroEmg({ fsHz: fs })).processarBloco(entrada);
    // 1000..3000 = 4 ciclos inteiros de 1 Hz.
    expect(amplitudeEm(saida, 1, fs, 1000, n)).toBeLessThan(5 * 1e-3);
    const em80 = amplitudeEm(saida, 80, fs, 1000, n);
    expect(em80).toBeGreaterThan(0.5 * 0.98);
    expect(em80).toBeLessThan(0.5 * 1.01);
  });

  it('remove offset constante e rampa (seis zeros em DC)', () => {
    const fs = 500;
    const filtro = new FiltroIIR(projetarPassaAltaButterworth(6, 20, fs));
    const dc = filtro.processarBloco(new Float64Array(3000).fill(1000));
    expect(Math.max(...Array.from(dc.subarray(1000)).map(Math.abs))).toBeLessThan(1e-6);

    filtro.resetar();
    const rampa = new Float64Array(3000).map((_, i) => 0.01 * i);
    const y = filtro.processarBloco(rampa);
    expect(Math.max(...Array.from(y.subarray(1500)).map(Math.abs))).toBeLessThan(1e-6);
  });

  it.each([500, 1000])('ruído branco: o RMS que sobra é o esperado pela banda removida (fs=%i)', (fs) => {
    const n = 60000;
    const entrada = ruidoBranco(n, 1, 99);
    const saida = new FiltroIIR(projetarFiltroEmg({ fsHz: fs })).processarBloco(entrada);
    const razao = rms(saida, 2000) / rms(entrada, 2000);
    // Perde a fração da banda abaixo de 20 Hz e os notches (≈ 2 + 4 + 6 Hz de largura).
    expect(razao).toBeGreaterThan(0.85);
    expect(razao).toBeLessThan(1.0);
  });

  it('é estável: saída finita e limitada com 1e5 amostras de ruído, taxas e ordens variadas', () => {
    for (const fs of [250, 1000]) {
      for (const ordem of [2, 10]) {
        const secoes = projetarFiltroEmg({ fsHz: fs, ordem });
        secoes.forEach((s) => modulosDosPolos(s).forEach((m) => expect(m).toBeLessThan(1)));
        const y = new FiltroIIR(secoes).processarBloco(ruidoBranco(100000, 1, fs + ordem));
        let maximo = 0;
        let naoFinitas = 0;
        for (let i = 0; i < y.length; i++) {
          if (!Number.isFinite(y[i])) naoFinitas++;
          maximo = Math.max(maximo, Math.abs(y[i]));
        }
        expect(naoFinitas, `fs ${fs} ordem ${ordem}`).toBe(0);
        expect(maximo, `fs ${fs} ordem ${ordem}`).toBeLessThan(15);
      }
    }
  });

  it('entrada nula depois do sinal decai a zero (sem oscilação sustentada)', () => {
    const fs = 500;
    const f = new FiltroIIR(projetarFiltroEmg({ fsHz: fs }));
    f.processarBloco(ruidoBranco(2000, 1, 8));
    const cauda = f.processarBloco(new Float64Array(20000));
    expect(rms(cauda, 15000)).toBeLessThan(1e-9);
  });
});

describe('filtfilt', () => {
  const fs = 500;
  const hp = projetarPassaAltaButterworth(6, 20, fs);
  const emg = projetarFiltroEmg({ fsHz: fs });

  it('fase zero: senoide de 40 Hz sai sem defasagem e com ganho |H|² (Butterworth em forma fechada)', () => {
    const n = 1500;
    const x = senoide(n, 40, fs);
    const y = filtfilt(hp, x);
    const ganho = potenciaButterworthPassaAlta(6, 20, 40, fs);
    for (let i = 600; i < 900; i++) {
      expect(Math.abs(y[i] - ganho * x[i])).toBeLessThan(1e-9);
    }
  });

  it('o filtro causal defasa a mesma senoide, o filtfilt não', () => {
    const n = 1500;
    const x = senoide(n, 40, fs);
    const causal = new FiltroIIR(hp).processarBloco(x);
    const zeroFase = filtfilt(hp, x);
    const similaridade = (y: Float64Array): number => {
      let xy = 0;
      for (let i = 600; i < 900; i++) xy += x[i] * y[i];
      return xy / (rms(x, 600, 900) * rms(y, 600, 900) * 300);
    };
    expect(Math.abs(respostaEmFrequencia(hp, 40, fs).faseRad)).toBeGreaterThan(0.1);
    expect(similaridade(causal)).toBeLessThan(0.99);
    expect(similaridade(zeroFase)).toBeGreaterThan(0.999999);
  });

  it.each([
    ['passa-alta', hp],
    ['cascata EMG', emg],
  ])('pulso simétrico continua simétrico e o pico não se desloca (%s)', (_nome, secoes) => {
    const n = 1001;
    const centro = 500;
    const pulso = new Float64Array(n).map((_, i) => Math.exp(-((i - centro) ** 2) / (2 * 3 * 3)));
    const y = filtfilt(secoes, pulso);
    expect(indiceDoMaximo(y)).toBe(centro);
    for (let k = 1; k <= 100; k++) {
      expect(Math.abs(y[centro + k] - y[centro - k]), `k=${k}`).toBeLessThan(1e-9);
    }
  });

  it('pulso deslocado: o pico acompanha a posição original', () => {
    const n = 1201;
    for (const centro of [300, 700, 900]) {
      const pulso = new Float64Array(n).map((_, i) => Math.exp(-((i - centro) ** 2) / (2 * 3 * 3)));
      expect(indiceDoMaximo(filtfilt(emg, pulso))).toBe(centro);
    }
  });

  it('a extensão das bordas reduz o transiente do início', () => {
    const n = 1500;
    const x = senoide(n, 40, fs);
    const ganho = potenciaButterworthPassaAlta(6, 20, 40, fs);
    const erroInicio = (y: Float64Array): number => {
      let m = 0;
      for (let i = 0; i < 40; i++) m = Math.max(m, Math.abs(y[i] - ganho * x[i]));
      return m;
    };
    const semExtensao = erroInicio(filtfilt(hp, x, { extensaoAmostras: 0 }));
    const comExtensao = erroInicio(filtfilt(hp, x));
    expect(semExtensao).toBeGreaterThan(0.01);
    expect(comExtensao).toBeLessThan(1e-3);
    expect(comExtensao).toBeLessThan(semExtensao / 100);
  });

  it('o mesmo vale no fim do sinal', () => {
    // Com n = 1501 a última amostra é um cruzamento por zero (índice 1500 = 120 ciclos de 40 Hz a 500 Hz),
    // então a reflexão ímpar continua exatamente a senoide.
    const n = 1501;
    const x = senoide(n, 40, fs);
    const ganho = potenciaButterworthPassaAlta(6, 20, 40, fs);
    const y = filtfilt(hp, x);
    let erro = 0;
    for (let i = n - 40; i < n; i++) erro = Math.max(erro, Math.abs(y[i] - ganho * x[i]));
    expect(erro).toBeLessThan(1e-3);
  });

  it('nível constante pelo passa-alta sai ≈ 0 em toda a janela, bordas incluídas', () => {
    const y = filtfilt(hp, new Float64Array(600).fill(5));
    expect(Math.max(...Array.from(y).map(Math.abs))).toBeLessThan(5e-3);
  });

  it('com extensaoAmostras maior que n − 1 ele limita em n − 1 sem falhar', () => {
    const x = ruidoBranco(50, 1, 4);
    const y = filtfilt(hp, x, { extensaoAmostras: 100000 });
    expect(y).toHaveLength(50);
    y.forEach((v) => expect(Number.isFinite(v)).toBe(true));
    expect(diferencaMaxima(y, filtfilt(hp, x, { extensaoAmostras: 49 }))).toBe(0);
  });

  it('vazio devolve Float64Array vazio', () => {
    const y = filtfilt(hp, []);
    expect(y).toBeInstanceOf(Float64Array);
    expect(y).toHaveLength(0);
  });

  it.each([1, 2, 3, 5, 10])('sinal curto (n=%i) mantém o tamanho e fica finito', (n) => {
    const y = filtfilt(emg, ruidoBranco(n, 1, 6));
    expect(y).toHaveLength(n);
    y.forEach((v) => expect(Number.isFinite(v)).toBe(true));
  });

  it('sem seções devolve uma cópia da entrada', () => {
    const x = [1, 2, 3];
    const y = filtfilt([], x);
    expect(Array.from(y)).toEqual([1, 2, 3]);
    expect(y).toBeInstanceOf(Float64Array);
  });

  it('é pura: não altera a entrada, devolve sempre um array novo e repete o resultado', () => {
    const x = ruidoBranco(800, 1, 12);
    const copia = Float64Array.from(x);
    const a = filtfilt(emg, x);
    const b = filtfilt(emg, x);
    expect(diferencaMaxima(x, copia)).toBe(0);
    expect(a).not.toBe(b);
    expect(a).not.toBe(x);
    expect(diferencaMaxima(a, b)).toBe(0);
  });

  it('aceita Array e Float32Array', () => {
    const x = Array.from(ruidoBranco(300, 1, 13), (v) => Math.fround(v));
    const doArray = filtfilt(emg, x);
    const doF32 = filtfilt(emg, Float32Array.from(x));
    expect(diferencaMaxima(doArray, doF32)).toBe(0);
  });

  it('amostra não finita fica NaN apenas nela mesma', () => {
    const x = ruidoBranco(600, 1, 14);
    x[300] = Number.NaN;
    const y = filtfilt(emg, x);
    expect(y[300]).toBeNaN();
    y.forEach((v, i) => {
      if (i !== 300) expect(Number.isFinite(v), `i=${i}`).toBe(true);
    });
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejeita extensaoAmostras=%s', (extensao) => {
    expect(() => filtfilt(hp, [1, 2, 3, 4], { extensaoAmostras: extensao })).toThrow(RangeError);
  });

  it('atenua o ruído de 60 Hz com ganho |H|² (≈ o dobro dos dB do filtro causal)', () => {
    const n = 4000;
    const x = senoide(n, 60, fs);
    const y = filtfilt(emg, x);
    expect(amplitudeEm(y, 60, fs, 1000, 3000) / amplitudeEm(x, 60, fs, 1000, 3000)).toBeLessThan(10 ** (-60 / 20));
  });
});

describe('secoesParaPolinomio', () => {
  it('cascata vazia é o polinômio 1', () => {
    expect(secoesParaPolinomio([])).toEqual({ b: [1], a: [1] });
  });

  it('uma seção devolve os próprios coeficientes, com a0 = 1', () => {
    expect(secoesParaPolinomio([{ b0: 0.2, b1: -0.4, b2: 0.2, a1: -1.1, a2: 0.3 }])).toEqual({
      b: [0.2, -0.4, 0.2],
      a: [1, -1.1, 0.3],
    });
  });

  it('duas seções: convolução feita à mão', () => {
    const { b, a } = secoesParaPolinomio([
      { b0: 1, b1: 2, b2: 3, a1: 0.1, a2: 0.2 },
      { b0: 4, b1: 5, b2: 6, a1: 0.3, a2: 0.4 },
    ]);
    expect(b).toEqual([4, 13, 28, 27, 18]);
    const aEsperado = [1, 0.4, 0.63, 0.1, 0.08];
    expect(a).toHaveLength(5);
    aEsperado.forEach((v, i) => expect(a[i]).toBeCloseTo(v, 12));
  });

  it('tamanho é 2·seções + 1', () => {
    for (const n of [1, 2, 3, 6]) {
      const secoes = projetarFiltroEmg({ fsHz: 1000, ordem: 2 * n, harmonicos: 0 });
      const { b, a } = secoesParaPolinomio(secoes);
      expect(b).toHaveLength(2 * n + 1);
      expect(a).toHaveLength(2 * n + 1);
      expect(a[0]).toBe(1);
    }
  });

  it('não altera as seções recebidas', () => {
    const secoes = projetarFiltroEmg({ fsHz: 500 });
    const copia = JSON.parse(JSON.stringify(secoes)) as Secao[];
    secoesParaPolinomio(secoes);
    expect(secoes).toEqual(copia);
  });
});

describe('respostaEmFrequencia', () => {
  it('cascata vazia: 0 dB e fase 0', () => {
    expect(respostaEmFrequencia([], 50, 500)).toEqual({ ganhoDb: 0, faseRad: 0 });
  });

  it('ganho puro de 2 dá +6,02 dB e fase 0', () => {
    const r = respostaEmFrequencia([{ b0: 2, b1: 0, b2: 0, a1: 0, a2: 0 }], 77, 500);
    expect(r.ganhoDb).toBeCloseTo(6.0206, 4);
    expect(r.faseRad).toBeCloseTo(0, 12);
  });

  it('atraso de uma amostra em fs/8: 0 dB e fase −π/4', () => {
    const r = respostaEmFrequencia([{ b0: 0, b1: 1, b2: 0, a1: 0, a2: 0 }], 125, 1000);
    expect(r.ganhoDb).toBeCloseTo(0, 12);
    expect(r.faseRad).toBeCloseTo(-Math.PI / 4, 12);
  });

  it('fase é enrolada em [−π, π]: atraso de 2 amostras em 0,3·fs vale +0,8π', () => {
    const r = respostaEmFrequencia([{ b0: 0, b1: 0, b2: 1, a1: 0, a2: 0 }], 300, 1000);
    expect(r.faseRad).toBeCloseTo(0.8 * Math.PI, 12);
  });

  it('polo real conhecido: 1/(1 − 0,5·z⁻¹) em DC vale 2 (6,02 dB)', () => {
    const r = respostaEmFrequencia([{ b0: 1, b1: 0, b2: 0, a1: -0.5, a2: 0 }], 0, 500);
    expect(r.ganhoDb).toBeCloseTo(6.0206, 4);
    expect(r.faseRad).toBeCloseTo(0, 12);
  });

  it('é periódica em fs e simétrica em frequência negativa', () => {
    const secoes = projetarFiltroEmg({ fsHz: 500 });
    const a = respostaEmFrequencia(secoes, 37, 500);
    const b = respostaEmFrequencia(secoes, 37 + 500, 500);
    const c = respostaEmFrequencia(secoes, -37, 500);
    expect(b.ganhoDb).toBeCloseTo(a.ganhoDb, 6);
    expect(c.ganhoDb).toBeCloseTo(a.ganhoDb, 9);
    expect(c.faseRad).toBeCloseTo(-a.faseRad, 9);
  });

  it('o produto das seções concorda com a avaliação do polinômio (ganho e fase)', () => {
    // O polinômio de 6ª ordem é mal condicionado perto de z=1 (motivo de usar SOS): só se exige acordo em 1e-3.
    for (const fs of [500, 1000]) {
      const secoes = projetarFiltroEmg({ fsHz: fs });
      const poli = secoesParaPolinomio(secoes);
      for (const f of [15, 20, 25, 30, 45, 55, 58, 62, 70, 100, 110, 150]) {
        const porSecoes = respostaEmFrequencia(secoes, f, fs);
        if (porSecoes.ganhoDb < -40) continue;
        const porPolinomio = ganhoPolinomioDb(poli, f, fs);
        expect(Math.abs(porSecoes.ganhoDb - porPolinomio.ganhoDb), `${f} Hz ganho`).toBeLessThan(1e-3);
        const dFase = Math.atan2(
          Math.sin(porSecoes.faseRad - porPolinomio.faseRad),
          Math.cos(porSecoes.faseRad - porPolinomio.faseRad),
        );
        expect(Math.abs(dFase), `${f} Hz fase`).toBeLessThan(1e-3);
      }
    }
  });

  it('fase do passa-alta é positiva (avanço) na banda de transição e tende a 0 acima', () => {
    const secoes = projetarPassaAltaButterworth(6, 20, 1000);
    expect(respostaEmFrequencia(secoes, 10, 1000).faseRad).toBeGreaterThan(0.5);
    expect(Math.abs(respostaEmFrequencia(secoes, 400, 1000).faseRad)).toBeLessThan(0.1);
  });

  it.each([0, -500, Number.NaN, Number.POSITIVE_INFINITY])('rejeita fs=%s', (fs) => {
    expect(() => respostaEmFrequencia([], 50, fs)).toThrow(RangeError);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])('rejeita f=%s', (f) => {
    expect(() => respostaEmFrequencia([], f, 500)).toThrow(RangeError);
  });
});
