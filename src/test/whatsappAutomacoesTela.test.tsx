// Tela de Automações do WhatsApp (src/pages/WhatsappAutomacoes.tsx) com banco falso: nada aqui chama a rede nem manda
// mensagem. Cobre o que o motor de mensagens mudou na tela: gatilho mais usado sem as linhas simuladas, rótulo
// "Objetivo", broadcast com a IA desligada por padrão, prévia pela mesma função do envio, variável inválida e a confirmação.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';

const h = vi.hoisted(() => ({
  banco: null as unknown,
  inseridos: [] as Array<Record<string, unknown>>,
  invocacoes: [] as Array<[string, unknown]>,
  toasts: [] as Array<[string, string]>,
  renderizar: [] as Array<unknown[]>,
  fetchChamado: [] as string[],
}));

vi.mock('sonner', () => ({
  toast: {
    error: (m: string) => h.toasts.push(['erro', m]),
    success: (m: string) => h.toasts.push(['ok', m]),
  },
}));
// A prévia da tela tem de passar pela mesma renderizarModelo do envio: o dublê só anota as chamadas e devolve o resultado real.
vi.mock('@/lib/mensagemModelos', async (importar) => {
  const real = await importar<typeof import('@/lib/mensagemModelos')>();
  return {
    ...real,
    renderizarModelo: (...a: Parameters<typeof real.renderizarModelo>) => {
      h.renderizar.push(a);
      return real.renderizarModelo(...a);
    },
  };
});
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'T1' } } }) },
    functions: {
      invoke: (nome: string, opcoes: unknown) => {
        h.invocacoes.push([nome, opcoes]);
        return Promise.resolve({ error: null });
      },
    },
    from: (tabela: string) => {
      if (tabela === 'agente_broadcasts') {
        return {
          insert: (payload: Record<string, unknown>) => {
            h.inseridos.push(payload);
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 'bc-1' }, error: null }) }) };
          },
        };
      }
      return (h.banco as BancoFalso).from(tabela);
    },
  },
}));

import WhatsappAutomacoes from '@/pages/WhatsappAutomacoes';
import { renderizarModelo, ROTULO_TOM } from '@/lib/mensagemModelos';

Element.prototype.scrollIntoView = vi.fn();

const fetchProibido = (entrada: unknown): Promise<Response> => {
  h.fetchChamado.push(String(entrada));
  throw new Error(`fetch bloqueado no teste: ${String(entrada)}`);
};

const DIA = 86_400_000;
const AGORA = '2026-11-09T15:00:00Z';
const iso = (diasAtras: number) => new Date(Date.parse(AGORA) - diasAtras * DIA).toISOString();

const cfg = (extra: Linha = {}): Linha => ({
  terapeuta_id: 'T1', automacoes_pausadas: false, bot_ativo: false, tom_voz: 'amigavel',
  gatilhos_ativos: {}, dias_semana: [], palavras_escalonamento: [], ...extra,
});
const cliente = (id: string, extra: Linha = {}): Linha => ({ id, terapeuta_id: 'T1', ativo: true, telefone: '5511999990001', nome: 'MARINA', ...extra });
const disparo = (gatilho: string, status: string): Linha => ({ terapeuta_id: 'T1', gatilho, status, created_at: iso(1) });

function montar(tabelas: Record<string, Linha[]> = {}) {
  h.banco = criarBancoFalso({ whatsapp_automacoes: [cfg()], pacientes: [cliente('P1'), cliente('P2')], ...tabelas });
}
const banco = () => h.banco as BancoFalso;

async function abrir(tabelas: Record<string, Linha[]> = {}) {
  montar(tabelas);
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
const botaoDisparar = () => screen.getByRole('button', { name: /Disparar agora|Agendar campanha/ });
const interruptorIA = () => screen.getByRole('switch', { name: 'Personalizar com IA' });
const interruptorAB = () => screen.getByRole('switch', { name: 'Teste A/B' });
const interruptorAgendar = () => screen.getByRole('switch', { name: 'Agendar envio' });
const abrirLista = (combo: HTMLElement) => fireEvent.keyDown(combo, { key: 'Enter' });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(AGORA));
  vi.stubGlobal('fetch', fetchProibido);
  h.inseridos = [];
  h.invocacoes = [];
  h.toasts = [];
  h.renderizar = [];
  h.fetchChamado = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  expect(h.fetchChamado).toEqual([]);
});

