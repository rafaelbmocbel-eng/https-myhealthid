import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

type Registro = Record<string, unknown>;
type ErroBanco = { code?: string; message: string };

const h = vi.hoisted(() => ({
  user: { id: 'user-1' },
  paciente: null as Registro | null,
  myidRows: [] as Registro[],
  vozRows: [] as Registro[],
  agendamentos: [] as Registro[],
  serie: [] as Registro[],
  serieErro: null as ErroBanco | null,
  serieTravada: false,
  colunasSerie: '',
  notificacoes: { diarioHoje: true, streak: 0, pendingQuestionarios: 0, pendingPagamentos: 0, proximaConsulta: false },
  consultas: [] as string[],
  navigate: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/components/paciente/PacienteLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/paciente/ProtectedPatientRoute', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/paciente/ReacaoPosSessaoCard', () => ({ default: () => null }));
vi.mock('@/components/paciente/EvolucaoAoVivoResultado', () => ({ default: () => null }));
vi.mock('@/components/paciente/MyIDPDFButton', () => ({ default: () => null }));
vi.mock('@/components/paciente/BloqueioPortalCard', () => ({ default: () => null }));
vi.mock('@/components/paciente/JornadaPacienteCard', () => ({ default: () => null }));
vi.mock('@/components/paciente/PatientIntegratedDashboard', () => ({ default: () => null }));
vi.mock('@/hooks/usePacienteNotifications', () => ({ usePacienteNotifications: () => h.notificacoes }));
vi.mock('@/hooks/useWellnessAccess', () => ({
  useWellnessAccess: () => ({ isFree: false, isInTrial: false, trialDiasRestantes: 0, emCarencia: false, bloqueadoClinico: false, diasRestantesCarencia: null }),
}));
vi.mock('react-router-dom', async (importar) => ({
  ...(await importar<typeof import('react-router-dom')>()),
  useNavigate: () => h.navigate,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      h.consultas.push(tabela);
      let head = false;
      const b: Record<string, unknown> = {};
      b.select = (colunas: string, opcoes?: { head?: boolean }) => {
        head = !!opcoes?.head;
        if (tabela === 'checkins_semanais') h.colunasSerie = colunas;
        return b;
      };
      for (const m of ['eq', 'neq', 'gte', 'in', 'order', 'limit']) b[m] = () => b;
      const resolver = (): unknown => {
        if (tabela === 'pacientes') return { data: h.paciente, error: null };
        if (tabela === 'checkins_semanais') {
          if (h.serieErro) return { data: null, error: h.serieErro };
          return { data: [...h.serie].sort((x, y) => String(y.semana).localeCompare(String(x.semana))), error: null };
        }
        if (head) return { count: 0, data: null, error: null };
        if (tabela === 'myid_avaliacoes') return { data: h.myidRows, error: null };
        if (tabela === 'avaliacoes_voz') return { data: h.vozRows, error: null };
        if (tabela === 'agendamentos') return { data: h.agendamentos, error: null };
        if (tabela === 'profiles' || tabela === 'paciente_dicas') return { data: null, error: null };
        return { data: [], error: null };
      };
      b.maybeSingle = () => Promise.resolve(resolver());
      b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => {
        if (tabela === 'checkins_semanais' && h.serieTravada) return new Promise(() => {}).then(ok, ko);
        return Promise.resolve(resolver()).then(ok, ko);
      };
      return b;
    },
  },
}));

import PacienteDashboard from '@/pages/paciente/PacienteDashboard';

// Quarta-feira, 04/11/2026: a semana atual começa na segunda 02/11.
const AGORA = '2026-11-04T15:00:00Z';
const SEMANA = '2026-11-02';
const SEMANA_ANTERIOR = '2026-10-26';

const resposta = (semana: string, atualizadoEm?: string): Registro => ({
  semana, origem: 'portal', fadiga: 4, sono: 4, dor_muscular: 4, estresse: 4, humor: 4, urina: null, psr: null,
  ...(atualizadoEm ? { updated_at: atualizadoEm } : {}),
});

interface Cenario {
  myid?: boolean;
  historico?: boolean;
  historia?: boolean;
  myidAtualizadoEm?: string;
}

