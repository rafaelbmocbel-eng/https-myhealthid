import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  CHAVES_TRIAGEM, JUSTIFICATIVA_MIN_CARACTERES, OPCOES_TRIAGEM, calcularDataReavaliacao, contarRespondidas,
  diasAteReavaliacao, estadoSelo, extrairBloqueio, formatarDataBR, justificativaValida, lerAcompanhamento,
  lerGovernanca, lerTriagemSalva, mensagemErroLiberacao, mesclarTriagem, montarTriagem, normalizarRevisao,
  removerGovernanca, resumoParametros, riscoEfetivo, rotuloOrigemTriagem, rotuloSelo, semAprovacao,
  semParametrosConfirmados, triagemCompleta, triagemPedeAtencao, validarOverride,
  type RespostasTriagem,
} from '../lib/governanca';
import { RESPOSTAS_TRIAGEM } from '../../supabase/functions/_shared/triagem-bloqueio';
import SeloGovernanca from '../components/planos/SeloGovernanca';
import ResumoAcompanhamento from '../components/planos/ResumoAcompanhamento';

const gov = (over: Record<string, unknown> = {}) => ({
  versao: 1,
  fonte: {
    tipo: 'ia',
    modelo: 'gemini-2.5-flash',
    funcao: 'gerar-plano-treino',
    prompt_versao: '2026-10',
    gerado_em: '2026-10-01T12:00:00.000Z',
    insumos: ['MyID'],
    parametros: [
      { chave: 'faixa_forca', valor: '3-6 repetições', fonte: null, status: 'a_confirmar' },
      { chave: 'faixa_hipertrofia', valor: '6-12 repetições', fonte: null, status: 'a_confirmar' },
    ],
  },
  triagem: { nivel: 'liberado', motivos: [], override: null },
  acompanhamento: {
    reavaliar_em_semanas: 4,
    indicadores: [{ id: 'dor_treino', nome: 'Dor durante o treino (0 a 10)', como_medir: 'Marque ao fim do treino.', quando_agir: 'Procure o profissional.' }],
  },
  aprovacao: { por_user_id: 'u1', por_nome: 'Ana Souza', em: '2026-10-07T15:00:00.000Z', versao: 2, hash: 'abc' },
  ...over,
});

const plano = (g: Record<string, unknown> | null) => ({ titulo: 'Treino', fases: [], ...(g ? { _governanca: g } : {}) });

describe('lerGovernanca', () => {
  it('devolve null para plano legado, sem o registro', () => {
    expect(lerGovernanca({ titulo: 'x' })).toBeNull();
    expect(lerGovernanca(null)).toBeNull();
    expect(lerGovernanca('texto')).toBeNull();
    expect(lerGovernanca({ _governanca: 'quebrado' })).toBeNull();
  });

  it('lê aprovação, fonte, triagem e acompanhamento', () => {
    const g = lerGovernanca(plano(gov()));
    expect(g?.aprovacao).toMatchObject({ por_nome: 'Ana Souza', versao: 2, sem_revisao: false });
    expect(g?.fonte?.modelo).toBe('gemini-2.5-flash');
    expect(g?.triagem?.nivel).toBe('liberado');
    expect(g?.acompanhamento?.reavaliar_em_semanas).toBe(4);
  });

  it('não quebra com formatos inesperados e trata status desconhecido como a confirmar', () => {
    const g = lerGovernanca(plano({
      fonte: { parametros: [{ chave: 'a', valor: 1, status: 'qualquer' }, 'lixo', { valor: 'sem chave' }] },
      triagem: { nivel: 'estranho', motivos: 'x' },
      aprovacao: { versao: 'abc', em: 123 },
      acompanhamento: { reavaliar_em_semanas: 'muitas', indicadores: [{ id: 1 }] },
    }));
    expect(g?.fonte?.parametros).toEqual([{ chave: 'a', rotulo: null, valor: '', fonte: null, status: 'a_confirmar' }]);
    expect(g?.triagem).toMatchObject({ nivel: 'liberado', motivos: [] });
    expect(g?.aprovacao).toMatchObject({ versao: null, em: null });
    expect(g?.acompanhamento).toBeNull();
  });
});

describe('lerAcompanhamento', () => {
  it('cai para o bloco acompanhamento da raiz quando _governanca não o traz', () => {
    const a = lerAcompanhamento({ acompanhamento: { reavaliar_em_semanas: 6, indicadores: [] } });
    expect(a?.reavaliar_em_semanas).toBe(6);
  });
  it('é null para plano sem acompanhamento', () => {
    expect(lerAcompanhamento({ titulo: 'x' })).toBeNull();
  });
});

