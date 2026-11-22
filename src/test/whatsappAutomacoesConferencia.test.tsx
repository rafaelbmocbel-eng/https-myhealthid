// Tela de Automações do WhatsApp (src/pages/WhatsappAutomacoes.tsx), segunda rodada: cada teste daqui prova uma correção
// que os conferentes pediram e FALHA se a correção for desfeita. Banco falso, nada vai à rede nem manda mensagem.
// Cobre: corrida do segmento (T1), agendar sem data (T5), rótulo do botão, nome comprido no limite de 1000 (T3), foco e
// anúncio da confirmação (T4), variante A/B vazia, nomes acessíveis e avisos ligados ao campo (T6/T7), texto sem caixa
// alta (T8), paginação dos últimos 7 dias (T9), toast da mensagem vazia (T10) e a legenda dos Gatilhos (T2).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';

const h = vi.hoisted(() => {
  type Resposta = { data: unknown; error: unknown };
  interface Ganchos {
    chamou?: (metodo: string, args: unknown[]) => void;
    antes?: () => Promise<void> | undefined;
    depois?: (resposta: Resposta) => Resposta;
  }
  // Envolve a consulta do banco falso: anota as chamadas encadeadas, segura a resposta e pode mexer nela (por exemplo,
  // cortar em 1000 linhas como o PostgREST). O encadeamento devolve sempre o envoltório.
  const embrulhar = (consulta: object, ganchos: Ganchos): object => {
    const envoltorio: object = new Proxy(consulta, {
      get(alvo, prop) {
        if (prop === 'then') {
          return (resolver?: (r: Resposta) => unknown, rejeitar?: (e: unknown) => unknown) =>
            Promise.resolve(ganchos.antes?.())
              .then(() => (alvo as PromiseLike<Resposta>).then((r) => (ganchos.depois ? ganchos.depois(r) : r)))
              .then(resolver, rejeitar);
        }
        const valor = Reflect.get(alvo, prop, alvo);
        if (typeof valor !== 'function') return valor;
        return (...args: unknown[]) => {
          ganchos.chamou?.(String(prop), args);
          const resultado = valor.apply(alvo, args);
          return resultado === alvo ? envoltorio : resultado;
        };
      },
    });
    return envoltorio;
  };
  return {
    embrulhar,
    banco: null as unknown,
    inseridos: [] as Array<Record<string, unknown>>,
    invocacoes: [] as Array<[string, unknown]>,
    toasts: [] as Array<[string, string]>,
    leituras: [] as Array<[string, ...unknown[]]>,
    fetchChamado: [] as string[],
    porta: null as null | { espera: Promise<void>; liberar: () => void },
    esperando: 0,
  };
});

vi.mock('sonner', () => ({
  toast: {
    error: (m: string) => h.toasts.push(['erro', m]),
    success: (m: string) => h.toasts.push(['ok', m]),
  },
}));
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
      const banco = h.banco as BancoFalso;
      if (tabela === 'agente_broadcasts') {
        return {
          insert: (payload: Record<string, unknown>) => {
            h.inseridos.push(payload);
            return { select: () => ({ single: () => Promise.resolve({ data: { id: 'bc-1' }, error: null }) }) };
          },
        };
      }
      if (tabela === 'pacientes') {
        // Enquanto houver uma porta fechada, a lista de clientes demora: é a janela da corrida do segmento.
        return h.embrulhar(banco.from(tabela) as object, {
          antes: () => {
            if (!h.porta) return undefined;
            h.esperando += 1;
            return h.porta.espera;
          },
        });
      }
      if (tabela === 'agente_disparos') {
        // Como o PostgREST, cada resposta traz no máximo 1000 linhas: sem paginar, a tela subconta.
        return h.embrulhar(banco.from(tabela) as object, {
          chamou: (metodo, args) => { h.leituras.push([metodo, ...args]); },
          depois: (r) => (Array.isArray(r.data) && r.data.length > 1000 ? { ...r, data: r.data.slice(0, 1000) } : r),
        });
      }
      return banco.from(tabela);
    },
  },
}));

import WhatsappAutomacoes from '@/pages/WhatsappAutomacoes';

const rolar = vi.fn();
Element.prototype.scrollIntoView = rolar;

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
const avaliacao = (paciente: string, diasAtras: number): Linha => ({ id: `m-${paciente}-${diasAtras}`, terapeuta_id: 'T1', paciente_id: paciente, updated_at: iso(diasAtras), status: 'concluido' });

