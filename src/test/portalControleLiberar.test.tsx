import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  user: { id: 'prof-1', email: 'prof@exemplo.com' },
  invoke: vi.fn(),
  rpc: vi.fn(),
  updates: [] as { tabela: string; valor: Record<string, unknown> }[],
  planosTreino: [] as Record<string, unknown>[],
  planosAlim: [] as Record<string, unknown>[],
  iaRows: [] as Record<string, unknown>[],
  toast: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('@/hooks/usePodeChancelar', () => ({
  usePodeChancelar: () => ({ pode: true, motivo: '', loading: false, labelExigido: 'x', viaClinica: false }),
}));
vi.mock('@/integrations/supabase/client', () => {
  const dados = (tabela: string) => {
    if (tabela === 'planos_treino') return { data: h.planosTreino, error: null };
    if (tabela === 'planos_alimentares') return { data: h.planosAlim, error: null };
    if (tabela === 'planos_ia_cliente') return { data: h.iaRows, error: null };
    return { data: [], error: null };
  };
  const construtor = (tabela: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit', 'gte']) b[m] = () => b;
    b.maybeSingle = () => Promise.resolve({ data: null, error: null });
    b.update = (valor: Record<string, unknown>) => {
      h.updates.push({ tabela, valor });
      return b;
    };
    b.insert = () => Promise.resolve({ error: null });
    b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(dados(tabela)).then(ok, ko);
    return b;
  };
  return {
    supabase: {
      functions: { invoke: (...a: unknown[]) => h.invoke(...a) },
      rpc: (...a: unknown[]) => h.rpc(...a),
      from: (t: string) => construtor(t),
    },
  };
});

vi.mock('@/components/educador/PlanoTreinoCard', () => ({ default: () => null }));
vi.mock('@/components/nutricao/PlanoAlimentarCard', () => ({ default: () => null }));
vi.mock('@/components/nutricao/DiretrizNutricionalCard', () => ({ default: () => null }));
vi.mock('@/components/educador/DiretrizTreinoCard', () => ({ default: () => null }));
vi.mock('@/components/diretrizes/DiretrizLenteCard', () => ({ default: () => null }));
vi.mock('@/components/paciente/RelatorioAvaliacaoCard', () => ({ default: () => null }));
vi.mock('@/components/paciente/QuestionariosClinicosCard', () => ({ default: () => null }));
vi.mock('@/components/presencial/ExamesPresenciaisCard', () => ({ default: () => null }));
vi.mock('@/components/paciente/JornadaPacienteCard', () => ({ default: () => null }));
vi.mock('../components/avatar/AvatarClinicoCard', () => ({ default: () => null }));
vi.mock('@/components/paciente/TreinoDocumento', () => ({ default: () => <div data-testid="treino-doc" /> }));

import PortalControleTab from '../components/paciente/PortalControleTab';

const planoRascunho = {
  id: 'pl-1', titulo: 'Treino do João', aprovado: false, created_at: '2026-10-01T12:00:00Z',
  estrutura: { fases: [{ nome: 'F1', semanas: 4, sessoes: [{ nome: 'A', exercicios: [] }] }] },
};

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PortalControleTab pacienteId="pac-1" pacienteNome="João Teste" portalToken="tok" />
    </QueryClientProvider>,
  );
}

async function abrirPlanos() {
  fireEvent.click(await screen.findByText(/Planos \(treino, nutrição, fisioterapia\)/));
}

beforeEach(() => {
  h.invoke.mockReset();
  h.rpc.mockReset();
  h.toast.mockReset();
  h.updates.length = 0;
  h.planosTreino = [];
  h.planosAlim = [];
  h.iaRows = [];
});
afterEach(() => cleanup());

describe('PortalControleTab: liberar e ocultar planos', () => {
  it('Liberar abre a revisão de segurança + RPC liberar_plano, nunca um UPDATE direto de aprovado', async () => {
    h.planosTreino = [planoRascunho];
    h.invoke.mockResolvedValue({ data: { resumo: 'ok', risco_geral: 'baixo', flags: [], persistida: true }, error: null });
    h.rpc.mockResolvedValue({ data: { aprovacao: { versao: 1, em: '2026-10-07T12:00:00Z' } }, error: null });

    renderizar();
    await abrirPlanos();
    fireEvent.click(await screen.findByRole('button', { name: /Liberar treino/ }));

    expect(await screen.findByText(/Liberar plano de treino ao paciente/)).toBeInTheDocument();
    await waitFor(() => expect(h.invoke).toHaveBeenCalledWith('revisar-plano-seguranca', { body: { paciente_id: 'pac-1', tipo: 'treino', plano_id: 'pl-1' } }));
    expect(h.updates.filter((u) => u.valor.aprovado === true)).toHaveLength(0);

    const confirmar = await screen.findByRole('button', { name: 'Liberar para o paciente' });
    await waitFor(() => expect(confirmar).toBeEnabled());
    fireEvent.click(confirmar);
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('liberar_plano', { p_tabela: 'planos_treino', p_id: 'pl-1', p_justificativa: null }));
    expect(h.updates.filter((u) => u.valor.aprovado === true)).toHaveLength(0);
  });

  it('plano liberado mostra o selo de quem liberou e Ocultar continua sendo um UPDATE simples', async () => {
    h.planosTreino = [{
      ...planoRascunho, aprovado: true,
      estrutura: {
        ...planoRascunho.estrutura,
        _governanca: { fonte: { tipo: 'ia', modelo: 'gemini-2.5-flash' }, aprovacao: { por_nome: 'Ana Souza', em: '2026-10-01T15:00:00Z', versao: 2 } },
      },
    }];
    renderizar();
    await abrirPlanos();
    expect(await screen.findByText(/Liberado por Ana Souza em 01\/10\/2026 · v2/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ocultar treino/ }));
    await waitFor(() => expect(h.updates).toHaveLength(1));
    expect(h.updates[0]).toEqual({ tabela: 'planos_treino', valor: { aprovado: false } });
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it('sem plano do profissional, o plano do cliente aparece com o selo "sem revisão de profissional"', async () => {
    h.iaRows = [{
      tipo: 'treino', titulo: 'Treino do cliente',
      conteudo: { fases: [], _governanca: { aprovacao: { por_nome: 'Dra. Falsa', em: '2026-10-01T15:00:00Z', versao: 3 } } },
    }];
    renderizar();
    await abrirPlanos();
    expect(await screen.findByText('Gerado por IA · sem revisão de profissional')).toBeInTheDocument();
    expect(screen.queryByText(/Dra\. Falsa/)).not.toBeInTheDocument();
  });
});
