import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';

const h = vi.hoisted(() => ({
  banco: null as unknown as BancoFalso,
  sucesso: vi.fn(),
  erro: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => h.banco.from(t) } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' } }) }));
vi.mock('sonner', () => ({ toast: { success: h.sucesso, error: h.erro } }));

import ControleCassi from '@/pages/ControleCassi';

// ── Cenário ────────────────────────────────────────────────────────────────────
// Hoje é 25/10/2026. Ana precisa de guia (falta 1 sessão), Bruno está sem guia, Carla tem guia folgada,
// Davi está encerrado, Elisa já teve o pedido feito e Fábio não é CASSI.
const base = { terapeuta_id: 'prof-1', ativo: true, plano_saude: 'CASSI', email: null, telefone: null, guias_por_mes: 1, cassi_pedir_guia: false, cassi_encerrado_em: null, guia_solicitada_em: null, cassi_diagnostico: null, cassi_confirmado_mes: null };
const pac = (id: string, nome: string, sobrenome: string, extra: Linha = {}): Linha => ({ ...base, id, nome, sobrenome, carteirinha: '', codigos_cassi: [], ...extra });
const guia = (id: string, paciente_id: string, nome: string, sobrenome: string, extra: Linha = {}): Linha => ({
  id, paciente_id, terapeuta_id: 'prof-1', matricula: null, numero_guia: null, data_pedido: '2026-10-01', data_resposta: '2026-10-03',
  sessoes_autorizadas: 10, sessoes_realizadas: 2, diagnostico: null, responsavel_tecnico: '', status: 'ativa', observacoes: null,
  codigos: [{ codigo: '012', sessoes: 10 }], created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
  pacientes: { nome, sobrenome }, ...extra,
});
const sessao = (paciente_id: string, dia: number, extra: Linha = {}, mes = 9): Linha => ({
  id: `ag-${paciente_id}-${mes}-${dia}-${Math.random()}`, terapeuta_id: 'prof-1', paciente_id, data_inicio: new Date(2026, mes, dia, 10).toISOString(),
  status: 'atendido', tipo_atendimento: 'sessao', guia_cassi_id: null, ...extra,
});

function cenario(): Record<string, Linha[]> {
  return {
    pacientes: [
      pac('p1', 'Ana', 'Souza', { carteirinha: '111', codigos_cassi: ['012', '185'] }),
      pac('p2', 'Bruno', 'Lima'),
      pac('p3', 'Carla', 'Dias', { carteirinha: '333', codigos_cassi: ['012'] }),
      pac('p4', 'Davi', 'Encerrado', { cassi_encerrado_em: '2026-09-01T00:00:00Z', carteirinha: '444' }),
      pac('p5', 'Elisa', 'Pedida', { carteirinha: '555', guia_solicitada_em: '2026-10-10T12:00:00Z' }),
      pac('p6', 'Fábio', 'Particular', { plano_saude: 'FUSEX' }),
    ],
    guias_cassi: [
      guia('g1', 'p1', 'Ana', 'Souza', { sessoes_realizadas: 9, codigos: [{ codigo: '012', sessoes: 10 }, { codigo: '185', sessoes: 10 }] }),
      guia('g3', 'p3', 'Carla', 'Dias', { enviada_financeiro_em: '2026-10-20' }),
      guia('g5', 'p5', 'Elisa', 'Pedida', { data_pedido: '2026-09-01', data_resposta: '2026-09-03', sessoes_realizadas: 10 }),
      guia('g6', 'p6', 'Fábio', 'Particular'),
    ],
    agendamentos: [
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((d) => sessao('p1', d, { guia_cassi_id: 'g1' })),
      sessao('p1', 9, { status: 'faltou', guia_cassi_id: 'g1' }),
      sessao('p1', 10, { tipo_atendimento: 'avaliacao', guia_cassi_id: 'g1' }),
      sessao('p1', 28, { status: 'confirmado', guia_cassi_id: 'g1' }), // ainda não aconteceu
      sessao('p2', 3), sessao('p2', 4),
      ...[5, 6, 7, 8].map((d) => sessao('p3', d, { guia_cassi_id: 'g3' })),
      // Fábio não é CASSI, mas tem sessões e guia: nada dele pode entrar na conta nem no botão "quem teve sessão".
      ...[1, 2, 3].map((d) => sessao('p6', d, { guia_cassi_id: 'g6' })),
      // Setembro: Ana atendida (sem guia ligada), para a tendência dos 6 meses.
      ...[10, 11, 12].map((d) => sessao('p1', d, {}, 8)),
    ],
    cassi_config: [{
      terapeuta_id: 'prof-1', imposto_por_guia: 0, imposto_percentual: 10, minha_parte_percentual: 50, responsaveis: [],
      nome_clinica: 'Clínica Teste', nome_profissional: 'Dr. Teste', cidade: 'Belém',
      codigos: [{ codigo: '144', descricao: 'Avaliação', valor: 100 }, { codigo: '012', descricao: 'Sessão', valor: 50 }, { codigo: '185', descricao: 'Eletro', valor: 30 }, { codigo: '160', descricao: 'Sessão 160', valor: 60 }],
    }],
    cassi_financeiro_clientes: [],
    relatorios_cassi: [],
  };
}

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><ControleCassi /></MemoryRouter>
    </QueryClientProvider>,
  );
}

const norm = (t: string | null | undefined) => (t || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const aba = (nome: RegExp) => screen.getByRole('button', { name: nome });
const abrirAba = (nome: RegExp) => fireEvent.click(aba(nome));
const escritasEm = (tabela: string) => h.banco.escritas().filter((o) => o.tabela === tabela);
const noPedido = (nome: string) => screen.queryByRole('button', { name: new RegExp(`^${nome}`), pressed: true });
const valorDoCartao = (rotulo: string) => norm(screen.getAllByText(rotulo)[0].previousElementSibling?.textContent);

async function irParaPedir() {
  await screen.findByText('Ana Souza');
  abrirAba(/^Pedir guias/);
  await screen.findByRole('heading', { name: 'Montar pedido' });
}
async function irParaFaturamento() {
  await screen.findByText('Ana Souza');
  abrirAba(/^Faturamento/);
  await screen.findByRole('heading', { name: 'Clientes de outubro de 2026' });
  // Espera a lista do mês e a agenda chegarem (o botão só mostra "(3)" depois da agenda).
  await screen.findByText(/Nenhum cliente na lista de outubro de 2026/);
  await screen.findByRole('button', { name: 'Adicionar quem teve sessão no mês (3)' });
}
async function buscarEEscolher(rotulo: string, digitado: string, nome: RegExp) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: digitado } });
  const resultados = await screen.findByRole('list', { name: 'Resultados da busca' });
  fireEvent.click(within(resultados).getByRole('button', { name: nome }));
}

beforeEach(() => {
  h.banco = criarBancoFalso(cenario());
  h.sucesso.mockClear(); h.erro.mockClear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 25, 15, 0, 0));
  Element.prototype.scrollIntoView = vi.fn();
  // Radix (menus suspensos) precisa disto, que o jsdom não tem: um PointerEvent que carrega button/ctrlKey.
  class EventoDePonteiro extends MouseEvent {
    pointerType: string; pointerId: number;
    constructor(tipo: string, init: PointerEventInit = {}) { super(tipo, init); this.pointerType = init.pointerType ?? 'mouse'; this.pointerId = init.pointerId ?? 1; }
  }
  Object.defineProperty(window, 'PointerEvent', { configurable: true, writable: true, value: EventoDePonteiro });
  Object.assign(Element.prototype, { hasPointerCapture: () => false, setPointerCapture: () => {}, releasePointerCapture: () => {} });
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window, 'open').mockReturnValue(null);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

// ── Aba "Este mês" fora, calculadora no lugar ─────────────────────────────────
describe('Controle CASSI sem a aba "Este mês"', () => {
  it('as abas são Clientes, Pedir guias, Faturamento e Planilha; abre em Clientes', async () => {
    montar();
    await screen.findByText('Ana Souza');
    const nomes = screen.getAllByRole('button').map((b) => norm(b.textContent));
    expect(nomes.some((n) => n === 'Este mês')).toBe(false);
    for (const esperado of [/^Clientes$/, /^Pedir guias/, /^Faturamento$/, /^Planilha$/]) expect(aba(esperado)).toBeTruthy();
    expect(screen.getByText('Todos os clientes CASSI — buscar, cadastrar e ver as guias.')).toBeTruthy();
  });

  it('nada na tela de Clientes fala de "Este mês"', async () => {
    montar();
    await screen.findByText('Ana Souza');
    expect(screen.queryByText(/Este mês/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Colocar em Este mês/ })).toBeNull();
    expect(screen.queryByText('no mês ✓')).toBeNull();
  });

  it('em Clientes, quem precisa de guia tem "Pedir guia" e quem não precisa tem "Ver guia"', async () => {
    montar();
    await screen.findByText('Ana Souza');
    expect(screen.getAllByRole('button', { name: 'Pedir guia' })).toHaveLength(2); // Ana (falta 1) e Bruno (sem guia)
    expect(screen.getAllByRole('button', { name: 'Ver guia' })).toHaveLength(1); // Carla
    expect(screen.getAllByRole('button', { name: 'Guia pedida — aguardando' })).toHaveLength(1); // Elisa: o pedido já foi feito
    expect(screen.getAllByRole('button', { name: 'Ativar cliente' })).toHaveLength(1); // Davi, encerrado
  });

  it('só aparecem clientes CASSI (Fábio, de outro plano, fica de fora)', async () => {
    montar();
    await screen.findByText('Ana Souza');
    expect(screen.queryByText(/Fábio/)).toBeNull();
  });

  it('a calculadora de dias úteis continua à mão: cartão em Clientes e botão do topo abre', async () => {
    montar();
    await screen.findByText('Ana Souza');
    const cartao = screen.getByRole('button', { name: /Calculadora de dias úteis Guia fora da lista/ });
    expect(cartao.getAttribute('aria-expanded')).toBe('false');
    abrirAba(/^Planilha$/);
    fireEvent.click(screen.getAllByRole('button', { name: 'Calculadora de dias úteis' })[0]);
    const aberto = await screen.findByRole('button', { name: /Calculadora de dias úteis Guia fora da lista/ });
    expect(aberto.getAttribute('aria-expanded')).toBe('true');
  });
});