describe('Últimos 7 dias: gatilho mais usado', () => {
  it('ignora as linhas simuladas (gatilho "simulado:" e status "simulado"), mesmo sendo a maioria', async () => {
    await abrir({
      agente_disparos: [
        ...Array.from({ length: 5 }, () => disparo('simulado:diario_pendente', 'simulado')),
        disparo('aniversario', 'enviado'),
        disparo('aniversario', 'enviado'),
        disparo('myid_vencido', 'erro'),
      ],
    });
    const card = screen.getByText('Gatilho mais usado').parentElement as HTMLElement;
    expect(card).toHaveTextContent('aniversario (2)');
    expect(card).not.toHaveTextContent('simulado');
    expect(screen.getByText('Mensagens enviadas').parentElement).toHaveTextContent('2');
  });

  it('só com linhas simuladas mostra "—" e zero enviadas', async () => {
    await abrir({ agente_disparos: [disparo('simulado:aniversario', 'simulado'), disparo('simulado:reengajamento', 'simulado')] });
    expect(screen.getByText('Gatilho mais usado').parentElement).toHaveTextContent('—');
    expect(screen.getByText('Mensagens enviadas').parentElement).toHaveTextContent('0');
  });
});

describe('Tom de voz: rótulo "Objetivo"', () => {
  it('mostra Objetivo para o valor "tecnico" salvo, e nunca "Técnico-clínico"', async () => {
    await abrir({ whatsapp_automacoes: [cfg({ tom_voz: 'tecnico' })] });
    const combo = screen.getAllByRole('combobox')[0];
    expect(combo).toHaveTextContent('Objetivo');
    expect(document.body).not.toHaveTextContent('Técnico-clínico');
    expect(ROTULO_TOM.tecnico).toBe('Objetivo');
  });

  it('a lista tem as 3 opções e escolher Objetivo continua gravando o valor "tecnico"', async () => {
    await abrir();
    abrirLista(screen.getAllByRole('combobox')[0]);
    const opcoes = await screen.findAllByRole('option');
    expect(opcoes.map((o) => o.textContent)).toEqual(['Amigável e próximo', 'Formal e respeitoso', 'Objetivo']);
    fireEvent.click(screen.getByRole('option', { name: 'Objetivo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar automações' }));
    await waitFor(() => expect(banco().escritas().length).toBeGreaterThan(0));
    const gravado = banco().escritas().find((o) => o.tabela === 'whatsapp_automacoes' && o.tipo === 'upsert');
    expect((gravado?.payload as Linha).tom_voz).toBe('tecnico');
  });
});

describe('Aba Gatilhos: legenda', () => {
  it('explica que os 4 textos são prontos e fixos por tom e só valem quando o recurso for ligado; não promete "sem IA"', async () => {
    await abrir();
    await irParaAba('Gatilhos');
    const legenda = screen.getByText(/Aniversário, diário parado, MyID vencido e reengajamento saem de manhã/);
    expect(legenda).toHaveTextContent('texto pronto e fixo');
    expect(legenda).toHaveTextContent('tom de voz da aba Bot');
    expect(legenda).toHaveTextContent('só passam a valer quando a equipe do My Health ID ligar o recurso');
    expect(legenda).toHaveTextContent('até lá, o aplicativo ainda escreve a mensagem com IA');
    expect(legenda).not.toHaveTextContent('Sem IA e sem dado de saúde');
    expect(document.body).not.toHaveTextContent('A IA dispara sozinha');
    expect(document.body).not.toHaveTextContent('15 min');
  });
});

describe('Aba Broadcast: textos da tela', () => {
  it('a mensagem é o texto final (não um briefing para a IA) e a tela não promete MyID nem histórico', async () => {
    await abrirBroadcast();
    expect(screen.getByLabelText('Mensagem')).toHaveAttribute('placeholder', expect.stringContaining('{nome}'));
    const corpo = document.body.textContent ?? '';
    expect(corpo).not.toContain('Intenção');
    expect(corpo).not.toContain('A IA reescreve isso');
    expect(corpo).not.toContain('usando MyID');
    expect(corpo).not.toContain('Quero te lembrar');
    expect(corpo).not.toContain('histórico após o envio');
    expect(corpo).toContain('É o texto que o cliente recebe');
  });
});

