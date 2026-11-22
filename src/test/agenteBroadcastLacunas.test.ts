// Handler do agente-broadcast carregado de verdade (supabase/functions/agente-broadcast/index.ts), com dublês para o
// banco, o envio de WhatsApp, o registro na conversa, o log de uso de IA, o Deno, o EdgeRuntime, os temporizadores e o
// fetch. ATENÇÃO: essa função manda WhatsApp para clientes reais. Por isso o fetch do teste LANÇA para qualquer
// endereço, inclusive z-api.io, graph.facebook.com e generativelanguage.googleapis.com; só a IA tem dublê, e só nos
// testes que o instalam. Um teste canário prova que o bloqueio dispara, então um mock esquecido nunca vira envio real.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarBancoProativo, type BancoProativo, type Linha } from './helpers/bancoProativoFalso';

interface ChamadaDeFetch {
  url: string;
  metodo: string;
  headers: Record<string, string>;
  corpo: string;
  signal?: AbortSignal;
}
interface Temporizador {
  ms: number;
  fn: () => void;
  limpo: boolean;
}

const h = vi.hoisted(() => ({
  banco: null as unknown,
  handler: null as null | ((req: Request) => Promise<Response>),
  env: {} as Record<string, string | undefined>,
  enviar: vi.fn(),
  registrar: vi.fn(),
  logIA: vi.fn(),
  contexto: vi.fn(),
  fetchChamadas: [] as ChamadaDeFetch[],
  ia: null as null | ((corpo: string, init: { signal?: AbortSignal }) => Response | Promise<Response>),
  pausas: [] as number[],
  aoPausar: null as null | ((ms: number) => void),
  temporizadoresIA: [] as Temporizador[],
  pendentes: [] as Promise<unknown>[],
}));

vi.mock('https://esm.sh/@supabase/supabase-js@2.45.0', () => ({ createClient: () => h.banco }));
vi.mock('../../supabase/functions/_shared/enviar-whatsapp.ts', () => ({
  enviarWhatsapp: (...a: unknown[]) => h.enviar(...a),
}));
vi.mock('../../supabase/functions/_shared/registrar-saida.ts', () => ({
  registrarMensagemSaida: (...a: unknown[]) => h.registrar(...a),
}));
vi.mock('../../supabase/functions/_shared/log-ia.ts', () => ({
  logUsoIA: (...a: unknown[]) => h.logIA(...a),
}));
// O broadcast não lê mais o contexto clínico do cliente: qualquer chamada a estes dois falha o teste (afterEach).
vi.mock('../../supabase/functions/_shared/agente-contexto.ts', () => ({
  montarContextoClinico: (...a: unknown[]) => h.contexto('montarContextoClinico', ...a),
  buildSystemPrompt: (...a: unknown[]) => h.contexto('buildSystemPrompt', ...a),
}));

const CAMINHO_DO_HANDLER = '../../supabase/functions/agente-broadcast/index.ts';
const URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const URL_DA_FUNCAO = 'https://x.supabase.co/functions/v1/agente-broadcast';

const fetchFalso = (entrada: unknown, init?: { method?: string; headers?: Record<string, string>; body?: unknown; signal?: AbortSignal }): Promise<Response> => {
  const url = String(entrada);
  const host = new URL(url).hostname;
  const corpo = String(init?.body ?? '');
  h.fetchChamadas.push({ url, metodo: init?.method ?? 'GET', headers: init?.headers ?? {}, corpo, signal: init?.signal });
  if (host === 'generativelanguage.googleapis.com' && h.ia !== null) return Promise.resolve(h.ia(corpo, { signal: init?.signal }));
  throw new Error(`fetch bloqueado no teste (${host}): nenhum provedor real pode ser chamado`);
};

// ───────────── Cenário ─────────────

const TEXTO = 'Olá {nome}, esta semana temos horários livres na clínica.';
const MARINA = 'Olá Marina, esta semana temos horários livres na clínica.';
const JOANA = 'Olá Joana, esta semana temos horários livres na clínica.';