// ── Pedir guias: a lista é do profissional ────────────────────────────────────
describe('Pedir guias', () => {
  it('começa vazia, mesmo com clientes precisando de guia; o sistema só sugere (recolhido)', async () => {
    montar();
    await irParaPedir();
    expect(screen.getByText(/Nenhum cliente no pedido/)).toBeTruthy();
    expect(noPedido('Ana Souza')).toBeNull();
    expect(screen.getByText('Sugeridos pelo sistema (2)')).toBeTruthy();
    expect(screen.queryByText('Bruno Lima')).toBeNull(); // recolhido
    expect(aba(/^Pedir guias/).textContent).toBe('Pedir guias'); // sem selo: nada na lista
    expect(escritasEm('pacientes')).toHaveLength(0);
  });

  it('procurar o cliente e adicionar: entra na lista, grava o marcador e o selo da aba conta', async () => {
    montar();
    await irParaPedir();
    await buscarEEscolher('Adicionar cliente ao pedido', 'carla', /Carla Dias/);
    await waitFor(() => expect(noPedido('Carla Dias')).toBeTruthy());
    const gravacao = escritasEm('pacientes')[0];
    expect(gravacao.payload).toEqual({ cassi_pedir_guia: true, cassi_encerrado_em: null, cassi_encerrado_motivo: null });
    expect(gravacao.filtros).toEqual([['in', 'id', ['p3']]]);
    expect(aba(/^Pedir guias/).textContent).toBe('Pedir guias1');
    expect(h.banco.tabelas.pacientes.find((p) => p.id === 'p3')?.cassi_pedir_guia).toBe(true);
    // Vem do cadastro: carteirinha e códigos.
    expect((screen.getByLabelText('Carteirinha de Carla Dias') as HTMLInputElement).value).toBe('333');
    expect(screen.getByRole('button', { name: 'Código 012 de Carla Dias' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('a busca também traz cliente encerrado e adicionar reativa', async () => {
    montar();
    await irParaPedir();
    await buscarEEscolher('Adicionar cliente ao pedido', 'davi', /Davi Encerrado/);
    await waitFor(() => expect(noPedido('Davi Encerrado')).toBeTruthy());
    expect(h.banco.tabelas.pacientes.find((p) => p.id === 'p4')?.cassi_encerrado_em).toBeNull();
  });

  it('quem já teve o pedido feito não aparece na busca', async () => {
    montar();
    await irParaPedir();
    fireEvent.change(screen.getByLabelText('Adicionar cliente ao pedido'), { target: { value: 'elisa' } });
    expect(await screen.findByText(/Nenhum cliente encontrado/)).toBeTruthy();
  });

  it('adicionar um sugerido o coloca na lista e tira da sugestão', async () => {
    montar();
    await irParaPedir();
    fireEvent.click(screen.getByRole('button', { name: /Sugeridos pelo sistema/ }));
    expect(screen.getByText('Sem guia')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Ana Souza ao pedido' }));
    await waitFor(() => expect(noPedido('Ana Souza')).toBeTruthy());
    expect(screen.getByText('Sugeridos pelo sistema (1)')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Adicionar Ana Souza ao pedido' })).toBeNull();
  });

  it('"adicionar todos" grava numa só chamada e a sugestão some', async () => {
    montar();
    await irParaPedir();
    fireEvent.click(screen.getByRole('button', { name: /Sugeridos pelo sistema/ }));
    fireEvent.click(screen.getByRole('button', { name: /Adicionar todos os 2 ao pedido/ }));
    await waitFor(() => expect(noPedido('Bruno Lima')).toBeTruthy());
    expect(noPedido('Ana Souza')).toBeTruthy();
    expect(escritasEm('pacientes')).toHaveLength(1);
    expect(escritasEm('pacientes')[0].filtros).toEqual([['in', 'id', ['p1', 'p2']]]);
    expect(screen.queryByText(/Sugeridos pelo sistema/)).toBeNull();
    expect(aba(/^Pedir guias/).textContent).toBe('Pedir guias2');
  });

  it('retirar da lista grava o marcador falso e o cliente volta a ser só uma sugestão', async () => {
    montar();
    await irParaPedir();
    await buscarEEscolher('Adicionar cliente ao pedido', 'ana', /Ana Souza/);
    await waitFor(() => expect(noPedido('Ana Souza')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Retirar Ana Souza da lista' }));
    await waitFor(() => expect(noPedido('Ana Souza')).toBeNull());
    const ultima = escritasEm('pacientes').at(-1)!;
    expect(ultima.payload).toEqual({ cassi_pedir_guia: false });
    expect(ultima.filtros).toEqual([['in', 'id', ['p1']]]);
    expect(screen.getByText('Sugeridos pelo sistema (2)')).toBeTruthy();
  });

  it('a lista não se perde: ao voltar de outra aba, quem foi adicionado continua lá', async () => {
    montar();
    await irParaPedir();
    await buscarEEscolher('Adicionar cliente ao pedido', 'carla', /Carla Dias/);
    await waitFor(() => expect(noPedido('Carla Dias')).toBeTruthy());
    abrirAba(/^Planilha$/);
    abrirAba(/^Pedir guias/);
    expect(await screen.findByRole('button', { name: /^Carla Dias/, pressed: true })).toBeTruthy();
  });

  it('se o banco recusar, a lista volta como estava e o erro aparece', async () => {
    montar();
    await irParaPedir();
    h.banco.falharEscritaQuando((op) => op.tabela === 'pacientes', 'sem permissão');
    await buscarEEscolher('Adicionar cliente ao pedido', 'carla', /Carla Dias/);
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('Erro: sem permissão'));
    expect(noPedido('Carla Dias')).toBeNull();
    expect(h.banco.tabelas.pacientes.find((p) => p.id === 'p3')?.cassi_pedir_guia).toBe(false);
  });

  describe('a mensagem do pedido', () => {
    async function listaComAnaEBruno() {
      montar();
      await irParaPedir();
      fireEvent.click(screen.getByRole('button', { name: /Sugeridos pelo sistema/ }));
      fireEvent.click(screen.getByRole('button', { name: /Adicionar todos os 2 ao pedido/ }));
      await waitFor(() => expect(noPedido('Bruno Lima')).toBeTruthy());
    }

    it('cliente sem carteirinha trava a baixa até preencher; a mensagem leva o que está na tela', async () => {
      await listaComAnaEBruno();
      expect(screen.getByText('1 sem carteirinha — preencha antes de dar baixa.')).toBeTruthy();
      expect((screen.getByRole('button', { name: /Dar baixa \(2\)/ }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.change(screen.getByLabelText('Carteirinha de Bruno Lima'), { target: { value: '222' } });
      fireEvent.change(screen.getByLabelText('Diagnóstico de Bruno Lima'), { target: { value: 'Lombalgia' } });
      fireEvent.click(screen.getByRole('button', { name: 'Código 185 de Bruno Lima' }));
      expect((screen.getByRole('button', { name: /Dar baixa \(2\)/ }) as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(screen.getByText('ver a mensagem que vai no WhatsApp'));
      const texto = (screen.getByLabelText('Mensagem do pedido') as HTMLTextAreaElement).value;
      expect(texto).toBe(
        '*Solicitação de novas guias CASSI* (2 clientes)\n\n'
        + '1. *Ana Souza*\nCarteirinha: 111\nCódigos: 012, 185\nDiagnóstico: —\n'
        + '2. *Bruno Lima*\nCarteirinha: 222\nCódigos: 185\nDiagnóstico: Lombalgia',
      );
    });

    it('desmarcar um cliente o tira da mensagem sem tirar da lista', async () => {
      await listaComAnaEBruno();
      fireEvent.change(screen.getByLabelText('Carteirinha de Bruno Lima'), { target: { value: '222' } });
      fireEvent.click(screen.getByRole('button', { name: /^Ana Souza/ }));
      fireEvent.click(screen.getByText('ver a mensagem que vai no WhatsApp'));
      const texto = (screen.getByLabelText('Mensagem do pedido') as HTMLTextAreaElement).value;
      expect(texto).toContain('(1 cliente)');
      expect(texto).not.toContain('Ana Souza');
      expect(screen.getByRole('button', { name: /^Ana Souza/, pressed: false })).toBeTruthy();
    });

    it('copiar e WhatsApp usam o texto pronto', async () => {
      await listaComAnaEBruno();
      fireEvent.change(screen.getByLabelText('Carteirinha de Bruno Lima'), { target: { value: '222' } });
      fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
      await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
      const texto = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
      expect(texto).toMatch(/^\*Solicitação de novas guias CASSI\* \(2 clientes\)/);
      fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
      expect(window.open).toHaveBeenCalledWith(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
    });

    it('no máximo 3 códigos por cliente: o quarto é recusado com aviso', async () => {
      montar();
      await irParaPedir();
      await buscarEEscolher('Adicionar cliente ao pedido', 'ana', /Ana Souza/);
      await waitFor(() => expect(noPedido('Ana Souza')).toBeTruthy());
      const cod = (c: string) => screen.getByRole('button', { name: `Código ${c} de Ana Souza` });
      // Ana já tem 012 e 185; o terceiro entra, o quarto não.
      fireEvent.click(cod('144'));
      expect(cod('144').getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(cod('160'));
      expect(cod('160').getAttribute('aria-pressed')).toBe('false');
      expect(h.erro).toHaveBeenCalledWith('Máximo de 3 códigos por pedido');
      // Tirar um abre espaço para outro.
      fireEvent.click(cod('185'));
      fireEvent.click(cod('160'));
      expect(cod('160').getAttribute('aria-pressed')).toBe('true');
    });
  });

  it('dar baixa grava os dados do pedido, marca como pedido e passa o cliente para "aguardando CASSI"', async () => {
    montar();
    await irParaPedir();
    await buscarEEscolher('Adicionar cliente ao pedido', 'ana', /Ana Souza/);
    await waitFor(() => expect(noPedido('Ana Souza')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /Dar baixa \(1\)/ }));
    await waitFor(() => expect(screen.getByText('Guias pedidas — aguardando CASSI (2)')).toBeTruthy());
    expect(noPedido('Ana Souza')).toBeNull();
    const dados = escritasEm('pacientes').find((o) => (o.payload as Linha).codigos_cassi);
    expect(dados?.payload).toEqual({ codigos_cassi: ['012', '185'], carteirinha: '111' });
    const baixa = escritasEm('pacientes').at(-1)!;
    expect(baixa.payload).toMatchObject({ cassi_pedir_guia: false });
    expect((baixa.payload as Linha).guia_solicitada_em).toBe(new Date(2026, 9, 25, 15, 0, 0).toISOString());
  });

  it('quem já teve o pedido feito não volta para a lista: o card leva à aba, onde ele aparece em "aguardando CASSI"', async () => {
    montar();
    await screen.findByText('Ana Souza');
    fireEvent.click(screen.getByRole('button', { name: 'Guia pedida — aguardando' }));
    await screen.findByRole('heading', { name: 'Montar pedido' });
    expect(screen.getByText('Guias pedidas — aguardando CASSI (1)')).toBeTruthy();
    expect(noPedido('Elisa Pedida')).toBeNull();
    expect(escritasEm('pacientes')).toHaveLength(0); // não marcou ninguém
  });

  it('"Pedir guia" no card do cliente coloca o cliente na lista e abre a aba', async () => {
    montar();
    await screen.findByText('Ana Souza');
    fireEvent.click(screen.getAllByRole('button', { name: 'Pedir guia' })[0]); // Ana vem primeiro (ordem alfabética)
    await screen.findByRole('heading', { name: 'Montar pedido' });
    await waitFor(() => expect(noPedido('Ana Souza')).toBeTruthy());
    expect(h.banco.tabelas.pacientes.find((p) => p.id === 'p1')?.cassi_pedir_guia).toBe(true);
  });
});

// ── Faturamento: lista de clientes do mês ─────────────────────────────────────
describe('Faturamento com a lista de clientes do mês', () => {
  it('sem ninguém na lista não há cálculo: a lista explica o que fazer e oferece quem teve sessão', async () => {
    montar();
    await irParaFaturamento();
    expect(screen.getByText(/Nenhum cliente na lista de outubro de 2026/)).toBeTruthy();
    expect(screen.queryByText('Líquido')).toBeNull();
    expect(screen.getByRole('button', { name: 'Adicionar quem teve sessão no mês (3)' })).toBeTruthy();
    expect(screen.queryByText('Guias a enviar')).toBeNull();
  });

  it('adicionar Ana pela busca grava a linha do mês e a conta passa a ser só dela', async () => {
    montar();
    await irParaFaturamento();
    await buscarEEscolher('Adicionar cliente à lista do mês', 'ana', /Ana Souza/);
    await waitFor(() => expect(valorDoCartao('Bruto')).toBe('R$ 640,00'));
    const gravacao = escritasEm('cassi_financeiro_clientes')[0];
    expect(gravacao.tipo).toBe('upsert');
    expect(gravacao.payload).toEqual([{ terapeuta_id: 'prof-1', mes: '2026-10', paciente_id: 'p1' }]);
    expect(gravacao.opcoes).toEqual({ onConflict: 'terapeuta_id,mes,paciente_id', ignoreDuplicates: true });
    expect(valorDoCartao('Sessões')).toBe('8'); // 8 atendidas; falta, avaliação e sessão futura ficam de fora
    expect(valorDoCartao('Imposto (10%)')).toBe('− R$ 64,00');
    expect(valorDoCartao('Líquido')).toBe('R$ 576,00');
    expect(valorDoCartao('Sua parte · 50%')).toBe('R$ 288,00');
    expect(screen.getByText('8 sessões')).toBeTruthy();
  });

  it('"adicionar quem teve sessão" coloca os 3 com sessão e a conta soma os três', async () => {
    montar();
    await irParaFaturamento();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar quem teve sessão no mês (3)' }));
    await waitFor(() => expect(valorDoCartao('Bruto')).toBe('R$ 940,00'));
    expect(escritasEm('cassi_financeiro_clientes')[0].payload).toEqual(
      ['p1', 'p2', 'p3'].map((id) => ({ terapeuta_id: 'prof-1', mes: '2026-10', paciente_id: id })),
    );
    expect(valorDoCartao('Sessões')).toBe('14');
    expect(valorDoCartao('Líquido')).toBe('R$ 846,00');
    expect(screen.getByText('3 na lista')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Adicionar quem teve sessão no mês' }).hasAttribute('disabled')).toBe(true);
  });

  it('tirar um cliente da lista tira da conta; limpar esvazia o mês', async () => {
    montar();
    await irParaFaturamento();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar quem teve sessão no mês (3)' }));
    await waitFor(() => expect(valorDoCartao('Bruto')).toBe('R$ 940,00'));
    fireEvent.click(screen.getByRole('button', { name: 'Tirar Carla Dias da lista' }));
    await waitFor(() => expect(valorDoCartao('Bruto')).toBe('R$ 740,00'));
    const retirada = escritasEm('cassi_financeiro_clientes').at(-1)!;
    expect(retirada.tipo).toBe('delete');
    expect(retirada.filtros).toEqual([['eq', 'terapeuta_id', 'prof-1'], ['eq', 'mes', '2026-10'], ['eq', 'paciente_id', 'p3']]);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar lista' }));
    await waitFor(() => expect(screen.getByText(/Nenhum cliente na lista de outubro de 2026/)).toBeTruthy());
    expect(window.confirm).toHaveBeenCalled();
    expect(escritasEm('cassi_financeiro_clientes').at(-1)!.filtros).toEqual([['eq', 'terapeuta_id', 'prof-1'], ['eq', 'mes', '2026-10']]);
  });

  it('cada mês tem a sua lista: setembro começa vazio e outubro continua com a dele', async () => {
    montar();
    await irParaFaturamento();
    await buscarEEscolher('Adicionar cliente à lista do mês', 'ana', /Ana Souza/);
    await waitFor(() => expect(valorDoCartao('Bruto')).toBe('R$ 640,00'));
    fireEvent.click(screen.getByTitle('Mês anterior'));
    await screen.findByRole('heading', { name: 'Clientes de setembro de 2026' });
    expect(screen.getByText('0 na lista')).toBeTruthy();
    expect(await screen.findByText(/Nenhum cliente na lista de setembro de 2026/)).toBeTruthy();
    fireEvent.click(screen.getByTitle('Próximo mês'));
    await screen.findByRole('heading', { name: 'Clientes de outubro de 2026' });
    await waitFor(() => expect(valorDoCartao('Bruto')).toBe('R$ 640,00'));
  });

  it('cliente na lista sem sessão atendida aparece avisado e não entra na conta', async () => {
    montar();
    await irParaFaturamento();
    await buscarEEscolher('Adicionar cliente à lista do mês', 'elisa', /Elisa Pedida/);
    await screen.findByText('sem sessão atendida');
    expect(screen.getByText(/Nenhuma sessão concluída na agenda neste mês/)).toBeTruthy();
    expect(valorDoCartao('Bruto')).toBe('R$ 0,00');
  });

  it('as guias que fecham no mês são só dos clientes da lista; as enviadas ao financeiro são rastreio e aparecem sempre', async () => {
    montar();
    await irParaFaturamento();
    // Lista vazia: o rastreio das guias já enviadas continua à vista (a de Carla foi enviada em outubro).
    expect(screen.getByText('Guias enviadas ao financeiro')).toBeTruthy();
    expect(screen.getByText('1 em outubro')).toBeTruthy();
    expect(screen.queryByText('Guias a enviar')).toBeNull();
    await buscarEEscolher('Adicionar cliente à lista do mês', 'ana', /Ana Souza/);
    await screen.findByText('Guias a enviar');
    expect(norm(screen.getByText('Guias a enviar').previousElementSibling?.textContent)).toBe('1'); // só a de Ana (a de Carla fecha em outubro mas ela não está na lista)
    expect(screen.getByText('1 em outubro')).toBeTruthy(); // Carla não está na lista e a guia dela continua no rastreio
    await buscarEEscolher('Adicionar cliente à lista do mês', 'carla', /Carla Dias/);
    await waitFor(() => expect(norm(screen.getByText('Guias a enviar').previousElementSibling?.textContent)).toBe('2'));
    expect(screen.getByText('1 em outubro')).toBeTruthy();
  });

  it('o relatório de produção seleciona sozinho só as guias dos clientes da lista', async () => {
    montar();
    await irParaFaturamento();
    await buscarEEscolher('Adicionar cliente à lista do mês', 'ana', /Ana Souza/);
    await waitFor(() => expect(valorDoCartao('Bruto')).toBe('R$ 640,00'));
    fireEvent.click(screen.getByRole('button', { name: /Relatório/ }));
    const dialogo = await screen.findByRole('dialog');
    const ana = await within(dialogo).findByRole('checkbox', { name: /Ana Souza/ });
    await waitFor(() => expect((ana as HTMLInputElement).checked).toBe(true));
    expect((within(dialogo).getByRole('checkbox', { name: /Carla Dias/ }) as HTMLInputElement).checked).toBe(false);
  });

  it('o relatório avisa quando o mês não tem lista', async () => {
    montar();
    await irParaFaturamento();
    fireEvent.click(screen.getByRole('button', { name: /Relatório/ }));
    const dialogo = await screen.findByRole('dialog');
    expect(await within(dialogo).findByText(/Não há clientes na lista de outubro 2026/)).toBeTruthy();
  });

  it('erro ao carregar a lista não vira "lista vazia": avisa', async () => {
    montar();
    await screen.findByText('Ana Souza');
    const original = h.banco.from;
    h.banco.from = ((tabela: string) => {
      if (tabela === 'cassi_financeiro_clientes') {
        const q: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'gte', 'lte']) q[m] = () => q;
        q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'tabela inexistente' } }).then(res);
        return q;
      }
      return original(tabela);
    }) as typeof h.banco.from;
    abrirAba(/^Faturamento/);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Não consegui carregar a lista deste mês/)).toBeTruthy();
    expect(screen.queryByText(/Nenhum cliente na lista de outubro de 2026/)).toBeNull();
  });
});


// ── Pontos levantados na revisão independente ─────────────────────────────────
const abrirMenuDe = async (nome: string) => {
  const card = screen.getByText(nome).closest('div.rounded-xl') as HTMLElement;
  fireEvent.pointerDown(within(card).getByTitle('Mais ações'), { button: 0, ctrlKey: false, pointerType: 'mouse' });
  await screen.findByRole('menu');
};

describe('revisão: pedido', () => {
  it('"desfazer" um pedido devolve o cliente à lista (inverso exato do Dar baixa)', async () => {
    montar();
    await irParaPedir();
    fireEvent.click(await screen.findByRole('button', { name: 'desfazer' }));
    await waitFor(() => expect(noPedido('Elisa Pedida')).toBeTruthy());
    const w = escritasEm('pacientes').at(-1)!;
    expect(w.payload).toEqual({ guia_solicitada_em: null, cassi_pedir_guia: true });
    expect(w.filtros).toEqual([['eq', 'id', 'p5']]);
    expect(screen.queryByText(/Guias pedidas — aguardando CASSI/)).toBeNull();
  });

  it('duas adições seguidas: se a primeira falha depois de a segunda gravar, só a primeira some da tela', async () => {
    montar();
    await irParaPedir();
    let liberarCarla: () => void = () => {};
    const segurada = new Promise<void>((ok) => { liberarCarla = ok; });
    h.banco.falharEscritaQuando((op) => (op.filtros[0]?.[2] as string[] | undefined)?.[0] === 'p3', 'rede caiu');
    h.banco.antesDeEscrever(async (op) => { if ((op.filtros[0]?.[2] as string[] | undefined)?.[0] === 'p3') await segurada; });
    await buscarEEscolher('Adicionar cliente ao pedido', 'carla', /Carla Dias/);
    await waitFor(() => expect(noPedido('Carla Dias')).toBeTruthy()); // otimista
    await buscarEEscolher('Adicionar cliente ao pedido', 'bruno', /Bruno Lima/);
    await waitFor(() => expect(h.banco.tabelas.pacientes.find((x) => x.id === 'p2')?.cassi_pedir_guia).toBe(true));
    liberarCarla();
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('Erro: rede caiu'));
    await waitFor(() => expect(noPedido('Carla Dias')).toBeNull());
    expect(noPedido('Bruno Lima')).toBeTruthy(); // já estava gravado: não pode sumir
    expect(h.banco.tabelas.pacientes.find((x) => x.id === 'p3')?.cassi_pedir_guia).toBe(false);
  });

  it('"Pedir guia" de cliente encerrado pede confirmação; recusando, nada é gravado e a tela não muda', async () => {
    montar();
    await screen.findByText('Davi Encerrado');
    vi.mocked(window.confirm).mockReturnValue(false);
    await abrirMenuDe('Davi Encerrado');
    fireEvent.click(screen.getByRole('menuitem', { name: /Pedir guia/ }));
    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(vi.mocked(window.confirm).mock.calls[0][0]).toMatch(/Davi Encerrado está encerrado no CASSI/);
    expect(escritasEm('pacientes')).toHaveLength(0);
    expect(screen.queryByRole('heading', { name: 'Montar pedido' })).toBeNull();
  });

  it('confirmando, o cliente encerrado é reativado (motivo limpo também) e entra no pedido', async () => {
    montar();
    await screen.findByText('Davi Encerrado');
    await abrirMenuDe('Davi Encerrado');
    fireEvent.click(screen.getByRole('menuitem', { name: /Pedir guia/ }));
    await screen.findByRole('heading', { name: 'Montar pedido' });
    expect(escritasEm('pacientes')[0].payload).toEqual({ cassi_pedir_guia: true, cassi_encerrado_em: null, cassi_encerrado_motivo: null });
    await waitFor(() => expect(noPedido('Davi Encerrado')).toBeTruthy());
  });

  it('"Pedir guia" do card com o banco recusando: o cliente não entra e a aba não muda', async () => {
    montar();
    await screen.findByText('Ana Souza');
    h.banco.falharEscritaQuando((op) => op.tabela === 'pacientes', 'sem permissão');
    fireEvent.click(screen.getAllByRole('button', { name: 'Pedir guia' })[0]);
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('Erro: sem permissão'));
    expect(screen.queryByRole('heading', { name: 'Montar pedido' })).toBeNull();
    expect(h.banco.tabelas.pacientes.find((x) => x.id === 'p1')?.cassi_pedir_guia).toBe(false);
  });

  it('dar baixa só nos selecionados: o desmarcado continua na lista', async () => {
    montar();
    await irParaPedir();
    await buscarEEscolher('Adicionar cliente ao pedido', 'ana', /Ana Souza/);
    await waitFor(() => expect(noPedido('Ana Souza')).toBeTruthy());
    await buscarEEscolher('Adicionar cliente ao pedido', 'carla', /Carla Dias/);
    await waitFor(() => expect(noPedido('Carla Dias')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /^Carla Dias/ })); // desmarca Carla
    fireEvent.click(screen.getByRole('button', { name: /Dar baixa \(1\)/ }));
    await waitFor(() => expect(screen.getByText('Guias pedidas — aguardando CASSI (2)')).toBeTruthy());
    const baixa = escritasEm('pacientes').at(-1)!;
    expect(baixa.filtros).toEqual([['in', 'id', ['p1']]]);
    expect(screen.getByRole('button', { name: /^Carla Dias/, pressed: false })).toBeTruthy();
    expect(h.banco.tabelas.pacientes.find((x) => x.id === 'p3')?.cassi_pedir_guia).toBe(true);
  });

  it('se não conseguir salvar os dados do pedido, não dá baixa e avisa', async () => {
    montar();
    await irParaPedir();
    await buscarEEscolher('Adicionar cliente ao pedido', 'ana', /Ana Souza/);
    await waitFor(() => expect(noPedido('Ana Souza')).toBeTruthy());
    h.banco.falharEscritaQuando((op) => !!(op.payload as Linha)?.codigos_cassi, 'coluna inexistente');
    fireEvent.click(screen.getByRole('button', { name: /Dar baixa \(1\)/ }));
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('Não consegui salvar os dados: coluna inexistente'));
    expect(escritasEm('pacientes').some((o) => (o.payload as Linha)?.guia_solicitada_em)).toBe(false);
    expect(noPedido('Ana Souza')).toBeTruthy();
  });

  it('o que foi editado na tela some junto com o cliente: se ele voltar, volta com os dados do cadastro', async () => {
    montar();
    await irParaPedir();
    await buscarEEscolher('Adicionar cliente ao pedido', 'ana', /Ana Souza/);
    await waitFor(() => expect(noPedido('Ana Souza')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Carteirinha de Ana Souza'), { target: { value: '999' } });
    fireEvent.click(screen.getByRole('button', { name: /^Ana Souza/ })); // desmarca
    fireEvent.click(screen.getByRole('button', { name: 'Retirar Ana Souza da lista' }));
    await waitFor(() => expect(noPedido('Ana Souza')).toBeNull());
    await buscarEEscolher('Adicionar cliente ao pedido', 'ana', /Ana Souza/);
    await waitFor(() => expect(noPedido('Ana Souza')).toBeTruthy()); // marcada de novo
    expect((screen.getByLabelText('Carteirinha de Ana Souza') as HTMLInputElement).value).toBe('111');
  });

  it('registrar a guia nova à mão tira o cliente da lista do pedido (a guia chegou)', async () => {
    montar();
    await irParaPedir();
    await buscarEEscolher('Adicionar cliente ao pedido', 'ana', /Ana Souza/);
    await waitFor(() => expect(noPedido('Ana Souza')).toBeTruthy());
    fireEvent.click(screen.getByText('registrar manual'));
    fireEvent.click(await screen.findByRole('button', { name: /^Salvar$/ }));
    await waitFor(() => expect(h.sucesso).toHaveBeenCalledWith('Guia criada'));
    await waitFor(() => expect(noPedido('Ana Souza')).toBeNull());
    expect(h.banco.tabelas.pacientes.find((x) => x.id === 'p1')?.cassi_pedir_guia).toBe(false);
  });
});

describe('revisão: aba Clientes', () => {
  it('o card usa a contagem real (a maior entre a salva e a da agenda), como as sugestões', async () => {
    montar();
    await screen.findByText('Carla Dias');
    const card = screen.getByText('Carla Dias').closest('div.rounded-xl') as HTMLElement;
    // Carla: 2 salvas na guia, 4 sessões atendidas ligadas a ela na agenda → 4/10, sem pedir ainda.
    expect(norm(card.textContent)).toContain('Guia vigente 4/10');
    expect(within(card).getByRole('button', { name: 'Ver guia' })).toBeTruthy();
  });

  it('quem precisa de guia continua com "Ver guia" no menu ⋮ (o passo físico da guia mora lá)', async () => {
    montar();
    await screen.findByText('Ana Souza');
    await abrirMenuDe('Ana Souza');
    expect(screen.getByRole('menuitem', { name: /Pedir guia/ })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /Ver guia/ })).toBeTruthy();
  });

  it('guia esgotada e não assinada avisa o que falta fazer, e o aviso abre a guia', async () => {
    montar();
    await screen.findByText('Elisa Pedida');
    const card = screen.getByText('Elisa Pedida').closest('div.rounded-xl') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: /Falta: assinar e recolher/ }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});

describe('revisão: Faturamento', () => {
  it('cliente fora do CASSI com sessões e guia (Fábio) nunca entra: nem no botão, nem na conta, nem nas guias', async () => {
    montar();
    await irParaFaturamento(); // o botão já exige "(3)": Fábio tem 3 sessões e não conta
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar quem teve sessão no mês (3)' }));
    await waitFor(() => expect(valorDoCartao('Bruto')).toBe('R$ 940,00'));
    const ids = (escritasEm('cassi_financeiro_clientes')[0].payload as Linha[]).map((r) => r.paciente_id);
    expect(ids).toEqual(['p1', 'p2', 'p3']);
    expect(norm(screen.getByText('Guias a enviar').previousElementSibling?.textContent)).toBe('2'); // Ana e Carla; Bruno não tem guia
  });

  it('linha velha na lista (cliente que saiu do CASSI) não entra na conta, nas guias nem no relatório', async () => {
    h.banco.tabelas.cassi_financeiro_clientes.push(
      { id: 'v1', terapeuta_id: 'prof-1', mes: '2026-10', paciente_id: 'p1' },
      { id: 'v2', terapeuta_id: 'prof-1', mes: '2026-10', paciente_id: 'p6' }, // Fábio, FUSEX
    );
    montar();
    await screen.findByText('Ana Souza');
    abrirAba(/^Faturamento/);
    await waitFor(() => expect(valorDoCartao('Bruto')).toBe('R$ 640,00'));
    expect(screen.getByText('1 na lista')).toBeTruthy();
    expect(norm(screen.getByText('Guias a enviar').previousElementSibling?.textContent)).toBe('1');
    fireEvent.click(screen.getByRole('button', { name: /Relatório/ }));
    const dialogo = await screen.findByRole('dialog');
    const ana = await within(dialogo).findByRole('checkbox', { name: /Ana Souza/ });
    await waitFor(() => expect((ana as HTMLInputElement).checked).toBe(true));
    expect((within(dialogo).getByRole('checkbox', { name: /Fábio Particular/ }) as HTMLInputElement).checked).toBe(false);
  });

  it('cada mês grava e calcula com a sua lista: a tendência mostra setembro só depois de Ana entrar na lista de setembro', async () => {
    montar();
    await irParaFaturamento();
    await buscarEEscolher('Adicionar cliente à lista do mês', 'ana', /Ana Souza/);
    await waitFor(() => expect(valorDoCartao('Bruto')).toBe('R$ 640,00'));
    const tendencia = () => norm(screen.getByText(/Sua parte · últimos 6 meses/).closest('div.rounded-xl')?.textContent);
    await waitFor(() => expect(tendencia()).toContain('288')); // outubro: R$ 576,00 líquidos de Ana × 50%
    expect(tendencia()).not.toContain('108'); // setembro ainda sem lista: aparece como —
    fireEvent.click(screen.getByTitle('Mês anterior'));
    await screen.findByRole('heading', { name: 'Clientes de setembro de 2026' });
    await buscarEEscolher('Adicionar cliente à lista do mês', 'ana', /Ana Souza/);
    await waitFor(() => expect(escritasEm('cassi_financeiro_clientes').map((o) => (o.payload as Linha[])[0].mes)).toEqual(['2026-10', '2026-09']));
    await waitFor(() => expect(valorDoCartao('Bruto')).toBe('R$ 240,00')); // 3 sessões de setembro × (012 + 185)
    await waitFor(() => expect(tendencia()).toContain('108')); // setembro: 3 sessões → R$ 216,00 líquidos × 50%
    expect(tendencia()).not.toContain('288'); // a janela termina em setembro: outubro ainda não entra
    fireEvent.click(screen.getByTitle('Próximo mês'));
    await screen.findByRole('heading', { name: 'Clientes de outubro de 2026' });
    await waitFor(() => { expect(tendencia()).toContain('108'); expect(tendencia()).toContain('288'); }); // as duas listas, cada uma no seu mês
  });

  it('o relatório de outro mês usa a lista DESSE mês: em setembro (sem lista) nada vem marcado e avisa', async () => {
    montar();
    await irParaFaturamento();
    await buscarEEscolher('Adicionar cliente à lista do mês', 'ana', /Ana Souza/);
    await waitFor(() => expect(valorDoCartao('Bruto')).toBe('R$ 640,00'));
    fireEvent.click(screen.getByRole('button', { name: /Relatório/ }));
    const dialogo = await screen.findByRole('dialog');
    await waitFor(() => expect((within(dialogo).getByRole('checkbox', { name: /Ana Souza/ }) as HTMLInputElement).checked).toBe(true));
    fireEvent.change(within(dialogo).getByDisplayValue('2026-10'), { target: { value: '2026-09' } });
    expect(await within(dialogo).findByText(/Não há clientes na lista de setembro 2026/)).toBeTruthy();
    await waitFor(() => expect((within(dialogo).getByRole('checkbox', { name: /Elisa Pedida/ }) as HTMLInputElement).checked).toBe(false));
    expect((within(dialogo).getByRole('checkbox', { name: /Ana Souza/ }) as HTMLInputElement).checked).toBe(false);
  });

  it('"Limpar lista": cancelar na confirmação não apaga nada', async () => {
    montar();
    await irParaFaturamento();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar quem teve sessão no mês (3)' }));
    await waitFor(() => expect(screen.getByText('3 na lista')).toBeTruthy());
    vi.mocked(window.confirm).mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Limpar lista' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(escritasEm('cassi_financeiro_clientes').some((o) => o.tipo === 'delete')).toBe(false);
    expect(screen.getByText('3 na lista')).toBeTruthy();
  });

  it('com a lista em erro há "Tentar de novo"; ao dar certo a lista aparece', async () => {
    montar();
    await screen.findByText('Ana Souza');
    const original = h.banco.from;
    let falhando = true;
    h.banco.from = ((tabela: string) => {
      if (tabela === 'cassi_financeiro_clientes' && falhando) {
        const q: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'gte', 'lte']) q[m] = () => q;
        q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'sem rede' } }).then(res);
        return q;
      }
      return original(tabela);
    }) as typeof h.banco.from;
    abrirAba(/^Faturamento/);
    await screen.findByRole('alert');
    falhando = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(await screen.findByText(/Nenhum cliente na lista de outubro de 2026/)).toBeTruthy();
  });

  it('juntar cadastros duplicados leva a lista do mês junto: o cliente que fica herda a conta do duplicado', async () => {
    h.banco.tabelas.cassi_financeiro_clientes.push(
      { id: 'v1', terapeuta_id: 'prof-1', mes: '2026-10', paciente_id: 'p2' }, // Bruno (o duplicado) está na lista de outubro
      { id: 'v2', terapeuta_id: 'prof-1', mes: '2026-09', paciente_id: 'p2' },
      { id: 'v3', terapeuta_id: 'prof-1', mes: '2026-09', paciente_id: 'p3' }, // Carla já estava em setembro: não duplica
    );
    montar();
    await screen.findByText('Bruno Lima');
    await abrirMenuDe('Bruno Lima');
    fireEvent.click(screen.getByRole('menuitem', { name: /Editar cadastro/ }));
    fireEvent.change(await screen.findByPlaceholderText('Buscar o cadastro certo pelo nome…'), { target: { value: 'carla' } });
    fireEvent.click(await screen.findByRole('button', { name: /Carla Dias.*Juntar aqui/ }));
    await waitFor(() => expect(h.sucesso).toHaveBeenCalledWith('Cadastros juntados — duplicado removido'));
    const lista = h.banco.tabelas.cassi_financeiro_clientes;
    expect(lista.filter((l) => l.paciente_id === 'p2')).toEqual([]); // nada ficou apontando para o duplicado
    expect(lista.filter((l) => l.paciente_id === 'p3').map((l) => l.mes).sort()).toEqual(['2026-09', '2026-10']);
    expect(h.banco.tabelas.pacientes.find((x) => x.id === 'p2')?.ativo).toBe(false);
  });
});