describe('removerGovernanca / semAprovacao', () => {
  it('tira só _governanca sem mutar o original', () => {
    const original = plano(gov());
    const limpo = removerGovernanca(original);
    expect('_governanca' in limpo).toBe(false);
    expect(limpo).toMatchObject({ titulo: 'Treino' });
    expect('_governanca' in original).toBe(true);
  });
  it('devolve o mesmo valor quando não há o que tirar', () => {
    const o = { a: 1 };
    expect(removerGovernanca(o)).toBe(o);
    expect(removerGovernanca(null)).toBeNull();
  });
  it('semAprovacao descarta a aprovação lida', () => {
    expect(semAprovacao(lerGovernanca(plano(gov())))?.aprovacao).toBeNull();
    expect(semAprovacao(null)).toBeNull();
  });
});

describe('formatarDataBR', () => {
  it('usa o dia de Brasília, não o de UTC', () => {
    expect(formatarDataBR('2026-10-07T15:00:00.000Z')).toBe('07/10/2026');
    // 01:00 UTC de 08/10 ainda é 22:00 de 07/10 em Brasília
    expect(formatarDataBR('2026-10-08T01:00:00.000Z')).toBe('07/10/2026');
  });
  it('devolve texto vazio para data ausente ou inválida', () => {
    expect(formatarDataBR(null)).toBe('');
    expect(formatarDataBR('não é data')).toBe('');
  });
});

describe('rotuloSelo', () => {
  it('liberado com registro de aprovação', () => {
    expect(rotuloSelo(lerGovernanca(plano(gov())), true)).toBe(
      'Liberado por Ana Souza em 07/10/2026 · v2 · Fonte: IA (gemini-2.5-flash) + revisão profissional',
    );
  });
  it('sem o nome do aprovador não inventa um', () => {
    const g = lerGovernanca(plano(gov({ aprovacao: { em: '2026-10-07T15:00:00.000Z', versao: 1 } })));
    expect(rotuloSelo(g, true)).toBe('Liberado em 07/10/2026 · v1 · Fonte: IA (gemini-2.5-flash) + revisão profissional');
  });
  it('plano liberado sem nenhum registro é legado', () => {
    expect(rotuloSelo(null, true)).toBe('Liberado antes do registro de aprovação');
    expect(rotuloSelo(lerGovernanca(plano(gov({ aprovacao: undefined }))), true)).toBe('Liberado antes do registro de aprovação');
  });
  it('não liberado é rascunho, mesmo com aprovação antiga no conteúdo', () => {
    expect(rotuloSelo(lerGovernanca(plano(gov())), false)).toBe('Rascunho');
    expect(rotuloSelo(null, false)).toBe('Rascunho');
  });
  it('sem a coluna aprovado, só o registro vale: nunca afirma liberação sem prova', () => {
    expect(rotuloSelo(null)).toBe('Rascunho');
    expect(rotuloSelo(lerGovernanca(plano(gov({ aprovacao: undefined }))))).toBe('Rascunho');
    expect(rotuloSelo(lerGovernanca(plano(gov())))).toContain('Liberado por Ana Souza');
  });
  it('estadoSelo acompanha o rótulo', () => {
    expect(estadoSelo(lerGovernanca(plano(gov())), true)).toBe('liberado');
    expect(estadoSelo(null, true)).toBe('legado');
    expect(estadoSelo(null, false)).toBe('rascunho');
  });
});

describe('calcularDataReavaliacao', () => {
  it('soma as semanas à data de liberação do registro', () => {
    const d = calcularDataReavaliacao(lerGovernanca(plano(gov())));
    expect(d?.toISOString()).toBe('2026-11-04T15:00:00.000Z');
  });
  it('prefere a data de liberação informada', () => {
    const d = calcularDataReavaliacao(lerGovernanca(plano(gov())), '2026-10-01T00:00:00.000Z');
    expect(d?.toISOString()).toBe('2026-10-29T00:00:00.000Z');
  });
  it('sem prazo ou sem data de liberação não inventa uma data', () => {
    expect(calcularDataReavaliacao(null)).toBeNull();
    expect(calcularDataReavaliacao(lerGovernanca(plano(gov({ aprovacao: undefined }))))).toBeNull();
    expect(calcularDataReavaliacao(lerGovernanca(plano(gov({ acompanhamento: undefined }))))).toBeNull();
  });
  it('diasAteReavaliacao é negativo quando atrasada', () => {
    const d = new Date('2026-10-10T12:00:00.000Z');
    expect(diasAteReavaliacao(d, new Date('2026-10-07T12:00:00.000Z'))).toBe(3);
    expect(diasAteReavaliacao(d, new Date('2026-10-12T12:00:00.000Z'))).toBe(-2);
  });
});

