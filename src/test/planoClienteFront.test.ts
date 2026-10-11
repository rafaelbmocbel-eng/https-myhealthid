import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));

import SeloGovernanca from '../components/planos/SeloGovernanca';
import {
  lerGovernanca, origemDoPlanoLiberado, rodapeGovernanca, rotuloSeloEquipe, AVISO_PADRAO_PLANO, ROTULO_AUTOCHANCELA,
} from '../lib/governanca';
import {
  botaoGerar, ehNutricaoEmBreve, gerarPlanoComTriagem, gerarPlanoDoCliente, interpretarRespostaGeracao,
  interpretarRespostaGeracaoCliente, lerSituacaoPlanoCliente, mensagemEnviadoParaRevisao, mensagemErroGeracao,
  montarPedidoNutricaoCliente, montarPedidoTreinoCliente, MENSAGEM_ENVIO_REVISAO_FALHOU, MENSAGEM_GERACAO_FALHOU,
  MENSAGEM_NUTRICAO_EM_BREVE, MENSAGEM_PROFISSIONAL_NAO_VERIFICADO, OBJETIVO_PADRAO_CLIENTE, SITUACAO_VAZIA,
  textoAtrasado, textoPrevisao, textoRecusado,
} from '../lib/geracaoPlano';
import { ErroFuncao, erroDaFuncao } from '../lib/fnError';

afterEach(() => {
  cleanup();
  invoke.mockReset();
});

const carimbo = (aprovacao: Record<string, unknown>) => ({
  fases: [],
  _governanca: { versao: 1, aprovacao, acompanhamento: { reavaliar_em_semanas: 4, indicadores: [] } },
});

const chancelado = carimbo({ por_nome: 'Bia Lima', por_perfil: 'nutricionista', em: '2026-10-08T15:00:00Z', versao: 2 });