describe('Aba Broadcast: interruptor "Personalizar com IA"', () => {
  it('nasce DESLIGADO e explica o que muda', async () => {
    await abrirBroadcast();
    expect(interruptorIA()).toHaveAttribute('aria-checked', 'false');
    const explicacao = interruptorIA().closest('label') as HTMLElement;
    expect(explicacao).toHaveTextContent('Desligado: cada cliente recebe exatamente o texto que você escreveu');
    expect(explicacao).toHaveTextContent('só o primeiro nome e o tom da clínica, sem MyID nem dado de saúde');
  });

  it('a campanha NOVA grava personalizar_ia:false quando o interruptor fica como está', async () => {
    await abrirBroadcast();
    escrever('Título interno', 'Horário de verão');
    escrever('Mensagem', 'Oi {nome}! A clínica abre às 7h na sexta.');
    fireEvent.click(botaoDisparar());
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar envio' }));
    await waitFor(() => expect(h.inseridos).toHaveLength(1));
    expect(h.inseridos[0].filtro).toEqual({ segmento: 'todos', personalizar_ia: false });
    expect(h.inseridos[0].intencao).toBe('Oi {nome}! A clínica abre às 7h na sexta.');
    await waitFor(() => expect(h.invocacoes).toEqual([['agente-broadcast', { body: { broadcast_id: 'bc-1' } }]]));
  });

  it('com o interruptor ligado grava personalizar_ia:true, e depois do envio a tela volta ao padrão desligado', async () => {
    await abrirBroadcast();
    fireEvent.click(interruptorIA());
    expect(interruptorIA()).toHaveAttribute('aria-checked', 'true');
    escrever('Título interno', 'Promoção');
    escrever('Mensagem', 'Oi {nome}! Temos horário na sexta.');
    fireEvent.click(botaoDisparar());
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar envio' }));
    await waitFor(() => expect(h.inseridos).toHaveLength(1));
    expect((h.inseridos[0].filtro as Linha).personalizar_ia).toBe(true);
    await waitFor(() => expect(interruptorIA()).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByLabelText('Mensagem')).toHaveValue('');
  });

  it('a campanha agendada também leva a marca (e não dispara a função na hora)', async () => {
    await abrirBroadcast();
    escrever('Título interno', 'Agendada');
    escrever('Mensagem', 'Oi {nome}! Feliz ano novo.');
    fireEvent.click(interruptorAgendar());
    fireEvent.change(document.querySelector('input[type="datetime-local"]') as HTMLElement, { target: { value: '2099-01-01T10:00' } });
    fireEvent.click(botaoDisparar());
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar agendamento' }));
    await waitFor(() => expect(h.inseridos).toHaveLength(1));
    expect((h.inseridos[0].filtro as Linha).personalizar_ia).toBe(false);
    expect(h.inseridos[0].agendado_para).toBe(new Date('2099-01-01T10:00').toISOString());
    expect(h.invocacoes).toEqual([]);
  });

  it('no teste A/B grava a marca e as duas variantes', async () => {
    await abrirBroadcast();
    fireEvent.click(interruptorAB());
    escrever('Título interno', 'Teste');
    escrever('Variante A', 'Oi {nome}! Versão A.');
    escrever('Variante B', 'Olá {nome}. Versão B.');
    fireEvent.click(botaoDisparar());
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar envio' }));
    await waitFor(() => expect(h.inseridos).toHaveLength(1));
    expect(h.inseridos[0].filtro).toEqual({ segmento: 'todos', personalizar_ia: false });
    expect(h.inseridos[0].ab_variantes).toEqual([
      { key: 'A', texto: 'Oi {nome}! Versão A.', peso: 50 },
      { key: 'B', texto: 'Olá {nome}. Versão B.', peso: 50 },
    ]);
    expect(h.inseridos[0].intencao).toBe('Oi {nome}! Versão A.');
  });
});