function montarCenario({ myid = false, historico = false, historia = false, myidAtualizadoEm = '2026-10-30T12:00:00Z' }: Cenario) {
  h.paciente = {
    id: 'pac-1', nome: 'Ana', sobrenome: 'Lima', terapeuta_id: 'prof-1', cadastro_status: 'completo', xp_total: 0,
    historico_clinico: historico ? { ultimo_envio: '2026-10-01T00:00:00Z' } : null,
  };
  h.myidRows = myid
    ? [{ id: 'm1', updated_at: myidAtualizadoEm, resultado_processado: {}, respostas_brutas: {}, terapeuta_id: 'prof-1' }]
    : [];
  h.vozRows = historia ? [{ resultado: { _meta: { origem: 'portal_paciente_historia' } } }] : [];
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(AGORA));
  h.serie = [];
  h.agendamentos = [];
  h.serieErro = null;
  h.serieTravada = false;
  h.colunasSerie = '';
  h.consultas = [];
  h.notificacoes = { diarioHoje: true, streak: 0, pendingQuestionarios: 0, pendingPagamentos: 0, proximaConsulta: false };
  h.navigate.mockReset();
  montarCenario({});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <PacienteDashboard />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const proximaAcao = async () => (await screen.findByText('Seu próximo passo')).closest('button') as HTMLButtonElement;

// A consulta do check-in é independente do resto do Início: damos um tempo para ela assentar.
const assentar = () => act(async () => { await new Promise((r) => setTimeout(r, 40)); });

describe('Início: MyID pendente (o MyID continua sendo o primeiro passo)', () => {
  it('a próxima ação continua sendo o MyID, nunca o check-in', async () => {
    renderizar();
    const botao = await proximaAcao();
    expect(botao).toHaveTextContent('Comece por aqui');
    expect(botao).toHaveTextContent('Fazer meu MyID');
    expect(botao).not.toHaveTextContent(/check-in/i);
    fireEvent.click(botao);
    expect(h.navigate).toHaveBeenCalledWith('/paciente/questionarios');
  });

  it('o check-in aparece só como cartão secundário pequeno, com o texto de que o MyID vem primeiro', async () => {
    renderizar();
    const cartao = (await screen.findByText('Check-in da semana (30 s)')).closest('button') as HTMLButtonElement;
    expect(cartao).toHaveTextContent('Você já pode fazer agora; o MyID continua sendo o seu primeiro passo');
    expect(await proximaAcao()).not.toHaveTextContent(/check-in/i);
    fireEvent.click(cartao);
    expect(h.navigate).toHaveBeenCalledWith('/paciente/checkin');
  });

  it('entra na lista de primeiros passos (depois do MyID) sem travar o onboarding', async () => {
    renderizar();
    const item = (await screen.findByText('Check-in da semana')).closest('button') as HTMLButtonElement;
    expect(item).toHaveTextContent('30 segundos: acompanhe sua evolução');
    const rotulos = Array.from(document.querySelectorAll('button p.text-sm.font-semibold')).map((p) => p.textContent);
    expect(rotulos.indexOf('Avaliação MyID')).toBeGreaterThanOrEqual(0);
    expect(rotulos.indexOf('Check-in da semana')).toBeGreaterThan(rotulos.indexOf('Avaliação MyID'));
    fireEvent.click(item);
    expect(h.navigate).toHaveBeenCalledWith('/paciente/checkin');
  });

  it('com o check-in já feito nesta semana, o cartão secundário some e o item do checklist fica concluído', async () => {
    h.serie = [resposta(SEMANA)];
    renderizar();
    const rotulo = await screen.findByText('Check-in da semana');
    expect(rotulo.className).toContain('line-through');
    expect(rotulo.closest('button')).toBeDisabled();
    expect(screen.queryByText('Check-in da semana (30 s)')).toBeNull();
    expect(await proximaAcao()).toHaveTextContent('Fazer meu MyID');
  });

  it('a resposta da semana passada não conta: o cartão continua lá', async () => {
    h.serie = [resposta(SEMANA_ANTERIOR)];
    renderizar();
    expect(await screen.findByText('Check-in da semana (30 s)')).toBeInTheDocument();
  });
});