const pausa = (ms = 60) => new Promise((r) => setTimeout(r, ms));

async function juntarBrunoComCarla() {
  montar();
  await screen.findByText('Bruno Lima');
  await abrirMenuDe('Bruno Lima');
  fireEvent.click(screen.getByRole('menuitem', { name: /Editar cadastro/ }));
  fireEvent.change(await screen.findByPlaceholderText('Buscar o cadastro certo pelo nome…'), { target: { value: 'carla' } });
}

describe('revisão (rodada 2): reforço dos testes', () => {
  it('juntar: se gravar a lista do mês falhar, nada é apagado e o duplicado continua ativo', async () => {
    h.banco.tabelas.cassi_financeiro_clientes.push({ id: 'v1', terapeuta_id: 'prof-1', mes: '2026-10', paciente_id: 'p2' });
    await juntarBrunoComCarla();
    h.banco.falharEscritaQuando((op) => op.tabela === 'cassi_financeiro_clientes' && op.tipo === 'upsert', 'sem permissão');
    fireEvent.click(await screen.findByRole('button', { name: /Carla Dias.*Juntar aqui/ }));
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith(expect.stringContaining('Erro ao juntar')));
    expect(h.banco.tabelas.pacientes.find((x) => x.id === 'p2')?.ativo).toBe(true);
    expect(h.banco.tabelas.cassi_financeiro_clientes.filter((l) => l.paciente_id === 'p2')).toHaveLength(1);
  });

  it('juntar: se apagar as linhas do duplicado falhar, aborta antes de desativar o duplicado', async () => {
    h.banco.tabelas.cassi_financeiro_clientes.push({ id: 'v1', terapeuta_id: 'prof-1', mes: '2026-10', paciente_id: 'p2' });
    await juntarBrunoComCarla();
    h.banco.falharEscritaQuando((op) => op.tabela === 'cassi_financeiro_clientes' && op.tipo === 'delete', 'sem permissão');
    fireEvent.click(await screen.findByRole('button', { name: /Carla Dias.*Juntar aqui/ }));
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith(expect.stringContaining('Erro ao juntar')));
    expect(h.banco.tabelas.pacientes.find((x) => x.id === 'p2')?.ativo).toBe(true);
  });

  it('juntar: leva todos os meses do duplicado, inclusive o que o cliente que fica não tinha em lugar nenhum', async () => {
    h.banco.tabelas.cassi_financeiro_clientes.push(
      { id: 'v1', terapeuta_id: 'prof-1', mes: '2026-10', paciente_id: 'p2' },
      { id: 'v2', terapeuta_id: 'prof-1', mes: '2026-09', paciente_id: 'p2' },
      { id: 'v4', terapeuta_id: 'prof-1', mes: '2026-08', paciente_id: 'p2' },
      { id: 'v3', terapeuta_id: 'prof-1', mes: '2026-09', paciente_id: 'p3' },
    );
    await juntarBrunoComCarla();
    fireEvent.click(await screen.findByRole('button', { name: /Carla Dias.*Juntar aqui/ }));
    await waitFor(() => expect(h.sucesso).toHaveBeenCalledWith('Cadastros juntados — duplicado removido'));
    const lista = h.banco.tabelas.cassi_financeiro_clientes;
    expect(lista.filter((l) => l.paciente_id === 'p3').map((l) => l.mes).sort()).toEqual(['2026-08', '2026-09', '2026-10']);
    expect(lista.filter((l) => l.paciente_id === 'p2')).toEqual([]);
  });

  it('relatório de OUTRO mês COM lista: as guias dos clientes dessa lista vêm marcadas', async () => {
    h.banco.tabelas.guias_cassi.push(guia('gB', 'p2', 'Bruno', 'Lima', { data_pedido: '2026-08-18', data_resposta: '2026-08-20', sessoes_autorizadas: 10, sessoes_realizadas: 10, status: 'finalizada' }));
    h.banco.tabelas.cassi_financeiro_clientes.push({ id: 'v9', terapeuta_id: 'prof-1', mes: '2026-09', paciente_id: 'p2' });
    montar();
    await irParaFaturamento();
    fireEvent.click(screen.getByRole('button', { name: /Relatório/ }));
    const dialogo = await screen.findByRole('dialog');
    await within(dialogo).findByText(/Não há clientes na lista de outubro 2026/);
    fireEvent.change(within(dialogo).getByDisplayValue('2026-10'), { target: { value: '2026-09' } });
    await waitFor(() => expect((within(dialogo).getByRole('checkbox', { name: /Bruno Lima/ }) as HTMLInputElement).checked).toBe(true));
  });

  it('enviadas ao financeiro: conta só as do mês (uma de setembro não entra em outubro)', async () => {
    h.banco.tabelas.guias_cassi.find((g) => g.id === 'g5')!.enviada_financeiro_em = '2026-09-15';
    montar();
    await irParaFaturamento();
    expect(screen.getByText('1 em outubro')).toBeTruthy();
  });

  it('cancelQueries: uma leitura atrasada de pacientes não apaga da tela quem acabou de entrar no pedido', async () => {
    montar();
    await irParaPedir();
    let liberarLeitura: () => void = () => {};
    const leitura = new Promise<void>((ok) => { liberarLeitura = ok; });
    let atrasando = true;
    const original = h.banco.from;
    h.banco.from = ((tabela: string) => {
      const q = original(tabela) as any;
      if (tabela !== 'pacientes') return q;
      const sel = q.select.bind(q);
      let ehSelect = false;
      q.select = (...a: unknown[]) => { ehSelect = true; return sel(...a); };
      const entregar = q.then.bind(q);
      q.then = (res: any, rej: any) => entregar((v: unknown) => (ehSelect && atrasando ? leitura.then(() => v) : v)).then(res, rej);
      return q;
    }) as typeof h.banco.from;
    await buscarEEscolher('Adicionar cliente ao pedido', 'carla', /Carla Dias/);
    await waitFor(() => expect(noPedido('Carla Dias')).toBeTruthy());
    // a releitura disparada pela gravação de Carla está no ar (atrasada); agora entra Bruno e a gravação dele fica retida
    let liberarBruno: () => void = () => {};
    const retida = new Promise<void>((ok) => { liberarBruno = ok; });
    h.banco.antesDeEscrever(async (op) => { if ((op.filtros[0]?.[2] as string[] | undefined)?.[0] === 'p2') await retida; });
    await buscarEEscolher('Adicionar cliente ao pedido', 'bruno', /Bruno Lima/);
    await waitFor(() => expect(noPedido('Bruno Lima')).toBeTruthy());
    liberarLeitura(); atrasando = false;
    await pausa(80);
    expect(noPedido('Bruno Lima')).toBeTruthy(); // a leitura velha chegou e não pode apagar o otimista
    liberarBruno();
    await waitFor(() => expect(h.banco.tabelas.pacientes.find((x) => x.id === 'p2')?.cassi_pedir_guia).toBe(true));
    expect(noPedido('Bruno Lima')).toBeTruthy();
  });

  it('dar baixa limpa as edições: diagnóstico apagado na tela volta ao do cadastro quando o pedido é desfeito', async () => {
    h.banco.tabelas.pacientes.find((p) => p.id === 'p1')!.cassi_diagnostico = 'Lombalgia';
    montar();
    await irParaPedir();
    await buscarEEscolher('Adicionar cliente ao pedido', 'ana', /Ana Souza/);
    await waitFor(() => expect(noPedido('Ana Souza')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Diagnóstico de Ana Souza'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Dar baixa \(1\)/ }));
    await waitFor(() => expect(screen.getByText('Guias pedidas — aguardando CASSI (2)')).toBeTruthy());
    const desfazer = screen.getAllByRole('button', { name: 'desfazer' });
    expect(desfazer).toHaveLength(2);
    // Ana vem antes de Elisa (ordem alfabética)
    fireEvent.click(desfazer[0]);
    await waitFor(() => expect(noPedido('Ana Souza')).toBeTruthy());
    expect((screen.getByLabelText('Diagnóstico de Ana Souza') as HTMLInputElement).value).toBe('Lombalgia');
  });

  it('reativar cliente encerrado com o banco recusando: ele continua encerrado na tela', async () => {
    montar();
    await screen.findByText('Davi Encerrado');
    h.banco.falharEscritaQuando((op) => op.tabela === 'pacientes', 'sem permissão');
    await abrirMenuDe('Davi Encerrado');
    fireEvent.click(screen.getByRole('menuitem', { name: /Pedir guia/ }));
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('Erro: sem permissão'));
    expect(screen.getAllByRole('button', { name: 'Ativar cliente' })).toHaveLength(1);
  });

  it('"Falta:" aparece para assinar/recolher/enviar e não aparece para guia já enviada', async () => {
    const t = h.banco.tabelas;
    t.guias_cassi.find((g) => g.id === 'g1')!.assinatura = 'inteira'; // Ana: recolher
    t.guias_cassi.push(guia('gD', 'p4', 'Davi', 'Encerrado', { assinatura: 'inteira', recolhida_em: '2026-10-18' })); // Davi: enviar
    t.guias_cassi.find((g) => g.id === 'g3')!.assinatura = 'inteira'; // Carla: enviada (g3 já tem enviada_financeiro_em)
    montar();
    await screen.findByText('Ana Souza');
    const card = (nome: string) => norm((screen.getByText(nome).closest('div.rounded-xl') as HTMLElement).textContent);
    expect(card('Ana Souza')).toContain('Falta: recolher guia assinada');
    expect(card('Davi Encerrado')).toContain('Falta: enviar ao financeiro');
    expect(card('Elisa Pedida')).toContain('Falta: assinar e recolher');
    expect(card('Carla Dias')).not.toContain('Falta:');
  });

  it('tendência: mostra 6 meses (maio a outubro) e usa a lista de cada um; abril fica de fora', async () => {
    const t = h.banco.tabelas;
    t.agendamentos.push(...[10, 11].map((d) => sessao('p1', d, {}, 4)), ...[10, 11, 12, 13].map((d) => sessao('p1', d, {}, 3))); // maio (2) e abril (4)
    t.cassi_financeiro_clientes.push({ id: 'vm', terapeuta_id: 'prof-1', mes: '2026-05', paciente_id: 'p1' }, { id: 'va', terapeuta_id: 'prof-1', mes: '2026-04', paciente_id: 'p1' });
    montar();
    await irParaFaturamento();
    await buscarEEscolher('Adicionar cliente à lista do mês', 'ana', /Ana Souza/);
    await waitFor(() => expect(valorDoCartao('Bruto')).toBe('R$ 640,00'));
    const tendencia = () => norm(screen.getByText(/Sua parte · últimos 6 meses/).closest('div.rounded-xl')?.textContent);
    await waitFor(() => expect(tendencia()).toContain('mai'));
    expect(tendencia()).toContain('288'); // outubro
    expect(tendencia()).toContain('72'); // maio: 2 sessões × 80 × 0,9 × 0,5
    expect(tendencia()).not.toContain('abr');
    expect(tendencia()).not.toContain('144'); // abril (4 sessões) fora da janela
  });

  it('lista já carregada + releitura que falha: a lista continua na tela e não aparece alerta', async () => {
    montar();
    await irParaFaturamento();
    await buscarEEscolher('Adicionar cliente à lista do mês', 'ana', /Ana Souza/);
    await waitFor(() => expect(valorDoCartao('Bruto')).toBe('R$ 640,00'));
    const original = h.banco.from;
    h.banco.from = ((tabela: string) => {
      if (tabela !== 'cassi_financeiro_clientes') return original(tabela);
      const real = original(tabela) as any;
      const erroQ: Record<string, unknown> = {};
      for (const m of ['eq', 'gte', 'lte']) erroQ[m] = () => erroQ;
      erroQ.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'sem rede' } }).then(res);
      return { select: () => erroQ, upsert: (...a: unknown[]) => real.upsert(...a), delete: () => real.delete() };
    }) as typeof h.banco.from;
    await buscarEEscolher('Adicionar cliente à lista do mês', 'carla', /Carla Dias/);
    await pausa(120);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(within(screen.getByRole('list', { name: 'Clientes na lista do mês' })).getByText('Ana Souza')).toBeTruthy();
  });

  it('agenda do mês falha: a lista diz "sessões indisponíveis" (e não "sem sessão atendida")', async () => {
    montar();
    await screen.findByText('Ana Souza');
    const original = h.banco.from;
    h.banco.from = ((tabela: string) => {
      if (tabela !== 'agendamentos') return original(tabela);
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'gte', 'lt', 'lte', 'not']) q[m] = () => q;
      q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'sem rede' } }).then(res);
      return q;
    }) as typeof h.banco.from;
    abrirAba(/^Faturamento/);
    await screen.findByRole('heading', { name: 'Clientes de outubro de 2026' });
    await buscarEEscolher('Adicionar cliente à lista do mês', 'ana', /Ana Souza/);
    expect(await screen.findByText('sessões indisponíveis')).toBeTruthy();
    expect(screen.queryByText('sem sessão atendida')).toBeNull();
  });

  it('tendência: linha velha de cliente que saiu do CASSI não entra nas barras', async () => {
    h.banco.tabelas.cassi_financeiro_clientes.push(
      { id: 'v1', terapeuta_id: 'prof-1', mes: '2026-10', paciente_id: 'p1' },
      { id: 'v2', terapeuta_id: 'prof-1', mes: '2026-10', paciente_id: 'p6' },
    );
    montar();
    await screen.findByText('Ana Souza');
    abrirAba(/^Faturamento/);
    await waitFor(() => expect(valorDoCartao('Bruto')).toBe('R$ 640,00'));
    const tendencia = () => norm(screen.getByText(/Sua parte · últimos 6 meses/).closest('div.rounded-xl')?.textContent);
    await waitFor(() => expect(tendencia()).toContain('288'));
    expect(tendencia()).not.toContain('356');
  });

  it('dar baixa que falha no segundo passo não limpa o que foi editado na tela', async () => {
    h.banco.tabelas.pacientes.find((p) => p.id === 'p1')!.cassi_diagnostico = 'Lombalgia';
    montar();
    await irParaPedir();
    await buscarEEscolher('Adicionar cliente ao pedido', 'ana', /Ana Souza/);
    await waitFor(() => expect(noPedido('Ana Souza')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Diagnóstico de Ana Souza'), { target: { value: '' } });
    h.banco.falharEscritaQuando((op) => !!(op.payload as Linha)?.guia_solicitada_em, 'sem rede');
    fireEvent.click(screen.getByRole('button', { name: /Dar baixa \(1\)/ }));
    await waitFor(() => expect(h.erro).toHaveBeenCalledWith('Erro ao dar baixa: sem rede'));
    await pausa(40);
    expect((screen.getByLabelText('Diagnóstico de Ana Souza') as HTMLInputElement).value).toBe('');
  });

  it('com o cache do app (staleTime 30s): juntar cadastros e voltar ao Faturamento mostra a lista já migrada', async () => {
    h.banco.tabelas.cassi_financeiro_clientes.push({ id: 'v1', terapeuta_id: 'prof-1', mes: '2026-10', paciente_id: 'p2' });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000, gcTime: 5 * 60_000 }, mutations: { retry: false } } });
    render(<QueryClientProvider client={qc}><MemoryRouter><ControleCassi /></MemoryRouter></QueryClientProvider>);
    await screen.findByText('Bruno Lima');
    abrirAba(/^Faturamento/);
    await screen.findByRole('heading', { name: 'Clientes de outubro de 2026' });
    await screen.findByText('1 na lista');
    abrirAba(/^Clientes$/);
    await screen.findByText('Bruno Lima');
    await abrirMenuDe('Bruno Lima');
    fireEvent.click(screen.getByRole('menuitem', { name: /Editar cadastro/ }));
    fireEvent.change(await screen.findByPlaceholderText('Buscar o cadastro certo pelo nome…'), { target: { value: 'carla' } });
    fireEvent.click(await screen.findByRole('button', { name: /Carla Dias.*Juntar aqui/ }));
    await waitFor(() => expect(h.sucesso).toHaveBeenCalledWith('Cadastros juntados — duplicado removido'));
    abrirAba(/^Faturamento/);
    await screen.findByRole('heading', { name: 'Clientes de outubro de 2026' });
    await waitFor(() => expect(screen.getByText('1 na lista')).toBeTruthy());
    expect(within(screen.getByRole('list', { name: 'Clientes na lista do mês' })).getByText('Carla Dias')).toBeTruthy();
  });
});