describe('selo da equipe científica MyHealthID', () => {
  it('traz nome, perfil, data e versão do carimbo', () => {
    expect(rotuloSeloEquipe(lerGovernanca(chancelado))).toBe(
      'Chancelado pela equipe científica MyHealthID · Bia Lima, Nutricionista · 08/10/2026 · v2',
    );
  });

  it('o carimbo do super-admin fora do perfil dele aparece como Administrador(a)', () => {
    const c = carimbo({ por_nome: 'Rafael', por_perfil: 'super_admin', em: '2026-10-08T15:00:00Z', versao: 1 });
    expect(rotuloSeloEquipe(lerGovernanca(c))).toBe('Chancelado pela equipe científica MyHealthID · Rafael, Administrador(a) · 08/10/2026 · v1');
  });

  it('não inventa partes que o carimbo não trouxe', () => {
    expect(rotuloSeloEquipe(lerGovernanca(carimbo({ por_nome: 'Ana' })))).toBe('Chancelado pela equipe científica MyHealthID · Ana');
    expect(rotuloSeloEquipe(null)).toBe('Chancelado pela equipe científica MyHealthID');
    expect(rotuloSeloEquipe(lerGovernanca(carimbo({ por_nome: 'Ana', por_perfil: 'perfil_novo', versao: 1 })))).toBe(
      'Chancelado pela equipe científica MyHealthID · Ana, perfil novo · v1',
    );
  });

  it('lerGovernanca expõe por_perfil e ignora valor que não é texto', () => {
    expect(lerGovernanca(chancelado)?.aprovacao?.por_perfil).toBe('nutricionista');
    expect(lerGovernanca(carimbo({ por_perfil: 42 }))?.aprovacao?.por_perfil).toBeNull();
  });

  it('SeloGovernanca origem equipe_myhealthid mostra a chancela, sem "Liberado", e o aviso de que não substitui profissional', () => {
    const { container } = render(createElement(SeloGovernanca, { conteudo: chancelado, origem: 'equipe_myhealthid', visao: 'paciente' }));
    const texto = container.textContent ?? '';
    expect(texto).toContain('Chancelado pela equipe científica MyHealthID · Bia Lima, Nutricionista · 08/10/2026 · v2');
    expect(texto).not.toMatch(/Liberado/);
    expect(texto).toContain('Não substitui o acompanhamento de um profissional de saúde.');
  });

  it('SeloGovernanca compacto da equipe usa o mesmo rótulo', () => {
    const { container } = render(createElement(SeloGovernanca, { conteudo: chancelado, origem: 'equipe_myhealthid', visao: 'paciente', compacto: true }));
    expect(container.textContent).toContain('Chancelado pela equipe científica MyHealthID');
  });

  it('autochancela do administrador: o selo termina com "Autochancela (teste interno)"', () => {
    const c = carimbo({ por_nome: 'Rafael', por_perfil: 'super_admin', em: '2026-10-08T15:00:00Z', versao: 1, autochancela: true });
    expect(ROTULO_AUTOCHANCELA).toBe('Autochancela (teste interno)');
    expect(lerGovernanca(c)?.aprovacao?.autochancela).toBe(true);
    expect(rotuloSeloEquipe(lerGovernanca(c))).toBe(
      'Chancelado pela equipe científica MyHealthID · Rafael, Administrador(a) · 08/10/2026 · v1 · Autochancela (teste interno)',
    );
    expect(rodapeGovernanca(c, { origem: 'equipe_myhealthid' }).selo).toContain('Autochancela (teste interno)');
  });

  it('só autochancela === true conta; o selo normal não traz o texto', () => {
    for (const valor of ['true', 1, 'sim', null]) {
      const c = carimbo({ por_nome: 'Ana', autochancela: valor });
      expect(lerGovernanca(c)?.aprovacao?.autochancela).toBe(false);
      expect(rotuloSeloEquipe(lerGovernanca(c))).not.toContain('Autochancela (teste interno)');
    }
    expect(rotuloSeloEquipe(lerGovernanca(chancelado))).not.toContain('Autochancela (teste interno)');
  });

  it('SeloGovernanca da autochancela mostra o aviso e nada de revisão, mesmo se o carimbo vier com sem_revisao', () => {
    const c = carimbo({
      por_nome: 'Rafael', por_perfil: 'super_admin', em: '2026-10-08T15:00:00Z', versao: 1,
      autochancela: true, sem_revisao: true, motivo_sem_revisao: 'IA fora do ar',
    });
    const { container } = render(createElement(SeloGovernanca, { conteudo: c, origem: 'equipe_myhealthid', visao: 'paciente' }));
    const texto = container.textContent ?? '';
    expect(texto).toContain('Autochancela (teste interno)');
    expect(texto).not.toMatch(/sem revisão|revisão automática|IA fora do ar/i);
  });

  it('o selo do plano do cliente (planos_ia_cliente) continua sem afirmar chancela', () => {
    const { container } = render(createElement(SeloGovernanca, { conteudo: chancelado, origem: 'cliente', visao: 'paciente' }));
    const texto = container.textContent ?? '';
    expect(texto).toContain('Gerado por IA · sem revisão de profissional');
    expect(texto).not.toMatch(/Chancelado/);
    expect(texto).not.toContain('Bia Lima');
  });
});

describe('origemDoPlanoLiberado', () => {
  it('só a origem equipe_myhealthid devolvida pela RPC conta como da equipe', () => {
    expect(origemDoPlanoLiberado({ origem: 'equipe_myhealthid' })).toBe('equipe_myhealthid');
    expect(origemDoPlanoLiberado({ origem: 'profissional' })).toBe('profissional');
  });

  it('sem origem (RPC antiga), valor estranho ou entrada inválida: plano do profissional', () => {
    expect(origemDoPlanoLiberado({})).toBe('profissional');
    expect(origemDoPlanoLiberado({ origem: 'cliente' })).toBe('profissional');
    expect(origemDoPlanoLiberado(null)).toBe('profissional');
    expect(origemDoPlanoLiberado('equipe_myhealthid')).toBe('profissional');
  });
});

