import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  updates: [] as { tabela: string; valor: Record<string, unknown>; filtros: [string, unknown][] }[],
  toastErro: vi.fn(),
  toastSucesso: vi.fn(),
  toastAviso: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: h.toastErro, success: h.toastSucesso, warning: h.toastAviso }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      const registro = { tabela, valor: {} as Record<string, unknown>, filtros: [] as [string, unknown][] };
      const b: Record<string, unknown> = {};
      b.update = (valor: Record<string, unknown>) => {
        registro.valor = valor;
        h.updates.push(registro);
        return b;
      };
      b.eq = (c: string, v: unknown) => {
        registro.filtros.push([c, v]);
        return b;
      };
      b.select = () => b;
      b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
        Promise.resolve({ data: [{ aprovado: false }], error: null }).then(ok, ko);
      return b;
    },
  },
}));
vi.mock('@/components/educador/SeletorExercicios', () => ({ default: () => null }));

import PlanoTreinoEditor from '@/components/educador/PlanoTreinoEditor';
import PlanoDietaEditor from '@/components/nutricao/PlanoDietaEditor';

const GOV = { versao: 1, fonte: { tipo: 'ia', insumos: ['myid'] }, revisao_seguranca: { risco_geral: 'baixo', hash: 'h1' } };

const planoTreino = {
  id: 'pl-1', titulo: 'Treino de força', aprovado: false,
  estrutura: {
    resumo: 'Foco em força',
    fases: [{ nome: 'Fase 1', semanas: 4, sessoes: [{ nome: 'Treino A', exercicios: [{ nome: 'Agachamento', series: 3, reps: '10', carga: '', descanso_s: 60, obs: '' }] }] }],
    _governanca: GOV,
  },
};

const planoDieta = {
  id: 'pl-2', titulo: 'Plano alimentar', aprovado: false,
  plano: { refeicoes: [{ nome: 'Café da manhã', horario: '07:00', calorias: '400', itens: [{ alimento: 'Ovos', porcao: '2 un', kcal: '150' }] }], _governanca: GOV },
};

function renderizar(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  h.updates.length = 0;
  h.toastErro.mockReset();
  h.toastSucesso.mockReset();
  h.toastAviso.mockReset();
});
afterEach(() => cleanup());