const campanha = (extra: Linha = {}): Linha => ({
  id: 'B1',
  terapeuta_id: 'T1',
  titulo: 'Campanha de teste',
  intencao: TEXTO,
  filtro: { segmento: 'todos', personalizar_ia: false },
  paciente_ids: ['P1', 'P2'],
  status: 'agendado',
  ab_variantes: [],
  total: 0,
  enviados: 0,
  erros: 0,
  agendado_para: null,
  ...extra,
});

// A ficha traz de propósito dado que NUNCA pode sair no pedido à IA (sobrenome, telefone, diagnóstico, nascimento).
const paciente = (id: string, extra: Linha = {}): Linha => ({
  id,
  terapeuta_id: 'T1',
  nome: 'MARINA',
  sobrenome: 'Souza',
  telefone: '5511999990001',
  ativo: true,
  vinculo_encerrado_em: null,
  data_nascimento: '1990-11-09',
  diagnostico: 'Lombalgia crônica',
  ...extra,
});
const joana = (extra: Linha = {}) => paciente('P2', { nome: 'JOANA', sobrenome: 'Lima', telefone: '5511999990002', ...extra });

const cenario = (extraCampanha: Linha = {}, pacientes: Linha[] = [paciente('P1'), joana()], extras: Record<string, Linha[]> = {}): Record<string, Linha[]> => ({
  agente_broadcasts: [campanha(extraCampanha)],
  pacientes,
  whatsapp_automacoes: [{ terapeuta_id: 'T1', tom_voz: 'amigavel', automacoes_pausadas: false }],
  myid_avaliacoes: [{ id: 'my-1', paciente_id: 'P1', status: 'concluido', myid_score_parcial: 61, red_flags_detectadas: true }],
  ...extras,
});

const comMarca = (personalizar_ia: unknown): Linha => ({ filtro: { segmento: 'todos', personalizar_ia } });
const SEM_MARCA: Linha = { filtro: { segmento: 'todos' } };

const USUARIOS: Record<string, string> = { 'token-T1': 'T1', 'token-T2': 'T2' };
const montar = (tabelas: Record<string, Linha[]>): BancoProativo => {
  const banco = criarBancoProativo(tabelas);
  (banco as unknown as { auth: unknown }).auth = {
    getUser: async (token: string) => {
      const id = USUARIOS[token];
      if (!id) return { data: { user: null }, error: { message: 'token inválido' } };
      return { data: { user: { id } }, error: null };
    },
  };
  h.banco = banco;
  return banco;
};
const banco = () => h.banco as BancoProativo;

// ───────────── Execução e leitura ─────────────

type Quem = 'cron' | 'T1' | 'T2' | 'anonimo' | 'token-ruim';
type Corpo = Record<string, unknown>;

