// Agente proativo — roda via cron a cada 30 min e dispara mensagens automáticas.
//
// Motor de mensagens, decidido por terapeuta pelos segredos MOTOR_MODELOS_MODO e MOTOR_MODELOS_TERAPEUTAS
// (aniversário, diário parado, MyID vencido e reengajamento):
//  - legado: a IA escreve e envia, como sempre foi. É o que vale quando os segredos não existem;
//  - simulacao: a IA ainda envia; além disso grava em agente_disparos, como 'simulado:<gatilho>', o texto pronto
//    que o modo real mandaria, para conferir antes de ligar;
//  - real: só texto pronto com variáveis, sem IA.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireInternal } from "../_shared/auth.ts";
import { montarContextoClinico, buildSystemPrompt, fmtDataHoraBR, fmtDataBR, FUSO_BR } from "../_shared/agente-contexto.ts";
import { enviarWhatsapp } from "../_shared/enviar-whatsapp.ts";
import { registrarMensagemSaida } from "../_shared/registrar-saida.ts";
import { logUsoIA } from "../_shared/log-ia.ts";
import { decidirModoMotor, primeiroNomeCapitalizado, resolverMensagem } from "../_shared/mensagem-modelos.ts";
import type { GatilhoProativo, ModoMotor } from "../_shared/mensagem-modelos.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Valores escolhidos, não medidos. O orçamento fica abaixo do limite de tempo da função: passou dele, a rodada para
// e o tick seguinte (30 min depois) retoma. A pausa ocupa o lugar do espaçamento que a demora da IA dava sem querer.
const ORCAMENTO_MS = 140_000;
const PAUSA_ENTRE_ENVIOS_MS = 2_000;

function novaRodada() {
  return {
    enviados: 0,
    falhas_envio: 0,
    simulados: 0,
    recusados: {} as Record<string, number>,
    recusariam_na_simulacao: {} as Record<string, number>,
    erros_gatilho: 0,
    erros_gravacao: 0,
  };
}
type Rodada = ReturnType<typeof novaRodada>;

function contar(mapa: Record<string, number>, chave: string) {
  mapa[chave] = (mapa[chave] ?? 0) + 1;
}

function textoDoErro(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function gerarMensagem(systemPrompt: string, instrucao: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY ausente");
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 45_000);
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    signal: ctrl.signal,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-3.1-flash-lite",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: instrucao },
      ],
    }),
  });
  if (!r.ok) return "";
  const j = await r.json();
  await logUsoIA("agente-proativo", "gemini-3.1-flash-lite", j.usage);
  return j.choices?.[0]?.message?.content?.trim() || "";
}

async function jaDisparado(admin: any, paciente_id: string, gatilho: string, ref_id: string | null, janela_horas = 24) {
  const since = new Date(Date.now() - janela_horas * 3600000).toISOString();
  const q = admin.from("agente_disparos")
    .select("id", { count: "exact", head: true })
    .eq("paciente_id", paciente_id)
    .eq("gatilho", gatilho)
    .gte("created_at", since);
  if (ref_id) q.eq("ref_id", ref_id);
  const { count } = await q;
  return (count || 0) > 0;
}

// Conversa do Zap sempre atualizada: registra a saída na thread do paciente.
async function registrarNaConversa(admin: DispatchCtx["admin"], terapeuta_id: string, paciente_id: string, gatilho: string, conteudo: string) {
  try {
    const { data: p } = await admin.from("pacientes")
      .select("telefone").eq("id", paciente_id).maybeSingle();
    if (p?.telefone) {
      await registrarMensagemSaida(admin, {
        terapeuta_id, paciente_id, telefone: p.telefone, conteudo, origem: gatilho,
      });
    }
  } catch { /* best-effort */ }
}

