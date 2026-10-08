import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  user: { id: 'u-1', email: 'prof@exemplo.com' } as { id: string; email: string } | null,
  rpc: vi.fn(),
  count: 0,
  contagemFalha: false,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: () => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
        Promise.resolve(h.contagemFalha ? { count: null, error: { message: 'x' } } : { count: h.count, error: null }).then(ok, ko);
      return b;
    },
  },
}));

import { useEquipeCientifica } from '@/hooks/useEquipeCientifica';
import { useChancelaPendentes } from '@/hooks/useChancelaPendentes';
import { useHomeAtalhos } from '@/hooks/useHomeAtalhos';

function envoltorio() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  h.user = { id: 'u-1', email: 'prof@exemplo.com' };
  h.rpc.mockReset();
  h.count = 0;
  h.contagemFalha = false;
  localStorage.clear();
});
afterEach(() => cleanup());

describe('useEquipeCientifica', () => {
  it('pergunta ao banco pela RPC eh_equipe_cientifica e devolve true para quem é da equipe', async () => {
    h.rpc.mockResolvedValue({ data: true, error: null });
    const { result } = renderHook(() => useEquipeCientifica(), { wrapper: envoltorio() });
    expect(result.current).toEqual({ ehEquipe: false, loading: true });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ehEquipe).toBe(true);
    expect(h.rpc).toHaveBeenCalledWith('eh_equipe_cientifica');
  });

  it('resposta false do banco: não é da equipe', async () => {
    h.rpc.mockResolvedValue({ data: false, error: null });
    const { result } = renderHook(() => useEquipeCientifica(), { wrapper: envoltorio() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ehEquipe).toBe(false);
  });

  it('erro da RPC (ex.: função ainda não existe no banco) conta como false', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'Could not find the function' } });
    const { result } = renderHook(() => useEquipeCientifica(), { wrapper: envoltorio() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ehEquipe).toBe(false);
  });

  it('exceção na chamada também conta como false, sem derrubar', async () => {
    h.rpc.mockRejectedValue(new Error('rede'));
    const { result } = renderHook(() => useEquipeCientifica(), { wrapper: envoltorio() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ehEquipe).toBe(false);
  });

  it('a falha não fica em cache como "não é da equipe": ao montar de novo consulta outra vez', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Could not find the function public.eh_equipe_cientifica' } });
    const primeira = renderHook(() => useEquipeCientifica(), { wrapper });
    await waitFor(() => expect(primeira.result.current.loading).toBe(false));
    expect(primeira.result.current.ehEquipe).toBe(false);
    primeira.unmount();

    h.rpc.mockResolvedValue({ data: true, error: null });
    const segunda = renderHook(() => useEquipeCientifica(), { wrapper });
    await waitFor(() => expect(segunda.result.current.ehEquipe).toBe(true));
    expect(h.rpc).toHaveBeenCalledTimes(2);
  });

  it('só true estrito vale (valor truthy qualquer não basta)', async () => {
    h.rpc.mockResolvedValue({ data: 'true', error: null });
    const { result } = renderHook(() => useEquipeCientifica(), { wrapper: envoltorio() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ehEquipe).toBe(false);
  });

  it('sem usuário logado não consulta o banco e não fica carregando', () => {
    h.user = null;
    const { result } = renderHook(() => useEquipeCientifica(), { wrapper: envoltorio() });
    expect(result.current).toEqual({ ehEquipe: false, loading: false });
    expect(h.rpc).not.toHaveBeenCalled();
  });
});

describe('useChancelaPendentes', () => {
  it('quem é da equipe vê a contagem de planos aguardando', async () => {
    h.rpc.mockResolvedValue({ data: true, error: null });
    h.count = 3;
    const { result } = renderHook(() => useChancelaPendentes(), { wrapper: envoltorio() });
    await waitFor(() => expect(result.current).toBe(3));
  });

  it('quem não é da equipe vê 0 e não consulta a tabela', async () => {
    h.rpc.mockResolvedValue({ data: false, error: null });
    h.count = 9;
    const { result } = renderHook(() => useChancelaPendentes(), { wrapper: envoltorio() });
    await waitFor(() => expect(h.rpc).toHaveBeenCalled());
    expect(result.current).toBe(0);
  });

  it('falha na contagem vira 0', async () => {
    h.rpc.mockResolvedValue({ data: true, error: null });
    h.contagemFalha = true;
    const { result } = renderHook(() => useChancelaPendentes(), { wrapper: envoltorio() });
    await waitFor(() => expect(h.rpc).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(result.current).toBe(0);
  });
});

describe('useHomeAtalhos: fila de chancela só para a equipe', () => {
  it('profissional comum não vê o atalho nem no catálogo', async () => {
    h.rpc.mockResolvedValue({ data: false, error: null });
    const { result } = renderHook(() => useHomeAtalhos(), { wrapper: envoltorio() });
    await waitFor(() => expect(h.rpc).toHaveBeenCalled());
    expect(result.current.catalogo.some((a) => a.id === 'chancela')).toBe(false);
    expect(result.current.itens.some((a) => a.id === 'chancela')).toBe(false);
  });

  it('equipe científica recebe o atalho entre os padrões', async () => {
    h.rpc.mockResolvedValue({ data: true, error: null });
    const { result } = renderHook(() => useHomeAtalhos(), { wrapper: envoltorio() });
    await waitFor(() => expect(result.current.itens.some((a) => a.id === 'chancela')).toBe(true));
    expect(result.current.itens.find((a) => a.id === 'chancela')?.to).toBe('/chancela');
  });

  it('a escolha salva do usuário vale: quem desligou o atalho não o recebe de volta', async () => {
    h.rpc.mockResolvedValue({ data: true, error: null });
    localStorage.setItem('home-atalhos-v1', JSON.stringify(['pacientes']));
    const { result } = renderHook(() => useHomeAtalhos(), { wrapper: envoltorio() });
    await waitFor(() => expect(result.current.catalogo.some((a) => a.id === 'chancela')).toBe(true));
    expect(result.current.itens.map((a) => a.id)).toEqual(['pacientes']);
  });

  it('toggle parte do padrão atual e grava a lista', async () => {
    h.rpc.mockResolvedValue({ data: true, error: null });
    const { result } = renderHook(() => useHomeAtalhos(), { wrapper: envoltorio() });
    await waitFor(() => expect(result.current.ativos).toContain('chancela'));
    act(() => result.current.toggle('chancela'));
    expect(result.current.ativos).not.toContain('chancela');
    expect(result.current.ativos).toContain('pacientes');
    expect(JSON.parse(localStorage.getItem('home-atalhos-v1') ?? '[]')).not.toContain('chancela');
  });
});
