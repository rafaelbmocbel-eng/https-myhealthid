import { describe, expect, it, vi } from 'vitest';
import {
  carregarMotoresClinicos,
  clientePodeGerar,
  insumosDosMotores,
  montarEntradaTriagem,
  textoPresencial,
  textoQueixaDoCliente,
} from '../../supabase/functions/_shared/motores-plano';
import {
  barreiraDoCliente,
  contaPodeGerarPlano,
  dadosDoPedido,
  entregarPlano,
  gravarParaChancela,
  insumosDoPlano,
  limitarPedidoAlimentarCliente,
  limitarPedidoTreinoCliente,
  MENSAGEM_CLIENTE_SEM_PREMIUM,
  MENSAGEM_ERRO_ENVIO_REVISAO,
  MENSAGEM_ERRO_VERIFICACAO,
  mensagemPlanoEmRevisao,
  planejarEntregaPlano,
  planoJaEmRevisao,
  podeUsarFontesDoProfissional,
  POLITICA_PLANO_CLIENTE,
  respostaPlanoEmRevisao,
  restringirAInsumosDoCliente,
  STATUS_HTTP_PLANO_EM_REVISAO,
  STATUS_HTTP_SEM_PREMIUM,
  STATUS_HTTP_VERIFICACAO,
} from '../../supabase/functions/_shared/plano-cliente';
import { alvoDaRevisao } from '../../supabase/functions/_shared/revisao-seguranca';
import { avaliarTriagem } from '../../supabase/functions/_shared/triagem-bloqueio';

type Resultado = { data?: unknown; error?: { message: string } | null };