describe('parâmetros sem fonte confirmada', () => {
  it('nenhum confirmado: sinaliza', () => {
    const g = lerGovernanca(plano(gov()));
    expect(semParametrosConfirmados(g)).toBe(true);
    expect(resumoParametros(g)).toEqual({ total: 2, confirmados: 0, aConfirmar: 2 });
  });
  it('algum confirmado: não sinaliza', () => {
    const g = lerGovernanca(plano(gov({
      fonte: { tipo: 'ia', parametros: [{ chave: 'a', valor: '1', fonte: 'Fonte X', status: 'confirmado' }, { chave: 'b', valor: '2', fonte: null, status: 'a_confirmar' }] },
    })));
    expect(semParametrosConfirmados(g)).toBe(false);
    expect(resumoParametros(g)).toEqual({ total: 2, confirmados: 1, aConfirmar: 1 });
  });
  it('sem parâmetros não há o que sinalizar', () => {
    expect(semParametrosConfirmados(null)).toBe(false);
    expect(semParametrosConfirmados(lerGovernanca(plano(gov({ fonte: { tipo: 'ia', parametros: [] } }))))).toBe(false);
  });
});

describe('revisão de segurança', () => {
  it('qualquer flag de severidade alta força risco alto, mesmo que a IA diga baixo', () => {
    expect(riscoEfetivo({ risco_geral: 'baixo', flags: [{ severidade: 'alta' }] })).toBe('alto');
    expect(riscoEfetivo({ risco_geral: 'baixo', flags: [] })).toBe('baixo');
    expect(riscoEfetivo({ flags: [{ severidade: 'media' }] })).toBe('medio');
    expect(riscoEfetivo({})).toBe('baixo');
  });

  it('normaliza a resposta da edge', () => {
    const r = normalizarRevisao({
      resumo: 'Atenção',
      risco_geral: 'baixo',
      flags: [{ severidade: 'alta', titulo: 'Carga', descricao: 'd', sugestao: 's', onde: 'Fase 1' }],
      persistida: true,
      hash: 'h',
    });
    expect(r).toMatchObject({ risco_geral: 'alto', persistida: true, planoTruncado: false });
    expect(r?.flags).toHaveLength(1);
  });

  it('registra o motivo quando a revisão não foi gravada', () => {
    const r = normalizarRevisao({ risco_geral: 'baixo', flags: [], persistida: false, motivo_nao_persistida: 'plano_alterado', plano_truncado: true });
    expect(r).toMatchObject({ persistida: false, motivoNaoPersistida: 'plano_alterado', planoTruncado: true });
  });

  it('resposta sem flags nem risco não vira "sem pontos críticos"', () => {
    expect(normalizarRevisao({})).toBeNull();
    expect(normalizarRevisao(null)).toBeNull();
    expect(normalizarRevisao({ resumo: 'só texto' })).toBeNull();
  });

  it('justificativa exige o mínimo sem contar espaços nas pontas', () => {
    expect(justificativaValida('a'.repeat(JUSTIFICATIVA_MIN_CARACTERES))).toBe(true);
    expect(justificativaValida(`  ${'a'.repeat(JUSTIFICATIVA_MIN_CARACTERES - 1)}  `)).toBe(false);
    expect(justificativaValida(null)).toBe(false);
  });

  it('traduz o erro do banco que exige justificativa', () => {
    expect(mensagemErroLiberacao({ message: 'Justificativa obrigatória para liberar plano de risco alto' }).exigeJustificativa).toBe(true);
    const sem = mensagemErroLiberacao({ message: 'new row violates row-level security policy' });
    expect(sem.exigeJustificativa).toBe(false);
    expect(sem.mensagem).toContain('permissão');
    expect(mensagemErroLiberacao({ message: 'Liberação negada: só Educador Físico.' }).mensagem).toBe('Liberação negada: só Educador Físico.');
    expect(mensagemErroLiberacao(undefined).mensagem).toMatch(/liberar o plano/);
  });
});

