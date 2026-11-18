import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';
import { simularAnimacaoDeSaida } from './helpers/animacaoDeSaida';
import { envolverBanco, type BancoEnvolvido } from './helpers/bancoFalsoLeitura';
import { DEFAULT_LAYOUT_CONFIG } from '@/hooks/useLayoutConfig';
import { idDaConfirmacao, montarLinhaDaConfirmacao } from '@/lib/resumoClinico/confirmacao';

// A rota /pacientes/:id reaproveita a mesma página quando só o :id muda (botão Voltar do navegador, Voltar do Android, link de
// notificação). Com um diálogo de confirmar ou de desfazer aberto, o item de um cliente não pode sobreviver na tela do outro nem
// ser gravado no prontuário errado. Perfil de verdade; só os cartões pesados e o Avatar são simulados; banco falso em memória.

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = vi.fn();

const h = vi.hoisted(() => ({
  falso: null as unknown as BancoFalso,
  banco: null as unknown as BancoEnvolvido,
  clinica: { papel: undefined as string | undefined, loading: false },
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
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
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'prof-1' }, loading: false, profile: { nome: 'Ana', sobrenome: 'Souza', crefito: '12345-F' } }),
}));
vi.mock('@/hooks/useClinicaContext', () => ({ useClinicaContext: () => h.clinica }));
vi.mock('sonner', () => ({ toast: h.toast, Toaster: () => null }));
vi.mock('@/contexts/LayoutConfigContext', () => ({
  useLayoutConfig: () => ({ config: { ...DEFAULT_LAYOUT_CONFIG, sub_tabs: DEFAULT_LAYOUT_CONFIG.sub_tabs }, loading: false, save: async () => {}, reset: async () => {} }),
}));
vi.mock('@/components/AppLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/avatar/AvatarClinicoCard', () => ({ default: () => <div>AVATAR_CLINICO_SIMULADO</div> }));
vi.mock('@/components/avatar/CondicoesSistemicasCard', () => ({ default: () => <div>CONDICOES_SISTEMICAS_SIMULADO</div> }));
vi.mock('@/components/voice/VoiceAssessment', () => ({ default: () => <div>VoiceAssessment simulado</div> }));

import PacientePerfil from '@/pages/PacientePerfil';
import { useNavigate } from 'react-router-dom';

let navegar: (para: string) => void = () => {};
function CapturaNavegacao() {
  const irPara = useNavigate();
  navegar = (para) => irPara(para);
  return null;
}

const TEMPO = { timeout: 15000 };
const CHAVE = 'historico_clinico:cirurgia:id:c1';
const ID_DA_LINHA = idDaConfirmacao('prof-1', 'pac-1', CHAVE);
const TITULO_DO_CLIENTE = 'Cirurgia ou internação: Joelho';
const AVISO = 'A triagem de segurança dos planos continua usando o ano que o cliente escreveu. Esta confirmação não a altera.';

const avaliacao = (savedAt = 's1'): Linha => ({
  id: 'av-nova', paciente_id: 'pac-1', terapeuta_id: 'prof-1', created_at: '2026-10-06T15:00:00+00:00', queixa_principal: 'Dor lombar', servico: 'identidade',
  classificacao_severidade: 'Moderada', transcricao: '',
  resultado: { resumo_clinico: 'Paciente com dor lombar crônica.', classificacao_severidade: 'Moderada', queixa_principal: 'Dor lombar crônica', dor: { localizacao: 'Lombar', intensidade_eva: 7 }, _meta: { mode: 'voice', savedAt }, _secoes: { confirmadas: ['resumo_clinico', 'dor'], editadas: {} } },
});

const confirmacaoGravada = (): Linha => {
  const r = montarLinhaDaConfirmacao({
    terapeutaId: 'prof-1', pacienteId: 'pac-1', chave: CHAVE, relato: { tipo: 'Joelho', ano: '2022', complicacoes: 'dor ao agachar' }, tipo: 'cirurgia',
    precisao: 'dia', texto: '2022-06-10', profissional: { nome: 'Ana', sobrenome: 'Souza', crefito: '12345-F' },
  }, '2026-11-15');
  if (r.erro) throw new Error(r.erro);
  return { ...r.linha, created_at: '2026-10-01T15:00:00+00:00' };
};

