import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

type Registro = Record<string, unknown>;

const h = vi.hoisted(() => ({
  notas: [] as Registro[],
  bancoAplicaFiltro: true,
  consultasNotas: [] as { filtros: [string, string, unknown][]; limite?: number }[],
  usuario: { id: 'user-1' },
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: h.usuario }) }));
vi.mock('@/components/paciente/PacienteLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/paciente/ProtectedPatientRoute', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/evolucao/EvolucaoFisicaCard', () => ({ default: () => null }));
vi.mock('@/components/paciente/RelatorioAvaliacaoView', () => ({ default: () => null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      const filtros: [string, string, unknown][] = [];
      const consulta = { filtros, limite: undefined as number | undefined };
      if (tabela === 'notas_prontuario') h.consultasNotas.push(consulta);
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.eq = (c: string, v: unknown) => { filtros.push(['eq', c, v]); return b; };
      b.neq = (c: string, v: unknown) => { filtros.push(['neq', c, v]); return b; };
      b.order = () => b;
      b.limit = (n: number) => { consulta.limite = n; return b; };
      const resolver = () => {
        if (tabela === 'notas_prontuario') {
          const naoIguais = h.bancoAplicaFiltro ? filtros.filter(([op]) => op === 'neq') : [];
          const linhas = h.notas.filter((n) => naoIguais.every(([, coluna, valor]) => n[coluna] !== valor));
          return { data: linhas, error: null };
        }
        return { data: [], error: null };
      };
      b.maybeSingle = () => Promise.resolve(tabela === 'pacientes' ? { data: { id: 'pac-1' }, error: null } : resolver());
      b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(resolver()).then(ok, ko);
      return b;
    },
  },
}));

import PacienteEvolucao from '@/pages/paciente/PacienteEvolucao';

const nota = (id: string, tipo: string, titulo: string, descricao: string): Registro => ({
  id, tipo, titulo, descricao, paciente_id: 'pac-1', created_at: '2026-11-04T15:00:00Z',
});

const NOTA_VIVA = nota('n-viva', 'checkin_semanal', 'Check-in semanal (autorrelato do cliente)', 'Resumo do que o cliente contou nas últimas semanas.');
const NOTA_ALERTA = nota('n-alerta', 'checkin_alerta', 'Check-in semanal: atenção', 'Fadiga e sono abaixo da própria média inicial por 2 semanas seguidas.');
const NOTA_DIARIO = nota('n-diario', 'diario_paciente', 'Diário de hoje', 'Dormi bem e treinei.');

async function abrirProntuario() {
  render(<PacienteEvolucao />);
  const aba = await screen.findByRole('tab', { name: /Prontuário/ });
  await waitFor(() => expect(h.consultasNotas.length).toBeGreaterThan(0));
  fireEvent.mouseDown(aba, { button: 0, ctrlKey: false });
}

beforeEach(() => {
  h.notas = [NOTA_VIVA, NOTA_ALERTA, NOTA_DIARIO];
  h.bancoAplicaFiltro = true;
  h.consultasNotas = [];
});

afterEach(() => cleanup());

describe('Portal do cliente: prontuário na tela de evolução', () => {
  it('a nota de alerta do check-in não aparece; a nota viva (autorrelato) e as demais aparecem', async () => {
    await abrirProntuario();
    expect(await screen.findByText('Check-in semanal (autorrelato do cliente)')).toBeInTheDocument();
    expect(screen.getByText('Diário de hoje')).toBeInTheDocument();
    expect(screen.queryByText('Check-in semanal: atenção')).toBeNull();
    expect(screen.queryByText(/abaixo da própria média inicial/)).toBeNull();
  });

  it('pede ao banco para deixar de fora o tipo checkin_alerta (e mantém o limite de 50 notas para o resto)', async () => {
    await abrirProntuario();
    await screen.findByText('Diário de hoje');
    expect(h.consultasNotas).toHaveLength(1);
    expect(h.consultasNotas[0].filtros).toEqual(expect.arrayContaining([['eq', 'paciente_id', 'pac-1'], ['neq', 'tipo', 'checkin_alerta']]));
    expect(h.consultasNotas[0].limite).toBe(50);
  });

  it('mesmo que o banco devolva a nota de alerta (filtro ausente ou policy antiga), a tela não a mostra', async () => {
    h.bancoAplicaFiltro = false;
    await abrirProntuario();
    expect(await screen.findByText('Check-in semanal (autorrelato do cliente)')).toBeInTheDocument();
    expect(screen.queryByText('Check-in semanal: atenção')).toBeNull();
    expect(screen.queryByText(/abaixo da própria média inicial/)).toBeNull();
  });

  it('se a única nota for a de alerta, o cliente vê o prontuário vazio, não o alerta', async () => {
    h.notas = [NOTA_ALERTA];
    h.bancoAplicaFiltro = false;
    await abrirProntuario();
    expect(await screen.findByText('Nenhum registro no prontuário')).toBeInTheDocument();
    expect(screen.queryByText('Check-in semanal: atenção')).toBeNull();
  });
});