describe('revisão (rodada 2): correções', () => {
  it('dar baixa tira o cliente da lista na hora, sem esperar a releitura (senão um segundo toque regrava os dados antigos)', async () => {
    montar();
    await irParaPedir();
    await buscarEEscolher('Adicionar cliente ao pedido', 'ana', /Ana Souza/);
    await waitFor(() => expect(noPedido('Ana Souza')).toBeTruthy());
    // A partir daqui toda releitura de pacientes fica retida: só o que a tela já sabe pode tirar a Ana da lista.
    let soltar: () => void = () => {};
    const retida = new Promise<void>((ok) => { soltar = ok; });
    const original = h.banco.from;
    h.banco.from = ((tabela: string) => {
      const q = original(tabela) as any;
      if (tabela !== 'pacientes') return q;
      let ehSelect = false;
      const sel = q.select.bind(q);
      q.select = (...a: unknown[]) => { ehSelect = true; return sel(...a); };
      const entregar = q.then.bind(q);
      q.then = (res: any, rej: any) => entregar((v: unknown) => (ehSelect ? retida.then(() => v) : v)).then(res, rej);
      return q;
    }) as typeof h.banco.from;
    fireEvent.click(screen.getByRole('button', { name: /Dar baixa \(1\)/ }));
    await waitFor(() => expect(h.sucesso).toHaveBeenCalledWith('1 pedido(s) registrado(s)'));
    await waitFor(() => expect(noPedido('Ana Souza')).toBeNull());
    expect(screen.getByText('Guias pedidas — aguardando CASSI (2)')).toBeTruthy();
    soltar();
  });

  it('juntar cadastros leva também o pedido: marcador de "Pedir guias" e data do pedido feito', async () => {
    h.banco.tabelas.pacientes.find((x) => x.id === 'p2')!.cassi_pedir_guia = true; // o duplicado (Bruno) está na lista do pedido
    h.banco.tabelas.pacientes.find((x) => x.id === 'p3')!.guia_solicitada_em = '2026-10-12T12:00:00Z'; // Carla já tinha pedido feito
    montar();
    await screen.findByText('Bruno Lima');
    await abrirMenuDe('Bruno Lima');
    fireEvent.click(screen.getByRole('menuitem', { name: /Editar cadastro/ }));
    fireEvent.change(await screen.findByPlaceholderText('Buscar o cadastro certo pelo nome…'), { target: { value: 'carla' } });
    fireEvent.click(await screen.findByRole('button', { name: /Carla Dias.*Juntar aqui/ }));
    await waitFor(() => expect(h.sucesso).toHaveBeenCalledWith('Cadastros juntados — duplicado removido'));
    const carla = h.banco.tabelas.pacientes.find((x) => x.id === 'p3')!;
    expect(carla.cassi_pedir_guia).toBe(true);
    expect(carla.guia_solicitada_em).toBe('2026-10-12T12:00:00Z');
  });

  it('com o cache do app: depois de juntar cadastros, o Faturamento já mostra as sessões do duplicado no cliente que ficou', async () => {
    h.banco.tabelas.cassi_financeiro_clientes.push({ id: 'v1', terapeuta_id: 'prof-1', mes: '2026-10', paciente_id: 'p2' });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000, gcTime: 5 * 60_000 }, mutations: { retry: false } } });
    render(<QueryClientProvider client={qc}><MemoryRouter><ControleCassi /></MemoryRouter></QueryClientProvider>);
    await screen.findByText('Bruno Lima');
    abrirAba(/^Faturamento/);
    await screen.findByText('1 na lista');
    await within(screen.getByRole('list', { name: 'Clientes na lista do mês' })).findByText('2 sessões'); // Bruno: 2 sessões
    abrirAba(/^Clientes$/);
    await screen.findByText('Bruno Lima');
    await abrirMenuDe('Bruno Lima');
    fireEvent.click(screen.getByRole('menuitem', { name: /Editar cadastro/ }));
    fireEvent.change(await screen.findByPlaceholderText('Buscar o cadastro certo pelo nome…'), { target: { value: 'carla' } });
    fireEvent.click(await screen.findByRole('button', { name: /Carla Dias.*Juntar aqui/ }));
    await waitFor(() => expect(h.sucesso).toHaveBeenCalledWith('Cadastros juntados — duplicado removido'));
    abrirAba(/^Faturamento/);
    const lista = await screen.findByRole('list', { name: 'Clientes na lista do mês' });
    await waitFor(() => expect(within(lista).getByText('6 sessões')).toBeTruthy()); // Carla: as 4 dela + as 2 de Bruno
  });

  it('quem só tem guia encerrada tem "Ver última guia" no menu (não "vigente")', async () => {
    h.banco.tabelas.guias_cassi.push(guia('gB', 'p2', 'Bruno', 'Lima', { status: 'finalizada', data_pedido: '2026-08-01', data_resposta: '2026-08-03' }));
    montar();
    await screen.findByText('Bruno Lima');
    await abrirMenuDe('Bruno Lima');
    expect(screen.getByRole('menuitem', { name: 'Ver última guia' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /Ver guia \(vigente\)/ })).toBeNull();
  });

  it('agenda do mês que falha avisa, em vez de mostrar "nenhuma sessão" e zeros', async () => {
    montar();
    await irParaFaturamento();
    await buscarEEscolher('Adicionar cliente à lista do mês', 'ana', /Ana Souza/);
    await waitFor(() => expect(valorDoCartao('Bruto')).toBe('R$ 640,00'));
    const original = h.banco.from;
    h.banco.from = ((tabela: string) => {
      if (tabela !== 'agendamentos') return original(tabela);
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'gte', 'lt', 'lte', 'not']) q[m] = () => q;
      q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'sem rede' } }).then(res);
      return q;
    }) as typeof h.banco.from;
    fireEvent.click(screen.getByTitle('Mês anterior'));
    await screen.findByRole('heading', { name: 'Clientes de setembro de 2026' });
    await buscarEEscolher('Adicionar cliente à lista do mês', 'ana', /Ana Souza/);
    expect((await screen.findByText(/Não consegui carregar a agenda deste mês/)).getAttribute('role')).toBe('alert');
    expect(screen.queryByText(/Nenhuma sessão concluída na agenda neste mês/)).toBeNull();
  });
});