describe('rodapeGovernanca com plano chancelado', () => {
  it('imprime quem da equipe chancelou e a data de reavaliação', () => {
    const r = rodapeGovernanca(chancelado, { origem: 'equipe_myhealthid' });
    expect(r.selo).toBe('Chancelado pela equipe científica MyHealthID · Bia Lima, Nutricionista · 08/10/2026 · v2');
    expect(r.reavaliacao).toBe('Reavaliar em 4 semanas (até 05/11/2026)');
    expect(r.aviso).toBe(AVISO_PADRAO_PLANO);
  });

  it('o plano do cliente continua só com o aviso padrão', () => {
    expect(rodapeGovernanca(chancelado, { origem: 'cliente', aprovado: true })).toEqual({ selo: null, reavaliacao: null, aviso: AVISO_PADRAO_PLANO });
  });
});

describe('interpretarRespostaGeracaoCliente', () => {
  const bloqueio = { nivel: 'bloqueia', motivos: [{ codigo: 'menor', rotulo: 'Menor de 18 anos', detalhe: '', origem: 'cadastro', nivel: 'bloqueia' }], dadosAusentes: [], pode_prosseguir_profissional: true };

  it('o recibo da fila vira em_revisao com o id do plano', () => {
    expect(interpretarRespostaGeracaoCliente({ ok: true, em_revisao: true, plano_id: 'abc' })).toEqual({ tipo: 'em_revisao', planoId: 'abc' });
  });

  it('{ok:false, bloqueio} vira bloqueio, não erro', () => {
    const r = interpretarRespostaGeracaoCliente({ ok: false, bloqueio });
    expect(r.tipo).toBe('bloqueio');
  });

  it('plano com conteúdo nunca é aceito no caminho do cliente (não passou pela chancela)', () => {
    expect(() => interpretarRespostaGeracaoCliente({ ok: true, plano: { titulo: 'T', fases: [] } })).toThrow(MENSAGEM_ENVIO_REVISAO_FALHOU);
    expect(() => interpretarRespostaGeracaoCliente({ ok: true, em_revisao: true, plano: { titulo: 'T' } })).toThrow(MENSAGEM_ENVIO_REVISAO_FALHOU);
  });

  it('recibo sem id, flag falsa, resposta vazia ou malformada lançam (fail-closed)', () => {
    expect(() => interpretarRespostaGeracaoCliente({ ok: true, em_revisao: true })).toThrow();
    expect(() => interpretarRespostaGeracaoCliente({ ok: true, em_revisao: true, plano_id: '' })).toThrow();
    expect(() => interpretarRespostaGeracaoCliente({ ok: true, em_revisao: false, plano_id: 'x' })).toThrow();
    expect(() => interpretarRespostaGeracaoCliente({ ok: false, em_revisao: true, plano_id: 'x' })).toThrow();
    expect(() => interpretarRespostaGeracaoCliente(null)).toThrow();
    expect(() => interpretarRespostaGeracaoCliente({ ok: false, bloqueio: { nivel: 'qualquer' } })).toThrow();
  });

  it('erro textual do servidor (ex.: 402 sem Premium) vira a mensagem do erro', () => {
    expect(() => interpretarRespostaGeracaoCliente({ error: 'Recurso Premium', codigo: 'premium_necessario' })).toThrow('Recurso Premium');
  });

  it('o caminho do profissional não muda: continua exigindo o plano e não aceita recibo de fila', () => {
    expect(interpretarRespostaGeracao({ ok: true, plano: { titulo: 'T' } })).toEqual({ tipo: 'plano', plano: { titulo: 'T' } });
    expect(() => interpretarRespostaGeracao({ ok: true, em_revisao: true, plano_id: 'abc' })).toThrow();
  });
});

