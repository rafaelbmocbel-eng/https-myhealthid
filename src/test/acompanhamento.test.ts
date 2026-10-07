import { describe, expect, it } from 'vitest';
import {
  LIMIAR_DOR_ATENCAO_APP, LIMIAR_DOR_PADRAO_APP, alertasDor, dorAcimaDoLimite, escala0a10, faixaDor,
  formatarDiaMes, formatarNota, inicioDaJanela, inicioDaSemana, montarRegistroComoFoi, orientacaoDor, resumoJanela,
  resumoSemanal, rotuloSemana, rotuloSessao, temRegistroEsforcoOuDor, textoRegistro,
  type RegistroTreinoFeito,
} from '../lib/acompanhamento';

// 2026-10-07 é quarta-feira; a segunda dessa semana é 2026-10-05.
const HOJE = '2026-10-07';

const reg = (data: string, over: Partial<RegistroTreinoFeito> = {}): RegistroTreinoFeito => ({
  sessao_key: 'f0s0:treino a', data, ...over,
});

describe('semana e janela', () => {
  it('acha a segunda-feira da semana', () => {
    expect(inicioDaSemana('2026-10-07')).toBe('2026-10-05');
    expect(inicioDaSemana('2026-10-05')).toBe('2026-10-05');
    expect(inicioDaSemana('2026-10-11')).toBe('2026-10-05');
    expect(inicioDaSemana('2026-10-12')).toBe('2026-10-12');
  });

  it('atravessa virada de mês e de ano', () => {
    expect(inicioDaSemana('2026-01-01')).toBe('2025-12-29');
    expect(inicioDaSemana('2026-03-01')).toBe('2026-02-23');
  });

  it('rejeita data inválida', () => {
    expect(inicioDaSemana('')).toBeNull();
    expect(inicioDaSemana('abc')).toBeNull();
    expect(inicioDaSemana('2026-02-31')).toBeNull();
  });

  it('janela de 4 semanas começa 3 semanas antes da segunda atual', () => {
    expect(inicioDaJanela(HOJE, 4)).toBe('2026-09-14');
    expect(inicioDaJanela(HOJE, 1)).toBe('2026-10-05');
    expect(inicioDaJanela(HOJE)).toBe('2026-09-14');
  });
});

describe('escala 0-10 e faixas de dor', () => {
  it('normaliza e rejeita fora da escala', () => {
    expect(escala0a10(0)).toBe(0);
    expect(escala0a10(7)).toBe(7);
    expect(escala0a10('5')).toBe(5);
    expect(escala0a10(6.6)).toBe(7);
    expect(escala0a10(11)).toBeNull();
    expect(escala0a10(-1)).toBeNull();
    expect(escala0a10(null)).toBeNull();
    expect(escala0a10(undefined)).toBeNull();
    expect(escala0a10('')).toBeNull();
    expect(escala0a10('  ')).toBeNull();
    expect(escala0a10('x')).toBeNull();
    expect(escala0a10(true)).toBeNull();
    expect(escala0a10(Number.NaN)).toBeNull();
  });

  it('usa os mesmos limites da escala de dor do app (acima de 3 âmbar, acima de 6 alerta)', () => {
    expect(LIMIAR_DOR_ATENCAO_APP).toBe(3);
    expect(LIMIAR_DOR_PADRAO_APP).toBe(6);
    expect(faixaDor(0)).toBe('baixa');
    expect(faixaDor(3)).toBe('baixa');
    expect(faixaDor(4)).toBe('atencao');
    expect(faixaDor(6)).toBe('atencao');
    expect(faixaDor(7)).toBe('alta');
    expect(faixaDor(null)).toBeNull();
    expect(dorAcimaDoLimite(6)).toBe(false);
    expect(dorAcimaDoLimite(7)).toBe(true);
    expect(dorAcimaDoLimite(null)).toBe(false);
  });

  it('orienta procurar o profissional quando a dor passa do limite', () => {
    expect(orientacaoDor(null)).toBeNull();
    expect(orientacaoDor(0)).toBeNull();
    expect(orientacaoDor(2)).toMatch(/depois do treino/);
    expect(orientacaoDor(7)).toMatch(/limite de alerta do app \(6\/10\)/);
    expect(orientacaoDor(7)).toMatch(/profissional/);
  });
});

