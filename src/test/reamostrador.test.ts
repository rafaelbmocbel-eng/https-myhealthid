import { describe, it, expect } from 'vitest';
import { Reamostrador } from '@/lib/reamostrador';

const seno = (freq: number, taxa: number, seg: number, amplitude = 0.5): Float32Array => {
  const n = Math.round(taxa * seg);
  const saida = new Float32Array(n);
  for (let i = 0; i < n; i++) saida[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / taxa);
  return saida;
};

// Amplitude (0 a 1) da componente de `freq` num sinal: transformada de um ponto só (Goertzel).
const amplitudeEm = (amostras: ArrayLike<number>, freq: number, taxa: number, escala = 1): number => {
  const w = (2 * Math.PI * freq) / taxa;
  const coef = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < amostras.length; i++) {
    const s0 = amostras[i] / escala + coef * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const potencia = s1 * s1 + s2 * s2 - coef * s1 * s2;
  return (2 * Math.sqrt(Math.max(0, potencia))) / amostras.length;
};

const emBlocos = (entrada: Float32Array, tamanho: number) => {
  const blocos: Float32Array[] = [];
  for (let i = 0; i < entrada.length; i += tamanho) blocos.push(entrada.slice(i, i + tamanho));
  return blocos;
};

const reduzir = (entrada: Float32Array, taxaEntrada: number, tamanhoBloco = 4096): Int16Array => {
  const r = new Reamostrador(taxaEntrada, 16000);
  const partes = emBlocos(entrada, tamanhoBloco).map((b) => r.processar(b));
  const saida = new Int16Array(partes.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of partes) { saida.set(p, pos); pos += p.length; }
  return saida;
};

// O que o app fazia antes: pegar uma amostra a cada 3, sem filtro.
const decimacaoSimples = (entrada: Float32Array, razao: number): Float32Array => {
  const saida: number[] = [];
  for (let pos = 0; pos < entrada.length; pos += razao) saida.push(entrada[Math.floor(pos)]);
  return Float32Array.from(saida);
};

const miolo = (a: Int16Array) => a.subarray(400, a.length - 400); // sem o início e o fim, onde o filtro ainda não encheu

describe('Reamostrador: 48 kHz e 44,1 kHz para 16 kHz', () => {
  it('a fala (1 kHz e 5 kHz) passa com o volume intacto', () => {
    for (const taxa of [48000, 44100]) {
      for (const freq of [1000, 5000]) {
        const saida = reduzir(seno(freq, taxa, 2), taxa);
        const amp = amplitudeEm(miolo(saida), freq, 16000, 32767);
        expect(amp).toBeGreaterThan(0.5 * 0.94);
        expect(amp).toBeLessThan(0.5 * 1.06);
      }
    }
  });

  it('o que está acima de 8 kHz NÃO dobra para dentro da fala: 12 kHz (que viraria um tom de 4 kHz) some', () => {
    const entrada = seno(12000, 48000, 2);
    const antes = amplitudeEm(decimacaoSimples(entrada, 3), 4000, 16000);
    expect(antes).toBeGreaterThan(0.45); // sem filtro, o tom aparece inteiro em 4 kHz (era o defeito)
    const depois = amplitudeEm(miolo(reduzir(entrada, 48000)), 4000, 16000, 32767);
    expect(depois).toBeLessThan(0.5 * 0.01); // pelo menos 40 dB abaixo
  });

  it('10 kHz (viraria 6 kHz) e, a 44,1 kHz, 14 kHz (viraria 2 kHz) também somem', () => {
    expect(amplitudeEm(miolo(reduzir(seno(10000, 48000, 2), 48000)), 6000, 16000, 32767)).toBeLessThan(0.005);
    expect(amplitudeEm(miolo(reduzir(seno(14000, 44100, 2), 44100)), 2000, 16000, 32767)).toBeLessThan(0.005);
  });

  it('o resultado não depende do tamanho dos blocos que o microfone entrega', () => {
    const entrada = seno(1500, 44100, 3).map((v, i) => v + 0.2 * Math.sin(i * 0.37));
    const referencia = reduzir(entrada, 44100, 4096);
    for (const tamanho of [1000, 333, 8192, 100000]) {
      const outra = reduzir(entrada, 44100, tamanho);
      expect(outra.length).toBe(referencia.length);
      expect(Array.from(outra)).toEqual(Array.from(referencia));
    }
  });

  it('a duração se mantém: 60 s de áudio a 44,1 kHz e a 48 kHz viram 60 s a 16 kHz (sem esticar nem encolher)', () => {
    for (const taxa of [44100, 48000]) {
      const r = new Reamostrador(taxa, 16000);
      let total = 0;
      const bloco = new Float32Array(4096);
      for (let n = 0; n < Math.floor((60 * taxa) / 4096); n++) total += r.processar(bloco).length;
      expect(Math.abs(total - (Math.floor((60 * taxa) / 4096) * 4096 * 16000) / taxa)).toBeLessThanOrEqual(3);
    }
  });

  it('silêncio continua silêncio e um nível constante máximo não estoura nem inverte o sinal', () => {
    expect(Array.from(reduzir(new Float32Array(48000), 48000)).every((v) => v === 0)).toBe(true);
    const cheio = reduzir(new Float32Array(48000).fill(1), 48000);
    const meio = Array.from(miolo(cheio));
    expect(Math.min(...meio)).toBeGreaterThan(32767 * 0.99);
    expect(Math.max(...meio)).toBeLessThanOrEqual(32767);
  });

  it('sinal acima do máximo (2,0, ou o repique do filtro em picos de volume) satura em vez de dar a volta e virar o sinal oposto', () => {
    for (const taxa of [48000, 44100, 16000]) {
      const positivo = Array.from(miolo(reduzir(new Float32Array(taxa).fill(2), taxa)));
      expect(Math.min(...positivo)).toBeGreaterThanOrEqual(32766);
      const negativo = Array.from(miolo(reduzir(new Float32Array(taxa).fill(-2), taxa)));
      expect(Math.max(...negativo)).toBeLessThanOrEqual(-32767);
    }
  });

  it('mesma taxa: passa direto, sem alterar as amostras; taxa menor (8 kHz): dobra o número de amostras', () => {
    const entrada = seno(1000, 16000, 1);
    const igual = reduzir(entrada, 16000);
    expect(igual.length).toBe(entrada.length);
    expect(Array.from(igual.slice(0, 5))).toEqual(Array.from(entrada.slice(0, 5), (v) => Math.trunc(v < 0 ? v * 0x8000 : v * 0x7fff)));
    const subindo = reduzir(seno(500, 8000, 1), 8000);
    expect(Math.abs(subindo.length - 16000)).toBeLessThanOrEqual(2);
  });
});

