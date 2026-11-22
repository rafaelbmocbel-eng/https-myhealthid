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
  h.fetchChamadas.push({ url, metodo: init?.method ?? 'GET', headers: init?.headers ?? {}, corpo });
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

// ───────────── Proteção contra envio de verdade ─────────────

describe('proteção contra envio real', () => {
  it.each([
    'https://api.z-api.io/instances/I/token/T/send-text',
    'https://graph.facebook.com/v21.0/123/messages',
    URL_GEMINI,
  ])('o fetch do teste lança para %s (canário)', (url) => {
    expect(() => fetch(url, { method: 'POST' })).toThrow('fetch bloqueado no teste');
    expect(h.fetchChamadas).toHaveLength(1);
  });

  it('o fetch do ambiente de teste é o falso, e qualquer outro endereço também é barrado', () => {
    expect(globalThis.fetch).toBe(fetchFalso);
    expect(() => fetch('https://exemplo.com.br/x')).toThrow('fetch bloqueado no teste');
  });

  it('sem dublê da IA o legado não consegue sair: o erro fica contido no gatilho e nada é enviado', async () => {
    montar(tudo());
    const { corpo } = await rodar();
    expect(corpo.resumo.erros_gatilho).toBe(4);
    expect(h.enviar).not.toHaveBeenCalled();
    expect(disparos()).toEqual([]);
    expect(h.fetchChamadas.every((c) => c.url === URL_GEMINI)).toBe(true);
  });

  it('recusa quem não é chamada interna do cron e não consulta nada', async () => {
    montar(tudo());
    const { status } = await rodar(false);
    expect(status).toBe(403);
    expect(banco().consultas).toEqual([]);
  });

  it('responde ao pré-voo do navegador sem consultar nada', async () => {
    montar(tudo());
    const res = await h.handler!(new Request('https://x.supabase.co/functions/v1/agente-proativo', { method: 'OPTIONS' }));
    expect(res.status).toBe(200);
    expect(banco().consultas).toEqual([]);
  });
});

// ───────────── Faixa das 9h ─────────────

describe('faixa das 9h de Brasília', () => {
  it.each(['2026-11-09T12:00:00Z', '2026-11-09T12:30:00Z', '2026-11-09T12:59:59Z'])('roda às %s', async (quando) => {
    montar(tudo());
    relogio(quando);
    const { corpo } = await rodar();
    expect(corpo.resumo.hora_brt).toBe(9);
    expect(consultasDe('pacientes', 'select').length).toBeGreaterThan(0);
  });

  it.each([
    ['2026-11-09T11:59:59Z', 8],
    ['2026-11-09T13:00:00Z', 10],
    ['2026-11-09T21:00:00Z', 18],
    ['2026-11-09T03:00:00Z', 0],
  ])('às %s (hora %i em Brasília) não lê paciente, não gera IA e não envia nada', async (quando, horaBRT) => {
    for (const valor of [undefined, 'simulacao', 'real']) {
      montar(tudo());
      h.enviar.mockClear();
      h.fetchChamadas.length = 0;
      modo(valor, '*');
      h.ia = iaPadrao;
      relogio(quando);
      const { corpo } = await rodar();
      expect(corpo.resumo.hora_brt).toBe(horaBRT);
      expect(banco().consultas.map((c) => c.tabela)).toEqual(['whatsapp_automacoes']);
      expect(h.enviar).not.toHaveBeenCalled();
      expect(h.fetchChamadas).toEqual([]);
      expect(disparos()).toEqual([]);
    }
  });

  it('a hora é lida UMA vez por requisição: quem fica no fim da lista numa rodada demorada ainda é atendido', async () => {
    montar(soAniversario(['T1', 'P1'], ['T2', 'P2']));
    modo('real', '*');
    relogio('2026-11-09T12:59:58Z');
    h.enviar.mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 5000);
      return true;
    });
    const { corpo } = await rodar();
    expect(new Date().toISOString()).toBe('2026-11-09T13:00:08.000Z');
    expect(corpo.resumo.hora_brt).toBe(9);
    expect(h.enviar.mock.calls.map((c) => c[1])).toEqual(['T1', 'T2']);
  });
});

// ───────────── Legado: tudo como hoje ─────────────

