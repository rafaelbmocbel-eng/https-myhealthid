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
  barreiraDoProfissional,
  CODIGO_NUTRICAO_EM_BREVE,
  CODIGO_PROFISSIONAL_NAO_VERIFICADO,
  contaPodeGerarPlano,
  dadosDoPedido,
  entregarPlano,
  estadoDaNutricaoPremium,
  estadoDoPedido,
  gravarParaChancela,
  insumosDoPlano,
  limitarPedidoAlimentarCliente,
  limitarPedidoTreinoCliente,
  MENSAGEM_CLIENTE_SEM_PREMIUM,
  MENSAGEM_ERRO_ENVIO_REVISAO,
  MENSAGEM_ERRO_VERIFICACAO,
  MENSAGEM_NUTRICAO_EM_BREVE,
  MENSAGEM_PROFISSIONAL_NAO_VERIFICADO,
  mensagemLimitePedidos,
  mensagemPlanoEmRevisao,
  planejarEntregaPlano,
  podeUsarFontesDoProfissional,
  POLITICA_PLANO_CLIENTE,
  profissionalFoiVerificado,
  respostaPlanoEmRevisao,
  restringirAInsumosDoCliente,
  STATUS_HTTP_LIMITE_PEDIDOS,
  STATUS_HTTP_NUTRICAO_EM_BREVE,
  STATUS_HTTP_PLANO_EM_REVISAO,
  STATUS_HTTP_PROFISSIONAL_NAO_VERIFICADO,
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

