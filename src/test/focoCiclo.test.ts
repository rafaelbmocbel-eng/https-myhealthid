import { describe, it, expect } from 'vitest';
import { alternarDimensaoDoFoco, compararFoco, DIMENSOES_MYID, MAXIMO_DIMENSOES_FOCO } from '@/utils/myid/focoCiclo';
import { TABELA_PERDAS } from '@/utils/myid/lossTable';

const resultado = (perdas: Record<string, number>, score?: number) => ({
  MyID_score: score,
  perdas_calculadas: Object.fromEntries(Object.entries(perdas).map(([k, v]) => [k, { perda_pontos: v }])),
});

describe('alternarDimensaoDoFoco', () => {
  it('liga uma dimensão, desliga a mesma e respeita o limite de 3', () => {
    expect(alternarDimensaoDoFoco([], 'D')).toEqual({ ok: true, dimensoes: ['D'] });
    expect(alternarDimensaoDoFoco(['D'], 'D')).toEqual({ ok: true, dimensoes: [] });
    expect(alternarDimensaoDoFoco(['D', 'P'], 'R')).toEqual({ ok: true, dimensoes: ['D', 'P', 'R'] });
    expect(alternarDimensaoDoFoco(['D', 'P', 'R'], 'C')).toEqual({ ok: false, motivo: 'limite', dimensoes: ['D', 'P', 'R'] });
    expect(alternarDimensaoDoFoco(['D', 'P', 'R'], 'P')).toEqual({ ok: true, dimensoes: ['D', 'R'] });
  });

  it('recusa dimensão que não existe e não altera a lista de entrada', () => {
    const atuais = ['D'];
    expect(alternarDimensaoDoFoco(atuais, 'MED')).toEqual({ ok: false, motivo: 'dimensao_invalida', dimensoes: ['D'] });
    expect(alternarDimensaoDoFoco(atuais, 'd')).toMatchObject({ ok: false, motivo: 'dimensao_invalida' });
    expect(atuais).toEqual(['D']);
  });

  it('as 11 dimensões e o limite são os mesmos da tabela de perdas e da regra do banco', () => {
    expect([...DIMENSOES_MYID].sort()).toEqual(Object.keys(TABELA_PERDAS).sort());
    expect(MAXIMO_DIMENSOES_FOCO).toBe(3);
  });
});

describe('compararFoco', () => {
  const base = resultado({ D: 17.8, P: 15, R: 10.8, C: 7.9, AF: 5.7, HID: 4 }, 9.7);

  it('mostra a variação em pontos perdidos de cada dimensão do foco (negativo = melhorou)', () => {
    const atual = resultado({ D: 15.2, P: 15, R: 12.9, C: 7.9, AF: 5.7, HID: 4 }, 14.3);
    const c = compararFoco(base, atual, ['D', 'P'])!;
    expect(c.linhas).toEqual([
      { chave: 'D', antes: 17.8, agora: 15.2, variacao: -2.6, sentido: 'melhorou' },
      { chave: 'P', antes: 15, agora: 15, variacao: 0, sentido: 'igual' },
    ]);
    expect(c.scoreAntes).toBe(9.7);
    expect(c.scoreAgora).toBe(14.3);
    expect(c.semDado).toEqual([]);
  });

  it('avisa quando uma dimensão do foco piorou', () => {
    const c = compararFoco(base, resultado({ D: 18, P: 15, R: 10.8, C: 7.9, AF: 5.7, HID: 4 }), ['D'])!;
    expect(c.linhas[0]).toMatchObject({ chave: 'D', variacao: 0.2, sentido: 'piorou' });
  });

  it('não deixa o profissional cego: lista o que piorou FORA do foco (a partir de 1 ponto), da maior para a menor', () => {
    const atual = resultado({ D: 10, P: 15, R: 13.6, C: 8.4, AF: 7.2, HID: 4 });
    const c = compararFoco(base, atual, ['D'])!;
    expect(c.pioraramForaDoFoco).toEqual([{ chave: 'R', variacao: 2.8 }, { chave: 'AF', variacao: 1.5 }]);
  });

  it('melhora fora do foco e piora abaixo de 1 ponto não geram aviso; MED nunca entra', () => {
    const atual = {
      perdas_calculadas: { D: { perda_pontos: 17.8 }, P: { perda_pontos: 5 }, R: { perda_pontos: 11.5 }, MED: { perda_pontos: 50 } },
    };
    const b = { perdas_calculadas: { D: { perda_pontos: 17.8 }, P: { perda_pontos: 15 }, R: { perda_pontos: 10.8 }, MED: { perda_pontos: 0 } } };
    expect(compararFoco(b, atual, ['D'])!.pioraramForaDoFoco).toEqual([]);
  });

  it('dimensão que falta num dos resultados vai para semDado, sem inventar zero', () => {
    const antigo = resultado({ D: 17.8, P: 15 });
    const c = compararFoco(antigo, resultado({ D: 10, P: 12, R: 5 }), ['D', 'R'])!;
    expect(c.linhas.map((l) => l.chave)).toEqual(['D']);
    expect(c.semDado).toEqual(['R']);
  });

  it('devolve null para registro sem perdas gravadas, entrada estranha ou foco vazio', () => {
    expect(compararFoco(null, base, ['D'])).toBeNull();
    expect(compararFoco(base, undefined, ['D'])).toBeNull();
    expect(compararFoco({}, base, ['D'])).toBeNull();
    expect(compararFoco(base, 'x', ['D'])).toBeNull();
    expect(compararFoco(base, base, [])).toBeNull();
    expect(compararFoco(resultado({ D: 'abc' as unknown as number }), base, ['D'])).toBeNull();
  });

  it('o score vem de MyID_score ou de myid_100.pontuacao_final', () => {
    const b = { perdas_calculadas: { D: { perda_pontos: 10 } }, myid_100: { pontuacao_final: 40 } };
    const a = { perdas_calculadas: { D: { perda_pontos: 8 } }, MyID_score: 42 };
    const c = compararFoco(b, a, ['D'])!;
    expect(c.scoreAntes).toBe(40);
    expect(c.scoreAgora).toBe(42);
  });
});
