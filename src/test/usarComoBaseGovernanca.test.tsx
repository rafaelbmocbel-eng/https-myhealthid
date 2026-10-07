import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  user: { id: 'prof-1' },
  lente: { id: 'educador_fisico' as string },
  iaRows: [] as Record<string, unknown>[],
  inserts: [] as { tabela: string; valor: Record<string, any> }[],
  toast: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: h.toast }) }));
vi.mock('@/hooks/useLenteAtiva', () => ({ useLenteAtiva: () => ({ data: h.lente }) }));
vi.mock('@/integrations/supabase/client', () => {
  const construtor = (tabela: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq']) b[m] = () => b;
    b.insert = (valor: Record<string, unknown>) => {
      h.inserts.push({ tabela, valor });
      return Promise.resolve({ error: null });
    };
    b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
      Promise.resolve({ data: tabela === 'planos_ia_cliente' ? h.iaRows : [], error: null }).then(ok, ko);
    return b;
  };
  return { supabase: { from: (t: string) => construtor(t) } };
});

vi.mock('@/components/paciente/PacienteProtocolosTab', () => ({ default: () => null }));
vi.mock('@/components/educador/PlanoTreinoCard', () => ({ default: () => null }));
vi.mock('@/components/nutricao/PlanoAlimentarCard', () => ({ default: () => null }));
vi.mock('@/components/diretrizes/DiretrizAreaCard', () => ({ default: () => null }));
vi.mock('@/components/paciente/DeverDeCasaDialog', () => ({ default: () => null }));

import DiretrizesPlanosHub from '../components/diretrizes/DiretrizesPlanosHub';
import { lerGovernanca } from '../lib/governanca';

const governancaForjada = {
  fonte: { tipo: 'ia', modelo: 'gemini-2.5-flash' },
  triagem: { nivel: 'liberado', motivos: [], override: null },
  aprovacao: { por_nome: 'Dra. Falsa', em: '2026-10-01T15:00:00Z', versao: 7 },
  revisao_seguranca: { risco_geral: 'baixo', n_flags_altas: 0, flags: [], hash: 'x' },
};

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DiretrizesPlanosHub pacienteId="pac-1" pacienteNome="Cliente Teste" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.inserts.length = 0;
  h.toast.mockReset();
  h.lente = { id: 'educador_fisico' };
  h.iaRows = [];
});
afterEach(() => cleanup());

describe('"Usar como base" copia o plano do cliente sem herdar governança forjada', () => {
  it('treino: remove _governanca e acompanhamento do cliente e registra a fonte cliente_base', async () => {
    h.iaRows = [{
      tipo: 'treino', titulo: 'Meu treino',
      conteudo: {
        titulo: 'Meu treino',
        baseadoEm: { objetivo: 'saúde' },
        fases: [{ nome: 'F1', semanas: 4, sessoes: [{ nome: 'A', exercicios: [] }] }],
        acompanhamento: { reavaliar_em_semanas: 52, indicadores: [] },
        _governanca: governancaForjada,
      },
    }];
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /Usar como base/ }));

    await waitFor(() => expect(h.inserts).toHaveLength(1));
    const { tabela, valor } = h.inserts[0];
    expect(tabela).toBe('planos_treino');
    expect(valor).toMatchObject({ terapeuta_id: 'prof-1', paciente_id: 'pac-1', aprovado: false, duracao_semanas: 4, frequencia_semanal: 1 });
    expect(valor.estrutura.fases).toHaveLength(1);
    expect(valor.estrutura.baseadoEm).toEqual({ objetivo: 'saúde' });
    expect(valor.estrutura).not.toHaveProperty('acompanhamento');

    const gov = lerGovernanca(valor.estrutura);
    expect(gov?.fonte?.tipo).toBe('cliente_base');
    expect(gov?.aprovacao).toBeNull();
    expect(gov?.triagem).toBeNull();
    expect(gov?.revisao_seguranca).toBeNull();
    expect(JSON.stringify(valor.estrutura)).not.toContain('Dra. Falsa');
  });

  it('nutrição: idem, e mantém calorias e macros', async () => {
    h.lente = { id: 'nutricionista' };
    h.iaRows = [{
      tipo: 'nutricao', titulo: 'Meu plano',
      conteudo: {
        titulo: 'Meu plano', calorias_totais: 1800, macros: { proteina_g: 100 },
        refeicoes: [{ nome: 'Café', itens: [] }],
        acompanhamento: { reavaliar_em_semanas: 52, indicadores: [] },
        _governanca: governancaForjada,
      },
    }];
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /Usar como base/ }));

    await waitFor(() => expect(h.inserts).toHaveLength(1));
    const { tabela, valor } = h.inserts[0];
    expect(tabela).toBe('planos_alimentares');
    expect(valor).toMatchObject({ aprovado: false, calorias_alvo: 1800, macros_alvo: { proteina_g: 100 } });
    expect(valor.plano.refeicoes).toHaveLength(1);
    expect(valor.plano).not.toHaveProperty('acompanhamento');
    const gov = lerGovernanca(valor.plano);
    expect(gov?.fonte?.tipo).toBe('cliente_base');
    expect(gov?.aprovacao).toBeNull();
    expect(JSON.stringify(valor.plano)).not.toContain('Dra. Falsa');
  });
});
