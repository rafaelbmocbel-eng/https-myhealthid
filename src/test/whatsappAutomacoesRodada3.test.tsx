// Tela de Automações do WhatsApp (src/pages/WhatsappAutomacoes.tsx), terceira rodada de conferência: cada teste prova um
// conserto dos conferentes e FALHA se o conserto for desfeito. Banco falso, nada vai à rede nem manda mensagem.
// Cobre: foco de volta ao botão depois de erro na conferência (C1), falha silenciosa da conferência e do envio (C2),
// falha em agente_disparos sem derrubar as outras leituras (C3), formulário travado durante o envio (C4), contraste dos
// parágrafos de apoio (C5), Esc fecha a confirmação (C6), interruptores dos gatilhos com nome (C7), status gravado e
// erro da função (N19, N07) e prévia de mensagem só com espaços (N38).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';

const h = vi.hoisted(() => ({
  banco: null as unknown,
  inseridos: [] as Array<Record<string, unknown>>,
  invocacoes: [] as Array<[string, unknown]>,
  toasts: [] as Array<[string, string]>,
  fetchChamado: [] as string[],
  tabelasComFalha: new Set<string>(),
  erroDaFuncao: null as null | { message: string },
  insertLancaErro: false,
  portaDoInsert: null as null | Promise<void>,
}));

vi.mock('sonner', () => ({
  toast: {
    error: (m: string) => h.toasts.push(['erro', m]),
    success: (m: string) => h.toasts.push(['ok', m]),
  },
}));

// Consulta que responde com erro do PostgREST em qualquer encadeamento.
const consultaComFalha = (): object => {
  const resposta = { data: null, error: { message: 'falha simulada do banco' } };
  const encadeamento: object = new Proxy(function () { /* alvo do Proxy: só precisa ser chamável */ }, {
    get(_alvo, prop) {
      if (prop === 'then') return (resolver: (r: unknown) => unknown) => Promise.resolve(resposta).then(resolver);
      return () => encadeamento;
    },
  });
  return encadeamento;
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'T1' } } }) },
    functions: {
      invoke: (nome: string, opcoes: unknown) => {
        h.invocacoes.push([nome, opcoes]);
        return Promise.resolve({ error: h.erroDaFuncao });
      },
    },
    from: (tabela: string) => {
      if (h.tabelasComFalha.has(tabela)) return consultaComFalha();
      if (tabela === 'agente_broadcasts') {
        return {
          insert: (payload: Record<string, unknown>) => {
            h.inseridos.push(payload);
            if (h.insertLancaErro) throw new Error('insert lançou exceção');
            return {
              select: () => ({
                single: async () => {
                  await h.portaDoInsert;
                  return { data: { id: 'bc-1' }, error: null };
                },
              }),
            };
          },
        };
      }
      return (h.banco as BancoFalso).from(tabela);
    },
  },
}));

import WhatsappAutomacoes from '@/pages/WhatsappAutomacoes';

Element.prototype.scrollIntoView = vi.fn();

const fetchProibido = (entrada: unknown): Promise<Response> => {
  h.fetchChamado.push(String(entrada));
  throw new Error(`fetch bloqueado no teste: ${String(entrada)}`);
};

const AGORA = '2026-11-09T15:00:00Z';

const cfg = (extra: Linha = {}): Linha => ({
  terapeuta_id: 'T1', automacoes_pausadas: false, bot_ativo: false, tom_voz: 'amigavel',
  gatilhos_ativos: {}, dias_semana: [], palavras_escalonamento: [], ...extra,
});
const cliente = (id: string, extra: Linha = {}): Linha => ({ id, terapeuta_id: 'T1', ativo: true, telefone: '5511999990001', nome: 'MARINA', ...extra });

async function abrir(tabelas: Record<string, Linha[]> = {}) {
  h.banco = criarBancoFalso({ whatsapp_automacoes: [cfg()], pacientes: [cliente('P1'), cliente('P2')], ...tabelas });
  render(<WhatsappAutomacoes embedded />);
  await screen.findByText('Mensagens automáticas ativas');
}
const irParaAba = async (nome: string) => {
  fireEvent.mouseDown(screen.getByRole('tab', { name: nome }), { button: 0 });
  await waitFor(() => expect(screen.getByRole('tab', { name: nome })).toHaveAttribute('data-state', 'active'));
};
const abrirBroadcast = async (tabelas: Record<string, Linha[]> = {}) => {
  await abrir(tabelas);
  await irParaAba('Broadcast');
};
const escrever = (rotulo: string | RegExp, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
const botaoDisparar = () => screen.getByRole('button', { name: 'Disparar agora' });
const preencher = () => {
  escrever('Título interno', 'Horário de verão');
  escrever('Mensagem', 'Oi {nome}! A clínica abre às 7h na sexta.');
};
const abrirConfirmacao = async () => {
  preencher();
  fireEvent.click(screen.getByRole('button', { name: /Disparar agora|Agendar campanha/ }));
  return screen.findByRole('alertdialog');
};

let erroNoConsole: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(AGORA));
  vi.stubGlobal('fetch', fetchProibido);
  erroNoConsole = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  h.inseridos = [];
  h.invocacoes = [];
  h.toasts = [];
  h.fetchChamado = [];
  h.tabelasComFalha = new Set();
  h.erroDaFuncao = null;
  h.insertLancaErro = false;
  h.portaDoInsert = null;
});
afterEach(() => {
  cleanup();
  erroNoConsole.mockRestore();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  expect(h.fetchChamado).toEqual([]);
});