// Devolve false quando a linha não foi gravada: sem ela a trava jaDisparado não vê o envio e o tick seguinte repete.
async function registrarDisparo(admin: any, terapeuta_id: string, paciente_id: string, gatilho: string, ref_id: string | null, conteudo: string, ok: boolean, erro?: string): Promise<boolean> {
  const { error } = await admin.from("agente_disparos").insert({
    terapeuta_id, paciente_id, gatilho, ref_id, conteudo,
    status: ok ? "enviado" : "erro", erro,
  });
  if (error) console.error(`[agente-proativo] não gravou o disparo ${gatilho} do paciente ${paciente_id}:`, error.message);
  if (ok) await registrarNaConversa(admin, terapeuta_id, paciente_id, gatilho, conteudo);
  return !error;
}

type DispatchCtx = {
  admin: any; terapeuta_id: string; paciente_id: string; telefone: string;
  systemPromptBase: string; cfg: any;
  // Primeiro nome — variável dos modelos aprovados da Meta (fora das 24h).
  primeiroNome?: string;
};

// Contexto dos 4 gatilhos com texto pronto.
type DispatchCtxMotor = DispatchCtx & {
  modo: ModoMotor;
  // Nome do cadastro sem tratar: quem monta o texto pronto é que aceita ou recusa.
  nome: string | null;
  rodada: Rodada;
};

type PedidoMensagem = {
  gatilho: GatilhoProativo;
  // Valor gravado em agente_disparos (o reengajamento leva os dias: reengajamento_14d).
  chave: string;
  janelaHoras: number;
  dias?: number;
  gerarLegado: () => Promise<string>;
};

async function gravarSimulacao(ctx: DispatchCtxMotor, pedido: PedidoMensagem, texto: string) {
  const gatilhoSimulado = `simulado:${pedido.chave}`;
  if (await jaDisparado(ctx.admin, ctx.paciente_id, gatilhoSimulado, null, pedido.janelaHoras)) return;
  const { error } = await ctx.admin.from("agente_disparos").insert({
    terapeuta_id: ctx.terapeuta_id, paciente_id: ctx.paciente_id, gatilho: gatilhoSimulado, ref_id: null,
    conteudo: texto, status: "simulado",
  });
  if (error) {
    ctx.rodada.erros_gravacao++;
    console.error(`[agente-proativo] não gravou a simulação ${pedido.chave} do paciente ${ctx.paciente_id}:`, error.message);
    return;
  }
  ctx.rodada.simulados++;
}

// Texto pronto do gatilho, ou null quando não dá para montar. Sem nome aproveitável ou sem dias válidos: não grava
// linha (não gasta a janela de repetição), avisa e conta.
function textoPronto(ctx: DispatchCtxMotor, pedido: PedidoMensagem): string | null {
  const pronta = resolverMensagem({
    gatilho: pedido.gatilho,
    tom: ctx.cfg?.tom_voz,
    valores: { nome: ctx.nome, dias: pedido.dias },
  });
  if (pronta.texto !== null) return pronta.texto;
  const simulando = ctx.modo === "simulacao";
  contar(simulando ? ctx.rodada.recusariam_na_simulacao : ctx.rodada.recusados, pronta.motivo);
  console.warn(`[agente-proativo] texto pronto recusado (${simulando ? "simulação" : "real"}): gatilho=${pedido.chave} motivo=${pronta.motivo} paciente=${ctx.paciente_id}`);
  return null;
}

// Ponto único de decisão do texto dos 4 gatilhos. Devolve null quando NÃO deve enviar.
async function obterMensagem(ctx: DispatchCtxMotor, pedido: PedidoMensagem): Promise<string | null> {
  if (ctx.modo === "real") return textoPronto(ctx, pedido);

  if (ctx.modo === "simulacao") {
    // Antes da IA: se ela falhar, a prévia do que o modo real mandaria fica completa do mesmo jeito. E nada que dê
    // errado aqui pode tirar o envio que o legado faz hoje: a falha só é contada.
    try {
      const texto = textoPronto(ctx, pedido);
      if (texto !== null) await gravarSimulacao(ctx, pedido, texto);
    } catch (e) {
      ctx.rodada.erros_gravacao++;
      console.error(`[agente-proativo] a simulação de ${pedido.chave} falhou para o paciente ${ctx.paciente_id}; o envio segue pelo legado:`, textoDoErro(e));
    }
  }
  return (await pedido.gerarLegado()) || null;
}