describe('gerarPlanoDoCliente e gerarPlanoComTriagem', () => {
  it('o cliente nunca envia override', async () => {
    invoke.mockResolvedValue({ data: { ok: true, em_revisao: true, plano_id: 'p1' }, error: null });
    const r = await gerarPlanoDoCliente('gerar-plano-treino', { paciente_id: 'pac-1' });
    expect(r).toEqual({ tipo: 'em_revisao', planoId: 'p1' });
    expect(invoke).toHaveBeenCalledWith('gerar-plano-treino', { body: { paciente_id: 'pac-1' } });
  });

  it('o profissional ainda envia o override quando decidiu prosseguir', async () => {
    invoke.mockResolvedValue({ data: { ok: true, plano: { titulo: 'T' } }, error: null });
    await gerarPlanoComTriagem('gerar-plano-alimentar', { paciente_id: 'pac-1' }, { justificativa: 'liberado pelo médico responsável', ciente: true });
    expect(invoke).toHaveBeenCalledWith('gerar-plano-alimentar', {
      body: { paciente_id: 'pac-1', override: { justificativa: 'liberado pelo médico responsável', ciente: true } },
    });
  });

  it('erro HTTP da edge lança com a mensagem do corpo da resposta', async () => {
    invoke.mockResolvedValue({ data: null, error: { context: { json: async () => ({ error: 'Recurso Premium' }) } } });
    await expect(gerarPlanoDoCliente('gerar-plano-treino', {})).rejects.toThrow('Recurso Premium');
  });
});

describe('lerSituacaoPlanoCliente', () => {
  it('lê status, data e recado público', () => {
    expect(lerSituacaoPlanoCliente({ status: 'recusado', gerado_em: '2026-10-08T12:00:00Z', nota_publica: ' Falta o histórico. ' })).toEqual({
      status: 'recusado', geradoEm: '2026-10-08T12:00:00Z', notaPublica: 'Falta o histórico.',
      prazoPrevisto: null, atrasado: false, podeRegenerar: true,
    });
    expect(lerSituacaoPlanoCliente({ status: 'aguardando', gerado_em: null, nota_publica: null }).status).toBe('aguardando');
    expect(lerSituacaoPlanoCliente({ status: 'chancelado' }).status).toBe('chancelado');
    expect(lerSituacaoPlanoCliente({ status: 'cancelado' }).status).toBe('cancelado');
  });

  it('aguardando traz o prazo previsto, o atraso e se pode pedir de novo', () => {
    expect(lerSituacaoPlanoCliente({
      status: 'aguardando', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null,
      prazo_previsto: '2026-10-13T02:59:59Z', atrasado: false, pode_regenerar: false,
    })).toEqual({
      status: 'aguardando', geradoEm: '2026-10-08T12:00:00Z', notaPublica: null,
      prazoPrevisto: '2026-10-13T02:59:59Z', atrasado: false, podeRegenerar: false,
    });
    const atrasado = lerSituacaoPlanoCliente({ status: 'aguardando', prazo_previsto: '2026-10-08T02:59:59Z', atrasado: true, pode_regenerar: true });
    expect(atrasado.atrasado).toBe(true);
    expect(atrasado.podeRegenerar).toBe(true);
  });

  it('prazo e atraso só valem enquanto aguarda (nada de "atrasado" num pedido já decidido)', () => {
    const r = lerSituacaoPlanoCliente({ status: 'chancelado', prazo_previsto: '2026-10-08T02:59:59Z', atrasado: true });
    expect(r.prazoPrevisto).toBeNull();
    expect(r.atrasado).toBe(false);
  });

  it('atrasado só é verdadeiro quando o servidor manda exatamente true', () => {
    for (const atrasado of ['true', 1, 'sim', null, undefined]) {
      expect(lerSituacaoPlanoCliente({ status: 'aguardando', atrasado }).atrasado).toBe(false);
    }
  });

  it('servidor sem pode_regenerar (antigo): só gera de novo quem não está aguardando', () => {
    expect(lerSituacaoPlanoCliente({ status: 'aguardando' }).podeRegenerar).toBe(false);
    expect(lerSituacaoPlanoCliente({ status: 'aguardando', pode_regenerar: 'sim' }).podeRegenerar).toBe(false);
    expect(lerSituacaoPlanoCliente({ status: 'recusado' }).podeRegenerar).toBe(true);
    expect(lerSituacaoPlanoCliente({ status: 'cancelado' }).podeRegenerar).toBe(true);
    expect(lerSituacaoPlanoCliente({ status: 'chancelado' }).podeRegenerar).toBe(true);
  });

  it('sem registro, status desconhecido ou entrada inválida: sem status e liberado para gerar', () => {
    expect(lerSituacaoPlanoCliente({ status: null, gerado_em: null, nota_publica: null })).toEqual(SITUACAO_VAZIA);
    expect(lerSituacaoPlanoCliente({ status: 'substituido' })).toEqual(SITUACAO_VAZIA);
    expect(lerSituacaoPlanoCliente(null)).toEqual(SITUACAO_VAZIA);
    expect(lerSituacaoPlanoCliente([1])).toEqual(SITUACAO_VAZIA);
    expect(SITUACAO_VAZIA.podeRegenerar).toBe(true);
    expect(SITUACAO_VAZIA.atrasado).toBe(false);
  });
});