describe('Aba Broadcast: prévia', () => {
  it('mostra 3 nomes de exemplo, só o primeiro nome com inicial maiúscula por segmento', async () => {
    await abrirBroadcast();
    escrever('Mensagem', 'Oi {nome}! Passando para avisar da sexta.');
    const previas = screen.getAllByTestId('previa-broadcast');
    expect(previas).toHaveLength(3);
    expect(previas[0]).toHaveTextContent('Para Marina');
    expect(previas[0]).toHaveTextContent('Oi Marina! Passando para avisar da sexta.');
    expect(previas[1]).toHaveTextContent('Para João');
    expect(previas[1]).toHaveTextContent('Oi João! Passando para avisar da sexta.');
    expect(previas[2]).toHaveTextContent('Para Ana-Clara');
    expect(previas[2]).toHaveTextContent('Oi Ana-Clara! Passando para avisar da sexta.');
    for (const previa of previas) expect(previa).not.toHaveTextContent(/Souza|Pedro|Lima/);
  });

  it('usa a MESMA renderizarModelo do envio, com o gatilho "broadcast", o texto e o nome do cadastro', async () => {
    await abrirBroadcast();
    h.renderizar = [];
    escrever('Mensagem', 'Oi {nome}!');
    const chamadas = h.renderizar.filter((a) => a[1] === 'Oi {nome}!');
    expect(chamadas.length).toBeGreaterThanOrEqual(3);
    expect(chamadas.map((a) => a[0])).toEqual(chamadas.map(() => 'broadcast'));
    expect(chamadas.map((a) => (a[2] as { nome: string }).nome)).toEqual(expect.arrayContaining(['Marina Souza', 'JOÃO PEDRO LIMA', 'ana-clara lima']));
    const esperado = renderizarModelo('broadcast', 'Oi {nome}!', { nome: 'Marina Souza' }).texto as string;
    expect(screen.getAllByTestId('previa-broadcast')[0]).toHaveTextContent(esperado);
  });

  it('sem texto mostra a dica, e no teste A/B cada variante tem 2 nomes de exemplo', async () => {
    await abrirBroadcast();
    expect(screen.getAllByTestId('previa-broadcast')).toHaveLength(3);
    expect(screen.getAllByText('Escreva a mensagem para ver o exemplo.')).toHaveLength(3);
    fireEvent.click(interruptorAB());
    expect(screen.getAllByTestId('previa-broadcast')).toHaveLength(4);
    expect(screen.getAllByText('Escreva a variante A.')).toHaveLength(2);
    escrever('Variante B', 'Olá {nome}.');
    expect(screen.getAllByText('Escreva a variante A.')).toHaveLength(2);
    expect(screen.queryByText('Escreva a variante B.')).not.toBeInTheDocument();
    const previasB = screen.getAllByTestId('previa-broadcast').slice(2);
    expect(previasB[0]).toHaveTextContent('Olá Marina.');
    expect(previasB[1]).toHaveTextContent('Olá João.');
  });

  it('com variável inválida não mostra texto cru na prévia e pede para corrigir', async () => {
    await abrirBroadcast();
    escrever('Mensagem', 'Oi {nome}! Sexta às {horario}.');
    for (const previa of screen.getAllByTestId('previa-broadcast')) {
      expect(previa).toHaveTextContent('Corrija o aviso do texto para ver o exemplo.');
      expect(previa).not.toHaveTextContent('{horario}');
    }
  });
});

