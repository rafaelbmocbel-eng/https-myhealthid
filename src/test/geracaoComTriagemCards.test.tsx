import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  invoke: vi.fn(),
  inserts: [] as { tabela: string; valor: Record<string, unknown> }[],
  updates: [] as { tabela: string; valor: Record<string, unknown> }[],
  planos: [] as Record<string, unknown>[],
  toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1', email: 'prof@exemplo.com' } }) }));
vi.mock('@/hooks/usePodeChancelar', () => ({
  usePodeChancelar: () => ({ pode: true, motivo: '', loading: false, labelExigido: 'Educador Físico', viaClinica: false }),
}));
vi.mock('@/integrations/supabase/client', () => {
  const dadosDa = (tabela: string) => {
    if (tabela === 'planos_treino' || tabela === 'planos_alimentares') return { data: h.planos, error: null };
    if (tabela === 'pacientes') return { data: { nome: 'Cli', data_nascimento: '1990-05-10', sexo: 'feminino' }, error: null };
    return { data: tabela === 'testes_funcionais_paciente' ? [] : null, error: null };
  };
  const construtor = (tabela: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit', 'gte']) b[m] = () => b;
    b.maybeSingle = () => Promise.resolve(dadosDa(tabela));
    b.insert = (valor: Record<string, unknown>) => {
      h.inserts.push({ tabela, valor });
      return Promise.resolve({ error: null });
    };
    b.update = (valor: Record<string, unknown>) => {
      h.updates.push({ tabela, valor });
      return b;
    };
    b.delete = () => b;
    b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(dadosDa(tabela)).then(ok, ko);
    return b;
  };
  return {
    supabase: {
      functions: { invoke: (...a: unknown[]) => h.invoke(...a) },
      rpc: vi.fn(),
      from: (tabela: string) => construtor(tabela),
    },
  };
});

vi.mock('@/components/paciente/TreinoDocumento', () => ({ default: () => <div data-testid="treino-doc" /> }));
vi.mock('@/components/educador/PlanoTreinoEditor', () => ({ default: () => null }));
vi.mock('@/components/nutricao/PlanoDietaEditor', () => ({ default: () => null }));
vi.mock('@/components/educador/AcompanhamentoPlanoCard', () => ({ default: () => <div data-testid="acompanhamento" /> }));
vi.mock('@/components/planos/RevisorSeguranca', () => ({ default: () => null }));

import PlanoTreinoCard from '../components/educador/PlanoTreinoCard';
import PlanoAlimentarCard from '../components/nutricao/PlanoAlimentarCard';

const bloqueio = (nivel: 'bloqueia' | 'confirmar', extra: Record<string, unknown> = {}) => ({
  ok: false,
  bloqueio: {
    nivel,
    motivos: [{ codigo: 'idade_menor', rotulo: 'Menor de 18 anos', detalhe: 'Cadastro indica 16 anos.', origem: 'cadastro', nivel }],
    dadosAusentes: [],
    pode_prosseguir_profissional: true,
    ...extra,
  },
});

const planoTreinoIA = { titulo: 'Plano IA', fases: [{ nome: 'F1', semanas: 4, sessoes: [] }], _governanca: { versao: 1 } };

function renderizar(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  h.invoke.mockReset();
  h.inserts.length = 0;
  h.updates.length = 0;
  h.planos = [];
  Object.values(h.toast).forEach((f) => f.mockReset());
});
afterEach(() => cleanup());