describe('C1: depois de um aviso de erro na conferência o foco volta ao botão', () => {
  it('segmento sem clientes: o botão volta a ficar habilitado e é ele que tem o foco, não o título nem o corpo da página', async () => {
    await abrirBroadcast({ pacientes: [] });
    preencher();
    screen.getByLabelText('Título interno').focus();
    fireEvent.click(botaoDisparar());
    await waitFor(() => expect(h.toasts).toContainEqual(['erro', 'Nenhum paciente encontrado nesse segmento']));
    await waitFor(() => expect(botaoDisparar()).toBeEnabled());
    expect(document.activeElement).toBe(botaoDisparar());
  });

  it('erro de validação antes de conferir (título vazio) não mexe no foco', async () => {
    await abrirBroadcast();
    escrever('Mensagem', 'Oi {nome}!');
    const titulo = screen.getByLabelText('Título interno');
    titulo.focus();
    fireEvent.click(botaoDisparar());
    expect(h.toasts).toContainEqual(['erro', 'Preencha o título']);
    expect(document.activeElement).toBe(titulo);
  });
});

describe('C2: falha na conferência ou no envio avisa em vez de ficar muda', () => {
  it('a consulta de clientes falha: aviso na tela, nada gravado, botão livre para tentar de novo', async () => {
    await abrirBroadcast();
    h.tabelasComFalha.add('pacientes');
    preencher();
    fireEvent.click(botaoDisparar());
    await waitFor(() => expect(h.toasts).toContainEqual(['erro', 'Não consegui conferir os clientes. Tente de novo.']));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(h.inseridos).toEqual([]);
    expect(h.invocacoes).toEqual([]);
    await waitFor(() => expect(botaoDisparar()).toBeEnabled());
    expect(erroNoConsole).toHaveBeenCalled();
  });

  it('o envio lança exceção: aviso para conferir antes de repetir e o botão de confirmar volta a ficar livre', async () => {
    await abrirBroadcast();
    await abrirConfirmacao();
    h.insertLancaErro = true;
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar envio' }));
    await waitFor(() => expect(h.toasts.some(([tipo, m]) => tipo === 'erro' && m.startsWith('Algo deu errado no envio.'))).toBe(true));
    expect(h.toasts.find(([, m]) => m.startsWith('Algo deu errado'))?.[1]).toContain('confira se as mensagens saíram');
    expect(h.toasts.some(([tipo]) => tipo === 'ok')).toBe(false);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar envio' })).toBeEnabled());
    expect(h.invocacoes).toEqual([]);
  });
});

describe('C3: falha em agente_disparos não derruba as outras leituras', () => {
  it('a nota média do NPS ainda aparece e os cartões do resumo ficam zerados', async () => {
    h.tabelasComFalha.add('agente_disparos');
    await abrir({ nps_respostas: [{ terapeuta_id: 'T1', nota: 5 }, { terapeuta_id: 'T1', nota: 4 }] });
    expect(screen.getByText('Mensagens enviadas').parentElement).toHaveTextContent('0');
    expect(screen.getByText('Gatilho mais usado').parentElement).toHaveTextContent('—');
    await irParaAba('Gatilhos');
    expect(screen.getByText(/Nota média:/)).toHaveTextContent('4,5');
    expect(erroNoConsole).toHaveBeenCalled();
  });
});

describe('C4: durante o envio o público e o agendamento ficam travados', () => {
  it('segmento e "Agendar envio" desabilitados enquanto o insert não volta, e a confirmação continua aberta', async () => {
    await abrirBroadcast();
    await abrirConfirmacao();
    let liberar: () => void = () => undefined;
    h.portaDoInsert = new Promise<void>((resolver) => { liberar = resolver; });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar envio' }));
    await waitFor(() => expect(h.inseridos).toHaveLength(1));
    expect(screen.getByRole('combobox', { name: /Segmento/ })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Agendar envio' })).toBeDisabled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    liberar();
    await waitFor(() => expect(h.invocacoes).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('combobox', { name: /Segmento/ })).toBeEnabled());
    expect(screen.getByRole('switch', { name: 'Agendar envio' })).toBeEnabled();
  });

  it('a data do agendamento também fica travada durante o envio', async () => {
    await abrirBroadcast();
    fireEvent.click(screen.getByRole('switch', { name: 'Agendar envio' }));
    escrever('Data e hora do envio', '2026-11-20T09:00');
    await abrirConfirmacao();
    let liberar: () => void = () => undefined;
    h.portaDoInsert = new Promise<void>((resolver) => { liberar = resolver; });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar agendamento' }));
    await waitFor(() => expect(h.inseridos).toHaveLength(1));
    expect(screen.getByLabelText('Data e hora do envio')).toBeDisabled();
    liberar();
    await waitFor(() => expect(h.toasts.some(([tipo]) => tipo === 'ok')).toBe(true));
  });
});

