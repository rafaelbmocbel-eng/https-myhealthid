import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const h = vi.hoisted(() => ({
  user: { id: 'user-1' },
  plano: {} as Record<string, unknown>,
  tabelasLidas: [] as string[],
  escritas: 0,
  documento: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/components/paciente/ProtectedPatientRoute', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/paciente/PortalSkeleton', () => ({ default: () => <div data-testid="skeleton" /> }));
vi.mock('@/components/paciente/TreinoDocumento', () => ({
  default: (props: Record<string, unknown>) => {
    h.documento(props);
    return <div data-testid="documento" />;
  },
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      h.tabelasLidas.push(tabela);
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq']) b[m] = () => b;
      for (const m of ['update', 'insert', 'upsert', 'delete']) b[m] = () => { h.escritas++; return b; };
      b.maybeSingle = () => Promise.resolve({ data: { id: 'pac-1', nome: 'Maria', sobrenome: 'Silva', terapeuta_id: null }, error: null });
      return b;
    },
    rpc: (_nome: string, args: { p_tipo: string }) => Promise.resolve({ data: h.plano[args.p_tipo] ?? null, error: null }),
  },
}));

import PacienteTreinoCompleto from '../pages/paciente/PacienteTreinoCompleto';

function Rota() {
  return <div data-testid="rota">{useLocation().pathname}</div>;
}

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/paciente/treino-completo']}>
      <PacienteTreinoCompleto />
      <Rota />
    </MemoryRouter>,
  );
}

const fase = { nome: 'Fase 1', semanas: 2, sessoes: [] };

beforeEach(() => {
  h.plano = {};
  h.tabelasLidas.length = 0;
  h.escritas = 0;
  h.documento.mockReset();
  h.toast.error.mockReset();
});
afterEach(() => cleanup());

describe('Treino completo do portal: só o que foi liberado, somente leitura', () => {
  it('mostra o treino chancelado pela equipe, com a origem para o rodapé, lendo pela RPC', async () => {
    h.plano.treino = { titulo: 'Treino chancelado', origem: 'equipe_myhealthid', conteudo: { fases: [fase] } };
    h.plano.nutricao = { titulo: 'Dieta', origem: 'equipe_myhealthid', conteudo: { refeicoes: [{ nome: 'Café' }] } };
    renderizar();

    expect(await screen.findByTestId('documento')).toBeInTheDocument();
    const props = h.documento.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(props).toMatchObject({ nome: 'Maria Silva', titulo: 'Treino chancelado', origemGov: 'equipe_myhealthid', aprovado: true });
    expect(props.nutricao).toEqual({ refeicoes: [{ nome: 'Café' }] });
    expect(props.editando).toBeUndefined();
    expect(h.tabelasLidas).not.toContain('planos_ia_cliente');
  });

  it('plano do profissional (RPC sem origem ou com origem profissional) segue como profissional', async () => {
    h.plano.treino = { titulo: 'Treino do profissional', conteudo: { fases: [fase] } };
    renderizar();
    await screen.findByTestId('documento');
    expect(h.documento.mock.calls.at(-1)?.[0]).toMatchObject({ origemGov: 'profissional' });
  });

  it('não oferece editar nem compartilhar (alterar um plano chancelado é com a equipe/profissional)', async () => {
    h.plano.treino = { titulo: 'T', origem: 'equipe_myhealthid', conteudo: { fases: [fase] } };
    renderizar();
    await screen.findByTestId('documento');
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Compartilhar/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Imprimir/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PDF/ })).toBeEnabled();
    expect(h.escritas).toBe(0);
  });

  it('sem treino liberado explica quando ele aparece e leva ao plano de tratamento', async () => {
    renderizar();
    expect(await screen.findByText('Você ainda não tem um treino liberado.')).toBeInTheDocument();
    expect(screen.queryByTestId('documento')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PDF/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Ver meu plano de tratamento' }));
    await waitFor(() => expect(screen.getByTestId('rota')).toHaveTextContent('/paciente/exercicios'));
  });
});
