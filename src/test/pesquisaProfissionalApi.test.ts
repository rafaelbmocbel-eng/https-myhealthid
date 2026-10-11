import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    functions: { invoke: (...a: unknown[]) => h.invoke(...a) },
  },
}));

import { ErroRpc } from '@/lib/chancelaApi';
import {
  CHAVE_PESQUISAS_RESUMO, ErroPesquisaProfissional, PRAZO_PESQUISA_MS, buscarResumoPesquisasProfissionais,
  buscarUltimaPesquisaProfissional, chavePesquisaUltima, pesquisarProfissional,
} from '@/lib/pesquisaProfissionalApi';

const pesquisaServidor = {
  id: 'p-1', pesquisado_em: '2026-10-11T17:32:00Z', nivel_indicio: 'compativel', resumo: 'Registro encontrado.',
  achados: [{
    categoria: 'registro_conselho', texto: 'Registro ativo', trecho: 'ANA SOUZA CRN3 12345',
    fonte_url: 'https://www.cfn.org.br/consulta', fonte_titulo: 'CFN',
  }],
  consulta_usada: { nome: 'Ana Souza', registro: 'CRN 12345', profissao: 'nutricionista', conselho_esperado: 'CRN' },
  modelo: 'gemini-2.5-flash', erro: null,
};

function erroHttp(status: number, corpo: unknown) {
  return {
    message: 'Edge Function returned a non-2xx status code',
    context: { status, json: async () => corpo },
  };
}

beforeEach(() => {
  h.rpc.mockReset();
  h.invoke.mockReset();
  h.rpc.mockResolvedValue({ data: null, error: null });
});
afterEach(() => vi.useRealTimers());

describe('chaves de cache', () => {
  it('o resumo é uma chave só e a última pesquisa é por profissional', () => {
    expect(CHAVE_PESQUISAS_RESUMO).toEqual(['pesquisas-profissionais-resumo']);
    expect(chavePesquisaUltima('u-1')).toEqual(['pesquisa-profissional-ultima', 'u-1']);
    expect(chavePesquisaUltima('u-1')).not.toEqual(chavePesquisaUltima('u-2'));
  });
});