function fakeAdmin(tabelas: Record<string, Resultado>) {
  return {
    from(tabela: string) {
      const res: Resultado = { data: null, error: null, ...(tabelas[tabela] ?? {}) };
      const chain: Record<string, unknown> = {};
      const volta = () => chain;
      chain.select = volta;
      for (const m of ['eq', 'neq', 'order', 'limit', 'not', 'overlaps']) chain[m] = volta;
      chain.maybeSingle = () => Promise.resolve(res);
      chain.then = (ok: (r: Resultado) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(res).then(ok, ko);
      return chain;
    },
  };
}

const PAC = 'b0000000-0000-4000-8000-000000000001';

const PLANO = {
  titulo: '  Plano de treino A  ',
  resumo: 'texto do plano que o cliente NÃO pode receber antes da chancela',
  fases: [{ nome: 'Fase 1', semanas: 4, sessoes: [] }],
  _governanca: { versao: 1, triagem: { nivel: 'liberado', motivos: [], override: null } },
};

describe('política: quem paga pode gerar', () => {
  it('só wellness_premium: o teste grátis e a conta clínica não geram', () => {
    expect(POLITICA_PLANO_CLIENTE.tiposContaQueGeram).toEqual(['wellness_premium']);
    expect(contaPodeGerarPlano('wellness_premium')).toBe(true);
    for (const t of ['wellness_free', 'clinico', '', null, undefined]) expect(contaPodeGerarPlano(t)).toBe(false);
    expect(clientePodeGerar({ tipo_conta: 'wellness_premium' })).toBe(true);
    expect(clientePodeGerar({ tipo_conta: 'wellness_free' })).toBe(false);
  });

  it('a recusa por falta de pagamento é HTTP 402 com mensagem acolhedora e indica um profissional', () => {
    expect(STATUS_HTTP_SEM_PREMIUM).toBe(402);
    expect(MENSAGEM_CLIENTE_SEM_PREMIUM).toMatch(/Premium/);
    expect(MENSAGEM_CLIENTE_SEM_PREMIUM).toMatch(/profissional que use o MyHealthID/);
  });
});

describe('insumos só do cliente', () => {
  const completos = {
    scores: { D: 5 }, queixa: 'dor no ombro', historia: 'Queixa: dor', condicoes: 'hipertensão',
    presencial: [{ regiao_id: 'ombro_d', tipo_achado: 'tendinopatia', notas_clinicas: 'paciente grávida, evitar carga' }],
    exames: [{ tipo: 'bioimpedancia', data_exame: '2026-09-01', resumo: 'gordura 30%', dados: {} }],
    questionarios: [{ instrumento: 'psfs', escore: 5, classificacao: 'x', respostas: {} }],
    avaliacaoVoz: { _secoes: { condutas_profissional: 'tratar iliopsoas' } },
    paciente: { dataNascimento: '1990-05-20', idade: 36, genero: 'feminino', sexo: null },
    medicamentos: 'losartana', alergias: 'amendoim', historicoClinico: { doencas_cronicas: { condicoes: ['Hipertensão arterial'], detalhes: '' } },
    anamnese: { restricoes_alergias: 'lactose', triagem: { gestante_lactante: 'nao' } },
    triagemAutodeclarada: { gestante_lactante: 'nao' }, parq: null, myidRedFlags: false, avaliacaoRedFlags: true, falhasLeitura: [],
  } as unknown as Parameters<typeof textoPresencial>[0];

  it('restringirAInsumosDoCliente tira presencial, exames, avaliação por voz e seus red flags, sem mutar', () => {
    const r = restringirAInsumosDoCliente(completos)!;
    expect(r.presencial).toEqual([]);
    expect(r.exames).toEqual([]);
    expect(r.avaliacaoVoz).toBeNull();
    expect(r.avaliacaoRedFlags).toBe(false);
    expect(r.scores).toEqual({ D: 5 });
    expect(r.questionarios).toHaveLength(1);
    expect(r.historicoClinico).toEqual(completos.historicoClinico);
    expect(r.anamnese).toEqual(completos.anamnese);
    expect(r.queixa).toBe('dor no ombro');
    expect(completos.presencial).toHaveLength(1);
    expect(completos.avaliacaoRedFlags).toBe(true);
    expect(restringirAInsumosDoCliente(null)).toBeNull();
  });

  it('o texto do prompt do cliente não traz achados, notas, exames nem condutas do profissional', () => {
    const doCliente = restringirAInsumosDoCliente(completos)!;
    const texto = textoQueixaDoCliente(doCliente);
    expect(texto).toContain('dor no ombro');
    expect(texto).toContain('hipertensão');
    expect(texto).not.toMatch(/grávida|iliopsoas|gordura 30|obs\. do profissional|PROFISSIONAL/i);
    // o caminho do profissional continua trazendo tudo isso
    const doProfissional = textoPresencial(completos, 'treino');
    expect(doProfissional).toContain('grávida');
    expect(doProfissional).toContain('iliopsoas');
    expect(textoQueixaDoCliente({ ...doCliente, queixa: null, historia: null, condicoes: null })).toBe('');
  });

  it('os insumos registrados refletem o que de fato entrou', () => {
    const completoIns = insumosDosMotores(completos, 'treino');
    expect(completoIns).toContain('avaliacao_presencial');
    const clienteIns = insumosDosMotores(restringirAInsumosDoCliente(completos), 'nutricao');
    expect(clienteIns).not.toContain('avaliacao_presencial');
    expect(clienteIns).toEqual(expect.arrayContaining(['MyID', 'questionarios', 'historico_clinico', 'anamnese', 'queixa_historia_atual']));
  });

  it('a triagem continua lendo os motores COMPLETOS: a nota do profissional ainda bloqueia o cliente', () => {
    const limpo = {
      ...(completos as object), condicoes: null, historicoClinico: null, medicamentos: null, avaliacaoVoz: null, avaliacaoRedFlags: false,
      anamnese: { restricoes_alergias: 'lactose' },
      triagemAutodeclarada: {
        gestante_lactante: 'nao', transtorno_alimentar: 'nao', doenca_renal: 'nao',
        diabetes_insulina: 'nao', cardio_pressao: 'nao', cirurgia_lesao_recente: 'nao',
      },
    } as unknown as Parameters<typeof textoPresencial>[0];
    const cheia = avaliarTriagem(montarEntradaTriagem({ foco: 'nutricao', chamador: 'cliente', motores: limpo }));
    expect(cheia.nivel).toBe('bloqueia');
    expect(cheia.motivos.some((m) => m.origem === 'profissional')).toBe(true);
    const soCliente = avaliarTriagem(montarEntradaTriagem({
      foco: 'nutricao', chamador: 'cliente', motores: restringirAInsumosDoCliente(limpo),
    }));
    expect(soCliente.nivel).toBe('liberado');
  });

  it('carregarMotoresClinicos aceita a opção apenasInsumosDoCliente', async () => {
    const admin = fakeAdmin({
      pacientes: { data: { queixa_principal: 'dor', historia_atual: null, condicoes_preexistentes: null, alergias: null, medicamentos_uso: null, historico_clinico: null, data_nascimento: '1990-05-20', genero: null, sexo: null } },
      eventos_clinicos_anatomicos: { data: [{ regiao_id: 'ombro_d', tipo_achado: 'tendinopatia', notas_clinicas: 'nota do profissional' }] },
      exames_presenciais: { data: [{ tipo: 'bioimpedancia', data_exame: '2026-09-01', resumo: 'gordura 30%', dados: {} }] },
      avaliacoes_voz: { data: { resultado: { _secoes: { condutas_profissional: 'tratar iliopsoas' } } } },
      myid_avaliacoes: { data: { resultado_processado: { scores: { D: 5 } } } },
    });
    const completo = await carregarMotoresClinicos(admin, 'p1');
    expect(completo.presencial).toHaveLength(1);
    expect(completo.exames).toHaveLength(1);
    expect(completo.avaliacaoVoz).not.toBeNull();

    const doCliente = await carregarMotoresClinicos(admin, 'p1', { apenasInsumosDoCliente: true });
    expect(doCliente.presencial).toEqual([]);
    expect(doCliente.exames).toEqual([]);
    expect(doCliente.avaliacaoVoz).toBeNull();
    expect(doCliente.scores).toEqual({ D: 5 });
    expect(doCliente.queixa).toBe('dor');
    expect(doCliente.paciente.idade).not.toBeNull();
  });

  it('dados do corpo do pedido: do cliente não se aceita antropometria, testes nem recordatório', () => {
    const corpo = { antropometria: { peso: 70 }, testes: [{ n: 1 }], recordatorio: { x: 1 } };
    expect(dadosDoPedido('cliente', corpo)).toEqual({ antropometria: null, testes: null, recordatorio: null });
    expect(dadosDoPedido('profissional', corpo)).toEqual(corpo);
    expect(podeUsarFontesDoProfissional('cliente')).toBe(false);
    expect(podeUsarFontesDoProfissional('profissional')).toBe(true);
  });

  it('insumosDoPlano: o cliente nunca registra fonte do profissional; sem duplicatas', () => {
    const todos = [
      'MyID', 'questionarios', 'avaliacao_presencial', 'historico_clinico', 'anamnese', 'queixa_historia_atual',
      'antropometria', 'testes_funcionais', 'recordatorio_24h', 'bioimpedancia', 'restricoes_informadas', 'biblioteca_exercicios', 'MyID',
    ];
    expect(insumosDoPlano('cliente', todos)).toEqual([
      'MyID', 'questionarios', 'historico_clinico', 'anamnese', 'queixa_historia_atual', 'restricoes_informadas', 'biblioteca_exercicios',
    ]);
    expect(insumosDoPlano('profissional', todos)).toContain('avaliacao_presencial');
    expect(insumosDoPlano('profissional', todos)).toContain('bioimpedancia');
    expect(new Set(insumosDoPlano('profissional', todos)).size).toBe(insumosDoPlano('profissional', todos).length);
  });
});

describe('destino do plano gerado', () => {
  it('profissional: devolve o plano (fluxo atual, nada vai para a fila)', () => {
    expect(planejarEntregaPlano({ chamador: 'profissional', tipo: 'treino', pacienteId: PAC, plano: PLANO })).toEqual({ destino: 'devolver', registro: null, erro: null });
  });

  it('cliente: vai para a fila de chancela com título, objetivo e conteúdo (sem alterar o plano)', () => {
    const e = planejarEntregaPlano({ chamador: 'cliente', tipo: 'treino', pacienteId: PAC, plano: PLANO, objetivo: '  hipertrofia  ' });
    expect(e.destino).toBe('fila_chancela');
    expect(e.erro).toBeNull();
    expect(e.registro).toEqual({ p_paciente_id: PAC, p_tipo: 'treino', p_titulo: 'Plano de treino A', p_objetivo: 'hipertrofia', p_conteudo: PLANO });
    expect(e.registro!.p_conteudo).toBe(PLANO);
  });

  it('cliente sem paciente ou com plano inválido: erro, nunca "devolver"', () => {
    for (const plano of [null, undefined, [1], 'texto']) {
      const e = planejarEntregaPlano({ chamador: 'cliente', tipo: 'nutricao', pacienteId: PAC, plano });
      expect(e.destino).toBe('fila_chancela');
      expect(e.registro).toBeNull();
      expect(e.erro).toBeTruthy();
    }
    expect(planejarEntregaPlano({ chamador: 'cliente', tipo: 'nutricao', pacienteId: null, plano: PLANO }).erro).toBeTruthy();
  });

  it('respostaPlanoEmRevisao é só { ok, em_revisao, plano_id }', () => {
    expect(respostaPlanoEmRevisao('uuid-1')).toEqual({ ok: true, em_revisao: true, plano_id: 'uuid-1' });
  });
});

describe('entregarPlano', () => {
  const rpcOk = (id: string | null = 'plano-1') => ({ rpc: vi.fn().mockResolvedValue({ data: id, error: null }) });

  it('profissional recebe { ok, plano } mais os extras, sem tocar na fila', async () => {
    const admin = rpcOk();
    const r = await entregarPlano(admin, { chamador: 'profissional', tipo: 'treino', pacienteId: PAC, plano: PLANO, extrasProfissional: { usou_banco: true } });
    expect(r.status).toBe(200);
    expect(r.corpo).toEqual({ ok: true, plano: PLANO, usou_banco: true });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('cliente: grava na fila e responde em revisão SEM o conteúdo do plano', async () => {
    const admin = rpcOk('plano-9');
    const r = await entregarPlano(admin, { chamador: 'cliente', tipo: 'nutricao', pacienteId: PAC, plano: PLANO, objetivo: 'emagrecer' });
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith('registrar_plano_cliente_chancela', {
      p_paciente_id: PAC, p_tipo: 'nutricao', p_titulo: 'Plano de treino A', p_objetivo: 'emagrecer', p_conteudo: PLANO,
    });
    expect(r.status).toBe(200);
    expect(r.corpo).toEqual({ ok: true, em_revisao: true, plano_id: 'plano-9' });
    const texto = JSON.stringify(r.corpo);
    expect(texto).not.toContain('NÃO pode receber');
    expect(texto).not.toContain('_governanca');
    expect(r.corpo).not.toHaveProperty('plano');
  });

  it('se a gravação falhar, responde erro: não finge sucesso nem entrega o plano', async () => {
    const casos = [
      { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }) },
      { rpc: vi.fn().mockRejectedValue(new Error('rede')) },
      { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) },
      { rpc: vi.fn().mockResolvedValue({ data: 123, error: null }) },
    ];
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const admin of casos) {
      const r = await entregarPlano(admin, { chamador: 'cliente', tipo: 'treino', pacienteId: PAC, plano: PLANO });
      expect(r.status).toBe(500);
      expect(r.corpo).toEqual({ error: MENSAGEM_ERRO_ENVIO_REVISAO });
    }
    const semPlano = await entregarPlano(rpcOk(), { chamador: 'cliente', tipo: 'treino', pacienteId: PAC, plano: null });
    expect(semPlano.status).toBe(500);
    erro.mockRestore();
  });

  it('gravarParaChancela devolve o id gravado', async () => {
    const admin = rpcOk('abc');
    expect(await gravarParaChancela(admin, { p_paciente_id: PAC, p_tipo: 'treino', p_titulo: null, p_objetivo: null, p_conteudo: {} }))
      .toEqual({ ok: true, planoId: 'abc', erro: null });
  });
});

