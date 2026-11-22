// Cada cliente e cada profissional recebem a mensagem DELES, no telefone DELES. O handler do agente-proativo é carregado
// de verdade (supabase/functions/agente-proativo/index.ts), com dublês para o banco, o envio de WhatsApp, o registro na
// conversa, o log de uso de IA, o Deno, o relógio e o fetch. Este arquivo cobre o que o agenteProativoMotor.test.ts não
// cobre: vários profissionais, cada um com tom e gatilhos diferentes, e vários clientes do mesmo profissional, com nomes,
// telefones e dias diferentes. Com um cliente só por profissional, trocar a pessoa ou a clínica dentro do laço (usar o
// tom, o nome, o telefone ou os gatilhos do primeiro da lista para todos) passa despercebido.
// ATENÇÃO: essa função manda WhatsApp para clientes reais. Por isso o fetch do teste LANÇA para qualquer endereço,
// inclusive z-api.io, graph.facebook.com e generativelanguage.googleapis.com; só a IA tem dublê, e só nos testes que o
// instalam. Um teste canário prova que o bloqueio dispara, então um mock esquecido nunca vira envio de verdade.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarBancoProativo, type BancoProativo, type Linha } from './helpers/bancoProativoFalso';

const h = vi.hoisted(() => ({
  banco: null as unknown,
  handler: null as null | ((req: Request) => Promise<Response>),
  env: {} as Record<string, string | undefined>,
  enviar: vi.fn(),
  registrar: vi.fn(),
  logIA: vi.fn(),
  fetchChamadas: [] as Array<{ url: string; metodo: string; headers: Record<string, string>; corpo: string }>,
  ia: null as null | ((corpo: string) => Response),
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

const CAMINHO_DO_HANDLER = '../../supabase/functions/agente-proativo/index.ts';
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
const SEM_ANIVERSARIO = '1980-01-01';
const diario = (pid: string, dias: number): Linha => ({ id: `dl-${pid}`, paciente_id: pid, created_at: iso(dias * DIA) });
const myid = (pid: string, dias: number): Linha => ({
  id: `my-${pid}`, paciente_id: pid, updated_at: iso(dias * DIA), status: 'concluido',
  myid_score_parcial: 61, dimensoes_preenchidas: {}, red_flags_detectadas: false,
});
const sessao = (pid: string, dias: number): Linha => ({ id: `ag-${pid}`, paciente_id: pid, status: 'concluido', data_inicio: iso(dias * DIA) });

const montar = (tabelas: Record<string, Linha[]>): BancoProativo => {
  const banco = criarBancoProativo(tabelas);
  h.banco = banco;
  return banco;
};
const banco = () => h.banco as BancoProativo;

// ───────────── Resposta da IA (dublê) ─────────────

const respostaIA = (texto: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content: texto } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200 });

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
  terapeutas: number;
  terapeutas_por_modo: Record<string, number>;
  enviados: number;
  falhas_envio: number;
  simulados: number;
  recusados: Record<string, number>;
  erros_gatilho: number;
  erros_gravacao: number;
}

async function rodar() {
  const res = await h.handler!(new Request('https://x.supabase.co/functions/v1/agente-proativo', {
    method: 'POST',
    headers: { Authorization: 'Bearer chave-de-servico' },
    body: '{}',
  }));
  return { status: res.status, corpo: (await res.json()) as { ok: boolean; resumo: Resumo } };
}

const modo = (valor: string | undefined, lista?: string) => {
  h.env.MOTOR_MODELOS_MODO = valor;
  h.env.MOTOR_MODELOS_TERAPEUTAS = lista;
};

const disparos = () => banco().linhas('agente_disparos');
const reais = () => disparos().filter((l) => !String(l.gatilho).startsWith('simulado:'));
const simulados = () => disparos().filter((l) => String(l.gatilho).startsWith('simulado:'));

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
  h.fetchChamadas.length = 0;
  h.ia = null;
  h.banco = criarBancoProativo({});
  avisos = espiar('warn');
  erros = espiar('error');
  registros = espiar('log');
  setTimeoutOriginal = globalThis.setTimeout;
  // As pausas viram instantâneas; o temporizador de 45 s que aborta a IA nunca dispara.
  globalThis.setTimeout = ((fn: () => void, ms?: number) => {
    if (ms === 45_000) return 0;
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
  expect(h.fetchChamadas.every((c) => c.url === URL_GEMINI)).toBe(true);
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
});

