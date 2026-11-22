// Medição de uso de IA do whatsapp-bot-reply. O bot responde a clientes em tempo real, e o index.ts dele pede muitos
// dublês para ser carregado, então este teste faz duas coisas:
//  1. guarda do código-fonte: logUsoIA entra só dentro de chamarLLM, só por EdgeRuntime.waitUntil e nunca com await;
//  2. roda o TEXTO REAL de chamarLLM (extraído do arquivo e transpilado) com dublês, para provar o comportamento:
//     o uso é medido, a resposta ao cliente não espera a medição e uma falha da medição não derruba a resposta.
// Nenhum provedor real é chamado: o fetch aqui é um dublê que só responde o que o teste manda e LANÇA para qualquer
// pedido sem resposta preparada, inclusive z-api.io, graph.facebook.com e generativelanguage.googleapis.com. Um teste
// canário prova que o bloqueio dispara, então um teste que esqueça de preparar a resposta nunca vira chamada de verdade.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import ts from 'typescript';

const CAMINHO = resolve(__dirname, '../../supabase/functions/whatsapp-bot-reply/index.ts');
const FONTE = readFileSync(CAMINHO, 'utf8');
const NOME_DA_PASTA = basename(dirname(CAMINHO));

function extrairFuncao(nome: string): string {
  const inicio = FONTE.indexOf(`async function ${nome}(`);
  expect(inicio, `função ${nome} não encontrada`).toBeGreaterThan(-1);
  const abre = FONTE.indexOf('{\n', inicio);
  let fundo = 0;
  for (let i = abre; i < FONTE.length; i++) {
    if (FONTE[i] === '{') fundo++;
    if (FONTE[i] === '}') fundo--;
    if (fundo === 0) return FONTE.slice(inicio, i + 1);
  }
  throw new Error(`função ${nome} sem fechamento`);
}
const CHAMAR_LLM = extrairFuncao('chamarLLM');

// ───────────── Guarda do código-fonte ─────────────

describe('whatsapp-bot-reply: guarda do código-fonte da medição', () => {
  it('importa logUsoIA do módulo compartilhado', () => {
    expect(FONTE).toContain('import { logUsoIA } from "../_shared/log-ia.ts";');
  });

  it('há uma única chamada a logUsoIA no arquivo, e ela está dentro de chamarLLM', () => {
    const chamadas = FONTE.match(/logUsoIA\(/g) ?? [];
    expect(chamadas).toHaveLength(1);
    expect(CHAMAR_LLM).toContain('logUsoIA(');
  });

  it('nenhum await de logUsoIA no caminho da resposta ao cliente', () => {
    expect(FONTE).not.toMatch(/await\s+logUsoIA/);
    expect(FONTE).not.toMatch(/await\s+EdgeRuntime/);
    expect(CHAMAR_LLM).not.toMatch(/await\s+logUsoIA/);
  });

  it('a medição vai por EdgeRuntime.waitUntil, com o nome da pasta da função e o modelo da chamada', () => {
    expect(CHAMAR_LLM).toContain(`EdgeRuntime.waitUntil(logUsoIA("${NOME_DA_PASTA}", "gemini-3.1-flash-lite", j.usage));`);
    expect(NOME_DA_PASTA).toBe('whatsapp-bot-reply');
    expect(CHAMAR_LLM).toContain('model: "gemini-3.1-flash-lite"');
  });

  it('a medição vem depois de ler o JSON e antes de devolver a mensagem', () => {
    const lerJson = CHAMAR_LLM.indexOf('await r.json()');
    const medir = CHAMAR_LLM.indexOf('logUsoIA(');
    const devolver = CHAMAR_LLM.indexOf('return j.choices?.[0]?.message;');
    expect(lerJson).toBeGreaterThan(-1);
    expect(medir).toBeGreaterThan(lerJson);
    expect(devolver).toBeGreaterThan(medir);
  });

  it('o tipo da resposta do Gemini declara usage', () => {
    const tipo = /interface GeminiChatResponse \{\n[\s\S]*?\n\}/.exec(FONTE)?.[0] ?? '';
    expect(tipo).toContain('usage?: unknown');
  });

  it('a diretiva ts-expect-error de EdgeRuntime traz o motivo e fica na linha de cima', () => {
    const linhas = CHAMAR_LLM.split('\n');
    const i = linhas.findIndex((l) => l.includes('EdgeRuntime.waitUntil('));
    expect(i).toBeGreaterThan(0);
    expect(linhas[i - 1].trim()).toBe('// @ts-expect-error -- EdgeRuntime disponível em Supabase Edge Functions');
    expect(FONTE).not.toContain('@ts-ignore');
  });

  it('a medição não pode derrubar a resposta: fica dentro de try com aviso no catch', () => {
    const i = CHAMAR_LLM.indexOf('EdgeRuntime.waitUntil(');
    const antes = CHAMAR_LLM.slice(0, i);
    const depois = CHAMAR_LLM.slice(i);
    expect(antes.lastIndexOf('try {')).toBeGreaterThan(antes.lastIndexOf('await r.json()'));
    expect(depois.indexOf('} catch (e) {')).toBeGreaterThan(-1);
    expect(depois.indexOf('console.warn(')).toBeGreaterThan(depois.indexOf('} catch (e) {'));
  });
});

// ───────────── O texto real de chamarLLM, com dublês ─────────────

type ChamarLLM = (mensagens: unknown[], prompt: string, comFerramentas?: boolean) => Promise<unknown>;

interface Ambiente {
  respostas: Array<() => Response>;
  pedidos: Array<{ url: string; corpo: string }>;
  logUsoIA: ReturnType<typeof vi.fn>;
  waitUntil: ReturnType<typeof vi.fn>;
  env: Record<string, string | undefined>;
}

const URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

function criarFetchFalso(ambiente: Ambiente) {
  return (url: unknown, init?: { body?: unknown }): Promise<Response> => {
    ambiente.pedidos.push({ url: String(url), corpo: String(init?.body ?? '') });
    const proxima = ambiente.respostas.shift();
    if (!proxima) throw new Error('fetch sem resposta preparada: nenhum provedor real pode ser chamado');
    return Promise.resolve(proxima());
  };
}

function carregar(ambiente: Ambiente, edgeRuntime: unknown): ChamarLLM {
  const js = ts.transpileModule(CHAMAR_LLM, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  }).outputText;
  const fetchFalso = criarFetchFalso(ambiente);
  const deno = { env: { get: (k: string) => ambiente.env[k] } };
  const fabrica = new Function('Deno', 'fetch', 'logUsoIA', 'EdgeRuntime', 'tools', `${js}\nreturn chamarLLM;`);
  return fabrica(deno, fetchFalso, ambiente.logUsoIA, edgeRuntime, []) as ChamarLLM;
}

