import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a) } }));

import {
  MENSAGEM_ERRO_EXCLUSAO,
  confirmacaoValida,
  contaTemSenha,
  excluirMinhaContaCliente,
  exigeNovoLogin,
  interpretarErroExclusao,
  limparCachesDoUsuario,
  registrarLimpezaDeCacheDoUsuario,
} from '@/lib/contaCliente';

beforeEach(() => h.rpc.mockReset());
afterEach(() => vi.restoreAllMocks());

describe('contaCliente: confirmação', () => {
  it.each([
    ['EXCLUIR', true],
    ['excluir', true],
    ['  Excluir  ', true],
    ['EXCLUI', false],
    ['EXCLUIRR', false],
    ['', false],
    ['EXCLUIR conta', false],
  ])('confirmacaoValida(%j) = %s', (texto, esperado) => {
    expect(confirmacaoValida(texto)).toBe(esperado);
  });
});

describe('contaCliente: login por senha', () => {
  it('provider email conta como senha', () => {
    expect(contaTemSenha({ app_metadata: { providers: ['email', 'google'] } })).toBe(true);
    expect(contaTemSenha({ app_metadata: { provider: 'email' } })).toBe(true);
    expect(contaTemSenha({ app_metadata: {}, identities: [{ provider: 'email' }] })).toBe(true);
    expect(contaTemSenha({ app_metadata: { senha_definida: true } })).toBe(true);
  });
  it('conta só do Google não tem senha', () => {
    expect(contaTemSenha({ app_metadata: { provider: 'google', providers: ['google'] }, identities: [{ provider: 'google' }] })).toBe(false);
    expect(contaTemSenha(null)).toBe(false);
  });
});

describe('contaCliente: mapa de erros', () => {
  it.each([
    'nao_autenticado',
    'confirmacao_invalida',
    'conta_de_profissional',
    'conta_nao_e_de_cliente',
    'senha_obrigatoria',
    'senha_incorreta',
    'reautenticar',
  ])('reconhece %s e tem mensagem humana', (codigo) => {
    expect(interpretarErroExclusao({ message: codigo })).toBe(codigo);
    expect(interpretarErroExclusao({ message: `ERROR: ${codigo}`, details: null })).toBe(codigo);
    const mensagem = MENSAGEM_ERRO_EXCLUSAO[codigo as keyof typeof MENSAGEM_ERRO_EXCLUSAO];
    expect(mensagem).toMatch(/[a-zà-ú]{4}/i);
    expect(mensagem).not.toContain('_');
  });

  it('JWT vencido vira nao_autenticado; o resto é desconhecido', () => {
    expect(interpretarErroExclusao({ message: 'JWT expired' })).toBe('nao_autenticado');
    expect(interpretarErroExclusao({ message: 'algo inesperado' })).toBe('desconhecido');
    expect(interpretarErroExclusao(new TypeError('Failed to fetch'))).toBe('desconhecido');
    expect(interpretarErroExclusao(null)).toBe('desconhecido');
    expect(interpretarErroExclusao('texto')).toBe('desconhecido');
  });

  it('só reautenticar e nao_autenticado pedem novo login', () => {
    expect(exigeNovoLogin('reautenticar')).toBe(true);
    expect(exigeNovoLogin('nao_autenticado')).toBe(true);
    expect(exigeNovoLogin('senha_incorreta')).toBe(false);
    expect(exigeNovoLogin('conta_de_profissional')).toBe(false);
  });
});

describe('contaCliente: chamada da RPC', () => {
  it('envia confirmação normalizada e senha (ou nulo) e devolve o número de vínculos desfeitos', async () => {
    h.rpc.mockResolvedValue({ data: { ok: true, pacientes_desvinculados: 2 }, error: null });
    await expect(excluirMinhaContaCliente({ confirmacao: ' excluir ', senha: 'abc12345' })).resolves.toEqual({ ok: true, desvinculados: 2 });
    expect(h.rpc).toHaveBeenLastCalledWith('excluir_minha_conta_cliente', { p_confirmacao: 'EXCLUIR', p_senha: 'abc12345' });

    await excluirMinhaContaCliente({ confirmacao: 'EXCLUIR', senha: '' });
    expect(h.rpc).toHaveBeenLastCalledWith('excluir_minha_conta_cliente', { p_confirmacao: 'EXCLUIR', p_senha: null });
  });

  it('erro da RPC vira código; exceção vira desconhecido', async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'senha_incorreta' } });
    await expect(excluirMinhaContaCliente({ confirmacao: 'EXCLUIR', senha: 'x' })).resolves.toEqual({ ok: false, codigo: 'senha_incorreta' });
    h.rpc.mockRejectedValueOnce(new Error('boom'));
    await expect(excluirMinhaContaCliente({ confirmacao: 'EXCLUIR' })).resolves.toEqual({ ok: false, codigo: 'desconhecido' });
    h.rpc.mockResolvedValueOnce({ data: { ok: false }, error: null });
    await expect(excluirMinhaContaCliente({ confirmacao: 'EXCLUIR' })).resolves.toEqual({ ok: false, codigo: 'desconhecido' });
  });
});

describe('contaCliente: limpeza de caches', () => {
  it('limpa o React Query e roda as limpezas registradas, mesmo se uma falhar', () => {
    const qc = new QueryClient();
    qc.setQueryData(['x'], 1);
    const boa = vi.fn();
    registrarLimpezaDeCacheDoUsuario(() => {
      throw new Error('falha de teste');
    });
    registrarLimpezaDeCacheDoUsuario(boa);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    limparCachesDoUsuario(qc);
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
    expect(boa).toHaveBeenCalled();
  });
});
