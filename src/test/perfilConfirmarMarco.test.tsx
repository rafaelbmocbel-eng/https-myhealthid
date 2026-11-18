import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';
import { simularAnimacaoDeSaida, terminarAAnimacaoDeSaida } from './helpers/animacaoDeSaida';
import { envolverBanco, type BancoEnvolvido } from './helpers/bancoFalsoLeitura';
import { DEFAULT_LAYOUT_CONFIG } from '@/hooks/useLayoutConfig';
import { idDaConfirmacao, montarLinhaDaConfirmacao } from '@/lib/resumoClinico/confirmacao';

// Perfil do paciente de verdade (aba Avaliação > linha do tempo clínica > "Confirmar com a data real" > diálogo > gravação > a
// linha do tempo se refaz > "Desfazer"). Só os cartões pesados e o Avatar são simulados; a página, o hook que grava, os dois
// diálogos, a lente do profissional e a linha do tempo são os reais. O banco é falso, em memória, e registra cada escrita.

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
  const { historiaDeVida = [], avaliacoes = [avaliacao()], nascimento = null } = opcoes;
  h.falso = criarBancoFalso({
    pacientes: [{
      id: 'pac-1', nome: 'Ana', sobrenome: 'Souza', terapeuta_id: 'prof-1', user_id: null, paciente_servicos: [], created_at: '2026-01-10T12:00:00+00:00', ativo: true,
      data_nascimento: nascimento, historia_atual: null,
      historico_clinico: { cirurgias: { items: [{ id: 'c1', tipo: 'Joelho', ano: '2022', complicacoes: 'dor ao agachar' }, { id: 'c2', tipo: 'Apêndice', ano: 'há 2 anos' }] } },
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
        <Routes><Route path="/pacientes/:id" element={<PacientePerfil />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Com um diálogo aberto o resto da página fica escondido do leitor de tela (aria-hidden), então a seção é achada pelo DOM.
const regiao = () => document.querySelector('section[aria-labelledby="titulo-linha-do-tempo-clinica"]') as HTMLElement;
const botaoConfirmar = (titulo = TITULO_DO_CLIENTE) => within(regiao()).getByRole('button', { name: `Confirmar com a data real: ${titulo}` });
const dialogo = () => screen.getByRole('dialog', { name: 'Confirmar com a data real' });
const itemDoMarco = (titulo: string) => Array.from(regiao().querySelectorAll('li')).find((li) => (li.querySelector('p')?.textContent ?? '').replace(/^(Fato clínico: |Registro no app: )/, '') === titulo);
const escritasNaTabela = () => h.falso.escritas().filter((o) => o.tabela === 'historia_vida_paciente');

async function esperarATela() {
  await screen.findByRole('region', { name: 'Linha do tempo clínica' }, TEMPO);
  await waitFor(() => expect(within(regiao()).getByText('Linha do tempo clínica')).toBeInTheDocument(), TEMPO);
  await waitFor(() => expect(itemDoMarco(TITULO_DO_CLIENTE) ?? itemDoMarco('Joelho')).toBeDefined(), TEMPO);
}

async function preencherEConfirmarOAno(ano = '2022') {
  fireEvent.click(botaoConfirmar());
  const caixa = await screen.findByRole('dialog', { name: 'Confirmar com a data real' });
  fireEvent.click(within(caixa).getByRole('button', { name: 'Cirurgia' }));
  fireEvent.click(within(caixa).getByRole('button', { name: 'Só sei o ano' }));
  fireEvent.change(within(caixa).getByLabelText('Ano em que aconteceu'), { target: { value: ano } });
  fireEvent.click(within(caixa).getByRole('button', { name: 'Confirmar' }));
}

beforeEach(() => {
  h.clinica = { papel: undefined, loading: false };
  h.toast.success.mockClear();
  h.toast.error.mockClear();
  h.toast.info.mockClear();
  preparar();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('Perfil do paciente: confirmar o marco que o cliente relatou', () => {
  it('clicar em Confirmar abre o diálogo da PÁGINA com o relato do cliente, o aviso fixo da triagem e nada escolhido', async () => {
    montar();
    await esperarATela();
    fireEvent.click(botaoConfirmar());
    const caixa = await screen.findByRole('dialog', { name: 'Confirmar com a data real' });
    expect(within(caixa).getByText('Joelho')).toBeInTheDocument();
    expect(within(caixa).getByText('Ano que o cliente escreveu: "2022"')).toBeInTheDocument();
    expect(within(caixa).getByText('Complicações: dor ao agachar')).toBeInTheDocument();
    expect(within(caixa).getByText(AVISO)).toBeInTheDocument();
    expect((within(caixa).getByLabelText('Dia em que aconteceu') as HTMLInputElement).value).toBe('');
    expect(within(caixa).getByRole('button', { name: 'Cirurgia' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(caixa).getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    expect(h.falso.escritas()).toEqual([]);
  }, 40000);

  it('escolher, digitar o ano e confirmar grava UMA linha com o payload certo e nenhuma outra escrita', async () => {
    montar();
    await esperarATela();
    await preencherEConfirmarOAno('2022');
    await waitFor(() => expect(escritasNaTabela()).toHaveLength(1), TEMPO);
    expect(h.falso.escritas()).toHaveLength(1);
    expect(escritasNaTabela()[0].tipo).toBe('insert');
    expect(escritasNaTabela()[0].payload).toStrictEqual({
      id: ID_DA_LINHA, terapeuta_id: 'prof-1', paciente_id: 'pac-1', data_evento: '2022-01-01', tipo: 'cirurgia', titulo: 'Joelho',
      descricao: 'Data aproximada: só o ano (2022).', sistema_corporal: null, severidade: 0, resolvido: true, visivel_paciente: false,
      profissional_registro: 'Ana Souza · CREFITO 12345-F',
      metadata: {
        versao: 1, origem: 'confirmacao_de_marco', fonte: 'historico_clinico', chave_cliente: CHAVE,
        relato_cliente: { tipo: 'Joelho', ano: '2022', complicacoes: 'dor ao agachar' }, precisao: 'ano', confirmado_por: { nome: 'Ana Souza', registro: '12345-F' },
      },
    });
  }, 40000);

  it('depois de gravar, o diálogo fecha, o relato do cliente some da lista e o marco confirmado aparece com selo e data', async () => {
    montar();
    await esperarATela();
    await preencherEConfirmarOAno('2022');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirmar com a data real' })).toBeNull(), TEMPO);
    await waitFor(() => expect(itemDoMarco(TITULO_DO_CLIENTE)).toBeUndefined(), TEMPO);
    const confirmado = itemDoMarco('Joelho') as HTMLElement;
    expect(confirmado).toBeDefined();
    expect(confirmado.getAttribute('data-precisao')).toBe('ano');
    expect(confirmado.textContent).toContain('2022 · Cirurgia');
    expect(confirmado.textContent).not.toContain('01/01/2022');
    expect(confirmado.querySelector('[data-selo="data-confirmada"]')?.textContent).toBe('Data confirmada pelo profissional · texto do cliente');
    expect(confirmado.textContent).toMatch(/Confirmado por você em \d{2}\/\d{2}\/\d{4}/);
    expect(within(confirmado).getByRole('button', { name: 'ver relato original' })).toBeInTheDocument();
    expect(within(confirmado).getByRole('button', { name: 'Desfazer a confirmação de Joelho' })).toBeInTheDocument();
    expect(h.toast.success).toHaveBeenCalledTimes(1);
  }, 40000);

  it('depois de confirmar o foco vai ao título da seção (o botão que abriu o diálogo deixou de existir)', async () => {
    montar();
    await esperarATela();
    await preencherEConfirmarOAno('2022');
    await waitFor(() => expect(document.activeElement?.id).toBe('titulo-linha-do-tempo-clinica'), TEMPO);
  }, 40000);

  it('cancelar o diálogo sem digitar nada fecha e o foco volta para o botão que o abriu; nada é gravado', async () => {
    montar();
    await esperarATela();
    const botao = botaoConfirmar();
    botao.focus();
    fireEvent.click(botao);
    const caixa = await screen.findByRole('dialog', { name: 'Confirmar com a data real' });
    fireEvent.click(within(caixa).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirmar com a data real' })).toBeNull(), TEMPO);
    await waitFor(() => expect(document.activeElement).toBe(botaoConfirmar()), TEMPO);
    expect(h.falso.escritas()).toEqual([]);
  }, 40000);

  it('data completa: grava o dia exato e a descrição vazia', async () => {
    montar();
    await esperarATela();
    fireEvent.click(botaoConfirmar());
    const caixa = await screen.findByRole('dialog', { name: 'Confirmar com a data real' });
    fireEvent.click(within(caixa).getByRole('button', { name: 'Internação' }));
    fireEvent.change(within(caixa).getByLabelText('Dia em que aconteceu'), { target: { value: '2022-06-10' } });
    fireEvent.click(within(caixa).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(escritasNaTabela()).toHaveLength(1), TEMPO);
    const payload = escritasNaTabela()[0].payload as { data_evento: string; descricao: unknown; tipo: string; metadata: { precisao: string } };
    expect(payload.data_evento).toBe('2022-06-10');
    expect(payload.descricao).toBeNull();
    expect(payload.tipo).toBe('internacao');
    expect(payload.metadata.precisao).toBe('dia');
  }, 40000);

  it('o item de "Sem data" também pode ser confirmado, e o relato sai de lá', async () => {
    montar();
    await esperarATela();
    fireEvent.click(within(regiao()).getByRole('button', { name: /^Sem data/ }));
    fireEvent.click(within(regiao()).getByRole('button', { name: 'Confirmar com a data real: Cirurgia ou internação: Apêndice' }));
    const caixa = await screen.findByRole('dialog', { name: 'Confirmar com a data real' });
    fireEvent.click(within(caixa).getByRole('button', { name: 'Cirurgia' }));
    fireEvent.change(within(caixa).getByLabelText('Dia em que aconteceu'), { target: { value: '2019-03-04' } });
    fireEvent.click(within(caixa).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(escritasNaTabela()).toHaveLength(1), TEMPO);
    expect((escritasNaTabela()[0].payload as { metadata: { chave_cliente: string } }).metadata.chave_cliente).toBe('historico_clinico:cirurgia:id:c2');
    await waitFor(() => expect(itemDoMarco('Apêndice')).toBeDefined(), TEMPO);
    expect(itemDoMarco('Cirurgia ou internação: Apêndice')).toBeUndefined();
  }, 40000);

  it('a data não pode ser antes do nascimento do paciente (a página passa o nascimento ao hook e ao diálogo)', async () => {
    preparar({ nascimento: '2023-05-10' });
    montar();
    await esperarATela();
    fireEvent.click(botaoConfirmar());
    const caixa = await screen.findByRole('dialog', { name: 'Confirmar com a data real' });
    fireEvent.click(within(caixa).getByRole('button', { name: 'Cirurgia' }));
    fireEvent.change(within(caixa).getByLabelText('Dia em que aconteceu'), { target: { value: '2022-06-10' } });
    expect(within(caixa).getByRole('alert').textContent).toContain('antes do nascimento do cliente');
    expect(within(caixa).getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  }, 40000);
});

describe('Perfil do paciente: quando o banco recusa', () => {
  it('o diálogo continua aberto com o que foi digitado, o erro aparece em texto e em aviso, e a lista não muda', async () => {
    h.falso.falharEscritaQuando((op) => op.tipo === 'insert', 'falha de rede');
    montar();
    await esperarATela();
    await preencherEConfirmarOAno('2022');
    const caixa = await screen.findByRole('dialog', { name: 'Confirmar com a data real' });
    await waitFor(() => expect(caixa.querySelector('[data-erro="gravacao"]')).not.toBeNull(), TEMPO);
    expect(caixa.querySelector('[data-erro="gravacao"]')?.textContent).toBe('Não deu para salvar a confirmação. Confira a conexão e tente de novo.');
    expect(h.toast.error).toHaveBeenCalledWith('Não deu para salvar a confirmação. Confira a conexão e tente de novo.');
    expect((within(caixa).getByLabelText('Ano em que aconteceu') as HTMLInputElement).value).toBe('2022');
    expect(within(caixa).getByRole('button', { name: 'Cirurgia' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(caixa).getByRole('button', { name: 'Confirmar' })).toBeEnabled();
    expect(itemDoMarco(TITULO_DO_CLIENTE)).toBeDefined();
    expect(h.falso.tabelas.historia_vida_paciente).toHaveLength(0);
  }, 40000);

  it('banco sem as colunas (PGRST204): a frase diz que o banco ainda não está preparado', async () => {
    h.falso.falharEscritaQuando((op) => op.tipo === 'insert', 'Could not find the column', 'PGRST204');
    montar();
    await esperarATela();
    await preencherEConfirmarOAno('2022');
    const caixa = await screen.findByRole('dialog', { name: 'Confirmar com a data real' });
    await waitFor(() => expect(caixa.querySelector('[data-erro="gravacao"]')?.textContent).toMatch(/O banco ainda não está preparado para esta confirmação/), TEMPO);
  }, 40000);

  it('o mesmo toque duas vezes grava uma vez só', async () => {
    montar();
    await esperarATela();
    fireEvent.click(botaoConfirmar());
    const caixa = await screen.findByRole('dialog', { name: 'Confirmar com a data real' });
    fireEvent.click(within(caixa).getByRole('button', { name: 'Cirurgia' }));
    fireEvent.change(within(caixa).getByLabelText('Dia em que aconteceu'), { target: { value: '2022-06-10' } });
    const confirmar = within(caixa).getByRole('button', { name: 'Confirmar' });
    fireEvent.click(confirmar);
    fireEvent.click(confirmar);
    fireEvent.submit(caixa.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirmar com a data real' })).toBeNull(), TEMPO);
    expect(escritasNaTabela()).toHaveLength(1);
  }, 40000);
});

describe('Perfil do paciente: desfazer', () => {
  it('o marco confirmado tem "Desfazer": o aviso pergunta, apagar remove só a linha da confirmação e o relato do cliente volta', async () => {
    const manual: Linha = { id: 'manual-1', paciente_id: 'pac-1', terapeuta_id: 'prof-1', data_evento: '2019-03-04', tipo: 'fratura', titulo: 'Fratura de punho', descricao: '', metadata: {} };
    preparar({ historiaDeVida: [manual, confirmacaoGravada()] });
    montar();
    await waitFor(() => expect(itemDoMarco('Joelho')).toBeDefined(), TEMPO);
    expect(itemDoMarco(TITULO_DO_CLIENTE)).toBeUndefined();

    fireEvent.click(within(regiao()).getByRole('button', { name: 'Desfazer a confirmação de Joelho' }));
    const alerta = await screen.findByRole('alertdialog', { name: 'Desfazer a confirmação?' });
    expect(h.falso.escritas()).toEqual([]);
    fireEvent.click(within(alerta).getByRole('button', { name: 'Desfazer confirmação' }));

    await waitFor(() => expect(h.falso.escritas().filter((o) => o.tipo === 'delete')).toHaveLength(1), TEMPO);
    expect(h.falso.escritas()).toHaveLength(1);
    expect(h.falso.escritas()[0].filtros).toEqual([
      ['eq', 'id', ID_DA_LINHA], ['eq', 'paciente_id', 'pac-1'], ['eq', 'terapeuta_id', 'prof-1'], ['eq', 'metadata->>origem', 'confirmacao_de_marco'],
    ]);
    expect(h.falso.tabelas.historia_vida_paciente.map((l) => l.id)).toEqual(['manual-1']);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), TEMPO);
    await waitFor(() => expect(itemDoMarco(TITULO_DO_CLIENTE)).toBeDefined(), TEMPO);
    expect(itemDoMarco('Joelho')).toBeUndefined();
    expect((itemDoMarco(TITULO_DO_CLIENTE) as HTMLElement).querySelector('[data-origem]')?.textContent).toBe('Relatado pelo cliente, não revisado');
    expect(within(regiao()).getByRole('button', { name: `Confirmar com a data real: ${TITULO_DO_CLIENTE}` })).toBeInTheDocument();
    expect(within(regiao()).getByText('Fratura de punho')).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement?.id).toBe('titulo-linha-do-tempo-clinica'), TEMPO);
  }, 40000);

  it('"Voltar" no aviso não apaga nada', async () => {
    preparar({ historiaDeVida: [confirmacaoGravada()] });
    montar();
    await waitFor(() => expect(itemDoMarco('Joelho')).toBeDefined(), TEMPO);
    fireEvent.click(within(regiao()).getByRole('button', { name: 'Desfazer a confirmação de Joelho' }));
    const alerta = await screen.findByRole('alertdialog', { name: 'Desfazer a confirmação?' });
    fireEvent.click(within(alerta).getByRole('button', { name: 'Voltar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), TEMPO);
    expect(h.falso.escritas()).toEqual([]);
    expect(itemDoMarco('Joelho')).toBeDefined();
  }, 40000);

  it('erro ao apagar: o aviso continua aberto com a frase e a confirmação continua na lista', async () => {
    preparar({ historiaDeVida: [confirmacaoGravada()] });
    h.falso.falharEscritaQuando((op) => op.tipo === 'delete', 'falha de rede');
    montar();
    await waitFor(() => expect(itemDoMarco('Joelho')).toBeDefined(), TEMPO);
    fireEvent.click(within(regiao()).getByRole('button', { name: 'Desfazer a confirmação de Joelho' }));
    const alerta = await screen.findByRole('alertdialog', { name: 'Desfazer a confirmação?' });
    fireEvent.click(within(alerta).getByRole('button', { name: 'Desfazer confirmação' }));
    await waitFor(() => expect(alerta.querySelector('[data-erro="desfazer"]')?.textContent).toBe('Não deu para desfazer a confirmação. Confira a conexão e tente de novo.'), TEMPO);
    expect(h.falso.tabelas.historia_vida_paciente).toHaveLength(1);
    expect(itemDoMarco('Joelho')).toBeDefined();
  }, 40000);
});

describe('Perfil do paciente: o aviso de desfazer diz qual marco será apagado', () => {
  it('o título do marco confirmado aparece na pergunta, na página de verdade', async () => {
    preparar({ historiaDeVida: [confirmacaoGravada()] });
    montar();
    await waitFor(() => expect(within(regiao()).getByRole('button', { name: 'Desfazer a confirmação de Joelho' })).toBeInTheDocument(), TEMPO);
    fireEvent.click(within(regiao()).getByRole('button', { name: 'Desfazer a confirmação de Joelho' }));
    const alerta = await screen.findByRole('alertdialog', { name: 'Desfazer a confirmação?' });
    expect(alerta.textContent).toContain('O marco confirmado “Joelho” será apagado de vez');
  }, 40000);
});

describe('Perfil do paciente: enquanto a gravação está em andamento', () => {
  it('o diálogo mostra "Salvando…" e desliga os chips, o campo, o Cancelar e o Confirmar até o banco responder', async () => {
    let liberar: () => void = () => {};
    h.falso.antesDeEscrever(() => new Promise<void>((resolver) => { liberar = resolver; }));
    montar();
    await esperarATela();
    await preencherEConfirmarOAno('2022');
    const caixa = await screen.findByRole('dialog', { name: 'Confirmar com a data real' });

    const salvando = await within(caixa).findByRole('button', { name: /Salvando/ });
    expect(salvando).toBeDisabled();
    expect(salvando.textContent).toContain('Salvando…');
    for (const nome of ['Cirurgia', 'Internação', 'Sei o dia', 'Só sei o ano', 'Cancelar']) {
      expect(within(caixa).getByRole('button', { name: nome }), nome).toBeDisabled();
    }
    expect(within(caixa).getByLabelText('Ano em que aconteceu')).toBeDisabled();

    await act(async () => { liberar(); });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Confirmar com a data real' })).toBeNull(), TEMPO);
    expect(escritasNaTabela()).toHaveLength(1);
  }, 40000);

  it('o aviso de desfazer mostra "Desfazendo…" e desliga os dois botões até o banco responder', async () => {
    preparar({ historiaDeVida: [confirmacaoGravada()] });
    let liberar: () => void = () => {};
    h.falso.antesDeEscrever(() => new Promise<void>((resolver) => { liberar = resolver; }));
    montar();
    await waitFor(() => expect(within(regiao()).getByRole('button', { name: 'Desfazer a confirmação de Joelho' })).toBeInTheDocument(), TEMPO);
    fireEvent.click(within(regiao()).getByRole('button', { name: 'Desfazer a confirmação de Joelho' }));
    const alerta = await screen.findByRole('alertdialog', { name: 'Desfazer a confirmação?' });
    fireEvent.click(within(alerta).getByRole('button', { name: 'Desfazer confirmação' }));

    const desfazendo = await within(alerta).findByRole('button', { name: /Desfazendo/ });
    expect(desfazendo).toBeDisabled();
    expect(within(alerta).getByRole('button', { name: 'Voltar' })).toBeDisabled();

    await act(async () => { liberar(); });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull(), TEMPO);
  }, 40000);
});

describe('Perfil do paciente: durante a animação de saída o diálogo não esvazia', () => {
  it('cancelar o diálogo de confirmar: ele continua com o relato do cliente até a animação terminar, e some depois', async () => {
    simularAnimacaoDeSaida();
    montar();
    await esperarATela();
    fireEvent.click(botaoConfirmar());
    const caixa = await screen.findByRole('dialog', { name: 'Confirmar com a data real' });
    fireEvent.click(within(caixa).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(caixa).toHaveAttribute('data-state', 'closed'), TEMPO);
    expect(caixa.isConnected).toBe(true);
    expect(caixa.textContent).toContain('Confirmar com a data real');
    expect(caixa.textContent).toContain('Joelho');
    expect(caixa.textContent).toContain('Ano que o cliente escreveu: "2022"');
    expect(caixa.textContent).toContain('Complicações: dor ao agachar');

    terminarAAnimacaoDeSaida(caixa);
    await waitFor(() => expect(caixa.isConnected).toBe(false), TEMPO);
  }, 40000);

  it('confirmar com sucesso: o diálogo também sai inteiro, com o relato do cliente', async () => {
    simularAnimacaoDeSaida();
    montar();
    await esperarATela();
    await preencherEConfirmarOAno('2022');
    const caixa = await screen.findByRole('dialog', { name: 'Confirmar com a data real' });
    await waitFor(() => expect(escritasNaTabela()).toHaveLength(1), TEMPO);
    await waitFor(() => expect(caixa).toHaveAttribute('data-state', 'closed'), TEMPO);
    expect(caixa.isConnected).toBe(true);
    expect(caixa.textContent).toContain('Joelho');
    terminarAAnimacaoDeSaida(caixa);
    await waitFor(() => expect(caixa.isConnected).toBe(false), TEMPO);
  }, 40000);

  it('"Voltar" no aviso de desfazer: ele continua com o título do marco até a animação terminar', async () => {
    simularAnimacaoDeSaida();
    preparar({ historiaDeVida: [confirmacaoGravada()] });
    montar();
    await waitFor(() => expect(within(regiao()).getByRole('button', { name: 'Desfazer a confirmação de Joelho' })).toBeInTheDocument(), TEMPO);
    fireEvent.click(within(regiao()).getByRole('button', { name: 'Desfazer a confirmação de Joelho' }));
    const alerta = await screen.findByRole('alertdialog', { name: 'Desfazer a confirmação?' });
    fireEvent.click(within(alerta).getByRole('button', { name: 'Voltar' }));

    await waitFor(() => expect(alerta).toHaveAttribute('data-state', 'closed'), TEMPO);
    expect(alerta.isConnected).toBe(true);
    expect(alerta.textContent).toContain('O marco confirmado “Joelho” será apagado de vez');

    terminarAAnimacaoDeSaida(alerta);
    await waitFor(() => expect(alerta.isConnected).toBe(false), TEMPO);
  }, 40000);
});

describe('Perfil do paciente: quem vê os botões', () => {
  const semBotoes = async () => {
    montar();
    await waitFor(() => expect(itemDoMarco('Joelho') ?? itemDoMarco(TITULO_DO_CLIENTE)).toBeDefined(), TEMPO);
    expect(within(regiao()).queryAllByRole('button', { name: /^Confirmar com a data real/ })).toHaveLength(0);
    expect(within(regiao()).queryAllByRole('button', { name: /^Desfazer/ })).toHaveLength(0);
  };

  it('a RECEPÇÃO não vê o botão de confirmar nem o de desfazer', async () => {
    h.clinica = { papel: 'recepcao', loading: false };
    preparar({ historiaDeVida: [confirmacaoGravada()] });
    await semBotoes();
    expect(within(regiao()).getByRole('button', { name: 'ver relato original' })).toBeInTheDocument();
  }, 40000);

  it('a recepção também não vê o botão nos relatos que ainda não foram confirmados', async () => {
    h.clinica = { papel: 'recepcao', loading: false };
    await semBotoes();
  }, 40000);

  it('enquanto o papel na clínica ainda carrega, o botão também não aparece', async () => {
    h.clinica = { papel: undefined, loading: true };
    await semBotoes();
  }, 40000);

  it.each([[undefined, 'modo solo'], ['dono', 'dono da clínica'], ['profissional', 'profissional da clínica']])('papel %s (%s) vê o botão', async (papel) => {
    h.clinica = { papel, loading: false };
    montar();
    await esperarATela();
    expect(botaoConfirmar()).toBeInTheDocument();
  }, 40000);

  it('sem diálogo aberto, nenhum diálogo existe na página', async () => {
    montar();
    await esperarATela();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  }, 40000);
});

describe('Perfil do paciente: o texto digitado sobrevive à remontagem das seções', () => {
  it('quando a avaliação é reprocessada (savedAt novo) as seções remontam, e o diálogo da página mantém o que foi digitado', async () => {
    montar();
    await esperarATela();
    const regiaoAntes = regiao();
    fireEvent.click(botaoConfirmar());
    const caixa = await screen.findByRole('dialog', { name: 'Confirmar com a data real' });
    fireEvent.click(within(caixa).getByRole('button', { name: 'Internação' }));
    fireEvent.click(within(caixa).getByRole('button', { name: 'Só sei o ano' }));
    fireEvent.change(within(caixa).getByLabelText('Ano em que aconteceu'), { target: { value: '2022' } });

    // O reprocesso grava um savedAt novo: a chave de AvaliacaoSecoesEditaveis muda e a linha do tempo é montada de novo.
    h.falso.tabelas.avaliacoes_voz = [avaliacao('s2')];
    await act(async () => { await qc.invalidateQueries({ queryKey: ['avaliacao-voz-latest'] }); });
    await waitFor(() => expect(regiao()).not.toBe(regiaoAntes), TEMPO);

    const mesmo = screen.getByRole('dialog', { name: 'Confirmar com a data real' });
    expect(mesmo).toBe(caixa);
    expect((within(mesmo).getByLabelText('Ano em que aconteceu') as HTMLInputElement).value).toBe('2022');
    expect(within(mesmo).getByRole('button', { name: 'Internação' })).toHaveAttribute('aria-pressed', 'true');
  }, 40000);
});

describe('Perfil do paciente: abrir o diálogo e ler a lista não grava nada', () => {
  it('carregar a página, abrir e cancelar o diálogo e abrir o aviso de desfazer não escrevem no banco', async () => {
    preparar({ historiaDeVida: [confirmacaoGravada()] });
    montar();
    await waitFor(() => expect(itemDoMarco('Joelho')).toBeDefined(), TEMPO);
    fireEvent.click(within(regiao()).getByRole('button', { name: 'Desfazer a confirmação de Joelho' }));
    const alerta = await screen.findByRole('alertdialog', { name: 'Desfazer a confirmação?' });
    fireEvent.click(within(alerta).getByRole('button', { name: 'Voltar' }));
    expect(h.falso.escritas()).toEqual([]);
  }, 40000);
});