function preparar(opcoes: { historiaDeVida?: Linha[]; avaliacoes?: Linha[]; nascimento?: string | null } = {}) {
  const { historiaDeVida = [], avaliacoes = [avaliacao(), { ...avaliacao(), id: 'av-pac-2', paciente_id: 'pac-2' }], nascimento = null } = opcoes;
  h.falso = criarBancoFalso({
    pacientes: [{
      id: 'pac-1', nome: 'Ana', sobrenome: 'Souza', terapeuta_id: 'prof-1', user_id: null, paciente_servicos: [], created_at: '2026-01-10T12:00:00+00:00', ativo: true,
      data_nascimento: nascimento, historia_atual: null,
      historico_clinico: { cirurgias: { items: [{ id: 'c1', tipo: 'Joelho', ano: '2022', complicacoes: 'dor ao agachar' }, { id: 'c2', tipo: 'Apêndice', ano: 'há 2 anos' }] } },
    }, {
      id: 'pac-2', nome: 'Bruno', sobrenome: 'Lima', terapeuta_id: 'prof-1', user_id: null, paciente_servicos: [], created_at: '2026-01-10T12:00:00+00:00', ativo: true,
      data_nascimento: null, historia_atual: null,
      historico_clinico: { cirurgias: { items: [{ id: 'd1', tipo: 'Ombro do Bruno', ano: '2019' }] } },
    }],
    profiles: [{ user_id: 'prof-1', perfil_profissional: 'fisioterapeuta' }],
    perfis_profissionais: [{ id: 'fisioterapeuta', nome_exibicao: 'Fisioterapeuta', descricao: null, blocos_ativos: ['voz', 'avatar'], prompt_sistema: 'LENTE_FISIO', template_evolucao: 'SOAP' }],
    avaliacoes_voz: avaliacoes,
    historia_vida_paciente: historiaDeVida,
  }, { padroesNoInsert: { historia_vida_paciente: () => ({ created_at: new Date().toISOString() }) } });
  h.banco = envolverBanco(h.falso);
}

let qc: QueryClient;
function montar(rota = '/pacientes/pac-1?tab=presencial') {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[rota]}>
        <CapturaNavegacao />
        <Routes><Route path="/pacientes/:id" element={<PacientePerfil />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}


// Com um diálogo aberto o resto da página fica escondido do leitor de tela (aria-hidden), então a seção é achada pelo DOM e os botões com
// hidden: true. Assim, se um diálogo errado ficar aberto, o teste chega até a asserção do diálogo em vez de esgotar o tempo.
const regiao = () => document.querySelector('section[aria-labelledby="titulo-linha-do-tempo-clinica"]') as HTMLElement;
const botaoDoJoelho = () => within(regiao()).getByRole('button', { name: `Confirmar com a data real: ${TITULO_DO_CLIENTE}`, hidden: true });
const botaoDesfazerDoJoelho = () => within(regiao()).getByRole('button', { name: 'Desfazer a confirmação de Joelho', hidden: true });
const botaoDoOmbro = () => within(regiao()).getByRole('button', { name: 'Confirmar com a data real: Cirurgia ou internação: Ombro do Bruno', hidden: true });
const escritasNaTabela = () => h.falso.escritas().filter((o) => o.tabela === 'historia_vida_paciente');

async function esperarOPaciente1() {
  await screen.findByRole('region', { name: 'Linha do tempo clínica' }, TEMPO);
  await waitFor(() => expect(botaoDoJoelho()).toBeInTheDocument(), TEMPO);
}

async function irParaOPaciente2() {
  act(() => { navegar('/pacientes/pac-2?tab=presencial'); });
  // Só depois de o perfil do pac-2 carregar (a página não desmontou: é a mesma, com outro :id) a tela mostra o relato dele.
  await waitFor(() => expect(botaoDoOmbro()).toBeInTheDocument(), TEMPO);
}

async function abrirOConfirmarDoJoelhoComDadosDigitados() {
  fireEvent.click(botaoDoJoelho());
  const caixa = await screen.findByRole('dialog', { name: 'Confirmar com a data real' });
  fireEvent.click(within(caixa).getByRole('button', { name: 'Cirurgia' }));
  fireEvent.click(within(caixa).getByRole('button', { name: 'Só sei o ano' }));
  fireEvent.change(within(caixa).getByLabelText('Ano em que aconteceu'), { target: { value: '2022' } });
}