describe('Início: MyID concluído', () => {
  beforeEach(() => montarCenario({ myid: true, historico: true, historia: true }));

  it('sem check-in nesta semana, a próxima ação passa a ser o check-in', async () => {
    renderizar();
    const botao = await proximaAcao();
    expect(botao).toHaveTextContent('Faça seu check-in da semana');
    expect(botao).toHaveTextContent('30 segundos: acompanhe sua evolução');
    expect(botao).toHaveTextContent('Fazer check-in');
    expect(screen.queryByText('Check-in da semana (30 s)')).toBeNull();
    fireEvent.click(botao);
    expect(h.navigate).toHaveBeenCalledWith('/paciente/checkin');
  });

  it('o check-in não trava o onboarding: com o núcleo feito, o Início abre na Jornada e sem a lista de primeiros passos', async () => {
    renderizar();
    await proximaAcao();
    expect(screen.queryByText('Seus primeiros passos')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Jornada' })).toHaveAttribute('data-state', 'active');
  });

  it('com o check-in feito nesta semana, não é a próxima ação: o cliente está em dia', async () => {
    h.serie = [resposta(SEMANA)];
    renderizar();
    expect(await screen.findByText('Você está em dia!')).toBeInTheDocument();
    expect(screen.queryByText('Seu próximo passo')).toBeNull();
    expect(screen.queryByText('Faça seu check-in da semana')).toBeNull();
  });

  it('só a resposta da semana passada: o check-in volta a ser a próxima ação', async () => {
    h.serie = [resposta(SEMANA_ANTERIOR)];
    renderizar();
    expect(await proximaAcao()).toHaveTextContent('Faça seu check-in da semana');
  });

  it('ações de prioridade maior continuam à frente: consulta nas próximas 24h', async () => {
    const emCincoHoras = new Date(Date.parse(AGORA) + 5 * 3600000).toISOString();
    h.agendamentos = [{ id: 'a1', data_inicio: emCincoHoras, data_fim: emCincoHoras, titulo: 'Retorno', status: 'confirmado', tipo_atendimento: null }];
    renderizar();
    expect(await proximaAcao()).toHaveTextContent('Sua consulta é em breve');
  });

  it('o diário de hoje pendente vem antes do check-in', async () => {
    h.notificacoes = { ...h.notificacoes, diarioHoje: false };
    renderizar();
    expect(await proximaAcao()).toHaveTextContent('Como você está hoje?');
  });

  it('a reavaliação mensal do MyID vem antes do check-in', async () => {
    montarCenario({ myid: true, historico: true, historia: true, myidAtualizadoEm: '2026-09-20T12:00:00Z' });
    renderizar();
    expect(await proximaAcao()).toHaveTextContent('Hora de atualizar seu MyID');
  });

  it('com histórico clínico pendente a próxima ação é o histórico, e o check-in fica só no checklist', async () => {
    montarCenario({ myid: true, historico: false, historia: true });
    renderizar();
    expect(await proximaAcao()).toHaveTextContent('Falta pouco!');
    expect(await screen.findByText('Check-in da semana')).toBeInTheDocument();
    expect(screen.queryByText('Check-in da semana (30 s)')).toBeNull();
  });

  it('enquanto a consulta do check-in não responde, não mostra "em dia" nem o check-in (sem piscar)', async () => {
    h.serieTravada = true;
    renderizar();
    await screen.findByText('Ana');
    await assentar();
    expect(screen.queryByText('Você está em dia!')).toBeNull();
    expect(screen.queryByText('Seu próximo passo')).toBeNull();
  });
});

// Segunda-feira, 09/11/2026 (12h em Brasília): o pedido do WhatsApp saiu no domingo à noite (semana de 02/11) e o servidor grava
// a resposta de segunda nessa semana, a anterior.
const SEGUNDA = '2026-11-09T15:00:00Z';
const SEGUNDA_MEIA_NOITE_BR = '2026-11-09T03:00:00Z';
const DOMINGO_ANTES_DA_MEIA_NOITE_BR = '2026-11-09T02:59:59Z';

describe('Início: pedido de domingo respondido na segunda (resposta gravada na semana anterior)', () => {
  beforeEach(() => vi.setSystemTime(new Date(SEGUNDA)));

  it('MyID pendente: o passo do check-in fica feito, o cartão secundário some e a próxima ação segue sendo o MyID', async () => {
    h.serie = [resposta(SEMANA, '2026-11-09T13:10:00+00:00')];
    renderizar();
    const rotulo = await screen.findByText('Check-in da semana');
    expect(rotulo.className).toContain('line-through');
    expect(rotulo.closest('button')).toBeDisabled();
    expect(screen.queryByText('Check-in da semana (30 s)')).toBeNull();
    expect(await proximaAcao()).toHaveTextContent('Fazer meu MyID');
  });

  it('MyID concluído: o cliente está em dia e o check-in não volta como próxima ação', async () => {
    montarCenario({ myid: true, historico: true, historia: true });
    h.serie = [resposta(SEMANA, '2026-11-09T13:10:00Z')];
    renderizar();
    expect(await screen.findByText('Você está em dia!')).toBeInTheDocument();
    expect(screen.queryByText('Faça seu check-in da semana')).toBeNull();
  });

  it('resposta da semana anterior feita antes de segunda 00h (Brasília) não conta: o check-in volta a ser pedido', async () => {
    montarCenario({ myid: true, historico: true, historia: true });
    h.serie = [resposta(SEMANA, DOMINGO_ANTES_DA_MEIA_NOITE_BR)];
    renderizar();
    expect(await proximaAcao()).toHaveTextContent('Faça seu check-in da semana');
  });

  it('feita exatamente à meia-noite de segunda (Brasília), conta', async () => {
    montarCenario({ myid: true, historico: true, historia: true });
    h.serie = [resposta(SEMANA, SEGUNDA_MEIA_NOITE_BR)];
    renderizar();
    expect(await screen.findByText('Você está em dia!')).toBeInTheDocument();
  });

  it('com o MyID pendente e a resposta de domingo, o cartão secundário continua lá', async () => {
    h.serie = [resposta(SEMANA, DOMINGO_ANTES_DA_MEIA_NOITE_BR)];
    renderizar();
    expect(await screen.findByText('Check-in da semana (30 s)')).toBeInTheDocument();
  });

  it('virada de semana: a resposta de quarta (semana de 02/11) deixa de contar na segunda 00h30 (Brasília)', async () => {
    vi.setSystemTime(new Date('2026-11-09T03:30:00Z'));
    montarCenario({ myid: true, historico: true, historia: true });
    h.serie = [resposta(SEMANA, '2026-11-04T15:00:00Z')];
    renderizar();
    expect(await proximaAcao()).toHaveTextContent('Faça seu check-in da semana');
  });

  it('pede o horário de gravação junto com a série (coluna updated_at)', async () => {
    renderizar();
    await waitFor(() => expect(h.colunasSerie).not.toBe(''));
    expect(h.colunasSerie.split(',').map((c) => c.trim())).toContain('updated_at');
  });
});

describe('Início: check-in indisponível (migração ainda não aplicada)', () => {
  const erros: [string, ErroBanco][] = [
    ['42P01', { code: '42P01', message: 'relation "public.checkins_semanais" does not exist' }],
    ['42P01 com mensagem em português', { code: '42P01', message: 'a relação "public.checkins_semanais" não existe' }],
    ['PGRST205', { code: 'PGRST205', message: 'Could not find the table' }],
    ['PGRST202', { code: 'PGRST202', message: 'Could not find the function' }],
    ['"schema cache"', { message: 'not found in the schema cache' }],
  ];

  it.each(erros)('MyID concluído e %s: nada de check-in, e o cliente aparece "em dia"', async (_nome, erro) => {
    montarCenario({ myid: true, historico: true, historia: true });
    h.serieErro = erro;
    const { container } = renderizar();
    expect(await screen.findByText('Você está em dia!')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/check-in/i);
  });

  it.each(erros)('MyID pendente e %s: sem cartão secundário nem item no checklist; a próxima ação segue sendo o MyID', async (_nome, erro) => {
    h.serieErro = erro;
    const { container } = renderizar();
    expect(await proximaAcao()).toHaveTextContent('Fazer meu MyID');
    await waitFor(() => expect(h.consultas).toContain('checkins_semanais'));
    await assentar();
    expect(screen.getByText('Seus primeiros passos')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/check-in/i);
  });

  it('um erro qualquer na consulta (rede) também esconde o check-in, sem derrubar o Início', async () => {
    montarCenario({ myid: true, historico: true, historia: true });
    h.serieErro = { code: '500', message: 'boom' };
    const { container } = renderizar();
    expect(await screen.findByText('Você está em dia!')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/check-in/i);
  });
});

describe('Menu do portal: atalho do check-in', () => {
  const montarLayout = async () => {
    const { default: PacienteLayoutReal } = await vi.importActual<typeof import('@/components/paciente/PacienteLayout')>('@/components/paciente/PacienteLayout');
    return render(
      <MemoryRouter initialEntries={['/paciente/dashboard']}>
        <PacienteLayoutReal><div>conteúdo</div></PacienteLayoutReal>
      </MemoryRouter>,
    );
  };

  it('aparece no menu lateral e leva para /paciente/checkin', async () => {
    await montarLayout();
    const atalho = screen.getByRole('button', { name: 'Check-in da semana' });
    fireEvent.click(atalho);
    expect(h.navigate).toHaveBeenCalledWith('/paciente/checkin');
  });

  it('no celular fica em "Mais", no grupo "Minha saúde" (a barra de baixo não ganha item)', async () => {
    await montarLayout();
    const barra = document.querySelector('nav.fixed') as HTMLElement;
    expect(barra.textContent).not.toMatch(/Check-in/);

    fireEvent.click(screen.getByRole('button', { name: 'Mais' }));
    const grupo = screen.getByText('Minha saúde').parentElement as HTMLElement;
    expect(grupo.textContent).toContain('Check-in da semana');
    const outro = screen.getByText('Conta e mais').parentElement as HTMLElement;
    expect(outro.textContent).not.toContain('Check-in da semana');
  });
});

describe('Rota do check-in', () => {
  it('/paciente/checkin existe no App, protegida como as demais rotas do portal', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toMatch(/path="\/paciente\/checkin" element=\{<ProtectedPatientRoute><PacienteCheckin \/><\/ProtectedPatientRoute>\}/);
    expect(app).toMatch(/PacienteCheckin = lazyWithRetry\(\(\) => import\("\.\/pages\/paciente\/PacienteCheckin"\)\)/);
  });
});