describe('revisão de segurança aceita a tabela do cliente', () => {
  it('alvoDaRevisao: tabela nova lê a coluna conteudo; sem tabela vale o tipo', () => {
    expect(alvoDaRevisao('treino', 'plano_cliente_chancela')).toEqual({ tabela: 'plano_cliente_chancela', coluna: 'conteudo' });
    expect(alvoDaRevisao(undefined, 'plano_cliente_chancela')).toEqual({ tabela: 'plano_cliente_chancela', coluna: 'conteudo' });
    expect(alvoDaRevisao('treino')).toEqual({ tabela: 'planos_treino', coluna: 'estrutura' });
    expect(alvoDaRevisao('nutricao', 'outra')).toEqual({ tabela: 'planos_alimentares', coluna: 'plano' });
    expect(alvoDaRevisao('diretriz')).toBeNull();
  });
});

describe('o cliente só gera se pagar e só um plano por tipo fica na fila (antes de gastar IA)', () => {
  const PREMIUM = { tipo_conta: 'wellness_premium' };

  /** Admin que registra os filtros da consulta e devolve a resposta combinada. */
  function adminDaFila(resposta: Resultado | Error) {
    const filtros: [string, unknown][] = [];
    let tabela = '';
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = (coluna: string, valor: unknown) => {
      filtros.push([coluna, valor]);
      return chain;
    };
    chain.limit = () => chain;
    chain.maybeSingle = () => (resposta instanceof Error ? Promise.reject(resposta) : Promise.resolve({ data: null, error: null, ...resposta }));
    return { admin: { from: (t: string) => { tabela = t; return chain; } }, filtros, tabela: () => tabela };
  }

  it('profissional passa direto, sem consultar a fila', async () => {
    const f = adminDaFila({ data: { id: 'x' } });
    expect(await barreiraDoCliente(f.admin, { chamador: 'profissional', tipo: 'treino', pacienteId: PAC, paciente: { tipo_conta: 'clinico' } })).toBeNull();
    expect(f.filtros).toEqual([]);
  });

  it('cliente sem Premium: 402 acolhedor, e nem consulta a fila', async () => {
    for (const tipo_conta of ['wellness_free', 'clinico', null]) {
      const f = adminDaFila({ data: null });
      const r = await barreiraDoCliente(f.admin, { chamador: 'cliente', tipo: 'nutricao', pacienteId: PAC, paciente: { tipo_conta } });
      expect(r).toEqual({ status: STATUS_HTTP_SEM_PREMIUM, corpo: { error: MENSAGEM_CLIENTE_SEM_PREMIUM, codigo: 'premium_necessario' } });
      expect(f.filtros).toEqual([]);
    }
    const semCadastro = await barreiraDoCliente(adminDaFila({ data: null }).admin, { chamador: 'cliente', tipo: 'treino', pacienteId: PAC, paciente: null });
    expect(semCadastro?.status).toBe(STATUS_HTTP_SEM_PREMIUM);
  });

  it('cliente Premium sem plano aguardando segue; a consulta filtra paciente, tipo e status', async () => {
    const f = adminDaFila({ data: null });
    expect(await barreiraDoCliente(f.admin, { chamador: 'cliente', tipo: 'treino', pacienteId: PAC, paciente: PREMIUM })).toBeNull();
    expect(f.tabela()).toBe('plano_cliente_chancela');
    expect(f.filtros).toEqual([['paciente_id', PAC], ['tipo', 'treino'], ['status', 'aguardando']]);
  });

  it('cliente Premium com plano aguardando: 409 com mensagem do tipo, sem gerar outro', async () => {
    for (const tipo of ['treino', 'nutricao'] as const) {
      const r = await barreiraDoCliente(adminDaFila({ data: { id: 'p1' } }).admin, { chamador: 'cliente', tipo, pacienteId: PAC, paciente: PREMIUM });
      expect(r).toEqual({ status: STATUS_HTTP_PLANO_EM_REVISAO, corpo: { error: mensagemPlanoEmRevisao(tipo), codigo: 'plano_em_revisao' } });
    }
    expect(STATUS_HTTP_PLANO_EM_REVISAO).toBe(409);
    expect(mensagemPlanoEmRevisao('treino')).toMatch(/treino aguardando a revisão da equipe científica/);
    expect(mensagemPlanoEmRevisao('nutricao')).toMatch(/plano alimentar aguardando/);
  });

  it('não dá para verificar a fila: 503, nunca "sem dados = liberado"', async () => {
    for (const resposta of [{ error: { message: 'boom' } }, new Error('rede')]) {
      const r = await barreiraDoCliente(adminDaFila(resposta).admin, { chamador: 'cliente', tipo: 'treino', pacienteId: PAC, paciente: PREMIUM });
      expect(r).toEqual({ status: STATUS_HTTP_VERIFICACAO, corpo: { error: MENSAGEM_ERRO_VERIFICACAO } });
    }
    expect(await planoJaEmRevisao(adminDaFila({ data: { id: 'p1' } }).admin, PAC, 'treino')).toBe('sim');
    expect(await planoJaEmRevisao(adminDaFila({ data: null }).admin, PAC, 'treino')).toBe('nao');
  });

  it('cliente sem cadastro resolvido: 403', async () => {
    const r = await barreiraDoCliente(adminDaFila({ data: null }).admin, { chamador: 'cliente', tipo: 'treino', pacienteId: null, paciente: PREMIUM });
    expect(r?.status).toBe(403);
  });

  it('corrida entre duas gerações: o banco recusa a segunda e a resposta é 409, sem plano e sem fingir sucesso', async () => {
    const erroBanco = { message: 'plano_em_revisao: já existe um plano deste tipo aguardando a equipe científica.', hint: 'plano_em_revisao' };
    const admin = { rpc: vi.fn().mockResolvedValue({ data: null, error: erroBanco }) };
    expect(await gravarParaChancela(admin, { p_paciente_id: PAC, p_tipo: 'treino', p_titulo: null, p_objetivo: null, p_conteudo: {} }))
      .toMatchObject({ ok: false, planoId: null, jaEmRevisao: true });
    const r = await entregarPlano(admin, { chamador: 'cliente', tipo: 'treino', pacienteId: PAC, plano: PLANO });
    expect(r.status).toBe(409);
    expect(r.corpo).toEqual({ error: mensagemPlanoEmRevisao('treino'), codigo: 'plano_em_revisao' });
    expect(r.corpo).not.toHaveProperty('plano');
    // só a marca do banco vale: outro erro continua sendo 500
    const erro = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const outro = await entregarPlano({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }) }, { chamador: 'cliente', tipo: 'treino', pacienteId: PAC, plano: PLANO });
    expect(outro.status).toBe(500);
    erro.mockRestore();
  });
});

