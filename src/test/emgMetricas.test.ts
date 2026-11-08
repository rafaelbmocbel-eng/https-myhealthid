import { describe, expect, it } from 'vitest';
import {
  MIN_AMOSTRAS_SATURACAO,
  cvmDeTentativas,
  detectarContracoes,
  envelopeRms,
  normalizarPorCVM,
  picoEmJanela,
  qualidadeDoSinal,
  rms,
  rmsEmJanelas,
} from '../lib/emg/metricas';

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

// Constante com sinal alternado: RMS = |valor| e média ~0, sem depender de aleatoriedade.
function alternado(n: number, valor: number): Float64Array {
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = i % 2 === 0 ? valor : -valor;
  return x;
}

function trechos(n: number, partes: Array<[ini: number, fim: number, valor: number]>, base = 0): Float64Array {
  const x = new Float64Array(n).fill(base);
  for (const [ini, fim, valor] of partes) x.fill(valor, ini, fim);
  return x;
}

// Referência por definição, janela a janela, sem somas cumulativas.
function rmsDireto(x: ArrayLike<number>, ini: number, fim: number): number {
  let soma = 0;
  for (let i = ini; i < fim; i++) soma += x[i] * x[i];
  return Math.sqrt(soma / (fim - ini));
}

const FS = 1000;

describe('rms', () => {
  it('senoide de amplitude A tem RMS A/raiz(2)', () => {
    for (const [amp, f] of [[1, 60], [3, 50], [250, 100]]) {
      // 1 s a 1 kHz: número inteiro de ciclos para estas frequências.
      expect(Math.abs(rms(senoide(1000, f, FS, amp)) - amp / Math.SQRT2)).toBeLessThan(1e-3);
    }
  });

  it('é 0 para vetor vazio e |c| para constante', () => {
    expect(rms([])).toBe(0);
    expect(rms(new Float64Array(0))).toBe(0);
    expect(rms([-4, -4, -4])).toBeCloseTo(4, 12);
    expect(rms([3])).toBe(3);
  });

  it('aceita number[] e Float64Array', () => {
    expect(rms([3, 4])).toBeCloseTo(Math.sqrt(12.5), 12);
    expect(rms(Float64Array.from([3, 4]))).toBeCloseTo(Math.sqrt(12.5), 12);
  });

  it('amostra não finita não contamina o resultado com NaN', () => {
    const r = rms([2, Number.NaN, 2, 2]);
    expect(Number.isFinite(r)).toBe(true);
    expect(r).toBeCloseTo(Math.sqrt(12 / 4), 12);
  });
});