// 'todos' devolve P1, P2 e P3; 'MyID vencido' devolve só P1 (P2 refez o MyID e P3 nunca fez): as duas listas são diferentes.
const TRES_CLIENTES = [cliente('P1'), cliente('P2'), cliente('P3')];
const AVALIACOES = [avaliacao('P1', 45), avaliacao('P2', 90), avaliacao('P2', 5)];
const OPCAO_TODOS = 'Todos os pacientes ativos';
const OPCAO_MYID = 'MyID vencido (último há 30+ dias)';

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
const botaoPrincipal = (nome: 'Disparar agora' | 'Agendar campanha') => screen.getByRole('button', { name: nome });
const botaoDisparar = () => screen.getByRole('button', { name: /Disparar agora|Agendar campanha/ });
const interruptorAB = () => screen.getByRole('switch', { name: 'Teste A/B' });
const interruptorIA = () => screen.getByRole('switch', { name: 'Personalizar com IA' });
const interruptorAgendar = () => screen.getByRole('switch', { name: 'Agendar envio' });
const segmentoSelect = () => screen.getByRole('combobox', { name: /Segmento/ });
const campoData = () => screen.getByLabelText('Data e hora do envio');
const abrirLista = (combo: HTMLElement) => fireEvent.keyDown(combo, { key: 'Enter' });
const painelAberto = () => screen.findByRole('alertdialog');

const escolherSegmento = async (opcao: string) => {
  abrirLista(segmentoSelect());
  fireEvent.click(await screen.findByRole('option', { name: opcao }));
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
};
const preencherCampanha = (texto = 'Oi {nome}! A clínica abre às 7h na sexta.') => {
  escrever('Título interno', 'Campanha');
  escrever('Mensagem', texto);
};
const agendarPara = (valor: string) => {
  fireEvent.click(interruptorAgendar());
  fireEvent.change(campoData(), { target: { value: valor } });
};
const segurarConsultaDeClientes = () => {
  let liberar: () => void = () => undefined;
  const espera = new Promise<void>((resolver) => { liberar = resolver; });
  h.porta = { espera, liberar };
  return () => {
    h.porta = null;
    liberar();
  };
};
const aguardarConsultaPendente = () => waitFor(() => expect(h.esperando).toBe(1));
const confirmarEEsperarGravar = async (nome: 'Confirmar envio' | 'Confirmar agendamento') => {
  fireEvent.click(await screen.findByRole('button', { name: nome }));
  await waitFor(() => expect(h.inseridos).toHaveLength(1));
};
const comTamanho = (total: number, modelo = 'Oi {nome}! ') => modelo + 'a'.repeat(total - modelo.length);
const idsDoDescribedby = (el: HTMLElement) => (el.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(AGORA));
  vi.stubGlobal('fetch', fetchProibido);
  h.inseridos = [];
  h.invocacoes = [];
  h.toasts = [];
  h.leituras = [];
  h.fetchChamado = [];
  h.porta = null;
  h.esperando = 0;
  rolar.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  expect(h.fetchChamado).toEqual([]);
});

