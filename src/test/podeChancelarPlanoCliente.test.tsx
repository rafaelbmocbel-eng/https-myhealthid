import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  user: { id: 'u-1', email: 'equipe@exemplo.com' } as { id: string; email: string } | null,
  perfil: null as string | null,
  erro: false,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/hooks/useLenteAtiva', () => ({
  useLenteAtiva: () => ({ data: { id: 'fisioterapeuta' }, isLoading: false }),
}));
vi.mock('@/hooks/useClinicaContext', () => ({ useClinicaContext: () => ({ isSolo: true, loading: false }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = () => b;
      b.maybeSingle = () =>
        Promise.resolve(h.erro ? { data: null, error: { message: 'x' } } : { data: { perfil_profissional: h.perfil }, error: null });
      return b;
    },
  },
}));

import { podeChancelarPlanoCliente, usePodeChancelarPlanoCliente } from '@/hooks/usePodeChancelar';

function envoltorio() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  h.user = { id: 'u-1', email: 'equipe@exemplo.com' };
  h.perfil = null;
  h.erro = false;
});
afterEach(() => cleanup());

describe('podeChancelarPlanoCliente (mesma regra do banco)', () => {
  it('treino: educador físico ou fisioterapeuta; nutrição: nutricionista', () => {
    expect(podeChancelarPlanoCliente('treino', 'educador_fisico', false)).toBe(true);
    expect(podeChancelarPlanoCliente('treino', 'fisioterapeuta', false)).toBe(true);
    expect(podeChancelarPlanoCliente('treino', 'nutricionista', false)).toBe(false);
    expect(podeChancelarPlanoCliente('nutricao', 'nutricionista', false)).toBe(true);
    expect(podeChancelarPlanoCliente('nutricao', 'educador_fisico', false)).toBe(false);
  });

  it('sem perfil gravado não há habilitação (o padrão da lente não vale); super-admin chancela tudo', () => {
    expect(podeChancelarPlanoCliente('treino', null, false)).toBe(false);
    expect(podeChancelarPlanoCliente('treino', undefined, false)).toBe(false);
    expect(podeChancelarPlanoCliente('nutricao', '', false)).toBe(false);
    expect(podeChancelarPlanoCliente('treino', null, true)).toBe(true);
    expect(podeChancelarPlanoCliente('nutricao', 'educador_fisico', true)).toBe(true);
  });
});

describe('usePodeChancelarPlanoCliente', () => {
  it('perfil nulo no banco: não pode chancelar treino, mesmo com a lente caindo em fisioterapeuta', async () => {
    h.perfil = null;
    const { result } = renderHook(() => usePodeChancelarPlanoCliente('treino'), { wrapper: envoltorio() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pode).toBe(false);
    expect(result.current.labelExigido).toBe('Educador Físico ou Fisioterapeuta');
    expect(result.current.motivo).toMatch(/perfil profissional ainda não está definido/);
  });

  it('perfil gravado serve só à própria área', async () => {
    h.perfil = 'nutricionista';
    const nutri = renderHook(() => usePodeChancelarPlanoCliente('nutricao'), { wrapper: envoltorio() });
    await waitFor(() => expect(nutri.result.current.loading).toBe(false));
    expect(nutri.result.current.pode).toBe(true);
    const treino = renderHook(() => usePodeChancelarPlanoCliente('treino'), { wrapper: envoltorio() });
    await waitFor(() => expect(treino.result.current.loading).toBe(false));
    expect(treino.result.current.pode).toBe(false);
    expect(treino.result.current.motivo).toMatch(/cada profissional chancela a sua própria área/);
  });

  it('super-admin pode qualquer área, mesmo sem perfil', async () => {
    h.user = { id: 'u-9', email: 'RafaelBMocbel@gmail.com' };
    h.perfil = null;
    const { result } = renderHook(() => usePodeChancelarPlanoCliente('nutricao'), { wrapper: envoltorio() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pode).toBe(true);
    expect(result.current.motivo).toMatch(/conta administradora/);
  });

  it('erro ao ler o perfil: não pode (o banco decide de qualquer forma)', async () => {
    h.erro = true;
    const { result } = renderHook(() => usePodeChancelarPlanoCliente('treino'), { wrapper: envoltorio() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.pode).toBe(false);
  });
});
