import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const consulta = vi.hoisted(() => ({ resposta: { data: [] as unknown[], error: null as unknown } }));

vi.mock('@/integrations/supabase/client', () => {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.gte = () => builder;
  builder.order = () => Promise.resolve(consulta.resposta);
  return { supabase: { from: () => builder } };
});

vi.mock('@/lib/dataLocal', () => ({ hojeLocalISO: () => '2026-10-07' }));

import ComoFoiTreinoDialog from '../components/paciente/ComoFoiTreinoDialog';
import AcompanhamentoPlanoCard from '../components/educador/AcompanhamentoPlanoCard';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() { /* stub de jsdom */ }
    unobserve() { /* stub de jsdom */ }
    disconnect() { /* stub de jsdom */ }
  } as unknown as typeof ResizeObserver;
});

describe('ComoFoiTreinoDialog', () => {
  it('só habilita salvar depois de informar algo e envia apenas o que foi informado', () => {
    const onSalvar = vi.fn();
    render(<ComoFoiTreinoDialog open onOpenChange={() => {}} nomeSessao="Treino A" onSalvar={onSalvar} />);

    const salvar = screen.getByRole('button', { name: 'Salvar' });
    expect(salvar).toBeDisabled();
    expect(screen.getAllByText('não informado')).toHaveLength(2);

    const [esforco] = screen.getAllByRole('slider');
    fireEvent.keyDown(esforco, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSalvar).toHaveBeenCalledWith({ rpe: 1 });
  });

  it('mostra a orientação de procurar o profissional quando a dor passa do limite', () => {
    render(<ComoFoiTreinoDialog open onOpenChange={() => {}} inicial={{ rpe: 4, dor: 8 }} onSalvar={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/profissional/);
    expect(screen.getByRole('alert')).toHaveTextContent('6/10');
  });

  it('parte dos valores já registrados ao editar', () => {
    render(<ComoFoiTreinoDialog open onOpenChange={() => {}} inicial={{ rpe: 6, dor: 2, observacao: 'tudo bem' }} onSalvar={() => {}} />);
    expect(screen.getByText('6/10')).toBeInTheDocument();
    expect(screen.getByText('2/10')).toBeInTheDocument();
    expect(screen.getByDisplayValue('tudo bem')).toBeInTheDocument();
  });
});

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AcompanhamentoPlanoCard pacienteId="p1" />
    </QueryClientProvider>,
  );
}

describe('AcompanhamentoPlanoCard', () => {
  beforeEach(() => {
    consulta.resposta = { data: [], error: null };
  });

  it('mostra estado vazio sem treinos', async () => {
    renderCard();
    expect(await screen.findByText(/Nenhum treino marcado nas últimas 4 semanas/)).toBeInTheDocument();
  });

  it('resume treinos, médias e alerta de dor', async () => {
    consulta.resposta = {
      error: null,
      data: [
        { sessao_key: 'f0s0:treino a', data: '2026-10-06', rpe: 8, dor: 8, observacao: 'joelho' },
        { sessao_key: 'f0s1:treino b', data: '2026-10-05', rpe: 6, dor: 2, observacao: null },
        { sessao_key: 'f0s0:treino a', data: '2026-09-30', rpe: null, dor: null, observacao: null },
      ],
    };
    renderCard();
    expect(await screen.findByText('Treinos feitos')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('1 treino com dor acima do limite de alerta do app');
    expect(screen.getByRole('alert')).toHaveTextContent('joelho');
    expect(screen.getByText('7/10')).toBeInTheDocument();
    expect(screen.getByText('5/10')).toBeInTheDocument();
    expect(screen.getByText(/Sem registro de dor não significa ausência de dor/)).toBeInTheDocument();
  });

  it('avisa quando a consulta falha em vez de mostrar "sem treinos"', async () => {
    consulta.resposta = { data: [], error: { message: 'column rpe does not exist' } };
    renderCard();
    await waitFor(() => expect(screen.getByText(/Não foi possível carregar o acompanhamento/)).toBeInTheDocument());
    expect(screen.queryByText(/Nenhum treino marcado/)).not.toBeInTheDocument();
  });
});