describe('T1: corrida do segmento enquanto a lista de clientes é resolvida', () => {
  it('com "Agendar campanha": o botão, o seletor, o "Agendar envio" e a data ficam desabilitados e nada é gravado até a lista chegar', async () => {
    await abrirBroadcast({ pacientes: TRES_CLIENTES, myid_avaliacoes: AVALIACOES });
    preencherCampanha();
    agendarPara('2099-01-01T10:00');
    const liberar = segurarConsultaDeClientes();
    fireEvent.click(botaoPrincipal('Agendar campanha'));
    await aguardarConsultaPendente();

    expect(botaoPrincipal('Agendar campanha')).toBeDisabled();
    expect(segmentoSelect()).toBeDisabled();
    expect(interruptorAgendar()).toBeDisabled();
    expect(campoData()).toBeDisabled();

    abrirLista(segmentoSelect());
    expect(screen.queryByRole('option', { name: OPCAO_MYID })).not.toBeInTheDocument();
    fireEvent.click(interruptorAgendar());
    expect(interruptorAgendar()).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(botaoPrincipal('Agendar campanha'));
    expect(h.esperando).toBe(1);
    expect(h.inseridos).toEqual([]);
    expect(h.invocacoes).toEqual([]);

    liberar();
    const painel = await painelAberto();
    expect(painel).toHaveTextContent('Agendar esta campanha para 3 paciente(s)?');
    expect(segmentoSelect()).toBeEnabled();
    expect(segmentoSelect()).toHaveTextContent(OPCAO_TODOS);
    expect(interruptorAgendar()).toBeEnabled();
    expect(campoData()).toBeEnabled();
    await confirmarEEsperarGravar('Confirmar agendamento');
    expect(h.inseridos[0].filtro).toEqual({ segmento: 'todos', personalizar_ia: false });
    expect(h.inseridos[0].paciente_ids).toEqual(['P1', 'P2', 'P3']);
    expect(h.invocacoes).toEqual([]);
  });

  it('com "Disparar agora": o botão e o seletor travam durante a conferência e o POST sai com o segmento e a lista do clique', async () => {
    await abrirBroadcast({ pacientes: TRES_CLIENTES, myid_avaliacoes: AVALIACOES });
    preencherCampanha();
    const liberar = segurarConsultaDeClientes();
    fireEvent.click(botaoPrincipal('Disparar agora'));
    await aguardarConsultaPendente();

    expect(botaoPrincipal('Disparar agora')).toBeDisabled();
    expect(segmentoSelect()).toBeDisabled();
    expect(interruptorAgendar()).toBeDisabled();
    abrirLista(segmentoSelect());
    expect(screen.queryByRole('option', { name: OPCAO_MYID })).not.toBeInTheDocument();
    expect(segmentoSelect()).toHaveTextContent(OPCAO_TODOS);

    liberar();
    expect(await painelAberto()).toHaveTextContent('Enviar agora para 3 paciente(s)? (1 envio a cada 5s)');
    expect(segmentoSelect()).toHaveTextContent(OPCAO_TODOS);
    await confirmarEEsperarGravar('Confirmar envio');
    expect(h.inseridos[0].filtro).toEqual({ segmento: 'todos', personalizar_ia: false });
    expect(h.inseridos[0].paciente_ids).toEqual(['P1', 'P2', 'P3']);
    expect(h.inseridos[0].total).toBe(3);
  });

  // O seletor travado não deixa a troca acontecer pela tela. Aqui o seletor é aberto ANTES do clique para forçar a troca
  // durante a conferência: mesmo assim a campanha não pode sair com a lista de um segmento e o rótulo de outro.
  it.each([
    ['todos', null, OPCAO_MYID, ['P1', 'P2', 'P3']],
    ['myid_vencido', OPCAO_MYID, OPCAO_TODOS, ['P1']],
  ])('segmento do clique "%s" e troca forçada durante a conferência: grava o segmento do clique com a lista dele', async (segmentoDoClique, opcaoDoClique, opcaoDaTroca, listaEsperada) => {
    await abrirBroadcast({ pacientes: TRES_CLIENTES, myid_avaliacoes: AVALIACOES });
    if (opcaoDoClique) await escolherSegmento(opcaoDoClique as string);
    preencherCampanha();
    const botao = botaoPrincipal('Disparar agora');
    abrirLista(segmentoSelect());
    const opcao = await screen.findByRole('option', { name: opcaoDaTroca as string });
    const liberar = segurarConsultaDeClientes();
    fireEvent.click(botao);
    await aguardarConsultaPendente();
    fireEvent.click(opcao);
    liberar();

    const painel = await painelAberto();
    expect(painel).toHaveTextContent(`Enviar agora para ${(listaEsperada as string[]).length} paciente(s)?`);
    await confirmarEEsperarGravar('Confirmar envio');
    expect(h.inseridos[0].filtro).toEqual({ segmento: segmentoDoClique, personalizar_ia: false });
    expect(h.inseridos[0].paciente_ids).toEqual(listaEsperada);
    expect(h.inseridos[0].total).toBe((listaEsperada as string[]).length);
  });

  it('segmento sem clientes avisa e libera de novo o botão, o seletor e o "Agendar envio"', async () => {
    await abrirBroadcast({ pacientes: [], myid_avaliacoes: [] });
    preencherCampanha();
    fireEvent.click(botaoPrincipal('Disparar agora'));
    await waitFor(() => expect(h.toasts).toContainEqual(['erro', 'Nenhum paciente encontrado nesse segmento']));
    await waitFor(() => expect(botaoPrincipal('Disparar agora')).toBeEnabled());
    expect(segmentoSelect()).toBeEnabled();
    expect(interruptorAgendar()).toBeEnabled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(h.inseridos).toEqual([]);
  });

  it('data no passado também libera a tela de novo depois do aviso', async () => {
    await abrirBroadcast();
    preencherCampanha();
    agendarPara('2020-01-01T10:00');
    fireEvent.click(botaoPrincipal('Agendar campanha'));
    await waitFor(() => expect(h.toasts).toContainEqual(['erro', 'Data de agendamento deve ser no futuro']));
    await waitFor(() => expect(botaoPrincipal('Agendar campanha')).toBeEnabled());
    expect(campoData()).toBeEnabled();
    expect(segmentoSelect()).toBeEnabled();
  });
});

