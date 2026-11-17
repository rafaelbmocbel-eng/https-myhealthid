import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';
import { envolverBanco, type BancoEnvolvido } from './helpers/bancoFalsoLeitura';
import { DEFAULT_LAYOUT_CONFIG } from '@/hooks/useLayoutConfig';
import { TEMPO_DO_DESTAQUE_MS } from '@/hooks/useAbrirRegistroClinico';

// Perfil do paciente de verdade (aba Avaliação > linha do tempo clínica > botão "Abrir" de um marco): rola até o registro de
// origem e o destaca por alguns segundos. Só os cartões pesados e o Avatar são simulados; a página, a lente do profissional, o
// cartão de CID, a última avaliação e a linha do tempo são os reais.

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
const rolar = vi.fn();
Element.prototype.scrollIntoView = rolar;

const h = vi.hoisted(() => ({
  falso: null as unknown as BancoFalso,
  banco: null as unknown as BancoEnvolvido,
  subTabs: [] as Array<{ id: string; defaultLabel: string; label: string; visivel: boolean; ordem: number }>,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => h.banco.from(t),
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

const TEMPO = { timeout: 15000 };
const BLOCOS_COM_CID = ['voz', 'avatar', 'cid'];
const BLOCOS_SEM_CID = ['voz', 'avatar'];

const avaliacao = (extra: Linha = {}): Linha => ({
  id: 'av-nova', paciente_id: 'pac-1', terapeuta_id: 'prof-1', created_at: '2026-10-06T15:00:00+00:00', queixa_principal: 'Dor lombar', servico: 'identidade',
  classificacao_severidade: 'Moderada', transcricao: '',
  resultado: { resumo_clinico: 'Paciente com dor lombar crônica.', classificacao_severidade: 'Moderada', queixa_principal: 'Dor lombar crônica', dor: { localizacao: 'Lombar', intensidade_eva: 7 }, _meta: { mode: 'voice', savedAt: 's1' }, _secoes: { confirmadas: ['resumo_clinico', 'dor'], editadas: {} } },
  ...extra,
});
const antiga = (): Linha => avaliacao({ id: 'av-antiga', created_at: '2026-08-02T15:00:00+00:00', queixa_principal: 'Dor no ombro' });
const diagnostico = (extra: Linha = {}): Linha => ({
  id: 'dx-1', paciente_id: 'pac-1', terapeuta_id: 'prof-1', data_diagnostico: '2024-05-06', cid_codigo: 'M54.5', cid_descricao: 'Dor lombar baixa',
  created_at: '2026-01-02T12:00:00+00:00', ativo: true, tipo: 'principal', observacao: null, ...extra,
});

function preparar(opcoes: { blocos?: string[]; avaliacoes?: Linha[]; diagnosticos?: Linha[] } = {}) {
  const { blocos = BLOCOS_COM_CID, avaliacoes = [antiga(), avaliacao()], diagnosticos = [diagnostico(), diagnostico({ id: 'dx-2', cid_codigo: 'M51.1', cid_descricao: 'Hérnia de disco', tipo: 'secundario', data_diagnostico: '2023-01-02', created_at: '2026-01-03T12:00:00+00:00' })] } = opcoes;
  h.falso = criarBancoFalso({
    pacientes: [{ id: 'pac-1', nome: 'Ana', sobrenome: 'Souza', terapeuta_id: 'prof-1', user_id: null, paciente_servicos: [], created_at: '2026-01-10T12:00:00+00:00', ativo: true, historico_clinico: null, historia_atual: null }],
    profiles: [{ user_id: 'prof-1', perfil_profissional: 'fisioterapeuta' }],
    perfis_profissionais: [{ id: 'fisioterapeuta', nome_exibicao: 'Fisioterapeuta', descricao: null, blocos_ativos: blocos, prompt_sistema: 'LENTE_FISIO', template_evolucao: 'SOAP' }],
    avaliacoes_voz: avaliacoes,
    diagnosticos_paciente: diagnosticos,
  });
  h.banco = envolverBanco(h.falso);
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
const linhaDoDiagnostico = (id: string) => document.querySelector(`[data-diagnostico-id="${id}"]`) as HTMLElement | null;
const cartaoDaAvaliacao = (id: string) => document.querySelector(`[data-avaliacao-id="${id}"]`) as HTMLElement | null;
const destacados = () => Array.from(document.querySelectorAll('[data-destacado]')) as HTMLElement[];
// O elemento em que o último scrollIntoView foi chamado.
const alvoDaRolagem = () => rolar.mock.contexts.at(-1) as HTMLElement | undefined;

// Espera a aba pronta: o cartão de CID com as duas linhas e a linha do tempo com os botões.
async function esperarATela() {
  await screen.findByText('Diagnósticos (CID-10)', undefined, TEMPO);
  await waitFor(() => expect(linhaDoDiagnostico('dx-1')).not.toBeNull(), TEMPO);
  await screen.findByRole('region', { name: 'Linha do tempo clínica' }, TEMPO);
}
const regiao = () => screen.getByRole('region', { name: 'Linha do tempo clínica' });

beforeEach(() => {
  rolar.mockClear();
  h.subTabs = DEFAULT_LAYOUT_CONFIG.sub_tabs;
  preparar();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Perfil do paciente: "Abrir" o diagnóstico leva ao cartão de CID e destaca a linha certa', () => {
  it('clicar no marco do diagnóstico rola até a linha daquele diagnóstico e a destaca; as outras linhas não', async () => {
    montar();
    await esperarATela();
    const botao = await within(regiao()).findByRole('button', { name: 'Abrir o diagnóstico M54.5' }, TEMPO);
    rolar.mockClear();

    fireEvent.click(botao);

    expect(rolar).toHaveBeenCalledTimes(1);
    expect(alvoDaRolagem()).toBe(linhaDoDiagnostico('dx-1'));
    expect(rolar).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(linhaDoDiagnostico('dx-1')).toHaveAttribute('data-destacado', 'true');
    expect(linhaDoDiagnostico('dx-2')).not.toHaveAttribute('data-destacado');
    expect(destacados()).toHaveLength(1);
    expect(linhaDoDiagnostico('dx-1')?.textContent).toContain('M54.5');
    expect(linhaDoDiagnostico('dx-1')?.textContent).toContain('Dor lombar baixa');
  }, 40000);

  it('o segundo diagnóstico leva à própria linha (não à primeira) e o destaque muda de lugar', async () => {
    montar();
    await esperarATela();
    const regi = regiao();
    fireEvent.click(await within(regi).findByRole('button', { name: 'Abrir o diagnóstico M54.5' }, TEMPO));
    expect(linhaDoDiagnostico('dx-1')).toHaveAttribute('data-destacado', 'true');

    fireEvent.click(within(regi).getByRole('button', { name: 'Abrir o diagnóstico M51.1' }));
    expect(alvoDaRolagem()).toBe(linhaDoDiagnostico('dx-2'));
    expect(linhaDoDiagnostico('dx-2')).toHaveAttribute('data-destacado', 'true');
    expect(linhaDoDiagnostico('dx-1')).not.toHaveAttribute('data-destacado');
    expect(destacados()).toHaveLength(1);
  }, 40000);

  it('o destaque some depois de alguns segundos e a linha volta ao normal', async () => {
    montar();
    await esperarATela();
    const botao = await within(regiao()).findByRole('button', { name: 'Abrir o diagnóstico M54.5' }, TEMPO);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    fireEvent.click(botao);
    expect(linhaDoDiagnostico('dx-1')).toHaveAttribute('data-destacado', 'true');
    expect(TEMPO_DO_DESTAQUE_MS).toBeGreaterThanOrEqual(2000);
    expect(TEMPO_DO_DESTAQUE_MS).toBeLessThanOrEqual(6000);

    act(() => { vi.advanceTimersByTime(TEMPO_DO_DESTAQUE_MS - 200); });
    expect(linhaDoDiagnostico('dx-1')).toHaveAttribute('data-destacado', 'true');
    act(() => { vi.advanceTimersByTime(300); });
    expect(linhaDoDiagnostico('dx-1')).not.toHaveAttribute('data-destacado');
    expect(destacados()).toHaveLength(0);
  }, 40000);

  it('tocar de novo no mesmo marco reinicia a contagem do destaque (o primeiro temporizador não o apaga antes da hora)', async () => {
    montar();
    await esperarATela();
    const botao = await within(regiao()).findByRole('button', { name: 'Abrir o diagnóstico M54.5' }, TEMPO);
    vi.useFakeTimers({ shouldAdvanceTime: true });

    fireEvent.click(botao);
    act(() => { vi.advanceTimersByTime(TEMPO_DO_DESTAQUE_MS - 500); });
    fireEvent.click(botao);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(linhaDoDiagnostico('dx-1')).toHaveAttribute('data-destacado', 'true');
    act(() => { vi.advanceTimersByTime(TEMPO_DO_DESTAQUE_MS); });
    expect(linhaDoDiagnostico('dx-1')).not.toHaveAttribute('data-destacado');
  }, 40000);

  it('o destaque é leve e não anima: a linha pinta pelo atributo, com transição só para quem aceita movimento', async () => {
    montar();
    await esperarATela();
    const linha = linhaDoDiagnostico('dx-1') as HTMLElement;
    expect(linha.className).toContain('data-[destacado=true]:ring-2');
    expect(linha.className).toContain('data-[destacado=true]:bg-primary/10');
    expect(linha.className).toContain('motion-safe:transition-colors');
    expect(linha.className).not.toMatch(/animate-|\btransition-all\b|\btransition\b(?!-)/);
    expect(linha.className).toContain('scroll-mt-24');
  }, 40000);

  it('sem prefers-reduced-motion a rolagem é suave; com ele, direta (sem animação)', async () => {
    montar();
    await esperarATela();
    const botao = await within(regiao()).findByRole('button', { name: 'Abrir o diagnóstico M54.5' }, TEMPO);
    rolar.mockClear();
    fireEvent.click(botao);
    expect(rolar).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'center' });

    const original = window.matchMedia;
    window.matchMedia = ((consulta: string) => ({
      matches: consulta.includes('prefers-reduced-motion'), media: consulta, onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    try {
      rolar.mockClear();
      fireEvent.click(botao);
      expect(rolar).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'center' });
      expect(linhaDoDiagnostico('dx-1')).toHaveAttribute('data-destacado', 'true');
    } finally {
      window.matchMedia = original;
    }
  }, 40000);

  it('abrir o registro só rola e destaca: não troca de aba nem de rota, não abre janela e não grava nada', async () => {
    const abrirJanela = vi.spyOn(window, 'open').mockImplementation(() => null);
    montar();
    await esperarATela();
    const antes = screen.getByTestId('local').textContent;
    const botao = await within(regiao()).findByRole('button', { name: 'Abrir o diagnóstico M54.5' }, TEMPO);

    fireEvent.click(botao);

    expect(screen.getByTestId('local').textContent).toBe(antes);
    expect(aba('Avaliação')).toHaveAttribute('aria-selected', 'true');
    expect(abrirJanela).not.toHaveBeenCalled();
    expect(h.falso.escritas()).toEqual([]);
    // O que as telas mostram não mudou: a linha do tempo e o cartão seguem iguais.
    expect(within(regiao()).getByText('[M54.5] Dor lombar baixa')).toBeInTheDocument();
    expect(linhaDoDiagnostico('dx-1')?.textContent).toContain('Data do diagnóstico: 06/05/2024');
  }, 40000);

  it('sair da aba com o destaque aceso não deixa nada aceso ao voltar', async () => {
    montar();
    await esperarATela();
    fireEvent.click(await within(regiao()).findByRole('button', { name: 'Abrir o diagnóstico M54.5' }, TEMPO));
    expect(destacados()).toHaveLength(1);

    trocarPara('Diretrizes');
    await waitFor(() => expect(screen.queryByText('Diagnósticos (CID-10)')).toBeNull(), TEMPO);
    trocarPara('Avaliação');
    await screen.findByText('Diagnósticos (CID-10)', undefined, TEMPO);
    await waitFor(() => expect(linhaDoDiagnostico('dx-1')).not.toBeNull(), TEMPO);
    expect(linhaDoDiagnostico('dx-1')).not.toHaveAttribute('data-destacado');
  }, 40000);
});

describe('Perfil do paciente: a lente do profissional manda no botão do diagnóstico', () => {
  it('lente SEM o bloco "cid": o cartão de CID não existe e o marco do diagnóstico não ganha botão (o marco continua na linha do tempo)', async () => {
    preparar({ blocos: BLOCOS_SEM_CID });
    montar();
    await screen.findByRole('region', { name: 'Linha do tempo clínica' }, TEMPO);
    await within(regiao()).findByText('[M54.5] Dor lombar baixa', undefined, TEMPO);
    await within(regiao()).findByRole('button', { name: 'Abrir a avaliação de 06/10/2026' }, TEMPO);
    expect(screen.queryByText('Diagnósticos (CID-10)')).toBeNull();
    expect(linhaDoDiagnostico('dx-1')).toBeNull();
    expect(within(regiao()).queryByRole('button', { name: /diagnóstico/ })).toBeNull();
    expect(within(regiao()).queryByRole('button', { name: 'Abrir o diagnóstico M54.5' })).toBeNull();
  }, 40000);

  it('lente COM o bloco "cid": o cartão existe e o marco do diagnóstico ganha o botão', async () => {
    montar();
    await esperarATela();
    expect(await within(regiao()).findByRole('button', { name: 'Abrir o diagnóstico M54.5' }, TEMPO)).toBeInTheDocument();
    expect(within(regiao()).getByRole('button', { name: 'Abrir o diagnóstico M51.1' })).toBeInTheDocument();
  }, 40000);

  it('a lente não esconde o botão da avaliação (ela não depende do bloco "cid")', async () => {
    preparar({ blocos: BLOCOS_SEM_CID });
    montar();
    expect(await within(await screen.findByRole('region', { name: 'Linha do tempo clínica' }, TEMPO)).findByRole('button', { name: 'Abrir a avaliação de 06/10/2026' }, TEMPO)).toBeInTheDocument();
  }, 40000);
});

describe('Perfil do paciente: "Abrir" a avaliação leva ao cartão da última avaliação', () => {
  it('clicar no marco da ÚLTIMA avaliação rola até o cartão dela e o destaca', async () => {
    montar();
    await esperarATela();
    const botao = await within(regiao()).findByRole('button', { name: 'Abrir a avaliação de 06/10/2026' }, TEMPO);
    await waitFor(() => expect(cartaoDaAvaliacao('av-nova')).not.toBeNull());
    rolar.mockClear();

    fireEvent.click(botao);

    expect(rolar).toHaveBeenCalledTimes(1);
    expect(alvoDaRolagem()).toBe(cartaoDaAvaliacao('av-nova'));
    expect(rolar).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(cartaoDaAvaliacao('av-nova')).toHaveAttribute('data-destacado', 'true');
    expect(cartaoDaAvaliacao('av-nova')?.textContent).toContain('Última avaliação');
    expect(destacados()).toHaveLength(1);
    expect(aba('Avaliação')).toHaveAttribute('aria-selected', 'true');
  }, 40000);

  it('o destaque do cartão da avaliação também é leve: pinta pelo atributo, só com contorno, sem animação nem mudança de tamanho', async () => {
    montar();
    await esperarATela();
    await waitFor(() => expect(cartaoDaAvaliacao('av-nova')).not.toBeNull());
    const cartao = cartaoDaAvaliacao('av-nova') as HTMLElement;
    expect(cartao.className).toContain('data-[destacado=true]:outline-primary');
    expect(cartao.className).toContain('data-[destacado=true]:outline-2');
    expect(cartao.className).toContain('motion-safe:transition-shadow');
    expect(cartao.className).toContain('scroll-mt-20');
    expect(cartao.className).not.toMatch(/animate-|\btransition-all\b|data-\[destacado=true\]:(p|m|w|h)[xytblr]?-/);
  }, 40000);

  it('o destaque da avaliação some depois de alguns segundos', async () => {
    montar();
    await esperarATela();
    const botao = await within(regiao()).findByRole('button', { name: 'Abrir a avaliação de 06/10/2026' }, TEMPO);
    await waitFor(() => expect(cartaoDaAvaliacao('av-nova')).not.toBeNull());
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fireEvent.click(botao);
    expect(cartaoDaAvaliacao('av-nova')).toHaveAttribute('data-destacado', 'true');
    act(() => { vi.advanceTimersByTime(TEMPO_DO_DESTAQUE_MS + 50); });
    expect(cartaoDaAvaliacao('av-nova')).not.toHaveAttribute('data-destacado');
    expect(destacados()).toHaveLength(0);
  }, 40000);

  it('avaliação MAIS ANTIGA: não há onde abri-la nesta aba, então o marco continua na linha do tempo, mas sem botão', async () => {
    montar();
    await esperarATela();
    const regi = regiao();
    await within(regi).findByRole('button', { name: 'Abrir a avaliação de 06/10/2026' }, TEMPO);
    expect(within(regi).getAllByText('Avaliação presencial registrada')).toHaveLength(2);
    expect(within(regi).queryByRole('button', { name: 'Abrir a avaliação de 02/08/2026' })).toBeNull();
    // O histórico que abre uma avaliação antiga mora na aba Evolução e não está montado aqui.
    expect(screen.queryByText(/Avaliações salvas/)).toBeNull();
    expect(screen.queryByText(/Editar avaliação/)).toBeNull();
    expect(cartaoDaAvaliacao('av-antiga')).toBeNull();
    expect(Array.from(document.querySelectorAll('[data-avaliacao-id]')).map((e) => e.getAttribute('data-avaliacao-id'))).toEqual(['av-nova']);
  }, 40000);

  it('quando só há uma avaliação, é a última: o marco dela ganha o botão', async () => {
    preparar({ avaliacoes: [avaliacao()] });
    montar();
    expect(await within(await screen.findByRole('region', { name: 'Linha do tempo clínica' }, TEMPO)).findByRole('button', { name: 'Abrir a avaliação de 06/10/2026' }, TEMPO)).toBeInTheDocument();
  }, 40000);
});

describe('Perfil do paciente: abrir registros não grava nada', () => {
  it('a página não chama nenhum método de escrita ao carregar nem ao abrir um diagnóstico e uma avaliação', async () => {
    montar();
    await esperarATela();
    fireEvent.click(await within(regiao()).findByRole('button', { name: 'Abrir o diagnóstico M54.5' }, TEMPO));
    fireEvent.click(within(regiao()).getByRole('button', { name: 'Abrir a avaliação de 06/10/2026' }));
    expect(h.falso.escritas()).toEqual([]);
  }, 40000);
});
