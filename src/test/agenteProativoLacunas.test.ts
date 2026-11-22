// Handler do agente-proativo carregado de verdade (supabase/functions/agente-proativo/index.ts), com dublês para o
// banco, o envio de WhatsApp, o registro na conversa, o log de uso de IA, o Deno, o relógio e o fetch.
// ATENÇÃO: essa função manda WhatsApp para clientes reais. Por isso o fetch do teste LANÇA para qualquer endereço,
// inclusive z-api.io, graph.facebook.com e generativelanguage.googleapis.com; só a IA tem dublê, e só nos testes que o
// instalam. Um teste canário prova que o bloqueio dispara, então um mock esquecido nunca vira envio de verdade.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { criarBancoProativo, type BancoProativo, type Linha } from './helpers/bancoProativoFalso';

const h = vi.hoisted(() => ({
  banco: null as unknown,
  handler: null as null | ((req: Request) => Promise<Response>),
  env: {} as Record<string, string | undefined>,
  enviar: vi.fn(),
  registrar: vi.fn(),
  logIA: vi.fn(),
  prompts: [] as unknown[],
  fetchChamadas: [] as Array<{ url: string; metodo: string; headers: Record<string, string>; corpo: string }>,
  ia: null as null | ((corpo: string) => Response),
  pausas: [] as number[],
  esperasDaIA: 0,
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
// O contexto clínico roda de verdade (decide quem entra em cada gatilho); só se anota quando o prompt da IA é montado.
vi.mock('../../supabase/functions/_shared/agente-contexto.ts', async (importOriginal) => {
  const real = await importOriginal<Record<string, unknown> & { buildSystemPrompt: (ctx: unknown) => string }>();
  return {
    ...real,
    buildSystemPrompt: (ctx: unknown) => {
      h.prompts.push(ctx);
      return real.buildSystemPrompt(ctx);
    },
  };
});

const CAMINHO_DO_HANDLER = '../../supabase/functions/agente-proativo/index.ts';
const PASTA_DA_FUNCAO = CAMINHO_DO_HANDLER.split('/').slice(-2)[0];
const URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

const fetchFalso = (entrada: unknown, init?: { method?: string; headers?: Record<string, string>; body?: unknown }): Promise<Response> => {
  const url = String(entrada);
  const host = new URL(url).hostname;
  const corpo = String(init?.body ?? '');
  h.fetchChamadas.push({ url, metodo: init?.method ?? 'GET', headers: init?.headers ?? {}, corpo, signal: (init as { signal?: AbortSignal } | undefined)?.signal } as never);
  if (host === 'generativelanguage.googleapis.com' && h.ia !== null) return Promise.resolve(h.ia(corpo));
  throw new Error(`fetch bloqueado no teste (${host}): nenhum provedor real pode ser chamado`);
};

// ───────────── Cenário ─────────────

const DIA = 86_400_000;
const HORA = 3_600_000;
const MINUTO = 60_000;
const NOVE_H = '2026-11-09T12:00:00Z';
const AGORA = Date.parse(NOVE_H);
const iso = (msAntes: number) => new Date(AGORA - msAntes).toISOString();
const relogio = (quando: string) => vi.setSystemTime(new Date(quando));

const cfg = (extra: Linha = {}): Linha => ({
  terapeuta_id: 'T1',
  bot_ativo: true,
  tom_voz: 'amigavel',
  automacoes_pausadas: false,
  gatilhos_ativos: { aniversario: true, diario_pendente: true, myid_vencido: true, reengajamento: true },
  ...extra,
});

const paciente = (extra: Linha = {}): Linha => ({
  id: 'P1',
  terapeuta_id: 'T1',
  nome: 'MARINA',
  sobrenome: 'Souza',
  telefone: '5511999990001',
  ativo: true,
  vinculo_encerrado_em: null,
  data_nascimento: '1990-01-15',
  ...extra,
});

const ANIVERSARIO_HOJE = '1990-11-09';
const diario = (pid: string, dias: number): Linha => ({ id: `dl-${pid}`, paciente_id: pid, created_at: iso(dias * DIA) });
const myid = (pid: string, dias: number, extra: Linha = {}): Linha => ({
  id: `my-${pid}`, paciente_id: pid, updated_at: iso(dias * DIA), status: 'concluido',
  myid_score_parcial: 61, dimensoes_preenchidas: {}, red_flags_detectadas: false, ...extra,
});
const sessao = (pid: string, dias: number): Linha => ({ id: `ag-${pid}`, paciente_id: pid, status: 'concluido', data_inicio: iso(dias * DIA) });

// Uma cliente (Marina, P1) elegível aos 4 gatilhos: aniversário hoje, diário parado há 5 dias, MyID de 45 dias e
// última sessão há 14 dias.
const tudo = (): Record<string, Linha[]> => ({
  whatsapp_automacoes: [cfg()],
  pacientes: [paciente({ data_nascimento: ANIVERSARIO_HOJE })],
  daily_logs: [diario('P1', 5)],
  myid_avaliacoes: [myid('P1', 45)],
  agendamentos: [sessao('P1', 14)],
});

// Só o aniversário vale para cada cliente da lista; serve para contar terapeutas e pacientes sem outros gatilhos.
const soAniversario = (...ids: Array<[string, string]>): Record<string, Linha[]> => ({
  whatsapp_automacoes: ids.map(([t]) => cfg({ terapeuta_id: t })),
  pacientes: ids.map(([t, p]) => paciente({ id: p, terapeuta_id: t, data_nascimento: ANIVERSARIO_HOJE, telefone: `551199999000${p.replace(/\D/g, '')}` })),
});

// Duas contas, cada uma com uma cliente elegível aos 4 gatilhos (Marina em T1, Joana em T2).
const doisCompletos = (extraT1: Linha = {}): Record<string, Linha[]> => ({
  whatsapp_automacoes: [cfg({ terapeuta_id: 'T1', ...extraT1 }), cfg({ terapeuta_id: 'T2' })],
  pacientes: [
    paciente({ data_nascimento: ANIVERSARIO_HOJE }),
    paciente({ id: 'P2', terapeuta_id: 'T2', telefone: '5511999990002', nome: 'JOANA', data_nascimento: ANIVERSARIO_HOJE }),
  ],
  daily_logs: [diario('P1', 5), diario('P2', 5)],
  myid_avaliacoes: [myid('P1', 45), myid('P2', 45)],
  agendamentos: [sessao('P1', 14), sessao('P2', 14)],
});

const montar = (tabelas: Record<string, Linha[]>): BancoProativo => {
  const banco = criarBancoProativo(tabelas);
  h.banco = banco;
  return banco;
};
const banco = () => h.banco as BancoProativo;

// ───────────── Resposta da IA (dublê) ─────────────

const respostaIA = (texto: string, usage: unknown = { prompt_tokens: 10, completion_tokens: 5 }) =>
  new Response(JSON.stringify({ choices: [{ message: { content: texto } }], usage }), { status: 200 });

const instrucaoDo = (corpo: string): string => (JSON.parse(corpo) as { messages: Array<{ content: string }> }).messages[1].content;
const gatilhoDoPedido = (corpo: string): string => {
  const instrucao = instrucaoDo(corpo);
  if (instrucao.startsWith('HOJE é aniversário')) return 'aniversario';
  if (instrucao.includes('não registra o diário')) return 'diario_pendente';
  if (instrucao.startsWith('O MyID do paciente')) return 'myid_vencido';
  if (instrucao.includes('não tem sessão há')) return 'reengajamento';
  return 'desconhecido';
};
const iaPadrao = (corpo: string) => respostaIA(`Texto da IA para ${gatilhoDoPedido(corpo)}`);

// ───────────── Execução e leitura ─────────────

interface Resumo {
  hora_brt: number;
  terapeutas: number;
  pausados: number;
  terapeutas_por_modo: Record<string, number>;
  terapeutas_restantes: string[];
  duracao_ms: number;
  enviados: number;
  falhas_envio: number;
  simulados: number;
  recusados: Record<string, number>;
  recusariam_na_simulacao: Record<string, number>;
  erros_gatilho: number;
  erros_gravacao: number;
}

async function rodar(auth = true) {
  const res = await h.handler!(new Request('https://x.supabase.co/functions/v1/agente-proativo', {
    method: 'POST',
    headers: auth ? { Authorization: 'Bearer chave-de-servico' } : {},
    body: '{}',
  }));
  return { status: res.status, corpo: (await res.json()) as { ok: boolean; stats: Record<string, number>; resumo: Resumo } };
}

const modo = (valor: string | undefined, lista?: string) => {
  h.env.MOTOR_MODELOS_MODO = valor;
  h.env.MOTOR_MODELOS_TERAPEUTAS = lista;
};

const disparos = () => banco().linhas('agente_disparos');
const reais = () => disparos().filter((l) => !String(l.gatilho).startsWith('simulado:'));
const simulados = () => disparos().filter((l) => String(l.gatilho).startsWith('simulado:'));
const gatilhosDe = (linhas: Linha[]) => linhas.map((l) => l.gatilho);
const textosEnviados = () => h.enviar.mock.calls.map((c) => String(c[3]));
const consultasDe = (tabela: string, op?: string) => banco().consultas.filter((c) => c.tabela === tabela && (op === undefined || c.op === op));
const chamadaDa = (c: { chamadas: Array<[string, unknown[]]> }, metodo: string) => c.chamadas.filter(([m]) => m === metodo).map(([, a]) => a);
const avisosTexto = () => avisos.mock.calls.flat().map(String).join(' | ');
const errosTexto = () => erros.mock.calls.flat().map(String).join(' | ');

// ───────────── Textos prontos esperados (Marina; diário 5 dias, MyID 45, reengajamento 14) ─────────────

const TEXTOS: Record<'amigavel' | 'formal' | 'tecnico', string[]> = {
  amigavel: [
    'Parabéns, Marina! 🎉 Que o seu dia seja leve e cheio de alegria. Um abraço de toda a equipe! 💙',
    'Oi Marina! 💙 Faz 5 dias que o seu diário no app está sem registro. Quando puder, dá uma passadinha por lá e conta como foi o seu dia.',
    'Oi Marina! 💙 Já faz 45 dias desde o seu último MyID. Que tal abrir o app e atualizar quando puder?',
    'Oi Marina! 💙 Faz 14 dias que a gente não se vê por aqui e passamos para dar um oi. Se ainda não tiver um horário marcado, é só responder esta mensagem.',
  ],
  formal: [
    'Olá, Marina. Em nome de toda a equipe, desejamos um feliz aniversário, com muita alegria e realizações.',
    'Olá, Marina. O seu diário no aplicativo está sem registro há 5 dias. Sempre que desejar, você pode fazer um novo registro.',
    'Olá, Marina. Já se passaram 45 dias desde o seu último MyID. Quando for conveniente, acesse o aplicativo para atualizá-lo.',
    'Olá, Marina. Já se passaram 14 dias desde o seu último atendimento. Se ainda não houver um horário marcado, estamos à disposição para agendar.',
  ],
  tecnico: [
    'Marina, feliz aniversário! Desejamos a você um ótimo dia e um excelente novo ano.',
    'Marina, o seu diário está sem registro há 5 dias. Acesse o aplicativo para fazer um novo registro.',
    'Marina, faz 45 dias desde o seu último MyID. Acesse o aplicativo para atualizá-lo.',
    'Marina, faz 14 dias desde o seu último atendimento. Para agendar um novo horário, responda esta mensagem.',
  ],
};
const GATILHOS_EM_ORDEM = ['aniversario', 'diario_pendente', 'myid_vencido', 'reengajamento_14d'];
const INSTRUCOES_DA_IA = [
  'HOJE é aniversário do paciente. Gere mensagem CURTA, calorosa, com um voto sincero. Sem promoções.',
  'O paciente não registra o diário de saúde há 5 dias. Gere uma mensagem MUITO curta (2 linhas), leve e gentil, convidando a registrar no app como está se sentindo hoje (humor, dor, energia, sono). Sem culpar. Tom de cuidado.',
  'O MyID do paciente foi feito há 45 dias. Gere mensagem CURTA convidando a refazer a avaliação para vermos a evolução. Tom positivo.',
  'O paciente não tem sessão há 14 dias. Gere uma mensagem (3 linhas) gentil perguntando como está e oferecendo retomar o cuidado. NÃO seja insistente nem culpe. Tom de cuidado genuíno.',
];
const TEXTOS_DA_IA = [
  'Texto da IA para aniversario',
  'Texto da IA para diario_pendente',
  'Texto da IA para myid_vencido',
  'Texto da IA para reengajamento',
];

// ───────────── Preparo ─────────────

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    serve: (fn: (req: Request) => Promise<Response>) => { h.handler = fn; },
    env: { get: (k: string) => h.env[k] },
  });
  vi.stubGlobal('EdgeRuntime', { waitUntil: () => undefined });
  vi.stubGlobal('fetch', fetchFalso);
  await import(/* @vite-ignore */ CAMINHO_DO_HANDLER);
});