const USO = { prompt_tokens: 120, completion_tokens: 30 };
const MENSAGEM = { role: 'assistant', content: 'Oi! Como posso ajudar?' };
const resposta = (usage: unknown = USO) =>
  () => new Response(JSON.stringify({ choices: [{ message: MENSAGEM }], usage }), { status: 200 });
const respostaSemUso = () => new Response(JSON.stringify({ choices: [{ message: MENSAGEM }] }), { status: 200 });

describe('whatsapp-bot-reply: chamarLLM mede o uso sem atrasar a resposta', () => {
  let amb: Ambiente;
  let aviso: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    amb = {
      respostas: [],
      pedidos: [],
      logUsoIA: vi.fn(async () => undefined),
      waitUntil: vi.fn(),
      env: { GEMINI_API_KEY: 'chave-gemini-falsa' },
    };
    aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', criarFetchFalso(amb));
  });
  afterEach(() => {
    aviso.mockRestore();
    vi.unstubAllGlobals();
    expect(amb.pedidos.every((p) => p.url === URL_GEMINI)).toBe(true);
  });

  const edge = () => ({ waitUntil: amb.waitUntil });

  it.each([
    'https://api.z-api.io/instances/I/token/T/send-text',
    'https://graph.facebook.com/v21.0/123/messages',
    URL_GEMINI,
  ])('o fetch do teste lança para %s quando não há resposta preparada (canário)', (url) => {
    expect(() => fetch(url, { method: 'POST' })).toThrow('fetch sem resposta preparada');
    expect(amb.pedidos).toEqual([{ url, corpo: '' }]);
    amb.pedidos.length = 0;
  });

  it('o fetch global do teste é o dublê, e qualquer outro endereço também é barrado', () => {
    expect(() => fetch('https://exemplo.com.br/x')).toThrow('fetch sem resposta preparada');
    amb.pedidos.length = 0;
  });

  it('sem resposta preparada o fetch lança também para o dublê entregue ao texto real de chamarLLM, e só o Gemini é tocado', async () => {
    await expect(carregar(amb, edge())([], 'prompt')).rejects.toThrow('fetch sem resposta preparada');
    expect(amb.pedidos.map((p) => p.url)).toEqual([URL_GEMINI]);
    expect(amb.logUsoIA).not.toHaveBeenCalled();
  });

  it('com a resposta preparada o dublê responde só uma vez: a segunda chamada volta a lançar', async () => {
    amb.respostas.push(resposta());
    const chamar = carregar(amb, edge());
    await chamar([], 'prompt');
    await expect(chamar([], 'prompt')).rejects.toThrow('fetch sem resposta preparada');
    expect(amb.logUsoIA).toHaveBeenCalledTimes(1);
  });

  it('devolve a mensagem do Gemini e mede o uso com nome da função, modelo e o usage da resposta', async () => {
    amb.respostas.push(resposta());
    const r = await carregar(amb, edge())([{ role: 'user', content: 'oi' }], 'prompt');
    expect(r).toEqual(MENSAGEM);
    expect(amb.logUsoIA).toHaveBeenCalledTimes(1);
    expect(amb.logUsoIA).toHaveBeenCalledWith('whatsapp-bot-reply', 'gemini-3.1-flash-lite', USO);
  });

  it('o modelo medido é o mesmo que foi pedido ao Gemini', async () => {
    amb.respostas.push(resposta());
    await carregar(amb, edge())([], 'prompt');
    const pedido = JSON.parse(amb.pedidos[0].corpo) as { model: string };
    expect(amb.pedidos[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(amb.logUsoIA.mock.calls[0][1]).toBe(pedido.model);
  });

  it('entrega a promessa da medição ao EdgeRuntime.waitUntil (a função não encerra antes de gravar)', async () => {
    const promessa = Promise.resolve();
    amb.logUsoIA.mockReturnValue(promessa);
    amb.respostas.push(resposta());
    await carregar(amb, edge())([], 'prompt');
    expect(amb.waitUntil).toHaveBeenCalledTimes(1);
    expect(amb.waitUntil.mock.calls[0][0]).toBe(promessa);
  });

  it('a resposta ao cliente NÃO espera a medição: com a gravação travada, chamarLLM devolve a mensagem assim mesmo', async () => {
    amb.logUsoIA.mockReturnValue(new Promise(() => undefined));
    amb.respostas.push(resposta());
    const r = await Promise.race([
      carregar(amb, edge())([], 'prompt'),
      new Promise((resolver) => setImmediate(() => resolver('esperou a medição'))),
    ]);
    expect(r).toEqual(MENSAGEM);
  });

  it('falha ao agendar a medição (waitUntil lança) não derruba a resposta e fica avisada', async () => {
    amb.waitUntil.mockImplementation(() => { throw new Error('waitUntil indisponível'); });
    amb.respostas.push(resposta());
    const r = await carregar(amb, edge())([], 'prompt');
    expect(r).toEqual(MENSAGEM);
    expect(aviso.mock.calls.flat().map(String).join(' ')).toContain('waitUntil indisponível');
  });

  it('sem EdgeRuntime no ambiente a resposta sai do mesmo jeito', async () => {
    amb.respostas.push(resposta());
    const r = await carregar(amb, undefined)([], 'prompt');
    expect(r).toEqual(MENSAGEM);
    expect(aviso).toHaveBeenCalled();
  });

  it('resposta sem usage: mede com o vazio (o registrador descarta) e responde normalmente', async () => {
    amb.respostas.push(respostaSemUso);
    const r = await carregar(amb, edge())([], 'prompt');
    expect(r).toEqual(MENSAGEM);
    expect(amb.logUsoIA).toHaveBeenCalledWith('whatsapp-bot-reply', 'gemini-3.1-flash-lite', undefined);
  });

  it('uma linha por chamada: duas chamadas do laço de ferramentas medem duas vezes', async () => {
    amb.respostas.push(resposta({ prompt_tokens: 1, completion_tokens: 2 }), resposta({ prompt_tokens: 3, completion_tokens: 4 }));
    const chamar = carregar(amb, edge());
    await chamar([], 'prompt');
    await chamar([], 'prompt');
    expect(amb.logUsoIA.mock.calls.map((c) => c[2])).toEqual([
      { prompt_tokens: 1, completion_tokens: 2 },
      { prompt_tokens: 3, completion_tokens: 4 },
    ]);
    expect(amb.waitUntil).toHaveBeenCalledTimes(2);
  });

  it('erro do Gemini continua lançando como antes e não mede nada', async () => {
    amb.respostas.push(() => new Response('indisponível', { status: 503 }));
    await expect(carregar(amb, edge())([], 'prompt')).rejects.toThrow('Gemini API 503');
    expect(amb.logUsoIA).not.toHaveBeenCalled();
    expect(amb.waitUntil).not.toHaveBeenCalled();
  });

  it('sem a chave da IA continua lançando como antes, sem chamar o provedor', async () => {
    delete amb.env.GEMINI_API_KEY;
    await expect(carregar(amb, edge())([], 'prompt')).rejects.toThrow('GEMINI_API_KEY ausente');
    expect(amb.pedidos).toEqual([]);
    expect(amb.logUsoIA).not.toHaveBeenCalled();
  });

  it('o pedido ao Gemini continua igual: modelo, mensagens com o prompt na frente e ferramentas só quando permitidas', async () => {
    amb.respostas.push(resposta(), resposta());
    const chamar = carregar(amb, edge());
    await chamar([{ role: 'user', content: 'oi' }], 'prompt do sistema', true);
    await chamar([{ role: 'user', content: 'oi' }], 'prompt do sistema', false);
    const [com, sem] = amb.pedidos.map((p) => JSON.parse(p.corpo) as Record<string, unknown>);
    expect(com.messages).toEqual([{ role: 'system', content: 'prompt do sistema' }, { role: 'user', content: 'oi' }]);
    expect(com.tool_choice).toBe('auto');
    expect(sem.tool_choice).toBeUndefined();
    expect(sem.tools).toBeUndefined();
  });
});
