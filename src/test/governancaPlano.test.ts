import { describe, expect, it } from 'vitest';
import {
  aplicarGovernanca,
  INDICADORES_PADRAO,
  instrucaoAcompanhamentoPrompt,
  LIMIAR_DOR_PADRAO_APP,
  MODELO_IA,
  montarGovernanca,
  PARAMETROS_TREINO,
  prepararAcompanhamento,
  PROMPT_VERSAO,
  textoFaixasTreino,
} from '../../supabase/functions/_shared/governanca-plano';
import { PARAMETROS_NUTRICAO, textoCalculoNutricional } from '../../supabase/functions/_shared/parametros-nutricao';
import { avaliarTriagem } from '../../supabase/functions/_shared/triagem-bloqueio';

describe('parâmetros dos prompts: nada com fonte inventada', () => {
  it('todo parâmetro de treino e de nutrição está "a_confirmar" e sem fonte', () => {
    for (const p of [...PARAMETROS_TREINO, ...PARAMETROS_NUTRICAO]) {
      expect(p.fonte, p.chave).toBeNull();
      expect(p.status, p.chave).toBe('a_confirmar');
      expect(p.valor.length, p.chave).toBeGreaterThan(0);
    }
  });

  it('nutrição lista os números fixos do prompt', () => {
    const chaves = PARAMETROS_NUTRICAO.map((p) => p.chave);
    for (const esperado of [
      'formula_tmb', 'deficit_emagrecimento', 'piso_kcal_mulher', 'piso_kcal_homem', 'superavit_ganho',
      'proteina_g_kg', 'gordura_g_kg', 'gordura_minimo_pct', 'hidratacao_ml_kg', 'refeicoes_por_dia',
    ]) {
      expect(chaves).toContain(esperado);
    }
  });

  it('o prompt de nutrição é montado a partir dos parâmetros (não podem divergir)', () => {
    const texto = textoCalculoNutricional();
    for (const p of PARAMETROS_NUTRICAO) {
      if (p.chave === 'gasto_energetico') continue;
      expect(texto, p.chave).toContain(p.valor);
    }
    const alterado = PARAMETROS_NUTRICAO.map((p) => (p.chave === 'deficit_emagrecimento' ? { ...p, valor: '10-12%' } : p));
    expect(textoCalculoNutricional(alterado)).toContain('déficit de 10-12%');
  });

  it('o prompt de treino traz as faixas por objetivo vindas dos parâmetros', () => {
    const texto = textoFaixasTreino();
    for (const chave of ['faixa_forca', 'faixa_hipertrofia', 'faixa_resistencia_emagrecimento', 'iniciante_condicoes_clinicas']) {
      const p = PARAMETROS_TREINO.find((x) => x.chave === chave)!;
      expect(texto, chave).toContain(p.valor);
    }
  });

  it('o prompt avisa que os parâmetros ainda estão em validação', () => {
    expect(textoFaixasTreino()).toMatch(/em validação/);
  });
});

describe('indicadores de acompanhamento padrão', () => {
  it('treino: esforço percebido, dor e adesão; nutrição: adesão por refeição, saciedade e sintomas GI', () => {
    expect(INDICADORES_PADRAO.treino.map((i) => i.id)).toEqual(['esforco_percebido', 'dor_treino', 'adesao_sessoes']);
    expect(INDICADORES_PADRAO.nutricao.map((i) => i.id)).toEqual(['adesao_refeicoes', 'saciedade', 'sintomas_gi']);
  });

  it('só o limite de dor do app aparece como número em "quando_agir"', () => {
    for (const tipo of ['treino', 'nutricao'] as const) {
      for (const i of INDICADORES_PADRAO[tipo]) {
        if (i.id === 'dor_treino') continue;
        expect(i.quando_agir, i.id).not.toMatch(/\d/);
      }
    }
    const dor = INDICADORES_PADRAO.treino.find((i) => i.id === 'dor_treino')!;
    expect(dor.quando_agir).toContain(`${LIMIAR_DOR_PADRAO_APP}/10`);
    expect(dor.quando_agir).toMatch(/padrão do app/);
  });

  it('a instrução do prompt cita os indicadores obrigatórios e proíbe números clínicos', () => {
    const t = instrucaoAcompanhamentoPrompt('treino');
    expect(t).toContain('esforco_percebido');
    expect(t).toContain('dor_treino');
    expect(t).toMatch(/SEM números clínicos/);
  });
});