describe('bloqueio de triagem', () => {
  const motivo = { codigo: 'menor_de_idade', rotulo: 'Menor de 18 anos', detalhe: 'x', origem: 'cadastro', nivel: 'bloqueia' };

  it('extrai o bloqueio de uma resposta ok:false', () => {
    const b = extrairBloqueio({
      ok: false,
      bloqueio: { nivel: 'bloqueia', motivos: [motivo], dadosAusentes: ['idade'], pode_prosseguir_profissional: true, override_recusado: 'justificativa_curta' },
    });
    expect(b).toMatchObject({ nivel: 'bloqueia', dadosAusentes: ['idade'], pode_prosseguir_profissional: true, override_recusado: 'justificativa_curta' });
    expect(b?.motivos[0].codigo).toBe('menor_de_idade');
  });

  it('não confunde sucesso ou erro com bloqueio', () => {
    expect(extrairBloqueio({ ok: true, plano: {} })).toBeNull();
    expect(extrairBloqueio({ error: 'x' })).toBeNull();
    expect(extrairBloqueio({ bloqueio: { nivel: 'liberado' } })).toBeNull();
    expect(extrairBloqueio(null)).toBeNull();
  });

  it('pode_prosseguir só vale quando vem explicitamente true', () => {
    expect(extrairBloqueio({ bloqueio: { nivel: 'confirmar', motivos: [] } })?.pode_prosseguir_profissional).toBe(false);
  });

  it('bloqueia exige justificativa; confirmar exige ciência', () => {
    expect(validarOverride('bloqueia', { justificativa: 'curta', ciente: true }).ok).toBe(false);
    expect(validarOverride('bloqueia', { justificativa: 'a'.repeat(15), ciente: false }).ok).toBe(false);
    const ok = validarOverride('bloqueia', { justificativa: `  ${'a'.repeat(15)}  `, ciente: true });
    expect(ok).toEqual({ ok: true, override: { justificativa: 'a'.repeat(15), ciente: true } });

    expect(validarOverride('confirmar', { ciente: false }).ok).toBe(false);
    expect(validarOverride('confirmar', { ciente: true })).toEqual({ ok: true, override: { justificativa: '', ciente: true } });
  });

  it('cliente nunca sobrepõe', () => {
    expect(validarOverride('confirmar', { justificativa: 'a'.repeat(30), ciente: true }, 'cliente').ok).toBe(false);
  });

  it('rótulos de origem em português, com fallback para o texto original', () => {
    expect(rotuloOrigemTriagem('triagem_autodeclarada, historico_clinico')).toBe('Triagem respondida pelo cliente, Histórico clínico');
    expect(rotuloOrigemTriagem('outra_coisa')).toBe('outra_coisa');
  });
});

describe('triagem autodeclarada', () => {
  const completa: RespostasTriagem = {
    gestante_lactante: 'nao', transtorno_alimentar: 'nao', doenca_renal: 'nao',
    diabetes_insulina: 'nao', cardio_pressao: 'nao', cirurgia_lesao_recente: 'nao',
  };

  it('as opções do front são as mesmas aceitas pela edge', () => {
    expect(OPCOES_TRIAGEM).toEqual(RESPOSTAS_TRIAGEM);
    expect([...CHAVES_TRIAGEM].sort()).toEqual(Object.keys(RESPOSTAS_TRIAGEM).sort());
  });

  it('só é completa com todas as seis respostas válidas', () => {
    expect(triagemCompleta(completa)).toBe(true);
    expect(triagemCompleta({ ...completa, doenca_renal: undefined })).toBe(false);
    // "não sei" não existe em cirurgia_lesao_recente
    expect(triagemCompleta({ ...completa, cirurgia_lesao_recente: 'nao_sei' })).toBe(false);
    expect(triagemCompleta({ ...completa, gestante_lactante: 'prefiro_nao_dizer' })).toBe(false);
    expect(contarRespondidas({ ...completa, doenca_renal: undefined })).toBe(5);
    expect(contarRespondidas({})).toBe(0);
  });

  it('sim, não sei e prefiro não dizer pedem atenção; tudo "não" não', () => {
    expect(triagemPedeAtencao(completa)).toBe(false);
    expect(triagemPedeAtencao({ ...completa, doenca_renal: 'sim' })).toBe(true);
    expect(triagemPedeAtencao({ ...completa, cardio_pressao: 'nao_sei' })).toBe(true);
    expect(triagemPedeAtencao({ ...completa, transtorno_alimentar: 'prefiro_nao_dizer' })).toBe(true);
  });

  it('monta o registro no formato versão 1 do contrato', () => {
    const t = montarTriagem(triagemCompletaTipada(completa), new Date('2026-10-07T15:00:00.000Z'));
    expect(t).toEqual({ versao: 1, respondida_em: '2026-10-07T15:00:00.000Z', ...completa });
  });

  it('mescla na anamnese sem perder as outras respostas', () => {
    const t = montarTriagem(triagemCompletaTipada(completa), new Date('2026-10-07T15:00:00.000Z'));
    const atual = { peso_kg: '72', objetivo: 'emagrecer', triagem: { versao: 1, gestante_lactante: 'sim' } };
    const novo = mesclarTriagem(atual, t);
    expect(novo).toMatchObject({ peso_kg: '72', objetivo: 'emagrecer' });
    expect(novo.triagem).toEqual(t);
    expect(atual.triagem).toEqual({ versao: 1, gestante_lactante: 'sim' });
  });

  it('mescla em respostas ausentes ou inválidas', () => {
    const t = montarTriagem(triagemCompletaTipada(completa));
    expect(Object.keys(mesclarTriagem(null, t))).toEqual(['triagem']);
    expect(Object.keys(mesclarTriagem([1, 2], t))).toEqual(['triagem']);
  });

  it('lê a triagem salva e ignora valores fora das opções', () => {
    const lida = lerTriagemSalva({ triagem: { respondida_em: '2026-10-01T12:00:00.000Z', gestante_lactante: 'sim', doenca_renal: 'talvez', cirurgia_lesao_recente: 'nao_sei' } });
    expect(lida.respostas).toEqual({ gestante_lactante: 'sim' });
    expect(lida.respondidaEm).toBe('2026-10-01T12:00:00.000Z');
    expect(lerTriagemSalva(null)).toEqual({ respostas: {}, respondidaEm: null });
  });
});