// ── Guardas do código ─────────────────────────────────────────────────────────
describe('guardas', () => {
  it('passar pelo Faturamento e voltar não faz o cadastro perder colunas: quem estava no pedido continua nele', async () => {
    montar();
    await irParaPedir();
    await buscarEEscolher('Adicionar cliente ao pedido', 'carla', /Carla Dias/);
    await waitFor(() => expect(noPedido('Carla Dias')).toBeTruthy());
    abrirAba(/^Faturamento/);
    await screen.findByRole('heading', { name: 'Clientes de outubro de 2026' });
    abrirAba(/^Pedir guias/);
    expect(await screen.findByRole('button', { name: /^Carla Dias/, pressed: true })).toBeTruthy();
    const pacientesSelect = h.banco.operacoes.filter((o) => o.tabela === 'pacientes' && o.tipo === 'select');
    expect(pacientesSelect.length).toBeGreaterThan(0);
  });

  const fonte = readFileSync(join(__dirname, '..', 'pages', 'ControleCassi.tsx'), 'utf8');

  it('só existe UMA consulta dos clientes CASSI: duas com a mesma chave e colunas diferentes se sobrescreviam no cache', () => {
    expect(fonte.match(/\.ilike\('plano_saude', '%cassi%'\)/g)).toHaveLength(1);
    expect(fonte.match(/queryKey: \['cassi-pacientes', user\?\.id\],\s*queryFn/g)).toHaveLength(1);
  });

  it('a aba "Este mês" continua no código, atrás da chave MOSTRAR_ESTE_MES (desligada por enquanto)', () => {
    expect(fonte).toMatch(/const MOSTRAR_ESTE_MES = false;/);
    expect(fonte).toContain("['ativas', 'Este mês']");
    expect(fonte).toMatch(/\.filter\(\(\[v\]\) => MOSTRAR_ESTE_MES \|\| v !== 'ativas'\)/);
  });
});