// ───────────── Três profissionais, sete clientes ─────────────

// Cada linha é uma mensagem que TEM de sair: de quem (profissional), para quem (cliente e telefone), qual gatilho e o
// texto pronto daquele tom com o nome e os dias daquele cliente. Se algum desses vier de outra pessoa, a linha não bate.
interface Esperado {
  terapeuta: string;
  paciente: string;
  telefone: string;
  gatilho: string;
  texto: string;
  // Parâmetro de nome do modelo da Meta, só no aniversário.
  nomeMeta?: string;
}

const ANIV_AMIGAVEL = (nome: string) => `Parabéns, ${nome}! 🎉 Que o seu dia seja leve e cheio de alegria. Um abraço de toda a equipe! 💙`;
const DIARIO_AMIGAVEL = (nome: string, dias: number) => `Oi ${nome}! 💙 Faz ${dias} dias que o seu diário no app está sem registro. Quando puder, dá uma passadinha por lá e conta como foi o seu dia.`;
const MYID_AMIGAVEL = (nome: string, dias: number) => `Oi ${nome}! 💙 Já faz ${dias} dias desde o seu último MyID. Que tal abrir o app e atualizar quando puder?`;
const REENG_AMIGAVEL = (nome: string, dias: number) => `Oi ${nome}! 💙 Faz ${dias} dias que a gente não se vê por aqui e passamos para dar um oi. Se ainda não tiver um horário marcado, é só responder esta mensagem.`;
const ANIV_FORMAL = 'Olá, Pedro. Em nome de toda a equipe, desejamos um feliz aniversário, com muita alegria e realizações.';
const MYID_FORMAL = 'Olá, Lucas. Já se passaram 50 dias desde o seu último MyID. Quando for conveniente, acesse o aplicativo para atualizá-lo.';
const REENG_FORMAL = 'Olá, Lucas. Já se passaram 14 dias desde o seu último atendimento. Se ainda não houver um horário marcado, estamos à disposição para agendar.';
const ANIV_TECNICO = 'Rita, feliz aniversário! Desejamos a você um ótimo dia e um excelente novo ano.';

const ESPERADOS: Esperado[] = [
  { terapeuta: 'T1', paciente: 'P1', telefone: '5511900000001', gatilho: 'aniversario', texto: ANIV_AMIGAVEL('Marina'), nomeMeta: 'Marina' },
  { terapeuta: 'T1', paciente: 'P2', telefone: '5511900000002', gatilho: 'diario_pendente', texto: DIARIO_AMIGAVEL('Joana', 4) },
  { terapeuta: 'T1', paciente: 'P2', telefone: '5511900000002', gatilho: 'myid_vencido', texto: MYID_AMIGAVEL('Joana', 31) },
  { terapeuta: 'T1', paciente: 'P2', telefone: '5511900000002', gatilho: 'reengajamento_30d', texto: REENG_AMIGAVEL('Joana', 30) },
  { terapeuta: 'T1', paciente: 'P3', telefone: '5511900000003', gatilho: 'diario_pendente', texto: DIARIO_AMIGAVEL('Carla-Maria', 9) },
  { terapeuta: 'T1', paciente: 'P3', telefone: '5511900000003', gatilho: 'myid_vencido', texto: MYID_AMIGAVEL('Carla-Maria', 100) },
  { terapeuta: 'T1', paciente: 'P3', telefone: '5511900000003', gatilho: 'reengajamento_60d', texto: REENG_AMIGAVEL('Carla-Maria', 60) },
  { terapeuta: 'T1', paciente: 'P4', telefone: '5511900000004', gatilho: 'aniversario', texto: ANIV_AMIGAVEL('Beatriz'), nomeMeta: 'Beatriz' },
  { terapeuta: 'T2', paciente: 'Q1', telefone: '5521900000001', gatilho: 'aniversario', texto: ANIV_FORMAL, nomeMeta: 'Pedro' },
  { terapeuta: 'T2', paciente: 'Q2', telefone: '5521900000002', gatilho: 'myid_vencido', texto: MYID_FORMAL },
  { terapeuta: 'T2', paciente: 'Q2', telefone: '5521900000002', gatilho: 'reengajamento_14d', texto: REENG_FORMAL },
  { terapeuta: 'T3', paciente: 'R1', telefone: '5531900000001', gatilho: 'aniversario', texto: ANIV_TECNICO, nomeMeta: 'Rita' },
];