describe('textos e botões', () => {
  it('textoRecusado usa o recado da equipe sem pontuação sobrando no fim', () => {
    expect(textoRecusado('Falta informar o seu objetivo.')).toBe('Recusado: Falta informar o seu objetivo');
    expect(textoRecusado('  Refaça a triagem!  ')).toBe('Recusado: Refaça a triagem');
    expect(textoRecusado(null)).toBe('Recusado pela equipe científica MyHealthID');
    expect(textoRecusado('   ')).toBe('Recusado pela equipe científica MyHealthID');
  });

  it('botaoGerar: livre, com chancelado, recusado e aguardando', () => {
    expect(botaoGerar('treino', null, false)).toEqual({ rotulo: 'Gerar treino', desabilitado: false });
    expect(botaoGerar('nutricao', null, false)).toEqual({ rotulo: 'Gerar nutrição', desabilitado: false });
    expect(botaoGerar('treino', 'chancelado', true)).toEqual({ rotulo: 'Gerar novo treino', desabilitado: false });
    expect(botaoGerar('nutricao', 'chancelado', true)).toEqual({ rotulo: 'Gerar nova nutrição', desabilitado: false });
    expect(botaoGerar('treino', 'recusado', false)).toEqual({ rotulo: 'Gerar treino de novo', desabilitado: false });
    expect(botaoGerar('treino', 'aguardando', true)).toEqual({ rotulo: 'Treino em revisão', desabilitado: true });
    expect(botaoGerar('nutricao', 'aguardando', false)).toEqual({ rotulo: 'Nutrição em revisão', desabilitado: true });
  });

  it('botaoGerar obedece o servidor (pode_regenerar): pedido atrasado libera, cancelado volta ao normal', () => {
    expect(botaoGerar('treino', 'aguardando', false, false)).toEqual({ rotulo: 'Treino em revisão', desabilitado: true });
    expect(botaoGerar('treino', 'aguardando', true, true)).toEqual({ rotulo: 'Gerar treino de novo', desabilitado: false });
    expect(botaoGerar('nutricao', 'aguardando', false, true)).toEqual({ rotulo: 'Gerar nutrição de novo', desabilitado: false });
    expect(botaoGerar('treino', 'cancelado', false, true)).toEqual({ rotulo: 'Gerar treino', desabilitado: false });
    expect(botaoGerar('treino', 'cancelado', true, true)).toEqual({ rotulo: 'Gerar novo treino', desabilitado: false });
    expect(botaoGerar('treino', 'recusado', false, false).desabilitado).toBe(true);
  });

  it('textoPrevisao usa a data de Brasília e fica vazio sem prazo', () => {
    expect(textoPrevisao('2026-10-13T02:59:59Z')).toBe('Previsão: até 12/10/2026');
    expect(textoPrevisao('2026-10-13T12:00:00Z')).toBe('Previsão: até 13/10/2026');
    expect(textoPrevisao(null)).toBe('');
    expect(textoPrevisao('')).toBe('');
    expect(textoPrevisao('lixo')).toBe('');
  });

  it('textoAtrasado é acolhedor, cita a previsão que era e oferece pedir de novo ou cancelar', () => {
    const t = textoAtrasado('2026-10-08T02:59:59Z');
    expect(t).toMatch(/^Sentimos muito/);
    expect(t).toContain('(a previsão era até 07/10/2026)');
    expect(t).toMatch(/pedir de novo.*cancelar/);
    expect(textoAtrasado(null)).not.toContain('previsão era');
  });

  it('mensagemEnviadoParaRevisao diz o que foi enviado e que o plano chega depois de chancelado', () => {
    expect(mensagemEnviadoParaRevisao(['treino'])).toMatch(/^Seu treino foi enviado para a revisão da equipe científica MyHealthID/);
    expect(mensagemEnviadoParaRevisao(['nutricao'])).toMatch(/^Seu plano alimentar foi enviado/);
    expect(mensagemEnviadoParaRevisao(['treino', 'nutricao'])).toMatch(/^Seu treino e seu plano alimentar foram enviados/);
    expect(mensagemEnviadoParaRevisao(['treino'])).toMatch(/Você recebe aqui quando for chancelado/);
    expect(mensagemEnviadoParaRevisao(['treino'], true)).toMatch(/segue valendo.*procure um profissional/);
  });
});