describe('C6: Esc fecha a confirmação', () => {
  it('Esc dentro do painel fecha sem gravar e devolve o foco ao botão', async () => {
    await abrirBroadcast();
    const painel = await abrirConfirmacao();
    fireEvent.keyDown(painel, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(h.inseridos).toEqual([]);
    expect(document.activeElement).toBe(botaoDisparar());
  });

  it('outras teclas não fecham o painel', async () => {
    await abrirBroadcast();
    const painel = await abrirConfirmacao();
    fireEvent.keyDown(painel, { key: 'Enter' });
    fireEvent.keyDown(painel, { key: 'a' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('Esc durante o envio não fecha o painel', async () => {
    await abrirBroadcast();
    const painel = await abrirConfirmacao();
    let liberar: () => void = () => undefined;
    h.portaDoInsert = new Promise<void>((resolver) => { liberar = resolver; });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar envio' }));
    await waitFor(() => expect(h.inseridos).toHaveLength(1));
    fireEvent.keyDown(painel, { key: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    liberar();
    await waitFor(() => expect(h.invocacoes).toHaveLength(1));
  });
});

describe('C7: os interruptores da aba Gatilhos têm nome', () => {
  it('todos os interruptores têm nome acessível, e cada gatilho é achado pelo nome dele', async () => {
    await abrir();
    await irParaAba('Gatilhos');
    const interruptores = screen.getAllByRole('switch');
    expect(interruptores.length).toBeGreaterThanOrEqual(10);
    for (const interruptor of interruptores) expect(interruptor).toHaveAccessibleName();
    for (const nome of ['Confirmação 24h antes', 'Lembrete 2h antes', 'Diário parado', 'MyID vencido (30 dias)']) {
      expect(screen.getByRole('switch', { name: nome })).toBeInTheDocument();
    }
  });
});

describe('C5: parágrafos de apoio com contraste suficiente', () => {
  it.each([
    ['explicação do interruptor de IA', /Desligado: cada cliente recebe exatamente o texto/],
    ['Teste A/B', /Compara 2 mensagens/],
    ['ajuda da mensagem', /É o texto que o cliente recebe/],
    ['agendamento', /Dispara automaticamente na data escolhida/],
    ['rótulo da prévia', /Prévia com nomes de exemplo/],
    ['nome da prévia', /^Para Marina$/],
  ])('%s usa text-foreground/70, não só o cinza global', async (_nome, texto) => {
    await abrirBroadcast();
    const paragrafo = screen.getAllByText(texto)[0];
    expect(paragrafo.className).toContain('text-foreground/70');
  });

  it('a legenda da aba Gatilhos também', async () => {
    await abrir();
    await irParaAba('Gatilhos');
    const legenda = screen.getByText(/Aniversário, diário parado, MyID vencido e reengajamento saem de manhã/);
    expect(legenda.className).toContain('text-foreground/70');
  });
});

describe('N19 e N07: o que é gravado e o que acontece se a função falhar', () => {
  it('a campanha é gravada como "agendado" para o profissional certo e com o total de clientes', async () => {
    await abrirBroadcast();
    await abrirConfirmacao();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar envio' }));
    await waitFor(() => expect(h.inseridos).toHaveLength(1));
    expect(h.inseridos[0]).toMatchObject({ status: 'agendado', terapeuta_id: 'T1', total: 2, paciente_ids: ['P1', 'P2'], agendado_para: null });
  });

  it('se a função de envio devolver erro, mostra o erro, não anuncia sucesso e não zera o formulário', async () => {
    await abrirBroadcast();
    await abrirConfirmacao();
    h.erroDaFuncao = { message: 'função fora do ar' };
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar envio' }));
    await waitFor(() => expect(h.toasts).toContainEqual(['erro', 'Erro ao disparar: função fora do ar']));
    expect(h.toasts.some(([tipo]) => tipo === 'ok')).toBe(false);
    expect(screen.getByLabelText('Título interno')).toHaveValue('Horário de verão');
    expect(screen.getByLabelText('Mensagem')).toHaveValue('Oi {nome}! A clínica abre às 7h na sexta.');
  });
});

describe('N38: mensagem só com espaços', () => {
  it('mostra a dica de escrever, não o pedido de corrigir um aviso que não existe', async () => {
    await abrirBroadcast();
    escrever('Mensagem', '     ');
    expect(screen.getAllByText('Escreva a mensagem para ver o exemplo.')).toHaveLength(3);
    expect(screen.queryByText('Corrija o aviso do texto para ver o exemplo.')).not.toBeInTheDocument();
  });
});
