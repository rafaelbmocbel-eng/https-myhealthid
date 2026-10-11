import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  confirmado: false,
  verificacao: { registro_profissional: null, verificado: false, verificado_em: null } as Record<string, unknown>,
  erroVerificacao: false,
  rpc: vi.fn(),
  updates: [] as Record<string, unknown>[],
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1', email: 'prof@exemplo.com' } }) }));
vi.mock('@/hooks/useLenteAtiva', () => ({ useLenteAtiva: () => ({ data: { id: 'fisioterapeuta' } }) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: () => {
      let colunas = '';
      const b: Record<string, unknown> = {};
      b.select = (c: string) => {
        colunas = c;
        return b;
      };
      b.update = (valor: Record<string, unknown>) => {
        h.updates.push(valor);
        return b;
      };
      b.eq = () => b;
      b.maybeSingle = async () => {
        if (colunas.includes('registro_profissional')) {
          return h.erroVerificacao ? { data: null, error: { message: 'coluna ausente' } } : { data: h.verificacao, error: null };
        }
        return { data: { perfil_profissional_confirmado: h.confirmado, perfil_profissional_confirmado_em: null, especialidade_medica: null }, error: null };
      };
      b.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(ok);
      return b;
    },
  },
}));

import PerfilProfissionalCard from '@/components/configuracoes/PerfilProfissionalCard';

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PerfilProfissionalCard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.confirmado = false;
  h.verificacao = { registro_profissional: null, verificado: false, verificado_em: null };
  h.erroVerificacao = false;
  h.updates.length = 0;
  h.rpc.mockReset();
  h.rpc.mockResolvedValue({ data: null, error: null });
});
afterEach(() => cleanup());

describe('Minha Profissão: confirmação da profissão e verificação do registro', () => {
  it('o card ganha o campo de registro e o status, sem mexer na confirmação da profissão', async () => {
    renderizar();
    expect(await screen.findByLabelText(/Registro no conselho \(CREFITO, CREF, CRN…\)/)).toBeInTheDocument();
    expect(screen.getByText('Registro não informado')).toBeInTheDocument();
    expect(screen.getByText('Minha Profissão')).toBeInTheDocument();
    expect(screen.queryByText('Confirmada')).not.toBeInTheDocument();
  });

  it('profissão confirmada continua travada, e isso não vira "verificado"', async () => {
    h.confirmado = true;
    renderizar();
    expect(await screen.findByText('Confirmada')).toBeInTheDocument();
    expect(screen.getByText('Lente travada')).toBeInTheDocument();
    expect(await screen.findByText('Registro não informado')).toBeInTheDocument();
    expect(screen.queryByText('Verificado pela equipe MyHealthID')).not.toBeInTheDocument();
  });

  it('enviar o registro usa só a RPC de verificação: não grava na tabela nem confirma a profissão', async () => {
    renderizar();
    fireEvent.change(await screen.findByLabelText(/Registro no conselho/), { target: { value: 'CREFITO-3 123456-F' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para verificação' }));

    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('solicitar_verificacao', { p_registro: 'CREFITO-3 123456-F' }));
    expect(h.updates).toEqual([]);
  });

  it('verificado pela equipe aparece como tal', async () => {
    h.verificacao = { registro_profissional: 'CRN 1', verificado: true, verificado_em: '2026-10-08T15:00:00Z' };
    renderizar();
    expect(await screen.findByText(/Verificado pela equipe MyHealthID/)).toBeInTheDocument();
  });

  it('se a leitura da verificação falhar, o card da profissão segue funcionando', async () => {
    h.erroVerificacao = true;
    h.confirmado = true;
    renderizar();
    expect(await screen.findByText('Confirmada')).toBeInTheDocument();
    expect(screen.getByText('Lente travada')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Registro no conselho/)).not.toBeInTheDocument();
  });
});