describe('pedido do cliente', () => {
  const dados = {
    pacienteId: 'pac-1',
    anamnese: { objetivo: ' Emagrecer ', refeicoes_por_dia: '4', restricoes_alergias: 'lactose', preferencias: 'sem peixe', nivel_atividade: 'leve', peso_kg: '80', altura_cm: '170' },
    nascimento: '1990-05-10',
    sexo: 'feminino',
  };

  it('treino: objetivo da anamnese, idade e sexo do cadastro; sem antropometria nem override', () => {
    const corpo = montarPedidoTreinoCliente(dados);
    expect(corpo).toMatchObject({ paciente_id: 'pac-1', objetivo: 'Emagrecer', nivel: 'iniciante', frequencia_semanal: 3, duracao_semanas: 8, sexo: 'feminino' });
    expect(typeof corpo.idade).toBe('number');
    expect(corpo).not.toHaveProperty('restricoes');
    expect(corpo).not.toHaveProperty('antropometria');
    expect(corpo).not.toHaveProperty('override');
  });

  it('treino: o incômodo relatado vira restrição para adaptar o plano', () => {
    const corpo = montarPedidoTreinoCliente(dados, '  dor no joelho ao agachar ');
    expect(String(corpo.restricoes)).toContain('incômodo relatado pelo paciente');
    expect(String(corpo.restricoes)).toContain('dor no joelho ao agachar');
    expect(montarPedidoTreinoCliente(dados, '   ')).not.toHaveProperty('restricoes');
  });

  it('sem anamnese nem cadastro completo: objetivo padrão e nada de idade/sexo inventados', () => {
    const corpo = montarPedidoTreinoCliente({ pacienteId: 'pac-2' });
    expect(corpo.objetivo).toBe(OBJETIVO_PADRAO_CLIENTE);
    expect(corpo).not.toHaveProperty('idade');
    expect(corpo).not.toHaveProperty('sexo');
  });

  it('nutrição: refeições, restrições e preferências da anamnese do cliente; sem antropometria no corpo', () => {
    const corpo = montarPedidoNutricaoCliente(dados);
    expect(corpo).toMatchObject({
      paciente_id: 'pac-1', objetivo: 'Emagrecer', refeicoes_por_dia: 4, restricoes: 'lactose',
      preferencias: 'sem peixe', sexo: 'feminino', nivel_atividade: 'leve',
    });
    expect(typeof corpo.idade).toBe('number');
    expect(corpo).not.toHaveProperty('antropometria');
  });

  it('nutrição: idade da anamnese tem prioridade; refeições padrão 5; lixo numérico é ignorado', () => {
    const corpo = montarPedidoNutricaoCliente({ pacienteId: 'p', anamnese: { idade: '41', refeicoes_por_dia: 'x' }, nascimento: '1990-05-10' });
    expect(corpo.idade).toBe(41);
    expect(corpo.refeicoes_por_dia).toBe(5);
    expect(montarPedidoNutricaoCliente({ pacienteId: 'p', anamnese: { idade: 'abc' } }).idade).toBeUndefined();
  });
});

