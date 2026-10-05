import { describe, expect, it } from 'vitest';
import { calcularDiasUteisGuia, ehDiaUtil, ehFeriado, gerarDatasSessoes, nomeFeriado } from '../lib/feriados';

const D = (iso: string) => new Date(`${iso}T00:00:00`);

describe('feriados e dias úteis', () => {
  it('feriados móveis calculados pela Páscoa batem com os de 2024 a 2027', () => {
    for (const f of ['2024-02-13', '2024-03-29', '2024-05-30', '2025-03-04', '2025-04-18', '2025-06-19', '2026-02-17', '2026-04-03', '2026-06-04', '2027-02-09', '2027-03-26', '2027-05-27']) {
      expect(ehFeriado(D(f)), f).toBe(true);
    }
    expect(nomeFeriado(D('2026-04-03'))).toBe('Sexta-feira Santa');
  });
  it('cobre anos além de 2027', () => {
    expect(nomeFeriado(D('2030-04-19'))).toBe('Sexta-feira Santa'); // Páscoa 2030: 21/04
    expect(ehFeriado(D('2029-12-25'))).toBe(true);
  });
  it('fim de semana, feriado e datas extras não são dia útil', () => {
    expect(ehDiaUtil(D('2026-10-10'))).toBe(false); // sábado
    expect(ehDiaUtil(D('2026-10-12'))).toBe(false); // N. Sra. Aparecida (segunda)
    expect(ehDiaUtil(D('2026-10-13'))).toBe(true);
    expect(ehDiaUtil(D('2026-10-13'), new Set(['2026-10-13']))).toBe(false);
    expect(gerarDatasSessoes(D('2026-10-09'), 2, [1, 2, 3, 4, 5]).map((d) => d.getDate())).toEqual([9, 13]);
  });
});

describe('calculadora de dias úteis da guia', () => {
  it('conta a partir do dia da autorização, pulando fim de semana e feriado', () => {
    // autorizada na sexta 09/10/2026: 09, (10 sáb, 11 dom, 12 feriado), 13, 14, 15
    const r = calcularDiasUteisGuia({ autorizacaoISO: '2026-10-09', quantidade: 4 })!;
    expect(r.dias.map((d) => d.iso)).toEqual(['2026-10-09', '2026-10-13', '2026-10-14', '2026-10-15']);
    expect(r.fimISO).toBe('2026-10-15');
    expect(r.pulados.map((p) => `${p.iso} ${p.motivo}`)).toEqual(['2026-10-10 sábado', '2026-10-11 domingo', '2026-10-12 Nossa Senhora Aparecida']);
  });
  it('autorização em fim de semana começa na próxima segunda útil', () => {
    const r = calcularDiasUteisGuia({ autorizacaoISO: '2026-10-10', quantidade: 2 })!;
    expect(r.dias[0].iso).toBe('2026-10-13');
  });
  it('pode começar no dia seguinte à autorização', () => {
    const r = calcularDiasUteisGuia({ autorizacaoISO: '2026-10-13', quantidade: 2, contarDiaAutorizacao: false })!;
    expect(r.dias.map((d) => d.iso)).toEqual(['2026-10-14', '2026-10-15']);
  });
  it('avaliação é um dia extra no começo e as sessões seguem numeradas de 1', () => {
    const r = calcularDiasUteisGuia({ autorizacaoISO: '2026-10-13', quantidade: 3, comAvaliacao: true })!;
    expect(r.dias).toHaveLength(4);
    expect(r.dias[0]).toMatchObject({ rotulo: 'avaliacao', numero: 0 });
    expect(r.dias.slice(1).map((d) => d.numero)).toEqual([1, 2, 3]);
  });
  it('recusa data inválida e quantidade zero', () => {
    expect(calcularDiasUteisGuia({ autorizacaoISO: '', quantidade: 5 })).toBeNull();
    expect(calcularDiasUteisGuia({ autorizacaoISO: '2026-10-13', quantidade: 0 })).toBeNull();
  });
});