describe('modo legado (sem os segredos): a IA escreve e envia como hoje', () => {
  beforeEach(() => {
    h.ia = iaPadrao;
  });

  it('chama a IA nos 4 gatilhos com o mesmo pedido de hoje e envia o texto dela', async () => {
    montar(tudo());
    const { corpo } = await rodar();

    expect(h.fetchChamadas).toHaveLength(4);
    h.fetchChamadas.forEach((c, i) => {
      expect(c.url).toBe(URL_GEMINI);
      expect(c.metodo).toBe('POST');
      expect(c.headers).toEqual({ Authorization: 'Bearer chave-gemini-falsa', 'Content-Type': 'application/json' });
      const pedido = JSON.parse(c.corpo) as { model: string; messages: Array<{ role: string; content: string }> };
      expect(pedido.model).toBe('gemini-3.1-flash-lite');
      expect(pedido.messages.map((m) => m.role)).toEqual(['system', 'user']);
      expect(pedido.messages[1].content).toBe(INSTRUCOES_DA_IA[i]);
      expect(pedido.messages[0].content).toContain('CONTEXTO DO PACIENTE (MARINA Souza)');
    });
    expect(h.prompts).toHaveLength(4);

    expect(textosEnviados()).toEqual(TEXTOS_DA_IA);
    expect(h.enviar.mock.calls.map((c) => c.slice(1, 4))).toEqual(TEXTOS_DA_IA.map((t) => ['T1', '5511999990001', t]));
    expect(h.enviar.mock.calls[0][4]).toEqual({ modelo: { chave: 'aniversario', params: ['Marina'] } });
    for (const i of [1, 2, 3]) expect(h.enviar.mock.calls[i]).toHaveLength(4);

    expect(gatilhosDe(disparos())).toEqual(GATILHOS_EM_ORDEM);
    expect(disparos()).toEqual(TEXTOS_DA_IA.map((t, i) => expect.objectContaining({
      terapeuta_id: 'T1', paciente_id: 'P1', gatilho: GATILHOS_EM_ORDEM[i], ref_id: null, conteudo: t, status: 'enviado', erro: undefined,
    })));
    expect(h.registrar.mock.calls.map((c) => c[1])).toEqual(TEXTOS_DA_IA.map((t, i) => ({
      terapeuta_id: 'T1', paciente_id: 'P1', telefone: '5511999990001', conteudo: t, origem: GATILHOS_EM_ORDEM[i],
    })));
    expect(corpo.stats).toMatchObject({ aniv: 1, exerc: 1, diario: 1, myid: 1, reeng: 1, pag: 0 });
    expect(corpo.resumo).toMatchObject({ enviados: 4, simulados: 0, falhas_envio: 0, terapeutas_por_modo: { legado: 1, simulacao: 0, real: 0 } });
    expect(h.pausas).toEqual([]);
  });

  it.each([undefined, '', 'legado', 'REAL', 'Real', ' real', 'real ', 'SIMULACAO', 'simulação', 'sim', 'true', '1'])(
    'o segredo %j não liga o motor novo, mesmo com a lista "*"',
    async (valor) => {
      montar(tudo());
      modo(valor, '*');
      const { corpo } = await rodar();
      expect(h.fetchChamadas).toHaveLength(4);
      expect(textosEnviados()).toEqual(TEXTOS_DA_IA);
      expect(simulados()).toEqual([]);
      expect(corpo.resumo.terapeutas_por_modo).toEqual({ legado: 1, simulacao: 0, real: 0 });
    },
  );

  it('IA sem resposta (HTTP de erro) não envia aquele gatilho e não grava linha, como hoje', async () => {
    montar(tudo());
    h.ia = (corpo) => (gatilhoDoPedido(corpo) === 'myid_vencido' ? new Response('{}', { status: 503 }) : iaPadrao(corpo));
    await rodar();
    expect(gatilhosDe(disparos())).toEqual(['aniversario', 'diario_pendente', 'reengajamento_14d']);
    expect(h.logIA).toHaveBeenCalledTimes(3);
  });

  it('IA que devolve texto vazio não envia e não grava linha, como hoje', async () => {
    montar(tudo());
    h.ia = (corpo) => (gatilhoDoPedido(corpo) === 'aniversario' ? respostaIA('   ') : iaPadrao(corpo));
    await rodar();
    expect(gatilhosDe(disparos())).toEqual(['diario_pendente', 'myid_vencido', 'reengajamento_14d']);
  });

  it('envio recusado pelo provedor grava a linha "erro" e queima a janela, como hoje', async () => {
    montar(tudo());
    h.enviar.mockImplementation(async () => false);
    await rodar();
    expect(disparos().map((l) => l.status)).toEqual(['erro', 'erro', 'erro', 'erro']);
    expect(h.registrar).not.toHaveBeenCalled();
    h.enviar.mockClear();
    relogio('2026-11-09T12:30:00Z');
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it.each(['bit.ly/x', '', null])('o legado envia a IA mesmo para quem tem nome inválido (%j), com "você" no modelo da Meta: recusar por nome é só do texto pronto', async (nome) => {
    montar({ ...tudo(), pacientes: [paciente({ nome, data_nascimento: ANIVERSARIO_HOJE })] });
    const { corpo } = await rodar();
    expect(textosEnviados()).toEqual(TEXTOS_DA_IA);
    expect(h.enviar.mock.calls[0][4]).toEqual({ modelo: { chave: 'aniversario', params: ['você'] } });
    expect(corpo.resumo.recusados).toEqual({});
  });

  it.each([
    ['JOAO', 'Joao'],
    ['ana-clara', 'Ana-Clara'],
    ["d'ávila", "D'Ávila"],
    ['MARIA DA SILVA', 'Maria'],
  ])('o parâmetro de nome do modelo da Meta vem do cadastro tratado: %s vira %s', async (nome, esperado) => {
    montar({ ...tudo(), pacientes: [paciente({ nome, data_nascimento: ANIVERSARIO_HOJE })] });
    await rodar();
    expect(h.enviar.mock.calls[0][4]).toEqual({ modelo: { chave: 'aniversario', params: [esperado] } });
  });

  it('mede o uso da IA em cada chamada, com o nome da pasta da função', async () => {
    montar(tudo());
    await rodar();
    expect(PASTA_DA_FUNCAO).toBe('agente-proativo');
    expect(h.logIA.mock.calls).toEqual(Array(4).fill([PASTA_DA_FUNCAO, 'gemini-3.1-flash-lite', { prompt_tokens: 10, completion_tokens: 5 }]));
  });

  it.each([
    ['texto vazio', { choices: [{ message: { content: '' } }] }],
    ['só espaços', { choices: [{ message: { content: '  \n ' } }] }],
    ['conteúdo nulo, como na resposta bloqueada pelo filtro de segurança', { choices: [{ message: { content: null } }] }],
    ['lista de choices vazia', { choices: [] }],
    ['sem choices', {}],
  ])('resposta da IA sem texto aproveitável (%s) com tokens cobrados: o uso é medido mesmo assim e nada é enviado', async (_nome, corpoDaResposta) => {
    montar({ ...tudo(), pacientes: [paciente({ data_nascimento: ANIVERSARIO_HOJE })], myid_avaliacoes: [], agendamentos: [], daily_logs: [] });
    const uso = { prompt_tokens: 40, completion_tokens: 0 };
    h.ia = () => new Response(JSON.stringify({ ...corpoDaResposta, usage: uso }), { status: 200 });
    await rodar();
    expect(h.logIA.mock.calls).toEqual([[PASTA_DA_FUNCAO, 'gemini-3.1-flash-lite', uso]]);
    expect(h.enviar).not.toHaveBeenCalled();
    expect(disparos()).toEqual([]);
  });

  it('resposta da IA sem o campo de uso ainda passa pelo medidor, que decide não gravar', async () => {
    montar({ ...tudo(), pacientes: [paciente({ data_nascimento: ANIVERSARIO_HOJE })], myid_avaliacoes: [], agendamentos: [], daily_logs: [] });
    h.ia = () => new Response(JSON.stringify({ choices: [{ message: { content: 'oi' } }] }), { status: 200 });
    await rodar();
    expect(h.logIA.mock.calls).toEqual([[PASTA_DA_FUNCAO, 'gemini-3.1-flash-lite', undefined]]);
  });

  it('dois ticks (12:00Z e 12:30Z): uma mensagem só por gatilho', async () => {
    montar(tudo());
    await rodar();
    relogio('2026-11-09T12:30:00Z');
    await rodar();
    expect(h.fetchChamadas).toHaveLength(4);
    expect(h.enviar).toHaveBeenCalledTimes(4);
    expect(disparos()).toHaveLength(4);
  });

  it('o erro de um gatilho não derruba os outros: a IA lança só no aniversário', async () => {
    montar(tudo());
    h.ia = (corpo) => {
      if (gatilhoDoPedido(corpo) === 'aniversario') throw new Error('IA fora do ar');
      return iaPadrao(corpo);
    };
    const { corpo } = await rodar();
    expect(gatilhosDe(disparos())).toEqual(['diario_pendente', 'myid_vencido', 'reengajamento_14d']);
    expect(corpo.resumo.erros_gatilho).toBe(1);
    expect(avisosTexto()).toContain('aniversario falhou para o paciente P1');
    expect(avisosTexto()).toContain('IA fora do ar');
  });

  it('o terapeuta fora da lista do modo real, sem o modo ligado, continua em legado', async () => {
    montar({ ...tudo(), whatsapp_automacoes: [cfg({ terapeuta_id: 'T1' })] });
    modo(undefined, 'T2');
    const { corpo } = await rodar();
    expect(corpo.resumo.terapeutas_por_modo).toEqual({ legado: 1, simulacao: 0, real: 0 });
    expect(textosEnviados()).toEqual(TEXTOS_DA_IA);
  });
});

// ───────────── Simulação ─────────────

describe('modo simulação: a IA ainda envia e o texto pronto fica gravado como "simulado"', () => {
  beforeEach(() => {
    h.ia = iaPadrao;
    modo('simulacao');
  });

  it('envia o texto da IA como no legado e grava as 4 linhas simuladas com o texto novo', async () => {
    montar(tudo());
    const { corpo } = await rodar();

    expect(textosEnviados()).toEqual(TEXTOS_DA_IA);
    expect(h.fetchChamadas).toHaveLength(4);
    expect(gatilhosDe(reais())).toEqual(GATILHOS_EM_ORDEM);
    expect(reais().map((l) => l.conteudo)).toEqual(TEXTOS_DA_IA);
    expect(reais().map((l) => l.status)).toEqual(['enviado', 'enviado', 'enviado', 'enviado']);

    expect(simulados()).toEqual(TEXTOS.amigavel.map((t, i) => expect.objectContaining({
      terapeuta_id: 'T1', paciente_id: 'P1', gatilho: `simulado:${GATILHOS_EM_ORDEM[i]}`, ref_id: null, conteudo: t, status: 'simulado',
    })));
    expect(corpo.resumo).toMatchObject({ simulados: 4, enviados: 4, terapeutas_por_modo: { legado: 0, simulacao: 1, real: 0 } });
  });

  it('a linha simulada não vai para a conversa do Zap: só as 4 mensagens enviadas de verdade', async () => {
    montar(tudo());
    await rodar();
    expect(h.registrar).toHaveBeenCalledTimes(4);
    expect(h.registrar.mock.calls.map((c) => c[1].conteudo)).toEqual(TEXTOS_DA_IA);
  });

  it('usa o tom do profissional no texto simulado', async () => {
    montar({ ...tudo(), whatsapp_automacoes: [cfg({ tom_voz: 'formal' })] });
    await rodar();
    expect(simulados().map((l) => l.conteudo)).toEqual(TEXTOS.formal);
  });

  it('a linha simulada NÃO queima a janela do gatilho real: com a IA fora do ar no 1º tick, o 2º envia', async () => {
    montar(tudo());
    h.ia = () => new Response('{}', { status: 503 });
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();
    expect(reais()).toEqual([]);
    expect(simulados()).toHaveLength(4);

    h.ia = iaPadrao;
    relogio('2026-11-09T12:30:00Z');
    await rodar();
    expect(textosEnviados()).toEqual(TEXTOS_DA_IA);
    expect(gatilhosDe(reais())).toEqual(GATILHOS_EM_ORDEM);
    expect(simulados()).toHaveLength(4);
  });

  it('dois ticks: a linha simulada é gravada uma vez só, com a mesma janela do gatilho real', async () => {
    montar(tudo());
    await rodar();
    relogio('2026-11-09T12:30:00Z');
    await rodar();
    expect(simulados()).toHaveLength(4);
    expect(reais()).toHaveLength(4);
    expect(h.enviar).toHaveBeenCalledTimes(4);
  });

  it.each([
    ['aniversario', 24 * 300],
    ['diario_pendente', 72],
    ['myid_vencido', 30 * 24],
    ['reengajamento_14d', 60 * 24],
  ])('a linha simulada de %s vale pela janela de %i h, a mesma do gatilho real: 1 min dentro não repete, 1 min fora repete', async (gatilho, janela) => {
    const antiga = (msAntes: number): Linha => ({ id: 'x', paciente_id: 'P1', gatilho: `simulado:${gatilho}`, status: 'simulado', conteudo: 'antiga', created_at: iso(msAntes) });
    const dela = () => simulados().filter((l) => l.gatilho === `simulado:${gatilho}`);

    const dentro = tudo();
    dentro.agente_disparos = [antiga(janela * HORA - MINUTO)];
    montar(dentro);
    await rodar();
    expect(dela()).toHaveLength(1);

    const fora = tudo();
    fora.agente_disparos = [antiga(janela * HORA + MINUTO)];
    montar(fora);
    await rodar();
    expect(dela()).toHaveLength(2);
  });

  it.each(['', '   ', null, '123', 'bit.ly/x', '{nome}'])('nome inválido (%j): sem linha simulada, o legado ainda envia e a recusa é contada à parte', async (nome) => {
    montar({ ...tudo(), pacientes: [paciente({ nome, data_nascimento: ANIVERSARIO_HOJE })] });
    const { corpo } = await rodar();
    expect(simulados()).toEqual([]);
    expect(textosEnviados()).toEqual(TEXTOS_DA_IA);
    expect(corpo.resumo.recusariam_na_simulacao).toEqual({ sem_nome: 4 });
    expect(corpo.resumo.recusados).toEqual({});
    expect(corpo.resumo.simulados).toBe(0);
  });

  it('se a gravação da linha simulada falhar, o legado envia do mesmo jeito e o erro é contado', async () => {
    const b = montar(tudo());
    b.regras.push({ tabela: 'agente_disparos', op: 'insert', tipo: 'erro', mensagem: 'sem permissão', quando: (c) => (c.payload as Linha).status === 'simulado' });
    const { corpo } = await rodar();
    expect(textosEnviados()).toEqual(TEXTOS_DA_IA);
    expect(simulados()).toEqual([]);
    expect(corpo.resumo.erros_gravacao).toBe(4);
    expect(errosTexto()).toContain('não gravou a simulação aniversario');
  });

  it('se a gravação da simulação LANÇAR (queda do banco), o legado envia do mesmo jeito e o erro é contado', async () => {
    const b = montar(tudo());
    b.regras.push({ tabela: 'agente_disparos', op: 'insert', tipo: 'lancar', mensagem: 'rede caiu', quando: (c) => (c.payload as Linha).status === 'simulado' });
    const { corpo } = await rodar();
    expect(textosEnviados()).toEqual(TEXTOS_DA_IA);
    expect(gatilhosDe(reais())).toEqual(GATILHOS_EM_ORDEM);
    expect(simulados()).toEqual([]);
    expect(corpo.resumo).toMatchObject({ erros_gravacao: 4, erros_gatilho: 0, enviados: 4 });
    expect(errosTexto()).toContain('a simulação de aniversario falhou para o paciente P1; o envio segue pelo legado');
    expect(errosTexto()).toContain('rede caiu');
  });

  it('a simulação grava o texto antes de chamar a IA: se a IA lançar, a prévia fica completa', async () => {
    montar(tudo());
    h.ia = () => { throw new Error('IA caiu'); };
    const { corpo } = await rodar();
    expect(simulados()).toHaveLength(4);
    expect(h.enviar).not.toHaveBeenCalled();
    expect(corpo.resumo.erros_gatilho).toBe(4);
  });

  it('no modo real, o terapeuta que não está na lista fica em simulação e o legado envia a IA; quem está na lista vai de texto pronto', async () => {
    montar(doisCompletos());
    modo('real', 'T1');
    const { corpo } = await rodar();
    expect(corpo.resumo.terapeutas_por_modo).toEqual({ legado: 0, simulacao: 1, real: 1 });
    const de = (tel: string) => h.enviar.mock.calls.filter((c) => c[2] === tel).map((c) => String(c[3]));
    expect(de('5511999990001')).toEqual(TEXTOS.amigavel);
    expect(de('5511999990002')).toEqual(TEXTOS_DA_IA);
    expect(h.fetchChamadas).toHaveLength(4);
    expect(h.fetchChamadas.every((c) => c.corpo.includes('JOANA') && !c.corpo.includes('MARINA'))).toBe(true);
    expect(simulados().every((l) => l.paciente_id === 'P2')).toBe(true);
    expect(simulados()).toHaveLength(4);
    expect(reais().filter((l) => l.paciente_id === 'P1').map((l) => l.status)).toEqual(['enviado', 'enviado', 'enviado', 'enviado']);
  });

  it.each([undefined, '', '  ', ','])('no modo real, a lista %j nunca vira real: é simulação para todos', async (lista) => {
    montar(tudo());
    modo('real', lista);
    const { corpo } = await rodar();
    expect(corpo.resumo.terapeutas_por_modo).toEqual({ legado: 0, simulacao: 1, real: 0 });
    expect(textosEnviados()).toEqual(TEXTOS_DA_IA);
    expect(simulados()).toHaveLength(4);
  });
});

// ───────────── Real ─────────────

describe('modo real: texto pronto, sem IA', () => {
  beforeEach(() => {
    modo('real', '*');
  });

  it('nunca chama a IA, nem monta o prompt dela, nem mede uso, nos 4 gatilhos', async () => {
    montar({ ...tudo(), whatsapp_automacoes: [cfg({ gatilhos_ativos: { aniversario: true, diario_pendente: true, myid_vencido: true, reengajamento: true, exercicio_pendente: true, pagamento_pendente: true } })] });
    h.ia = iaPadrao;
    const { corpo } = await rodar();
    expect(h.fetchChamadas).toEqual([]);
    expect(h.prompts).toEqual([]);
    expect(h.logIA).not.toHaveBeenCalled();
    expect(h.esperasDaIA).toBe(0);
    expect(corpo.resumo.enviados).toBe(4);
    expect(corpo.resumo.terapeutas_por_modo).toEqual({ legado: 0, simulacao: 0, real: 1 });
  });

  it('a decisão de quem entra em cada gatilho segue o contexto clínico de sempre', async () => {
    montar(tudo());
    await rodar();
    for (const tabela of ['myid_avaliacoes', 'agendamentos', 'daily_logs']) expect(consultasDe(tabela).length).toBeGreaterThan(0);
  });

  it.each(['amigavel', 'formal', 'tecnico'] as const)('tom %s: manda exatamente os 4 textos prontos, na ordem dos gatilhos', async (tom) => {
    montar({ ...tudo(), whatsapp_automacoes: [cfg({ tom_voz: tom })] });
    await rodar();
    expect(textosEnviados()).toEqual(TEXTOS[tom]);
    expect(h.enviar.mock.calls.map((c) => c.slice(1, 3))).toEqual(Array(4).fill(['T1', '5511999990001']));
    expect(h.enviar.mock.calls[0][4]).toEqual({ modelo: { chave: 'aniversario', params: ['Marina'] } });
    for (const i of [1, 2, 3]) expect(h.enviar.mock.calls[i]).toHaveLength(4);
    expect(reais().map((l) => [l.gatilho, l.conteudo, l.status])).toEqual(GATILHOS_EM_ORDEM.map((g, i) => [g, TEXTOS[tom][i], 'enviado']));
    expect(simulados()).toEqual([]);
  });

  it.each(['xyz', '', null, undefined, 'TECNICO', 'Formal'])('tom desconhecido (%j) cai em amigável', async (tom) => {
    montar({ ...tudo(), whatsapp_automacoes: [cfg({ tom_voz: tom })] });
    await rodar();
    expect(textosEnviados()).toEqual(TEXTOS.amigavel);
  });

  it('nenhum texto leva dado clínico, chave crua, sobrenome, telefone ou nota da clínica', async () => {
    const t = tudo();
    t.whatsapp_automacoes = [cfg({ prompt_extra: 'Marina tem hérnia de disco L5-S1 e toma tramadol' })];
    t.myid_avaliacoes = [myid('P1', 45, { red_flags_detectadas: true, myid_score_parcial: 61, dimensoes_preenchidas: { dor: { perda: 80 } } })];
    montar(t);
    for (const tom of ['amigavel', 'formal', 'tecnico']) {
      h.enviar.mockClear();
      banco().tabelas.agente_disparos = [];
      banco().tabelas.whatsapp_automacoes[0].tom_voz = tom;
      await rodar();
      const textos = textosEnviados();
      expect(textos).toHaveLength(4);
      for (const texto of textos) {
        expect(texto).not.toMatch(/[{}]/);
        expect(texto).not.toMatch(/Souza|5511999990001|hérnia|tramadol|red flag|dor\b|61|L5/i);
        expect(texto.length).toBeLessThanOrEqual(160);
      }
      expect(textos.filter((x) => x.includes('MyID'))).toHaveLength(1);
      expect(textos[2]).toContain('MyID');
    }
  });

  it('o nome vem do cadastro e não do contexto: primeiro nome, só a inicial maiúscula e segmentos compostos', async () => {
    for (const [nome, esperado] of [['JOAO', 'Joao'], ['ana-clara', 'Ana-Clara'], ["d'ávila", "D'Ávila"], ['  MARIA DA SILVA', 'Maria']]) {
      montar({ ...soAniversario(['T1', 'P1']), pacientes: [paciente({ nome, data_nascimento: ANIVERSARIO_HOJE })] });
      h.enviar.mockClear();
      await rodar();
      expect(textosEnviados()).toEqual([`Parabéns, ${esperado}! 🎉 Que o seu dia seja leve e cheio de alegria. Um abraço de toda a equipe! 💙`]);
      expect(h.enviar.mock.calls[0][4]).toEqual({ modelo: { chave: 'aniversario', params: [esperado] } });
    }
  });

  it('grava a linha "enviando" ANTES de enviar e a atualiza para "enviado" depois', async () => {
    montar(tudo());
    const fotos: Array<{ texto: string; linhas: Linha[] }> = [];
    h.enviar.mockImplementation(async (_a: unknown, _t: unknown, _tel: unknown, texto: unknown) => {
      fotos.push({ texto: String(texto), linhas: JSON.parse(JSON.stringify(disparos())) as Linha[] });
      return true;
    });
    await rodar();
    expect(fotos).toHaveLength(4);
    fotos.forEach((f, i) => {
      const dela = f.linhas.find((l) => l.conteudo === f.texto);
      expect(dela).toMatchObject({ gatilho: GATILHOS_EM_ORDEM[i], status: 'enviando', terapeuta_id: 'T1', paciente_id: 'P1', ref_id: null });
      expect(f.linhas).toHaveLength(i + 1);
      expect(f.linhas.slice(0, i).every((l) => l.status === 'enviado')).toBe(true);
    });
    expect(disparos().map((l) => l.status)).toEqual(['enviado', 'enviado', 'enviado', 'enviado']);
    const inserts = consultasDe('agente_disparos', 'insert');
    const updates = consultasDe('agente_disparos', 'update');
    expect(inserts).toHaveLength(4);
    expect(updates).toHaveLength(4);
    expect(updates.every((u) => JSON.stringify(u.payload) === '{"status":"enviado"}')).toBe(true);
    expect(chamadaDa(updates[0], 'eq')).toEqual([['id', 'agente_disparos-1']]);
  });

  it('a linha "enviando" já trava o tick seguinte: queda no meio perde a mensagem, não a repete', async () => {
    const b = montar(soAniversario(['T1', 'P1']));
    b.regras.push({ tabela: 'agente_disparos', op: 'update', tipo: 'lancar', mensagem: 'função cortada' });
    await rodar();
    expect(disparos().map((l) => l.status)).toEqual(['enviando']);
    expect(h.enviar).toHaveBeenCalledTimes(1);
    b.regras.length = 0;
    relogio('2026-11-09T12:30:00Z');
    await rodar();
    expect(h.enviar).toHaveBeenCalledTimes(1);
    expect(disparos()).toHaveLength(1);
  });

  it('envio que lança vira linha "erro" com o motivo, e os outros gatilhos seguem', async () => {
    montar(tudo());
    h.enviar.mockImplementation(async (_a: unknown, _t: unknown, _tel: unknown, texto: unknown) => {
      if (String(texto).includes('diário')) throw new Error('boom');
      return true;
    });
    const { corpo } = await rodar();
    expect(disparos().map((l) => [l.gatilho, l.status])).toEqual([
      ['aniversario', 'enviado'], ['diario_pendente', 'erro'], ['myid_vencido', 'enviado'], ['reengajamento_14d', 'enviado'],
    ]);
    expect(disparos()[1].erro).toBe('falha_no_envio: boom');
    expect(corpo.resumo).toMatchObject({ enviados: 3, falhas_envio: 1 });
    expect(h.registrar).toHaveBeenCalledTimes(3);
    expect(avisosTexto()).toContain('envio de diario_pendente lançou erro');
    h.enviar.mockClear();
    relogio('2026-11-09T12:30:00Z');
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it('envio recusado pelo provedor: linha "erro", sem conversa no Zap, sem pausa, e a janela fica queimada como hoje', async () => {
    montar(soAniversario(['T1', 'P1']));
    h.enviar.mockImplementation(async () => false);
    const { corpo } = await rodar();
    expect(disparos()).toEqual([expect.objectContaining({ gatilho: 'aniversario', status: 'erro', erro: 'envio_nao_aceito' })]);
    expect(h.registrar).not.toHaveBeenCalled();
    expect(h.pausas).toEqual([]);
    expect(corpo.resumo).toMatchObject({ enviados: 0, falhas_envio: 1 });
    h.enviar.mockClear();
    relogio('2026-11-09T12:30:00Z');
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it('se a linha "enviando" não puder ser gravada, NÃO envia (sem a trava a mensagem poderia repetir)', async () => {
    const b = montar(tudo());
    b.regras.push({ tabela: 'agente_disparos', op: 'insert', tipo: 'erro', mensagem: 'banco fora', quando: (c) => (c.payload as Linha).gatilho === 'myid_vencido' });
    const { corpo } = await rodar();
    expect(textosEnviados()).toEqual([TEXTOS.amigavel[0], TEXTOS.amigavel[1], TEXTOS.amigavel[3]]);
    expect(gatilhosDe(disparos())).toEqual(['aniversario', 'diario_pendente', 'reengajamento_14d']);
    expect(corpo.resumo.erros_gravacao).toBe(1);
    expect(errosTexto()).toContain('não reservou o disparo myid_vencido');
    expect(errosTexto()).toContain('banco fora');
  });

  it('se a atualização para "enviado" falhar, a mensagem já saiu: o erro é contado e a conversa do Zap é registrada', async () => {
    const b = montar(soAniversario(['T1', 'P1']));
    b.regras.push({ tabela: 'agente_disparos', op: 'update', tipo: 'erro', mensagem: 'update negado' });
    const { corpo } = await rodar();
    expect(h.enviar).toHaveBeenCalledTimes(1);
    expect(disparos()[0].status).toBe('enviando');
    expect(corpo.resumo).toMatchObject({ enviados: 1, erros_gravacao: 1 });
    expect(errosTexto()).toContain('não atualizou o disparo aniversario');
    expect(h.registrar).toHaveBeenCalledTimes(1);
  });

  it('manda a mensagem para a conversa do Zap só depois do envio aceito, sem marcar como bot', async () => {
    montar(soAniversario(['T1', 'P1']));
    await rodar();
    expect(h.registrar).toHaveBeenCalledTimes(1);
    const [, opcoes] = h.registrar.mock.calls[0];
    expect(opcoes).toEqual({
      terapeuta_id: 'T1', paciente_id: 'P1', telefone: '5511999990001', origem: 'aniversario',
      conteudo: TEXTOS.amigavel[0],
    });
    expect('bot' in opcoes).toBe(false);
  });

  it('pausa de 2000 ms depois de cada mensagem aceita, e nunca no legado nem na simulação', async () => {
    montar(tudo());
    await rodar();
    expect(h.pausas).toEqual([2000, 2000, 2000, 2000]);

    for (const valor of [undefined, 'simulacao']) {
      montar(tudo());
      h.pausas.length = 0;
      h.ia = iaPadrao;
      modo(valor, '*');
      await rodar();
      expect(h.pausas).toEqual([]);
    }
  });

  it('dois ticks (12:00Z e 12:30Z): uma mensagem só por gatilho', async () => {
    montar(tudo());
    await rodar();
    relogio('2026-11-09T12:30:00Z');
    await rodar();
    expect(h.enviar).toHaveBeenCalledTimes(4);
    expect(disparos()).toHaveLength(4);
  });

  it.each(['', '   ', null, '123', 'bit.ly/x', 'a'.repeat(31), '{nome}', '😀'])(
    'nome inválido (%j): não envia nem grava linha, avisa o motivo, conta, e não queima a janela',
    async (nome) => {
      montar({ ...tudo(), pacientes: [paciente({ nome, data_nascimento: ANIVERSARIO_HOJE })] });
      const { corpo } = await rodar();
      expect(h.enviar).not.toHaveBeenCalled();
      expect(disparos()).toEqual([]);
      expect(h.fetchChamadas).toEqual([]);
      expect(corpo.resumo).toMatchObject({ recusados: { sem_nome: 4 }, erros_gatilho: 0, enviados: 0 });
      expect(avisosTexto()).toContain('motivo=sem_nome');
      expect(avisosTexto()).toContain('gatilho=reengajamento_14d');

      banco().tabelas.pacientes[0].nome = 'MARINA';
      relogio('2026-11-09T12:30:00Z');
      await rodar();
      expect(textosEnviados()).toEqual(TEXTOS.amigavel);
    },
  );

  it('dias inválido (MyID de mais de 3650 dias): só aquele gatilho é recusado, sem linha e sem queimar a janela', async () => {
    const t = tudo();
    t.myid_avaliacoes = [myid('P1', 4018)];
    montar(t);
    const { corpo } = await rodar();
    expect(textosEnviados()).toEqual([TEXTOS.amigavel[0], TEXTOS.amigavel[1], TEXTOS.amigavel[3]]);
    expect(gatilhosDe(disparos())).toEqual(['aniversario', 'diario_pendente', 'reengajamento_14d']);
    expect(corpo.resumo).toMatchObject({ recusados: { dias_invalido: 1 }, erros_gatilho: 0 });
    expect(h.fetchChamadas).toEqual([]);
    expect(avisosTexto()).toContain('gatilho=myid_vencido motivo=dias_invalido');
  });

  it('o aviso de recusa e o resumo não levam nome, telefone nem texto do cliente', async () => {
    montar({ ...tudo(), pacientes: [paciente({ nome: 'bit.ly/x', telefone: '5511987654321', sobrenome: 'Quintela', data_nascimento: ANIVERSARIO_HOJE })] });
    await rodar();
    const tudoQueFoiLogado = [...avisos.mock.calls, ...erros.mock.calls, ...registros.mock.calls].flat().map(String).join(' ');
    expect(tudoQueFoiLogado).not.toMatch(/bit\.ly|5511987654321|Quintela|Marina/);
    expect(tudoQueFoiLogado).toContain('paciente=P1');
  });

  it('exercício e cobrança continuam como estão: ligados, sem dado, não enviam e não chamam a IA', async () => {
    montar({ ...tudo(), whatsapp_automacoes: [cfg({ gatilhos_ativos: { aniversario: false, diario_pendente: false, myid_vencido: false, reengajamento: false, exercicio_pendente: true, pagamento_pendente: true } })] });
    const { corpo } = await rodar();
    expect(corpo.stats).toMatchObject({ exerc: 1, pag: 1, aniv: 0, diario: 0, myid: 0, reeng: 0 });
    expect(h.enviar).not.toHaveBeenCalled();
    expect(h.fetchChamadas).toEqual([]);
  });

  it.each([
    ['aniversario', 0],
    ['diario_pendente', 1],
    ['myid_vencido', 2],
    ['reengajamento', 3],
  ])('o gatilho %s desligado pelo profissional não envia', async (gatilho, indice) => {
    montar({ ...tudo(), whatsapp_automacoes: [cfg({ gatilhos_ativos: { aniversario: true, diario_pendente: true, myid_vencido: true, reengajamento: true, [gatilho]: false } })] });
    await rodar();
    expect(textosEnviados()).toEqual(TEXTOS.amigavel.filter((_, i) => i !== indice));
  });
});

// ───────────── Pausa das automações ─────────────

describe('terapeuta com as automações pausadas', () => {
  const doisTerapeutas = (pausa: unknown) => doisCompletos({ automacoes_pausadas: pausa });

  it.each([undefined, 'simulacao', 'real'])('é pulado ANTES de qualquer consulta de paciente ou IA (modo %s)', async (valor) => {
    montar(doisTerapeutas(true));
    modo(valor, '*');
    h.ia = iaPadrao;
    const { corpo } = await rodar();

    const mencionaT1ouP1 = banco().consultas.filter((c) => /"(T1|P1)"/.test(JSON.stringify(c.chamadas)));
    expect(mencionaT1ouP1).toEqual([]);
    expect(h.enviar.mock.calls.every((c) => c[1] === 'T2')).toBe(true);
    expect(h.fetchChamadas.every((c) => !c.corpo.includes('MARINA'))).toBe(true);
    expect(disparos().every((l) => l.paciente_id === 'P2')).toBe(true);
    expect(disparos().length).toBeGreaterThan(0);
    expect(corpo.resumo).toMatchObject({ pausados: 1, terapeutas: 2 });
    expect(corpo.resumo.terapeutas_por_modo).toEqual({ legado: valor === undefined ? 1 : 0, simulacao: valor === 'simulacao' ? 1 : 0, real: valor === 'real' ? 1 : 0 });
  });

  it('com a única conta pausada só a lista de automações é lida', async () => {
    montar({ ...tudo(), whatsapp_automacoes: [cfg({ automacoes_pausadas: true })] });
    await rodar();
    expect(banco().consultas.map((c) => c.tabela)).toEqual(['whatsapp_automacoes']);
    expect(h.enviar).not.toHaveBeenCalled();
    expect(h.fetchChamadas).toEqual([]);
    expect(disparos()).toEqual([]);
  });

  it.each([false, null, undefined, 'true', 1])('só o valor verdadeiro pausa: %j não pausa', async (pausa) => {
    montar(doisTerapeutas(pausa));
    modo('real', '*');
    const { corpo } = await rodar();
    expect(corpo.resumo.pausados).toBe(0);
    expect(new Set(h.enviar.mock.calls.map((c) => c[1]))).toEqual(new Set(['T1', 'T2']));
  });
});

// ───────────── Quem pode receber ─────────────

describe('quem pode receber', () => {
  it('lê só cliente ativo, com telefone e sem vínculo encerrado, e pede o nome', async () => {
    montar(tudo());
    await rodar();
    const [lista] = consultasDe('pacientes', 'select');
    expect(chamadaDa(lista, 'select')).toEqual([['id, nome, telefone, data_nascimento', undefined]]);
    expect(chamadaDa(lista, 'eq')).toEqual([['terapeuta_id', 'T1'], ['ativo', true]]);
    expect(chamadaDa(lista, 'is')).toEqual([['vinculo_encerrado_em', null]]);
    expect(chamadaDa(lista, 'not')).toEqual([['telefone', 'is', null]]);
  });

  it.each([undefined, 'simulacao', 'real'])('quem excluiu a conta (vínculo encerrado) não recebe nada, nem simulação (modo %s)', async (valor) => {
    const t = tudo();
    t.pacientes = [
      paciente({ vinculo_encerrado_em: '2026-10-01T10:00:00Z', data_nascimento: ANIVERSARIO_HOJE }),
      paciente({ id: 'P2', telefone: '5511999990002', nome: 'JOANA', data_nascimento: ANIVERSARIO_HOJE }),
    ];
    t.daily_logs = [diario('P1', 5), diario('P2', 5)];
    t.myid_avaliacoes = [myid('P1', 45), myid('P2', 45)];
    t.agendamentos = [sessao('P1', 14), sessao('P2', 14)];
    montar(t);
    modo(valor, '*');
    h.ia = iaPadrao;
    await rodar();
    expect(disparos().length).toBeGreaterThan(0);
    expect(disparos().every((l) => l.paciente_id === 'P2')).toBe(true);
    expect(h.enviar.mock.calls.every((c) => c[2] === '5511999990002')).toBe(true);
    expect(h.fetchChamadas.every((c) => !c.corpo.includes('MARINA'))).toBe(true);
  });

  it.each([
    ['inativo', { ativo: false }],
    ['sem telefone', { telefone: null }],
    ['telefone vazio', { telefone: '' }],
  ])('cliente %s não recebe', async (_nome, extra) => {
    montar({ ...tudo(), pacientes: [paciente({ data_nascimento: ANIVERSARIO_HOJE, ...extra })] });
    modo('real', '*');
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();
    expect(disparos()).toEqual([]);
  });

  it('cliente de outro terapeuta não recebe pela automação deste', async () => {
    montar({ ...tudo(), pacientes: [paciente({ terapeuta_id: 'T9', data_nascimento: ANIVERSARIO_HOJE })] });
    modo('real', '*');
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it('erro ao ler os pacientes de um terapeuta é registrado e os outros terapeutas seguem', async () => {
    const t = soAniversario(['T1', 'P1'], ['T2', 'P2']);
    const b = montar(t);
    b.regras.push({ tabela: 'pacientes', op: 'select', tipo: 'erro', mensagem: 'coluna sumiu', quando: (c) => JSON.stringify(c.chamadas).includes('"T1"') && JSON.stringify(c.chamadas).includes('vinculo_encerrado_em') });
    modo('real', '*');
    await rodar();
    expect(errosTexto()).toContain('não leu os pacientes do terapeuta T1');
    expect(h.enviar.mock.calls.map((c) => c[1])).toEqual(['T2']);
  });

  it('erro ao ler as automações é registrado e a rodada termina limpa', async () => {
    const b = montar(tudo());
    b.regras.push({ tabela: 'whatsapp_automacoes', op: 'select', tipo: 'erro', mensagem: 'sem acesso', quando: (c) => chamadaDa(c, 'eq').some((a) => a[0] === 'bot_ativo') });
    const { status, corpo } = await rodar();
    expect(status).toBe(200);
    expect(corpo.resumo.terapeutas).toBe(0);
    expect(errosTexto()).toContain('não leu as automações');
  });
});

// ───────────── Condições dos gatilhos ─────────────

describe('condições de cada gatilho (iguais às de hoje)', () => {
  beforeEach(() => {
    modo('real', '*');
  });

  const so = (gatilho: string, extra: Record<string, Linha[]>, nascimento: string | null = '1990-01-15') =>
    montar({
      whatsapp_automacoes: [cfg({ gatilhos_ativos: { aniversario: false, diario_pendente: false, myid_vencido: false, reengajamento: false, [gatilho]: true } })],
      pacientes: [paciente({ data_nascimento: nascimento })],
      ...extra,
    });

  it.each([
    ['1990-11-09', true],
    ['2003-11-09', true],
    ['1990-11-10', false],
    ['1990-11-08', false],
    ['1990-12-09', false],
    ['1990-10-09', false],
    [null, false],
  ])('aniversário com nascimento %s: envia = %s', async (nascimento, envia) => {
    so('aniversario', {}, nascimento);
    await rodar();
    expect(gatilhosDe(disparos())).toEqual(envia ? ['aniversario'] : []);
  });

  it.each([
    [3 * DIA, 3, true],
    [3 * DIA - MINUTO, 2, false],
    [2 * DIA, 2, false],
    [30 * DIA, 30, true],
  ])('diário parado há %i ms (%i dias): envia = %s', async (msAntes, dias, envia) => {
    so('diario_pendente', { daily_logs: [{ ...diario('P1', 0), created_at: iso(msAntes) }] });
    await rodar();
    if (envia) expect(textosEnviados()).toEqual([expect.stringContaining(`Faz ${dias} dias que o seu diário`)]);
    else expect(h.enviar).not.toHaveBeenCalled();
  });

  it('diário: quem nunca registrou não recebe, e só vale o registro mais recente', async () => {
    so('diario_pendente', {});
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();

    so('diario_pendente', { daily_logs: [diario('P1', 40), { ...diario('P1', 1), id: 'recente' }] });
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it.each([
    [30 * DIA, 30, true],
    [30 * DIA - MINUTO, 29, false],
    [29 * DIA, 29, false],
    [400 * DIA, 400, true],
  ])('MyID de %i ms atrás (%i dias): envia = %s', async (msAntes, dias, envia) => {
    so('myid_vencido', { myid_avaliacoes: [{ ...myid('P1', 0), updated_at: iso(msAntes) }] });
    await rodar();
    if (envia) expect(textosEnviados()).toEqual([expect.stringContaining(`Já faz ${dias} dias desde o seu último MyID`)]);
    else expect(h.enviar).not.toHaveBeenCalled();
  });

  it('MyID: quem nunca fez não recebe, e só vale a avaliação mais recente', async () => {
    so('myid_vencido', {});
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();

    so('myid_vencido', { myid_avaliacoes: [myid('P1', 90), { ...myid('P1', 5), id: 'nova' }] });
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it.each([14, 30, 60])('reengajamento com a última sessão há %i dias: envia e grava reengajamento_%id', async (dias) => {
    so('reengajamento', { agendamentos: [sessao('P1', dias)] });
    await rodar();
    expect(gatilhosDe(disparos())).toEqual([`reengajamento_${dias}d`]);
    expect(textosEnviados()).toEqual([expect.stringContaining(`Faz ${dias} dias que a gente não se vê`)]);
  });

  it.each([0, 1, 7, 13, 15, 29, 31, 45, 59, 61, 90, 365])('reengajamento com a última sessão há %i dias não envia', async (dias) => {
    so('reengajamento', { agendamentos: [sessao('P1', dias)] });
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it('reengajamento: sem sessão concluída não envia, e conta a mais recente concluída', async () => {
    so('reengajamento', { agendamentos: [{ ...sessao('P1', 14), status: 'agendado' }] });
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();

    so('reengajamento', { agendamentos: [sessao('P1', 14), { ...sessao('P1', 3), id: 'recente' }] });
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it.each([undefined, null, {}])('sem a lista de gatilhos (%j) os 4 ficam ligados, como hoje', async (gatilhos_ativos) => {
    montar({ ...tudo(), whatsapp_automacoes: [cfg({ gatilhos_ativos })] });
    await rodar();
    expect(textosEnviados()).toEqual(TEXTOS.amigavel);
  });

  it('só automação com o bot ativo entra na rodada', async () => {
    montar({ ...tudo(), whatsapp_automacoes: [cfg({ bot_ativo: false })] });
    const { corpo } = await rodar();
    expect(corpo.resumo.terapeutas).toBe(0);
    expect(h.enviar).not.toHaveBeenCalled();
  });
});

// ───────────── Trava de repetição ───────────────

describe('trava jaDisparado (janelas e filtros iguais aos de hoje)', () => {
  beforeEach(() => {
    modo('real', '*');
  });

  // gatilho gravado, janela em horas e posição do texto pronto na lista dos 4
  const JANELAS: Array<[string, number, number]> = [
    ['aniversario', 24 * 300, 0],
    ['diario_pendente', 72, 1],
    ['myid_vencido', 30 * 24, 2],
    ['reengajamento_14d', 60 * 24, 3],
  ];

  it.each(JANELAS)('%s: linha de 1 min DENTRO da janela de %i h trava; de 1 min FORA libera', async (gatilho, janela, indice) => {
    const base = tudo();
    base.agente_disparos = [{ id: 'x', paciente_id: 'P1', gatilho, status: 'enviado', conteudo: 'antiga', created_at: iso(janela * HORA - MINUTO) }];
    montar(base);
    await rodar();
    expect(textosEnviados()).toHaveLength(3);
    expect(textosEnviados()).not.toContain(TEXTOS.amigavel[indice]);

    const liberada = tudo();
    liberada.agente_disparos = [{ id: 'x', paciente_id: 'P1', gatilho, status: 'enviado', conteudo: 'antiga', created_at: iso(janela * HORA + MINUTO) }];
    montar(liberada);
    h.enviar.mockClear();
    await rodar();
    expect(textosEnviados()).toEqual(TEXTOS.amigavel);
  });

  it.each(['erro', 'enviando', 'enviado'])('linha com status %s trava do mesmo jeito', async (status) => {
    const base = soAniversario(['T1', 'P1']);
    base.agente_disparos = [{ id: 'x', paciente_id: 'P1', gatilho: 'aniversario', status, conteudo: 'antiga', created_at: iso(HORA) }];
    montar(base);
    await rodar();
    expect(h.enviar).not.toHaveBeenCalled();
  });

  it('linha de outro paciente, de outro gatilho ou de outra faixa do reengajamento não trava', async () => {
    const base = tudo();
    base.agente_disparos = [
      { id: 'a', paciente_id: 'P2', gatilho: 'aniversario', status: 'enviado', conteudo: 'x', created_at: iso(HORA) },
      { id: 'b', paciente_id: 'P1', gatilho: 'exercicio_pendente', status: 'enviado', conteudo: 'x', created_at: iso(HORA) },
      { id: 'c', paciente_id: 'P1', gatilho: 'reengajamento_30d', status: 'enviado', conteudo: 'x', created_at: iso(HORA) },
      { id: 'd', paciente_id: 'P1', gatilho: 'simulado:aniversario', status: 'simulado', conteudo: 'x', created_at: iso(HORA) },
    ];
    montar(base);
    await rodar();
    expect(textosEnviados()).toEqual(TEXTOS.amigavel);
  });

  it('a consulta da trava lê só a contagem, filtrada por paciente, gatilho e janela', async () => {
    montar(soAniversario(['T1', 'P1']));
    await rodar();
    const trava = consultasDe('agente_disparos', 'select')[0];
    expect(chamadaDa(trava, 'select')).toEqual([['id', { count: 'exact', head: true }]]);
    expect(chamadaDa(trava, 'eq')).toEqual([['paciente_id', 'P1'], ['gatilho', 'aniversario']]);
    expect(chamadaDa(trava, 'gte')).toEqual([['created_at', iso(24 * 300 * HORA)]]);
  });
});

// ───────────── Robustez ─────────────

describe('erro em um gatilho não derruba a rodada', () => {
  beforeEach(() => {
    modo('real', '*');
  });

  it('o diário falha (banco lança), e aniversário, MyID e reengajamento da mesma cliente, e os outros terapeutas, seguem', async () => {
    const b = montar(doisCompletos());
    b.regras.push({ tabela: 'daily_logs', op: 'select', tipo: 'lancar', mensagem: 'rede caiu', quando: (c) => JSON.stringify(c.chamadas).includes('"P1"') });
    const { status, corpo } = await rodar();
    expect(status).toBe(200);
    expect(corpo.resumo.erros_gatilho).toBe(1);
    expect(disparos().filter((l) => l.paciente_id === 'P1').map((l) => l.gatilho)).toEqual(['aniversario', 'myid_vencido', 'reengajamento_14d']);
    expect(disparos().filter((l) => l.paciente_id === 'P2').map((l) => l.gatilho)).toEqual(GATILHOS_EM_ORDEM);
    expect(avisosTexto()).toContain('diario_pendente falhou para o paciente P1');
    expect(avisosTexto()).toContain('rede caiu');
  });

  it('o contexto clínico de uma cliente falha: ela é pulada e as outras seguem', async () => {
    const t = soAniversario(['T1', 'P1']);
    t.pacientes = [
      paciente({ data_nascimento: ANIVERSARIO_HOJE }),
      paciente({ id: 'P2', telefone: '5511999990002', nome: 'JOANA', data_nascimento: ANIVERSARIO_HOJE }),
    ];
    const b = montar(t);
    b.regras.push({ tabela: 'myid_avaliacoes', op: 'select', tipo: 'lancar', mensagem: 'timeout', quando: (c) => JSON.stringify(c.chamadas).includes('"P1"') });
    const { corpo } = await rodar();
    expect(corpo.resumo.erros_gatilho).toBe(1);
    expect(disparos().map((l) => l.paciente_id)).toEqual(['P2']);
    expect(avisosTexto()).toContain('contexto falhou para o paciente P1');
  });

  it('erro ao gravar a linha do disparo é registrado e a conversa do Zap ainda recebe a mensagem enviada (legado)', async () => {
    const b = montar(soAniversario(['T1', 'P1']));
    modo(undefined);
    h.ia = iaPadrao;
    b.regras.push({ tabela: 'agente_disparos', op: 'insert', tipo: 'erro', mensagem: 'disco cheio' });
    const { corpo } = await rodar();
    expect(h.enviar).toHaveBeenCalledTimes(1);
    expect(h.registrar).toHaveBeenCalledTimes(1);
    expect(errosTexto()).toContain('não gravou o disparo aniversario do paciente P1');
    expect(errosTexto()).toContain('disco cheio');
    expect(corpo.resumo.erros_gravacao).toBe(1);
  });
});

// ───────────── Orçamento de tempo ─────────────

describe('orçamento de tempo da rodada', () => {
  beforeEach(() => {
    modo('real', '*');
  });

  const avancarNoPrimeiroEnvio = (ms: number) => {
    let primeira = true;
    h.enviar.mockImplementation(async () => {
      if (primeira) vi.setSystemTime(Date.now() + ms);
      primeira = false;
      return true;
    });
  };

  it('ao passar de 140 s para e registra quais terapeutas ficaram; o tick seguinte retoma sem repetir', async () => {
    montar(soAniversario(['T1', 'P1'], ['T2', 'P2'], ['T3', 'P3']));
    avancarNoPrimeiroEnvio(140_001);
    const { corpo } = await rodar();
    expect(h.enviar.mock.calls.map((c) => c[1])).toEqual(['T1']);
    expect(corpo.resumo.terapeutas_restantes).toEqual(['T2', 'T3']);
    expect(corpo.resumo.duracao_ms).toBe(140_001);
    expect(avisosTexto()).toContain('ficaram para o próximo tick os terapeutas: T2,T3');
    expect(consultasDe('pacientes', 'select').flatMap((c) => chamadaDa(c, 'eq')).filter((a) => a[0] === 'terapeuta_id')).toEqual([['terapeuta_id', 'T1']]);

    h.enviar.mockImplementation(async () => true);
    relogio('2026-11-09T12:30:00Z');
    const segundo = await rodar();
    expect(h.enviar.mock.calls.map((c) => c[1])).toEqual(['T1', 'T2', 'T3']);
    expect(segundo.corpo.resumo.terapeutas_restantes).toEqual([]);
  });

  it('exatamente 140 s ainda cabe no orçamento', async () => {
    montar(soAniversario(['T1', 'P1'], ['T2', 'P2'], ['T3', 'P3']));
    avancarNoPrimeiroEnvio(140_000);
    const { corpo } = await rodar();
    expect(h.enviar).toHaveBeenCalledTimes(3);
    expect(corpo.resumo.terapeutas_restantes).toEqual([]);
    expect(avisos.mock.calls.flat().map(String).some((t) => t.includes('orçamento'))).toBe(false);
  });

  it('estourou no meio dos pacientes de um terapeuta: ele também fica na lista dos que faltam', async () => {
    const t = soAniversario(['T1', 'P1'], ['T2', 'P3']);
    t.pacientes = [
      paciente({ data_nascimento: ANIVERSARIO_HOJE }),
      paciente({ id: 'P2', telefone: '5511999990002', nome: 'JOANA', data_nascimento: ANIVERSARIO_HOJE }),
      paciente({ id: 'P3', terapeuta_id: 'T2', telefone: '5511999990003', nome: 'ANA', data_nascimento: ANIVERSARIO_HOJE }),
    ];
    montar(t);
    avancarNoPrimeiroEnvio(141_000);
    const { corpo } = await rodar();
    expect(h.enviar).toHaveBeenCalledTimes(1);
    expect(corpo.resumo.terapeutas_restantes).toEqual(['T1', 'T2']);
  });
});

// ───────────── Resumo da rodada ─────────────

describe('resumo da rodada', () => {
  it('sai no log e na resposta, com a contagem por modo, recusa e erro', async () => {
    montar(tudo());
    modo('real', '*');
    const { corpo } = await rodar();
    expect(corpo.ok).toBe(true);
    expect(corpo.resumo).toEqual({
      hora_brt: 9, terapeutas: 1, pausados: 0, terapeutas_por_modo: { legado: 0, simulacao: 0, real: 1 },
      terapeutas_restantes: [], duracao_ms: 0, enviados: 4, falhas_envio: 0, simulados: 0, recusados: {},
      recusariam_na_simulacao: {}, erros_gatilho: 0, erros_gravacao: 0,
    });
    const linha = registros.mock.calls.find((c) => String(c[0]).includes('resumo da rodada'));
    expect(linha).toBeDefined();
    expect(JSON.parse(String(linha![1]))).toEqual(corpo.resumo);
  });
});

// ───────────── Código-fonte ─────────────

describe('código-fonte do handler', () => {
  const fonte = readFileSync(resolve(__dirname, CAMINHO_DO_HANDLER), 'utf8');

  it('o comentário da primeira linha diz que o cron roda a cada 30 min', () => {
    const primeira = fonte.split('\n')[0];
    expect(primeira).toContain('a cada 30 min');
    expect(primeira).not.toContain('15 min');
  });

  it('só os dois segredos do motor ligam o modo, e o novo nasce desligado', () => {
    expect(fonte).toContain('Deno.env.get("MOTOR_MODELOS_MODO")');
    expect(fonte).toContain('Deno.env.get("MOTOR_MODELOS_TERAPEUTAS")');
  });
});