describe('rmsEmJanelas', () => {
  it('sinal menor que a janela, ou vazio, devolve vetores vazios sem lançar', () => {
    const curto = rmsEmJanelas(new Float64Array(249), FS);
    expect(curto.rms).toHaveLength(0);
    expect(curto.tempoS).toHaveLength(0);
    expect(rmsEmJanelas([], FS).rms).toHaveLength(0);
  });

  it('sinal com exatamente uma janela devolve um ponto', () => {
    const r = rmsEmJanelas(alternado(250, 2), FS);
    expect(r.rms).toHaveLength(1);
    expect(r.rms[0]).toBeCloseTo(2, 12);
  });

  it('conta só janelas completas (250 ms a cada 50 ms em 2 s = 36)', () => {
    const r = rmsEmJanelas(new Float64Array(2000).fill(1), FS);
    expect(r.rms).toHaveLength(36);
    expect(r.tempoS).toHaveLength(36);
    // 2000 - 250 = 1750 amostras de folga / 50 + 1 = 36; com 49 amostras a mais ainda não cabe outra janela.
    expect(rmsEmJanelas(new Float64Array(2049).fill(1), FS).rms).toHaveLength(36);
    expect(rmsEmJanelas(new Float64Array(2050).fill(1), FS).rms).toHaveLength(37);
  });

  it('tempoS avança no passo e fica dentro do sinal, no meio de cada janela', () => {
    const r = rmsEmJanelas(new Float64Array(2000).fill(1), FS);
    for (let i = 1; i < r.tempoS.length; i++) {
      expect(r.tempoS[i] - r.tempoS[i - 1]).toBeCloseTo(0.05, 9);
    }
    // 1ª janela cobre 0..0,25 s: o centro está a 0,125 s, a menos de 1 amostra.
    expect(Math.abs(r.tempoS[0] - 0.125)).toBeLessThanOrEqual(1 / FS);
    expect(Math.abs(r.tempoS[r.tempoS.length - 1] - 1.875)).toBeLessThanOrEqual(1 / FS);
  });

  it('janela de 250 ms com 15 ciclos de 60 Hz dá A/raiz(2) em todas as posições', () => {
    const r = rmsEmJanelas(senoide(2000, 60, FS, 4), FS);
    for (const v of r.rms) expect(Math.abs(v - 4 / Math.SQRT2)).toBeLessThan(1e-3);
  });

  it('degrau 1 -> 3 na amostra 1000 bate com os valores calculados à mão', () => {
    const x = alternado(2000, 1);
    for (let i = 1000; i < 2000; i++) x[i] = i % 2 === 0 ? 3 : -3;
    const r = rmsEmJanelas(x, FS);
    // janela i cobre [50i, 50i+250)
    expect(r.rms[0]).toBeCloseTo(1, 9);
    expect(r.rms[15]).toBeCloseTo(1, 9); // [750, 1000): toda em 1
    expect(r.rms[16]).toBeCloseTo(Math.sqrt((200 * 1 + 50 * 9) / 250), 9); // [800, 1050)
    expect(r.rms[20]).toBeCloseTo(3, 9); // [1000, 1250): toda em 3
    expect(r.rms[35]).toBeCloseTo(3, 9);
  });

  it('janela e passo em ms respeitam a taxa de amostragem', () => {
    // 500 Hz: 100 ms = 50 amostras; passo 20 ms = 10 amostras.
    const r = rmsEmJanelas(new Float64Array(500).fill(2), 500, 100, 20);
    expect(r.rms).toHaveLength(Math.floor((500 - 50) / 10) + 1);
    expect(r.tempoS[1] - r.tempoS[0]).toBeCloseTo(0.02, 9);
  });

  it('lança RangeError para fs, janela ou passo <= 0 ou não finitos, mesmo com sinal vazio', () => {
    const x = new Float64Array(1000);
    expect(() => rmsEmJanelas(x, 0)).toThrow(RangeError);
    expect(() => rmsEmJanelas(x, -500)).toThrow(RangeError);
    expect(() => rmsEmJanelas(x, Number.NaN)).toThrow(RangeError);
    expect(() => rmsEmJanelas(x, FS, 0)).toThrow(RangeError);
    expect(() => rmsEmJanelas(x, FS, -250)).toThrow(RangeError);
    expect(() => rmsEmJanelas(x, FS, 250, 0)).toThrow(RangeError);
    expect(() => rmsEmJanelas(x, FS, 250, -50)).toThrow(RangeError);
    expect(() => rmsEmJanelas(x, FS, Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => rmsEmJanelas([], 0)).toThrow(RangeError);
  });

  it('coincide com o cálculo direto em ruído', () => {
    const x = ruidoBranco(1500, 7, 11);
    const r = rmsEmJanelas(x, FS, 100, 30);
    for (let j = 0; j < r.rms.length; j++) {
      expect(Math.abs(r.rms[j] - rmsDireto(x, j * 30, j * 30 + 100))).toBeLessThan(1e-9);
    }
  });

  it('uma amostra NaN não envenena as janelas seguintes', () => {
    const x = alternado(2000, 1);
    x[100] = Number.NaN;
    const r = rmsEmJanelas(x, FS);
    for (const v of r.rms) expect(Number.isFinite(v)).toBe(true);
    expect(r.rms[r.rms.length - 1]).toBeCloseTo(1, 9);
  });
});

describe('envelopeRms', () => {
  it('tem o mesmo comprimento do sinal e nenhum NaN, inclusive nas bordas', () => {
    for (const n of [0, 1, 7, 250, 1000, 1337]) {
      const env = envelopeRms(ruidoBranco(n, 3, 5), FS);
      expect(env).toHaveLength(n);
      for (const v of env) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('constante em módulo dá o mesmo valor em todo o sinal, bordas incluídas', () => {
    const env = envelopeRms(alternado(600, 5), FS);
    for (const v of env) expect(v).toBeCloseTo(5, 9);
  });

  it('sinal mais curto que a janela dá um envelope constante com o RMS do trecho todo', () => {
    const x = Float64Array.from([1, 2, 3, 4, 5]);
    const env = envelopeRms(x, FS);
    expect(env).toHaveLength(5);
    for (const v of env) expect(v).toBeCloseTo(rmsDireto(x, 0, 5), 12);
  });

  it('janela ímpar centrada coincide com o cálculo direto, com janela truncada nas bordas', () => {
    const x = ruidoBranco(700, 4, 99);
    const W = 101; // 101 ms a 1 kHz: [k-50, k+50]
    const env = envelopeRms(x, FS, W);
    for (let k = 0; k < x.length; k++) {
      const ini = Math.max(0, k - 50);
      const fim = Math.min(x.length, k + 51);
      expect(Math.abs(env[k] - rmsDireto(x, ini, fim))).toBeLessThan(1e-9);
    }
  });

  it('janela de 1 amostra devolve o módulo do sinal', () => {
    const env = envelopeRms([3, -4, 0, 2], FS, 1);
    expect(Array.from(env)).toEqual([3, 4, 0, 2]);
  });

  it('o envelope de uma rajada sobe só perto da rajada', () => {
    const x = trechos(3000, [[1000, 2000, 50]]);
    const env = envelopeRms(x, FS);
    expect(env[500]).toBe(0);
    expect(env[2600]).toBe(0);
    expect(env[1500]).toBeCloseTo(50, 9);
  });

  it('NaN no meio do sinal não gera NaN no envelope', () => {
    const x = alternado(1000, 2);
    x[500] = Number.NaN;
    x[501] = Number.POSITIVE_INFINITY;
    for (const v of envelopeRms(x, FS)) expect(Number.isFinite(v)).toBe(true);
  });

  it('lança RangeError para parâmetros inválidos', () => {
    expect(() => envelopeRms([1, 2, 3], 0)).toThrow(RangeError);
    expect(() => envelopeRms([1, 2, 3], FS, 0)).toThrow(RangeError);
    expect(() => envelopeRms([], FS, -1)).toThrow(RangeError);
  });
});

describe('picoEmJanela', () => {
  it('encontra o platô certo, e não um pico mais curto que a janela', () => {
    // fundo em 1; platô de 1,5 s em 10 (4,0 a 5,5 s); pico de 0,2 s em 20 (8,0 s).
    // Janela de 1 s sobre o pico curto: sqrt(0,2*400 + 0,8*1) ~ 8,99 < 10.
    const x = alternado(10000, 1);
    for (let i = 4000; i < 5500; i++) x[i] = i % 2 === 0 ? 10 : -10;
    for (let i = 8000; i < 8200; i++) x[i] = i % 2 === 0 ? 20 : -20;
    const { valor, inicioS } = picoEmJanela(x, FS);
    expect(valor).toBeCloseTo(10, 6);
    expect(inicioS).toBeGreaterThanOrEqual(4.0 - 1e-9);
    expect(inicioS).toBeLessThanOrEqual(4.5 + 1e-9);
  });

  it('o pico curto vence quando é forte o bastante', () => {
    const x = alternado(10000, 1);
    for (let i = 4000; i < 5500; i++) x[i] = i % 2 === 0 ? 10 : -10;
    for (let i = 8000; i < 8200; i++) x[i] = i % 2 === 0 ? 40 : -40;
    const { valor, inicioS } = picoEmJanela(x, FS);
    // melhor janela de 1 s contém os 200 ms em 40: sqrt(0,2*1600 + 0,8*1) = sqrt(320,8)
    expect(valor).toBeCloseTo(Math.sqrt(320.8), 6);
    expect(inicioS).toBeGreaterThanOrEqual(7.2 - 1e-9);
    expect(inicioS).toBeLessThanOrEqual(8.0 + 1e-9);
  });

  it('janela personalizada em ms', () => {
    const x = trechos(2000, [[500, 600, 8]], 1);
    // janela de 100 ms exatamente sobre o trecho em 8
    const { valor, inicioS } = picoEmJanela(x, FS, 100);
    expect(valor).toBeCloseTo(8, 9);
    expect(inicioS).toBeCloseTo(0.5, 9);
  });

  it('sinal com exatamente uma janela devolve o RMS dele em inicioS 0', () => {
    const x = alternado(1000, 6);
    const { valor, inicioS } = picoEmJanela(x, FS);
    expect(valor).toBeCloseTo(6, 9);
    expect(inicioS).toBe(0);
  });

  it('vazio ou menor que a janela devolve 0 sem lançar', () => {
    expect(picoEmJanela([], FS)).toEqual({ valor: 0, inicioS: 0 });
    expect(picoEmJanela(alternado(999, 5), FS)).toEqual({ valor: 0, inicioS: 0 });
  });

  it('sinal zerado devolve valor 0', () => {
    expect(picoEmJanela(new Float64Array(3000), FS).valor).toBe(0);
  });

  it('lança RangeError para parâmetros inválidos', () => {
    expect(() => picoEmJanela([1], 0)).toThrow(RangeError);
    expect(() => picoEmJanela([1], FS, 0)).toThrow(RangeError);
    expect(() => picoEmJanela([], FS, -5)).toThrow(RangeError);
  });
});

describe('normalizarPorCVM', () => {
  it('dá 50 % quando o valor é metade da CVM, e 100 % quando é igual', () => {
    expect(normalizarPorCVM(40, 80)).toBeCloseTo(50, 12);
    expect(normalizarPorCVM(80, 80)).toBeCloseTo(100, 12);
    expect(normalizarPorCVM(0, 80)).toBe(0);
  });

  it('não limita em 100 %', () => {
    expect(normalizarPorCVM(120, 80)).toBeCloseTo(150, 12);
  });

  it('devolve null se a CVM é <= 0 ou não finita', () => {
    expect(normalizarPorCVM(10, 0)).toBeNull();
    expect(normalizarPorCVM(10, -5)).toBeNull();
    expect(normalizarPorCVM(10, Number.NaN)).toBeNull();
    expect(normalizarPorCVM(10, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('devolve null se o valor não é finito', () => {
    expect(normalizarPorCVM(Number.NaN, 80)).toBeNull();
    expect(normalizarPorCVM(Number.POSITIVE_INFINITY, 80)).toBeNull();
  });
});

describe('cvmDeTentativas', () => {
  const tentativa = (amp: number) => {
    // 3 s: 1 s de fundo, 1,2 s em amp, 0,8 s de fundo
    const x = alternado(3000, 1);
    for (let i = 1000; i < 2200; i++) x[i] = i % 2 === 0 ? amp : -amp;
    return x;
  };

  it('a CVM é a maior das tentativas e porTentativa mantém a ordem', () => {
    const r = cvmDeTentativas([tentativa(20), tentativa(50), tentativa(35)], FS);
    expect(r.porTentativa).toHaveLength(3);
    expect(r.porTentativa[0]).toBeCloseTo(20, 6);
    expect(r.porTentativa[1]).toBeCloseTo(50, 6);
    expect(r.porTentativa[2]).toBeCloseTo(35, 6);
    expect(r.cvm).toBeCloseTo(50, 6);
    expect(r.cvm).toBe(Math.max(...r.porTentativa));
  });

  it('com uma tentativa só, a CVM é o pico dela', () => {
    const r = cvmDeTentativas([tentativa(12)], FS);
    expect(r.cvm).toBeCloseTo(12, 6);
    expect(r.porTentativa).toHaveLength(1);
  });

  it('sem tentativas, a CVM é 0', () => {
    expect(cvmDeTentativas([], FS)).toEqual({ cvm: 0, porTentativa: [] });
  });

  it('tentativa curta demais conta 0 e não vira a CVM', () => {
    const r = cvmDeTentativas([alternado(500, 900), tentativa(30)], FS);
    expect(r.porTentativa[0]).toBe(0);
    expect(r.cvm).toBeCloseTo(30, 6);
  });

  it('se todas são curtas, a CVM é 0 e a normalização devolve null', () => {
    const r = cvmDeTentativas([alternado(500, 900), []], FS);
    expect(r.cvm).toBe(0);
    expect(normalizarPorCVM(10, r.cvm)).toBeNull();
  });

  it('integra com a normalização: metade do pico dá 50 %', () => {
    const { cvm } = cvmDeTentativas([tentativa(60)], FS);
    expect(normalizarPorCVM(30, cvm)).toBeCloseTo(50, 5);
  });

  it('janela em ms é repassada', () => {
    const x = trechos(2000, [[500, 600, 8]], 1);
    expect(cvmDeTentativas([x], FS, 100).cvm).toBeCloseTo(8, 9);
  });

  it('lança RangeError para parâmetros inválidos, mesmo sem tentativas', () => {
    expect(() => cvmDeTentativas([], 0)).toThrow(RangeError);
    expect(() => cvmDeTentativas([], FS, 0)).toThrow(RangeError);
    expect(() => cvmDeTentativas([[1, 2]], -1)).toThrow(RangeError);
  });
});

describe('detectarContracoes', () => {
  // Envelope escrito à mão: 1 s de repouso alternando 1,0 e 1,2 (média 1,1; desvio ~0,1 -> limiar ~1,4)
  // e depois valores bem acima ou abaixo disso.
  function envelopeBase(n: number): Float64Array {
    const env = new Float64Array(n).fill(1);
    for (let i = 0; i < n; i += 2) env[i] = 1.2;
    return env;
  }

  it('uma contração de valor constante: início, fim, duração, pico, média e área exatos', () => {
    const env = envelopeBase(4000);
    env.fill(5, 2000, 3000);
    const c = detectarContracoes(env, FS);
    expect(c).toHaveLength(1);
    expect(c[0].inicioS).toBeCloseTo(2.0, 12);
    expect(c[0].fimS).toBeCloseTo(3.0, 12);
    expect(c[0].duracaoS).toBeCloseTo(1.0, 12);
    expect(c[0].picoUv).toBe(5);
    expect(c[0].rmsMedioUv).toBeCloseTo(5, 12);
    expect(c[0].areaUvS).toBeCloseTo(5, 12);
  });

  it('sem nada acima do limiar devolve []', () => {
    expect(detectarContracoes(envelopeBase(4000), FS)).toEqual([]);
  });

  it('segmentos separados por menos de juntarMs viram uma contração; métricas cobrem a lacuna', () => {
    const env = envelopeBase(4000);
    env.fill(4, 2000, 2500);
    env.fill(1, 2500, 2550); // lacuna de 50 ms
    env.fill(6, 2550, 3000);
    const c = detectarContracoes(env, FS);
    expect(c).toHaveLength(1);
    expect(c[0].inicioS).toBeCloseTo(2.0, 12);
    expect(c[0].fimS).toBeCloseTo(3.0, 12);
    expect(c[0].picoUv).toBe(6);
    // (500*4 + 50*1 + 450*6) / 1000
    expect(c[0].rmsMedioUv).toBeCloseTo(4.75, 12);
    expect(c[0].areaUvS).toBeCloseTo(4.75, 12);
  });

  it('lacuna de 150 ms não une; lacuna de exatamente juntarMs também não ("menos de")', () => {
    const duas = envelopeBase(4000);
    duas.fill(5, 2000, 2400);
    duas.fill(5, 2550, 3000);
    expect(detectarContracoes(duas, FS)).toHaveLength(2);

    const limite = envelopeBase(4000);
    limite.fill(5, 2000, 2400);
    limite.fill(5, 2500, 3000); // lacuna de 100 amostras = 100 ms
    expect(detectarContracoes(limite, FS)).toHaveLength(2);
    expect(detectarContracoes(limite, FS, { juntarMs: 101 })).toHaveLength(1);
  });

  it('juntarMs maior une lacunas maiores', () => {
    const env = envelopeBase(4000);
    env.fill(5, 2000, 2400);
    env.fill(5, 2650, 3000); // lacuna de 250 ms
    expect(detectarContracoes(env, FS)).toHaveLength(2);
    expect(detectarContracoes(env, FS, { juntarMs: 300 })).toHaveLength(1);
  });

  it('rajada curta demais é descartada; a de exatamente duracaoMinMs é mantida', () => {
    const curta = envelopeBase(4000);
    curta.fill(5, 2000, 2050); // 50 ms
    expect(detectarContracoes(curta, FS)).toEqual([]);

    const noLimite = envelopeBase(4000);
    noLimite.fill(5, 2000, 2099); // 99 ms
    expect(detectarContracoes(noLimite, FS)).toEqual([]);
    noLimite.fill(5, 2000, 2100); // 100 ms
    expect(detectarContracoes(noLimite, FS)).toHaveLength(1);
  });

  it('o descarte usa a duração depois da união (dois pedaços curtos próximos somam)', () => {
    const env = envelopeBase(4000);
    env.fill(5, 2000, 2060);
    env.fill(5, 2090, 2150); // lacuna de 30 ms: unidos dão 150 ms
    const c = detectarContracoes(env, FS);
    expect(c).toHaveLength(1);
    expect(c[0].duracaoS).toBeCloseTo(0.15, 12);
  });

  it('duracaoMinMs e k configuráveis', () => {
    const env = envelopeBase(4000);
    env.fill(5, 2000, 2050);
    expect(detectarContracoes(env, FS, { duracaoMinMs: 40 })).toHaveLength(1);

    const baixo = envelopeBase(4000);
    baixo.fill(2, 2000, 2500); // acima do limiar com k=3 (~1,4), abaixo com k enorme
    expect(detectarContracoes(baixo, FS, { k: 3 })).toHaveLength(1);
    expect(detectarContracoes(baixo, FS, { k: 20 })).toEqual([]);
  });

  it('mais de uma contração saem em ordem cronológica', () => {
    const env = envelopeBase(6000);
    env.fill(5, 2000, 2500);
    env.fill(7, 4000, 4800);
    const c = detectarContracoes(env, FS);
    expect(c).toHaveLength(2);
    expect(c[0].inicioS).toBeLessThan(c[1].inicioS);
    expect(c[0].picoUv).toBe(5);
    expect(c[1].picoUv).toBe(7);
    expect(c[1].duracaoS).toBeCloseTo(0.8, 12);
  });

  it('contração que vai até o fim do sinal fecha em n/fs', () => {
    const env = envelopeBase(3000);
    env.fill(5, 2500, 3000);
    const c = detectarContracoes(env, FS);
    expect(c).toHaveLength(1);
    expect(c[0].fimS).toBeCloseTo(3.0, 12);
  });

  it('repouso informado define o limiar mesmo com envelope menor que baselineMs', () => {
    const env = new Float64Array(800).fill(1);
    env.fill(5, 300, 600);
    expect(detectarContracoes(env, FS)).toEqual([]); // 800 ms < 1000 ms de baseline
    const repouso = Float64Array.from({ length: 200 }, (_, i) => (i % 2 === 0 ? 1.2 : 1.0));
    const c = detectarContracoes(env, FS, { repouso });
    expect(c).toHaveLength(1);
    expect(c[0].inicioS).toBeCloseTo(0.3, 12);
    expect(c[0].fimS).toBeCloseTo(0.6, 12);
  });

  it('repouso informado substitui o baseline do começo do envelope', () => {
    // Os primeiros 1000 ms têm uma contração: o limiar derivado dele fica alto demais.
    const env = new Float64Array(3000).fill(1);
    env.fill(30, 200, 800);
    env.fill(10, 2000, 2500);
    const repouso = Float64Array.from({ length: 500 }, (_, i) => (i % 2 === 0 ? 1.2 : 1.0));
    const semRepouso = detectarContracoes(env, FS);
    const comRepouso = detectarContracoes(env, FS, { repouso });
    expect(comRepouso).toHaveLength(2);
    expect(semRepouso.length).toBeLessThan(comRepouso.length);
  });

  it('sem repouso suficiente devolve [] sem lançar', () => {
    expect(detectarContracoes([], FS)).toEqual([]);
    expect(detectarContracoes(new Float64Array(999).fill(5), FS)).toEqual([]); // < baselineMs
    expect(detectarContracoes(envelopeBase(500), FS, { baselineMs: 1000 })).toEqual([]);
    expect(detectarContracoes(envelopeBase(3000), FS, { repouso: [] })).toEqual([]);
    expect(detectarContracoes(envelopeBase(3000), FS, { repouso: [1] })).toEqual([]);
    expect(detectarContracoes([1, 1, 1], FS, { baselineMs: 1 })).toEqual([]); // 1 amostra de baseline
  });

  it('baselineMs menor aceita envelopes mais curtos', () => {
    const env = envelopeBase(800);
    env.fill(5, 400, 700);
    expect(detectarContracoes(env, FS)).toEqual([]);
    expect(detectarContracoes(env, FS, { baselineMs: 300 })).toHaveLength(1);
  });

  it('baseline plano: qualquer valor acima dele conta, e o igual não', () => {
    const env = new Float64Array(3000).fill(2);
    env.fill(2.5, 1500, 1700);
    const c = detectarContracoes(env, FS);
    expect(c).toHaveLength(1);
    expect(c[0].inicioS).toBeCloseTo(1.5, 12);
    expect(detectarContracoes(new Float64Array(3000).fill(2), FS)).toEqual([]);
  });

  it('o limiar usa a taxa de amostragem: 500 Hz, mesmas durações em ms', () => {
    const env = new Float64Array(2000);
    for (let i = 0; i < env.length; i++) env[i] = i % 2 === 0 ? 1.2 : 1;
    env.fill(5, 1000, 1500); // 1,0 s a 1,5 s
    const c = detectarContracoes(env, 500);
    expect(c).toHaveLength(1);
    expect(c[0].inicioS).toBeCloseTo(2.0, 12);
    expect(c[0].duracaoS).toBeCloseTo(1.0, 12);
  });

  it('envelope NaN no meio de uma contração não quebra os números', () => {
    const env = envelopeBase(4000);
    env.fill(5, 2000, 3000);
    env[2500] = Number.NaN;
    const c = detectarContracoes(env, FS);
    expect(c).toHaveLength(1); // 1 ms de NaN é lacuna curta
    expect(Number.isFinite(c[0].rmsMedioUv)).toBe(true);
    expect(c[0].picoUv).toBe(5);
  });

  it('lança RangeError para parâmetros inválidos', () => {
    const env = envelopeBase(2000);
    expect(() => detectarContracoes(env, 0)).toThrow(RangeError);
    expect(() => detectarContracoes(env, -1)).toThrow(RangeError);
    expect(() => detectarContracoes(env, FS, { baselineMs: 0 })).toThrow(RangeError);
    expect(() => detectarContracoes(env, FS, { k: -1 })).toThrow(RangeError);
    expect(() => detectarContracoes(env, FS, { duracaoMinMs: -1 })).toThrow(RangeError);
    expect(() => detectarContracoes(env, FS, { juntarMs: Number.NaN })).toThrow(RangeError);
    expect(() => detectarContracoes([], 0)).toThrow(RangeError);
  });

  describe('com rajada sintética (ruído + rajada), via envelope RMS', () => {
    const JANELA_S = 0.25;
    // O envelope RMS é suave: 1 s de repouso tem poucas amostras independentes, o desvio sai mal estimado
    // e com k = 3 há falsos positivos em ruído puro. Aqui o repouso é mais longo e k maior (parâmetros de pesquisa).
    const OPC = { baselineMs: 2000, k: 6 };

    function sinalComRajadas(rajadas: Array<[iniS: number, fimS: number]>, semente = 1, duracaoS = 8): Float64Array {
      const n = duracaoS * FS;
      const x = ruidoBranco(n, 2, semente);
      for (const [iniS, fimS] of rajadas) {
        const forte = ruidoBranco(n, 60, semente + 100);
        for (let i = Math.round(iniS * FS); i < Math.round(fimS * FS); i++) x[i] += forte[i];
      }
      return x;
    }

    it('detecta início e fim com erro de até 1 janela', () => {
      const env = envelopeRms(sinalComRajadas([[4.0, 5.0]]), FS);
      const c = detectarContracoes(env, FS, OPC);
      expect(c).toHaveLength(1);
      expect(Math.abs(c[0].inicioS - 4.0)).toBeLessThanOrEqual(JANELA_S);
      expect(Math.abs(c[0].fimS - 5.0)).toBeLessThanOrEqual(JANELA_S);
      // O RMS da rajada é ~60 µV: o pico do envelope fica perto disso.
      expect(c[0].picoUv).toBeGreaterThan(45);
      expect(c[0].picoUv).toBeLessThan(80);
    });

    it('rajadas em outras posições e sementes', () => {
      for (const [semente, ini] of [[2, 3.0], [3, 5.2], [4, 6.0]]) {
        const env = envelopeRms(sinalComRajadas([[ini, ini + 1.0]], semente), FS);
        const c = detectarContracoes(env, FS, OPC);
        expect(c).toHaveLength(1);
        expect(Math.abs(c[0].inicioS - ini)).toBeLessThanOrEqual(JANELA_S);
        expect(Math.abs(c[0].fimS - (ini + 1.0))).toBeLessThanOrEqual(JANELA_S);
      }
    });

    it('sem rajada (só ruído) não detecta nada', () => {
      for (const semente of [1, 2, 3, 4, 5, 6, 7, 8]) {
        const env = envelopeRms(ruidoBranco(10000, 2, semente), FS);
        expect(detectarContracoes(env, FS, { baselineMs: 3000, k: 6 })).toEqual([]);
      }
    });

    it('duas rajadas separadas por menos de juntarMs viram uma só', () => {
      // Envelope curto (20 ms): a lacuna de 50 ms no sinal continua existindo no envelope (~30 ms),
      // então é a união por juntarMs (100 ms) que junta as duas.
      const x = sinalComRajadas([[4.0, 4.8], [4.85, 5.6]]);
      const env = envelopeRms(x, FS, 20);
      const c = detectarContracoes(env, FS, OPC);
      expect(c).toHaveLength(1);
      expect(Math.abs(c[0].inicioS - 4.0)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(c[0].fimS - 5.6)).toBeLessThanOrEqual(0.05);
      // Com juntarMs menor que a lacuna do envelope, voltam a ser duas.
      expect(detectarContracoes(env, FS, { ...OPC, juntarMs: 5 })).toHaveLength(2);
    });

    it('duas rajadas bem separadas continuam duas, mesmo com envelope de 250 ms', () => {
      const env = envelopeRms(sinalComRajadas([[3.0, 3.8], [5.5, 6.5]]), FS);
      const c = detectarContracoes(env, FS, OPC);
      expect(c).toHaveLength(2);
      expect(c[0].fimS).toBeLessThan(c[1].inicioS);
    });

    it('rajada curta demais (60 ms) é descartada', () => {
      // Um envelope de 250 ms espalharia 60 ms de rajada por ~300 ms; a checagem usa um envelope de 20 ms.
      const env = envelopeRms(sinalComRajadas([[4.0, 4.06]]), FS, 20);
      expect(detectarContracoes(env, FS, { ...OPC, duracaoMinMs: 150 })).toEqual([]);
      const mantida = detectarContracoes(env, FS, { ...OPC, duracaoMinMs: 20 });
      expect(mantida).toHaveLength(1);
      expect(mantida[0].duracaoS).toBeLessThan(0.15);
    });
  });
});

describe('qualidadeDoSinal', () => {
  it('ruído branco baixo é bom, sem motivos', () => {
    const q = qualidadeDoSinal(ruidoBranco(5000, 2, 21), FS);
    expect(q.nivel).toBe('bom');
    expect(q.motivos).toEqual([]);
    expect(q.linhaPlana).toBe(false);
    expect(q.saturacao).toBe(false);
    expect(q.contaminacaoRede).toBeLessThan(0.02);
    // O menor RMS de janela de 1 s fica um pouco abaixo do sigma verdadeiro (2).
    expect(q.ruidoBasalRms).toBeGreaterThan(1.8);
    expect(q.ruidoBasalRms).toBeLessThanOrEqual(2.05);
  });

  it('o ruído basal é o menor RMS de janela de 1 s: acha o trecho quieto', () => {
    // 2 s a 10 µV (RMS), 2 s a 1 µV, 2 s a 10 µV
    const x = alternado(6000, 10);
    for (let i = 2000; i < 4000; i++) x[i] = i % 2 === 0 ? 1 : -1;
    const q = qualidadeDoSinal(x, FS);
    expect(q.ruidoBasalRms).toBeCloseTo(1, 6);
  });

  it('senoide forte de 60 Hz: contaminação alta, nível ruim, com motivo', () => {
    const x = somar(senoide(5000, 60, FS, 50), ruidoBranco(5000, 2, 3));
    const q = qualidadeDoSinal(x, FS);
    expect(q.contaminacaoRede).toBeGreaterThan(0.9);
    expect(q.nivel).not.toBe('bom');
    expect(q.nivel).toBe('ruim');
    expect(q.motivos.length).toBeGreaterThan(0);
  });

  it('contaminação intermediária (~20 % da potência) dá atenção', () => {
    // seno A=2,12 (potência A²/2 = 2,25) + ruído sigma 3 (potência 9): fração de rede ~ 2,25/11,25 = 0,2
    const x = somar(senoide(5000, 60, FS, 2.12), ruidoBranco(5000, 3, 8));
    const q = qualidadeDoSinal(x, FS);
    expect(q.contaminacaoRede).toBeGreaterThan(0.15);
    expect(q.contaminacaoRede).toBeLessThan(0.26);
    expect(q.nivel).toBe('atencao');
  });

  it('a fração de rede de um seno + ruído bate com a razão de potências esperada', () => {
    // potência do seno 10²/2 = 50; ruído 10² = 100 -> 1/3
    const x = somar(senoide(10000, 60, FS, 10), ruidoBranco(10000, 10, 17));
    const q = qualidadeDoSinal(x, FS);
    expect(Math.abs(q.contaminacaoRede - 1 / 3)).toBeLessThan(0.03);
  });

  it('seno de 50 Hz só conta como rede se redeHz for 50', () => {
    const x = somar(senoide(5000, 50, FS, 40), ruidoBranco(5000, 2, 4));
    expect(qualidadeDoSinal(x, FS, 60).contaminacaoRede).toBeLessThan(0.05);
    expect(qualidadeDoSinal(x, FS, 50).contaminacaoRede).toBeGreaterThan(0.9);
  });

  it('um deslocamento de DC não conta como rede nem altera a fração', () => {
    const base = somar(senoide(5000, 60, FS, 10), ruidoBranco(5000, 10, 17));
    const comDc = base.map((v) => v + 500);
    const a = qualidadeDoSinal(base, FS).contaminacaoRede;
    const b = qualidadeDoSinal(comDc, FS).contaminacaoRede;
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
  });

  it('a fração de rede nunca passa de 1', () => {
    // número não inteiro de ciclos e sem ruído
    const q = qualidadeDoSinal(senoide(2345, 60, FS, 30), FS);
    expect(q.contaminacaoRede).toBeLessThanOrEqual(1);
    expect(q.contaminacaoRede).toBeGreaterThan(0.95);
  });

  it('sinal zerado: linha plana, nível ruim, sem NaN nem divisão por zero', () => {
    const q = qualidadeDoSinal(new Float64Array(3000), FS);
    expect(q.linhaPlana).toBe(true);
    expect(q.saturacao).toBe(false);
    expect(q.nivel).toBe('ruim');
    expect(q.ruidoBasalRms).toBe(0);
    expect(q.contaminacaoRede).toBe(0);
    expect(q.motivos.length).toBeGreaterThan(0);
  });

  it('constante diferente de zero também é linha plana (variância ~0)', () => {
    const q = qualidadeDoSinal(new Float64Array(3000).fill(7), FS);
    expect(q.linhaPlana).toBe(true);
    expect(q.saturacao).toBe(false);
    expect(q.nivel).toBe('ruim');
  });

  it('ruído minúsculo (abaixo de 0,01 µV) ainda é linha plana; 1 µV não', () => {
    expect(qualidadeDoSinal(ruidoBranco(3000, 0.001, 5), FS).linhaPlana).toBe(true);
    expect(qualidadeDoSinal(ruidoBranco(3000, 1, 5), FS).linhaPlana).toBe(false);
  });

  it('seno cortado nos extremos (clipping) é saturação', () => {
    const x = senoide(5000, 80, FS, 100).map((v) => Math.max(-50, Math.min(50, v)));
    const q = qualidadeDoSinal(x, FS);
    expect(q.saturacao).toBe(true);
    expect(q.linhaPlana).toBe(false);
    expect(q.nivel).toBe('ruim');
  });

  it('sinal serrilhado de um extremo ao outro é saturação', () => {
    const q = qualidadeDoSinal(alternado(3000, 800), FS);
    expect(q.saturacao).toBe(true);
    expect(q.linhaPlana).toBe(false);
    expect(q.nivel).toBe('ruim');
  });

  it('corte só do lado positivo também é saturação', () => {
    const x = ruidoBranco(5000, 20, 6).map((v) => Math.min(v, 15));
    expect(qualidadeDoSinal(x, FS).saturacao).toBe(true);
  });

  it('ruído e seno sem clipping não são saturação', () => {
    expect(qualidadeDoSinal(ruidoBranco(5000, 30, 7), FS).saturacao).toBe(false);
    expect(qualidadeDoSinal(somar(senoide(5000, 80, FS, 100), ruidoBranco(5000, 1, 9)), FS).saturacao).toBe(false);
  });

  it('ruído basal alto sem outro problema dá atenção ou ruim', () => {
    const atencao = qualidadeDoSinal(ruidoBranco(5000, 8, 31), FS);
    expect(atencao.nivel).toBe('atencao');
    expect(atencao.motivos.length).toBeGreaterThan(0);
    const ruim = qualidadeDoSinal(ruidoBranco(5000, 40, 32), FS);
    expect(ruim.nivel).toBe('ruim');
  });

  it('amostras não finitas rebaixam o nível sem gerar NaN', () => {
    const x = ruidoBranco(5000, 2, 41);
    x[10] = Number.NaN;
    x[2000] = Number.POSITIVE_INFINITY;
    const q = qualidadeDoSinal(x, FS);
    expect(Number.isFinite(q.ruidoBasalRms)).toBe(true);
    expect(Number.isFinite(q.contaminacaoRede)).toBe(true);
    expect(q.nivel).toBe('atencao');
    expect(q.motivos.some((m) => m.includes('inválida'))).toBe(true);

    const muitos = ruidoBranco(5000, 2, 42);
    for (let i = 0; i < 5000; i += 5) muitos[i] = Number.NaN; // 20 %
    expect(qualidadeDoSinal(muitos, FS).nivel).toBe('ruim');
  });

  it('só amostras inválidas é ruim, sem lançar', () => {
    const q = qualidadeDoSinal([Number.NaN, Number.NaN, Number.NaN], FS);
    expect(q.nivel).toBe('ruim');
    expect(q.motivos.length).toBeGreaterThan(0);
    expect(q.ruidoBasalRms).toBe(0);
  });

  it('entrada vazia não lança e não é "bom"', () => {
    const q = qualidadeDoSinal([], FS);
    expect(q.nivel).toBe('ruim');
    expect(q.ruidoBasalRms).toBe(0);
    expect(q.contaminacaoRede).toBe(0);
    expect(q.motivos.length).toBeGreaterThan(0);
  });

  it('entradas curtas não lançam e não ganham nota "bom" por falta de dados', () => {
    for (const n of [1, 2, 3, 10, 100, 200]) {
      const q = qualidadeDoSinal(ruidoBranco(n, 2, 51), FS);
      expect(['atencao', 'ruim']).toContain(q.nivel);
      expect(Number.isFinite(q.ruidoBasalRms)).toBe(true);
      expect(Number.isFinite(q.contaminacaoRede)).toBe(true);
    }
    // a partir de DURACAO_MIN_ANALISE_S (0,5 s) já dá para avaliar
    expect(qualidadeDoSinal(ruidoBranco(499, 2, 52), FS).nivel).toBe('atencao');
    expect(qualidadeDoSinal(ruidoBranco(500, 2, 52), FS).nivel).toBe('bom');
  });

  it('trecho menor que 1 s usa o trecho todo como janela do ruído basal', () => {
    const x = alternado(600, 3);
    expect(qualidadeDoSinal(x, FS).ruidoBasalRms).toBeCloseTo(3, 9);
  });

  it('taxa de amostragem baixa demais para a rede não lança e não é "bom"', () => {
    const q = qualidadeDoSinal(ruidoBranco(2000, 2, 61), 100);
    expect(q.contaminacaoRede).toBe(0);
    expect(q.nivel).toBe('atencao');
  });

  it('funciona com 500 Hz e com number[]', () => {
    const x = Array.from(somar(senoide(2500, 60, 500, 50), ruidoBranco(2500, 2, 3)));
    const q = qualidadeDoSinal(x, 500);
    expect(q.contaminacaoRede).toBeGreaterThan(0.9);
    expect(q.nivel).toBe('ruim');
  });

  it('lança RangeError para fs ou rede <= 0', () => {
    const x = ruidoBranco(1000, 1, 1);
    expect(() => qualidadeDoSinal(x, 0)).toThrow(RangeError);
    expect(() => qualidadeDoSinal(x, -1000)).toThrow(RangeError);
    expect(() => qualidadeDoSinal(x, Number.NaN)).toThrow(RangeError);
    expect(() => qualidadeDoSinal(x, FS, 0)).toThrow(RangeError);
    expect(() => qualidadeDoSinal(x, FS, -60)).toThrow(RangeError);
    expect(() => qualidadeDoSinal([], 0)).toThrow(RangeError);
  });
});

// O módulo entrega contagens inteiras: cada amostra é um múltiplo de 1/3,1457 µV
// (docs/emg-protocolo-runew2.md, seção 3). Sinal de baixa amplitude repete níveis só por isso.
const DIVISOR_ADC = 3.1457;

function quantizado(x: ArrayLike<number>): Float64Array {
  return Float64Array.from(x, (v) => Math.round(v * DIVISOR_ADC) / DIVISOR_ADC);
}

/** Monta o sinal a partir de quantas amostras há em cada nível (em degraus do conversor). */
function sinalPorNiveis(contagens: Array<[nivel: number, qtd: number]>): Float64Array {
  const total = contagens.reduce((acc, [, qtd]) => acc + qtd, 0);
  const x = new Float64Array(total);
  let pos = 0;
  for (const [nivel, qtd] of contagens) {
    x.fill(nivel / DIVISOR_ADC, pos, pos + qtd);
    pos += qtd;
  }
  return x;
}

function marcadasComSaturacao(gerar: (semente: number) => ArrayLike<number>, sementes = 100): number {
  let marcadas = 0;
  for (let s = 1; s <= sementes; s++) {
    if (qualidadeDoSinal(gerar(s), FS).saturacao) marcadas++;
  }
  return marcadas;
}

describe('qualidadeDoSinal: saturação em sinal quantizado pelo conversor', () => {
  it('repouso muito silencioso (0,3 a 0,5 µV) não é saturação, em qualquer duração', () => {
    for (const n of [250, 500, 1000]) {
      expect(marcadasComSaturacao((s) => quantizado(ruidoBranco(n, 0.3, s)))).toBe(0);
    }
    for (const n of [250, 500, 1000]) {
      expect(marcadasComSaturacao((s) => quantizado(ruidoBranco(n, 0.5, s)))).toBe(0);
    }
  });

  it('ruído de 1 a 2 µV em trechos curtos também não é saturação', () => {
    expect(marcadasComSaturacao((s) => quantizado(ruidoBranco(250, 1, s)))).toBe(0);
    expect(marcadasComSaturacao((s) => quantizado(ruidoBranco(100, 2, s)))).toBe(0);
    expect(marcadasComSaturacao((s) => quantizado(ruidoBranco(100, 3, s)))).toBe(0);
  });

  it('repouso quieto de 1 s quantizado continua "bom", sem motivo de saturação', () => {
    for (let s = 1; s <= 20; s++) {
      const q = qualidadeDoSinal(quantizado(ruidoBranco(1000, 0.3, s)), FS);
      expect(q.saturacao).toBe(false);
      expect(q.nivel).toBe('bom');
      expect(q.motivos.some((m) => m.includes('saturação'))).toBe(false);
    }
  });

  it('corte (clipping) em sinal quantizado continua sendo saturação', () => {
    expect(marcadasComSaturacao((s) => quantizado(ruidoBranco(2000, 20, s).map((v) => Math.min(v, 15))), 30)).toBe(30);
    expect(
      marcadasComSaturacao((s) => quantizado(ruidoBranco(2000, 20, s).map((v) => Math.max(-12, Math.min(12, v)))), 30),
    ).toBe(30);
    // corte a ~0,8 desvio de um ruído de 5 µV: ainda uns 20 degraus de faixa
    expect(marcadasComSaturacao((s) => quantizado(ruidoBranco(1000, 5, s).map((v) => Math.min(v, 4))), 30)).toBe(30);
    const seno = quantizado(senoide(5000, 80, FS, 100).map((v) => Math.max(-50, Math.min(50, v))));
    expect(qualidadeDoSinal(seno, FS).saturacao).toBe(true);
  });

  it('o extremo só é saturação se for um platô: os degraus logo abaixo têm de ser bem menos povoados', () => {
    // Fundo espalhado de -25 a 20 (1 ou 2 amostras por nível) e um nível extremo em 25.
    const espalhado: Array<[number, number]> = [];
    for (let nivel = -25; nivel <= 20; nivel++) espalhado.push([nivel, nivel % 2 === 0 ? 2 : 1]);

    // Platô: 8 amostras em 25 e os níveis 22..24 vazios.
    expect(qualidadeDoSinal(sinalPorNiveis([...espalhado, [25, 8]]), FS).saturacao).toBe(true);

    // Os 3 degraus de baixo (24, 23, 22) com 40 amostras cada: o extremo é só a ponta da cauda.
    const cauda = sinalPorNiveis([...espalhado, [24, 40], [23, 40], [22, 40], [25, 8]]);
    expect(qualidadeDoSinal(cauda, FS).saturacao).toBe(false);

    // Com 3 amostras por degrau abaixo, 8 passa de 2x a média (3): ainda é platô.
    const tres = sinalPorNiveis([...espalhado, [24, 3], [23, 3], [22, 3], [25, 8]]);
    expect(qualidadeDoSinal(tres, FS).saturacao).toBe(true);
    // Com 4 por degrau, 8 não passa de 2x4: não é platô.
    const quatro = sinalPorNiveis([...espalhado, [24, 4], [23, 4], [22, 4], [25, 8]]);
    expect(qualidadeDoSinal(quatro, FS).saturacao).toBe(false);
  });

  it('uma lacuna casual na cauda (extremo 6, degrau de baixo 2, depois 9 e 17) não é platô', () => {
    // 250 amostras de uma cauda irregular, como as que o ruído quantizado produz de vez em quando.
    const niveis: Array<[number, number]> = [
      [-7, 6], [-6, 2], [-5, 9], [-4, 17], [-3, 25], [-2, 33], [-1, 38], [0, 40],
      [1, 30], [2, 20], [3, 14], [4, 8], [5, 4], [6, 2], [7, 1], [8, 1],
    ];
    const x = sinalPorNiveis(niveis);
    expect(x.length).toBe(250);
    // O extremo (6) atinge o mínimo exigido (6 amostras), mas a média abaixo dele é 9,3 por degrau.
    expect(qualidadeDoSinal(x, FS).saturacao).toBe(false);
  });

  it('vale também para o mínimo do sinal', () => {
    const espalhado: Array<[number, number]> = [];
    for (let nivel = -20; nivel <= 25; nivel++) espalhado.push([nivel, nivel % 2 === 0 ? 2 : 1]);
    expect(qualidadeDoSinal(sinalPorNiveis([[-25, 8], ...espalhado]), FS).saturacao).toBe(true);
    const cauda = sinalPorNiveis([[-25, 8], [-24, 40], [-23, 40], [-22, 40], ...espalhado]);
    expect(qualidadeDoSinal(cauda, FS).saturacao).toBe(false);
  });

  it('em trecho curto (100 amostras), o platô precisa de pelo menos MIN_AMOSTRAS_SATURACAO amostras', () => {
    const espalhado: Array<[number, number]> = [];
    for (let nivel = -25; nivel <= 20; nivel++) espalhado.push([nivel, 2]);
    // 92 amostras acima + o platô: total passa de 100, 2 % não chega perto do mínimo.
    const com = (qtdPlato: number) => sinalPorNiveis([...espalhado, [25, qtdPlato]]);
    expect(MIN_AMOSTRAS_SATURACAO).toBeGreaterThan(3);
    expect(qualidadeDoSinal(com(MIN_AMOSTRAS_SATURACAO - 1), FS).saturacao).toBe(false);
    expect(qualidadeDoSinal(com(MIN_AMOSTRAS_SATURACAO), FS).saturacao).toBe(true);
  });

  it('sinal de poucos níveis (faixa de 1 a 2 degraus) não tem extremo a saturar', () => {
    // alterna entre dois níveis vizinhos e entre dois níveis separados por 2 degraus
    expect(qualidadeDoSinal(sinalPorNiveis([[0, 500], [1, 500]]), FS).saturacao).toBe(false);
    const dois = new Float64Array(1000);
    for (let i = 0; i < dois.length; i++) dois[i] = (i % 2 === 0 ? 1 : -1) / DIVISOR_ADC;
    const q = qualidadeDoSinal(dois, FS);
    expect(q.linhaPlana).toBe(false);
    expect(q.saturacao).toBe(false);
    // escada de 5 níveis (4 degraus de faixa)
    expect(qualidadeDoSinal(sinalPorNiveis([[0, 200], [1, 200], [2, 200], [3, 200], [4, 200]]), FS).saturacao).toBe(
      false,
    );
  });

  it('o mesmo serrilhado em amplitude grande continua sendo saturação', () => {
    const grande = new Float64Array(1000);
    for (let i = 0; i < grande.length; i++) grande[i] = i % 2 === 0 ? 30 : -30;
    expect(qualidadeDoSinal(grande, FS).saturacao).toBe(true);
  });
});