describe('erros das edges de geração', () => {
  it('erroDaFuncao guarda o código e o status do corpo da resposta', async () => {
    const erro = await erroDaFuncao({
      context: { status: 403, json: async () => ({ error: 'O plano nutricional Premium estará disponível em breve.', codigo: 'nutricao_em_breve' }) },
    });
    expect(erro).toBeInstanceOf(ErroFuncao);
    expect(erro.message).toBe('O plano nutricional Premium estará disponível em breve.');
    expect(erro.codigo).toBe('nutricao_em_breve');
    expect(erro.status).toBe(403);
  });

  it('erroDaFuncao sem código no corpo, corpo ilegível ou erro sem contexto continua devolvendo mensagem', async () => {
    const semCodigo = await erroDaFuncao({ context: { json: async () => ({ error: 'Créditos de IA esgotados' }) } });
    expect(semCodigo.message).toBe('Créditos de IA esgotados');
    expect(semCodigo.codigo).toBeNull();
    expect(semCodigo.status).toBeNull();
    const ilegivel = await erroDaFuncao({ message: 'Edge Function returned a non-2xx status code', context: { json: async () => { throw new Error('html'); } } });
    expect(ilegivel.message).toBe('Edge Function returned a non-2xx status code');
    expect((await erroDaFuncao(null)).message).toBe('Erro ao chamar a função');
    const codigoEstranho = await erroDaFuncao({ context: { json: async () => ({ error: 'x', codigo: 42 }) } });
    expect(codigoEstranho.codigo).toBeNull();
  });

  it('gerarPlanoDoCliente propaga o código do 403 até a tela', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: { context: { status: 403, json: async () => ({ error: 'O plano nutricional Premium estará disponível em breve.', codigo: 'nutricao_em_breve' }) } },
    });
    const erro = await gerarPlanoDoCliente('gerar-plano-alimentar', {}).catch((e: unknown) => e);
    expect(ehNutricaoEmBreve(erro)).toBe(true);
    expect(mensagemErroGeracao(erro)).toBe(MENSAGEM_NUTRICAO_EM_BREVE);
  });

  it('mensagemErroGeracao: códigos conhecidos ganham texto próprio, o resto usa o texto do servidor ou o padrão', () => {
    expect(mensagemErroGeracao(new ErroFuncao('texto antigo do servidor', 'nutricao_em_breve', 403))).toBe('O plano nutricional Premium estará disponível em breve.');
    expect(mensagemErroGeracao(new ErroFuncao('Seu perfil profissional ainda não foi verificado pela equipe MyHealthID', 'profissional_nao_verificado', 403)))
      .toBe(MENSAGEM_PROFISSIONAL_NAO_VERIFICADO);
    expect(MENSAGEM_PROFISSIONAL_NAO_VERIFICADO).toMatch(/ainda não foi verificado pela equipe MyHealthID/);
    expect(mensagemErroGeracao(new ErroFuncao('Créditos de IA esgotados', 'sem_creditos', 402))).toBe('Créditos de IA esgotados');
    expect(mensagemErroGeracao(new Error('Falha qualquer'))).toBe('Falha qualquer');
    expect(mensagemErroGeracao(new Error('   '))).toBe(MENSAGEM_GERACAO_FALHOU);
    expect(mensagemErroGeracao(null)).toBe(MENSAGEM_GERACAO_FALHOU);
    expect(mensagemErroGeracao({}, 'Erro ao gerar')).toBe('Erro ao gerar');
  });

  it('um Error comum com o mesmo texto não conta como "em breve" (só o código do servidor decide)', () => {
    expect(ehNutricaoEmBreve(new Error(MENSAGEM_NUTRICAO_EM_BREVE))).toBe(false);
    expect(ehNutricaoEmBreve(new ErroFuncao('x', 'plano_em_revisao', 409))).toBe(false);
    expect(ehNutricaoEmBreve(null)).toBe(false);
  });
});
