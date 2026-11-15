import { describe, it, expect } from 'vitest';
import { anoDaData, anoDoHistorico, coincideComODiaDoCadastro, dataDeTabela, formatarData } from '@/lib/resumoClinico/datas';

// "Hoje" fixo: nenhuma regra de data pode depender do relógio da máquina.
const HOJE = '2026-11-15';

describe('anoDoHistorico (ano que o cliente digitou na cirurgia)', () => {
  it.each([
    [2022, '2022'], ['2022', '2022'], ['  2022  ', '2022'], ['2022\n', '2022'], ['\t2022', '2022'],
    [1900, '1900'], ['1900', '1900'],
    [2026, '2026'], ['2026', '2026'], // o ano de hoje vale
  ])('aceita %j como o ano %s', (valor, esperado) => {
    expect(anoDoHistorico(valor, HOJE)).toEqual({ iso: esperado, precisao: 'ano' });
  });

  it.each([
    ['2O22'], ['2022a'], ['a2022'], ['dois mil'], ['há 2 anos'], ['ha 2 anos'], ['mês passado'], ['20'], [20], ['202'], ['12022'], ['02022'],
    ['2099'], [2099], ['2027'], ['1899'], [1899], ['1000'], ['0000'], [0],
    ['2022-13'], ['2022-05'], ['2022-05-03'], ['2022.5'], [2022.5], ['2,022'], ['2 022'], ['-2022'], [-2022], ['+2022'], ['1e3'], ['0x7E6'],
    ['２０２２'], // dígitos de largura total
    [''], ['   '], [null], [undefined], [{}], [[]], [[2022]], [true], [false], [NaN], [Infinity], [() => 2022], [{ ano: 2022 }],
  ])('manda para "Sem data": %j', (valor) => {
    expect(anoDoHistorico(valor, HOJE)).toBeNull();
  });

  it('o limite de cima é o ano de "hoje", não um ano fixo', () => {
    expect(anoDoHistorico('2026', '2025-12-31')).toBeNull();
    expect(anoDoHistorico('2025', '2025-12-31')).not.toBeNull();
    expect(anoDoHistorico('2026', '2026-01-01')).not.toBeNull();
    expect(anoDoHistorico('2027', '2026-12-31')).toBeNull();
  });

  it('o limite de baixo é 1900 (inclusive)', () => {
    expect(anoDoHistorico('1899', HOJE)).toBeNull();
    expect(anoDoHistorico('1900', HOJE)).not.toBeNull();
    expect(anoDoHistorico('1901', HOJE)).not.toBeNull();
  });
});

describe('dataDeTabela (data_evento, data_diagnostico, created_at...)', () => {
  it.each([
    ['2026-11-15', '2026-11-15'], // hoje vale
    ['2026-11-14', '2026-11-14'],
    ['2024-02-29', '2024-02-29'], // ano bissexto
    ['1900-01-01', '1900-01-01'],
    ['  2026-11-14  ', '2026-11-14'],
    ['2022-05-03T10:00:00Z', '2022-05-03'],
    ['2022-05-03 10:00:00+00:00', '2022-05-03'],
    ['2026-10-07T23:59:00', '2026-10-07'], // sem fuso: vale o dia escrito
    ['2026-10-07T23:59:18.123456+00:00', '2026-10-07'], // 20:59 no Brasil: ainda dia 7
    ['2026-10-08T01:30:00+00:00', '2026-10-07'], // 22:30 do dia 7 no Brasil
    ['2026-10-08T03:00:00+00:00', '2026-10-08'], // meia-noite no Brasil
    ['2026-10-07T00:30:00-03:00', '2026-10-07'],
  ])('aceita %j como o dia %s', (valor, esperado) => {
    expect(dataDeTabela(valor, HOJE)).toEqual({ iso: esperado, precisao: 'dia' });
  });

  it.each([
    ['0000-00-00'], ['0001-01-01'], ['1899-12-31'],
    ['2026-11-16'], ['2027-01-01'], ['9999-12-31'], // depois de hoje
    ['2023-02-29'], ['2026-13-01'], ['2026-00-10'], ['2026-04-31'], ['2026-02-30'], ['2026-01-00'], // dia que não existe
    ['2026-11-15T25:00:00Z'], ['2026-11-15T10:61:00Z'], ['2026-11-15T10:10:61Z'], // hora que não existe
    ['2026-10-07T25:00:00'], ['2026-10-07T24:00:00'], ['2026-10-07T10:60:00'], ['2026-10-07T10:10:60'], // idem, sem fuso
    ['2020-13-01'], ['2020-14-01'], ['2020-00-10'], // mês que não existe, em ano passado (não cai na regra do futuro)
    ['15/11/2026'], ['2026-1-5'], ['20261115'], ['ontem'], ['há 2 anos'], ['2022'], ['2022-05'],
    ['2026-11-15T10:00:00+0300'], // fuso fora do formato do PostgREST
    [''], ['   '], [null], [undefined], [20261115], [new Date('2026-01-01')], [{}], [[]], [true],
  ])('rejeita %j', (valor) => {
    expect(dataDeTabela(valor, HOJE)).toBeNull();
  });

  it('um instante de amanhã em UTC que ainda é hoje no Brasil não é futuro; o que já é amanhã no Brasil é', () => {
    expect(dataDeTabela('2026-11-15T23:59:59+00:00', HOJE)?.iso).toBe('2026-11-15');
    expect(dataDeTabela('2026-11-16T01:00:00+00:00', HOJE)?.iso).toBe('2026-11-15'); // 22:00 do dia 15 no Brasil
    expect(dataDeTabela('2026-11-16T03:00:00+00:00', HOJE)).toBeNull(); // 00:00 do dia 16 no Brasil
  });

  it('"hoje" é o limite: o dia seguinte já não vale', () => {
    expect(dataDeTabela('2026-11-15', '2026-11-15')).not.toBeNull();
    expect(dataDeTabela('2026-11-15', '2026-11-14')).toBeNull();
    expect(dataDeTabela('2026-11-16', '2026-11-16')).not.toBeNull();
  });
});

