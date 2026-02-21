import { describe, it, expect } from 'vitest';
import { calcularScoreE, calcularIDFinal } from '../utils/calculations';
import { Bloco6Data } from '../types/identidade';

function makeBloco6(scores: number[]): Bloco6Data {
  return {
    scoreE: 0,
    unidades: scores.map((s, i) => ({
      id: `U${i}`, nome: `U${i}`, score: s, checklist: {}, observacoes: '',
      scoreMuscular: 0, scoreArticular: 0, scoreLigamentar: 0, scoreNervosa: 0, scoreVisceral: 0,
    })),
  };
}

describe('calcularScoreE', () => {
  it('returns 5 when one unit=10, rest=0', () => {
    expect(calcularScoreE(makeBloco6([10, 0, 0, 0, 0, 0, 0, 0]))).toBe(5);
  });
  it('returns 10 when two units=10', () => {
    expect(calcularScoreE(makeBloco6([10, 10, 0, 0, 0, 0, 0, 0]))).toBe(10);
  });
  it('returns 40 when all 8 units=10', () => {
    expect(calcularScoreE(makeBloco6([10, 10, 10, 10, 10, 10, 10, 10]))).toBe(40);
  });
});

describe('calcularIDFinal - Score E contribution', () => {
  it('e=5 with all other scores 0 and R=0 → idFinal=5', () => {
    const result = calcularIDFinal(5, 0, 0, 0, 0, 0);
    expect(result.idFinal).toBe(5);
  });
  it('e=10 with all other scores 0 and R=0 → idFinal=10', () => {
    const result = calcularIDFinal(10, 0, 0, 0, 0, 0);
    expect(result.idFinal).toBe(10);
  });
});