describe('Aba Broadcast: variável não permitida', () => {
  it.each([
    ['{horario}', 'Oi {nome}! Sexta às {horario}.'],
    ['{data}', 'Oi {nome}! Dia {data}.'],
    ['{dimensao}', 'Oi {nome}! Seu {dimensao}.'],
    ['chave solta', 'Oi {nome! Tudo bem?'],
    ['chave dupla', 'Oi {{nome}}!'],
  ])('%s: mostra o aviso em linha própria e trava o botão de enviar', async (_rotulo, texto) => {
    await abrirBroadcast();
    escrever('Título interno', 'Teste');
    escrever('Mensagem', texto);
    expect(botaoDisparar()).toBeDisabled();
    const aviso = screen.getAllByRole('alert');
    expect(aviso.length).toBeGreaterThan(0);
    expect(aviso[0]).toHaveClass('break-words');
    fireEvent.click(botaoDisparar());
    expect(screen.queryByRole('button', { name: 'Confirmar envio' })).not.toBeInTheDocument();
    expect(h.inseridos).toEqual([]);
  });

  it('o aviso diz que só {nome} funciona e some quando o texto é corrigido, liberando o botão', async () => {
    await abrirBroadcast();
    escrever('Mensagem', 'Oi {nome}! Sexta às {horario}.');
    expect(screen.getByRole('alert')).toHaveTextContent('Só a variável {nome} funciona');
    expect(screen.getByLabelText('Mensagem')).toHaveAttribute('aria-invalid', 'true');
    escrever('Mensagem', 'Oi {nome}! Sexta às 7h.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Mensagem')).toHaveAttribute('aria-invalid', 'false');
    expect(botaoDisparar()).toBeEnabled();
  });

  it('{ Nome } e {NOME} valem como {nome} e não travam', async () => {
    await abrirBroadcast();
    escrever('Mensagem', 'Oi { Nome }! Tudo bem, {NOME}?');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(botaoDisparar()).toBeEnabled();
    expect(screen.getAllByTestId('previa-broadcast')[0]).toHaveTextContent('Oi Marina! Tudo bem, Marina?');
  });

  it('texto acima de 1000 caracteres trava, e 1000 exatos passam; o contador fica em linha própria', async () => {
    await abrirBroadcast();
    escrever('Mensagem', 'a'.repeat(1001));
    expect(botaoDisparar()).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('passa de 1000 caracteres');
    expect(screen.getByText('1001/1000 caracteres').tagName).toBe('P');
    escrever('Mensagem', 'a'.repeat(1000));
    expect(botaoDisparar()).toBeEnabled();
    expect(screen.getByText('1000/1000 caracteres')).toBeInTheDocument();
  });

  it('o contador conta caracteres reais (emoji conta 1) e ignora espaços das pontas', async () => {
    await abrirBroadcast();
    escrever('Mensagem', '  Oi 💙  ');
    expect(screen.getByText('4/1000 caracteres')).toBeInTheDocument();
  });

  it.each([['vazio', ''], ['só espaços', '   \n ']])('texto %s não trava o botão: ele avisa "Preencha a mensagem" como sempre', async (_rotulo, texto) => {
    await abrirBroadcast();
    escrever('Título interno', 'Sem texto');
    escrever('Mensagem', texto);
    expect(botaoDisparar()).toBeEnabled();
    fireEvent.click(botaoDisparar());
    expect(h.toasts).toContainEqual(['erro', 'Preencha a mensagem']);
    expect(screen.queryByTestId('frase-confirmacao')).not.toBeInTheDocument();
    expect(h.inseridos).toEqual([]);
  });

  it('no teste A/B, uma variante inválida trava o envio e o aviso fica na variante certa', async () => {
    await abrirBroadcast();
    fireEvent.click(interruptorAB());
    escrever('Título interno', 'Teste');
    escrever('Variante A', 'Oi {nome}! Versão A.');
    escrever('Variante B', 'Olá {nome}. Às {horario}.');
    expect(botaoDisparar()).toBeDisabled();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByLabelText('Variante A')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByLabelText('Variante B')).toHaveAttribute('aria-invalid', 'true');
    escrever('Variante B', 'Olá {nome}. Versão B.');
    expect(botaoDisparar()).toBeEnabled();
  });

  it('com o teste A/B ligado, o texto da mensagem única (escondida) não trava o envio', async () => {
    await abrirBroadcast();
    escrever('Mensagem', 'Oi {horario}');
    fireEvent.click(interruptorAB());
    escrever('Variante A', 'Oi {nome}! A.');
    escrever('Variante B', 'Oi {nome}! B.');
    expect(botaoDisparar()).toBeEnabled();
  });
});

