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

// ───────────── Proteção contra envio de verdade ─────────────

describe('proteção contra envio real', () => {
  it.each([
    'https://api.z-api.io/instances/I/token/T/send-text',
    'https://graph.facebook.com/v21.0/123/messages',
    URL_GEMINI,
  ])('o fetch do teste lança para %s (canário)', (url) => {
    expect(() => fetch(url, { method: 'POST' })).toThrow('fetch bloqueado no teste');
    expect(h.fetchChamadas).toHaveLength(1);
    h.fetchChamadas.length = 0;
  });

  it('o fetch do ambiente de teste é o falso, e qualquer outro endereço também é barrado', () => {
    expect(globalThis.fetch).toBe(fetchFalso);
    expect(() => fetch('https://exemplo.com.br/x')).toThrow('fetch bloqueado no teste');
    h.fetchChamadas.length = 0;
  });

  it('campanha com IA e sem dublê da IA: o fetch lança, a IA é tratada como indisponível e o texto fixo sai pelo envio falso', async () => {
    montar(cenario(comMarca(true)));
    await rodar();
    expect(geminiChamadas()).toHaveLength(2);
    expect(textosEnviados()).toEqual([MARINA, JOANA]);
  });
});

// ───────────── Quem pode chamar ─────────────

describe('acesso', () => {
  it('sem credencial: 403 e nenhuma consulta ao banco', async () => {
    montar(cenario());
    const { status } = await rodar('anonimo');
    expect(status).toBe(403);
    expect(banco().consultas).toEqual([]);
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it('usuário com token inválido: 403 e nenhuma consulta ao banco', async () => {
    montar(cenario());
    const { status } = await rodar('token-ruim');
    expect(status).toBe(403);
    expect(banco().consultas).toEqual([]);
  });

  it('profissional que não é dono da campanha: 403, nada enviado e a campanha continua como estava', async () => {
    montar(cenario());
    const { status } = await rodar('T2');
    expect(status).toBe(403);
    expect(h.enviar).not.toHaveBeenCalled();
    expect(campanhaNoBanco().status).toBe('agendado');
    expect(consultasDe('pacientes')).toEqual([]);
  });

  it('o dono autenticado dispara a campanha', async () => {
    montar(cenario());
    const { status, corpo } = await rodar('T1');
    expect(status).toBe(200);
    expect(corpo).toEqual({ ok: true, total: 2 });
    expect(h.enviar).toHaveBeenCalledTimes(2);
  });

  it('o cron (chave de serviço) dispara a campanha agendada', async () => {
    montar(cenario());
    const { status } = await rodar('cron');
    expect(status).toBe(200);
    expect(h.enviar).toHaveBeenCalledTimes(2);
  });

  it('responde ao pré-voo do navegador sem consultar nada', async () => {
    montar(cenario());
    const res = await h.handler!(new Request(URL_DA_FUNCAO, { method: 'OPTIONS' }));
    expect(res.status).toBe(200);
    expect(banco().consultas).toEqual([]);
  });

  it('campanha que não existe: 500 com o motivo e nada enviado', async () => {
    montar(cenario());
    const { status, corpo } = await rodar('T1', 'B-que-nao-existe');
    expect(status).toBe(500);
    expect(corpo).toEqual({ ok: false, error: 'broadcast não encontrado' });
    expect(h.enviar).not.toHaveBeenCalled();
  });
});

// ───────────── Texto fixo (personalizar_ia === false) ─────────────

describe('texto fixo', () => {
  it('nunca chama a IA, nem mede uso, nem lê o contexto clínico, mesmo com a chave da IA presente', async () => {
    h.ia = iaBoa;
    montar(cenario());
    await rodar();
    expect(h.fetchChamadas).toEqual([]);
    expect(h.logIA).not.toHaveBeenCalled();
    expect(h.contexto).not.toHaveBeenCalled();
    expect(textosEnviados()).toEqual([MARINA, JOANA]);
  });

  it('funciona sem a chave da IA', async () => {
    delete h.env.GEMINI_API_KEY;
    montar(cenario());
    await rodar();
    expect(textosEnviados()).toEqual([MARINA, JOANA]);
  });

  it('só lê campanha, paciente e disparos: nada clínico, nem o tom da clínica', async () => {
    montar(cenario());
    await rodar();
    expect(tabelasLidas()).toEqual(['agente_broadcasts', 'agente_disparos', 'pacientes']);
  });

  it('a consulta do paciente pede só telefone, ativo, nome e vínculo, e filtra por id E por terapeuta', async () => {
    montar(cenario());
    await rodar();
    const consultas = consultasDe('pacientes');
    expect(consultas).toHaveLength(2);
    for (const c of consultas) {
      expect(chamadaDa(c, 'select')[0][0]).toBe('telefone, ativo, nome, vinculo_encerrado_em');
      expect(chamadaDa(c, 'eq').map((a) => a[0]).sort()).toEqual(['id', 'terapeuta_id']);
      expect(chamadaDa(c, 'eq').find((a) => a[0] === 'terapeuta_id')?.[1]).toBe('T1');
    }
    expect(consultas.map((c) => chamadaDa(c, 'eq').find((a) => a[0] === 'id')?.[1])).toEqual(['P1', 'P2']);
  });

  it('envia o texto do profissional com o primeiro nome capitalizado, ao telefone certo, como envio manual', async () => {
    montar(cenario());
    await rodar();
    expect(h.enviar).toHaveBeenCalledTimes(2);
    expect(h.enviar.mock.calls[0].slice(1)).toEqual(['T1', '5511999990001', MARINA, { manual: true }]);
    expect(h.enviar.mock.calls[1].slice(1)).toEqual(['T1', '5511999990002', JOANA, { manual: true }]);
  });

  it('o nome vem do campo nome, nunca do sobrenome nem do nome completo', async () => {
    montar(cenario({}, [paciente('P1', { nome: 'ANA-CLARA DOS SANTOS' }), joana({ nome: "d'ávila" })]));
    await rodar();
    expect(textosEnviados()).toEqual([
      'Olá Ana-Clara, esta semana temos horários livres na clínica.',
      "Olá D'Ávila, esta semana temos horários livres na clínica.",
    ]);
  });

  it('texto sem variável sai igual para todos, mesmo para quem não tem nome aproveitável', async () => {
    montar(cenario({ intencao: 'Estamos de recesso na segunda.' }, [paciente('P1', { nome: null }), joana({ nome: 'bit.ly/x' })]));
    await rodar();
    expect(textosEnviados()).toEqual(['Estamos de recesso na segunda.', 'Estamos de recesso na segunda.']);
  });

  it('variáveis com espaço e caixa diferentes valem como {nome}', async () => {
    montar(cenario({ intencao: 'Oi { Nome }! Tudo bem, {NOME}?' }));
    await rodar();
    expect(textosEnviados()).toEqual(['Oi Marina! Tudo bem, Marina?', 'Oi Joana! Tudo bem, Joana?']);
  });

  it('resultado da campanha: concluída, com contagens, total e carimbos de tempo', async () => {
    montar(cenario());
    await rodar();
    expect(campanhaNoBanco()).toMatchObject({
      status: 'concluido', total: 2, enviados: 2, erros: 0, resultado_variantes: { A: { enviados: 2, erros: 0 } },
    });
    expect(typeof campanhaNoBanco().iniciado_em).toBe('string');
    expect(typeof campanhaNoBanco().concluido_em).toBe('string');
  });

  it('grava um disparo por envio, com o texto enviado e SEM o campo metadata (a coluna não existe)', async () => {
    montar(cenario());
    await rodar();
    expect(disparos()).toHaveLength(2);
    expect(disparos()[0]).toMatchObject({
      terapeuta_id: 'T1', paciente_id: 'P1', gatilho: 'broadcast', ref_id: 'B1', conteudo: MARINA, status: 'enviado',
    });
    for (const c of consultasDe('agente_disparos', 'insert')) {
      expect(c.payload).not.toHaveProperty('metadata');
    }
  });

  it('registra cada mensagem enviada na conversa do Zap, como origem broadcast e sem bot:true', async () => {
    montar(cenario());
    await rodar();
    expect(h.registrar).toHaveBeenCalledTimes(2);
    expect(h.registrar.mock.calls[0][1]).toEqual({
      terapeuta_id: 'T1', paciente_id: 'P1', telefone: '5511999990001', conteudo: MARINA, origem: 'broadcast',
    });
    expect(h.registrar.mock.calls[1][1]).toMatchObject({ paciente_id: 'P2', conteudo: JOANA });
  });

  it('espera 5 s depois de cada envio', async () => {
    montar(cenario());
    await rodar();
    expect(h.pausas).toEqual([5000, 5000]);
  });

  it('o envio acontece antes da pausa de cada cliente', async () => {
    const ordem: string[] = [];
    h.enviar.mockImplementation(async () => { ordem.push('envio'); return true; });
    const original = globalThis.setTimeout;
    globalThis.setTimeout = ((fn: () => void, ms?: number) => {
      if (ms === 5000) ordem.push('pausa');
      return original(fn, 0);
    }) as unknown as typeof setTimeout;
    montar(cenario());
    await rodar();
    expect(ordem).toEqual(['envio', 'pausa', 'envio', 'pausa']);
  });

  it('o cliente que não tem como receber não gasta a espera de 5 s', async () => {
    montar(cenario({ paciente_ids: ['P1', 'P2', 'P3', 'P4'] }, [
      paciente('P1', { ativo: false }),
      joana({ vinculo_encerrado_em: '2026-11-01T10:00:00Z' }),
      paciente('P3', { telefone: null }),
      paciente('P4', { nome: 'BRUNO', telefone: '5511999990004' }),
    ]));
    await rodar();
    expect(h.pausas).toEqual([5000]);
  });

  it('a mesma pessoa em ids repetidos recebe uma vez só, e o total conta sem repetição', async () => {
    montar(cenario({ paciente_ids: ['P1', 'P1', 'P2', 'P1'] }));
    const { corpo } = await rodar();
    expect(textosEnviados()).toEqual([MARINA, JOANA]);
    expect(corpo).toEqual({ ok: true, total: 2 });
    expect(campanhaNoBanco()).toMatchObject({ total: 2, enviados: 2 });
    expect(disparos()).toHaveLength(2);
  });

  it('lista de pacientes vazia ou ausente: conclui sem enviar nada', async () => {
    montar(cenario({ paciente_ids: [] }));
    const { corpo } = await rodar();
    expect(corpo).toEqual({ ok: true, total: 0 });
    expect(h.enviar).not.toHaveBeenCalled();
    expect(campanhaNoBanco()).toMatchObject({ status: 'concluido', enviados: 0, erros: 0 });
  });

  it('paciente_ids que não é lista não derruba a função', async () => {
    montar(cenario({ paciente_ids: null }));
    const { status, corpo } = await rodar();
    expect(status).toBe(200);
    expect(corpo).toEqual({ ok: true, total: 0 });
  });
});

describe('texto fixo: quem não recebe', () => {
  it('paciente de OUTRO profissional na lista não recebe nada e conta como erro', async () => {
    montar(cenario({ paciente_ids: ['P1', 'PX', 'P2'] }, [
      paciente('P1'),
      paciente('PX', { terapeuta_id: 'T2', nome: 'INTRUSO', telefone: '5511988887777' }),
      joana(),
    ]));
    await rodar();
    expect(textosEnviados()).toEqual([MARINA, JOANA]);
    expect(h.enviar.mock.calls.map((c) => c[2])).not.toContain('5511988887777');
    expect(campanhaNoBanco()).toMatchObject({ enviados: 2, erros: 1 });
    expect(disparos().map((d) => d.paciente_id)).toEqual(['P1', 'P2']);
  });

  it('id que não existe conta como erro e a campanha segue', async () => {
    montar(cenario({ paciente_ids: ['P1', 'P-fantasma', 'P2'] }));
    await rodar();
    expect(textosEnviados()).toEqual([MARINA, JOANA]);
    expect(campanhaNoBanco()).toMatchObject({ enviados: 2, erros: 1 });
  });

  it('cliente inativo (ativo falso) não recebe e conta como erro', async () => {
    montar(cenario({}, [paciente('P1', { ativo: false }), joana()]));
    await rodar();
    expect(textosEnviados()).toEqual([JOANA]);
    expect(campanhaNoBanco()).toMatchObject({ enviados: 1, erros: 1 });
  });

  it('quem excluiu a conta (vínculo encerrado) não recebe e conta como erro', async () => {
    montar(cenario({}, [paciente('P1', { vinculo_encerrado_em: '2026-11-01T10:00:00Z' }), joana()]));
    await rodar();
    expect(textosEnviados()).toEqual([JOANA]);
    expect(campanhaNoBanco()).toMatchObject({ enviados: 1, erros: 1 });
    expect(disparos().map((d) => d.paciente_id)).toEqual(['P2']);
  });

  it.each([[null], ['']])('cliente sem telefone (%j) não recebe e conta como erro', async (telefone) => {
    montar(cenario({}, [paciente('P1', { telefone }), joana()]));
    await rodar();
    expect(textosEnviados()).toEqual([JOANA]);
    expect(campanhaNoBanco()).toMatchObject({ enviados: 1, erros: 1 });
  });

  it('falha ao ler o paciente: conta erro, avisa no log e segue para o próximo', async () => {
    montar(cenario());
    banco().regras.push({
      tabela: 'pacientes', op: 'select', tipo: 'erro', mensagem: 'banco fora do ar',
      quando: (c) => chamadaDa(c, 'eq').some((a) => a[1] === 'P1'),
    });
    await rodar();
    expect(textosEnviados()).toEqual([JOANA]);
    expect(campanhaNoBanco()).toMatchObject({ enviados: 1, erros: 1 });
    expect(errosTexto()).toContain('banco fora do ar');
  });

  it('exceção com um paciente: conta erro, avisa no log e os outros recebem', async () => {
    montar(cenario());
    banco().regras.push({
      tabela: 'pacientes', op: 'select', tipo: 'lancar', mensagem: 'conexão perdida',
      quando: (c) => chamadaDa(c, 'eq').some((a) => a[1] === 'P1'),
    });
    await rodar();
    expect(textosEnviados()).toEqual([JOANA]);
    expect(campanhaNoBanco()).toMatchObject({ status: 'concluido', enviados: 1, erros: 1 });
    expect(errosTexto()).toContain('falha com o paciente P1');
    expect(errosTexto()).toContain('conexão perdida');
  });
});

describe('texto fixo: nome', () => {
  it.each([[null], [''], ['   '], ['bit.ly/x'], ['123'], ['{nome}'], ['@@@']])(
    'cliente sem primeiro nome aproveitável (%j): não envia, grava linha de erro sem_nome e não espera os 5 s',
    async (nome) => {
      montar(cenario({}, [paciente('P1', { nome }), joana()]));
      await rodar();
      expect(textosEnviados()).toEqual([JOANA]);
      expect(h.pausas).toEqual([5000]);
      const linha = disparos().find((d) => d.paciente_id === 'P1');
      expect(linha).toMatchObject({
        terapeuta_id: 'T1', gatilho: 'broadcast', ref_id: 'B1', status: 'erro', erro: 'sem_nome', conteudo: TEXTO,
      });
      expect(disparos().filter((d) => d.status === 'enviado').map((d) => d.paciente_id)).toEqual(['P2']);
      expect(campanhaNoBanco()).toMatchObject({ enviados: 1, erros: 1, resultado_variantes: { A: { enviados: 1, erros: 1 } } });
      expect(h.registrar).toHaveBeenCalledTimes(1);
    },
  );

  it('mensagem final acima de 1000 depois de trocar o nome: não é cortada nem enviada', async () => {
    const nomeLongo = 'ANASTACIAEURIDICEPOLIANAMARIAXX';
    montar(cenario({ intencao: `${'a'.repeat(990)}{nome}`, paciente_ids: ['P1'] }, [paciente('P1', { nome: nomeLongo.slice(0, 30) })]));
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();
    expect(disparos()).toHaveLength(1);
    expect(disparos()[0]).toMatchObject({ status: 'erro', erro: 'longo' });
    expect(campanhaNoBanco()).toMatchObject({ enviados: 0, erros: 1 });
  });

  it('falha ao gravar a linha de erro é avisada e a campanha segue', async () => {
    montar(cenario({}, [paciente('P1', { nome: null }), joana()]));
    banco().regras.push({ tabela: 'agente_disparos', op: 'insert', tipo: 'erro', mensagem: 'sem espaço', quando: (c) => (c.payload as Linha).status === 'erro' });
    await rodar();
    expect(textosEnviados()).toEqual([JOANA]);
    expect(errosTexto()).toContain('sem espaço');
  });
});

describe('texto fixo: variantes A/B', () => {
  const AB = [
    { key: 'A', texto: 'Versão A para {nome}', peso: 70 },
    { key: 'B', texto: 'Versão B para {nome}', peso: 30 },
  ];

  it('sorteia a variante pelo peso, como sempre fez, e conta enviados por variante', async () => {
    montar(cenario({ ab_variantes: AB }));
    const sorteio = vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0.9);
    await rodar();
    sorteio.mockRestore();
    expect(textosEnviados()).toEqual(['Versão A para Marina', 'Versão B para Joana']);
    expect(campanhaNoBanco()).toMatchObject({
      enviados: 2, resultado_variantes: { A: { enviados: 1, erros: 0 }, B: { enviados: 1, erros: 0 } },
    });
  });

  it('sem pesos válidos usa peso total 100 e cai na primeira variante', async () => {
    montar(cenario({ ab_variantes: [{ key: 'A', texto: 'Só A {nome}', peso: 0 }, { key: 'B', texto: 'Só B {nome}', peso: 0 }] }));
    const sorteio = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await rodar();
    sorteio.mockRestore();
    expect(textosEnviados()).toEqual(['Só A Marina', 'Só A Joana']);
  });

  it('o erro de nome conta na variante sorteada', async () => {
    montar(cenario({ ab_variantes: AB }, [paciente('P1', { nome: null }), joana()]));
    const sorteio = vi.spyOn(Math, 'random').mockReturnValueOnce(0.9).mockReturnValueOnce(0.5);
    await rodar();
    sorteio.mockRestore();
    expect(campanhaNoBanco()).toMatchObject({
      enviados: 1, erros: 1, resultado_variantes: { A: { enviados: 1, erros: 0 }, B: { enviados: 0, erros: 1 } },
    });
  });

  it('variante sem chave recebe uma chave própria e não derruba a campanha', async () => {
    montar(cenario({ ab_variantes: [{ texto: 'Sem chave {nome}', peso: 100 }] }));
    await rodar();
    expect(textosEnviados()).toEqual(['Sem chave Marina', 'Sem chave Joana']);
    expect(Object.keys(campanhaNoBanco().resultado_variantes as object)).toEqual(['V1']);
  });
});

describe('texto fixo: falhas de envio e de gravação', () => {
  it('envio recusado pelo provedor: linha de erro, nada na conversa do Zap, conta erro e ainda espera os 5 s', async () => {
    h.enviar.mockImplementation(async (_a: unknown, _t: unknown, tel: string) => tel !== '5511999990001');
    montar(cenario());
    await rodar();
    expect(disparos().map((d) => [d.paciente_id, d.status])).toEqual([['P1', 'erro'], ['P2', 'enviado']]);
    expect(h.registrar).toHaveBeenCalledTimes(1);
    expect(h.registrar.mock.calls[0][1]).toMatchObject({ paciente_id: 'P2' });
    expect(campanhaNoBanco()).toMatchObject({ enviados: 1, erros: 1, resultado_variantes: { A: { enviados: 1, erros: 1 } } });
    expect(h.pausas).toEqual([5000, 5000]);
  });

  it('o registro na conversa do Zap que falha não transforma uma mensagem enviada em erro', async () => {
    h.registrar.mockImplementation(async () => { throw new Error('conversa indisponível'); });
    montar(cenario());
    await rodar();
    expect(campanhaNoBanco()).toMatchObject({ status: 'concluido', enviados: 2, erros: 0 });
    expect(h.pausas).toEqual([5000, 5000]);
    expect(errosTexto()).toContain('conversa indisponível');
  });

  it('erro ao gravar o disparo é avisado e NÃO impede nem desconta o envio', async () => {
    montar(cenario());
    banco().regras.push({ tabela: 'agente_disparos', op: 'insert', tipo: 'erro', mensagem: 'coluna inexistente' });
    await rodar();
    expect(textosEnviados()).toEqual([MARINA, JOANA]);
    expect(campanhaNoBanco()).toMatchObject({ enviados: 2, erros: 0 });
    expect(errosTexto()).toContain('coluna inexistente');
  });

  it('o envio que lança conta erro, avisa e a campanha segue', async () => {
    h.enviar.mockImplementationOnce(async () => { throw new Error('provedor caiu'); });
    montar(cenario());
    await rodar();
    expect(campanhaNoBanco()).toMatchObject({ status: 'concluido', enviados: 1, erros: 1 });
    expect(errosTexto()).toContain('provedor caiu');
  });

  it('erro ao fechar a campanha é avisado', async () => {
    montar(cenario());
    banco().regras.push({ tabela: 'agente_broadcasts', op: 'update', tipo: 'erro', mensagem: 'não gravou', quando: (c) => (c.payload as Linha).status === 'concluido' });
    await rodar();
    expect(errosTexto()).toContain('não fechou a campanha B1');
  });
});

// ───────────── Progresso gravado a cada envio ─────────────

// A função pode ser cortada no meio de uma campanha grande (limite de tempo da plataforma). Por isso a linha da campanha
// precisa mostrar, logo depois de cada envio, quantos já saíram e quantos deram erro, por variante. O fechamento da
// campanha (concluído, com as contagens finais) NÃO prova isso: ele refaz os mesmos números no fim.
describe('progresso da campanha gravado a cada envio', () => {
  const AB = [{ key: 'A', texto: 'A para {nome}', peso: 50 }, { key: 'B', texto: 'B para {nome}', peso: 50 }];
  const BRUNO = () => paciente('P3', { nome: 'BRUNO', telefone: '5511999990003' });
  const tres = () => cenario({ ab_variantes: AB, paciente_ids: ['P1', 'P2', 'P3'] }, [paciente('P1'), joana(), BRUNO()]);
  // Sorteio fixo: P1 recebe a variante A, P2 a B e P3 a A.
  const sortearAbA = () => vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.9).mockReturnValueOnce(0.1);
  // O banco guarda o objeto de resultado por referência: a foto precisa copiar na hora, senão vê o que vier depois.
  const foto = () => {
    const c = JSON.parse(JSON.stringify(campanhaNoBanco())) as Linha;
    return { status: c.status, enviados: c.enviados, erros: c.erros, variantes: c.resultado_variantes };
  };
  const recusaJoana = async (_admin: unknown, _terapeuta: unknown, telefone: string) => telefone !== '5511999990002';

  it('depois de cada envio a linha já mostra enviados, erros e o resultado por variante, antes da espera de 5 s', async () => {
    montar(tres());
    const antesDeCadaEnvio: unknown[] = [];
    const naEspera: unknown[] = [];
    h.enviar.mockImplementation(async (...a: unknown[]) => {
      antesDeCadaEnvio.push(foto());
      return recusaJoana(a[0], a[1], String(a[2]));
    });
    h.aoPausar = () => { naEspera.push(foto()); };
    const sorteio = sortearAbA();
    await rodar();
    sorteio.mockRestore();
    expect(antesDeCadaEnvio).toEqual([
      { status: 'executando', enviados: 0, erros: 0 },
      { status: 'executando', enviados: 1, erros: 0, variantes: { A: { enviados: 1, erros: 0 }, B: { enviados: 0, erros: 0 } } },
      { status: 'executando', enviados: 1, erros: 1, variantes: { A: { enviados: 1, erros: 0 }, B: { enviados: 0, erros: 1 } } },
    ]);
    expect(naEspera).toEqual([
      { status: 'executando', enviados: 1, erros: 0, variantes: { A: { enviados: 1, erros: 0 }, B: { enviados: 0, erros: 0 } } },
      { status: 'executando', enviados: 1, erros: 1, variantes: { A: { enviados: 1, erros: 0 }, B: { enviados: 0, erros: 1 } } },
      { status: 'executando', enviados: 2, erros: 1, variantes: { A: { enviados: 2, erros: 0 }, B: { enviados: 0, erros: 1 } } },
    ]);
    expect(foto()).toEqual({ status: 'concluido', enviados: 2, erros: 1, variantes: { A: { enviados: 2, erros: 0 }, B: { enviados: 0, erros: 1 } } });
  });

  it('o progresso só mexe nas contagens: não muda o status nem os carimbos de tempo', async () => {
    montar(tres());
    await rodar();
    const noLaco = consultasDe('agente_broadcasts', 'update').filter((c) => !('status' in (c.payload as Linha)));
    expect(noLaco).toHaveLength(3);
    for (const c of noLaco) {
      expect(Object.keys(c.payload as Linha).sort()).toEqual(['enviados', 'erros', 'resultado_variantes']);
      expect(chamadaDa(c, 'eq')).toEqual([['id', 'B1']]);
    }
  });

  it('função cortada no meio (a leitura da pausa cai no terceiro cliente): a linha fica executando com o que já saiu e o resto não é enviado', async () => {
    montar(tres());
    h.enviar.mockImplementation(recusaJoana);
    let leituras = 0;
    // 1ª leitura é a da entrada da função; as seguintes são uma por cliente, no começo de cada volta do laço.
    banco().regras.push({
      tabela: 'whatsapp_automacoes', op: 'select', tipo: 'lancar', mensagem: 'conexão caiu',
      quando: () => ++leituras === 4,
    });
    const sorteio = sortearAbA();
    await rodar('cron');
    sorteio.mockRestore();
    expect(textosEnviados()).toEqual(['A para Marina', 'B para Joana']);
    expect(disparos().map((d) => [d.paciente_id, d.status])).toEqual([['P1', 'enviado'], ['P2', 'erro']]);
    expect(foto()).toEqual({ status: 'executando', enviados: 1, erros: 1, variantes: { A: { enviados: 1, erros: 0 }, B: { enviados: 0, erros: 1 } } });
    expect(campanhaNoBanco().concluido_em).toBeUndefined();
    expect(errosTexto()).toContain('agente-broadcast background error');
    expect(errosTexto()).toContain('conexão caiu');
  });

  it('cortada logo depois do primeiro envio: a linha já mostra 1 enviado, e não zero', async () => {
    montar(cenario({ paciente_ids: ['P1', 'P2'] }));
    let leituras = 0;
    banco().regras.push({
      tabela: 'whatsapp_automacoes', op: 'select', tipo: 'lancar', mensagem: 'conexão caiu',
      quando: () => ++leituras === 3,
    });
    await rodar('cron');
    expect(textosEnviados()).toEqual([MARINA]);
    expect(foto()).toEqual({ status: 'executando', enviados: 1, erros: 0, variantes: { A: { enviados: 1, erros: 0 } } });
  });
});

