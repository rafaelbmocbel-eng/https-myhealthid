import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

interface Consulta {
  tabela: string;
  op: 'select' | 'delete' | 'upsert';
  filtros: [string, unknown][];
  valores?: Record<string, unknown>;
  opcoes?: Record<string, unknown>;
}

const db = vi.hoisted(() => ({ linhas: [] as Record<string, unknown>[], chamadas: [] as unknown[] }));

vi.mock('@/integrations/supabase/client', () => {
  const novo = (tabela: string) => {
    const q: Consulta = { tabela, op: 'select', filtros: [] };
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = (k: string, v: unknown) => { q.filtros.push([k, v]); return b; };
    b.gte = () => b;
    b.delete = () => { q.op = 'delete'; return b; };
    b.upsert = (valores: Record<string, unknown>, opcoes: Record<string, unknown>) => {
      q.op = 'upsert'; q.valores = valores; q.opcoes = opcoes; return b;
    };
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      db.chamadas.push(q);
      return Promise.resolve({ data: q.op === 'select' ? db.linhas : null, error: null }).then(res, rej);
    };
    return b;
  };
  return { supabase: { from: novo } };
});

vi.mock('@/lib/dataLocal', () => ({ hojeLocalISO: () => '2026-10-07' }));
vi.mock('@/lib/ganharXP', () => ({ ganharXP: vi.fn() }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', user_metadata: {} } }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import PlanoTreinoInterativo from '../components/paciente/PlanoTreinoInterativo';

const conteudo = {
  fases: [{ nome: 'Fase 1', sessoes: [{ nome: 'Treino A', exercicios: [] }] }],
};
const KEY = 'f0s0:treino a';

const chamadasDe = (op: Consulta['op']) => (db.chamadas as Consulta[]).filter((c) => c.op === op);

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PlanoTreinoInterativo pacienteId="p1" conteudo={conteudo} />
    </QueryClientProvider>,
  );
}

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() { /* stub de jsdom */ }
    unobserve() { /* stub de jsdom */ }
    disconnect() { /* stub de jsdom */ }
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  db.linhas = [];
  db.chamadas = [];
});

describe('PlanoTreinoInterativo — acompanhamento', () => {
  it('ao marcar como feito não sobrescreve linha existente e abre o "Como foi?"', async () => {
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /Marcar treino como feito/ }));

    expect(await screen.findByText('Como foi o treino?')).toBeInTheDocument();
    const [upsert] = chamadasDe('upsert');
    expect(upsert.valores).toEqual({ paciente_id: 'p1', sessao_key: KEY, data: '2026-10-07' });
    expect(upsert.opcoes).toMatchObject({ onConflict: 'paciente_id,sessao_key,data', ignoreDuplicates: true });
  });

  it('salvar o "Como foi?" envia só o que foi informado, com a mesma chave de conflito', async () => {
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /Marcar treino como feito/ }));
    await screen.findByText('Como foi o treino?');

    fireEvent.keyDown(screen.getAllByRole('slider')[1], { key: 'ArrowRight' });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(chamadasDe('upsert')).toHaveLength(2));
    const [, registro] = chamadasDe('upsert');
    expect(registro.valores).toEqual({ paciente_id: 'p1', sessao_key: KEY, data: '2026-10-07', dor: 1 });
    expect(registro.opcoes).toMatchObject({ onConflict: 'paciente_id,sessao_key,data' });
    expect(registro.opcoes).not.toHaveProperty('ignoreDuplicates');
  });

  it('desfazer sem registro apaga direto', async () => {
    db.linhas = [{ sessao_key: KEY, data: '2026-10-07' }];
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /desfazer/ }));
    await waitFor(() => expect(chamadasDe('delete')).toHaveLength(1));
    expect(screen.queryByText('Desfazer este treino?')).not.toBeInTheDocument();
  });

  it('desfazer com esforço/dor registrados pede confirmação antes de apagar', async () => {
    db.linhas = [{ sessao_key: KEY, data: '2026-10-07', rpe: 6, dor: 8 }];
    renderizar();

    expect(await screen.findByText('Esforço 6/10 · Dor 8/10')).toBeInTheDocument();
    expect(screen.getByText(/Procure o seu profissional antes de repetir esse treino/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /desfazer/ }));
    expect(await screen.findByText('Desfazer este treino?')).toBeInTheDocument();
    expect(screen.getByText(/registro também é apagado/)).toBeInTheDocument();
    expect(chamadasDe('delete')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Manter treino' }));
    await waitFor(() => expect(screen.queryByText('Desfazer este treino?')).not.toBeInTheDocument());
    expect(chamadasDe('delete')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /desfazer/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Desfazer e apagar registro' }));
    await waitFor(() => expect(chamadasDe('delete')).toHaveLength(1));
  });
});