describe('Aba Broadcast: confirmação', () => {
  const preparar = async (texto = 'Oi {nome}! A clínica abre às 7h na sexta.') => {
    await abrirBroadcast();
    escrever('Título interno', 'Campanha');
    escrever('Mensagem', texto);
  };

  it('mostra a frase já com o nome trocado, a quantidade, o modo sem IA e o aviso de envio real', async () => {
    await preparar();
    fireEvent.click(botaoDisparar());
    const frase = await screen.findByTestId('frase-confirmacao');
    expect(frase).toHaveTextContent('Oi Marina! A clínica abre às 7h na sexta.');
    expect(frase).not.toHaveTextContent('{nome}');
    expect(screen.getByText('Enviar agora para 2 paciente(s)? (1 envio a cada 5s)')).toBeInTheDocument();
    expect(screen.getByText('Exemplo da mensagem para Marina:')).toBeInTheDocument();
    expect(screen.getByText(/Sem IA: cada cliente recebe exatamente este texto/)).toBeInTheDocument();
    expect(screen.getByText('Isso envia mensagem real no WhatsApp. Não dá para desfazer.')).toBeInTheDocument();
    expect(screen.queryByText(/pode sair até 1 hora depois/)).not.toBeInTheDocument();
    expect(h.inseridos).toEqual([]);
  });

  it('com a IA ligada avisa que o texto enviado pode ser diferente do exemplo', async () => {
    await preparar();
    fireEvent.click(interruptorIA());
    fireEvent.click(botaoDisparar());
    await screen.findByTestId('frase-confirmacao');
    expect(screen.getByText(/Com IA: cada mensagem é reescrita para o cliente/)).toBeInTheDocument();
    expect(screen.queryByText(/Sem IA:/)).not.toBeInTheDocument();
  });

  it('campanha agendada avisa que pode sair até 1 hora depois do horário', async () => {
    await preparar();
    fireEvent.click(interruptorAgendar());
    fireEvent.change(document.querySelector('input[type="datetime-local"]') as HTMLElement, { target: { value: '2099-01-01T10:00' } });
    fireEvent.click(botaoDisparar());
    await screen.findByTestId('frase-confirmacao');
    expect(screen.getByText('Agendar esta campanha para 2 paciente(s)?')).toBeInTheDocument();
    expect(screen.getByText('A campanha agendada pode sair até 1 hora depois do horário escolhido.')).toBeInTheDocument();
  });

  it('no teste A/B mostra a frase de cada variante, com o nome da variante', async () => {
    await abrirBroadcast();
    fireEvent.click(interruptorAB());
    escrever('Título interno', 'Teste');
    escrever('Variante A', 'Oi {nome}! Versão A.');
    escrever('Variante B', 'Olá {nome}. Versão B.');
    fireEvent.click(botaoDisparar());
    const frases = await screen.findAllByTestId('frase-confirmacao');
    expect(frases).toHaveLength(2);
    expect(frases[0]).toHaveTextContent('Variante A');
    expect(frases[0]).toHaveTextContent('Oi Marina! Versão A.');
    expect(frases[1]).toHaveTextContent('Variante B');
    expect(frases[1]).toHaveTextContent('Olá Marina. Versão B.');
  });

  it('Cancelar fecha a confirmação sem gravar nada', async () => {
    await preparar();
    fireEvent.click(botaoDisparar());
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByTestId('frase-confirmacao')).not.toBeInTheDocument();
    expect(botaoDisparar()).toBeInTheDocument();
    expect(h.inseridos).toEqual([]);
  });

  it('se o texto passar a ter variável inválida com a confirmação aberta, o botão de confirmar trava', async () => {
    await preparar();
    fireEvent.click(botaoDisparar());
    const confirmar = await screen.findByRole('button', { name: 'Confirmar envio' });
    expect(confirmar).toBeEnabled();
    escrever('Mensagem', 'Oi {nome}! Às {horario}.');
    expect(confirmar).toBeDisabled();
    fireEvent.click(confirmar);
    expect(h.inseridos).toEqual([]);
  });

  it('se o texto for apagado com a confirmação aberta, o botão de confirmar também trava', async () => {
    await preparar();
    fireEvent.click(botaoDisparar());
    const confirmar = await screen.findByRole('button', { name: 'Confirmar envio' });
    escrever('Mensagem', '   ');
    expect(confirmar).toBeDisabled();
  });

  it('mudar o segmento ou a data com a confirmação aberta fecha a confirmação (a lista de clientes ficaria velha)', async () => {
    await preparar();
    fireEvent.click(botaoDisparar());
    await screen.findByTestId('frase-confirmacao');
    abrirLista(screen.getAllByRole('combobox')[0]);
    fireEvent.click(await screen.findByRole('option', { name: 'Aniversariantes do mês' }));
    await waitFor(() => expect(screen.queryByTestId('frase-confirmacao')).not.toBeInTheDocument());

    fireEvent.click(interruptorAgendar());
    const data = document.querySelector('input[type="datetime-local"]') as HTMLElement;
    fireEvent.change(data, { target: { value: '2099-01-01T10:00' } });
    abrirLista(screen.getAllByRole('combobox')[0]);
    fireEvent.click(await screen.findByRole('option', { name: 'Todos os pacientes ativos' }));
    fireEvent.click(botaoDisparar());
    await screen.findByTestId('frase-confirmacao');
    fireEvent.change(data, { target: { value: '2099-02-02T10:00' } });
    await waitFor(() => expect(screen.queryByTestId('frase-confirmacao')).not.toBeInTheDocument());
    fireEvent.click(botaoDisparar());
    await screen.findByTestId('frase-confirmacao');
    fireEvent.click(interruptorAgendar());
    await waitFor(() => expect(screen.queryByTestId('frase-confirmacao')).not.toBeInTheDocument());
    expect(h.inseridos).toEqual([]);
  });

  it('editar o texto com a confirmação aberta NÃO a fecha: ela mostra a frase nova', async () => {
    await preparar();
    fireEvent.click(botaoDisparar());
    await screen.findByTestId('frase-confirmacao');
    escrever('Mensagem', 'Oi {nome}! Texto novo.');
    expect(screen.getByTestId('frase-confirmacao')).toHaveTextContent('Oi Marina! Texto novo.');
  });

  it('o clique duplo em Confirmar grava uma campanha só', async () => {
    await preparar();
    fireEvent.click(botaoDisparar());
    const confirmar = await screen.findByRole('button', { name: 'Confirmar envio' });
    fireEvent.click(confirmar);
    fireEvent.click(confirmar);
    await waitFor(() => expect(h.invocacoes).toHaveLength(1));
    expect(h.inseridos).toHaveLength(1);
  });
});