// Devolve assim que a função responde; o laço de envios roda em segundo plano (EdgeRuntime.waitUntil).
async function iniciar(quem: Quem = 'T1', id = 'B1') {
  const headers: Record<string, string> = {};
  if (quem === 'cron') headers.Authorization = 'Bearer chave-de-servico';
  else if (quem === 'token-ruim') headers.Authorization = 'Bearer token-ruim';
  else if (quem !== 'anonimo') headers.Authorization = `Bearer token-${quem}`;
  const res = await h.handler!(new Request(URL_DA_FUNCAO, { method: 'POST', headers, body: JSON.stringify({ broadcast_id: id }) }));
  return { status: res.status, corpo: (await res.json()) as Corpo };
}
async function terminar() {
  await Promise.all(h.pendentes.splice(0));
}
async function rodar(quem: Quem = 'T1', id = 'B1') {
  const r = await iniciar(quem, id);
  await terminar();
  return r;
}
const ate = async (condicao: () => boolean) => {
  for (let i = 0; i < 500; i++) {
    if (condicao()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('a condição não ficou verdadeira');
};

const campanhaNoBanco = () => banco().linhas('agente_broadcasts')[0];
const disparos = () => banco().linhas('agente_disparos');
const consultasDe = (tabela: string, op?: string) => banco().consultas.filter((c) => c.tabela === tabela && (op === undefined || c.op === op));
const chamadaDa = (c: { chamadas: Array<[string, unknown[]]> }, metodo: string) => c.chamadas.filter(([m]) => m === metodo).map(([, a]) => a);
const tabelasLidas = () => [...new Set(banco().consultas.map((c) => c.tabela))].sort();
const textosEnviados = () => h.enviar.mock.calls.map((c) => String(c[3]));
const geminiChamadas = () => h.fetchChamadas.filter((c) => c.url === URL_GEMINI);
const errosTexto = () => erros.mock.calls.flat().map(String).join(' | ');
const avisosTexto = () => avisos.mock.calls.flat().map(String).join(' | ');

// ───────────── IA (dublê) ─────────────

const respostaIA = (texto: string, usage: unknown = { prompt_tokens: 10, completion_tokens: 5 }) =>
  new Response(JSON.stringify({ choices: [{ message: { content: texto } }], usage }), { status: 200 });
const pedidoDaIA = (corpo: string) => JSON.parse(corpo) as { model: string; messages: Array<{ role: string; content: string }> };
const nomeDoPedido = (corpo: string) => /Primeiro nome do cliente: (\S+)/.exec(pedidoDaIA(corpo).messages[1].content)?.[1] ?? 'cliente';
const iaBoa = (corpo: string) => respostaIA(`Oi ${nomeDoPedido(corpo)}! 💙 Esta semana temos horários livres aqui na clínica. Quer agendar?`);
const textoDaIABoa = (nome: string) => `Oi ${nome}! 💙 Esta semana temos horários livres aqui na clínica. Quer agendar?`;
const iaPendente = (_corpo: string, init: { signal?: AbortSignal }) =>
  new Promise<Response>((_resolve, rejeitar) => {
    init.signal?.addEventListener('abort', () => rejeitar(new Error('abortado pelo tempo limite')));
  });

const FALHAS_DA_IA: Array<[string, () => void]> = [
  ['sem a chave da IA', () => { delete h.env.GEMINI_API_KEY; }],
  ['resposta não-ok (500)', () => { h.ia = () => new Response('erro interno', { status: 500 }); }],
  ['resposta não-ok (500) com corpo que pareceria aproveitável', () => {
    h.ia = () => new Response(JSON.stringify({ choices: [{ message: { content: textoDaIABoa('Marina') } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }), { status: 500 });
  }],
  ['a chamada lança (rede caiu)', () => { h.ia = () => { throw new Error('rede caiu'); }; }],
  ['resposta sem texto', () => { h.ia = () => respostaIA(''); }],
  ['resposta só com espaços', () => { h.ia = () => respostaIA('   \n  '); }],
  ['resposta sem choices', () => { h.ia = () => new Response('{}', { status: 200 }); }],
  ['conteúdo que não é texto', () => { h.ia = () => new Response(JSON.stringify({ choices: [{ message: { content: 42 } }] }), { status: 200 }); }],
  ['corpo que não é JSON', () => { h.ia = () => new Response('isto não é json', { status: 200 }); }],
  ['saída reprovada (chave solta)', () => { h.ia = () => respostaIA('Oi {nome}, temos horários livres.'); }],
  ['saída reprovada (colchete)', () => { h.ia = () => respostaIA('Oi Marina, temos horários [livres].'); }],
  ['saída reprovada (link inventado)', () => { h.ia = () => respostaIA('Oi Marina, veja os horários em https://exemplo.com.br/agenda'); }],
  ['saída reprovada (termo clínico novo)', () => { h.ia = () => respostaIA('Oi Marina, vamos continuar o seu tratamento esta semana.'); }],
  ['saída reprovada (acima de 1000)', () => { h.ia = () => respostaIA('x'.repeat(1001)); }],
];

// ───────────── Preparo ─────────────

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    serve: (fn: (req: Request) => Promise<Response>) => { h.handler = fn; },
    env: { get: (k: string) => h.env[k] },
  });
  vi.stubGlobal('EdgeRuntime', { waitUntil: (p: Promise<unknown>) => { h.pendentes.push(p); } });
  vi.stubGlobal('fetch', fetchFalso);
  await import(/* @vite-ignore */ CAMINHO_DO_HANDLER);
});

const espiar = (metodo: 'warn' | 'error' | 'log') => vi.spyOn(console, metodo).mockImplementation(() => undefined);
let avisos: ReturnType<typeof espiar>;
let erros: ReturnType<typeof espiar>;
let registros: ReturnType<typeof espiar>;
let setTimeoutOriginal: typeof setTimeout;
let clearTimeoutOriginal: typeof clearTimeout;