// A faixa crítica é a de 6 a 9 kHz: abaixo dela a fala tem que passar inteira, acima dela o que dobraria para dentro da fala tem que sumir.
const dobra = (f: number) => {
  const a = f % 16000;
  return a > 8000 ? 16000 - a : a;
};

describe('Reamostrador: resposta em frequência (fixa os parâmetros do filtro)', () => {
  for (const taxa of [48000, 44100]) {
    it(`${taxa} Hz: banda de passagem plana até 5,5 kHz (perda menor que 0,2 dB) e 6,3 kHz perde menos de 1,5 dB`, () => {
      expect(amplitudeEm(miolo(reduzir(seno(5500.3, taxa, 2, 0.8), taxa)), 5500.3, 16000, 32767) / 0.8).toBeGreaterThan(0.977);
      expect(amplitudeEm(miolo(reduzir(seno(6300.3, taxa, 2, 0.8), taxa)), 6300.3, 16000, 32767) / 0.8).toBeGreaterThan(0.84);
    });

    it(`${taxa} Hz: 8,8 kHz (dobra para 7,2 kHz) cai mais de 55 dB e 9 kHz cai mais de 70 dB`, () => {
      expect(amplitudeEm(miolo(reduzir(seno(8800.3, taxa, 2, 0.8), taxa)), dobra(8800.3), 16000, 32767) / 0.8).toBeLessThan(0.0018);
      expect(amplitudeEm(miolo(reduzir(seno(9000.7, taxa, 2, 0.8), taxa)), dobra(9000.7), 16000, 32767) / 0.8).toBeLessThan(0.0004);
    });
  }

  it('22,05 kHz também passa pelo filtro: 10 kHz (dobraria para 6 kHz) some', () => {
    expect(amplitudeEm(miolo(reduzir(seno(10000.3, 22050, 2, 0.8), 22050)), dobra(10000.3), 16000, 32767) / 0.8).toBeLessThan(0.003);
  });

  it('taxa de entrada inválida (zero, negativa, infinita) falha de cara, em vez de estourar depois com "Invalid array length"', () => {
    for (const taxa of [0, -48000, Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(() => new Reamostrador(taxa, 16000)).toThrow(/inválida/);
    }
  });
});

describe('Reamostrador: caminho sem filtro (mesma taxa ou taxa menor)', () => {
  it('11,025 kHz: 60 s em blocos de 4096 continuam 60 s (sem deriva por bloco)', () => {
    expect(Math.abs(reduzir(new Float32Array(11025 * 60), 11025).length - 960000)).toBeLessThanOrEqual(2);
  });

  it('16 kHz: todas as amostras passam iguais, inclusive a última de cada bloco', () => {
    const entrada = seno(1000, 16000, 1, 0.5);
    const esperado = Array.from(entrada, (v) => (v < 0 ? v * 0x8000 : v * 0x7fff) | 0);
    expect(Array.from(reduzir(entrada, 16000))).toEqual(esperado);
  });
});

describe('Reamostrador: ganho em frequência zero', () => {
  it('44,1 kHz: nível constante de 0,5 sai constante (ondulação menor que 0,05%) em todas as fases', () => {
    const saida = miolo(reduzir(new Float32Array(44100).fill(0.5), 44100));
    expect((Math.max(...saida) - Math.min(...saida)) / 16383).toBeLessThan(0.0005);
  });
});

