import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';
import { envolverBanco, type BancoEnvolvido } from './helpers/bancoFalsoLeitura';

const h = vi.hoisted(() => ({
  falso: null as unknown as BancoFalso,
  banco: null as unknown as BancoEnvolvido,
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => h.banco.from(t) } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' } }) }));
vi.mock('sonner', () => ({ toast: h.toast }));

import DiagnosticosCID10Card from '@/components/medicina/DiagnosticosCID10Card';
import { FONTES_VAZIAS } from '@/lib/resumoClinico/tipos';

// Campo opcional "Data do diagnóstico" no cartão de CID: vazio por padrão, vira data real na linha do tempo; vazio segue
// "sem data". O insert manda SEMPRE a coluna (a data ou null), senão o banco a preenche com o dia do cadastro.

// Dia 25/11/2026 ao meio-dia no Brasil: depois do corte de 18/11/2026, e fixo (o relógio real não entra nos testes).
const AGORA = new Date('2026-11-25T15:00:00Z');
const HOJE = '2026-11-25';
const AMANHA = '2026-11-26';
const MENSAGEM_DE_DATA_INVALIDA = 'Data inválida: não pode ser no futuro nem antes de 1900.';

const CHAVE = ['fontes-clinicas', 'pac-1', 'prof-1'];
const OUTRAS = [['fontes-clinicas', 'pac-2', 'prof-1'], ['fontes-clinicas', 'pac-10', 'prof-1']];

const cid: Linha = { codigo: 'M54.5', descricao: 'Dor lombar baixa', categoria: 'Dorsopatias' };
const lombar: Linha = {
  id: 'd1', paciente_id: 'pac-1', terapeuta_id: 'prof-1', cid_codigo: 'M54.5', cid_descricao: 'Dor lombar baixa', tipo: 'principal',
  observacao: null, ativo: true, data_diagnostico: '2019-03-04', created_at: '2026-02-03T15:00:00+00:00',
};
const cervical: Linha = {
  id: 'd2', paciente_id: 'pac-1', terapeuta_id: 'prof-1', cid_codigo: 'M54.2', cid_descricao: 'Cervicalgia', tipo: 'secundario',
  observacao: null, ativo: true, data_diagnostico: null, created_at: '2026-02-02T15:00:00+00:00',
};

function novoCliente(): QueryClient {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  for (const chave of [CHAVE, ...OUTRAS]) qc.setQueryData(chave, { fontes: FONTES_VAZIAS, falhas: [], cortes: [] });
  return qc;
}
const invalidada = (qc: QueryClient, chave: readonly unknown[]) => qc.getQueryState(chave)?.isInvalidated === true;

function preparar(tabelas: Record<string, Linha[]> = {}) {
  h.falso = criarBancoFalso(tabelas);
  h.banco = envolverBanco(h.falso);
}
function abrir(qc = novoCliente()) {
  render(<QueryClientProvider client={qc}><MemoryRouter><DiagnosticosCID10Card pacienteId="pac-1" /></MemoryRouter></QueryClientProvider>);
  return qc;
}
async function esperarInvalidada(qc: QueryClient) {
  await waitFor(() => expect(invalidada(qc, CHAVE)).toBe(true));
  for (const outra of OUTRAS) expect(invalidada(qc, outra), outra.join('/')).toBe(false);
}
async function esperarSemInvalidar(qc: QueryClient) {
  await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
  expect(invalidada(qc, CHAVE)).toBe(false);
}

const escritasNaTabela = () => h.falso.escritas().filter((o) => o.tabela === 'diagnosticos_paciente');
const campoDaDataNova = () => screen.getByLabelText('Data do diagnóstico') as HTMLInputElement;
const linhaDoDiagnostico = (descricao: string) => screen.getByText(descricao).closest('div.rounded-lg') as HTMLElement;

async function abrirFormularioComCid() {
  fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }));
  fireEvent.click(screen.getAllByRole('combobox')[0]);
  fireEvent.click(await screen.findByText(/Dor lombar baixa/));
}
const digitarDataNova = (valor: string) => fireEvent.change(campoDaDataNova(), { target: { value: valor } });
const salvarNovo = () => fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

async function abrirEdicaoDaData(rotulo: string) {
  fireEvent.click(await screen.findByRole('button', { name: rotulo }));
  return screen.getByLabelText(/^Data do diagnóstico M54\./) as HTMLInputElement;
}

