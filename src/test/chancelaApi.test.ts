import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    functions: { invoke: (...a: unknown[]) => h.invoke(...a) },
  },
}));

import {
  ErroRpc, buscarConfigPlanoCliente, buscarFilaChancela, buscarProfissionaisAdmin, chancelarPlanoCliente, definirConfigPlanoCliente,
  definirEquipeCientifica, notificarClientePlano, recusarPlanoCliente, revisarSegurancaPlanoCliente, solicitarVerificacao,
  verificarProfissional,
} from '@/lib/chancelaApi';
import { codigoErroChancela, mensagemErroChancela } from '@/lib/chancela';

beforeEach(() => {
  h.rpc.mockReset();
  h.invoke.mockReset();
  h.rpc.mockResolvedValue({ data: null, error: null });
});
afterEach(() => vi.useRealTimers());

describe('chamadas das RPCs novas', () => {
  it('fila_chancela leva o status pedido (inclusive os novos)', async () => {
    h.rpc.mockResolvedValue({ data: [], error: null });
    await buscarFilaChancela('cancelado');
    expect(h.rpc).toHaveBeenCalledWith('fila_chancela', { p_status: 'cancelado' });
  });

  it('solicitar_verificacao manda só o registro', async () => {
    await solicitarVerificacao('CRN 12345');
    expect(h.rpc).toHaveBeenCalledWith('solicitar_verificacao', { p_registro: 'CRN 12345' });
  });

  it('verificar_profissional: nota aparada, vazia vira null', async () => {
    await verificarProfissional({ userId: 'u-1', verificado: true, nota: '  conferido  ' });
    expect(h.rpc).toHaveBeenLastCalledWith('verificar_profissional', { p_user_id: 'u-1', p_verificado: true, p_nota: 'conferido' });
    await verificarProfissional({ userId: 'u-1', verificado: false, nota: '   ' });
    expect(h.rpc).toHaveBeenLastCalledWith('verificar_profissional', { p_user_id: 'u-1', p_verificado: false, p_nota: null });
    await verificarProfissional({ userId: 'u-1', verificado: false });
    expect(h.rpc).toHaveBeenLastCalledWith('verificar_profissional', { p_user_id: 'u-1', p_verificado: false, p_nota: null });
  });

  it('verificar_profissional: o registro conferido na tela vai junto (só ao verificar)', async () => {
    await verificarProfissional({ userId: 'u-1', verificado: true, registroVisto: 'CRN 12345' });
    expect(h.rpc).toHaveBeenLastCalledWith('verificar_profissional', { p_user_id: 'u-1', p_verificado: true, p_nota: null, p_registro_visto: 'CRN 12345' });
    await verificarProfissional({ userId: 'u-1', verificado: false, registroVisto: 'CRN 12345' });
    expect(h.rpc).toHaveBeenLastCalledWith('verificar_profissional', { p_user_id: 'u-1', p_verificado: false, p_nota: null });
  });

  it('definir_equipe_cientifica leva e-mail, ativo e áreas', async () => {
    await definirEquipeCientifica({ email: 'ana@exemplo.com', ativo: true, areas: ['treino', 'nutricao'] });
    expect(h.rpc).toHaveBeenCalledWith('definir_equipe_cientifica', { p_email: 'ana@exemplo.com', p_ativo: true, p_areas: ['treino', 'nutricao'] });
  });

  it('profissionais_admin é interpretado e plano_cliente_config cai no padrão seguro quando vem lixo', async () => {
    h.rpc.mockResolvedValueOnce({ data: [{ user_id: 'u-1', nome: 'Ana', verificado: true }], error: null });
    const lista = await buscarProfissionaisAdmin();
    expect(h.rpc).toHaveBeenLastCalledWith('profissionais_admin');
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ userId: 'u-1', nome: 'Ana', verificado: true });

    h.rpc.mockResolvedValueOnce({ data: 'lixo', error: null });
    expect(await buscarConfigPlanoCliente()).toEqual({ nutricao_premium_ativa: false, prazo_chancela_dias_uteis: 2 });
    expect(h.rpc).toHaveBeenLastCalledWith('plano_cliente_config');
  });

  it('definir_config_plano_cliente leva a chave e o valor tipado', async () => {
    await definirConfigPlanoCliente('nutricao_premium_ativa', true);
    expect(h.rpc).toHaveBeenLastCalledWith('definir_config_plano_cliente', { p_chave: 'nutricao_premium_ativa', p_valor: true });
    await definirConfigPlanoCliente('prazo_chancela_dias_uteis', 3);
    expect(h.rpc).toHaveBeenLastCalledWith('definir_config_plano_cliente', { p_chave: 'prazo_chancela_dias_uteis', p_valor: 3 });
  });
});