describe('PlanoTreinoCard + triagem de segurança', () => {
  it('bloqueio na geração manual abre o diálogo (não quebra) e só gera com justificativa e ciência, reenviando o mesmo pedido', async () => {
    h.invoke
      .mockResolvedValueOnce({ data: bloqueio('bloqueia'), error: null })
      .mockResolvedValueOnce({ data: { ok: true, plano: planoTreinoIA }, error: null });

    renderizar(<PlanoTreinoCard pacienteId="pac-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Gerar plano com IA/ }));

    expect(await screen.findByText('Geração bloqueada pela triagem')).toBeInTheDocument();
    expect(h.invoke).toHaveBeenCalledTimes(1);
    expect(h.inserts).toHaveLength(0);
    const primeiroCorpo = (h.invoke.mock.calls[0][1] as { body: Record<string, unknown> }).body;
    expect(primeiroCorpo).not.toHaveProperty('override');
    expect(primeiroCorpo).toMatchObject({ paciente_id: 'pac-1', objetivo: 'hipertrofia', nivel: 'iniciante', sexo: 'feminino' });
    expect(typeof primeiroCorpo.idade).toBe('number');

    const prosseguir = screen.getByRole('button', { name: 'Gerar mesmo assim' });
    expect(prosseguir).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Justificativa/), { target: { value: 'Liberado pelo pediatra, treino supervisionado.' } });
    fireEvent.click(screen.getByLabelText(/Estou ciente/));
    expect(prosseguir).toBeEnabled();
    fireEvent.click(prosseguir);

    await waitFor(() => expect(h.inserts).toHaveLength(1));
    expect(h.invoke).toHaveBeenCalledTimes(2);
    const segundoCorpo = (h.invoke.mock.calls[1][1] as { body: Record<string, unknown> }).body;
    expect(segundoCorpo).toMatchObject({ ...primeiroCorpo, override: { justificativa: 'Liberado pelo pediatra, treino supervisionado.', ciente: true } });
    expect(h.inserts[0].tabela).toBe('planos_treino');
    expect(h.inserts[0].valor).toMatchObject({ paciente_id: 'pac-1', terapeuta_id: 'prof-1', aprovado: false, estrutura: planoTreinoIA });
    await waitFor(() => expect(screen.queryByText('Geração bloqueada pela triagem')).not.toBeInTheDocument());
  });

  it("nível 'confirmar' pede só a ciência", async () => {
    h.invoke
      .mockResolvedValueOnce({ data: bloqueio('confirmar'), error: null })
      .mockResolvedValueOnce({ data: { ok: true, plano: planoTreinoIA }, error: null });

    renderizar(<PlanoTreinoCard pacienteId="pac-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Gerar plano com IA/ }));
    expect(await screen.findByText('Confirme antes de gerar o plano')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Estou ciente/));
    fireEvent.click(screen.getByRole('button', { name: 'Gerar plano' }));
    await waitFor(() => expect(h.inserts).toHaveLength(1));
    const corpo = (h.invoke.mock.calls[1][1] as { body: { override: Record<string, unknown> } }).body;
    expect(corpo.override.ciente).toBe(true);
  });

  it('cancelar a decisão manual não gera nada', async () => {
    h.invoke.mockResolvedValue({ data: bloqueio('bloqueia'), error: null });
    renderizar(<PlanoTreinoCard pacienteId="pac-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Gerar plano com IA/ }));
    await screen.findByText('Geração bloqueada pela triagem');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByText('Geração bloqueada pela triagem')).not.toBeInTheDocument());
    expect(h.inserts).toHaveLength(0);
    expect(h.invoke).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Geração pausada pela triagem de segurança')).not.toBeInTheDocument();
  });

  it('autoGerar: se a triagem bloqueia, só sinaliza no card — não abre diálogo, não gera e não entra em loop', async () => {
    h.invoke.mockResolvedValue({ data: bloqueio('bloqueia'), error: null });
    const onBloqueioAuto = vi.fn();

    const { rerender } = renderizar(<PlanoTreinoCard pacienteId="pac-1" autoGerar ocultarGerador onBloqueioAuto={onBloqueioAuto} />);

    expect(await screen.findByText('Geração pausada pela triagem de segurança')).toBeInTheDocument();
    expect(screen.queryByText('Geração bloqueada pela triagem')).not.toBeInTheDocument();
    expect(onBloqueioAuto).toHaveBeenCalledWith('pausado');
    expect(h.inserts).toHaveLength(0);

    await new Promise((r) => setTimeout(r, 60));
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <PlanoTreinoCard pacienteId="pac-1" autoGerar ocultarGerador onBloqueioAuto={onBloqueioAuto} />
      </QueryClientProvider>,
    );
    await new Promise((r) => setTimeout(r, 60));
    expect(h.invoke).toHaveBeenCalledTimes(1);
    expect(h.inserts).toHaveLength(0);
  });

  it('autoGerar bloqueado: "Revisar e decidir" abre o diálogo e o profissional pode prosseguir', async () => {
    h.invoke
      .mockResolvedValueOnce({ data: bloqueio('confirmar'), error: null })
      .mockResolvedValueOnce({ data: { ok: true, plano: planoTreinoIA }, error: null });
    const onBloqueioAuto = vi.fn();

    renderizar(<PlanoTreinoCard pacienteId="pac-1" autoGerar ocultarGerador onBloqueioAuto={onBloqueioAuto} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Revisar e decidir' }));
    expect(await screen.findByText('Confirme antes de gerar o plano')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Estou ciente/));
    fireEvent.click(screen.getByRole('button', { name: 'Gerar plano' }));

    await waitFor(() => expect(h.inserts).toHaveLength(1));
    expect(onBloqueioAuto).toHaveBeenLastCalledWith('liberado');
    expect(h.invoke).toHaveBeenCalledTimes(2);
  });

  it('"Dispensar" avisa o pai e libera uma nova tentativa automática depois', async () => {
    h.invoke.mockResolvedValue({ data: bloqueio('bloqueia'), error: null });
    const onBloqueioAuto = vi.fn();
    renderizar(<PlanoTreinoCard pacienteId="pac-1" autoGerar ocultarGerador onBloqueioAuto={onBloqueioAuto} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dispensar' }));
    expect(onBloqueioAuto).toHaveBeenLastCalledWith('dispensado');
    expect(screen.queryByText('Geração pausada pela triagem de segurança')).not.toBeInTheDocument();
    expect(h.invoke).toHaveBeenCalledTimes(1);
  });

  it('erro de rede/IA mostra toast e não deixa nada pendente', async () => {
    h.invoke.mockResolvedValue({ data: { error: 'Créditos de IA esgotados' }, error: null });
    renderizar(<PlanoTreinoCard pacienteId="pac-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Gerar plano com IA/ }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Créditos de IA esgotados'));
    expect(h.inserts).toHaveLength(0);
    expect(screen.queryByText('Geração pausada pela triagem de segurança')).not.toBeInTheDocument();
  });

  it('plano liberado mostra o selo com quem liberou e o botão Liberar só aparece para rascunho', async () => {
    h.planos = [{
      id: 'pl-1', titulo: 'Treino A', aprovado: true, terapeuta_id: 'prof-1', created_at: '2026-10-01T12:00:00Z',
      frequencia_semanal: 3, duracao_semanas: 8, objetivo: 'saude', nivel: 'iniciante',
      estrutura: {
        fases: [],
        _governanca: {
          versao: 1,
          fonte: { tipo: 'ia', modelo: 'gemini-2.5-flash' },
          aprovacao: { por_nome: 'Ana Souza', em: '2026-10-01T15:00:00Z', versao: 1 },
          acompanhamento: { reavaliar_em_semanas: 4, indicadores: [] },
        },
      },
    }];
    renderizar(<PlanoTreinoCard pacienteId="pac-1" />);
    expect(await screen.findByText(/Liberado por Ana Souza em 01\/10\/2026 · v1/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ocultar' })).toBeInTheDocument();
    expect(screen.getByText(/Reavaliar em 4 semanas/)).toBeInTheDocument();
    expect(screen.getByTestId('acompanhamento')).toBeInTheDocument();
  });

  it('Liberar abre o diálogo de liberação em vez de atualizar aprovado direto', async () => {
    h.planos = [{
      id: 'pl-2', titulo: 'Treino B', aprovado: false, terapeuta_id: 'prof-1', created_at: '2026-10-01T12:00:00Z',
      frequencia_semanal: 3, duracao_semanas: 8, objetivo: 'saude', nivel: 'iniciante', estrutura: { fases: [] },
    }];
    h.invoke.mockResolvedValue({ data: { resumo: 'Sem pontos críticos', risco_geral: 'baixo', flags: [], persistida: true }, error: null });
    renderizar(<PlanoTreinoCard pacienteId="pac-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Liberar' }));

    expect(await screen.findByText(/Liberar plano de treino ao paciente/)).toBeInTheDocument();
    await waitFor(() => expect(h.invoke).toHaveBeenCalledWith('revisar-plano-seguranca', { body: { paciente_id: 'pac-1', tipo: 'treino', plano_id: 'pl-2' } }));
    expect(h.updates.filter((u) => 'aprovado' in u.valor)).toHaveLength(0);
  });
});

describe('PlanoAlimentarCard + triagem de segurança', () => {
  it('autoGerar bloqueado: sinaliza no card, não gera e não repete a chamada', async () => {
    h.invoke.mockResolvedValue({ data: bloqueio('bloqueia'), error: null });
    const onBloqueioAuto = vi.fn();
    renderizar(<PlanoAlimentarCard pacienteId="pac-1" autoGerar ocultarGerador onBloqueioAuto={onBloqueioAuto} />);

    expect(await screen.findByText('Geração pausada pela triagem de segurança')).toBeInTheDocument();
    expect(screen.queryByText('Geração bloqueada pela triagem')).not.toBeInTheDocument();
    expect(onBloqueioAuto).toHaveBeenCalledWith('pausado');
    await new Promise((r) => setTimeout(r, 80));
    expect(h.invoke).toHaveBeenCalledTimes(1);
    expect(h.inserts).toHaveLength(0);
    expect((h.invoke.mock.calls[0][1] as { body: Record<string, unknown> }).body).toMatchObject({ paciente_id: 'pac-1' });
  });

  it('geração manual bloqueada: fecha o formulário, abre a decisão e reenvia o mesmo pedido com override', async () => {
    h.invoke
      .mockResolvedValueOnce({ data: bloqueio('bloqueia'), error: null })
      .mockResolvedValueOnce({ data: { ok: true, plano: { titulo: 'Plano', calorias_totais: 1800, refeicoes: [{ nome: 'Café' }], _governanca: { versao: 1 } } }, error: null });

    renderizar(<PlanoAlimentarCard pacienteId="pac-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Novo/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Gerar com IA/ }));

    expect(await screen.findByText('Geração bloqueada pela triagem')).toBeInTheDocument();
    expect(h.inserts).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/Justificativa/), { target: { value: 'Acompanhamento nutricional em andamento.' } });
    fireEvent.click(screen.getByLabelText(/Estou ciente/));
    fireEvent.click(screen.getByRole('button', { name: 'Gerar mesmo assim' }));

    await waitFor(() => expect(h.inserts).toHaveLength(1));
    const corpo = (h.invoke.mock.calls[1][1] as { body: Record<string, unknown> }).body;
    expect(corpo.override).toEqual({ justificativa: 'Acompanhamento nutricional em andamento.', ciente: true });
    expect(corpo.paciente_id).toBe('pac-1');
    expect(h.inserts[0].tabela).toBe('planos_alimentares');
    expect(h.inserts[0].valor).toMatchObject({ aprovado: false, calorias_alvo: 1800, terapeuta_id: 'prof-1' });
  });
});