describe('o cliente só gera se pagar e só um plano por tipo fica na fila, dentro do prazo (antes de gastar IA)', () => {
  const PREMIUM = { tipo_conta: 'wellness_premium' };

  /** Admin que responde por RPC e registra as chamadas. */
  function adminRpc(respostas: Record<string, Resultado | Error>) {
    const chamadas: [string, Record<string, unknown> | undefined][] = [];
    const admin = {
      rpc: (nome: string, args?: Record<string, unknown>) => {
        chamadas.push([nome, args]);
        const r = respostas[nome];
        if (r instanceof Error) return Promise.reject(r);
        return Promise.resolve({ data: null, error: null, ...(r ?? {}) });
      },
    };
    return { admin, chamadas };
  }
  const NUTRICAO_LIGADA = { plano_cliente_config: { data: { nutricao_premium_ativa: true, prazo_chancela_dias_uteis: 2 } } };

  it('profissional passa direto neste filtro, sem consultar o banco', async () => {
    const f = adminRpc({ plano_cliente_estado_pedido: { data: 'no_prazo' } });
    expect(await barreiraDoCliente(f.admin, { chamador: 'profissional', tipo: 'treino', pacienteId: PAC, paciente: { tipo_conta: 'clinico' } })).toBeNull();
    expect(f.chamadas).toEqual([]);
  });

  it('cliente sem Premium: 402 acolhedor, e nem consulta a fila', async () => {
    for (const tipo_conta of ['wellness_free', 'clinico', null]) {
      const f = adminRpc({ ...NUTRICAO_LIGADA });
      const r = await barreiraDoCliente(f.admin, { chamador: 'cliente', tipo: 'nutricao', pacienteId: PAC, paciente: { tipo_conta } });
      expect(r).toEqual({ status: STATUS_HTTP_SEM_PREMIUM, corpo: { error: MENSAGEM_CLIENTE_SEM_PREMIUM, codigo: 'premium_necessario' } });
      expect(f.chamadas.map((c) => c[0])).not.toContain('plano_cliente_estado_pedido');
    }
    const semCadastro = await barreiraDoCliente(adminRpc({}).admin, { chamador: 'cliente', tipo: 'treino', pacienteId: PAC, paciente: null });
    expect(semCadastro?.status).toBe(STATUS_HTTP_SEM_PREMIUM);
  });

  it('cliente Premium sem pedido aguardando segue; a consulta usa o paciente e o tipo', async () => {
    const f = adminRpc({ plano_cliente_estado_pedido: { data: 'nenhum' } });
    expect(await barreiraDoCliente(f.admin, { chamador: 'cliente', tipo: 'treino', pacienteId: PAC, paciente: PREMIUM })).toBeNull();
    expect(f.chamadas).toEqual([['plano_cliente_estado_pedido', { p_paciente_id: PAC, p_tipo: 'treino' }]]);
  });

  it('cliente Premium com pedido NO PRAZO: 409 com mensagem do tipo, sem gerar outro', async () => {
    for (const tipo of ['treino', 'nutricao'] as const) {
      const r = await barreiraDoCliente(
        adminRpc({ ...NUTRICAO_LIGADA, plano_cliente_estado_pedido: { data: 'no_prazo' } }).admin,
        { chamador: 'cliente', tipo, pacienteId: PAC, paciente: PREMIUM },
      );
      expect(r).toEqual({ status: STATUS_HTTP_PLANO_EM_REVISAO, corpo: { error: mensagemPlanoEmRevisao(tipo), codigo: 'plano_em_revisao' } });
    }
    expect(STATUS_HTTP_PLANO_EM_REVISAO).toBe(409);
    expect(mensagemPlanoEmRevisao('treino')).toMatch(/treino aguardando a revisão da equipe científica/);
    expect(mensagemPlanoEmRevisao('nutricao')).toMatch(/plano alimentar aguardando/);
  });

  it('pedido que ESTOUROU o prazo não barra: o banco o substitui ao gravar o novo', async () => {
    for (const tipo of ['treino', 'nutricao'] as const) {
      const r = await barreiraDoCliente(
        adminRpc({ ...NUTRICAO_LIGADA, plano_cliente_estado_pedido: { data: 'atrasado' } }).admin,
        { chamador: 'cliente', tipo, pacienteId: PAC, paciente: PREMIUM },
      );
      expect(r).toBeNull();
    }
  });

  it('não dá para verificar o pedido: 503, nunca "sem dados = liberado"', async () => {
    for (const resposta of [{ error: { message: 'boom' } }, new Error('rede'), { data: 'qualquer' }, { data: null }]) {
      const r = await barreiraDoCliente(
        adminRpc({ plano_cliente_estado_pedido: resposta }).admin,
        { chamador: 'cliente', tipo: 'treino', pacienteId: PAC, paciente: PREMIUM },
      );
      expect(r).toEqual({ status: STATUS_HTTP_VERIFICACAO, corpo: { error: MENSAGEM_ERRO_VERIFICACAO } });
    }
    expect(await estadoDoPedido(adminRpc({ plano_cliente_estado_pedido: { data: 'no_prazo' } }).admin, PAC, 'treino')).toBe('no_prazo');
    expect(await estadoDoPedido(adminRpc({ plano_cliente_estado_pedido: { data: 'atrasado' } }).admin, PAC, 'treino')).toBe('atrasado');
    expect(await estadoDoPedido(adminRpc({ plano_cliente_estado_pedido: { data: 'nenhum' } }).admin, PAC, 'treino')).toBe('nenhum');
  });

  it('teto de pedidos em 24h (cancelar libera o seguinte, então o teto vale mesmo sem pedido aguardando): 429 antes da IA', async () => {
    for (const tipo of ['treino', 'nutricao'] as const) {
      const f = adminRpc({ ...NUTRICAO_LIGADA, plano_cliente_estado_pedido: { data: 'limite' } });
      const r = await barreiraDoCliente(f.admin, { chamador: 'cliente', tipo, pacienteId: PAC, paciente: PREMIUM });
      expect(r).toEqual({ status: STATUS_HTTP_LIMITE_PEDIDOS, corpo: { error: mensagemLimitePedidos(tipo), codigo: 'limite_pedidos' } });
    }
    expect(STATUS_HTTP_LIMITE_PEDIDOS).toBe(429);
    expect(mensagemLimitePedidos('treino')).toMatch(/do seu treino nas últimas 24 horas/);
    expect(mensagemLimitePedidos('nutricao')).toMatch(/do seu plano alimentar nas últimas 24 horas/);
    expect(mensagemLimitePedidos('treino')).not.toMatch(/\d+ pedidos/);
    expect(await estadoDoPedido(adminRpc({ plano_cliente_estado_pedido: { data: 'limite' } }).admin, PAC, 'treino')).toBe('limite');
  });

  it('o profissional não esbarra no teto do cliente', async () => {
    const f = adminRpc({ plano_cliente_estado_pedido: { data: 'limite' } });
    expect(await barreiraDoCliente(f.admin, { chamador: 'profissional', tipo: 'treino', pacienteId: PAC, paciente: PREMIUM })).toBeNull();
    expect(f.chamadas).toEqual([]);
  });

  it('corrida entre gerações no teto: o banco recusa com limite_pedidos e a resposta é 429, sem plano', async () => {
    const erroBanco = { message: 'limite_pedidos: o cliente já fez pedidos demais deste tipo de plano nas últimas 24 horas.', hint: 'limite_pedidos' };
    const admin = { rpc: vi.fn().mockResolvedValue({ data: null, error: erroBanco }) };
    expect(await gravarParaChancela(admin, { p_paciente_id: PAC, p_tipo: 'nutricao', p_titulo: null, p_objetivo: null, p_conteudo: {} }))
      .toMatchObject({ ok: false, planoId: null, limitePedidos: true });
    const r = await entregarPlano(admin, { chamador: 'cliente', tipo: 'nutricao', pacienteId: PAC, plano: PLANO });
    expect(r.status).toBe(429);
    expect(r.corpo).toEqual({ error: mensagemLimitePedidos('nutricao'), codigo: 'limite_pedidos' });
    expect(r.corpo).not.toHaveProperty('plano');
  });

  it('cliente sem cadastro resolvido: 403', async () => {
    const r = await barreiraDoCliente(adminRpc({}).admin, { chamador: 'cliente', tipo: 'treino', pacienteId: null, paciente: PREMIUM });
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

describe('nutrição Premium desligada: o cliente ainda não gera plano alimentar', () => {
  const PREMIUM = { tipo_conta: 'wellness_premium' };
  const rpc = (resposta: Resultado | Error) => ({
    rpc: vi.fn((nome: string) => (resposta instanceof Error
      ? Promise.reject(resposta)
      : Promise.resolve({ data: null, error: null, ...(nome === 'plano_cliente_config' ? resposta : { data: 'nenhum' }) }))),
  });

  it('desligada: 403 nutricao_em_breve com a mensagem combinada, ANTES de olhar Premium ou a fila', async () => {
    const admin = rpc({ data: { nutricao_premium_ativa: false, prazo_chancela_dias_uteis: 2 } });
    const r = await barreiraDoCliente(admin, { chamador: 'cliente', tipo: 'nutricao', pacienteId: PAC, paciente: PREMIUM });
    expect(r).toEqual({ status: STATUS_HTTP_NUTRICAO_EM_BREVE, corpo: { error: 'O plano nutricional Premium estará disponível em breve.', codigo: 'nutricao_em_breve' } });
    expect(STATUS_HTTP_NUTRICAO_EM_BREVE).toBe(403);
    expect(MENSAGEM_NUTRICAO_EM_BREVE).toBe('O plano nutricional Premium estará disponível em breve.');
    expect(CODIGO_NUTRICAO_EM_BREVE).toBe('nutricao_em_breve');
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    // vale também para quem não é Premium: ninguém recebe nutrição agora, então não se convida a pagar por ela
    const free = await barreiraDoCliente(rpc({ data: { nutricao_premium_ativa: false } }), { chamador: 'cliente', tipo: 'nutricao', pacienteId: PAC, paciente: { tipo_conta: 'wellness_free' } });
    expect(free?.corpo).toMatchObject({ codigo: 'nutricao_em_breve' });
  });

  it('ligada: segue para as demais barreiras (402 sem Premium)', async () => {
    const admin = rpc({ data: { nutricao_premium_ativa: true } });
    expect(await barreiraDoCliente(admin, { chamador: 'cliente', tipo: 'nutricao', pacienteId: PAC, paciente: PREMIUM })).toBeNull();
    const free = await barreiraDoCliente(rpc({ data: { nutricao_premium_ativa: true } }), { chamador: 'cliente', tipo: 'nutricao', pacienteId: PAC, paciente: { tipo_conta: 'wellness_free' } });
    expect(free?.status).toBe(STATUS_HTTP_SEM_PREMIUM);
  });

  it('o treino não depende da nutrição: nem consulta a configuração', async () => {
    const admin = rpc({ data: { nutricao_premium_ativa: false } });
    expect(await barreiraDoCliente(admin, { chamador: 'cliente', tipo: 'treino', pacienteId: PAC, paciente: PREMIUM })).toBeNull();
    expect(admin.rpc.mock.calls.map((c) => c[0])).toEqual(['plano_cliente_estado_pedido']);
  });

  it('o profissional não é afetado: a configuração nem é consultada', async () => {
    const admin = rpc({ data: { nutricao_premium_ativa: false } });
    expect(await barreiraDoCliente(admin, { chamador: 'profissional', tipo: 'nutricao', pacienteId: PAC, paciente: PREMIUM })).toBeNull();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it('sem conseguir ler a configuração (ou resposta torta): 503, nunca "liberado" nem "em breve" enganoso', async () => {
    for (const resposta of [{ error: { message: 'boom' } }, new Error('rede'), { data: null }, { data: {} }, { data: { nutricao_premium_ativa: 'true' } }]) {
      const r = await barreiraDoCliente(rpc(resposta), { chamador: 'cliente', tipo: 'nutricao', pacienteId: PAC, paciente: PREMIUM });
      expect(r).toEqual({ status: STATUS_HTTP_VERIFICACAO, corpo: { error: MENSAGEM_ERRO_VERIFICACAO } });
    }
    expect(await estadoDaNutricaoPremium(rpc({ data: { nutricao_premium_ativa: true } }))).toBe('ligada');
    expect(await estadoDaNutricaoPremium(rpc({ data: { nutricao_premium_ativa: false } }))).toBe('desligada');
  });
});

describe('caminho PROFISSIONAL das edges de geração exige perfil verificado', () => {
  const USER = 'a0000000-0000-4000-8000-000000000005';
  const rpc = (resposta: Resultado | Error) => ({
    rpc: vi.fn(() => (resposta instanceof Error ? Promise.reject(resposta) : Promise.resolve({ data: null, error: null, ...resposta }))),
  });

  it('verificado (ou o super-admin, que o banco reconhece pelo e-mail): segue', async () => {
    const admin = rpc({ data: true });
    expect(await barreiraDoProfissional(admin, { chamador: 'profissional', userId: USER })).toBeNull();
    expect(admin.rpc).toHaveBeenCalledWith('profissional_verificado', { p_user_id: USER });
  });

  it('não verificado: 403 profissional_nao_verificado com a mensagem combinada', async () => {
    const r = await barreiraDoProfissional(rpc({ data: false }), { chamador: 'profissional', userId: USER });
    expect(r).toEqual({
      status: STATUS_HTTP_PROFISSIONAL_NAO_VERIFICADO,
      corpo: { error: 'Seu perfil profissional ainda não foi verificado pela equipe MyHealthID', codigo: 'profissional_nao_verificado' },
    });
    expect(STATUS_HTTP_PROFISSIONAL_NAO_VERIFICADO).toBe(403);
    expect(MENSAGEM_PROFISSIONAL_NAO_VERIFICADO).toBe('Seu perfil profissional ainda não foi verificado pela equipe MyHealthID');
    expect(CODIGO_PROFISSIONAL_NAO_VERIFICADO).toBe('profissional_nao_verificado');
  });

  it('fail-closed: erro do banco ou resposta torta é 503, nunca verificado', async () => {
    for (const resposta of [{ error: { message: 'boom' } }, new Error('rede'), { data: null }, { data: 'true' }, { data: 1 }]) {
      const r = await barreiraDoProfissional(rpc(resposta), { chamador: 'profissional', userId: USER });
      expect(r).toEqual({ status: STATUS_HTTP_VERIFICACAO, corpo: { error: MENSAGEM_ERRO_VERIFICACAO } });
    }
    expect(await profissionalFoiVerificado(rpc({ data: true }), USER)).toBe('sim');
    expect(await profissionalFoiVerificado(rpc({ data: false }), USER)).toBe('nao');
  });

  it('o cliente tem a própria barreira: este filtro nem consulta o banco', async () => {
    const admin = rpc({ data: false });
    expect(await barreiraDoProfissional(admin, { chamador: 'cliente', userId: USER })).toBeNull();
    expect(admin.rpc).not.toHaveBeenCalled();
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