describe('T5: "Agendar envio" ligado', () => {
  it('sem data, "Agendar campanha" só avisa: nenhuma consulta, confirmação, gravação nem função', async () => {
    await abrirBroadcast();
    preencherCampanha();
    fireEvent.click(interruptorAgendar());
    expect(campoData()).toHaveValue('');
    fireEvent.click(botaoPrincipal('Agendar campanha'));
    expect(h.toasts).toEqual([['erro', 'Escolha a data e a hora do agendamento']]);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('frase-confirmacao')).not.toBeInTheDocument();
    expect(banco().operacoes.filter((o) => o.tabela === 'pacientes')).toEqual([]);
    expect(h.inseridos).toEqual([]);
    expect(h.invocacoes).toEqual([]);
    expect(botaoPrincipal('Agendar campanha')).toBeEnabled();
  });

  it('com data no passado avisa que a data deve ser no futuro e não abre confirmação', async () => {
    await abrirBroadcast();
    preencherCampanha();
    agendarPara('2020-01-01T10:00');
    fireEvent.click(botaoPrincipal('Agendar campanha'));
    await waitFor(() => expect(h.toasts).toEqual([['erro', 'Data de agendamento deve ser no futuro']]));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(h.inseridos).toEqual([]);
    expect(h.invocacoes).toEqual([]);
  });

  it('com data no futuro abre a confirmação de AGENDAMENTO e só grava ao confirmar, sem chamar a função', async () => {
    await abrirBroadcast();
    preencherCampanha();
    agendarPara('2099-01-01T10:00');
    fireEvent.click(botaoPrincipal('Agendar campanha'));
    const painel = await painelAberto();
    expect(painel).toHaveTextContent('Agendar esta campanha para 2 paciente(s)?');
    expect(screen.getByRole('button', { name: 'Confirmar agendamento' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirmar envio' })).not.toBeInTheDocument();
    expect(h.toasts).toEqual([]);
    expect(h.inseridos).toEqual([]);
    await confirmarEEsperarGravar('Confirmar agendamento');
    expect(h.inseridos[0].agendado_para).toBe(new Date('2099-01-01T10:00').toISOString());
    expect(h.invocacoes).toEqual([]);
  });

  it('com "Agendar envio" desligado depois de escolher a data, o envio é imediato: sem agendado_para e com a função chamada', async () => {
    await abrirBroadcast();
    preencherCampanha();
    agendarPara('2099-01-01T10:00');
    fireEvent.click(interruptorAgendar());
    expect(screen.queryByLabelText('Data e hora do envio')).not.toBeInTheDocument();
    fireEvent.click(botaoPrincipal('Disparar agora'));
    expect(await painelAberto()).toHaveTextContent('Enviar agora para 2 paciente(s)?');
    await confirmarEEsperarGravar('Confirmar envio');
    expect(h.inseridos[0].agendado_para).toBeNull();
    await waitFor(() => expect(h.invocacoes).toEqual([['agente-broadcast', { body: { broadcast_id: 'bc-1' } }]]));
  });
});

describe('N10: o nome do botão principal', () => {
  it('com "Agendar envio" ligado o nome é exatamente "Agendar campanha", e desligado é exatamente "Disparar agora"', async () => {
    await abrirBroadcast();
    expect(screen.getByRole('button', { name: 'Disparar agora' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agendar campanha' })).not.toBeInTheDocument();
    fireEvent.click(interruptorAgendar());
    expect(screen.getByRole('button', { name: 'Agendar campanha' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Disparar agora' })).not.toBeInTheDocument();
    fireEvent.click(interruptorAgendar());
    expect(screen.getByRole('button', { name: 'Disparar agora' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agendar campanha' })).not.toBeInTheDocument();
  });
});

describe('T3: nome comprido no lugar de {nome} (limite de 1000 depois da troca)', () => {
  it('1000 caracteres com {nome}: mostra o aviso (role alert), marca o campo como inválido e trava o botão', async () => {
    await abrirBroadcast();
    preencherCampanha(comTamanho(1000));
    expect(screen.getByText('1000/1000 caracteres')).toBeInTheDocument();
    const aviso = screen.getByRole('alert');
    expect(aviso).toHaveTextContent('nome comprido');
    expect(aviso).toHaveTextContent('no lugar de {nome}');
    expect(aviso).toHaveTextContent('passa de 1000 caracteres');
    expect(aviso).toHaveTextContent('Encurte o texto');
    expect(screen.getByLabelText('Mensagem')).toHaveAttribute('aria-invalid', 'true');
    expect(botaoDisparar()).toBeDisabled();
    fireEvent.click(botaoDisparar());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(h.inseridos).toEqual([]);
  });

  it.each([970, 976])('%i caracteres no total com {nome}: sem aviso, campo válido e botão liberado', async (total) => {
    await abrirBroadcast();
    preencherCampanha(comTamanho(total));
    expect(screen.getByText(`${total}/1000 caracteres`)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Mensagem')).toHaveAttribute('aria-invalid', 'false');
    expect(botaoDisparar()).toBeEnabled();
  });

  it('977 é o primeiro tamanho com aviso: com um nome de 30 letras o texto chega a 1001', async () => {
    await abrirBroadcast();
    preencherCampanha(comTamanho(977));
    expect(screen.getByRole('alert')).toHaveTextContent('nome comprido');
    expect(botaoDisparar()).toBeDisabled();
  });

  it('1001 caracteres: vale o aviso antigo de "passa de 1000", sem o do nome comprido', async () => {
    await abrirBroadcast();
    preencherCampanha(comTamanho(1001));
    const avisos = screen.getAllByRole('alert');
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toHaveTextContent('A mensagem passa de 1000 caracteres. Encurte o texto.');
    expect(avisos[0]).not.toHaveTextContent('nome comprido');
    expect(botaoDisparar()).toBeDisabled();
  });

  it('no teste A/B o aviso fica na variante certa e a campanha trava', async () => {
    await abrirBroadcast();
    fireEvent.click(interruptorAB());
    escrever('Título interno', 'Teste');
    escrever('Variante A', 'Oi {nome}! Versão A.');
    escrever('Variante B', comTamanho(1000));
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByLabelText('Variante A')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByLabelText('Variante B')).toHaveAttribute('aria-invalid', 'true');
    expect(botaoDisparar()).toBeDisabled();
    escrever('Variante B', comTamanho(976));
    expect(botaoDisparar()).toBeEnabled();
  });

  it('com a confirmação aberta, o texto crescer até o limite trava o "Confirmar envio"', async () => {
    await abrirBroadcast();
    preencherCampanha(comTamanho(976));
    fireEvent.click(botaoDisparar());
    const confirmar = await screen.findByRole('button', { name: 'Confirmar envio' });
    expect(confirmar).toBeEnabled();
    escrever('Mensagem', comTamanho(977));
    expect(confirmar).toBeDisabled();
  });
});

describe('T4: a confirmação recebe o foco e é anunciada', () => {
  const abrirConfirmacao = async () => {
    await abrirBroadcast();
    preencherCampanha();
    fireEvent.click(botaoPrincipal('Disparar agora'));
    return painelAberto();
  };

  it('ao abrir, o foco vai para o painel (alertdialog), nomeado pela pergunta e descrito pelo aviso de envio real', async () => {
    const painel = await abrirConfirmacao();
    await waitFor(() => expect(document.activeElement).toBe(painel));
    expect(painel).toHaveAttribute('role', 'alertdialog');
    expect(painel).toHaveAttribute('tabindex', '-1');
    expect(painel).toHaveAccessibleName('Enviar agora para 2 paciente(s)? (1 envio a cada 5s)');
    expect(painel).toHaveAccessibleDescription('Isso envia mensagem real no WhatsApp. Não dá para desfazer.');
  });

  it('ao abrir, rola até o painel com block "start"', async () => {
    const painel = await abrirConfirmacao();
    await waitFor(() => {
      const noPainel = rolar.mock.calls.filter((_, i) => rolar.mock.contexts[i] === painel);
      expect(noPainel).toEqual([[{ block: 'start' }]]);
    });
  });

  it('Cancelar devolve o foco ao botão "Disparar agora"', async () => {
    const painel = await abrirConfirmacao();
    await waitFor(() => expect(document.activeElement).toBe(painel));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(botaoPrincipal('Disparar agora')).toHaveFocus();
    expect(h.inseridos).toEqual([]);
  });

  it('depois de confirmar um envio com sucesso o foco volta ao botão', async () => {
    const painel = await abrirConfirmacao();
    await waitFor(() => expect(document.activeElement).toBe(painel));
    await confirmarEEsperarGravar('Confirmar envio');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(botaoPrincipal('Disparar agora')).toHaveFocus());
  });

  it('quando a confirmação fecha sozinha por troca de segmento, o foco NÃO vai para o botão principal', async () => {
    const painel = await abrirConfirmacao();
    await waitFor(() => expect(document.activeElement).toBe(painel));
    const combo = segmentoSelect();
    combo.focus();
    expect(combo).toHaveFocus();
    abrirLista(combo);
    fireEvent.click(await screen.findByRole('option', { name: 'Aniversariantes do mês' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    const botao = screen.getByRole('button', { name: 'Disparar agora', hidden: true });
    expect(botao).not.toHaveFocus();
    await waitFor(() => expect(segmentoSelect()).toHaveFocus());
    expect(botao).not.toHaveFocus();
  });

  it('quando a confirmação fecha sozinha por troca de data, o foco fica no campo da data', async () => {
    await abrirBroadcast();
    preencherCampanha();
    agendarPara('2099-01-01T10:00');
    fireEvent.click(botaoPrincipal('Agendar campanha'));
    const painel = await painelAberto();
    await waitFor(() => expect(document.activeElement).toBe(painel));
    const data = campoData();
    data.focus();
    fireEvent.change(data, { target: { value: '2099-02-02T10:00' } });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(data).toHaveFocus();
    expect(botaoPrincipal('Agendar campanha')).not.toHaveFocus();
    await new Promise((resolver) => setTimeout(resolver, 20));
    expect(data).toHaveFocus();
  });

  it('quando a confirmação fecha sozinha por desligar o "Agendar envio", o foco fica no interruptor', async () => {
    await abrirBroadcast();
    preencherCampanha();
    agendarPara('2099-01-01T10:00');
    fireEvent.click(botaoPrincipal('Agendar campanha'));
    const painel = await painelAberto();
    await waitFor(() => expect(document.activeElement).toBe(painel));
    const interruptor = interruptorAgendar();
    interruptor.focus();
    fireEvent.click(interruptor);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(interruptor).toHaveFocus();
    expect(botaoPrincipal('Disparar agora')).not.toHaveFocus();
  });
});

describe('M08 e N06: confirmação do teste A/B', () => {
  const abrirConfirmacaoAB = async () => {
    await abrirBroadcast();
    fireEvent.click(interruptorAB());
    escrever('Título interno', 'Teste');
    escrever('Variante A', 'Oi {nome}! Versão A.');
    escrever('Variante B', 'Olá {nome}. Versão B.');
    fireEvent.click(botaoPrincipal('Disparar agora'));
    return screen.findByRole('button', { name: 'Confirmar envio' });
  };

  it('apagar o texto de UMA só variante trava o "Confirmar envio"; com as duas preenchidas ele está habilitado', async () => {
    const confirmar = await abrirConfirmacaoAB();
    expect(confirmar).toBeEnabled();
    escrever('Variante B', '');
    expect(confirmar).toBeDisabled();
    escrever('Variante B', 'Olá {nome}. Versão B.');
    expect(confirmar).toBeEnabled();
    escrever('Variante A', '   ');
    expect(confirmar).toBeDisabled();
    fireEvent.click(confirmar);
    expect(h.inseridos).toEqual([]);
    escrever('Variante A', 'Oi {nome}! Versão A.');
    expect(confirmar).toBeEnabled();
  });

  it('com uma variante vazia, "Disparar agora" avisa e nem abre a confirmação', async () => {
    await abrirBroadcast();
    fireEvent.click(interruptorAB());
    escrever('Título interno', 'Teste');
    escrever('Variante A', 'Oi {nome}! Versão A.');
    fireEvent.click(botaoPrincipal('Disparar agora'));
    expect(h.toasts).toEqual([['erro', 'Preencha o texto de todas as variantes A/B']]);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(banco().operacoes.filter((o) => o.tabela === 'pacientes')).toEqual([]);
    expect(h.inseridos).toEqual([]);
  });

  it('o botão Cancelar tem a altura de toque de 44 px e ocupa a linha no celular', async () => {
    await abrirConfirmacaoAB();
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    expect(cancelar).toHaveClass('min-h-11', 'w-full');
    expect(screen.getByRole('button', { name: 'Confirmar envio' })).toHaveClass('min-h-11', 'w-full');
  });
});

describe('T6 e T7: nomes acessíveis e avisos ligados ao campo', () => {
  it('o Segmento tem nome acessível, ligado ao rótulo', async () => {
    await abrirBroadcast();
    const combo = segmentoSelect();
    expect(combo).toHaveAccessibleName(/Segmento/);
    expect(combo).toHaveAttribute('id', 'broadcast-segmento');
    expect(screen.getByText('Segmento')).toHaveAttribute('for', 'broadcast-segmento');
  });

  it('o campo da data só existe com o "Agendar envio" ligado e se chama "Data e hora do envio"', async () => {
    await abrirBroadcast();
    expect(screen.queryByLabelText('Data e hora do envio')).not.toBeInTheDocument();
    fireEvent.click(interruptorAgendar());
    const data = screen.getByLabelText('Data e hora do envio');
    expect(data).toHaveAttribute('type', 'datetime-local');
    expect(data).toHaveAccessibleName('Data e hora do envio');
  });

  it('o aria-describedby do campo tem o contador e cada aviso, e esses ids existem no documento', async () => {
    await abrirBroadcast();
    escrever('Mensagem', 'Oi {horario}! {nome');
    const campo = screen.getByLabelText('Mensagem');
    const avisos = screen.getAllByRole('alert');
    expect(avisos).toHaveLength(2);
    const ids = idsDoDescribedby(campo);
    expect(ids).toEqual(['broadcast-mensagem-contador', 'broadcast-mensagem-aviso-0', 'broadcast-mensagem-aviso-1']);
    for (const id of ids) expect(document.getElementById(id)).not.toBeNull();
    expect(document.getElementById('broadcast-mensagem-contador')).toHaveTextContent('/1000 caracteres');
    expect(document.getElementById('broadcast-mensagem-aviso-0')).toBe(avisos[0]);
    expect(document.getElementById('broadcast-mensagem-aviso-1')).toBe(avisos[1]);
    expect(avisos[0]).toHaveTextContent('Só a variável {nome} funciona');
    expect(avisos[1]).toHaveTextContent('sem par');
    expect(campo).toHaveAccessibleDescription(/caracteres.*Só a variável \{nome\} funciona.*sem par/);
  });

  it('sem aviso o campo aponta só para o contador', async () => {
    await abrirBroadcast();
    escrever('Mensagem', 'Oi {nome}!');
    expect(idsDoDescribedby(screen.getByLabelText('Mensagem'))).toEqual(['broadcast-mensagem-contador']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('na variante B do teste A/B os ids levam o nome do campo da variante', async () => {
    await abrirBroadcast();
    fireEvent.click(interruptorAB());
    escrever('Variante B', 'Olá {nome}. Às {data}.');
    const campo = screen.getByLabelText('Variante B');
    expect(idsDoDescribedby(campo)).toEqual(['broadcast-variante-B-contador', 'broadcast-variante-B-aviso-0']);
    expect(document.getElementById('broadcast-variante-B-aviso-0')).toBe(screen.getByRole('alert'));
    expect(idsDoDescribedby(screen.getByLabelText('Variante A'))).toEqual(['broadcast-variante-A-contador']);
  });

  it('contraste: contador em text-foreground/70, textos do painel em text-foreground/75 e aviso de erro com variante escura', async () => {
    await abrirBroadcast();
    escrever('Mensagem', 'Oi {horario}');
    const contador = screen.getByText('12/1000 caracteres');
    expect(contador).toHaveClass('text-foreground/70');
    expect(contador).not.toHaveClass('text-muted-foreground');
    expect(screen.getByRole('alert')).toHaveClass('text-destructive', 'dark:text-red-400');

    escrever('Mensagem', 'Oi {nome}!');
    escrever('Título interno', 'Campanha');
    fireEvent.click(interruptorAgendar());
    fireEvent.change(campoData(), { target: { value: '2099-01-01T10:00' } });
    fireEvent.click(botaoPrincipal('Agendar campanha'));
    await painelAberto();
    for (const texto of [
      'Exemplo da mensagem para Marina:',
      /Sem IA: cada cliente recebe exatamente este texto/,
      'A campanha agendada pode sair até 1 hora depois do horário escolhido.',
      'Isso envia mensagem real no WhatsApp. Não dá para desfazer.',
    ]) {
      const paragrafo = screen.getByText(texto);
      expect(paragrafo).toHaveClass('text-foreground/75');
      expect(paragrafo).not.toHaveClass('text-muted-foreground');
    }
  });
});

describe('T8: parágrafos explicativos sem caixa alta (text-caption, não text-micro)', () => {
  const caption = (el: HTMLElement) => {
    expect(el).toHaveClass('text-caption');
    expect(el).not.toHaveClass('text-micro');
  };

  it('interruptor de IA, Teste A/B, "Agendar envio" e a ajuda do {nome} usam text-caption', async () => {
    await abrirBroadcast();
    caption(interruptorIA().closest('label')?.querySelector('p') as HTMLElement);
    caption(interruptorAB().closest('label')?.querySelector('p') as HTMLElement);
    caption(interruptorAgendar().closest('label')?.querySelector('p') as HTMLElement);
    caption(screen.getByText(/É o texto que o cliente recebe\. Use \{nome\}/));
    expect(screen.getByText(/É o texto que o cliente recebe\. Use \{nome\}/)).toHaveTextContent('Use {nome} para o primeiro nome dele');
  });

  it('a ajuda do {nome} no teste A/B também usa text-caption', async () => {
    await abrirBroadcast();
    fireEvent.click(interruptorAB());
    caption(screen.getByText(/Cada cliente recebe uma só variante, sorteada pelos pesos/));
  });

  it('a explicação do interruptor de IA e a do Teste A/B continuam com o texto de antes', async () => {
    await abrirBroadcast();
    expect(interruptorIA().closest('label')?.querySelector('p')).toHaveTextContent('Desligado: cada cliente recebe exatamente o texto que você escreveu');
    expect(interruptorAB().closest('label')?.querySelector('p')).toHaveTextContent('Compara 2 mensagens');
  });

  it('a legenda da aba Gatilhos usa text-caption', async () => {
    await abrir();
    await irParaAba('Gatilhos');
    caption(screen.getByText(/Aniversário, diário parado, MyID vencido e reengajamento saem de manhã/));
  });

  it('nenhum parágrafo explicativo novo da aba Broadcast é rótulo em caixa alta', async () => {
    await abrirBroadcast();
    fireEvent.click(interruptorAB());
    const longos = Array.from(screen.getByRole('tabpanel').querySelectorAll('p')).filter((p) => (p.textContent ?? '').length > 60);
    expect(longos.length).toBeGreaterThanOrEqual(4);
    for (const paragrafo of longos) expect(paragrafo).not.toHaveClass('text-micro');
  });
});

describe('T9: os últimos 7 dias de agente_disparos, paginados em blocos de 1000', () => {
  const linha = (i: number, gatilho: string, status: string, extra: Linha = {}): Linha => ({
    id: `d-${String(i).padStart(5, '0')}`, terapeuta_id: 'T1', gatilho, status,
    created_at: new Date(Date.parse(AGORA) - (i + 1) * 1000).toISOString(), ...extra,
  });
  const enviadas = () => (screen.getByText('Mensagens enviadas').previousElementSibling as HTMLElement);
  const gatilhoTop = () => (screen.getByText('Gatilho mais usado').previousElementSibling as HTMLElement);
  const leiturasDeDisparos = (metodo: string) => h.leituras.filter(([m]) => m === metodo);

  it('com 1500 linhas soma as 1500 em 2 blocos de 1000, e o gatilho mais usado conta as 1500', async () => {
    await abrir({ agente_disparos: Array.from({ length: 1500 }, (_, i) => linha(i, 'aniversario', 'enviado')) });
    expect(enviadas()).toHaveTextContent(/^1500$/);
    expect(gatilhoTop()).toHaveTextContent('aniversario (1500)');
    expect(banco().operacoes.filter((o) => o.tabela === 'agente_disparos' && o.tipo === 'select')).toHaveLength(2);
    expect(leiturasDeDisparos('range')).toEqual([['range', 0, 999], ['range', 1000, 1999]]);
  });

  it('cada bloco é lido na mesma ordem estável: created_at do mais novo para o mais velho e depois o id', async () => {
    await abrir({ agente_disparos: Array.from({ length: 1500 }, (_, i) => linha(i, 'aniversario', 'enviado')) });
    const ordens = leiturasDeDisparos('order');
    expect(ordens).toEqual([
      ['order', 'created_at', { ascending: false }], ['order', 'id'],
      ['order', 'created_at', { ascending: false }], ['order', 'id'],
    ]);
  });

  it('só lê os últimos 7 dias do profissional da tela', async () => {
    await abrir({ agente_disparos: [linha(0, 'aniversario', 'enviado')] });
    expect(h.leituras).toContainEqual(['eq', 'terapeuta_id', 'T1']);
    expect(h.leituras).toContainEqual(['gte', 'created_at', '2026-11-02T15:00:00.000Z']);
  });

  it('linhas de mais de 7 dias e de outro profissional não entram na conta', async () => {
    await abrir({
      agente_disparos: [
        linha(0, 'aniversario', 'enviado'),
        linha(1, 'aniversario', 'enviado'),
        ...Array.from({ length: 3 }, (_, i) => linha(10 + i, 'velho', 'enviado', { created_at: iso(8) })),
        ...Array.from({ length: 5 }, (_, i) => linha(20 + i, 'alheio', 'enviado', { terapeuta_id: 'T2' })),
      ],
    });
    expect(enviadas()).toHaveTextContent(/^2$/);
    expect(gatilhoTop()).toHaveTextContent('aniversario (2)');
  });

  it('com linhas "simulado" misturadas em mais de 1000 linhas, elas continuam fora da conta', async () => {
    // 1800 linhas: 900 simuladas (a maioria), 540 "aniversario" enviadas e 360 "myid_vencido" com erro.
    const gatilhos: Array<[string, string]> = [
      ['simulado:diario_pendente', 'simulado'], ['simulado:diario_pendente', 'simulado'], ['simulado:diario_pendente', 'simulado'],
      ['simulado:diario_pendente', 'simulado'], ['simulado:diario_pendente', 'simulado'],
      ['aniversario', 'enviado'], ['aniversario', 'enviado'], ['aniversario', 'enviado'],
      ['myid_vencido', 'erro'], ['myid_vencido', 'erro'],
    ];
    await abrir({ agente_disparos: Array.from({ length: 1800 }, (_, i) => linha(i, ...gatilhos[i % 10])) });
    expect(enviadas()).toHaveTextContent(/^540$/);
    expect(gatilhoTop()).toHaveTextContent('aniversario (540)');
    expect(gatilhoTop()).not.toHaveTextContent('simulado');
  });

  it('com até 999 linhas basta um bloco', async () => {
    await abrir({ agente_disparos: Array.from({ length: 999 }, (_, i) => linha(i, 'aniversario', 'enviado')) });
    expect(enviadas()).toHaveTextContent(/^999$/);
    expect(banco().operacoes.filter((o) => o.tabela === 'agente_disparos' && o.tipo === 'select')).toHaveLength(1);
  });
});

describe('T10: mensagem vazia', () => {
  it('título preenchido e mensagem vazia avisa "Preencha a mensagem" e nada mais', async () => {
    await abrirBroadcast();
    escrever('Título interno', 'Sem texto');
    fireEvent.click(botaoPrincipal('Disparar agora'));
    expect(h.toasts).toEqual([['erro', 'Preencha a mensagem']]);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(h.inseridos).toEqual([]);
  });

  it('título vazio avisa "Preencha o título", antes de olhar a mensagem', async () => {
    await abrirBroadcast();
    escrever('Mensagem', 'Oi {nome}!');
    fireEvent.click(botaoPrincipal('Disparar agora'));
    expect(h.toasts).toEqual([['erro', 'Preencha o título']]);
    expect(h.inseridos).toEqual([]);
  });
});

describe('T2: legenda da aba Gatilhos', () => {
  it('não promete "sem IA" e avisa que os textos prontos só valem quando o recurso for ligado', async () => {
    await abrir();
    await irParaAba('Gatilhos');
    const legenda = screen.getByText(/Aniversário, diário parado, MyID vencido e reengajamento saem de manhã/);
    expect(legenda.textContent).not.toMatch(/sem IA/i);
    expect(legenda.textContent).not.toMatch(/sem dado de saúde/i);
    expect(legenda.textContent).toMatch(/só passam a valer quando a equipe do My Health ID ligar o recurso para a sua conta/);
    expect(legenda.textContent).toMatch(/até lá, o aplicativo ainda escreve a mensagem com IA/);
    expect(document.body.textContent).not.toContain('Sem IA e sem dado de saúde');
  });
});