function triagemCompletaTipada(r: RespostasTriagem) {
  if (!triagemCompleta(r)) throw new Error('respostas incompletas');
  return r;
}

describe('SeloGovernanca', () => {
  const comAprovacao = plano(gov());

  it('profissional: mostra quem liberou, a versão e a fonte', () => {
    render(createElement(SeloGovernanca, { conteudo: comAprovacao, aprovado: true, origem: 'profissional' }));
    expect(screen.getByText(/Liberado por Ana Souza em 07\/10\/2026 · v2 · Fonte: IA \(gemini-2\.5-flash\) \+ revisão profissional/)).toBeTruthy();
  });

  it('plano legado liberado mostra que não há registro de aprovação', () => {
    render(createElement(SeloGovernanca, { conteudo: { titulo: 'x' }, aprovado: true, origem: 'profissional', compacto: true }));
    expect(screen.getByText('Liberado antes do registro de aprovação')).toBeTruthy();
  });

  it('planos_ia_cliente: nunca afirma liberação ou aprovação, mesmo com aprovação forjada no conteúdo', () => {
    const { container } = render(createElement(SeloGovernanca, { conteudo: comAprovacao, aprovado: true, origem: 'cliente', visao: 'paciente' }));
    const texto = container.textContent ?? '';
    expect(texto).toContain('Gerado por IA · sem revisão de profissional');
    expect(texto).not.toMatch(/liberado/i);
    expect(texto).not.toMatch(/aprovad/i);
    expect(texto).not.toContain('Ana Souza');
    expect(texto).not.toMatch(/revisão profissional/);
  });

  it('paciente não vê a justificativa do profissional', () => {
    const c = plano(gov({ aprovacao: { por_nome: 'Ana', em: '2026-10-07T15:00:00.000Z', versao: 1, justificativa: 'segredo clínico do profissional' } }));
    const { container } = render(createElement(SeloGovernanca, { conteudo: c, aprovado: true, origem: 'profissional', visao: 'paciente' }));
    expect(container.textContent).not.toContain('segredo clínico');
    expect(screen.queryByText('Ver justificativa')).toBeNull();
  });

  it('profissional vê o botão para abrir a justificativa', () => {
    const c = plano(gov({ aprovacao: { por_nome: 'Ana', em: '2026-10-07T15:00:00.000Z', versao: 1, justificativa: 'segredo clínico do profissional' } }));
    render(createElement(SeloGovernanca, { conteudo: c, aprovado: true, origem: 'profissional', visao: 'profissional' }));
    expect(screen.getByText('Ver justificativa')).toBeTruthy();
  });
});

describe('ResumoAcompanhamento', () => {
  it('mostra indicadores e a data de reavaliação', () => {
    render(createElement(ResumoAcompanhamento, { conteudo: plano(gov()) }));
    expect(screen.getByText(/Reavaliar em 4 semanas \(até 04\/11\/2026\)/)).toBeTruthy();
    expect(screen.getByText('Dor durante o treino (0 a 10)')).toBeTruthy();
  });

  it('plano sem acompanhamento não renderiza nada', () => {
    const { container } = render(createElement(ResumoAcompanhamento, { conteudo: { titulo: 'x' } }));
    expect(container.innerHTML).toBe('');
  });
});
