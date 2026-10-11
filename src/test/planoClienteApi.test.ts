import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import {
  buscarSituacaoPlanoCliente, cancelarPedidoPlanoCliente, ErroPlanoCliente, mensagemErroCancelarPedido,
  MENSAGEM_CANCELAR_FALHOU, MENSAGEM_PEDIDO_CANCELADO,
} from '../lib/planoClienteApi';
import { SITUACAO_VAZIA } from '../lib/geracaoPlano';

beforeEach(() => rpc.mockReset());

describe('buscarSituacaoPlanoCliente', () => {
  it('chama meu_status_plano_cliente com o tipo e lê o prazo, o atraso e o pode_regenerar', async () => {
    rpc.mockResolvedValue({
      data: {
        status: 'aguardando', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null,
        prazo_previsto: '2026-10-13T02:59:59Z', atrasado: false, pode_regenerar: false,
      },
      error: null,
    });
    const r = await buscarSituacaoPlanoCliente('treino');
    expect(rpc).toHaveBeenCalledWith('meu_status_plano_cliente', { p_tipo: 'treino' });
    expect(r).toEqual({
      status: 'aguardando', geradoEm: '2026-10-08T12:00:00Z', notaPublica: null,
      prazoPrevisto: '2026-10-13T02:59:59Z', atrasado: false, podeRegenerar: false,
    });
  });

  it('sem pedido nenhum: situação vazia (pode gerar)', async () => {
    rpc.mockResolvedValue({
      data: { status: null, gerado_em: null, nota_publica: null, prazo_previsto: null, atrasado: false, pode_regenerar: true },
      error: null,
    });
    expect(await buscarSituacaoPlanoCliente('nutricao')).toEqual(SITUACAO_VAZIA);
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await buscarSituacaoPlanoCliente('nutricao')).toEqual(SITUACAO_VAZIA);
  });

  it('erro do banco lança ErroPlanoCliente com o HINT, para a tela decidir o padrão', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom', hint: 'algo', code: 'P0001' } });
    const erro = await buscarSituacaoPlanoCliente('treino').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroPlanoCliente);
    expect((erro as ErroPlanoCliente).hint).toBe('algo');
    expect((erro as ErroPlanoCliente).code).toBe('P0001');
  });
});

describe('cancelarPedidoPlanoCliente', () => {
  it('chama cancelar_pedido_plano_cliente e devolve a situação nova', async () => {
    rpc.mockResolvedValue({
      data: { status: 'cancelado', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null, prazo_previsto: null, atrasado: false, pode_regenerar: true },
      error: null,
    });
    const r = await cancelarPedidoPlanoCliente('nutricao');
    expect(rpc).toHaveBeenCalledWith('cancelar_pedido_plano_cliente', { p_tipo: 'nutricao' });
    expect(r.status).toBe('cancelado');
    expect(r.podeRegenerar).toBe(true);
    expect(r.prazoPrevisto).toBeNull();
  });

  it('o banco recusa (já decidido): lança com o HINT e a mensagem do banco', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: 'Este pedido já foi decidido pela equipe e não pode mais ser cancelado.', hint: 'pedido_ja_decidido' },
    });
    const erro = await cancelarPedidoPlanoCliente('treino').catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroPlanoCliente);
    expect((erro as ErroPlanoCliente).hint).toBe('pedido_ja_decidido');
  });
});

describe('mensagemErroCancelarPedido', () => {
  it('traduz os HINTs do banco em recados para o cliente', () => {
    expect(mensagemErroCancelarPedido(new ErroPlanoCliente({ message: 'x', hint: 'pedido_ja_decidido' }))).toMatch(/A equipe acabou de decidir este pedido/);
    expect(mensagemErroCancelarPedido(new ErroPlanoCliente({ message: 'x', hint: 'sem_pedido_aguardando' }))).toMatch(/já não está aguardando a equipe/);
  });

  it('função ainda não publicada no banco: pede para tentar mais tarde, sem texto técnico', () => {
    const m = mensagemErroCancelarPedido(new ErroPlanoCliente({ message: 'Could not find the function public.cancelar_pedido_plano_cliente(p_tipo) in the schema cache', code: 'PGRST202' }));
    expect(m).toBe('O cancelamento ainda não está disponível. Tente de novo em alguns minutos.');
    expect(m).not.toMatch(/schema|function|PGRST/i);
  });

  it('o código PGRST202 sozinho já indica função ausente', () => {
    expect(mensagemErroCancelarPedido(new ErroPlanoCliente({ message: 'não achei', code: 'PGRST202' }))).toMatch(/ainda não está disponível/);
  });

  it('sessão expirada e falha genérica', () => {
    expect(mensagemErroCancelarPedido(new ErroPlanoCliente({ message: 'Sessão expirada: entre novamente.' }))).toMatch(/sessão expirou/);
    expect(mensagemErroCancelarPedido(new Error('Failed to fetch'))).toBe(MENSAGEM_CANCELAR_FALHOU);
    expect(mensagemErroCancelarPedido(null)).toBe(MENSAGEM_CANCELAR_FALHOU);
    expect(mensagemErroCancelarPedido('texto')).toBe(MENSAGEM_CANCELAR_FALHOU);
  });

  it('a confirmação do cancelamento é acolhedora', () => {
    expect(MENSAGEM_PEDIDO_CANCELADO).toBe('Pedido cancelado. Quando quiser, é só pedir de novo.');
  });
});
