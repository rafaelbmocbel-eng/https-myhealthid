import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  user: { id: 'u-1', email: 'x@exemplo.com' } as { id: string; email: string } | null,
  rpc: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a) } }));

import { usePlanoClienteConfig } from '@/hooks/usePlanoClienteConfig';

function envolver() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  h.user = { id: 'u-1', email: 'x@exemplo.com' };
  h.rpc.mockReset();
});
afterEach(() => cleanup());

describe('usePlanoClienteConfig', () => {
  it('enquanto carrega devolve o padrão seguro (nutrição desligada, 2 dias úteis)', async () => {
    h.rpc.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePlanoClienteConfig(), { wrapper: envolver() });
    expect(result.current.loading).toBe(true);
    expect(result.current.config).toEqual({ nutricao_premium_ativa: false, prazo_chancela_dias_uteis: 2 });
  });

  it('lê a configuração do banco pela RPC plano_cliente_config', async () => {
    h.rpc.mockResolvedValue({ data: { nutricao_premium_ativa: true, prazo_chancela_dias_uteis: 3 }, error: null });
    const { result } = renderHook(() => usePlanoClienteConfig(), { wrapper: envolver() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(h.rpc).toHaveBeenCalledWith('plano_cliente_config');
    expect(result.current.config).toEqual({ nutricao_premium_ativa: true, prazo_chancela_dias_uteis: 3 });
    expect(result.current.falhou).toBe(false);
  });

  it('quando a leitura falha cai no padrão seguro e sinaliza a falha', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'Could not find the function public.plano_cliente_config in the schema cache' } });
    const { result } = renderHook(() => usePlanoClienteConfig(), { wrapper: envolver() });
    await waitFor(() => expect(result.current.falhou).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.config).toEqual({ nutricao_premium_ativa: false, prazo_chancela_dias_uteis: 2 });
  });

  it('resposta estranha não liga a nutrição', async () => {
    h.rpc.mockResolvedValue({ data: { nutricao_premium_ativa: 'sim', prazo_chancela_dias_uteis: 99 }, error: null });
    const { result } = renderHook(() => usePlanoClienteConfig(), { wrapper: envolver() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toEqual({ nutricao_premium_ativa: false, prazo_chancela_dias_uteis: 2 });
  });

  it('sem usuário logado não consulta o banco', async () => {
    h.user = null;
    const { result } = renderHook(() => usePlanoClienteConfig(), { wrapper: envolver() });
    expect(result.current.loading).toBe(false);
    expect(result.current.config.nutricao_premium_ativa).toBe(false);
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