function enviarTexto(ctx: DispatchCtx, msg: string, opts?: { modelo: { chave: string; params: string[] } }): Promise<boolean> {
  if (opts) return enviarWhatsapp(ctx.admin, ctx.terapeuta_id, ctx.telefone, msg, opts);
  return enviarWhatsapp(ctx.admin, ctx.terapeuta_id, ctx.telefone, msg);
}

// Grava a linha 'enviando' ANTES de enviar: jaDisparado conta qualquer status, então uma queda no meio perde a
// mensagem em vez de repeti-la no tick seguinte. Devolve null (e não envia) se não conseguir gravar a linha.
async function reservarDisparo(ctx: DispatchCtxMotor, chave: string, ref_id: string | null, conteudo: string): Promise<string | null> {
  const { data, error } = await ctx.admin.from("agente_disparos").insert({
    terapeuta_id: ctx.terapeuta_id, paciente_id: ctx.paciente_id, gatilho: chave, ref_id, conteudo, status: "enviando",
  }).select("id").single();
  if (error || !data?.id) {
    ctx.rodada.erros_gravacao++;
    console.error(`[agente-proativo] não reservou o disparo ${chave} do paciente ${ctx.paciente_id}; a mensagem não foi enviada:`, error?.message);
    return null;
  }
  return data.id;
}

async function enviarERegistrar(ctx: DispatchCtxMotor, chave: string, ref_id: string | null, msg: string, opts?: { modelo: { chave: string; params: string[] } }) {
  if (ctx.modo !== "real") {
    const ok = await enviarTexto(ctx, msg, opts);
    if (ok) ctx.rodada.enviados++;
    else ctx.rodada.falhas_envio++;
    if (!(await registrarDisparo(ctx.admin, ctx.terapeuta_id, ctx.paciente_id, chave, ref_id, msg, ok))) ctx.rodada.erros_gravacao++;
    return;
  }

  const id = await reservarDisparo(ctx, chave, ref_id, msg);
  if (id === null) return;
  let ok = false;
  let erro: string | undefined;
  try {
    ok = await enviarTexto(ctx, msg, opts);
    if (!ok) erro = "envio_nao_aceito";
  } catch (e) {
    erro = `falha_no_envio: ${textoDoErro(e)}`;
    console.warn(`[agente-proativo] envio de ${chave} lançou erro (paciente ${ctx.paciente_id}):`, erro);
  }
  if (ok) ctx.rodada.enviados++;
  else ctx.rodada.falhas_envio++;
  const { error } = await ctx.admin.from("agente_disparos")
    .update(ok ? { status: "enviado" } : { status: "erro", erro })
    .eq("id", id);
  if (error) {
    ctx.rodada.erros_gravacao++;
    console.error(`[agente-proativo] não atualizou o disparo ${chave} (${id}) para ${ok ? "enviado" : "erro"}:`, error.message);
  }
  if (ok) {
    await registrarNaConversa(ctx.admin, ctx.terapeuta_id, ctx.paciente_id, chave, msg);
    await new Promise<void>((resolve) => setTimeout(resolve, PAUSA_ENTRE_ENVIOS_MS));
  }
}