describe('formatarData e anoDaData', () => {
  it('ano mostra só o ano; dia mostra dd/mm/aaaa', () => {
    expect(formatarData({ iso: '2022', precisao: 'ano' })).toBe('2022');
    expect(formatarData({ iso: '2026-10-07', precisao: 'dia' })).toBe('07/10/2026');
    expect(formatarData({ iso: '2026-01-02', precisao: 'dia' })).toBe('02/01/2026');
  });
  it('o ano de qualquer precisão é a data cortada em 4 caracteres', () => {
    expect(anoDaData({ iso: '2022', precisao: 'ano' })).toBe('2022');
    expect(anoDaData({ iso: '2019-03-04', precisao: 'dia' })).toBe('2019');
  });
});

describe('coincideComODiaDoCadastro (data que o banco pode ter preenchido sozinho: DEFAULT CURRENT_DATE)', () => {
  it.each([
    // [data da coluna, created_at, por quê]
    ['2026-02-03', '2026-02-03T15:00:00+00:00', 'mesmo dia em UTC e no Brasil'],
    ['2026-11-16', '2026-11-16T01:00:00+00:00', 'dia de UTC; no Brasil ainda é 15'],
    ['2026-11-15', '2026-11-16T01:00:00+00:00', 'dia do Brasil; em UTC já é 16'],
    ['2026-02-04', '2026-02-03T23:30:00-03:00', 'o fuso do texto é -03:00: em UTC já é 04/02'],
    ['2026-02-03', '2026-02-04T01:30:00Z', 'fuso Z'],
    ['2026-02-04', '2026-02-04T01:30:00.123456+00:00', 'microssegundos, como o PostgREST manda'],
    ['2026-02-03', '2026-02-03 15:00:00+00:00', 'espaço no lugar do T'],
    [' 2026-02-03 ', '2026-02-03T15:00:00+00:00', 'espaços nas pontas da data'],
  ])('%s e %s: coincide (%s)', (data, criado) => {
    expect(coincideComODiaDoCadastro(data, criado, HOJE)).toBe(true);
  });

  it.each([
    ['2019-03-04', '2026-02-03T15:00:00+00:00', 'data antiga'],
    ['2026-02-02', '2026-02-03T15:00:00+00:00', 'dia anterior'],
    ['2026-02-04', '2026-02-03T15:00:00+00:00', 'dia seguinte'],
    ['2026-02-02', '2026-02-04T01:30:00+00:00', 'dois dias antes do dia de UTC e um antes do do Brasil'],
    ['2026-02-05', '2026-02-04T01:30:00+00:00', 'depois dos dois'],
    ['2026-11-14', '2026-11-16T01:00:00+00:00', 'um dia antes do dia do Brasil'],
  ])('%s e %s: não coincide (%s)', (data, criado) => {
    expect(coincideComODiaDoCadastro(data, criado, HOJE)).toBe(false);
  });

  it.each([[null], [undefined], [''], ['ontem'], ['2099-01-01T10:00:00Z'], ['0000-00-00'], [20260203], [{}]])('created_at %j não é um instante válido: não há com o que comparar, não coincide', (criado) => {
    expect(coincideComODiaDoCadastro('2026-02-03', criado, HOJE)).toBe(false);
  });

  it.each([[null], [undefined], [''], ['03/02/2026'], ['2026-2-3'], [20260203], [{}], [['2026-02-03']]])('data da coluna %j não é uma data no formato do banco: não coincide', (data) => {
    expect(coincideComODiaDoCadastro(data, '2026-02-03T15:00:00+00:00', HOJE)).toBe(false);
  });
});