describe('Aba Broadcast: segmento "MyID vencido"', () => {
  const myid = (paciente: string, diasAtras: number): Linha => ({ id: `m-${paciente}-${diasAtras}`, terapeuta_id: 'T1', paciente_id: paciente, updated_at: iso(diasAtras), status: 'concluido' });

  async function dispararNoSegmento(tabelas: Record<string, Linha[]>) {
    await abrirBroadcast(tabelas);
    abrirLista(screen.getAllByRole('combobox')[0]);
    fireEvent.click(await screen.findByRole('option', { name: 'MyID vencido (último há 30+ dias)' }));
    escrever('Título interno', 'Refazer MyID');
    escrever('Mensagem', 'Oi {nome}! Que tal atualizar o seu MyID?');
    fireEvent.click(botaoDisparar());
    fireEvent.click(await screen.findByRole('button', { name: /Confirmar envio/ }));
    await waitFor(() => expect(h.inseridos).toHaveLength(1));
    return h.inseridos[0];
  }

  it('só entra quem tem a ÚLTIMA avaliação com 30 dias ou mais: quem já refez, quem nunca fez e quem está inativo ficam fora', async () => {
    const campanha = await dispararNoSegmento({
      pacientes: [cliente('P1'), cliente('P2'), cliente('P3'), cliente('P4', { ativo: false }), cliente('P5', { telefone: null }), cliente('P6')],
      myid_avaliacoes: [
        myid('P1', 45),
        myid('P2', 90), myid('P2', 5),
        myid('P4', 60),
        myid('P5', 60),
        myid('P6', 30),
      ],
    });
    expect(campanha.paciente_ids).toEqual(['P1', 'P6']);
    expect(campanha.total).toBe(2);
    expect(campanha.filtro).toEqual({ segmento: 'myid_vencido', personalizar_ia: false });
  });

  it('com mais avaliações que o teto de leitura (6000), a mais nova ainda conta: a leitura vai da mais nova para a mais velha', async () => {
    const antigas = Array.from({ length: 6100 }, (_, i) => ({ id: `velha-${i}`, terapeuta_id: 'T1', paciente_id: 'P1', updated_at: iso(60 + (i % 400)), status: 'concluido' }));
    const campanha = await dispararNoSegmento({
      pacientes: [cliente('P1'), cliente('P2')],
      myid_avaliacoes: [...antigas, myid('P1', 2), myid('P2', 50)],
    });
    expect(campanha.paciente_ids).toEqual(['P2']);
  });

  it('avaliação de outro profissional não entra', async () => {
    const campanha = await dispararNoSegmento({
      pacientes: [cliente('P1'), cliente('P2')],
      myid_avaliacoes: [myid('P1', 45), { ...myid('P2', 45), terapeuta_id: 'T2' }],
    });
    expect(campanha.paciente_ids).toEqual(['P1']);
  });

  it('sem nenhum cliente vencido avisa e não cria campanha', async () => {
    await abrirBroadcast({ pacientes: [cliente('P1')], myid_avaliacoes: [myid('P1', 3)] });
    abrirLista(screen.getAllByRole('combobox')[0]);
    fireEvent.click(await screen.findByRole('option', { name: 'MyID vencido (último há 30+ dias)' }));
    escrever('Título interno', 'Refazer');
    escrever('Mensagem', 'Oi {nome}!');
    fireEvent.click(botaoDisparar());
    await waitFor(() => expect(h.toasts).toContainEqual(['erro', 'Nenhum paciente encontrado nesse segmento']));
    expect(h.inseridos).toEqual([]);
  });
});