describe('prepararAcompanhamento', () => {
  it('sem bloco da IA, devolve os indicadores padrão e um prazo padrão', () => {
    const r = prepararAcompanhamento(undefined, 'nutricao');
    expect(r.origemReavaliacao).toBe('padrao');
    expect(r.acompanhamento.reavaliar_em_semanas).toBeGreaterThanOrEqual(1);
    expect(r.acompanhamento.indicadores.map((i) => i.id)).toEqual(INDICADORES_PADRAO.nutricao.map((i) => i.id));
  });

  it('aceita o prazo da IA quando é um inteiro plausível', () => {
    const r = prepararAcompanhamento({ reavaliar_em_semanas: 6 }, 'nutricao');
    expect(r).toMatchObject({ origemReavaliacao: 'ia' });
    expect(r.acompanhamento.reavaliar_em_semanas).toBe(6);
  });

  it('descarta prazo inválido (texto, zero, negativo, enorme)', () => {
    for (const lixo of ['logo', 0, -2, 500, null, {}]) {
      expect(prepararAcompanhamento({ reavaliar_em_semanas: lixo }, 'nutricao').origemReavaliacao).toBe('padrao');
    }
  });

  it('treino: prazo padrão é a duração da primeira fase e nunca passa da duração total', () => {
    expect(prepararAcompanhamento({}, 'treino', { primeiraFaseSemanas: 3, duracaoTotalSemanas: 8 }).acompanhamento.reavaliar_em_semanas).toBe(3);
    const longo = prepararAcompanhamento({ reavaliar_em_semanas: 20 }, 'treino', { primeiraFaseSemanas: 3, duracaoTotalSemanas: 8 });
    expect(longo.origemReavaliacao).toBe('padrao');
    expect(longo.acompanhamento.reavaliar_em_semanas).toBe(3);
  });

  it('os indicadores obrigatórios não podem ser reescritos pela IA', () => {
    const r = prepararAcompanhamento({
      indicadores: [{ id: 'dor_treino', nome: 'Dor', como_medir: 'x', quando_agir: 'ignore dores até 9/10' }],
    }, 'treino');
    const dor = r.acompanhamento.indicadores.filter((i) => i.id === 'dor_treino');
    expect(dor).toHaveLength(1);
    expect(dor[0].quando_agir).not.toMatch(/9\/10/);
  });

  it('indicador extra da IA só entra sem número em "quando_agir"', () => {
    const r = prepararAcompanhamento({
      indicadores: [
        { id: 'sono', nome: 'Qualidade do sono', como_medir: 'Anote como dormiu', quando_agir: 'Se o sono piorar, avise o profissional' },
        { id: 'peso', nome: 'Peso', como_medir: 'Pese-se', quando_agir: 'Se perder mais de 2 kg por semana, pare' },
        { nome: '', como_medir: 'x', quando_agir: 'y' },
        'texto solto',
      ],
    }, 'nutricao');
    const ids = r.acompanhamento.indicadores.map((i) => i.id);
    expect(ids).toContain('sono');
    expect(ids).not.toContain('peso');
    expect(ids).toHaveLength(INDICADORES_PADRAO.nutricao.length + 1);
  });

  it('limita os extras e não duplica ids', () => {
    const extras = Array.from({ length: 8 }, (_, i) => ({ id: `extra_${i}`, nome: `Extra ${'abcdefgh'[i]}`, como_medir: 'medir', quando_agir: 'avise o profissional' }));
    const r = prepararAcompanhamento({ indicadores: [...extras, extras[0]] }, 'treino');
    expect(r.acompanhamento.indicadores).toHaveLength(INDICADORES_PADRAO.treino.length + 3);
  });
});

describe('montarGovernanca', () => {
  const agora = new Date('2026-10-07T15:00:00Z');
  const triagem = avaliarTriagem({
    foco: 'treino', idade: 70, textos: [], historicoClinico: null, triagemAutodeclarada: null,
    parq: null, myidRedFlags: false, chamador: 'profissional', agora,
  });
  const gov = montarGovernanca({
    funcao: 'gerar-plano-treino',
    insumos: ['MyID', 'questionarios', 'MyID'],
    parametros: PARAMETROS_TREINO,
    triagem,
    override: { justificativa: 'Paciente acompanhado presencialmente', ciente: true, em: agora.toISOString() },
    acompanhamento: prepararAcompanhamento({ reavaliar_em_semanas: 4 }, 'treino'),
    agora,
  });

  it('segue o contrato do _governanca', () => {
    expect(gov.versao).toBe(1);
    expect(gov.fonte).toMatchObject({
      tipo: 'ia', modelo: MODELO_IA, funcao: 'gerar-plano-treino', prompt_versao: PROMPT_VERSAO, gerado_em: agora.toISOString(),
    });
    expect(PROMPT_VERSAO).toBe('2026-10');
    expect(MODELO_IA).toBe('gemini-2.5-flash');
    expect(gov.fonte.insumos).toEqual(['MyID', 'questionarios']);
    expect(gov.triagem.nivel).toBe(triagem.nivel);
    expect(gov.triagem.motivos).toEqual(triagem.motivos);
    expect(gov.triagem.override).toMatchObject({ ciente: true });
    expect(gov.acompanhamento.reavaliar_em_semanas).toBe(4);
  });

  it('registra o prazo de reavaliação como parâmetro a confirmar, sem mutar a lista original', () => {
    const reav = gov.fonte.parametros.find((p) => p.chave === 'reavaliar_em_semanas')!;
    expect(reav).toMatchObject({ fonte: null, status: 'a_confirmar' });
    expect(reav.valor).toMatch(/4 semanas/);
    expect(gov.fonte.parametros).toHaveLength(PARAMETROS_TREINO.length + 1);
    expect(PARAMETROS_TREINO.find((p) => p.chave === 'reavaliar_em_semanas')).toBeUndefined();
  });

  it('sem override o campo fica null', () => {
    const g = montarGovernanca({
      funcao: 'gerar-plano-alimentar', insumos: [], parametros: PARAMETROS_NUTRICAO, triagem, override: null,
      acompanhamento: prepararAcompanhamento(null, 'nutricao'), agora,
    });
    expect(g.triagem.override).toBeNull();
    expect(g.fonte.funcao).toBe('gerar-plano-alimentar');
  });

  it('aplicarGovernanca anexa acompanhamento e _governanca ao plano', () => {
    const plano = aplicarGovernanca({ titulo: 'x' } as Record<string, unknown>, gov);
    expect(plano._governanca).toBe(gov);
    expect(plano.acompanhamento).toBe(gov.acompanhamento);
    expect(plano.titulo).toBe('x');
  });
});