async function dispararConfirmacao24h(ctx: DispatchCtx, ag: any) {
  if (await jaDisparado(ctx.admin, ctx.paciente_id, "confirmacao_24h", ag.id, 48)) return;
  const instrucao = `Gere uma mensagem CURTA (2 linhas) pedindo confirmação da sessão amanhã às ${fmtDataHoraBR(ag.data_inicio)} (horário de Brasília — use exatamente esse horário). Peça para o paciente responder SIM para confirmar ou REAGENDAR para mudar.`;
  const msg = await gerarMensagem(ctx.systemPromptBase, instrucao);
  if (!msg) return;
  const dataBR = new Date(ag.data_inicio).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: FUSO_BR });
  const horaBR = new Date(ag.data_inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO_BR });
  const ok = await enviarWhatsapp(ctx.admin, ctx.terapeuta_id, ctx.telefone, msg,
    { modelo: { chave: "confirmacao_24h", params: [ctx.primeiroNome || "", dataBR, horaBR] } });
  await registrarDisparo(ctx.admin, ctx.terapeuta_id, ctx.paciente_id, "confirmacao_24h", ag.id, msg, ok);
}

async function dispararLembrete2h(ctx: DispatchCtx, ag: any) {
  if (await jaDisparado(ctx.admin, ctx.paciente_id, "lembrete_2h", ag.id, 6)) return;
  const instrucao = `Gere uma mensagem MUITO curta (1 linha) lembrando da sessão hoje às ${new Date(ag.data_inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO_BR })} (horário de Brasília — use exatamente esse horário). Termine com "Te espero! 💙"`;
  const msg = await gerarMensagem(ctx.systemPromptBase, instrucao);
  if (!msg) return;
  const horaBR = new Date(ag.data_inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO_BR });
  const ok = await enviarWhatsapp(ctx.admin, ctx.terapeuta_id, ctx.telefone, msg,
    { modelo: { chave: "lembrete_2h", params: [ctx.primeiroNome || "", horaBR] } });
  await registrarDisparo(ctx.admin, ctx.terapeuta_id, ctx.paciente_id, "lembrete_2h", ag.id, msg, ok);
}

async function dispararPosSessao(ctx: DispatchCtx, ag: any) {
  if (await jaDisparado(ctx.admin, ctx.paciente_id, "pos_sessao", ag.id, 72)) return;
  const instrucao = `Gere uma mensagem CURTA (3 linhas) perguntando como o paciente está se sentindo após a sessão de hoje. Use tom acolhedor. Peça nota de 0 a 10 para a sensação atual.`;
  const msg = await gerarMensagem(ctx.systemPromptBase, instrucao);
  if (!msg) return;
  const ok = await enviarWhatsapp(ctx.admin, ctx.terapeuta_id, ctx.telefone, msg);
  await registrarDisparo(ctx.admin, ctx.terapeuta_id, ctx.paciente_id, "pos_sessao", ag.id, msg, ok);
}

async function dispararExerciciosPendentes(ctx: DispatchCtx, ctxClinico: any) {
  if (await jaDisparado(ctx.admin, ctx.paciente_id, "exercicio_pendente", null, 72)) return;
  if (ctxClinico.exercicios_pendentes < 1) return;
  const dimensao = ctxClinico.myid?.dimensoes_criticas?.[0]?.nome || "seu plano";
  const instrucao = `O paciente tem ${ctxClinico.exercicios_pendentes} exercícios pendentes no portal, focados em ${dimensao}. Gere uma mensagem CURTA (3 linhas), motivacional, sem culpar, lembrando dos exercícios e do impacto deles na recuperação. Mencione a dimensão.`;
  const msg = await gerarMensagem(ctx.systemPromptBase, instrucao);
  if (!msg) return;
  const ok = await enviarWhatsapp(ctx.admin, ctx.terapeuta_id, ctx.telefone, msg);
  await registrarDisparo(ctx.admin, ctx.terapeuta_id, ctx.paciente_id, "exercicio_pendente", null, msg, ok);
}

async function dispararMyidVencido(ctx: DispatchCtxMotor, ctxClinico: any) {
  if (await jaDisparado(ctx.admin, ctx.paciente_id, "myid_vencido", null, 30 * 24)) return;
  if (!ctxClinico.myid || (ctxClinico.myid.dias_desde || 0) < 30) return;
  const msg = await obterMensagem(ctx, {
    gatilho: "myid_vencido", chave: "myid_vencido", janelaHoras: 30 * 24, dias: ctxClinico.myid.dias_desde,
    gerarLegado: () => gerarMensagem(
      ctx.systemPromptBase,
      `O MyID do paciente foi feito há ${ctxClinico.myid.dias_desde} dias. Gere mensagem CURTA convidando a refazer a avaliação para vermos a evolução. Tom positivo.`,
    ),
  });
  if (!msg) return;
  await enviarERegistrar(ctx, "myid_vencido", null, msg);
}