describe('o HINT do banco chega até a mensagem', () => {
  it('o erro lançado guarda hint, code e details', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'Sem permissão', hint: 'sem_permissao_area', code: 'P0001', details: 'x' } });
    const erro = await chancelarPlanoCliente({ id: 'p-1' }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroRpc);
    expect(erro).toMatchObject({ message: 'Sem permissão', hint: 'sem_permissao_area', code: 'P0001', details: 'x', name: 'ErroRpc' });
    expect(codigoErroChancela(erro)).toBe('sem_permissao_area');
    expect(mensagemErroChancela(erro).mensagem).toMatch(/não tem permissão para chancelar planos desta área/);
  });

  it('vale para chancelar, recusar e a fila', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'x', hint: 'nao_verificado' } });
    for (const chamada of [
      () => chancelarPlanoCliente({ id: 'p-1' }),
      () => recusarPlanoCliente({ id: 'p-1', notaPublica: 'Procure um profissional.' }),
      () => buscarFilaChancela('aguardando'),
    ]) {
      const erro = await chamada().catch((e: unknown) => e);
      expect(codigoErroChancela(erro)).toBe('nao_verificado');
    }
  });

  it('erro sem hint continua só com a mensagem', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'falhou' } });
    const erro = await solicitarVerificacao('CRN 1').catch((e: unknown) => e);
    expect(erro).toMatchObject({ message: 'falhou', hint: null, code: null });
  });
});

describe('notificarClientePlano (best-effort)', () => {
  it('chama a edge com o id do plano e devolve o resultado', async () => {
    h.invoke.mockResolvedValue({ data: { ok: true, enviado: true }, error: null });
    expect(await notificarClientePlano('p-1')).toEqual({ ok: true, enviado: true });
    expect(h.invoke).toHaveBeenCalledWith('notificar-plano-cliente', { body: { plano_id: 'p-1' } });
  });

  it('sem WhatsApp configurado: ok e não enviado, com o motivo da edge', async () => {
    h.invoke.mockResolvedValue({ data: { ok: true, enviado: false, motivo: 'whatsapp_nao_configurado' }, error: null });
    expect(await notificarClientePlano('p-1')).toEqual({ ok: true, enviado: false, motivo: 'whatsapp_nao_configurado' });
  });

  it('nunca lança: erro da edge, exceção ou resposta vazia viram "não enviado"', async () => {
    h.invoke.mockResolvedValueOnce({ data: null, error: { message: 'non-2xx' } });
    expect(await notificarClientePlano('p-1')).toMatchObject({ ok: false, enviado: false });
    h.invoke.mockRejectedValueOnce(new Error('rede caiu'));
    expect(await notificarClientePlano('p-1')).toMatchObject({ ok: false, enviado: false });
    h.invoke.mockResolvedValueOnce({ data: null, error: null });
    expect(await notificarClientePlano('p-1')).toEqual({ ok: false, enviado: false });
    h.invoke.mockResolvedValueOnce(undefined);
    expect(await notificarClientePlano('p-1')).toMatchObject({ ok: false, enviado: false });
  });

  it('só true de verdade conta como enviado', async () => {
    h.invoke.mockResolvedValue({ data: { ok: 'true', enviado: 1 }, error: null });
    expect(await notificarClientePlano('p-1')).toEqual({ ok: false, enviado: false });
  });
});

describe('revisarSegurancaPlanoCliente', () => {
  const resposta = (extra: Record<string, unknown> = {}) => ({
    data: { resumo: 'Ok.', risco_geral: 'baixo', flags: [], persistida: true, ...extra },
    error: null,
  });

  it('chama a edge com a tabela do plano do cliente e o id, sem paciente_id', async () => {
    h.invoke.mockResolvedValue(resposta());
    const r = await revisarSegurancaPlanoCliente({ id: 'p-1', tipo: 'nutricao' });
    expect(h.invoke).toHaveBeenCalledWith('revisar-plano-seguranca', { body: { tabela: 'plano_cliente_chancela', tipo: 'nutricao', plano_id: 'p-1' } });
    expect(r).toMatchObject({ risco_geral: 'baixo', persistida: true });
  });

  it('devolve persistida false quando a edge não conseguiu gravar a revisão', async () => {
    h.invoke.mockResolvedValue(resposta({ persistida: false, motivo_nao_persistida: 'plano_alterado' }));
    expect(await revisarSegurancaPlanoCliente({ id: 'p-1', tipo: 'treino' })).toMatchObject({ persistida: false, motivoNaoPersistida: 'plano_alterado' });
  });

  it('IA fora do ar, erro no corpo ou resposta ilegível: lança', async () => {
    h.invoke.mockResolvedValueOnce({ data: null, error: { message: 'Edge Function returned a non-2xx status code' } });
    await expect(revisarSegurancaPlanoCliente({ id: 'p-1', tipo: 'treino' })).rejects.toThrow(/non-2xx/);
    h.invoke.mockResolvedValueOnce({ data: { error: 'IA indisponível (sem chave configurada).' }, error: null });
    await expect(revisarSegurancaPlanoCliente({ id: 'p-1', tipo: 'treino' })).rejects.toThrow('IA indisponível (sem chave configurada).');
    h.invoke.mockResolvedValueOnce({ data: { qualquer: 'coisa' }, error: null });
    await expect(revisarSegurancaPlanoCliente({ id: 'p-1', tipo: 'treino' })).rejects.toThrow(/não retornou um resultado válido/);
    h.invoke.mockResolvedValueOnce(undefined);
    await expect(revisarSegurancaPlanoCliente({ id: 'p-1', tipo: 'treino' })).rejects.toBeInstanceOf(Error);
  });

  it('a IA que nunca responde é cortada em 90 segundos', async () => {
    vi.useFakeTimers();
    h.invoke.mockReturnValue(new Promise(() => {}));
    const pendente = revisarSegurancaPlanoCliente({ id: 'p-1', tipo: 'treino' });
    const resultado = pendente.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(89_000);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await resultado).toMatchObject({ message: expect.stringMatching(/demorou demais/) });
  });
});
