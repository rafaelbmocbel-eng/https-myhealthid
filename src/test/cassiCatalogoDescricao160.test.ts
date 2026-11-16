import { describe, expect, it } from 'vitest';
import { CODIGOS_CASSI } from '@/lib/cassiGuias';

const DESCRICAO_OFICIAL_160 = 'Atendimento fisioterapêutico ambulatorial ao paciente com disfunção decorrente de alterações do sistema músculo-esquelético';

describe('catálogo de códigos do Pedir guias: o 160', () => {
  it('tem a descrição oficial da CASSI (5.00.00.160), e não "Sessão de psicomotricidade"', () => {
    const c160 = CODIGOS_CASSI.find((c) => c.codigo === '160');
    expect(c160?.descricao).toBe(DESCRICAO_OFICIAL_160);
    expect(c160?.descricao).not.toMatch(/psicomotricidade/i);
  });

  it('os outros códigos do catálogo continuam como estavam', () => {
    expect(CODIGOS_CASSI.map((c) => [c.codigo, c.descricao])).toEqual([
      ['144', 'Avaliação'],
      ['012', 'Sessão de psicomotricidade'],
      ['160', DESCRICAO_OFICIAL_160],
      ['185', 'Estimulação elétrica transcutânea'],
    ]);
    expect(CODIGOS_CASSI.find((c) => c.codigo === '144')?.apenasPrimeiroDia).toBe(true);
  });
});
