import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({
  // Objeto estável: o componente recarrega tudo quando a referência de `user` muda.
  user: { id: 'user-1' },
  invoke: vi.fn(),
  upserts: [] as { tabela: string; valor: Record<string, unknown> }[],
  rpc: {} as Record<string, unknown>,
  anamneseRespostas: null as null | Record<string, unknown>,
  toast: { success: vi.fn(), error: vi.fn() },
  rpcChamadas: [] as { nome: string; tipo: string }[],
}));

vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/hooks/useWellnessAccess', () => ({
  useWellnessAccess: () => ({ isFree: false, isPremium: true, isInTrial: false, isLoading: false }),
}));
vi.mock('@/integrations/supabase/client', () => {
  const dados = (tabela: string) => {
    switch (tabela) {
      case 'pacientes':
        return { data: { id: 'pac-1', data_nascimento: '1990-05-10', sexo: 'feminino', genero: null }, error: null };
      case 'nutricao_anamnese':
        return { data: h.anamneseRespostas ? { respostas: h.anamneseRespostas } : null, error: null };
      case 'diretrizes_profissionais':
      case 'questionarios_clinicos':
        return { data: [], error: null };
      default:
        return { data: null, error: null };
    }
  };
  const construtor = (tabela: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) b[m] = () => b;
    b.maybeSingle = () => Promise.resolve(dados(tabela));
    b.upsert = (valor: Record<string, unknown>) => {
      h.upserts.push({ tabela, valor });
      return Promise.resolve({ error: null });
    };
    b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(dados(tabela)).then(ok, ko);
    return b;
  };
  return {
    supabase: {
      functions: { invoke: (...a: unknown[]) => h.invoke(...a) },
      rpc: (nome: string, args: { p_tipo: string }) => {
        h.rpcChamadas.push({ nome, tipo: args.p_tipo });
        return Promise.resolve({ data: h.rpc[args.p_tipo] ?? null, error: null });
      },
      from: (t: string) => construtor(t),
    },
  };
});

vi.mock('@/components/paciente/PlanoTreinoInterativo', () => ({ default: () => <div data-testid="treino-interativo" /> }));
vi.mock('@/components/planos/TriagemSegurancaCard', () => ({
  default: ({ defaultAberto }: { defaultAberto?: boolean }) => <div data-testid="triagem-card" data-aberto={String(!!defaultAberto)} />,
}));

import { PlanoPersonalizadoSection } from '../pages/paciente/PacientePlanoIA';

function renderizar() {
  return render(<MemoryRouter><PlanoPersonalizadoSection /></MemoryRouter>);
}

describe('Plano do cliente: só o que o profissional liberou', () => {
  beforeEach(() => {
    h.rpc = {};
    h.rpcChamadas.length = 0;
    h.upserts.length = 0;
    h.invoke.mockReset();
    h.anamneseRespostas = null;
  });
  afterEach(() => cleanup());

  it('lê treino e nutrição liberados pela RPC (nunca direto das tabelas) e não gera nada', async () => {
    renderizar();
    await waitFor(() => expect(h.rpcChamadas.length).toBe(2));
    expect(h.rpcChamadas.map((c) => c.tipo).sort()).toEqual(['nutricao', 'treino']);
    expect(h.rpcChamadas.every((c) => c.nome === 'meu_plano_liberado')).toBe(true);
    expect(screen.queryByText(/Gerar treino/i)).toBeNull();
    expect(screen.queryByText(/Montar meu plano/i)).toBeNull();
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it('sem plano liberado mostra que o profissional monta e libera', async () => {
    renderizar();
    expect(await screen.findByText(/assim que for liberado/i)).toBeTruthy();
  });

  it('mostra o treino liberado pelo profissional com o treino interativo', async () => {
    h.rpc.treino = { titulo: 'Treino A', conteudo: { fases: [] } };
    renderizar();
    expect(await screen.findByTestId('treino-interativo')).toBeTruthy();
  });

  it('a triagem do cliente aparece aberta enquanto estiver incompleta', async () => {
    renderizar();
    const card = await screen.findByTestId('triagem-card');
    expect(card.getAttribute('data-aberto')).toBe('true');
  });
});