async function dispararReengajamento(ctx: DispatchCtxMotor, ctxClinico: any, dias: number) {
  const key = `reengajamento_${dias}d`;
  if (await jaDisparado(ctx.admin, ctx.paciente_id, key, null, 60 * 24)) return;
  const msg = await obterMensagem(ctx, {
    gatilho: "reengajamento", chave: key, janelaHoras: 60 * 24, dias,
    gerarLegado: () => gerarMensagem(
      ctx.systemPromptBase,
      `O paciente não tem sessão há ${dias} dias. Gere uma mensagem (3 linhas) gentil perguntando como está e oferecendo retomar o cuidado. NÃO seja insistente nem culpe. Tom de cuidado genuíno.`,
    ),
  });
  if (!msg) return;
  await enviarERegistrar(ctx, key, null, msg);
}

async function dispararDiarioPendente(ctx: DispatchCtxMotor) {
  if (await jaDisparado(ctx.admin, ctx.paciente_id, "diario_pendente", null, 72)) return;
  // Só convida quem JÁ usou o diário (faz parte da rotina dele) e sumiu há 3+ dias.
  const { data: logs } = await ctx.admin.from("daily_logs")
    .select("created_at")
    .eq("paciente_id", ctx.paciente_id)
    .order("created_at", { ascending: false })
    .limit(1);
  const ultimo = logs?.[0]?.created_at ? new Date(logs[0].created_at) : null;
  if (!ultimo) return;
  const dias = Math.floor((Date.now() - ultimo.getTime()) / 86400000);
  if (dias < 3) return;
  const msg = await obterMensagem(ctx, {
    gatilho: "diario_pendente", chave: "diario_pendente", janelaHoras: 72, dias,
    gerarLegado: () => gerarMensagem(
      ctx.systemPromptBase,
      `O paciente não registra o diário de saúde há ${dias} dias. Gere uma mensagem MUITO curta (2 linhas), leve e gentil, convidando a registrar no app como está se sentindo hoje (humor, dor, energia, sono). Sem culpar. Tom de cuidado.`,
    ),
  });
  if (!msg) return;
  await enviarERegistrar(ctx, "diario_pendente", null, msg);
}

// Lembrete gentil de cobrança JÁ vencida. No máximo 1 vez por semana por
// paciente. Só roda se o gatilho "Pagamento pendente" estiver ligado.
async function dispararPagamentoPendente(ctx: DispatchCtx, ctxClinico: any) {
  const pg = ctxClinico.pagamento_pendente;
  if (!pg) return;
  if (pg.vencimento && new Date(pg.vencimento).getTime() > Date.now()) return;
  if (await jaDisparado(ctx.admin, ctx.paciente_id, "pagamento_pendente", null, 7 * 24)) return;
  const venc = pg.vencimento ? ` (venceu em ${fmtDataBR(pg.vencimento)})` : "";
  const instrucao = `O paciente tem um pagamento pendente de R$ ${Number(pg.valor).toFixed(2)}${venc}. Gere uma mensagem CURTA, gentil e sem constrangimento lembrando da pendência e oferecendo ajuda (por exemplo, reenviar a chave PIX). Não seja insistente nem ameaçador.`;
  const msg = await gerarMensagem(ctx.systemPromptBase, instrucao);
  if (!msg) return;
  const ok = await enviarWhatsapp(ctx.admin, ctx.terapeuta_id, ctx.telefone, msg,
    { modelo: { chave: "pagamento_pendente", params: [ctx.primeiroNome || ""] } });
  await registrarDisparo(ctx.admin, ctx.terapeuta_id, ctx.paciente_id, "pagamento_pendente", null, msg, ok);
}

