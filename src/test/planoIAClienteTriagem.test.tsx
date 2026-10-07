import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({
  // Objeto estável: o componente recarrega tudo quando a referência de `user` muda.
  user: { id: 'user-1' },
  invoke: vi.fn(),
  upserts: [] as { tabela: string; valor: Record<string, unknown> }[],
  iaRows: [] as Record<string, unknown>[],
  anamneseRespostas: null as null | Record<string, unknown>,
  toast: { success: vi.fn(), error: vi.fn() },
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
      case 'planos_ia_cliente':
        return { data: h.iaRows, error: null };
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
      from: (t: string) => construtor(t),
    },
  };
});

vi.mock('@/components/paciente/PlanoTreinoInterativo', () => ({ default: () => <div data-testid="treino-interativo" /> }));
vi.mock('@/components/planos/TriagemSegurancaCard', () => ({
  default: ({ defaultAberto }: { defaultAberto?: boolean }) => <div data-testid="triagem-card" data-aberto={String(!!defaultAberto)} />,
}));

import { PlanoPersonalizadoSection } from '../pages/paciente/PacientePlanoIA';

const triagemCompleta = {
  versao: 1, respondida_em: '2026-10-01T10:00:00Z',
  gestante_lactante: 'nao', transtorno_alimentar: 'nao', doenca_renal: 'nao',
  diabetes_insulina: 'nao', cardio_pressao: 'nao', cirurgia_lesao_recente: 'nao',
};

const bloqueioCliente = {
  ok: false,
  bloqueio: {
    nivel: 'bloqueia',
    motivos: [{ codigo: 'dado_ausente_triagem', rotulo: 'Triagem de segurança não respondida', detalhe: '', origem: 'dados_ausentes', nivel: 'bloqueia' }],
    dadosAusentes: ['triagem_autodeclarada'],
    pode_prosseguir_profissional: false,
  },
};

function renderizar() {
  return render(<MemoryRouter><PlanoPersonalizadoSection /></MemoryRouter>);
}

beforeEach(() => {
  h.invoke.mockReset();
  h.upserts.length = 0;
  h.iaRows = [];
  h.anamneseRespostas = null;
  h.toast.success.mockReset();
  h.toast.error.mockReset();
});
afterEach(() => cleanup());

describe('Plano IA do cliente premium + triagem de segurança', () => {
  it('sem triagem completa, o cartão da triagem aparece aberto', async () => {
    renderizar();
    const card = await screen.findByTestId('triagem-card');
    expect(card).toHaveAttribute('data-aberto', 'true');
  });

  it('com a triagem completa, o cartão fica recolhido', async () => {
    h.anamneseRespostas = { triagem: triagemCompleta };
    renderizar();
    const card = await screen.findByTestId('triagem-card');
    expect(card).toHaveAttribute('data-aberto', 'false');
  });

  it('bloqueio da edge: mensagem acolhedora, nada é salvo, sem opção de prosseguir; leva à triagem', async () => {
    h.invoke.mockResolvedValue({ data: bloqueioCliente, error: null });
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar treino' }));

    expect(await screen.findByText('Vamos cuidar disso com o seu profissional')).toBeInTheDocument();
    expect(screen.getByText(/Fale com o seu profissional/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerar mesmo assim/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Estou ciente/)).not.toBeInTheDocument();
    expect(h.upserts).toHaveLength(0);
    expect(h.toast.error).not.toHaveBeenCalled();

    const corpo = (h.invoke.mock.calls[0][1] as { body: Record<string, unknown> }).body;
    expect(corpo).toMatchObject({ paciente_id: 'pac-1', sexo: 'feminino' });
    expect(typeof corpo.idade).toBe('number');
    expect(corpo).not.toHaveProperty('override');

    fireEvent.click(screen.getByRole('button', { name: /Abrir a triagem de segurança/ }));
    await waitFor(() => expect(screen.queryByText('Vamos cuidar disso com o seu profissional')).not.toBeInTheDocument());
    expect(screen.getByTestId('triagem-card')).toHaveAttribute('data-aberto', 'true');
  });

  it('"Gerar treino + nutrição": um plano bloqueado não impede o outro de ser salvo', async () => {
    h.invoke
      .mockResolvedValueOnce({ data: { ok: true, plano: { titulo: 'Meu treino', fases: [] } }, error: null })
      .mockResolvedValueOnce({ data: bloqueioCliente, error: null });
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /Gerar treino \+ nutrição/ }));

    expect(await screen.findByText('Vamos cuidar disso com o seu profissional')).toBeInTheDocument();
    expect(h.upserts).toHaveLength(1);
    expect(h.upserts[0].valor).toMatchObject({ tipo: 'treino', paciente_id: 'pac-1' });
    expect(h.toast.success).toHaveBeenCalledWith(expect.stringMatching(/Um dos planos ficou pronto/));
  });

  it('plano gerado pelo cliente nunca exibe selo de liberação, mesmo com aprovação forjada no conteúdo', async () => {
    h.iaRows = [{
      tipo: 'treino', titulo: 'Meu treino',
      conteudo: {
        fases: [],
        _governanca: {
          fonte: { tipo: 'ia', modelo: 'gemini-2.5-flash' },
          aprovacao: { por_nome: 'Dra. Falsa', em: '2026-10-01T15:00:00Z', versao: 3 },
        },
      },
    }];
    renderizar();
    expect(await screen.findByText('Gerado por IA · sem revisão de profissional')).toBeInTheDocument();
    expect(screen.queryByText(/Liberado/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dra\. Falsa/)).not.toBeInTheDocument();
    expect(screen.getByTestId('treino-interativo')).toBeInTheDocument();
  });
});