describe('pedido do cliente tem tetos no servidor', () => {
  const l = POLITICA_PLANO_CLIENTE.limitesPedido;

  it('os valores padrão ficam dentro dos próprios tetos', () => {
    for (const faixa of [l.frequenciaSemanal, l.duracaoSemanas, l.refeicoesPorDia]) {
      expect(faixa.min).toBeLessThanOrEqual(faixa.padrao);
      expect(faixa.padrao).toBeLessThanOrEqual(faixa.max);
    }
    expect(l.niveisTreino).toContain(l.nivelTreinoPadrao);
  });

  it('treino: frequência, duração e nível são normalizados; textos são cortados', () => {
    const r = limitarPedidoTreinoCliente({
      objetivo: 'x'.repeat(5000), nivel: 'DEUS', frequencia_semanal: 40, duracao_semanas: 5000,
      restricoes: 'r'.repeat(99999), idade: 500, sexo: 's'.repeat(500),
    });
    expect(r.frequencia_semanal).toBe(l.frequenciaSemanal.max);
    expect(r.duracao_semanas).toBe(l.duracaoSemanas.max);
    expect(r.nivel).toBe(l.nivelTreinoPadrao);
    expect(r.objetivo).toHaveLength(l.textoMax.objetivo);
    expect(r.restricoes).toHaveLength(l.textoMax.restricoes);
    expect(r.sexo).toHaveLength(l.textoMax.sexo);
    expect(r.idade).toBeNull();
    const baixo = limitarPedidoTreinoCliente({ objetivo: 'a', nivel: 'a', frequencia_semanal: -3, duracao_semanas: 0 });
    expect(baixo.frequencia_semanal).toBe(l.frequenciaSemanal.min);
    expect(baixo.duracao_semanas).toBe(l.duracaoSemanas.min);
  });

  it('treino: o pedido normal do portal passa intacto', () => {
    expect(limitarPedidoTreinoCliente({
      objetivo: '  Emagrecer  ', nivel: 'iniciante', frequencia_semanal: 3, duracao_semanas: 8, restricoes: 'joelho', idade: 34, sexo: 'feminino',
    })).toEqual({ objetivo: 'Emagrecer', nivel: 'iniciante', frequencia_semanal: 3, duracao_semanas: 8, restricoes: 'joelho', idade: 34, sexo: 'feminino' });
    expect(limitarPedidoTreinoCliente({ nivel: ' Avancado ' }).nivel).toBe('avancado');
  });

  it('treino: entrada inválida (null, tipos errados) nunca lança e cai nos padrões', () => {
    for (const b of [null, undefined, {}, { objetivo: 7, nivel: {}, frequencia_semanal: 'abc', duracao_semanas: NaN, restricoes: [], idade: 'x', sexo: 3 }]) {
      const r = limitarPedidoTreinoCliente(b as never);
      expect(r).toMatchObject({ objetivo: '', restricoes: '', sexo: '', idade: null, nivel: l.nivelTreinoPadrao, frequencia_semanal: l.frequenciaSemanal.padrao, duracao_semanas: l.duracaoSemanas.padrao });
    }
  });

  it('alimentar: refeições entre os tetos, textos cortados, atividade limitada', () => {
    const r = limitarPedidoAlimentarCliente({
      objetivo: 'o'.repeat(2000), refeicoes_por_dia: 99, restricoes: 'r'.repeat(9999), preferencias: 'p'.repeat(9999),
      nivel_atividade: 'n'.repeat(999), idade: 0, sexo: 'feminino',
    });
    expect(r.refeicoes_por_dia).toBe(l.refeicoesPorDia.max);
    expect(r.objetivo).toHaveLength(l.textoMax.objetivo);
    expect(r.restricoes).toHaveLength(l.textoMax.restricoes);
    expect(r.preferencias).toHaveLength(l.textoMax.preferencias);
    expect(r.nivel_atividade).toHaveLength(l.textoMax.nivelAtividade);
    expect(r.idade).toBeNull();
    expect(limitarPedidoAlimentarCliente({ refeicoes_por_dia: 1 }).refeicoes_por_dia).toBe(l.refeicoesPorDia.min);
    expect(limitarPedidoAlimentarCliente({}).refeicoes_por_dia).toBe(l.refeicoesPorDia.padrao);
  });

  it('alimentar: o pedido normal do portal passa intacto', () => {
    expect(limitarPedidoAlimentarCliente({
      objetivo: 'Emagrecer', refeicoes_por_dia: 4, restricoes: 'lactose', preferencias: 'sem peixe', idade: 30, sexo: 'feminino', nivel_atividade: 'leve',
    })).toEqual({ objetivo: 'Emagrecer', refeicoes_por_dia: 4, restricoes: 'lactose', preferencias: 'sem peixe', idade: 30, sexo: 'feminino', nivel_atividade: 'leve' });
  });
});
