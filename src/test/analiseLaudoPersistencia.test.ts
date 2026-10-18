import { describe, expect, it } from 'vitest';
import { lerCriteriosSalvos, lerProtocoloSalvo } from '../lib/angular/analiseVideo/criteriosSalvos';
import { lerAnaliseSalva, serializarAnalise, type EntradaAnalise } from '../lib/angular/analiseVideo/persistencia';
import { trilhaVazia } from '../lib/angular/analiseVideo/trilhaVazia';
import type { CriterioProfissional } from '../lib/angular/movimento/tipos';
import { FONTE_CRITERIO } from './movimentoLaudoFixtures';

const base = (extra: Partial<EntradaAnalise> = {}): EntradaAnalise => ({
  video: { nome: 'v.mp4', tamanho: 1000, duracao: 5, largura: 640, altura: 480 }, modeloId: 'agachamento', fpsVideo: 30, intervalo: { inicio: 0, fim: 2 },
  trilha: trilhaVazia(30, 0, 2, 640, 480), eventos: null, cmPorPx: null, extras: {}, ...extra,
});

const criterio = (extra: Partial<CriterioProfissional> = {}): CriterioProfissional => ({
  id: 'c1', chave: 'assimetria_flexao_joelho', metrica: 'flexao_joelho_max', operador: '<=', valor: 5, unidade: '°', rotulo: 'Diferença ≤ 5,0°', definidoPor: 'Dra. Teste', ativo: true, ...extra,
});

const ler = (texto: string) => {
  const r = lerAnaliseSalva(texto);
  if (!r.ok) throw new Error(r.erro);
  return r.analise;
};

describe('critérios e protocolo no arquivo da análise (retrocompatível)', () => {
  it('uma análise salva antes da Etapa 3 abre normalmente, sem os campos novos', () => {
    const texto = serializarAnalise(base());
    expect(texto).not.toContain('criterios');
    expect(texto).not.toContain('protocoloMovimento');
    const a = ler(texto);
    expect(a.criterios).toBeUndefined();
    expect(a.protocoloMovimento).toBeUndefined();
    expect(a.modeloId).toBe('agachamento');
  });

  it('um arquivo sem os campos novos, escrito à mão, também abre', () => {
    const bruto = JSON.parse(serializarAnalise(base()));
    delete bruto.criterios;
    delete bruto.protocoloMovimento;
    expect(ler(JSON.stringify(bruto)).criterios).toBeUndefined();
  });

  it('guarda e devolve critérios e protocolo escolhido', () => {
    const c = criterio({ lado: 'D', fonte: FONTE_CRITERIO });
    const a = ler(serializarAnalise(base({ criterios: [c], protocoloMovimento: 'agachamento_frontal' })));
    expect(a.criterios).toEqual([c]);
    expect(a.protocoloMovimento).toBe('agachamento_frontal');
  });

  it('o critério sem valor (NaN vira null no JSON) volta desligado e sem valor presumido', () => {
    const c = criterio({ valor: Number.NaN, ativo: false, rotulo: '' });
    const texto = serializarAnalise(base({ criterios: [c] }));
    expect(JSON.parse(texto).criterios[0].valor).toBeNull();
    const lido = ler(texto).criterios?.[0] as CriterioProfissional;
    expect(Number.isNaN(lido.valor)).toBe(true);
    expect(lido.ativo).toBe(false);
  });

  it('um critério ligado sem valor numérico nunca volta ligado', () => {
    const lido = lerCriteriosSalvos([{ ...criterio(), valor: null, ativo: true }]);
    expect(lido?.[0].ativo).toBe(false);
  });

  it('descarta em silêncio o que vier malformado, em vez de inventar um critério', () => {
    const ruins: unknown[] = [
      null, 3, 'x', [], {},
      { ...criterio(), id: '' },
      { ...criterio(), id: 7 },
      { ...criterio(), chave: 'chave_que_nao_existe' },
      { ...criterio(), metrica: '' },
      { ...criterio(), operador: '==' },
      { ...criterio(), operador: undefined },
    ];
    expect(lerCriteriosSalvos(ruins)).toBeUndefined();
    const misturado = lerCriteriosSalvos([...ruins, criterio({ id: 'ok' })]);
    expect(misturado).toHaveLength(1);
    expect(misturado?.[0].id).toBe('ok');
  });

  it('campo que não é lista volta undefined', () => {
    for (const v of [undefined, null, 'x', 3, {}, true]) expect(lerCriteriosSalvos(v)).toBeUndefined();
  });

  it('ignora ids repetidos e limita a quantidade', () => {
    expect(lerCriteriosSalvos([criterio({ id: 'a' }), criterio({ id: 'a', valor: 9 })])).toHaveLength(1);
    const muitos = Array.from({ length: 80 }, (_, i) => criterio({ id: `c${i}` }));
    expect(lerCriteriosSalvos(muitos)).toHaveLength(50);
  });

  it('campos de texto ausentes viram texto vazio (o critério fica sem responsável e não se aplica)', () => {
    const lido = lerCriteriosSalvos([{ id: 'a', chave: 'assimetria_flexao_joelho', metrica: 'flexao_joelho_max', operador: '<=', valor: 5, ativo: true }]);
    expect(lido?.[0]).toMatchObject({ definidoPor: '', rotulo: '', unidade: '', ativo: true });
  });

  it('lado inválido é descartado; lado D e E são mantidos', () => {
    expect(lerCriteriosSalvos([criterio({ lado: 'X' as never })])?.[0].lado).toBeUndefined();
    expect(lerCriteriosSalvos([criterio({ lado: 'E' })])?.[0].lado).toBe('E');
  });

  it('fonte incompleta é descartada e a completa é mantida', () => {
    expect(lerCriteriosSalvos([{ ...criterio(), fonte: { pmid: '1' } }])?.[0].fonte).toBeUndefined();
    expect(lerCriteriosSalvos([{ ...criterio(), fonte: FONTE_CRITERIO }])?.[0].fonte).toEqual(FONTE_CRITERIO);
  });

  it('protocolo desconhecido ou de outro tipo é ignorado', () => {
    expect(lerProtocoloSalvo('marcha_lateral')).toBe('marcha_lateral');
    expect(lerProtocoloSalvo('agachamento_lateral')).toBe('agachamento_lateral');
    for (const v of ['corrida', '', 3, null, undefined, {}, '__proto__', 'constructor']) expect(lerProtocoloSalvo(v)).toBeUndefined();
  });

  it('um arquivo com campos novos malformados ainda abre a análise', () => {
    const bruto = JSON.parse(serializarAnalise(base()));
    bruto.criterios = 'lixo';
    bruto.protocoloMovimento = 42;
    const a = ler(JSON.stringify(bruto));
    expect(a.criterios).toBeUndefined();
    expect(a.protocoloMovimento).toBeUndefined();
  });
});