const espiar = (metodo: 'warn' | 'error' | 'log') => vi.spyOn(console, metodo).mockImplementation(() => undefined);
let avisos: ReturnType<typeof espiar>;
let erros: ReturnType<typeof espiar>;
let registros: ReturnType<typeof espiar>;
let setTimeoutOriginal: typeof setTimeout;

beforeEach(() => {
  h.env = {
    SUPABASE_URL: 'https://x.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'chave-de-servico',
    GEMINI_API_KEY: 'chave-gemini-falsa',
  };
  h.enviar.mockReset();
  h.enviar.mockImplementation(async () => true);
  h.registrar.mockReset();
  h.registrar.mockImplementation(async () => undefined);
  h.logIA.mockReset();
  h.prompts.length = 0;
  h.fetchChamadas.length = 0;
  h.ia = null;
  h.pausas.length = 0;
  h.esperasDaIA = 0;
  h.banco = criarBancoProativo({});
  avisos = espiar('warn');
  erros = espiar('error');
  registros = espiar('log');
  setTimeoutOriginal = globalThis.setTimeout;
  // As pausas viram instantâneas e ficam anotadas; o temporizador de 45 s que aborta a IA só é anotado à parte.
  globalThis.setTimeout = ((fn: () => void, ms?: number) => {
    if (ms === 45_000) {
      h.esperasDaIA++;
      return 0;
    }
    h.pausas.push(Number(ms));
    fn();
    return 0;
  }) as unknown as typeof setTimeout;
  vi.useFakeTimers({ toFake: ['Date'] });
  relogio(NOVE_H);
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.setTimeout = setTimeoutOriginal;
  avisos.mockRestore();
  erros.mockRestore();
  registros.mockRestore();
});


describe('lacunas encontradas pela conferência independente (proativo)', () => {
  it('X14: sem a chave da IA o legado não envia nada e cada gatilho conta um erro (4 gatilhos)', async () => {
    montar(tudo());
    delete h.env.GEMINI_API_KEY;
    const { status, corpo } = await rodar();
    expect(status).toBe(200);
    expect(h.enviar).not.toHaveBeenCalled();
    expect(corpo.resumo.erros_gatilho).toBe(4);
  });

  it('X13: a chamada da IA leva o signal que o temporizador de 45 s aborta', async () => {
    montar(tudo());
    h.ia = iaPadrao;
    await rodar();
    const chamadas = h.fetchChamadas.filter((c) => c.url === URL_GEMINI) as unknown as Array<{ signal?: AbortSignal }>;
    expect(chamadas.length).toBe(4);
    for (const c of chamadas) expect(c.signal).toBeInstanceOf(AbortSignal);
    expect(h.esperasDaIA).toBe(4);
  });
});