beforeEach(() => {
  h.env = {
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'chave-de-servico',
    SUPABASE_ANON_KEY: 'chave-anonima',
    GEMINI_API_KEY: 'chave-gemini-falsa',
  };
  h.enviar.mockReset();
  h.enviar.mockImplementation(async () => true);
  h.registrar.mockReset();
  h.registrar.mockImplementation(async () => undefined);
  h.logIA.mockReset();
  h.contexto.mockReset();
  h.fetchChamadas.length = 0;
  h.ia = null;
  h.pausas.length = 0;
  h.aoPausar = null;
  h.temporizadoresIA.length = 0;
  h.pendentes.length = 0;
  h.banco = criarBancoProativo({});
  avisos = espiar('warn');
  erros = espiar('error');
  registros = espiar('log');
  setTimeoutOriginal = globalThis.setTimeout;
  clearTimeoutOriginal = globalThis.clearTimeout;
  // As pausas entre envios viram instantâneas e ficam anotadas; o temporizador de 20 s que aborta a IA só dispara
  // quando o teste mandar.
  globalThis.setTimeout = ((fn: () => void, ms?: number) => {
    if (ms === 20_000) {
      const t: Temporizador = { ms, fn, limpo: false };
      h.temporizadoresIA.push(t);
      return t as unknown as ReturnType<typeof setTimeout>;
    }
    h.pausas.push(Number(ms));
    h.aoPausar?.(Number(ms));
    fn();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout;
  globalThis.clearTimeout = ((t: unknown) => {
    const achado = h.temporizadoresIA.find((x) => x === t);
    if (achado) achado.limpo = true;
  }) as unknown as typeof clearTimeout;
});

afterEach(() => {
  globalThis.setTimeout = setTimeoutOriginal;
  globalThis.clearTimeout = clearTimeoutOriginal;
  // Invariantes de TODO teste: nunca sai texto vazio, com chave crua ou acima de 1000, e o contexto clínico nunca é lido.
  for (const texto of textosEnviados()) {
    expect(texto.trim()).not.toBe('');
    expect(texto).not.toMatch(/[{}]/);
    expect(Array.from(texto).length).toBeLessThanOrEqual(1000);
  }
  expect(h.contexto).not.toHaveBeenCalled();
  expect(h.fetchChamadas.every((c) => c.url === URL_GEMINI)).toBe(true);
  avisos.mockRestore();
  erros.mockRestore();
  registros.mockRestore();
});


describe('lacunas encontradas pela conferência independente (broadcast)', () => {
  it('Y07: a pausa lida é a da conta DONA da campanha, mesmo com a automação de outra conta primeiro na tabela', async () => {
    montar(cenario({}, [paciente('P1'), joana()], {
      whatsapp_automacoes: [
        { terapeuta_id: 'T2', tom_voz: 'amigavel', automacoes_pausadas: false },
        { terapeuta_id: 'T1', tom_voz: 'amigavel', automacoes_pausadas: true },
      ],
    }));
    const { corpo } = await rodar('cron');
    expect(corpo).toEqual({ ok: true, skip: 'automações pausadas' });
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it('Y07 (inverso): conta de outra clínica pausada primeiro na tabela não segura a campanha de uma conta ativa', async () => {
    montar(cenario({}, [paciente('P1'), joana()], {
      whatsapp_automacoes: [
        { terapeuta_id: 'T2', tom_voz: 'amigavel', automacoes_pausadas: true },
        { terapeuta_id: 'T1', tom_voz: 'amigavel', automacoes_pausadas: false },
      ],
    }));
    await rodar('cron');
    expect(textosEnviados()).toEqual([MARINA, JOANA]);
  });

  it('Y08: pesos que não somam 100 (1 e 1) ainda sorteiam as DUAS variantes', async () => {
    const mocado = vi.spyOn(Math, 'random').mockReturnValue(0.75);
    try {
      montar(cenario({ ab_variantes: [{ key: 'A', texto: 'A para {nome}', peso: 1 }, { key: 'B', texto: 'B para {nome}', peso: 1 }] }, [paciente('P1')]));
      await rodar();
      expect(textosEnviados()).toEqual(['B para Marina']);
    } finally {
      mocado.mockRestore();
    }
  });
});