// T1 amigável com tudo ligado; T2 formal com o diário DESLIGADO; T3 técnico com tudo ligado. Lucas (Q2, de T2) está com o
// diário parado há 6 dias: só não recebe o convite porque o profissional dele desligou, e o de T1 não desligou.
const cenario = (): Record<string, Linha[]> => ({
  whatsapp_automacoes: [
    cfg({ terapeuta_id: 'T1', tom_voz: 'amigavel' }),
    cfg({ terapeuta_id: 'T2', tom_voz: 'formal', gatilhos_ativos: { aniversario: true, diario_pendente: false, myid_vencido: true, reengajamento: true } }),
    cfg({ terapeuta_id: 'T3', tom_voz: 'tecnico' }),
  ],
  pacientes: [
    paciente({ id: 'P1', terapeuta_id: 'T1', nome: 'MARINA', telefone: '5511900000001', data_nascimento: ANIVERSARIO_HOJE }),
    paciente({ id: 'P2', terapeuta_id: 'T1', nome: 'JOANA', telefone: '5511900000002', data_nascimento: SEM_ANIVERSARIO }),
    paciente({ id: 'P3', terapeuta_id: 'T1', nome: 'CARLA-MARIA', telefone: '5511900000003', data_nascimento: SEM_ANIVERSARIO }),
    paciente({ id: 'P4', terapeuta_id: 'T1', nome: 'BEATRIZ', telefone: '5511900000004', data_nascimento: ANIVERSARIO_HOJE }),
    paciente({ id: 'Q1', terapeuta_id: 'T2', nome: 'PEDRO', telefone: '5521900000001', data_nascimento: ANIVERSARIO_HOJE }),
    paciente({ id: 'Q2', terapeuta_id: 'T2', nome: 'LUCAS', telefone: '5521900000002', data_nascimento: SEM_ANIVERSARIO }),
    paciente({ id: 'R1', terapeuta_id: 'T3', nome: 'RITA', telefone: '5531900000001', data_nascimento: ANIVERSARIO_HOJE }),
  ],
  daily_logs: [diario('P2', 4), diario('P3', 9), diario('Q2', 6)],
  myid_avaliacoes: [myid('P2', 31), myid('P3', 100), myid('Q2', 50)],
  agendamentos: [sessao('P2', 30), sessao('P3', 60), sessao('Q2', 14)],
});

const chaveDe = (...partes: unknown[]) => partes.map(String).join('|');
const ordenado = (linhas: string[]) => [...linhas].sort();
const meta = (e: Esperado) => (e.nomeMeta === undefined ? 'sem modelo' : `modelo aniversario ${e.nomeMeta}`);
const metaDoEnvio = (opcoes: unknown) => {
  const modelo = (opcoes as { modelo?: { chave: string; params: string[] } } | undefined)?.modelo;
  if (modelo === undefined) return 'sem modelo';
  return `modelo ${modelo.chave} ${modelo.params.join(',')}`;
};
const gatilhoBase = (gatilho: string) => (gatilho.startsWith('reengajamento') ? 'reengajamento' : gatilho);