// ───────────── Variante inválida: recusa antes da trava ─────────────

const VARIANTES_INVALIDAS: Array<[string, string, string]> = [
  ['chave desconhecida {horario}', 'Olá {nome}, venha às {horario}.', 'variável desconhecida'],
  ['chave {dimensao}', 'Olá {nome}, sua {dimensao} melhorou.', 'variável desconhecida'],
  ['chave {dias}, que não existe no broadcast', 'Faz {dias} dias, {nome}.', 'variável desconhecida'],
  ['chave solta {{nome}}', 'Olá {{nome}}!', 'chave { ou } solta'],
  ['chave aberta e não fechada', 'Olá {nome', 'chave { ou } solta'],
  ['texto vazio', '', 'texto vazio'],
  ['só espaços', '   \n  ', 'texto vazio'],
  ['acima de 1000 caracteres', 'a'.repeat(1001), 'acima de 1000'],
];

describe('variante inválida (texto fixo)', () => {
  it.each(VARIANTES_INVALIDAS)('%s: recusa a campanha com 422, marca recusado e não envia nada', async (_nome, texto, trecho) => {
    montar(cenario({
      ab_variantes: [{ key: 'A', texto: 'Versão boa para {nome}', peso: 50 }, { key: 'B', texto, peso: 50 }],
    }));
    const { status, corpo } = await rodar();
    expect(status).toBe(422);
    expect(corpo.error).toBe('variante_invalida');
    expect(String(corpo.detalhe)).toContain('Variante B');
    expect(String(corpo.detalhe)).toContain(trecho);
    expect(String(corpo.detalhe)).not.toContain('Variante A');
    expect(campanhaNoBanco().status).toBe('recusado');
    expect(h.enviar).not.toHaveBeenCalled();
    expect(h.registrar).not.toHaveBeenCalled();
    expect(disparos()).toEqual([]);
    expect(consultasDe('pacientes')).toEqual([]);
    expect(h.fetchChamadas).toEqual([]);
  });

  it('a recusa vem ANTES da trava: a campanha nunca chega a ficar executando', async () => {
    montar(cenario({ intencao: 'Olá {nome}, venha às {horario}.' }));
    await rodar();
    const atualizacoes = consultasDe('agente_broadcasts', 'update');
    expect(atualizacoes.map((c) => c.payload)).toEqual([{ status: 'recusado' }]);
    expect(campanhaNoBanco().iniciado_em).toBeUndefined();
  });

  it('o corpo da resposta traz só error e detalhe', async () => {
    montar(cenario({ intencao: 'Olá {nome}, venha às {horario}.' }));
    const { corpo } = await rodar();
    expect(Object.keys(corpo).sort()).toEqual(['detalhe', 'error']);
  });

  it.each([
    ['inválida na primeira', ['Olá {horario}', 'Olá {nome}'], 'Variante A'],
    ['inválida na última', ['Olá {nome}', 'Olá {horario}'], 'Variante B'],
  ])('com A/B, variante %s recusa a campanha inteira', async (_nome, [a, b], rotulo) => {
    montar(cenario({ ab_variantes: [{ key: 'A', texto: a, peso: 50 }, { key: 'B', texto: b, peso: 50 }] }));
    const { status, corpo } = await rodar();
    expect(status).toBe(422);
    expect(String(corpo.detalhe)).toContain(rotulo);
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it('as duas variantes inválidas aparecem no detalhe', async () => {
    montar(cenario({ ab_variantes: [{ key: 'A', texto: '', peso: 50 }, { key: 'B', texto: 'Oi {horario}', peso: 50 }] }));
    const { corpo } = await rodar();
    expect(String(corpo.detalhe)).toContain('Variante A: texto vazio');
    expect(String(corpo.detalhe)).toContain('Variante B: variável desconhecida');
  });

  it('um item nulo na lista de variantes recusa a campanha em vez de derrubar a função', async () => {
    montar(cenario({ ab_variantes: [null, { key: 'B', texto: 'Oi {nome}', peso: 50 }] }));
    const { status, corpo } = await rodar();
    expect(status).toBe(422);
    expect(corpo.error).toBe('variante_invalida');
  });

  it('o texto único da campanha (sem A/B) também é validado', async () => {
    montar(cenario({ intencao: 'Oi {dimensao}' }));
    const { status, corpo } = await rodar();
    expect(status).toBe(422);
    expect(String(corpo.detalhe)).toContain('Variante A');
    expect(campanhaNoBanco().status).toBe('recusado');
  });

  it('a recusa também vale para a chamada do cron, e a campanha deixa de ser agendada (o cron não volta a pegá-la)', async () => {
    montar(cenario({ intencao: 'Oi {horario}' }));
    const { status } = await rodar('cron');
    expect(status).toBe(422);
    expect(campanhaNoBanco().status).toBe('recusado');
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it.each(['agendado', 'rascunho'])('a recusa só vale para campanha %s (filtro condicional no update)', async (status) => {
    montar(cenario({ status, intencao: 'Oi {horario}' }));
    await rodar();
    const recusa = consultasDe('agente_broadcasts', 'update').find((c) => (c.payload as Linha).status === 'recusado');
    expect(chamadaDa(recusa!, 'in')).toEqual([['status', ['agendado', 'rascunho']]]);
    expect(campanhaNoBanco().status).toBe('recusado');
  });

  it('se outra chamada já tinha travado a campanha, a recusa NÃO sobrescreve o status executando', async () => {
    const b = montar(cenario({ intencao: 'Oi {horario}' }));
    const from = b.from.bind(b);
    b.from = (tabela: string) => {
      const q = from(tabela) as { update: (p: Linha) => unknown };
      if (tabela !== 'agente_broadcasts') return q;
      const update = q.update.bind(q);
      q.update = (payload: Linha) => {
        if (payload.status === 'recusado') b.tabelas.agente_broadcasts[0].status = 'executando';
        return update(payload);
      };
      return q;
    };
    const { status } = await rodar();
    expect(status).toBe(422);
    expect(campanhaNoBanco().status).toBe('executando');
  });

  it('falha ao marcar recusado é avisada e a resposta continua sendo 422', async () => {
    montar(cenario({ intencao: 'Oi {horario}' }));
    banco().regras.push({ tabela: 'agente_broadcasts', op: 'update', tipo: 'erro', mensagem: 'sem permissão' });
    const { status } = await rodar();
    expect(status).toBe(422);
    expect(errosTexto()).toContain('sem permissão');
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it('texto com exatamente 1000 caracteres e sem variável é válido e sai inteiro', async () => {
    montar(cenario({ intencao: 'a'.repeat(1000), paciente_ids: ['P1'] }));
    const { status } = await rodar();
    expect(status).toBe(200);
    expect(textosEnviados()).toEqual(['a'.repeat(1000)]);
  });

  it('briefing de campanha antiga com chave desconhecida NÃO é recusado: nada sai, e o erro fica registrado por cliente', async () => {
    montar(cenario({ ...SEM_MARCA, intencao: 'Avise que às {horario} tem vaga' }));
    h.ia = iaBoa;
    const { status } = await rodar();
    expect(status).toBe(200);
    expect(campanhaNoBanco().status).toBe('concluido');
    expect(h.enviar).not.toHaveBeenCalled();
    expect(h.fetchChamadas).toEqual([]);
    expect(disparos().map((d) => [d.status, d.erro])).toEqual([['erro', 'chave_desconhecida'], ['erro', 'chave_desconhecida']]);
    expect(campanhaNoBanco()).toMatchObject({ enviados: 0, erros: 2 });
  });

  it('campanha com IA ligada e variante inválida: nada sai', async () => {
    montar(cenario({ ...comMarca(true), intencao: 'Oi {horario}' }));
    h.ia = iaBoa;
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();
    expect(h.fetchChamadas).toEqual([]);
    expect(campanhaNoBanco()).toMatchObject({ enviados: 0, erros: 2 });
  });
});

// ───────────── Trava atômica ─────────────

const STATUS_JA_PROCESSADA = ['executando', 'concluido', 'interrompido', 'cancelado', 'recusado'];

describe('trava atômica', () => {
  it.each(STATUS_JA_PROCESSADA)('campanha %s não recomeça: nada enviado, nenhum paciente lido e o status fica', async (status) => {
    montar(cenario({ status }));
    const { status: http, corpo } = await rodar();
    expect(http).toBe(200);
    expect(corpo.ok).toBe(false);
    expect(h.enviar).not.toHaveBeenCalled();
    expect(consultasDe('pacientes')).toEqual([]);
    expect(consultasDe('agente_broadcasts', 'update')).toEqual([]);
    expect(campanhaNoBanco().status).toBe(status);
  });

  it.each(STATUS_JA_PROCESSADA)('se o status virar %s entre a leitura e a trava, a trava não deixa seguir', async (virou) => {
    const b = montar(cenario());
    const from = b.from.bind(b);
    b.from = (tabela: string) => {
      const q = from(tabela) as { update: (p: Linha) => unknown };
      if (tabela !== 'agente_broadcasts') return q;
      const update = q.update.bind(q);
      q.update = (payload: Linha) => {
        if (payload.status === 'executando') b.tabelas.agente_broadcasts[0].status = virou;
        return update(payload);
      };
      return q;
    };
    const { corpo } = await rodar();
    expect(corpo.ok).toBe(false);
    expect(h.enviar).not.toHaveBeenCalled();
    expect(consultasDe('pacientes')).toEqual([]);
    expect(campanhaNoBanco().status).toBe(virou);
  });

  it('a trava recusa exatamente os cinco status, no formato do PostgREST', async () => {
    montar(cenario());
    await rodar();
    const trava = consultasDe('agente_broadcasts', 'update').find((c) => (c.payload as Linha).status === 'executando');
    expect(chamadaDa(trava!, 'not')).toEqual([['status', 'in', '(executando,concluido,interrompido,cancelado,recusado)']]);
    expect(chamadaDa(trava!, 'eq')).toEqual([['id', 'B1']]);
  });

  it('a trava grava o total e o início ao travar', async () => {
    montar(cenario({ paciente_ids: ['P1', 'P2', 'P1'] }));
    await rodar();
    const trava = consultasDe('agente_broadcasts', 'update').find((c) => (c.payload as Linha).status === 'executando');
    expect(trava!.payload).toMatchObject({ status: 'executando', total: 2 });
    expect(typeof (trava!.payload as Linha).iniciado_em).toBe('string');
  });

  it('cron e clique ao mesmo tempo: só um deles envia, e cada pessoa recebe uma vez só', async () => {
    montar(cenario());
    const [a, b] = await Promise.all([iniciar('cron'), iniciar('T1')]);
    await terminar();
    expect([a.corpo.ok, b.corpo.ok].sort()).toEqual([false, true]);
    expect(textosEnviados()).toEqual([MARINA, JOANA]);
    expect(disparos()).toHaveLength(2);
  });

  it('chamar de novo depois de concluída não envia outra vez', async () => {
    montar(cenario());
    await rodar();
    expect(h.enviar).toHaveBeenCalledTimes(2);
    const { corpo } = await rodar();
    expect(corpo.ok).toBe(false);
    expect(h.enviar).toHaveBeenCalledTimes(2);
  });

  it.each(['agendado', 'rascunho'])('campanha %s é aceita', async (status) => {
    montar(cenario({ status }));
    const { corpo } = await rodar();
    expect(corpo.ok).toBe(true);
    expect(h.enviar).toHaveBeenCalledTimes(2);
  });
});

// ───────────── Pausar automações ─────────────

describe('pausa das automações', () => {
  it('campanha AGENDADA (cron) com a conta pausada: nada sai, nenhum paciente é lido e ela continua agendada', async () => {
    montar(cenario({}, [paciente('P1'), joana()], { whatsapp_automacoes: [{ terapeuta_id: 'T1', tom_voz: 'amigavel', automacoes_pausadas: true }] }));
    const { corpo } = await rodar('cron');
    expect(corpo).toEqual({ ok: true, skip: 'automações pausadas' });
    expect(h.enviar).not.toHaveBeenCalled();
    expect(consultasDe('pacientes')).toEqual([]);
    expect(campanhaNoBanco().status).toBe('agendado');
  });

  it('envio imediato do próprio profissional NÃO é pausado', async () => {
    montar(cenario({}, [paciente('P1'), joana()], { whatsapp_automacoes: [{ terapeuta_id: 'T1', tom_voz: 'amigavel', automacoes_pausadas: true }] }));
    await rodar('T1');
    expect(textosEnviados()).toEqual([MARINA, JOANA]);
  });

  it('pausou no meio da campanha agendada: para, marca interrompido e não manda aos que faltam', async () => {
    montar(cenario({ paciente_ids: ['P1', 'P2', 'P3'] }, [paciente('P1'), joana(), paciente('P3', { nome: 'BRUNO', telefone: '5511999990003' })]));
    h.enviar.mockImplementation(async () => {
      banco().tabelas.whatsapp_automacoes[0].automacoes_pausadas = true;
      return true;
    });
    await rodar('cron');
    expect(textosEnviados()).toEqual([MARINA]);
    expect(campanhaNoBanco()).toMatchObject({ status: 'interrompido', enviados: 1 });
    expect(typeof campanhaNoBanco().concluido_em).toBe('string');
  });

  it('o envio imediato não é interrompido quando a conta é pausada no meio', async () => {
    montar(cenario());
    h.enviar.mockImplementation(async () => {
      banco().tabelas.whatsapp_automacoes[0].automacoes_pausadas = true;
      return true;
    });
    await rodar('T1');
    expect(textosEnviados()).toEqual([MARINA, JOANA]);
    expect(campanhaNoBanco().status).toBe('concluido');
  });

  it('conta sem linha de automações não é considerada pausada', async () => {
    montar(cenario({}, [paciente('P1'), joana()], { whatsapp_automacoes: [] }));
    await rodar('cron');
    expect(textosEnviados()).toEqual([MARINA, JOANA]);
  });
});

// ───────────── IA enxuta: campanha com a marca (true) e campanha antiga (sem marca) ─────────────

// Nada disto pode aparecer no pedido à IA. A ficha do cenário traz tudo isso de propósito.
const PROIBIDOS_NO_PEDIDO: Array<[string, RegExp]> = [
  ['MyID', /myid/i],
  ['red flag', /red\s*flag/i],
  ['a palavra telefone', /telefone/i],
  ['o telefone do cliente', /5511999990001|5511999990002|99990001|99990002/],
  ['o sobrenome Souza', /souza/i],
  ['o sobrenome Lima', /\blima\b/i],
  ['o diagnóstico', /lombalgia/i],
  ['a data de nascimento', /1990/],
  ['o nome em caixa alta do cadastro', /MARINA|JOANA/],
];

function conferirPedidoEnxuto() {
  const chamadas = geminiChamadas();
  expect(chamadas.length).toBeGreaterThan(0);
  for (const c of chamadas) {
    for (const [rotulo, padrao] of PROIBIDOS_NO_PEDIDO) expect(c.corpo, rotulo).not.toMatch(padrao);
    expect(Object.keys(JSON.parse(c.corpo) as object).sort()).toEqual(['messages', 'model']);
    const pedido = pedidoDaIA(c.corpo);
    expect(pedido.model).toBe('gemini-3.1-flash-lite');
    expect(pedido.messages.map((m) => m.role)).toEqual(['system', 'user']);
    expect(c.metodo).toBe('POST');
    expect(c.headers.Authorization).toBe('Bearer chave-gemini-falsa');
    expect(c.signal).toBeDefined();
  }
}

const MODOS_COM_IA: Array<[string, Linha]> = [
  ['marca true', comMarca(true)],
  ['sem marca (campanha antiga)', SEM_MARCA],
];

describe.each(MODOS_COM_IA)('pedido à IA e medição: %s', (_nome, marca) => {
  it('o pedido é enxuto: só o tom, o primeiro nome e o texto já com o nome trocado', async () => {
    h.ia = iaBoa;
    montar(cenario(marca, [paciente('P1', { nome: 'MARINA SOUZA' }), joana()], {
      daily_logs: [{ id: 'd1', paciente_id: 'P1', created_at: '2026-11-01T10:00:00Z', dor: 7 }],
    }));
    await rodar();
    conferirPedidoEnxuto();
    expect(geminiChamadas()).toHaveLength(2);
    const [primeira, segunda] = geminiChamadas().map((c) => pedidoDaIA(c.corpo).messages[1].content);
    expect(primeira).toContain('Primeiro nome do cliente: Marina');
    expect(primeira).toContain(`Texto base:\n${MARINA}`);
    expect(segunda).toContain('Primeiro nome do cliente: Joana');
    expect(segunda).toContain(`Texto base:\n${JOANA}`);
    expect(`${primeira}${segunda}`).not.toMatch(/[{}]/);
  });

  it('não lê nada clínico do cliente: só campanha, paciente, tom da clínica e disparos', async () => {
    h.ia = iaBoa;
    montar(cenario(marca));
    await rodar();
    expect(tabelasLidas()).toEqual(['agente_broadcasts', 'agente_disparos', 'pacientes', 'whatsapp_automacoes']);
  });

  it('IA aprovada: o texto enviado, gravado e registrado na conversa é o da IA', async () => {
    h.ia = iaBoa;
    montar(cenario(marca));
    await rodar();
    expect(textosEnviados()).toEqual([textoDaIABoa('Marina'), textoDaIABoa('Joana')]);
    expect(disparos().map((d) => [d.conteudo, d.status])).toEqual([[textoDaIABoa('Marina'), 'enviado'], [textoDaIABoa('Joana'), 'enviado']]);
    expect(h.registrar.mock.calls.map((c) => (c[1] as Linha).conteudo)).toEqual([textoDaIABoa('Marina'), textoDaIABoa('Joana')]);
    expect(h.enviar.mock.calls[0].slice(1, 3)).toEqual(['T1', '5511999990001']);
    expect(h.enviar.mock.calls[0][4]).toEqual({ manual: true });
    expect(h.pausas).toEqual([5000, 5000]);
  });

  it('a IA devolve texto com espaços nas pontas: sai aparado', async () => {
    h.ia = (corpo) => respostaIA(`\n  ${textoDaIABoa(nomeDoPedido(corpo))}  \n`);
    montar(cenario(marca));
    await rodar();
    expect(textosEnviados()).toEqual([textoDaIABoa('Marina'), textoDaIABoa('Joana')]);
  });

  it('mede o uso de cada chamada, ANTES do envio, com o nome da pasta da função e o modelo', async () => {
    h.ia = iaBoa;
    montar(cenario(marca));
    await rodar();
    expect(h.logIA).toHaveBeenCalledTimes(2);
    for (const chamada of h.logIA.mock.calls) {
      expect(chamada).toEqual(['agente-broadcast', 'gemini-3.1-flash-lite', { prompt_tokens: 10, completion_tokens: 5 }]);
    }
    const log = h.logIA.mock.invocationCallOrder;
    const envio = h.enviar.mock.invocationCallOrder;
    expect(log[0]).toBeLessThan(envio[0]);
    expect(log[1]).toBeLessThan(envio[1]);
  });

  it('resposta sem usage: a função não quebra e a medição recebe o vazio', async () => {
    h.ia = (corpo) => new Response(JSON.stringify({ choices: [{ message: { content: textoDaIABoa(nomeDoPedido(corpo)) } }] }), { status: 200 });
    montar(cenario(marca));
    await rodar();
    expect(textosEnviados()).toEqual([textoDaIABoa('Marina'), textoDaIABoa('Joana')]);
    expect(h.logIA).toHaveBeenCalledTimes(2);
    expect(h.logIA.mock.calls[0][2]).toBeUndefined();
  });

  it('saída reprovada também gasta IA: o uso é medido mesmo assim', async () => {
    h.ia = () => respostaIA('Oi {nome}!');
    montar(cenario({ ...marca, paciente_ids: ['P1'] }));
    await rodar();
    expect(h.logIA).toHaveBeenCalledTimes(1);
  });

  const USO_COBRADO = { prompt_tokens: 40, completion_tokens: 0 };
  const SEM_TEXTO: Array<[string, Record<string, unknown>]> = [
    ['conteúdo que não é texto', { choices: [{ message: { content: 42 } }] }],
    ['conteúdo nulo, como na resposta bloqueada pelo filtro de segurança', { choices: [{ message: { content: null } }] }],
    ['mensagem sem conteúdo', { choices: [{ message: {} }] }],
    ['lista de choices vazia', { choices: [] }],
    ['sem choices', {}],
    ['texto vazio', { choices: [{ message: { content: '' } }] }],
    ['só espaços', { choices: [{ message: { content: '  \n ' } }] }],
  ];

  it.each(SEM_TEXTO)('resposta sem texto aproveitável (%s) com tokens cobrados: o uso é medido mesmo assim e não vira falha de programa', async (_nome, corpoDaResposta) => {
    h.ia = () => new Response(JSON.stringify({ ...corpoDaResposta, usage: USO_COBRADO }), { status: 200 });
    montar(cenario({ ...marca, paciente_ids: ['P1'] }, [paciente('P1')]));
    await rodar();
    expect(geminiChamadas()).toHaveLength(1);
    expect(h.logIA).toHaveBeenCalledTimes(1);
    expect(h.logIA).toHaveBeenCalledWith('agente-broadcast', 'gemini-3.1-flash-lite', USO_COBRADO);
    expect(avisosTexto()).not.toContain('IA indisponível');
  });

  it('resposta não-ok não tem uso a medir', async () => {
    h.ia = () => new Response('erro', { status: 503 });
    montar(cenario({ ...marca, paciente_ids: ['P1'] }));
    await rodar();
    expect(h.logIA).not.toHaveBeenCalled();
  });

  it('o temporizador de 20 s é limpo depois de cada resposta', async () => {
    h.ia = iaBoa;
    montar(cenario(marca));
    await rodar();
    expect(h.temporizadoresIA).toHaveLength(2);
    expect(h.temporizadoresIA.every((t) => t.ms === 20_000 && t.limpo)).toBe(true);
  });

  it('IA que não responde: o temporizador de 20 s aborta a chamada', async () => {
    h.ia = iaPendente;
    montar(cenario({ ...marca, paciente_ids: ['P1'] }));
    const { corpo } = await iniciar();
    expect(corpo.ok).toBe(true);
    await ate(() => geminiChamadas().length === 1);
    expect(h.temporizadoresIA).toHaveLength(1);
    expect(h.temporizadoresIA[0].ms).toBe(20_000);
    const sinal = geminiChamadas()[0].signal!;
    expect(sinal.aborted).toBe(false);
    expect(h.enviar).not.toHaveBeenCalled();
    h.temporizadoresIA[0].fn();
    expect(sinal.aborted).toBe(true);
    await terminar();
    expect(h.temporizadoresIA[0].limpo).toBe(true);
    expect(avisosTexto()).toContain('IA indisponível');
  });

  it('sem a chave da IA nem tenta chamar o provedor', async () => {
    delete h.env.GEMINI_API_KEY;
    h.ia = iaBoa;
    montar(cenario({ ...marca, paciente_ids: ['P1'] }, [paciente('P1')]));
    await rodar();
    expect(h.fetchChamadas).toEqual([]);
    expect(h.logIA).not.toHaveBeenCalled();
  });

  it('uma única chamada à IA por cliente', async () => {
    h.ia = iaBoa;
    montar(cenario({ ...marca, paciente_ids: ['P1', 'P2', 'P1'] }));
    await rodar();
    expect(geminiChamadas()).toHaveLength(2);
  });

  it('cliente sem primeiro nome aproveitável: não chama a IA, não envia e grava a linha de erro', async () => {
    h.ia = iaBoa;
    montar(cenario(marca, [paciente('P1', { nome: 'bit.ly/x' }), joana()]));
    await rodar();
    expect(geminiChamadas()).toHaveLength(1);
    expect(textosEnviados()).toEqual([textoDaIABoa('Joana')]);
    expect(disparos().find((d) => d.paciente_id === 'P1')).toMatchObject({ status: 'erro', erro: 'sem_nome', conteudo: TEXTO });
    expect(h.pausas).toEqual([5000]);
  });

  it('as regras de quem recebe valem também com IA: outro profissional, inativo e vínculo encerrado ficam de fora sem gastar IA', async () => {
    h.ia = iaBoa;
    montar(cenario({ ...marca, paciente_ids: ['P1', 'PX', 'P3', 'P4'] }, [
      paciente('P1'),
      paciente('PX', { terapeuta_id: 'T2' }),
      paciente('P3', { ativo: false }),
      paciente('P4', { vinculo_encerrado_em: '2026-11-01T10:00:00Z' }),
    ]));
    await rodar();
    expect(textosEnviados()).toEqual([textoDaIABoa('Marina')]);
    expect(geminiChamadas()).toHaveLength(1);
    expect(campanhaNoBanco()).toMatchObject({ enviados: 1, erros: 3 });
  });

  it('o tom da clínica é lido uma vez por rodada, não por cliente', async () => {
    h.ia = iaBoa;
    montar(cenario({ ...marca, paciente_ids: ['P1', 'P2', 'P3'] }, [paciente('P1'), joana(), paciente('P3', { nome: 'BRUNO', telefone: '5511999990003' })]));
    await rodar();
    const leituras = consultasDe('whatsapp_automacoes').filter((c) => chamadaDa(c, 'select')[0][0] === 'tom_voz');
    expect(leituras).toHaveLength(1);
    expect(chamadaDa(leituras[0], 'eq')).toEqual([['terapeuta_id', 'T1']]);
  });

  it.each([
    ['formal', 'formal e respeitoso'],
    ['tecnico', 'objetivo e direto'],
    ['amigavel', 'amigável, próximo'],
    ['xyz', 'amigável, próximo'],
    ['', 'amigável, próximo'],
    [null, 'amigável, próximo'],
  ])('tom da clínica %j vai para o pedido como "%s"', async (tom, trecho) => {
    h.ia = iaBoa;
    montar(cenario({ ...marca, paciente_ids: ['P1'] }, [paciente('P1')], {
      whatsapp_automacoes: [{ terapeuta_id: 'T1', tom_voz: tom, automacoes_pausadas: false }],
    }));
    await rodar();
    expect(pedidoDaIA(geminiChamadas()[0].corpo).messages[0].content).toContain(trecho);
  });

  it('clínica sem linha de automações usa o tom amigável', async () => {
    h.ia = iaBoa;
    montar(cenario({ ...marca, paciente_ids: ['P1'] }, [paciente('P1')], { whatsapp_automacoes: [] }));
    await rodar();
    expect(pedidoDaIA(geminiChamadas()[0].corpo).messages[0].content).toContain('amigável, próximo');
  });

  it('falha ao ler o tom: avisa, usa o amigável e a campanha segue', async () => {
    h.ia = iaBoa;
    montar(cenario({ ...marca, paciente_ids: ['P1'] }, [paciente('P1')]));
    banco().regras.push({ tabela: 'whatsapp_automacoes', op: 'select', tipo: 'lancar', mensagem: 'sem conexão' });
    await rodar();
    expect(textosEnviados()).toEqual([textoDaIABoa('Marina')]);
    expect(pedidoDaIA(geminiChamadas()[0].corpo).messages[0].content).toContain('amigável, próximo');
    expect(avisosTexto()).toContain('sem conexão');
  });

  it('a campanha respeita número, data e link do texto: IA que mantém tudo é aceita', async () => {
    const texto = 'Olá {nome}, sábado 15/12 às 9:30 temos vaga. Agende em https://exemplo.com.br/agenda.';
    h.ia = (corpo) => respostaIA(`Oi ${nomeDoPedido(corpo)}! Sábado 15/12 às 9:30 tem vaga, agende em https://exemplo.com.br/agenda`);
    montar(cenario({ ...marca, intencao: texto, paciente_ids: ['P1'] }, [paciente('P1')]));
    await rodar();
    expect(textosEnviados()).toEqual(['Oi Marina! Sábado 15/12 às 9:30 tem vaga, agende em https://exemplo.com.br/agenda']);
  });

  it('reprovada por faltar número do original: o aviso diz o motivo e não vaza o texto do cliente', async () => {
    const texto = 'Olá {nome}, sábado 15/12 às 9:30 temos vaga.';
    h.ia = (corpo) => respostaIA(`Oi ${nomeDoPedido(corpo)}, sábado temos vaga.`);
    montar(cenario({ ...marca, intencao: texto, paciente_ids: ['P1'] }, [paciente('P1')]));
    await rodar();
    expect(avisosTexto()).toContain('numero_ausente');
    expect(avisosTexto()).not.toContain('Marina');
  });
});

describe('campanha com a marca true: se a IA falhar, vai o texto fixo com o nome trocado', () => {
  it.each(FALHAS_DA_IA)('%s: envia o texto renderizado, nunca o {nome} cru', async (_nome, preparar) => {
    preparar();
    montar(cenario(comMarca(true)));
    await rodar();
    expect(textosEnviados()).toEqual([MARINA, JOANA]);
    expect(disparos().map((d) => [d.conteudo, d.status])).toEqual([[MARINA, 'enviado'], [JOANA, 'enviado']]);
    expect(campanhaNoBanco()).toMatchObject({ status: 'concluido', enviados: 2, erros: 0 });
    expect(h.registrar).toHaveBeenCalledTimes(2);
  });

  it('a IA falha só para um cliente: o seguinte recebe o texto da IA', async () => {
    let chamadas = 0;
    h.ia = (corpo) => {
      chamadas++;
      if (chamadas === 1) return new Response('erro', { status: 500 });
      return iaBoa(corpo);
    };
    montar(cenario(comMarca(true)));
    await rodar();
    expect(textosEnviados()).toEqual([MARINA, textoDaIABoa('Joana')]);
  });

  it('as regras do A/B valem com IA: cada cliente recebe a reescrita da variante sorteada', async () => {
    h.ia = iaBoa;
    montar(cenario({ ...comMarca(true), ab_variantes: [{ key: 'A', texto: 'A para {nome}', peso: 50 }, { key: 'B', texto: 'B para {nome}', peso: 50 }] }));
    const sorteio = vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);
    await rodar();
    sorteio.mockRestore();
    const textosBase = geminiChamadas().map((c) => pedidoDaIA(c.corpo).messages[1].content);
    expect(textosBase[0]).toContain('Texto base:\nA para Marina');
    expect(textosBase[1]).toContain('Texto base:\nB para Joana');
    expect(campanhaNoBanco()).toMatchObject({ resultado_variantes: { A: { enviados: 1, erros: 0 }, B: { enviados: 1, erros: 0 } } });
  });
});

describe('campanha antiga (sem a marca): o texto é um briefing, nunca vai cru', () => {
  const BRIEFING = 'Avise {nome} que vale a pena retomar os exercícios.';

  it.each(FALHAS_DA_IA)('%s: NÃO envia, conta erro ia_indisponivel e segue para o próximo', async (_nome, preparar) => {
    preparar();
    montar(cenario({ ...SEM_MARCA, intencao: BRIEFING }));
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();
    expect(h.registrar).not.toHaveBeenCalled();
    expect(disparos().map((d) => [d.paciente_id, d.status, d.erro])).toEqual([['P1', 'erro', 'ia_indisponivel'], ['P2', 'erro', 'ia_indisponivel']]);
    expect(disparos().map((d) => d.conteudo)).toEqual(['Avise Marina que vale a pena retomar os exercícios.', 'Avise Joana que vale a pena retomar os exercícios.']);
    expect(campanhaNoBanco()).toMatchObject({ status: 'concluido', enviados: 0, erros: 2, resultado_variantes: { A: { enviados: 0, erros: 2 } } });
    expect(h.pausas).toEqual([]);
  });

  it('IA aprovada: sai a reescrita, nunca o briefing', async () => {
    h.ia = iaBoa;
    montar(cenario({ ...SEM_MARCA, intencao: BRIEFING }));
    await rodar();
    expect(textosEnviados()).toEqual([textoDaIABoa('Marina'), textoDaIABoa('Joana')]);
    expect(textosEnviados().join('')).not.toContain('Avise');
  });

  it('a IA falha só para um cliente: ele fica sem a mensagem e o seguinte recebe a reescrita', async () => {
    let chamadas = 0;
    h.ia = (corpo) => {
      chamadas++;
      if (chamadas === 1) return new Response('erro', { status: 500 });
      return iaBoa(corpo);
    };
    montar(cenario({ ...SEM_MARCA, intencao: BRIEFING }));
    await rodar();
    expect(textosEnviados()).toEqual([textoDaIABoa('Joana')]);
    expect(disparos().map((d) => [d.paciente_id, d.status, d.erro])).toEqual([['P1', 'erro', 'ia_indisponivel'], ['P2', 'enviado', undefined]]);
    expect(h.pausas).toEqual([5000]);
    expect(campanhaNoBanco()).toMatchObject({ enviados: 1, erros: 1 });
  });

  it('o briefing entra no pedido com o nome trocado, e não como mensagem', async () => {
    h.ia = iaBoa;
    montar(cenario({ ...SEM_MARCA, intencao: BRIEFING, paciente_ids: ['P1'] }, [paciente('P1')]));
    await rodar();
    conferirPedidoEnxuto();
    expect(pedidoDaIA(geminiChamadas()[0].corpo).messages[1].content).toContain('Texto base:\nAvise Marina que vale a pena retomar os exercícios.');
  });

  it.each([
    ['sem a chave personalizar_ia', { segmento: 'todos' }],
    ['filtro vazio', {}],
    ['personalizar_ia nulo', { segmento: 'todos', personalizar_ia: null }],
    ['personalizar_ia "false" em texto', { segmento: 'todos', personalizar_ia: 'false' }],
    ['personalizar_ia "true" em texto', { segmento: 'todos', personalizar_ia: 'true' }],
    ['personalizar_ia 0', { segmento: 'todos', personalizar_ia: 0 }],
    ['personalizar_ia 1', { segmento: 'todos', personalizar_ia: 1 }],
    ['filtro que não é objeto', 'texto solto'],
  ])('%s: só a marca booleana vale, o resto é briefing (IA falhando = não envia)', async (_nome, filtro) => {
    h.ia = () => new Response('erro', { status: 500 });
    montar(cenario({ filtro, intencao: BRIEFING }));
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();
    expect(campanhaNoBanco()).toMatchObject({ status: 'concluido', enviados: 0, erros: 2 });
    expect(geminiChamadas()).toHaveLength(2);
  });

  it('contraste: a MESMA falha da IA com a marca true envia o texto renderizado', async () => {
    h.ia = () => new Response('erro', { status: 500 });
    montar(cenario({ ...comMarca(true), intencao: BRIEFING }));
    await rodar();
    expect(textosEnviados()).toEqual(['Avise Marina que vale a pena retomar os exercícios.', 'Avise Joana que vale a pena retomar os exercícios.']);
  });

  it('contraste: a marca false NÃO chama a IA e envia o texto', async () => {
    h.ia = iaBoa;
    montar(cenario({ ...comMarca(false), intencao: BRIEFING }));
    await rodar();
    expect(h.fetchChamadas).toEqual([]);
    expect(textosEnviados()).toEqual(['Avise Marina que vale a pena retomar os exercícios.', 'Avise Joana que vale a pena retomar os exercícios.']);
  });
});
