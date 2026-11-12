import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => h.invoke(...a) } } }));

import { concederPremiumCliente, revogarPremiumCliente } from '@/hooks/useAdminMetrics';

beforeEach(() => h.invoke.mockReset());

describe('concederPremiumCliente / revogarPremiumCliente', () => {
  it('chama a função admin-metrics com a ação e os dados certos', async () => {
    h.invoke.mockResolvedValue({ data: { ok: true, ja_premium: false, ate: null }, error: null });
    await expect(concederPremiumCliente({ email: 'a@b.com', dias: 7 })).resolves.toEqual({ ok: true, ja_premium: false, ate: null });
    expect(h.invoke).toHaveBeenCalledWith('admin-metrics', { body: { action: 'conceder_premium_cliente', email: 'a@b.com', dias: 7 } });
    h.invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await revogarPremiumCliente({ email: 'a@b.com' });
    expect(h.invoke).toHaveBeenLastCalledWith('admin-metrics', { body: { action: 'revogar_premium_cliente', email: 'a@b.com' } });
  });

  it('erro HTTP da função: usa a mensagem do corpo em vez da genérica', async () => {
    h.invoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: 'Nenhuma conta de cliente com esse e-mail.' }) } },
    });
    await expect(concederPremiumCliente({ email: 'a@b.com' })).rejects.toThrow('Nenhuma conta de cliente com esse e-mail.');
  });

  it('erro 500 do servidor: mensagem simples, sem vazar o texto interno do banco', async () => {
    h.invoke.mockResolvedValue({
      data: null,
      error: { message: 'Edge Function returned a non-2xx status code', context: { status: 500, json: async () => ({ error: 'new row violates check constraint "x"' }) } },
    });
    const erro = await concederPremiumCliente({ email: 'a@b.com' }).catch((e: Error) => e);
    expect((erro as Error).message).toMatch(/^Erro no servidor/);
    expect((erro as Error).message).not.toContain('check constraint');
  });

  it('erro 4xx continua mostrando a mensagem do corpo', async () => {
    h.invoke.mockResolvedValue({
      data: null,
      error: { message: 'x', context: { status: 409, json: async () => ({ error: 'Essa conta é de paciente de um profissional.' }) } },
    });
    await expect(concederPremiumCliente({ email: 'a@b.com' })).rejects.toThrow('Essa conta é de paciente de um profissional.');
  });

  it('erro sem corpo legível: cai na mensagem genérica; "error" dentro de data também vira exceção', async () => {
    h.invoke.mockResolvedValue({ data: null, error: { message: 'falha de rede', context: { json: async () => { throw new Error('sem corpo'); } } } });
    await expect(revogarPremiumCliente({ email: 'a@b.com' })).rejects.toThrow('falha de rede');
    h.invoke.mockResolvedValue({ data: { error: 'Informe um e-mail válido.' }, error: null });
    await expect(revogarPremiumCliente({ email: 'x' })).rejects.toThrow('Informe um e-mail válido.');
  });
});
