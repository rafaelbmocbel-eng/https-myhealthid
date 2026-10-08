import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));

import SeloGovernanca from '../components/planos/SeloGovernanca';
import {
  lerGovernanca, origemDoPlanoLiberado, rodapeGovernanca, rotuloSeloEquipe, AVISO_PADRAO_PLANO,
} from '../lib/governanca';
import {
  botaoGerar, gerarPlanoComTriagem, gerarPlanoDoCliente, interpretarRespostaGeracao, interpretarRespostaGeracaoCliente,
  lerSituacaoPlanoCliente, mensagemEnviadoParaRevisao, montarPedidoNutricaoCliente, montarPedidoTreinoCliente,
  MENSAGEM_ENVIO_REVISAO_FALHOU, OBJETIVO_PADRAO_CLIENTE, SITUACAO_VAZIA, textoRecusado,
} from '../lib/geracaoPlano';

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
    });
    expect(lerSituacaoPlanoCliente({ status: 'aguardando', gerado_em: null, nota_publica: null }).status).toBe('aguardando');
    expect(lerSituacaoPlanoCliente({ status: 'chancelado' }).status).toBe('chancelado');
  });

  it('sem registro, status desconhecido ou entrada inválida: sem status', () => {
    expect(lerSituacaoPlanoCliente({ status: null, gerado_em: null, nota_publica: null })).toEqual(SITUACAO_VAZIA);
    expect(lerSituacaoPlanoCliente({ status: 'substituido' })).toEqual(SITUACAO_VAZIA);
    expect(lerSituacaoPlanoCliente(null)).toEqual(SITUACAO_VAZIA);
    expect(lerSituacaoPlanoCliente([1])).toEqual(SITUACAO_VAZIA);
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
