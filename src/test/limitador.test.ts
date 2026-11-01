import { describe, it, expect } from 'vitest';
import { criarLimitador } from '@/lib/limitador';

describe('criarLimitador', () => {
  it('a primeira chamada passa, mesmo com o relógio perto de zero', () => {
    expect(criarLimitador(100)(0)).toBe(true);
    expect(criarLimitador(100)(5)).toBe(true);
  });

  it('deixa passar no máximo uma vez por intervalo: a 60 quadros por segundo sobram cerca de 10 por segundo', () => {
    const passa = criarLimitador(100);
    let liberados = 0;
    for (let ms = 0; ms < 1000; ms += 1000 / 60) if (passa(ms)) liberados++;
    expect(liberados).toBeGreaterThanOrEqual(9);
    expect(liberados).toBeLessThanOrEqual(10);
  });

  it('exatamente no limite do intervalo passa; um milissegundo antes não', () => {
    const passa = criarLimitador(100);
    expect(passa(1000)).toBe(true);
    expect(passa(1099)).toBe(false);
    expect(passa(1100)).toBe(true);
  });

  it('chamada bloqueada não adia a próxima: o intervalo conta da última que passou', () => {
    const passa = criarLimitador(100);
    expect(passa(0)).toBe(true);
    expect(passa(60)).toBe(false);
    expect(passa(110)).toBe(true);
  });
});