describe('pesquisarProfissional (edge)', () => {
  it('chama pesquisar-profissional só com o user_id e devolve a pesquisa lida', async () => {
    h.invoke.mockResolvedValue({ data: { ok: true, pesquisa: pesquisaServidor }, error: null });
    const p = await pesquisarProfissional('u-ana');
    expect(h.invoke).toHaveBeenCalledTimes(1);
    expect(h.invoke).toHaveBeenCalledWith('pesquisar-profissional', { body: { user_id: 'u-ana' } });
    expect(p.nivel).toBe('compativel');
    expect(p.achados).toHaveLength(1);
    expect(p.achados[0].fonteUrl).toBe('https://www.cfn.org.br/consulta');
  });

  it('ok:false com código de limite vira ErroPesquisaProfissional com a mensagem do servidor', async () => {
    h.invoke.mockResolvedValue({
      data: { ok: false, codigo: 'limite_profissional', mensagem: 'Aguarde 10 minutos para pesquisar de novo.' },
      error: null,
    });
    const erro = await pesquisarProfissional('u-ana').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroPesquisaProfissional);
    expect((erro as ErroPesquisaProfissional).codigo).toBe('limite_profissional');
    expect((erro as ErroPesquisaProfissional).message).toBe('Aguarde 10 minutos para pesquisar de novo.');
  });

  it('ok:false sem mensagem usa o texto padrão do código', async () => {
    h.invoke.mockResolvedValue({ data: { ok: false, codigo: 'limite_diario' }, error: null });
    await expect(pesquisarProfissional('u-ana')).rejects.toMatchObject({ codigo: 'limite_diario', message: expect.stringMatching(/limite diário/) });
  });

  it('falha da busca com a tentativa gravada vale como resultado "não consegui consultar"', async () => {
    h.invoke.mockResolvedValue({
      data: {
        ok: false, codigo: 'falha_busca', mensagem: 'Não consegui consultar automaticamente.',
        pesquisa: { ...pesquisaServidor, nivel_indicio: 'nao_consultavel', achados: [], erro: 'ia_http_500' },
      },
      error: null,
    });
    const p = await pesquisarProfissional('u-ana');
    expect(p).toMatchObject({ nivel: 'nao_consultavel', erro: 'ia_http_500' });
  });

  it('falha da busca sem tentativa gravada continua sendo erro, com o código', async () => {
    h.invoke.mockResolvedValue({ data: { ok: false, codigo: 'falha_busca', mensagem: 'A busca não respondeu.' }, error: null });
    await expect(pesquisarProfissional('u-ana')).rejects.toMatchObject({ codigo: 'falha_busca', message: 'A busca não respondeu.' });
  });

  it('um limite com `pesquisa` anexada não é tratado como resultado (só a falha da busca é)', async () => {
    h.invoke.mockResolvedValue({ data: { ok: false, codigo: 'limite_diario', pesquisa: pesquisaServidor }, error: null });
    await expect(pesquisarProfissional('u-ana')).rejects.toMatchObject({ codigo: 'limite_diario' });
  });

  it('sem_permissao do servidor (403) vira a mensagem fixa do administrador', async () => {
    h.invoke.mockResolvedValue({
      data: null,
      error: erroHttp(403, { ok: false, codigo: 'sem_permissao', mensagem: 'Apenas o administrador MyHealthID pode pesquisar profissionais.' }),
    });
    await expect(pesquisarProfissional('u-ana')).rejects.toMatchObject({
      codigo: 'sem_permissao', message: 'Apenas o administrador MyHealthID pode pesquisar profissionais.',
    });
  });

  it('resposta não-2xx: lê o corpo do contexto (limite com 429)', async () => {
    h.invoke.mockResolvedValue({
      data: null,
      error: erroHttp(429, { ok: false, codigo: 'limite_diario', mensagem: 'Limite diário de pesquisas atingido.' }),
    });
    await expect(pesquisarProfissional('u-ana')).rejects.toMatchObject({
      name: 'ErroPesquisaProfissional', codigo: 'limite_diario', message: 'Limite diário de pesquisas atingido.',
    });
  });

  it('403 vira "apenas o administrador", mesmo sem corpo legível', async () => {
    h.invoke.mockResolvedValue({
      data: null,
      error: { message: 'x', context: { status: 403, json: async () => { throw new Error('sem corpo'); } } },
    });
    await expect(pesquisarProfissional('u-ana')).rejects.toMatchObject({
      codigo: 'nao_autorizado', message: 'Apenas o administrador MyHealthID pode pesquisar profissionais.',
    });
  });

  it('corpo com {error} (padrão das outras edges) vira a mensagem', async () => {
    h.invoke.mockResolvedValue({ data: null, error: erroHttp(500, { error: 'Falha interna na pesquisa.' }) });
    await expect(pesquisarProfissional('u-ana')).rejects.toMatchObject({ message: 'Falha interna na pesquisa.' });
  });

  it('erro sem contexto (rede) vira mensagem em português, sem vazar o texto em inglês', async () => {
    h.invoke.mockResolvedValue({ data: null, error: { message: 'Failed to send a request to the Edge Function' } });
    const erro = (await pesquisarProfissional('u-ana').catch((e: unknown) => e)) as ErroPesquisaProfissional;
    expect(erro.codigo).toBe('sem_conexao');
    expect(erro.message).toMatch(/Verifique a conexão/);
    expect(erro.message).not.toMatch(/Edge Function/);
  });

  it('resposta em formato inesperado não passa por sucesso', async () => {
    h.invoke.mockResolvedValue({ data: { ok: true, pesquisa: { nivel_indicio: 'verificado' } }, error: null });
    await expect(pesquisarProfissional('u-ana')).rejects.toThrow(/formato inesperado/);
    h.invoke.mockResolvedValue({ data: null, error: null });
    await expect(pesquisarProfissional('u-ana')).rejects.toThrow(/formato inesperado/);
  });

  it('desiste depois do prazo, com código de tempo esgotado', async () => {
    vi.useFakeTimers();
    h.invoke.mockReturnValue(new Promise(() => {}));
    const pendente = pesquisarProfissional('u-ana').catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(PRAZO_PESQUISA_MS + 1);
    const erro = (await pendente) as ErroPesquisaProfissional;
    expect(erro).toBeInstanceOf(ErroPesquisaProfissional);
    expect(erro.codigo).toBe('tempo_esgotado');
  });
});

describe('RPCs de leitura', () => {
  it('pesquisa_profissional_ultima leva só o p_user_id e devolve a pesquisa lida', async () => {
    h.rpc.mockResolvedValue({ data: pesquisaServidor, error: null });
    const p = await buscarUltimaPesquisaProfissional('u-ana');
    expect(h.rpc).toHaveBeenCalledWith('pesquisa_profissional_ultima', { p_user_id: 'u-ana' });
    expect(p?.nivel).toBe('compativel');
  });

  it('nunca pesquisado: null do banco vira null', async () => {
    h.rpc.mockResolvedValue({ data: null, error: null });
    expect(await buscarUltimaPesquisaProfissional('u-ana')).toBeNull();
  });

  it('pesquisas_profissionais_resumo é uma chamada sem argumentos e devolve a lista lida', async () => {
    h.rpc.mockResolvedValue({
      data: [{ user_id: 'u-1', pesquisado_em: '2026-10-11T10:00:00Z', nivel_indicio: 'divergente' }, { user_id: 'u-2', nivel_indicio: 'oops' }],
      error: null,
    });
    const lista = await buscarResumoPesquisasProfissionais();
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenCalledWith('pesquisas_profissionais_resumo');
    expect(lista).toEqual([{ userId: 'u-1', pesquisadoEm: '2026-10-11T10:00:00Z', nivel: 'divergente' }]);
  });

  it('erro do banco vira ErroRpc com o hint', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'Apenas o administrador MyHealthID', hint: 'nao_admin' } });
    const erro = await buscarResumoPesquisasProfissionais().catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroRpc);
    expect((erro as ErroRpc).hint).toBe('nao_admin');
    await expect(buscarUltimaPesquisaProfissional('u-1')).rejects.toBeInstanceOf(ErroRpc);
  });
});
