import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';
import { DEFAULT_LAYOUT_CONFIG } from '@/hooks/useLayoutConfig';

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = vi.fn();

const h = vi.hoisted(() => ({
  falso: null as unknown as BancoFalso,
  subTabs: [] as Array<{ id: string; defaultLabel: string; label: string; visivel: boolean; ordem: number }>,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (t: string) => h.falso.from(t), rpc: () => Promise.resolve({ data: null, error: null }) },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' } }) }));
vi.mock('@/contexts/LayoutConfigContext', () => ({
  useLayoutConfig: () => ({ config: { ...DEFAULT_LAYOUT_CONFIG, sub_tabs: h.subTabs }, loading: false, save: async () => {}, reset: async () => {} }),
}));
vi.mock('@/components/avatar/AvatarClinicoCard', () => ({ default: () => <div>AVATAR_CLINICO_SIMULADO</div> }));
vi.mock('@/components/avatar/CondicoesSistemicasCard', () => ({ default: () => <div>CONDICOES_SISTEMICAS_SIMULADO</div> }));

import PatientIntegratedDashboard from '@/components/paciente/PatientIntegratedDashboard';

const myid: Linha = {
  id: 'ai1', paciente_id: 'pac-1', created_at: '2026-09-02T12:00:00+00:00', data_avaliacao: '2026-09-02', myid_score: 72,
  score_d: 70, score_efi: 70, score_p: 70, score_i: 70, score_r: 70, score_c: 70, score_n: 70, myid_analysis: null, dados_avaliacao: {}, red_flags: [], queixa_principal: 'Dor',
};

function preparar(linhasDoMyid: Linha[] = [myid], eventos: Linha[] = []) {
  h.falso = criarBancoFalso({ avaliacoes_identidade: linhasDoMyid, myid_avaliacoes: [], eventos_clinicos_anatomicos: eventos, avaliacoes_voz: [] });
}

function montar(abrirNoAvatar?: boolean) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <PatientIntegratedDashboard pacienteId="pac-1" serviceType="identidade" isProfessional abrirNoAvatar={abrirNoAvatar} />
    </QueryClientProvider>,
  );
}

const aba = (nome: string) => screen.getByRole('tab', { name: nome });

beforeEach(() => {
  h.subTabs = DEFAULT_LAYOUT_CONFIG.sub_tabs;
  preparar();
});

describe('Painel da Visão Geral: sub-aba com que abre', () => {
  it('com o pedido de abrir o Avatar, abre na sub-aba "Corpo" e mostra o Avatar', async () => {
    montar(true);
    expect(await screen.findByText('AVATAR_CLINICO_SIMULADO')).toBeInTheDocument();
    expect(aba('Corpo')).toHaveAttribute('aria-selected', 'true');
    expect(aba('MyID')).toHaveAttribute('aria-selected', 'false');
  });

  it.each([[undefined], [false]])('sem o pedido (%s), abre na primeira sub-aba, como sempre (MyID), sem o Avatar', async (pedido) => {
    montar(pedido);
    await screen.findByRole('tab', { name: 'Corpo' });
    expect(aba('MyID')).toHaveAttribute('aria-selected', 'true');
    expect(aba('Corpo')).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByText('AVATAR_CLINICO_SIMULADO')).toBeNull();
  });

  it('com o pedido, mas a sub-aba "Corpo" escondida pelo layout, abre na primeira sub-aba e não quebra', async () => {
    h.subTabs = DEFAULT_LAYOUT_CONFIG.sub_tabs.map((t) => (t.id === 'corpo' ? { ...t, visivel: false } : t));
    montar(true);
    await screen.findByRole('tab', { name: 'MyID' });
    expect(screen.queryByRole('tab', { name: 'Corpo' })).toBeNull();
    expect(aba('MyID')).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('AVATAR_CLINICO_SIMULADO')).toBeNull();
  });

  it('sem MyID concluído, o Avatar aparece direto (como sempre) e o pedido não muda nada', async () => {
    preparar([], [{ id: 'ev1', paciente_id: 'pac-1' }]);
    montar(true);
    expect(await screen.findByText('AVATAR_CLINICO_SIMULADO')).toBeInTheDocument();
    expect(screen.getAllByText('AVATAR_CLINICO_SIMULADO')).toHaveLength(1);
    expect(screen.queryByRole('tab', { name: 'Corpo' })).toBeNull();
  });
});
