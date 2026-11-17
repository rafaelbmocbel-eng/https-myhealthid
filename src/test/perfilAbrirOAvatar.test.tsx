import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';
import { DEFAULT_LAYOUT_CONFIG } from '@/hooks/useLayoutConfig';

// Perfil do paciente de verdade (aba Avaliação > linha do tempo clínica > "Abrir o Avatar" > Visão Geral > sub-aba do Avatar).
// Só os cartões pesados e o Avatar são simulados; a página, a troca de aba, o painel da Visão Geral e a linha do tempo são os reais.

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
const rolar = vi.fn();
Element.prototype.scrollIntoView = rolar;

const h = vi.hoisted(() => ({
  falso: null as unknown as BancoFalso,
  subTabs: [] as Array<{ id: string; defaultLabel: string; label: string; visivel: boolean; ordem: number }>,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => h.falso.from(t),
    rpc: () => Promise.resolve({ data: null, error: null }),
    functions: { invoke: vi.fn() },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
    removeChannel: () => {},
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' }, loading: false }) }));
vi.mock('@/contexts/LayoutConfigContext', () => ({
  useLayoutConfig: () => ({ config: { ...DEFAULT_LAYOUT_CONFIG, sub_tabs: h.subTabs }, loading: false, save: async () => {}, reset: async () => {} }),
}));
vi.mock('@/components/AppLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/avatar/AvatarClinicoCard', () => ({ default: () => <div>AVATAR_CLINICO_SIMULADO</div> }));
vi.mock('@/components/avatar/CondicoesSistemicasCard', () => ({ default: () => <div>CONDICOES_SISTEMICAS_SIMULADO</div> }));
vi.mock('@/components/voice/VoiceAssessment', () => ({ default: () => <div>VoiceAssessment simulado</div> }));

import PacientePerfil from '@/pages/PacientePerfil';

function Local() {
  const l = useLocation();
  return <div data-testid="local">{l.pathname}{l.search}</div>;
}

const achado = (extra: Linha = {}): Linha => ({
  id: 'ev1', paciente_id: 'pac-1', terapeuta_id: 'prof-1', tipo_diagnostico: 'relato_paciente', status: 'ativo', metadata: {}, ...extra,
});

function preparar(achados: Linha[] = [achado()]) {
  h.falso = criarBancoFalso({
    pacientes: [{ id: 'pac-1', nome: 'Ana', sobrenome: 'Souza', terapeuta_id: 'prof-1', user_id: null, paciente_servicos: [], created_at: '2026-01-10T12:00:00+00:00', ativo: true }],
    avaliacoes_identidade: [{
      id: 'ai1', paciente_id: 'pac-1', created_at: '2026-09-02T12:00:00+00:00', data_avaliacao: '2026-09-02', myid_score: 72,
      score_d: 70, score_efi: 70, score_p: 70, score_i: 70, score_r: 70, score_c: 70, score_n: 70, dados_avaliacao: {}, red_flags: [], queixa_principal: 'Dor',
    }],
    eventos_clinicos_anatomicos: achados,
  });
}

function montar(rota = '/pacientes/pac-1?tab=presencial') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[rota]}>
        <Routes><Route path="/pacientes/:id" element={<><PacientePerfil /><Local /></>} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const aba = (nome: string) => screen.getByRole('tab', { name: nome });
const trocarPara = (nome: string) => fireEvent.mouseDown(aba(nome), { button: 0, ctrlKey: false });
const TEMPO = { timeout: 15000 };

beforeEach(() => {
  rolar.mockClear();
  h.subTabs = DEFAULT_LAYOUT_CONFIG.sub_tabs;
  preparar();
});

describe('Perfil do paciente: "Abrir o Avatar" na linha do tempo leva ao Avatar do mesmo paciente', () => {
  it('na aba Avaliação o aviso mostra o botão; clicar troca para a Visão Geral, abre a sub-aba do Avatar e rola até as abas', async () => {
    montar();
    expect(await screen.findByText('1 achado do histórico aguardando a sua revisão', undefined, TEMPO)).toBeInTheDocument();
    expect(aba('Avaliação')).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('AVATAR_CLINICO_SIMULADO')).toBeNull();
    rolar.mockClear();

    fireEvent.click(await screen.findByRole('button', { name: 'Abrir o Avatar' }, TEMPO));

    expect(await screen.findByText('AVATAR_CLINICO_SIMULADO', undefined, TEMPO)).toBeInTheDocument();
    expect(aba('Visão Geral')).toHaveAttribute('aria-selected', 'true');
    expect(aba('Corpo')).toHaveAttribute('aria-selected', 'true');
    expect(aba('MyID')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('local').textContent).toBe('/pacientes/pac-1');
    await waitFor(() => expect(rolar).toHaveBeenCalled());
    expect(h.falso.escritas()).toEqual([]);
  }, 40000);

  it('abrir a Visão Geral sem pedir o Avatar continua abrindo na sub-aba de sempre (MyID)', async () => {
    montar('/pacientes/pac-1');
    await screen.findByRole('tab', { name: 'Corpo' }, TEMPO);
    expect(aba('MyID')).toHaveAttribute('aria-selected', 'true');
    expect(aba('Corpo')).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByText('AVATAR_CLINICO_SIMULADO')).toBeNull();
  }, 40000);

  it('o pedido vale uma vez: sair para outra aba e voltar à Visão Geral abre na sub-aba de sempre, não no Corpo', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Abrir o Avatar' }, TEMPO));
    await screen.findByText('AVATAR_CLINICO_SIMULADO', undefined, TEMPO);

    trocarPara('Avaliação');
    await screen.findByText(/Linha do tempo clínica/, undefined, TEMPO);
    expect(screen.queryByText('AVATAR_CLINICO_SIMULADO')).toBeNull();

    trocarPara('Visão Geral');
    await screen.findByRole('tab', { name: 'Corpo' }, TEMPO);
    expect(aba('MyID')).toHaveAttribute('aria-selected', 'true');
    expect(aba('Corpo')).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByText('AVATAR_CLINICO_SIMULADO')).toBeNull();
  }, 40000);

  it('sem achados aguardando, não há aviso nem botão na aba Avaliação', async () => {
    preparar([]);
    montar();
    await screen.findByText(/Linha do tempo clínica/, undefined, TEMPO);
    await waitFor(() => expect(h.falso.operacoes.some((o) => o.tabela === 'eventos_clinicos_anatomicos')).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('button', { name: 'Abrir o Avatar' })).toBeNull();
    expect(screen.queryByText(/aguardando a sua revisão/)).toBeNull();
  }, 40000);

  it('se o layout esconde a sub-aba "Corpo", o Avatar não está na Visão Geral: o aviso aparece, o botão não', async () => {
    h.subTabs = DEFAULT_LAYOUT_CONFIG.sub_tabs.map((t) => (t.id === 'corpo' ? { ...t, visivel: false } : t));
    montar();
    expect(await screen.findByText('1 achado do histórico aguardando a sua revisão', undefined, TEMPO)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir o Avatar' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Linha do tempo clínica' })).queryAllByRole('button', { name: /Avatar/ })).toHaveLength(0);
  }, 40000);
});