beforeEach(() => {
  h.clinica = { papel: undefined, loading: false };
  h.toast.success.mockClear();
  h.toast.error.mockClear();
  h.toast.info.mockClear();
  preparar();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('Perfil: trocar de paciente com o diálogo de CONFIRMAR aberto', () => {
  it('o diálogo do pac-1 não aparece no pac-2 e nada é gravado em lugar nenhum', async () => {
    montar();
    await esperarOPaciente1();
    await abrirOConfirmarDoJoelhoComDadosDigitados();

    await irParaOPaciente2();

    expect(screen.queryByRole('dialog', { name: 'Confirmar com a data real' })).toBeNull();
    expect(screen.queryByText('Joelho')).toBeNull();
    expect(escritasNaTabela()).toEqual([]);
    expect(h.toast.error).not.toHaveBeenCalled();
  }, 60000);

  it('no pac-2, abrir o item dele mostra o relato do pac-2 com o formulário vazio e grava SÓ no pac-2', async () => {
    montar();
    await esperarOPaciente1();
    await abrirOConfirmarDoJoelhoComDadosDigitados();
    await irParaOPaciente2();

    fireEvent.click(botaoDoOmbro());
    const caixa = await screen.findByRole('dialog', { name: 'Confirmar com a data real' });
    expect(within(caixa).getByText('Ombro do Bruno')).toBeInTheDocument();
    expect(within(caixa).queryByText('Joelho')).toBeNull();
    expect(within(caixa).getByRole('button', { name: 'Cirurgia' })).toHaveAttribute('aria-pressed', 'false');
    expect((within(caixa).getByLabelText('Dia em que aconteceu') as HTMLInputElement).value).toBe('');

    fireEvent.click(within(caixa).getByRole('button', { name: 'Cirurgia' }));
    fireEvent.click(within(caixa).getByRole('button', { name: 'Só sei o ano' }));
    fireEvent.change(within(caixa).getByLabelText('Ano em que aconteceu'), { target: { value: '2019' } });
    fireEvent.click(within(caixa).getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(escritasNaTabela()).toHaveLength(1), TEMPO);
    expect(escritasNaTabela()[0].payload).toMatchObject({ paciente_id: 'pac-2', titulo: 'Ombro do Bruno', tipo: 'cirurgia' });
  }, 60000);

  it('voltar para o pac-1 depois de passar pelo pac-2 não traz o diálogo de volta', async () => {
    montar();
    await esperarOPaciente1();
    await abrirOConfirmarDoJoelhoComDadosDigitados();
    await irParaOPaciente2();

    act(() => { navegar('/pacientes/pac-1?tab=presencial'); });
    await waitFor(() => expect(botaoDoJoelho()).toBeInTheDocument(), TEMPO);

    expect(screen.queryByRole('dialog', { name: 'Confirmar com a data real' })).toBeNull();
    expect(escritasNaTabela()).toEqual([]);
  }, 60000);
});

describe('Perfil: a saída do diálogo na troca de paciente', () => {
  it('o diálogo do pac-1 some na hora: não fica desenhando o relato dele na tela do pac-2 durante a animação de saída', async () => {
    simularAnimacaoDeSaida();
    montar();
    await esperarOPaciente1();
    fireEvent.click(botaoDoJoelho());
    await screen.findByRole('dialog', { name: 'Confirmar com a data real' });

    await irParaOPaciente2();

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.textContent).not.toContain('Ano que o cliente escreveu: "2022"');
  }, 60000);

  it('o aviso de desfazer do pac-1 também some na hora, sem o título do marco dele', async () => {
    simularAnimacaoDeSaida();
    preparar({ historiaDeVida: [confirmacaoGravada()] });
    montar();
    await waitFor(() => expect(botaoDesfazerDoJoelho()).toBeInTheDocument(), TEMPO);
    fireEvent.click(botaoDesfazerDoJoelho());
    await screen.findByRole('alertdialog', { name: 'Desfazer a confirmação?' });

    await irParaOPaciente2();

    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  }, 60000);
});

describe('Perfil: trocar de paciente com o aviso de DESFAZER aberto', () => {
  it('o aviso do pac-1 não aparece no pac-2 e nada é apagado', async () => {
    preparar({ historiaDeVida: [confirmacaoGravada()] });
    montar();
    await waitFor(() => expect(botaoDesfazerDoJoelho()).toBeInTheDocument(), TEMPO);
    fireEvent.click(botaoDesfazerDoJoelho());
    await screen.findByRole('alertdialog', { name: 'Desfazer a confirmação?' });

    await irParaOPaciente2();

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(h.falso.escritas()).toEqual([]);
    expect(h.falso.tabelas.historia_vida_paciente).toHaveLength(1);
  }, 60000);

  it('voltar para o pac-1 não traz o aviso de volta, e a confirmação continua lá', async () => {
    preparar({ historiaDeVida: [confirmacaoGravada()] });
    montar();
    await waitFor(() => expect(botaoDesfazerDoJoelho()).toBeInTheDocument(), TEMPO);
    fireEvent.click(botaoDesfazerDoJoelho());
    await screen.findByRole('alertdialog', { name: 'Desfazer a confirmação?' });
    await irParaOPaciente2();

    act(() => { navegar('/pacientes/pac-1?tab=presencial'); });
    await waitFor(() => expect(botaoDesfazerDoJoelho()).toBeInTheDocument(), TEMPO);

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(h.falso.escritas()).toEqual([]);
  }, 60000);
});