async function dispararAniversario(ctx: DispatchCtxMotor) {
  if (await jaDisparado(ctx.admin, ctx.paciente_id, "aniversario", null, 24 * 300)) return;
  const msg = await obterMensagem(ctx, {
    gatilho: "aniversario", chave: "aniversario", janelaHoras: 24 * 300,
    gerarLegado: () => gerarMensagem(
      ctx.systemPromptBase,
      `HOJE é aniversário do paciente. Gere mensagem CURTA, calorosa, com um voto sincero. Sem promoções.`,
    ),
  });
  if (!msg) return;
  await enviarERegistrar(ctx, "aniversario", null, msg,
    { modelo: { chave: "aniversario", params: [ctx.primeiroNome || ""] } });
}

// Uma falha de um gatilho (IA, banco, envio) não pode derrubar os outros gatilhos nem os outros pacientes da rodada.
function registrarFalha(rodada: Rodada, etapa: string, paciente_id: string, e: unknown) {
  rodada.erros_gatilho++;
  console.warn(`[agente-proativo] ${etapa} falhou para o paciente ${paciente_id}; a rodada segue:`, textoDoErro(e));
}

async function tentar(rodada: Rodada, etapa: string, paciente_id: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    registrarFalha(rodada, etapa, paciente_id, e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try { requireInternal(req); } catch (r) { return r as Response; }

  const inicio = Date.now();
  // Uma vez só por requisição: com a hora lida a cada terapeuta, quem ficasse no fim da lista de uma rodada
  // demorada seria pulado em silêncio ao virar a hora.
  const horaBRT = (new Date(inicio).getUTCHours() - 3 + 24) % 24;
  const modoSecreto = Deno.env.get("MOTOR_MODELOS_MODO");
  const listaSecreta = Deno.env.get("MOTOR_MODELOS_TERAPEUTAS");

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const stats = { confirmacao: 0, lembrete: 0, pos: 0, exerc: 0, myid: 0, reeng: 0, aniv: 0, diario: 0, pag: 0 };
  const rodada = novaRodada();
  const resumo = {
    hora_brt: horaBRT,
    terapeutas: 0,
    pausados: 0,
    terapeutas_por_modo: { legado: 0, simulacao: 0, real: 0 },
    terapeutas_restantes: [] as string[],
    duracao_ms: 0,
  };
  const estourou = () => Date.now() - inicio > ORCAMENTO_MS;

  // Para cada terapeuta com automações + bot ativos
  const { data: configs, error: erroConfigs } = await admin.from("whatsapp_automacoes")
    .select("*").eq("bot_ativo", true);
  if (erroConfigs) console.error("[agente-proativo] não leu as automações:", erroConfigs.message);

  const lista = (configs || []) as Array<{ terapeuta_id: string; automacoes_pausadas?: boolean | null; gatilhos_ativos?: unknown }>;
  resumo.terapeutas = lista.length;

  for (let i = 0; i < lista.length; i++) {
    const cfg = lista[i];
    if (estourou()) {
      resumo.terapeutas_restantes = lista.slice(i).map((c) => c.terapeuta_id);
      break;
    }
    // Pausado: pula antes de qualquer consulta de paciente ou IA (o aniversário daquele dia se perde).
    if (cfg.automacoes_pausadas === true) {
      resumo.pausados++;
      continue;
    }
    const gatilhos = (cfg.gatilhos_ativos as any) || {};
    const terapeuta_id = cfg.terapeuta_id;
    const modo = decidirModoMotor(modoSecreto, listaSecreta, terapeuta_id);
    resumo.terapeutas_por_modo[modo]++;

    // 1) Confirmação 24h — DESLIGADA aqui: quem cuida das confirmações/lembretes/
    // pós-sessão é a função whatsapp-auto-confirm (mensagens template). Manter
    // ligado aqui duplicaria as mensagens. Este agente foca no PROATIVO
    // (reativação, aniversário, exercício, MyID vencido).
    if (false && gatilhos.confirmacao_24h !== false) {
      const ini = new Date(Date.now() + 22 * 3600000);
      const fim = new Date(Date.now() + 26 * 3600000);
      const { data: ags } = await admin.from("agendamentos")
        .select("id, paciente_id, data_inicio, pacientes(telefone, nome, sobrenome)")
        .eq("terapeuta_id", terapeuta_id)
        .gte("data_inicio", ini.toISOString())
        .lte("data_inicio", fim.toISOString())
        .neq("status", "cancelado")
        .not("paciente_id", "is", null);
      for (const ag of ags || []) {
        const tel = (ag as any).pacientes?.telefone;
        if (!tel || !ag.paciente_id) continue;
        const ctxClinico = await montarContextoClinico(admin, terapeuta_id, ag.paciente_id, tel, null);
        await dispararConfirmacao24h({
          admin, terapeuta_id, paciente_id: ag.paciente_id, telefone: tel,
          systemPromptBase: buildSystemPrompt(ctxClinico), cfg, primeiroNome: ctxClinico?.paciente?.primeiro_nome || "",
        }, ag);
        stats.confirmacao++;
      }
    }

    // 2) Lembrete 2h — DESLIGADO aqui (feito pelo whatsapp-auto-confirm)
    if (false && gatilhos.lembrete_2h !== false) {
      const ini = new Date(Date.now() + 1.5 * 3600000);
      const fim = new Date(Date.now() + 2.5 * 3600000);
      const { data: ags } = await admin.from("agendamentos")
        .select("id, paciente_id, data_inicio, pacientes(telefone)")
        .eq("terapeuta_id", terapeuta_id)
        .gte("data_inicio", ini.toISOString())
        .lte("data_inicio", fim.toISOString())
        .neq("status", "cancelado")
        .not("paciente_id", "is", null);
      for (const ag of ags || []) {
        const tel = (ag as any).pacientes?.telefone;
        if (!tel || !ag.paciente_id) continue;
        const ctxClinico = await montarContextoClinico(admin, terapeuta_id, ag.paciente_id, tel, null);
        await dispararLembrete2h({
          admin, terapeuta_id, paciente_id: ag.paciente_id, telefone: tel,
          systemPromptBase: buildSystemPrompt(ctxClinico), cfg, primeiroNome: ctxClinico?.paciente?.primeiro_nome || "",
        }, ag);
        stats.lembrete++;
      }
    }

    // 3) Pós-sessão — DESLIGADO aqui (feito pelo whatsapp-auto-confirm)
    if (false && gatilhos.pos_sessao !== false) {
      const fim = new Date(Date.now() - 1.5 * 3600000);
      const ini = new Date(Date.now() - 2.5 * 3600000);
      const { data: ags } = await admin.from("agendamentos")
        .select("id, paciente_id, data_inicio, pacientes(telefone)")
        .eq("terapeuta_id", terapeuta_id)
        .eq("status", "concluido")
        .gte("data_inicio", ini.toISOString())
        .lte("data_inicio", fim.toISOString())
        .not("paciente_id", "is", null);
      for (const ag of ags || []) {
        const tel = (ag as any).pacientes?.telefone;
        if (!tel || !ag.paciente_id) continue;
        const ctxClinico = await montarContextoClinico(admin, terapeuta_id, ag.paciente_id, tel, null);
        await dispararPosSessao({
          admin, terapeuta_id, paciente_id: ag.paciente_id, telefone: tel,
          systemPromptBase: buildSystemPrompt(ctxClinico), cfg, primeiroNome: ctxClinico?.paciente?.primeiro_nome || "",
        }, ag);
        stats.pos++;
      }
    }

    // 4-7) Por paciente ativo do terapeuta — só roda 1x por dia (na faixa 9-10h BRT)
    if (horaBRT === 9) {
      // Quem excluiu a conta (vinculo_encerrado_em preenchido) continua ativo e com telefone, mas não recebe nada.
      const { data: pacs, error: erroPacs } = await admin.from("pacientes")
        .select("id, nome, telefone, data_nascimento")
        .eq("terapeuta_id", terapeuta_id)
        .eq("ativo", true)
        .is("vinculo_encerrado_em", null)
        .not("telefone", "is", null);
      if (erroPacs) console.error(`[agente-proativo] não leu os pacientes do terapeuta ${terapeuta_id}:`, erroPacs.message);

      let parouNoOrcamento = false;
      for (const p of pacs || []) {
        if (!p.telefone) continue;
        if (estourou()) {
          parouNoOrcamento = true;
          break;
        }
        let ctxClinico: Awaited<ReturnType<typeof montarContextoClinico>>;
        try {
          ctxClinico = await montarContextoClinico(admin, terapeuta_id, p.id, p.telefone, null);
        } catch (e) {
          registrarFalha(rodada, "contexto", p.id, e);
          continue;
        }
        // O prompt da IA só é montado quando uma IA vai mesmo escrever: no modo real nenhum dos 4 gatilhos usa.
        // Sem nome aproveitável o parâmetro do modelo da Meta continua "você", como o contexto clínico sempre fez;
        // no modo real essa cliente nem chega a receber o aniversário (texto pronto recusa sem nome).
        const baseCtx: DispatchCtxMotor = {
          admin, terapeuta_id, paciente_id: p.id, telefone: p.telefone,
          get systemPromptBase() { return buildSystemPrompt(ctxClinico); },
          cfg, primeiroNome: primeiroNomeCapitalizado(p.nome) || "você",
          modo, nome: p.nome ?? null, rodada,
        };

        if (gatilhos.aniversario !== false && ctxClinico.paciente.aniversario_hoje) {
          await tentar(rodada, "aniversario", p.id, async () => { await dispararAniversario(baseCtx); stats.aniv++; });
        }
        if (gatilhos.exercicio_pendente !== false) {
          await tentar(rodada, "exercicio_pendente", p.id, async () => { await dispararExerciciosPendentes(baseCtx, ctxClinico); stats.exerc++; });
        }
        if (gatilhos.diario_pendente !== false) {
          await tentar(rodada, "diario_pendente", p.id, async () => { await dispararDiarioPendente(baseCtx); stats.diario++; });
        }
        // Opt-in: cobrança só sai se o profissional ligou o gatilho.
        if (gatilhos.pagamento_pendente === true) {
          await tentar(rodada, "pagamento_pendente", p.id, async () => { await dispararPagamentoPendente(baseCtx, ctxClinico); stats.pag++; });
        }
        if (gatilhos.myid_vencido !== false) {
          await tentar(rodada, "myid_vencido", p.id, async () => { await dispararMyidVencido(baseCtx, ctxClinico); stats.myid++; });
        }
        if (gatilhos.reengajamento !== false && ctxClinico.ultima_sessao) {
          const d = ctxClinico.ultima_sessao.dias_desde;
          if ([14, 30, 60].includes(d)) {
            await tentar(rodada, "reengajamento", p.id, async () => { await dispararReengajamento(baseCtx, ctxClinico, d); stats.reeng++; });
          }
        }
      }
      if (parouNoOrcamento) {
        resumo.terapeutas_restantes = lista.slice(i).map((c) => c.terapeuta_id);
        break;
      }
    }
  }

  resumo.duracao_ms = Date.now() - inicio;
  const resumoDaRodada = { ...resumo, ...rodada };
  if (resumo.terapeutas_restantes.length > 0) {
    console.warn(`[agente-proativo] orçamento de ${ORCAMENTO_MS} ms estourado; ficaram para o próximo tick os terapeutas: ${resumo.terapeutas_restantes.join(",")}`);
  }
  console.log("[agente-proativo] resumo da rodada", JSON.stringify(resumoDaRodada));

  return new Response(JSON.stringify({ ok: true, stats, resumo: resumoDaRodada }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