describe('montarRegistroComoFoi', () => {
  it('não inclui campos não informados (evita sobrescrever com null no upsert)', () => {
    expect(montarRegistroComoFoi({ rpe: 5, dor: null })).toEqual({ rpe: 5 });
    expect(montarRegistroComoFoi({ rpe: null, dor: 0 })).toEqual({ dor: 0 });
  });

  it('mantém zero como valor informado', () => {
    expect(montarRegistroComoFoi({ rpe: 0, dor: 0 })).toEqual({ rpe: 0, dor: 0 });
  });

  it('devolve null sem nada informado', () => {
    expect(montarRegistroComoFoi({ rpe: null, dor: null })).toBeNull();
    expect(montarRegistroComoFoi({ rpe: null, dor: null, observacao: '   ' })).toBeNull();
  });

  it('apara e limita a observação', () => {
    expect(montarRegistroComoFoi({ rpe: null, dor: null, observacao: '  joelho  ' })).toEqual({ observacao: 'joelho' });
    const longa = 'a'.repeat(500);
    expect(montarRegistroComoFoi({ rpe: 3, dor: 1, observacao: longa })?.observacao).toHaveLength(300);
  });

  it('descarta valores fora de 0-10', () => {
    expect(montarRegistroComoFoi({ rpe: 12, dor: -2 })).toBeNull();
  });
});

describe('resumoSemanal', () => {
  const registros: RegistroTreinoFeito[] = [
    reg('2026-10-07', { rpe: 6, dor: 2 }),
    reg('2026-10-05', { sessao_key: 'f0s1:treino b', rpe: 8, dor: 7, observacao: 'ombro' }),
    reg('2026-09-30', { rpe: 5, dor: null }),
    reg('2026-09-22'),
    reg('2026-09-14', { rpe: 4, dor: 0 }),
    reg('2026-09-13', { rpe: 9, dor: 9 }),
    reg('2026-10-12', { rpe: 9, dor: 9 }),
  ];

  it('devolve 4 semanas, da mais recente para a mais antiga, sem contar fora da janela', () => {
    const s = resumoSemanal(registros, HOJE, 4);
    expect(s.map((x) => x.inicio)).toEqual(['2026-10-05', '2026-09-28', '2026-09-21', '2026-09-14']);
    expect(s.map((x) => x.treinos)).toEqual([2, 1, 1, 1]);
    expect(s[0].fim).toBe('2026-10-11');
  });

  it('calcula médias só com o que foi informado (null não vira 0)', () => {
    const [atual, anterior, terceira] = resumoSemanal(registros, HOJE, 4);
    expect(atual.rpeMedio).toBe(7);
    expect(atual.dorMedia).toBe(4.5);
    expect(atual.dorMaxima).toBe(7);
    expect(atual.treinosDorAlta).toBe(1);
    expect(atual.comRegistro).toBe(2);
    expect(anterior.rpeMedio).toBe(5);
    expect(anterior.dorMedia).toBeNull();
    expect(anterior.dorMaxima).toBeNull();
    expect(terceira.treinos).toBe(1);
    expect(terceira.comRegistro).toBe(0);
    expect(terceira.rpeMedio).toBeNull();
  });

  it('inclui semanas sem treino zeradas', () => {
    const s = resumoSemanal([reg('2026-10-06', { rpe: 3 })], HOJE, 4);
    expect(s).toHaveLength(4);
    expect(s[1]).toMatchObject({ treinos: 0, comRegistro: 0, rpeMedio: null, dorMedia: null, dorMaxima: null });
  });

  it('arredonda médias para 1 casa', () => {
    const s = resumoSemanal([
      reg('2026-10-05', { sessao_key: 'a', rpe: 5 }),
      reg('2026-10-06', { sessao_key: 'b', rpe: 5 }),
      reg('2026-10-07', { sessao_key: 'c', rpe: 6 }),
    ], HOJE, 1);
    expect(s[0].rpeMedio).toBe(5.3);
  });

  it('devolve vazio com "hoje" inválido', () => {
    expect(resumoSemanal(registros, 'x', 4)).toEqual([]);
    expect(resumoJanela(registros, 'x', 4)).toBeNull();
  });

  it('ignora registros com data inválida', () => {
    const s = resumoSemanal([reg('lixo', { rpe: 9 }), reg('2026-10-05', { rpe: 3 })], HOJE, 1);
    expect(s[0].treinos).toBe(1);
    expect(s[0].rpeMedio).toBe(3);
  });

  it('resumoJanela agrega a janela inteira', () => {
    const j = resumoJanela(registros, HOJE, 4);
    expect(j?.inicio).toBe('2026-09-14');
    expect(j?.fim).toBe('2026-10-11');
    expect(j?.treinos).toBe(5);
    expect(j?.treinosDorAlta).toBe(1);
    expect(j?.dorMaxima).toBe(7);
  });
});