describe('PlanoTreinoEditor', () => {
  it('sem onSalvar: comportamento de sempre (UPDATE em planos_treino, título e botão padrão)', async () => {
    const onClose = vi.fn();
    renderizar(<PlanoTreinoEditor plano={planoTreino} pacienteId="pac-1" onClose={onClose} />);

    expect(screen.getByText('Editar plano de treino')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Treino de força'), { target: { value: 'Treino novo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].tabela).toBe('planos_treino');
    expect(h.updates[0].valor).toMatchObject({ titulo: 'Treino novo' });
    expect((h.updates[0].valor.estrutura as { _governanca: unknown })._governanca).toEqual(GOV);
    expect(h.updates[0].filtros).toContainEqual(['id', 'pl-1']);
    expect(h.toastSucesso).toHaveBeenCalled();
  });

  it('com onSalvar: entrega o conteúdo editado e o título, não grava no banco e fecha', async () => {
    const onClose = vi.fn();
    const onSalvar = vi.fn().mockResolvedValue(undefined);
    renderizar(
      <PlanoTreinoEditor
        plano={planoTreino}
        onClose={onClose}
        onSalvar={onSalvar}
        tituloDialogo="Editar treino antes de chancelar"
        rotuloSalvar="Salvar edição"
      />,
    );

    expect(screen.getByText('Editar treino antes de chancelar')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Agachamento'), { target: { value: 'Agachamento livre' } });
    fireEvent.change(screen.getByDisplayValue('Treino de força'), { target: { value: 'Treino revisado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSalvar).toHaveBeenCalledTimes(1);
    const [conteudo, titulo] = onSalvar.mock.calls[0];
    expect(titulo).toBe('Treino revisado');
    expect(conteudo.fases[0].sessoes[0].exercicios[0].nome).toBe('Agachamento livre');
    expect(conteudo._governanca).toEqual(GOV);
    expect(h.updates).toHaveLength(0);
    expect(h.toastSucesso).not.toHaveBeenCalled();
    expect(h.toastAviso).not.toHaveBeenCalled();
  });

  it('o original não é alterado até salvar (edita um clone)', async () => {
    const onSalvar = vi.fn();
    renderizar(<PlanoTreinoEditor plano={planoTreino} onClose={vi.fn()} onSalvar={onSalvar} />);
    fireEvent.change(screen.getByDisplayValue('Agachamento'), { target: { value: 'Outro' } });
    expect(planoTreino.estrutura.fases[0].sessoes[0].exercicios[0].nome).toBe('Agachamento');
  });

  it('onSalvar que falha mostra o erro e mantém o editor aberto', async () => {
    const onClose = vi.fn();
    const onSalvar = vi.fn().mockRejectedValue(new Error('Sem permissão para salvar'));
    renderizar(<PlanoTreinoEditor plano={planoTreino} onClose={onClose} onSalvar={onSalvar} />);

    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(h.toastErro).toHaveBeenCalledWith('Sem permissão para salvar'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Editar plano de treino')).toBeInTheDocument();
  });

  it('Cancelar fecha sem salvar, nos dois modos', () => {
    const onClose = vi.fn();
    const onSalvar = vi.fn();
    renderizar(<PlanoTreinoEditor plano={planoTreino} onClose={onClose} onSalvar={onSalvar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSalvar).not.toHaveBeenCalled();
    expect(h.updates).toHaveLength(0);
  });
});

describe('PlanoDietaEditor', () => {
  it('sem onSalvar: comportamento de sempre (UPDATE em planos_alimentares)', async () => {
    const onClose = vi.fn();
    renderizar(<PlanoDietaEditor plano={planoDieta} pacienteId="pac-1" onClose={onClose} />);

    expect(screen.getByText('Editar plano alimentar')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Ovos'), { target: { value: 'Ovos mexidos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(h.updates).toHaveLength(1);
    expect(h.updates[0].tabela).toBe('planos_alimentares');
    expect(h.updates[0].valor).toMatchObject({ titulo: 'Plano alimentar' });
    const salvo = h.updates[0].valor.plano as { refeicoes: { itens: { alimento: string }[] }[]; _governanca: unknown };
    expect(salvo.refeicoes[0].itens[0].alimento).toBe('Ovos mexidos');
    expect(salvo._governanca).toEqual(GOV);
    expect(h.updates[0].filtros).toContainEqual(['id', 'pl-2']);
  });

  it('com onSalvar: entrega o plano editado e o título, não grava no banco e fecha', async () => {
    const onClose = vi.fn();
    const onSalvar = vi.fn().mockResolvedValue(undefined);
    renderizar(
      <PlanoDietaEditor
        plano={planoDieta}
        onClose={onClose}
        onSalvar={onSalvar}
        tituloDialogo="Editar plano alimentar antes de chancelar"
        rotuloSalvar="Salvar edição"
      />,
    );

    expect(screen.getByText('Editar plano alimentar antes de chancelar')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Ovos'), { target: { value: 'Omelete' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [plano, titulo] = onSalvar.mock.calls[0];
    expect(titulo).toBe('Plano alimentar');
    expect(plano.refeicoes[0].itens[0].alimento).toBe('Omelete');
    expect(plano._governanca).toEqual(GOV);
    expect(h.updates).toHaveLength(0);
    expect(h.toastSucesso).not.toHaveBeenCalled();
  });

  it('onSalvar que falha mostra o erro e mantém o editor aberto', async () => {
    const onClose = vi.fn();
    renderizar(<PlanoDietaEditor plano={planoDieta} onClose={onClose} onSalvar={vi.fn().mockRejectedValue(new Error('Falhou'))} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(h.toastErro).toHaveBeenCalledWith('Falhou'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