describe('cada pessoa recebe a mensagem dela (vários clientes e vários profissionais)', () => {
  it('modo real: de quem, para quem, qual gatilho, qual texto e qual nome no modelo da Meta', async () => {
    montar(cenario());
    modo('real', '*');
    h.ia = iaPadrao;
    const { corpo } = await rodar();

    expect(ordenado(h.enviar.mock.calls.map((c) => chaveDe(c[1], c[2], c[3], metaDoEnvio(c[4])))))
      .toEqual(ordenado(ESPERADOS.map((e) => chaveDe(e.terapeuta, e.telefone, e.texto, meta(e)))));
    expect(ordenado(reais().map((l) => chaveDe(l.terapeuta_id, l.paciente_id, l.gatilho, l.status, l.conteudo))))
      .toEqual(ordenado(ESPERADOS.map((e) => chaveDe(e.terapeuta, e.paciente, e.gatilho, 'enviado', e.texto))));
    expect(ordenado(h.registrar.mock.calls.map((c) => {
      const r = c[1] as Linha;
      return chaveDe(r.terapeuta_id, r.paciente_id, r.telefone, r.origem, r.conteudo);
    }))).toEqual(ordenado(ESPERADOS.map((e) => chaveDe(e.terapeuta, e.paciente, e.telefone, e.gatilho, e.texto))));

    expect(corpo.resumo).toMatchObject({ terapeutas: 3, terapeutas_por_modo: { legado: 0, simulacao: 0, real: 3 }, enviados: 12, falhas_envio: 0, simulados: 0, recusados: {}, erros_gatilho: 0, erros_gravacao: 0 });
    expect(h.fetchChamadas).toEqual([]);
    expect(simulados()).toEqual([]);
  });

  it('modo real: o profissional que desligou o diário não manda o diário, e o que não desligou manda', async () => {
    montar(cenario());
    modo('real', '*');
    await rodar();
    const diarios = reais().filter((l) => l.gatilho === 'diario_pendente').map((l) => chaveDe(l.terapeuta_id, l.paciente_id));
    expect(ordenado(diarios)).toEqual(['T1|P2', 'T1|P3']);
    expect(h.enviar.mock.calls.some((c) => c[2] === '5521900000002' && String(c[3]).includes('diário'))).toBe(false);
  });

  it('modo simulação: a IA envia a cada pessoa no telefone dela e o texto pronto fica gravado com o nome, o tom e os dias dela', async () => {
    montar(cenario());
    modo('simulacao', '*');
    h.ia = iaPadrao;
    const { corpo } = await rodar();

    expect(ordenado(h.enviar.mock.calls.map((c) => chaveDe(c[1], c[2], c[3], metaDoEnvio(c[4])))))
      .toEqual(ordenado(ESPERADOS.map((e) => chaveDe(e.terapeuta, e.telefone, `Texto da IA para ${gatilhoBase(e.gatilho)}`, meta(e)))));
    expect(ordenado(reais().map((l) => chaveDe(l.terapeuta_id, l.paciente_id, l.gatilho, l.status, l.conteudo))))
      .toEqual(ordenado(ESPERADOS.map((e) => chaveDe(e.terapeuta, e.paciente, e.gatilho, 'enviado', `Texto da IA para ${gatilhoBase(e.gatilho)}`))));
    expect(ordenado(simulados().map((l) => chaveDe(l.terapeuta_id, l.paciente_id, l.gatilho, l.status, l.conteudo))))
      .toEqual(ordenado(ESPERADOS.map((e) => chaveDe(e.terapeuta, e.paciente, `simulado:${e.gatilho}`, 'simulado', e.texto))));

    expect(corpo.resumo).toMatchObject({ terapeutas_por_modo: { legado: 0, simulacao: 3, real: 0 }, enviados: 12, simulados: 12, recusados: {}, erros_gatilho: 0, erros_gravacao: 0 });
    expect(h.fetchChamadas).toHaveLength(12);
  });

  it('modo legado: a IA escreve para cada pessoa no telefone dela e cada profissional só recebe os gatilhos que ligou', async () => {
    montar(cenario());
    h.ia = iaPadrao;
    await rodar();

    expect(ordenado(h.enviar.mock.calls.map((c) => chaveDe(c[1], c[2], c[3], metaDoEnvio(c[4])))))
      .toEqual(ordenado(ESPERADOS.map((e) => chaveDe(e.terapeuta, e.telefone, `Texto da IA para ${gatilhoBase(e.gatilho)}`, meta(e)))));
    expect(ordenado(disparos().map((l) => chaveDe(l.terapeuta_id, l.paciente_id, l.gatilho, l.status))))
      .toEqual(ordenado(ESPERADOS.map((e) => chaveDe(e.terapeuta, e.paciente, e.gatilho, 'enviado'))));
  });
});