describe('Aba Broadcast: celular de 390 px (contrato das classes)', () => {
  it('colunas empilhadas abaixo de md, alvos de 44 px e quebra de linha nos textos', async () => {
    await abrirBroadcast();
    escrever('Título interno', 'Teste');
    escrever('Mensagem', 'Oi {nome}!');
    for (const interruptor of [interruptorIA(), interruptorAB(), interruptorAgendar()]) {
      expect(interruptor.closest('label')).toHaveClass('min-h-11');
    }
    expect(screen.getByLabelText('Título interno')).toHaveClass('min-h-11');
    expect(screen.getAllByRole('combobox')[0]).toHaveClass('min-h-11');
    expect(botaoDisparar()).toHaveClass('min-h-11', 'w-full');
    const colunas = screen.getByLabelText('Mensagem').closest('.grid') as HTMLElement;
    expect(colunas).toHaveClass('md:grid-cols-2');
    expect(colunas.className).not.toMatch(/(^|\s)grid-cols-2/);
    expect(screen.getByLabelText('Mensagem').parentElement).toHaveClass('min-w-0');
    fireEvent.click(botaoDisparar());
    const pergunta = await screen.findByText(/Enviar agora para/);
    expect(pergunta).toHaveClass('break-words');
    expect(screen.getByTestId('frase-confirmacao').querySelector('p')).toHaveClass('break-words', 'whitespace-pre-wrap');
    const botoes = screen.getByRole('button', { name: 'Confirmar envio' });
    expect(botoes).toHaveClass('min-h-11', 'w-full');
    expect(botoes.parentElement).toHaveClass('flex-col', 'sm:flex-row');
    expect(document.body.innerHTML).not.toContain('text-[11px]');
  });

  it('o campo de peso do teste A/B tem 44 px de altura e a lista de variantes não estoura a coluna', async () => {
    await abrirBroadcast();
    fireEvent.click(interruptorAB());
    expect(screen.getByLabelText('Peso %', { selector: '#broadcast-peso-A' })).toHaveClass('min-h-11');
    const variante = screen.getByLabelText('Variante A').closest('.grid') as HTMLElement;
    expect(variante).toHaveClass('md:grid-cols-2');
    expect(within(variante).getAllByTestId('previa-broadcast')).toHaveLength(2);
  });
});

describe('Modo escuro', () => {
  it('o painel de confirmação e o aviso de erro usam as cores com variante dark', async () => {
    await abrirBroadcast();
    escrever('Título interno', 'Teste');
    escrever('Mensagem', 'Oi {nome}!');
    fireEvent.click(botaoDisparar());
    const painel = (await screen.findByTestId('frase-confirmacao')).parentElement?.parentElement as HTMLElement;
    expect(painel.className).toContain('dark:bg-amber-950/20');
    expect(painel.className).toContain('dark:border-amber-800/60');
    expect(screen.getByTestId('frase-confirmacao').className).toContain('dark:border-amber-800/60');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    escrever('Mensagem', 'Oi {horario}');
    expect(screen.getByRole('alert')).toHaveClass('text-destructive');
  });
});