describe('alertasDor', () => {
  it('lista só dor acima do limite, mais recente primeiro', () => {
    const a = alertasDor([
      reg('2026-09-20', { dor: 8, observacao: 'joelho' }),
      reg('2026-10-05', { dor: 6 }),
      reg('2026-10-06', { dor: 7 }),
      reg('2026-10-06', { sessao_key: 'f0s1:b', dor: 9, observacao: '  ' }),
      reg('2026-10-07', { dor: null }),
    ]);
    expect(a.map((x) => [x.data, x.dor])).toEqual([['2026-10-06', 9], ['2026-10-06', 7], ['2026-09-20', 8]]);
    expect(a[0].observacao).toBeNull();
    expect(a[2].observacao).toBe('joelho');
  });

  it('aceita limiar explícito', () => {
    expect(alertasDor([reg('2026-10-05', { dor: 4 })], 3)).toHaveLength(1);
  });
});

describe('formatação', () => {
  it('formata dia/mês e semana', () => {
    expect(formatarDiaMes('2026-10-07')).toBe('07/10');
    expect(formatarDiaMes('')).toBe('');
    expect(rotuloSemana('2026-09-28')).toBe('28/09 a 04/10');
  });

  it('formata nota com vírgula e traço para ausente', () => {
    expect(formatarNota(4.5)).toBe('4,5');
    expect(formatarNota(7)).toBe('7');
    expect(formatarNota(0)).toBe('0');
    expect(formatarNota(null)).toBe('—');
    expect(formatarNota(undefined)).toBe('—');
  });

  it('rotula a sessão a partir da sessao_key do app', () => {
    expect(rotuloSessao('f0s1:treino a - peito e tríceps')).toBe('Treino a - peito e tríceps');
    expect(rotuloSessao('f1s2:')).toBe('Fase 2 · Treino 3');
    expect(rotuloSessao('qualquer')).toBe('qualquer');
    expect(rotuloSessao('')).toBe('Treino');
  });

  it('descreve o registro só com o que foi informado', () => {
    expect(textoRegistro({ rpe: 6, dor: 2 })).toBe('Esforço 6/10 · Dor 2/10');
    expect(textoRegistro({ rpe: 0, dor: null })).toBe('Esforço 0/10');
    expect(textoRegistro({ rpe: null, dor: null })).toBe('');
    expect(textoRegistro(null)).toBe('');
  });

  it('detecta se há registro de esforço, dor ou observação', () => {
    expect(temRegistroEsforcoOuDor({ rpe: 0, dor: null, observacao: null })).toBe(true);
    expect(temRegistroEsforcoOuDor({ rpe: null, dor: null, observacao: ' ' })).toBe(false);
    expect(temRegistroEsforcoOuDor({ rpe: null, dor: null, observacao: 'doeu' })).toBe(true);
    expect(temRegistroEsforcoOuDor(undefined)).toBe(false);
  });
});
