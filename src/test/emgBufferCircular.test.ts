import { describe, expect, it } from 'vitest';
import { BufferCircular } from '../lib/emg/bufferCircular';

function sequencia(de: number, ate: number): number[] {
  const r: number[] = [];
  for (let v = de; v <= ate; v++) r.push(v);
  return r;
}

function mulberry32(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('BufferCircular: construção', () => {
  it('começa vazio', () => {
    const b = new BufferCircular(8);
    expect(b.comprimento).toBe(0);
    expect(b.totalRecebido).toBe(0);
    expect(Array.from(b.ultimas(5))).toEqual([]);
  });

  it.each([0, -1, 2.5, NaN, Infinity, -Infinity])('capacidade inválida %s lança RangeError', (cap) => {
    expect(() => new BufferCircular(cap)).toThrow(RangeError);
  });

  it('aceita capacidade 1', () => {
    const b = new BufferCircular(1);
    b.empurrar([3, 4, 5]);
    expect(Array.from(b.ultimas(10))).toEqual([5]);
    expect(b.comprimento).toBe(1);
    expect(b.totalRecebido).toBe(3);
  });
});

describe('BufferCircular: empurrar e ultimas', () => {
  it('devolve da mais antiga para a mais nova enquanto não enche', () => {
    const b = new BufferCircular(10);
    b.empurrar([1, 2, 3]);
    b.empurrar([4, 5]);
    expect(Array.from(b.ultimas(5))).toEqual([1, 2, 3, 4, 5]);
    expect(Array.from(b.ultimas(2))).toEqual([4, 5]);
    expect(b.comprimento).toBe(5);
    expect(b.totalRecebido).toBe(5);
  });

  it('dá a volta: sobrescreve as mais antigas e mantém a ordem', () => {
    const b = new BufferCircular(5);
    b.empurrar(sequencia(1, 4));
    b.empurrar(sequencia(5, 7));
    expect(Array.from(b.ultimas(5))).toEqual([3, 4, 5, 6, 7]);
    expect(b.comprimento).toBe(5);
    expect(b.totalRecebido).toBe(7);
    b.empurrar([8]);
    expect(Array.from(b.ultimas(3))).toEqual([6, 7, 8]);
  });

  it('exatamente a capacidade de uma vez não perde nada', () => {
    const b = new BufferCircular(4);
    b.empurrar([10, 20, 30, 40]);
    expect(Array.from(b.ultimas(4))).toEqual([10, 20, 30, 40]);
    b.empurrar([50]);
    expect(Array.from(b.ultimas(4))).toEqual([20, 30, 40, 50]);
  });

  it('empurrar mais que a capacidade guarda só o final, mas conta tudo', () => {
    const b = new BufferCircular(4);
    b.empurrar([1, 2]);
    b.empurrar(sequencia(100, 109));
    expect(Array.from(b.ultimas(4))).toEqual([106, 107, 108, 109]);
    expect(b.comprimento).toBe(4);
    expect(b.totalRecebido).toBe(12);
    // E o buffer continua coerente depois do estouro.
    b.empurrar([200, 201]);
    expect(Array.from(b.ultimas(4))).toEqual([108, 109, 200, 201]);
  });

  it('empurrar vazio não muda nada', () => {
    const b = new BufferCircular(3);
    b.empurrar([1, 2]);
    b.empurrar([]);
    b.empurrar(new Float64Array(0));
    expect(Array.from(b.ultimas(3))).toEqual([1, 2]);
    expect(b.totalRecebido).toBe(2);
  });

  it('aceita qualquer ArrayLike (Float32Array, Int16Array, objeto com length)', () => {
    const b = new BufferCircular(6);
    b.empurrar(Float32Array.of(0.5, 1.5));
    b.empurrar(Int16Array.of(-3, 4));
    b.empurrar({ length: 2, 0: 7, 1: 8 });
    expect(Array.from(b.ultimas(6))).toEqual([0.5, 1.5, -3, 4, 7, 8]);
  });

  it('guarda valores não finitos como estão (quem consome decide o que fazer)', () => {
    const b = new BufferCircular(3);
    b.empurrar([1, NaN, Infinity]);
    const u = b.ultimas(3);
    expect(u[0]).toBe(1);
    expect(Number.isNaN(u[1])).toBe(true);
    expect(u[2]).toBe(Infinity);
  });

  it('não guarda referência ao vetor de entrada', () => {
    const b = new BufferCircular(4);
    const entrada = Float64Array.of(1, 2, 3);
    b.empurrar(entrada);
    entrada[0] = 99;
    expect(Array.from(b.ultimas(3))).toEqual([1, 2, 3]);
  });
});

describe('BufferCircular: ultimas(n)', () => {
  it('n maior que o conteúdo devolve só o que há', () => {
    const b = new BufferCircular(10);
    b.empurrar([1, 2, 3]);
    expect(Array.from(b.ultimas(100))).toEqual([1, 2, 3]);
    expect(Array.from(b.ultimas(Infinity))).toEqual([1, 2, 3]);
  });

  it('n maior que a capacidade, com o buffer cheio, devolve a capacidade', () => {
    const b = new BufferCircular(3);
    b.empurrar(sequencia(1, 10));
    expect(Array.from(b.ultimas(50))).toEqual([8, 9, 10]);
  });

  it('n = 0 devolve vazio', () => {
    const b = new BufferCircular(3);
    b.empurrar([1, 2, 3]);
    expect(b.ultimas(0).length).toBe(0);
  });

  it('n fracionário é truncado', () => {
    const b = new BufferCircular(5);
    b.empurrar([1, 2, 3, 4, 5]);
    expect(Array.from(b.ultimas(2.9))).toEqual([4, 5]);
  });

  it('n negativo ou NaN lança RangeError', () => {
    const b = new BufferCircular(3);
    expect(() => b.ultimas(-1)).toThrow(RangeError);
    expect(() => b.ultimas(NaN)).toThrow(RangeError);
  });

  it('devolve uma cópia: mexer nela não altera o buffer', () => {
    const b = new BufferCircular(4);
    b.empurrar([1, 2, 3, 4]);
    const u = b.ultimas(4);
    u.fill(0);
    expect(Array.from(b.ultimas(4))).toEqual([1, 2, 3, 4]);
  });

  it('devolve Float64Array', () => {
    const b = new BufferCircular(2);
    b.empurrar([1, 2]);
    expect(b.ultimas(2)).toBeInstanceOf(Float64Array);
  });
});

describe('BufferCircular: limpar', () => {
  it('esvazia, zera os contadores e volta a funcionar', () => {
    const b = new BufferCircular(4);
    b.empurrar(sequencia(1, 9));
    b.limpar();
    expect(b.comprimento).toBe(0);
    expect(b.totalRecebido).toBe(0);
    expect(b.ultimas(4).length).toBe(0);
    b.empurrar([7, 8]);
    expect(Array.from(b.ultimas(4))).toEqual([7, 8]);
    expect(b.totalRecebido).toBe(2);
  });

  it('limpar num buffer vazio não quebra', () => {
    const b = new BufferCircular(4);
    b.limpar();
    expect(b.comprimento).toBe(0);
  });
});

describe('BufferCircular: comparação com um modelo simples (sementes fixas)', () => {
  it('50 sementes, tamanhos de bloco e capacidades aleatórios', () => {
    for (let semente = 1; semente <= 50; semente++) {
      const rnd = mulberry32(semente);
      const capacidade = 1 + Math.floor(rnd() * 40);
      const b = new BufferCircular(capacidade);
      const modelo: number[] = [];
      let total = 0;
      for (let passo = 0; passo < 30; passo++) {
        const tamanho = Math.floor(rnd() * 60);
        const bloco: number[] = [];
        for (let i = 0; i < tamanho; i++) bloco.push(Math.round(rnd() * 1000) / 10);
        b.empurrar(bloco);
        modelo.push(...bloco);
        total += tamanho;
        const n = Math.floor(rnd() * (capacidade + 10));
        const guardados = modelo.slice(-capacidade);
        // slice(-0) devolveria tudo, então n = 0 tem caso próprio no modelo.
        const referencia = n === 0 ? [] : guardados.slice(-n);
        expect(Array.from(b.ultimas(n))).toEqual(referencia);
        expect(b.comprimento).toBe(guardados.length);
        expect(b.totalRecebido).toBe(total);
      }
    }
  });
});