beforeAll(() => {
  class EventoDePonteiro extends MouseEvent {
    pointerType: string; pointerId: number;
    constructor(tipo: string, init: PointerEventInit = {}) { super(tipo, init); this.pointerType = init.pointerType ?? 'mouse'; this.pointerId = init.pointerId ?? 1; }
  }
  Object.defineProperty(window, 'PointerEvent', { configurable: true, writable: true, value: EventoDePonteiro });
  Object.assign(Element.prototype, { hasPointerCapture: () => false, setPointerCapture: () => {}, releasePointerCapture: () => {} });
  Element.prototype.scrollIntoView = vi.fn();
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});
beforeEach(() => {
  h.toast.success.mockReset();
  h.toast.error.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AGORA);
  preparar({ cid10_catalogo: [cid], diagnosticos_paciente: [] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('formulário de adicionar: o campo "Data do diagnóstico"', () => {
  it('existe, é um campo de data vazio por padrão, com ajuda curta e alvo de 44 px', async () => {
    abrir();
    await abrirFormularioComCid();
    const campo = campoDaDataNova();
    expect(campo.type).toBe('date');
    expect(campo.value).toBe('');
    expect(campo.className).toMatch(/\bh-11\b/);
    expect(campo.className).toMatch(/\bmin-h-11\b/);
    const ajuda = screen.getByText('Opcional. Sem data, o diagnóstico fica em Sem data na linha do tempo.');
    expect(campo.getAttribute('aria-describedby')).toContain(ajuda.id);
  });

  it('não deixa escolher data no futuro: o máximo é hoje no fuso do Brasil (e o mínimo é 1900)', async () => {
    abrir();
    await abrirFormularioComCid();
    expect(campoDaDataNova().max).toBe(HOJE);
    expect(campoDaDataNova().min).toBe('1900-01-01');
  });

  it('o máximo é o dia do Brasil, não o dia em UTC (01:00 UTC de 26/11 ainda é 25/11 no Brasil)', async () => {
    vi.setSystemTime(new Date('2026-11-26T01:00:00Z'));
    abrir();
    await abrirFormularioComCid();
    expect(campoDaDataNova().max).toBe(HOJE);
  });

  it('adicionar SEM data envia data_diagnostico: null (a coluna vai sempre, para o banco não preencher com o dia do cadastro)', async () => {
    const qc = abrir();
    await abrirFormularioComCid();
    salvarNovo();
    await esperarInvalidada(qc);
    const escritas = escritasNaTabela();
    expect(escritas).toHaveLength(1);
    expect(escritas[0].tipo).toBe('insert');
    const payload = escritas[0].payload as Record<string, unknown>;
    expect(Object.keys(payload)).toContain('data_diagnostico');
    expect(payload).toEqual({
      paciente_id: 'pac-1', terapeuta_id: 'prof-1', cid_codigo: 'M54.5', cid_descricao: 'Dor lombar baixa',
      tipo: 'principal', observacao: null, data_diagnostico: null,
    });
    expect(h.falso.tabelas.diagnosticos_paciente[0].data_diagnostico).toBeNull();
  });

  it('dois toques rápidos em Salvar com a gravação ainda em andamento fazem UM insert só', async () => {
    let liberar: () => void = () => {};
    h.falso.antesDeEscrever(() => new Promise<void>((r) => { liberar = r; }));
    const qc = abrir();
    await abrirFormularioComCid();
    const botao = screen.getByRole('button', { name: 'Salvar' });
    fireEvent.click(botao);
    await waitFor(() => expect((botao as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(botao);
    await act(async () => { liberar(); });
    await esperarInvalidada(qc);
    expect(escritasNaTabela().filter((o) => o.tipo === 'insert')).toHaveLength(1);
  });

  it('adicionar COM data envia a data escolhida', async () => {
    const qc = abrir();
    await abrirFormularioComCid();
    digitarDataNova('2024-05-10');
    salvarNovo();
    await esperarInvalidada(qc);
    const escritas = escritasNaTabela();
    expect(escritas).toHaveLength(1);
    expect((escritas[0].payload as Record<string, unknown>).data_diagnostico).toBe('2024-05-10');
    expect(h.falso.tabelas.diagnosticos_paciente[0].data_diagnostico).toBe('2024-05-10');
  });

  it('hoje é uma data válida (diagnosticou e registrou no mesmo dia)', async () => {
    const qc = abrir();
    await abrirFormularioComCid();
    digitarDataNova(HOJE);
    salvarNovo();
    await esperarInvalidada(qc);
    expect((escritasNaTabela()[0].payload as Record<string, unknown>).data_diagnostico).toBe(HOJE);
  });

  it.each([
    ['amanhã', AMANHA],
    ['ano 2099', '2099-01-01'],
    ['antes de 1900', '1899-12-31'],
  ])('data %s é recusada: aparece o aviso, o toast de erro e nada é gravado nem invalidado', async (_nome, valor) => {
    const qc = abrir();
    await abrirFormularioComCid();
    digitarDataNova(valor);
    expect(screen.getByRole('alert').textContent).toBe(MENSAGEM_DE_DATA_INVALIDA);
    expect(campoDaDataNova().getAttribute('aria-invalid')).toBe('true');
    salvarNovo();
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith(MENSAGEM_DE_DATA_INVALIDA));
    expect(escritasNaTabela()).toEqual([]);
    expect(h.toast.success).not.toHaveBeenCalled();
    await esperarSemInvalidar(qc);
    expect(screen.getByLabelText('Data do diagnóstico')).toBeTruthy();
  });

  it('o aviso some quando a data volta a ser válida e o campo vazio nunca mostra aviso', async () => {
    abrir();
    await abrirFormularioComCid();
    expect(screen.queryByRole('alert')).toBeNull();
    digitarDataNova(AMANHA);
    expect(screen.getByRole('alert')).toBeTruthy();
    digitarDataNova(HOJE);
    expect(screen.queryByRole('alert')).toBeNull();
    digitarDataNova(AMANHA);
    digitarDataNova('');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('depois de salvar, o formulário seguinte começa com o campo vazio', async () => {
    const qc = abrir();
    await abrirFormularioComCid();
    digitarDataNova('2024-05-10');
    salvarNovo();
    await esperarInvalidada(qc);
    await waitFor(() => expect(screen.queryByLabelText('Data do diagnóstico')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }));
    expect(campoDaDataNova().value).toBe('');
  });

  it('Cancelar descarta a data: reabrir o formulário começa vazio', async () => {
    abrir();
    await abrirFormularioComCid();
    digitarDataNova('2024-05-10');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }));
    expect(campoDaDataNova().value).toBe('');
  });

  it('erro do banco ao adicionar: toast com a mensagem e nada é invalidado', async () => {
    h.falso.falharEscritaQuando((op) => op.tabela === 'diagnosticos_paciente', 'sem permissão');
    const qc = abrir();
    await abrirFormularioComCid();
    digitarDataNova('2024-05-10');
    salvarNovo();
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('sem permissão'));
    await esperarSemInvalidar(qc);
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(h.falso.tabelas.diagnosticos_paciente).toHaveLength(0);
  });
});

describe('lista: a data de cada diagnóstico já cadastrado', () => {
  beforeEach(() => preparar({ diagnosticos_paciente: [lombar, cervical] }));

  it('mostra a data quando há, em dia/mês/ano, e "sem data" quando não há', async () => {
    abrir();
    await screen.findByText('Dor lombar baixa');
    expect(within(linhaDoDiagnostico('Dor lombar baixa')).getByText(/Data do diagnóstico: 04\/03\/2019/)).toBeTruthy();
    expect(within(linhaDoDiagnostico('Cervicalgia')).getByText(/Data do diagnóstico: sem data/)).toBeTruthy();
  });

  it('cada linha tem o botão de 44 px: "Corrigir data" se já tem data e "Informar data" se não tem', async () => {
    abrir();
    const corrigir = await screen.findByRole('button', { name: 'Corrigir data do diagnóstico M54.5' });
    const informar = screen.getByRole('button', { name: 'Informar data do diagnóstico M54.2' });
    expect(corrigir.textContent).toBe('Corrigir data');
    expect(informar.textContent).toBe('Informar data');
    for (const botao of [corrigir, informar]) expect(botao.className).toMatch(/\bmin-h-11\b/);
  });

  it('aviso "Pode ter sido preenchida pelo sistema" só na linha anterior ao corte cuja data é o dia do cadastro', async () => {
    preparar({
      diagnosticos_paciente: [
        { ...lombar, id: 'a', cid_descricao: 'Preenchida pelo banco', data_diagnostico: '2026-02-03', created_at: '2026-02-03T15:00:00+00:00' },
        { ...lombar, id: 'b', cid_descricao: 'Data de outro dia', data_diagnostico: '2019-03-04', created_at: '2026-02-03T15:00:00+00:00' },
        { ...lombar, id: 'c', cid_descricao: 'Criada depois do corte', data_diagnostico: '2026-11-20', created_at: '2026-11-20T15:00:00+00:00' },
        { ...lombar, id: 'd', cid_descricao: 'Sem data', data_diagnostico: null, created_at: '2026-02-03T15:00:00+00:00' },
      ],
    });
    abrir();
    await screen.findByText('Preenchida pelo banco');
    expect(screen.getAllByText(/Pode ter sido preenchida pelo sistema/)).toHaveLength(1);
    const comAviso = within(linhaDoDiagnostico('Preenchida pelo banco'));
    expect(comAviso.getByText(/Data do diagnóstico: 03\/02\/2026/)).toBeTruthy();
    expect(comAviso.getByText(/Pode ter sido preenchida pelo sistema/)).toBeTruthy();
    for (const sem of ['Data de outro dia', 'Criada depois do corte', 'Sem data']) {
      expect(within(linhaDoDiagnostico(sem)).queryByText(/Pode ter sido preenchida pelo sistema/), sem).toBeNull();
    }
    expect(within(linhaDoDiagnostico('Criada depois do corte')).getByText(/Data do diagnóstico: 20\/11\/2026/)).toBeTruthy();
  });

  it('o aviso respeita o dia do Brasil e o de UTC do cadastro (22:30 no Brasil já é o dia seguinte em UTC)', async () => {
    preparar({
      diagnosticos_paciente: [
        { ...lombar, id: 'a', cid_descricao: 'Dia do Brasil', data_diagnostico: '2026-02-03', created_at: '2026-02-04T01:30:00+00:00' },
        { ...lombar, id: 'b', cid_descricao: 'Dia de UTC', data_diagnostico: '2026-02-04', created_at: '2026-02-04T01:30:00+00:00' },
        { ...lombar, id: 'c', cid_descricao: 'Dia anterior', data_diagnostico: '2026-02-02', created_at: '2026-02-04T01:30:00+00:00' },
      ],
    });
    abrir();
    await screen.findByText('Dia do Brasil');
    expect(within(linhaDoDiagnostico('Dia do Brasil')).getByText(/Pode ter sido preenchida/)).toBeTruthy();
    expect(within(linhaDoDiagnostico('Dia de UTC')).getByText(/Pode ter sido preenchida/)).toBeTruthy();
    expect(within(linhaDoDiagnostico('Dia anterior')).queryByText(/Pode ter sido preenchida/)).toBeNull();
  });

  it('o valor do banco aparece como está, mesmo quando não é uma data no formato esperado', async () => {
    preparar({ diagnosticos_paciente: [{ ...lombar, data_diagnostico: 'infinity' }] });
    abrir();
    await screen.findByText('Dor lombar baixa');
    expect(within(linhaDoDiagnostico('Dor lombar baixa')).getByText(/Data do diagnóstico: infinity/)).toBeTruthy();
  });
});

describe('editar a data de um CID já cadastrado', () => {
  beforeEach(() => preparar({ diagnosticos_paciente: [lombar, cervical] }));

  it('informar a data de um CID sem data: UPDATE só nele (id e paciente), a lista e a linha do tempo são relidas', async () => {
    const qc = abrir();
    const campo = await abrirEdicaoDaData('Informar data do diagnóstico M54.2');
    expect(campo.value).toBe('');
    expect(campo.type).toBe('date');
    expect(campo.max).toBe(HOJE);
    expect(campo.className).toMatch(/\bh-11\b/);
    fireEvent.change(campo, { target: { value: '2024-05-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar data' }));
    await esperarInvalidada(qc);

    const escritas = escritasNaTabela();
    expect(escritas).toHaveLength(1);
    expect(escritas[0].tipo).toBe('update');
    expect(escritas[0].payload).toEqual({ data_diagnostico: '2024-05-10' });
    expect(escritas[0].filtros).toEqual(expect.arrayContaining([['eq', 'id', 'd2'], ['eq', 'paciente_id', 'pac-1']]));
    const [d1, d2] = h.falso.tabelas.diagnosticos_paciente;
    expect(d2.data_diagnostico).toBe('2024-05-10');
    expect(d1.data_diagnostico).toBe('2019-03-04');
    expect(d1.ativo).toBe(true);
    expect(h.toast.success).toHaveBeenCalledWith('Data do diagnóstico atualizada');
    expect(await screen.findByText(/Data do diagnóstico: 10\/05\/2024/)).toBeTruthy();
    expect(screen.queryByLabelText(/^Data do diagnóstico M54\./)).toBeNull();
  });

  it('o UPDATE não atinge o diagnóstico de outro paciente com o mesmo id', async () => {
    preparar({ diagnosticos_paciente: [lombar, { ...cervical, id: 'd1', paciente_id: 'pac-2', data_diagnostico: '2001-01-01' }] });
    const qc = abrir();
    const campo = await abrirEdicaoDaData('Corrigir data do diagnóstico M54.5');
    fireEvent.change(campo, { target: { value: '2024-05-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar data' }));
    await esperarInvalidada(qc);
    const [doPaciente, deOutro] = h.falso.tabelas.diagnosticos_paciente;
    expect(doPaciente.data_diagnostico).toBe('2024-05-10');
    expect(deOutro.data_diagnostico).toBe('2001-01-01');
  });

  it('corrigir a data de um CID com data: o campo abre com o valor que está no banco', async () => {
    const qc = abrir();
    const campo = await abrirEdicaoDaData('Corrigir data do diagnóstico M54.5');
    expect(campo.value).toBe('2019-03-04');
    fireEvent.change(campo, { target: { value: '2019-04-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar data' }));
    await esperarInvalidada(qc);
    expect(escritasNaTabela()[0].payload).toEqual({ data_diagnostico: '2019-04-01' });
    expect(h.falso.tabelas.diagnosticos_paciente[0].data_diagnostico).toBe('2019-04-01');
    expect(h.falso.tabelas.diagnosticos_paciente[1].data_diagnostico).toBeNull();
  });

  it('limpar a data grava null só nesse diagnóstico e a linha volta a "sem data"', async () => {
    const qc = abrir();
    await abrirEdicaoDaData('Corrigir data do diagnóstico M54.5');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar data' }));
    await esperarInvalidada(qc);
    const escritas = escritasNaTabela();
    expect(escritas).toHaveLength(1);
    expect(escritas[0].payload).toEqual({ data_diagnostico: null });
    expect(Object.keys(escritas[0].payload as object)).toEqual(['data_diagnostico']);
    expect(escritas[0].filtros).toEqual(expect.arrayContaining([['eq', 'id', 'd1'], ['eq', 'paciente_id', 'pac-1']]));
    expect(h.falso.tabelas.diagnosticos_paciente[0].data_diagnostico).toBeNull();
    expect(h.toast.success).toHaveBeenCalledWith('Data do diagnóstico atualizada');
    await waitFor(() => expect(within(linhaDoDiagnostico('Dor lombar baixa')).getByText(/Data do diagnóstico: sem data/)).toBeTruthy());
  });

  it('dois toques rápidos em "Limpar data" com a gravação em andamento: o botão fica desligado e só um UPDATE sai', async () => {
    let liberar: () => void = () => {};
    h.falso.antesDeEscrever(() => new Promise<void>((r) => { liberar = r; }));
    const qc = abrir();
    await abrirEdicaoDaData('Corrigir data do diagnóstico M54.5');
    const limpar = screen.getByRole('button', { name: 'Limpar data' }) as HTMLButtonElement;
    fireEvent.click(limpar);
    await waitFor(() => expect(limpar.disabled).toBe(true));
    fireEvent.click(limpar);
    await act(async () => { liberar(); });
    await esperarInvalidada(qc);
    expect(escritasNaTabela().filter((o) => o.tipo === 'update')).toHaveLength(1);
  });

  it('"Limpar data" só aparece onde há data para limpar', async () => {
    abrir();
    await abrirEdicaoDaData('Informar data do diagnóstico M54.2');
    expect(screen.queryByRole('button', { name: 'Limpar data' })).toBeNull();
  });

  it('"Salvar data" fica desligado com o campo vazio (para tirar a data existe o "Limpar data")', async () => {
    abrir();
    const campo = await abrirEdicaoDaData('Corrigir data do diagnóstico M54.5');
    fireEvent.change(campo, { target: { value: '' } });
    expect((screen.getByRole('button', { name: 'Salvar data' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(campo, { target: { value: '2019-04-01' } });
    expect((screen.getByRole('button', { name: 'Salvar data' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('os botões do editor têm alvo de 44 px', async () => {
    abrir();
    await abrirEdicaoDaData('Corrigir data do diagnóstico M54.5');
    for (const nome of ['Salvar data', 'Limpar data', 'Cancelar']) {
      expect(screen.getByRole('button', { name: nome }).className, nome).toMatch(/\bmin-h-11\b/);
    }
  });

  it('Cancelar fecha o editor sem gravar nem invalidar', async () => {
    const qc = abrir();
    const campo = await abrirEdicaoDaData('Corrigir data do diagnóstico M54.5');
    fireEvent.change(campo, { target: { value: '2019-04-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByLabelText(/^Data do diagnóstico M54\./)).toBeNull();
    expect(escritasNaTabela()).toEqual([]);
    await esperarSemInvalidar(qc);
  });

  it.each([
    ['amanhã', AMANHA],
    ['antes de 1900', '1899-12-31'],
  ])('data %s na edição é recusada: toast de erro, nada é gravado nem invalidado e o editor continua aberto', async (_nome, valor) => {
    const qc = abrir();
    const campo = await abrirEdicaoDaData('Corrigir data do diagnóstico M54.5');
    fireEvent.change(campo, { target: { value: valor } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar data' }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith(MENSAGEM_DE_DATA_INVALIDA));
    expect(escritasNaTabela()).toEqual([]);
    expect(h.falso.tabelas.diagnosticos_paciente[0].data_diagnostico).toBe('2019-03-04');
    await esperarSemInvalidar(qc);
    expect(screen.getByLabelText(/^Data do diagnóstico M54\./)).toBeTruthy();
  });

  it('erro do banco ao salvar a data: toast com a mensagem, nada é invalidado e a data antiga fica', async () => {
    h.falso.falharEscritaQuando((op) => op.tabela === 'diagnosticos_paciente', 'sem permissão');
    const qc = abrir();
    const campo = await abrirEdicaoDaData('Corrigir data do diagnóstico M54.5');
    fireEvent.change(campo, { target: { value: '2019-04-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar data' }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('sem permissão'));
    await esperarSemInvalidar(qc);
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(h.falso.tabelas.diagnosticos_paciente[0].data_diagnostico).toBe('2019-03-04');
    expect(screen.getByLabelText(/^Data do diagnóstico M54\./)).toBeTruthy();
  });

  it('erro do banco ao limpar a data: toast, nada é invalidado e a data fica', async () => {
    h.falso.falharEscritaQuando((op) => op.tabela === 'diagnosticos_paciente', 'sem permissão');
    const qc = abrir();
    await abrirEdicaoDaData('Corrigir data do diagnóstico M54.5');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar data' }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('sem permissão'));
    await esperarSemInvalidar(qc);
    expect(h.falso.tabelas.diagnosticos_paciente[0].data_diagnostico).toBe('2019-03-04');
  });

  it('informar a data de uma linha preenchida pelo banco tira o aviso quando a nova data não é o dia do cadastro', async () => {
    preparar({ diagnosticos_paciente: [{ ...lombar, data_diagnostico: '2026-02-03', created_at: '2026-02-03T15:00:00+00:00' }] });
    const qc = abrir();
    await screen.findByText(/Pode ter sido preenchida pelo sistema/);
    const campo = await abrirEdicaoDaData('Corrigir data do diagnóstico M54.5');
    fireEvent.change(campo, { target: { value: '2025-12-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar data' }));
    await esperarInvalidada(qc);
    await waitFor(() => expect(screen.queryByText(/Pode ter sido preenchida pelo sistema/)).toBeNull());
    expect(screen.getByText(/Data do diagnóstico: 10\/12\/2025/)).toBeTruthy();
  });
});

describe('remover continua como era (e invalida a linha do tempo)', () => {
  it('remover marca ativo = false só naquele diagnóstico', async () => {
    preparar({ diagnosticos_paciente: [lombar, cervical] });
    const qc = abrir();
    await screen.findByText('Dor lombar baixa');
    fireEvent.click(linhaDoDiagnostico('Dor lombar baixa').querySelector('svg.text-destructive')?.closest('button') as HTMLElement);
    await esperarInvalidada(qc);
    expect(h.falso.tabelas.diagnosticos_paciente.map((d) => d.ativo)).toEqual([false, true]);
  });
});
