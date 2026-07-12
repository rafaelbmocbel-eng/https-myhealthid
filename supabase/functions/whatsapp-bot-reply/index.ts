// Agente IA conversacional do WhatsApp — responde, agenda, escala, com contexto clínico
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireInternal } from "../_shared/auth.ts";
import { montarContextoClinico, buildSystemPrompt, type ContextoClinico } from "../_shared/agente-contexto.ts";
import { enviarWhatsapp } from "../_shared/enviar-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AdminClient = ReturnType<typeof createClient>;

interface ConfigAutomacao {
  bot_ativo?: boolean;
  bot_apenas_cadastrados?: boolean;
  max_turnos_bot?: number;
  palavras_escalonamento?: string[];
  mensagem_fora_horario?: string | null;
  delay_resposta_segundos?: number;
  horario_inicio?: string | null;
  horario_fim?: string | null;
  dias_semana?: string[] | null;
}

interface ConfigAgenda {
  horario_inicio?: string | null;
  horario_fim?: string | null;
  duracao_padrao?: number | null;
  dias_semana?: string[] | null;
}

interface AgendamentoSlot {
  data_inicio: string;
  data_fim: string;
}

type ToolArgs = Record<string, unknown>;

interface ChatToolCall {
  id: string;
  function: { name: string; arguments: string };
}

interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: ChatToolCall[];
}

const DIA_KEY = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

function dentroDoHorario(cfg: ConfigAutomacao): boolean {
  if (!cfg.horario_inicio || !cfg.horario_fim) return true;
  const now = new Date();
  const dia = DIA_KEY[now.getDay()];
  const dias: string[] = cfg.dias_semana || [];
  if (dias.length && !dias.includes(dia)) return false;
  const [hi, mi] = String(cfg.horario_inicio).split(":").map(Number);
  const [hf, mf] = String(cfg.horario_fim).split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= hi * 60 + mi && cur <= hf * 60 + mf;
}

function detectRedFlag(texto: string, palavras: string[]): string | null {
  const lower = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const p of palavras) {
    const pn = p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (lower.includes(pn)) return p;
  }
  return null;
}

// === TOOLS ===
const tools = [
  {
    type: "function",
    function: {
      name: "consultar_horarios_disponiveis",
      description: "Lista horários livres na agenda do profissional para os próximos dias.",
      parameters: {
        type: "object",
        properties: {
          dias_a_frente: { type: "integer", description: "Quantos dias adiante consultar (1-14)", default: 7 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agendar_sessao",
      description: "Cria um agendamento para o paciente em data/hora específica. Use somente após confirmar disponibilidade.",
      parameters: {
        type: "object",
        properties: {
          data_iso: { type: "string", description: "Data e hora ISO 8601 (ex: 2026-05-20T14:00:00-03:00)" },
          observacao: { type: "string" },
        },
        required: ["data_iso"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirmar_proxima_sessao",
      description: "Confirma a próxima sessão pendente do paciente. Use quando ele responder SIM/confirmo/ok/pode ser/positivo a um lembrete de agendamento.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "reagendar_proxima_sessao",
      description: "Cancela a próxima sessão e inicia processo de reagendamento. Use quando o paciente pedir para remarcar/mudar horário/trocar dia.",
      parameters: {
        type: "object",
        properties: { motivo: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancelar_proxima_sessao",
      description: "Cancela a próxima sessão agendada do paciente sem reagendar.",
      parameters: {
        type: "object",
        properties: { motivo: { type: "string" } },
        required: ["motivo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registrar_chegada",
      description: "Registra que o paciente chegou à clínica (check-in na sala de espera). Use quando o paciente disser CHEGUEI, ESTOU AQUI, CHEGUEL, JÁ CHEGUEI, ESTOU NA RECEPÇÃO ou similar.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "escalar_para_humano",
      description: "Pausa o bot e marca a conversa como precisa de atenção do profissional. Use SEMPRE em red flags, urgência clínica, conteúdo sensível ou quando não souber responder com segurança.",
      parameters: {
        type: "object",
        properties: { motivo: { type: "string" } },
        required: ["motivo"],
      },
    },
  },
];

async function executarTool(admin: AdminClient, name: string, args: ToolArgs, ctx: ContextoClinico, terapeuta_id: string, conversa_id: string) {
  try {
    if (name === "consultar_horarios_disponiveis") {
      const diasArg = typeof args.dias_a_frente === "number" ? args.dias_a_frente : 7;
      const dias = Math.min(14, Math.max(1, diasArg));
      const inicio = new Date();
      const fim = new Date(Date.now() + dias * 86400000);
      const { data: cfg } = await admin.from("config_agenda")
        .select("horario_inicio, horario_fim, duracao_padrao, dias_semana")
        .eq("terapeuta_id", terapeuta_id).maybeSingle();
      const cfgAgenda = cfg as ConfigAgenda | null;
      const { data: ocupadosData } = await admin.from("agendamentos")
        .select("data_inicio, data_fim")
        .eq("terapeuta_id", terapeuta_id)
        .gte("data_inicio", inicio.toISOString())
        .lte("data_inicio", fim.toISOString())
        .neq("status", "cancelado");
      const ocupados = (ocupadosData as AgendamentoSlot[] | null) || [];
      const slots: string[] = [];
      const dur = cfgAgenda?.duracao_padrao || 60;
      const hi = String(cfgAgenda?.horario_inicio || "08:00").split(":").map(Number);
      const hf = String(cfgAgenda?.horario_fim || "18:00").split(":").map(Number);
      const diasOk: string[] = cfgAgenda?.dias_semana || ["seg","ter","qua","qui","sex"];
      for (let d = 0; d < dias; d++) {
        const dia = new Date(inicio.getTime() + d * 86400000);
        if (!diasOk.includes(DIA_KEY[dia.getDay()])) continue;
        for (let m = hi[0] * 60 + hi[1]; m + dur <= hf[0] * 60 + hf[1]; m += dur) {
          const slot = new Date(dia);
          slot.setHours(Math.floor(m / 60), m % 60, 0, 0);
          if (slot < new Date(Date.now() + 2 * 3600000)) continue;
          const ocupado = ocupados.some((o) =>
            new Date(o.data_inicio) <= slot && new Date(o.data_fim) > slot
          );
          if (!ocupado) slots.push(slot.toISOString());
          if (slots.length >= 10) break;
        }
        if (slots.length >= 10) break;
      }
      return { horarios: slots.map(s => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })), iso: slots };
    }

    if (name === "agendar_sessao") {
      if (!ctx.paciente.id) return { ok: false, erro: "Paciente não vinculado. Escale para humano." };
      const data_iso = typeof args.data_iso === "string" ? args.data_iso : "";
      const observacao = typeof args.observacao === "string" ? args.observacao : "Agendado via assistente IA";
      const data_inicio = new Date(data_iso);
      const data_fim = new Date(data_inicio.getTime() + 60 * 60000);
      const { data, error } = await admin.from("agendamentos").insert({
        terapeuta_id, paciente_id: ctx.paciente.id,
        data_inicio: data_inicio.toISOString(),
        data_fim: data_fim.toISOString(),
        status: "confirmacao_pendente",
        observacao,
        origem: "bot_whatsapp",
      }).select("id").single();
      if (error) return { ok: false, erro: error.message };
      // Notifica profissional
      await admin.from("notificacoes").insert({
        terapeuta_id, tipo: "agendamento_bot",
        titulo: "🤖 Novo agendamento pelo bot",
        descricao: `${ctx.paciente.nome} agendou ${data_inicio.toLocaleString("pt-BR")} via WhatsApp.`,
        rota: `/agenda`,
        metadata: { agendamento_id: data.id, paciente_id: ctx.paciente.id },
      });
      return { ok: true, data_confirmada: data_inicio.toLocaleString("pt-BR") };
    }

    if (name === "registrar_chegada") {
      const hoje = new Date();
      const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).toISOString();
      const fimDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59).toISOString();
      const { data: agHoje } = await admin.from("agendamentos")
        .select("id, data_inicio")
        .eq("terapeuta_id", terapeuta_id)
        .eq("paciente_id", ctx.paciente.id)
        .in("status", ["confirmado", "pendente"])
        .gte("data_inicio", inicioDia)
        .lte("data_inicio", fimDia)
        .order("data_inicio", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!agHoje) return { ok: false, erro: "Nenhuma sessão encontrada para hoje." };
      await admin.from("agendamentos")
        .update({ checked_in_em: new Date().toISOString() })
        .eq("id", agHoje.id);
      await admin.from("notificacoes").insert({
        terapeuta_id, tipo: "checkin_sala_espera",
        titulo: "🟢 Paciente chegou",
        descricao: `${ctx.paciente.nome} fez check-in — está na sala de espera.`,
        rota: `/agenda`,
        metadata: { agendamento_id: agHoje.id },
      });
      return { ok: true, mensagem_ao_paciente: `Perfeito! Sua chegada foi registrada. 😊 Por favor, aguarde na recepção — em breve você será chamado(a).` };
    }

    if (name === "confirmar_proxima_sessao") {
      if (!ctx.proxima_sessao) return { ok: false, erro: "Nenhuma sessão futura encontrada." };
      await admin.from("agendamentos").update({
        status: "confirmado",
        confirmado_pelo_paciente_em: new Date().toISOString(),
      }).eq("id", ctx.proxima_sessao.id);
      await admin.from("notificacoes").insert({
        terapeuta_id, tipo: "confirmacao_paciente",
        titulo: "✅ Paciente confirmou sessão",
        descricao: `${ctx.paciente.nome} confirmou ${new Date(ctx.proxima_sessao.data).toLocaleString("pt-BR")}.`,
        rota: `/agenda`,
        metadata: { agendamento_id: ctx.proxima_sessao.id },
      });
      return { ok: true, mensagem_ao_paciente: "Sessão confirmada! Te espero. 💙" };
    }

    if (name === "reagendar_proxima_sessao") {
      if (!ctx.proxima_sessao) return { ok: false, erro: "Nenhuma sessão futura para reagendar." };
      const motivoReagendamento = typeof args.motivo === "string" ? args.motivo : "—";
      await admin.from("agendamentos").update({
        status: "cancelado",
        observacao: `Reagendamento solicitado via bot: ${motivoReagendamento}`,
      }).eq("id", ctx.proxima_sessao.id);
      await admin.from("notificacoes").insert({
        terapeuta_id, tipo: "reagendamento_solicitado",
        titulo: "🔄 Paciente quer reagendar",
        descricao: `${ctx.paciente.nome} pediu para remarcar ${new Date(ctx.proxima_sessao.data).toLocaleString("pt-BR")}.`,
        rota: `/agenda`,
        metadata: { agendamento_id: ctx.proxima_sessao.id },
      });
      return { ok: true, mensagem_ao_paciente: "Sem problema! Vou te mostrar horários disponíveis — me diga qual prefere." };
    }

    if (name === "cancelar_proxima_sessao") {
      if (!ctx.proxima_sessao) return { ok: false, erro: "Nenhuma sessão futura encontrada." };
      const motivoCancelamento = typeof args.motivo === "string" ? args.motivo : "—";
      await admin.from("agendamentos").update({
        status: "cancelado",
        observacao: `Cancelado via bot: ${motivoCancelamento}`,
      }).eq("id", ctx.proxima_sessao.id);
      await admin.from("notificacoes").insert({
        terapeuta_id, tipo: "cancelamento_bot",
        titulo: "⚠️ Cancelamento via bot",
        descricao: `${ctx.paciente.nome} cancelou sessão ${new Date(ctx.proxima_sessao.data).toLocaleString("pt-BR")}. Motivo: ${motivoCancelamento}`,
        rota: `/agenda`,
        metadata: { agendamento_id: ctx.proxima_sessao.id },
      });
      return { ok: true };
    }

    if (name === "escalar_para_humano") {
      const motivoEscalonamento = typeof args.motivo === "string" ? args.motivo : "Motivo não especificado";
      await admin.from("whatsapp_conversas").update({
        bot_ativo: false,
        requer_atencao: true,
        motivo_escalonamento: motivoEscalonamento,
      }).eq("id", conversa_id);
      await admin.from("notificacoes").insert({
        terapeuta_id, tipo: "whatsapp_escalonamento",
        titulo: "🚨 Conversa precisa de atenção",
        descricao: `${ctx.paciente.nome || ctx.paciente.primeiro_nome}: ${motivoEscalonamento}`,
        rota: `/crm?tab=inbox&c=${conversa_id}`,
        metadata: { conversa_id },
      });
      return { ok: true, mensagem_ao_paciente: "Vou pedir para o(a) profissional te responder pessoalmente, ok? Em instantes alguém entra em contato." };
    }

    return { ok: false, erro: "Tool desconhecida" };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}

interface GeminiChatResponse {
  choices?: { message: ChatMessage }[];
}

async function chamarLLM(messages: ChatMessage[], systemPrompt: string, allowTools = true): Promise<ChatMessage | undefined> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY ausente");
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-3.1-flash-lite",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      ...(allowTools ? { tools, tool_choice: "auto" } : {}),
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Gemini API ${r.status}: ${t.slice(0, 200)}`);
  }
  const j: GeminiChatResponse = await r.json();
  return j.choices?.[0]?.message;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try { requireInternal(req); } catch (r) { return r as Response; }

  try {
    const { conversa_id, mensagem_id } = await req.json();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: conv } = await admin
      .from("whatsapp_conversas")
      .select("id, terapeuta_id, telefone, bot_ativo, paciente_id, nome_contato, turnos_bot, requer_atencao, origem")
      .eq("id", conversa_id).maybeSingle();
    if (!conv) return new Response(JSON.stringify({ ok: false, error: "conversa não encontrada" }), { status: 404, headers: corsHeaders });

    const { data: msg } = await admin
      .from("whatsapp_mensagens_inbox")
      .select("conteudo, tipo, direcao")
      .eq("id", mensagem_id).maybeSingle();
    if (!msg || msg.direcao !== "entrada") {
      return new Response(JSON.stringify({ ok: true, skip: "não é msg de entrada" }), { headers: corsHeaders });
    }
    const texto = msg.conteudo || "[mídia recebida]";

    // Contato bloqueado (família/amigos): bot nunca responde
    const telTail = String(conv.telefone || "").replace(/\D/g, "").slice(-10);
    if (telTail) {
      const { data: bloqueado } = await admin
        .from("whatsapp_contatos_bloqueados")
        .select("id")
        .eq("terapeuta_id", conv.terapeuta_id)
        .ilike("telefone", `%${telTail}`)
        .limit(1).maybeSingle();
      if (bloqueado) {
        await admin.from("whatsapp_conversas").update({
          bot_ativo: false,
          requer_atencao: false,
          motivo_escalonamento: "Contato pessoal (bot desativado)",
        }).eq("id", conversa_id);
        return new Response(JSON.stringify({ ok: true, skip: "contato_bloqueado" }), { headers: corsHeaders });
      }
    }

    const { data: cfg } = await admin
      .from("whatsapp_automacoes").select("*")
      .eq("terapeuta_id", conv.terapeuta_id).maybeSingle();
    if (!cfg || !cfg.bot_ativo) {
      return new Response(JSON.stringify({ ok: true, skip: "bot desativado" }), { headers: corsHeaders });
    }

    // REGRA ESTRITA: o bot só manda automática para quem está na lista de
    // CLIENTES — cadastrado E ativo. Sem cadastro, inativo, ou removido dos
    // clientes → NÃO responde. (Leads de anúncio ficam para quando houver
    // campanhas; por ora, ninguém fora da lista de clientes recebe.)
    if (!conv.paciente_id) {
      return new Response(JSON.stringify({ ok: true, skip: "nao_cliente" }), { headers: corsHeaders });
    }
    const { data: pacStatus } = await admin
      .from("pacientes").select("ativo").eq("id", conv.paciente_id).maybeSingle();
    if (!pacStatus || (pacStatus as { ativo?: boolean }).ativo === false) {
      return new Response(JSON.stringify({ ok: true, skip: "cliente_inativo_ou_removido" }), { headers: corsHeaders });
    }

    // Já escalada? Não responde.
    if (conv.requer_atencao || !conv.bot_ativo) {
      return new Response(JSON.stringify({ ok: true, skip: "conversa escalada" }), { headers: corsHeaders });
    }

    // Limite de turnos
    if ((conv.turnos_bot || 0) >= (cfg.max_turnos_bot || 5)) {
      await admin.from("whatsapp_conversas").update({
        requer_atencao: true,
        motivo_escalonamento: `Limite de ${cfg.max_turnos_bot} turnos atingido`,
      }).eq("id", conversa_id);
      return new Response(JSON.stringify({ ok: true, skip: "limite turnos" }), { headers: corsHeaders });
    }

    // Já há resposta humana recente?
    const { data: ultSaidaData } = await admin
      .from("whatsapp_mensagens_inbox")
      .select("created_at, metadata")
      .eq("conversa_id", conversa_id)
      .eq("direcao", "saida")
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();
    const ultSaida = ultSaidaData as { created_at: string; metadata: Record<string, unknown> | null } | null;
    if (ultSaida && !ultSaida.metadata?.bot) {
      const diff = Date.now() - new Date(ultSaida.created_at).getTime();
      if (diff < 30 * 60 * 1000) {
        return new Response(JSON.stringify({ ok: true, skip: "humano respondeu" }), { headers: corsHeaders });
      }
    }

    // Red flag → escala antes de tudo
    const palavras = cfg.palavras_escalonamento || [];
    const flagged = detectRedFlag(texto, palavras);
    if (flagged) {
      await admin.from("whatsapp_conversas").update({
        requer_atencao: true,
        motivo_escalonamento: `Red flag detectado: "${flagged}"`,
        bot_ativo: false,
      }).eq("id", conversa_id);
      const aviso = "Recebi sua mensagem e vou pedir para o(a) profissional te responder pessoalmente o quanto antes. Se for uma emergência, procure o pronto-socorro mais próximo ou ligue 192. 💙";
      await enviarWhatsapp(admin, conv.terapeuta_id, conv.telefone, aviso);
      await admin.from("whatsapp_mensagens_inbox").insert({
        conversa_id, terapeuta_id: conv.terapeuta_id, direcao: "saida", tipo: "texto",
        conteudo: aviso, status: "enviada", metadata: { bot: true, red_flag: flagged },
      });
      await admin.from("notificacoes").insert({
        terapeuta_id: conv.terapeuta_id, tipo: "whatsapp_red_flag",
        titulo: "🚨 RED FLAG no WhatsApp",
        descricao: `${conv.nome_contato || conv.telefone}: "${texto.slice(0, 120)}"`,
        rota: `/crm?tab=inbox&c=${conversa_id}`,
        metadata: { conversa_id, palavra: flagged },
      });
      return new Response(JSON.stringify({ ok: true, escalado: true, red_flag: flagged }), { headers: corsHeaders });
    }

    // Fora do horário?
    if (!dentroDoHorario(cfg)) {
      const msgFora = cfg.mensagem_fora_horario || "Recebemos sua mensagem! Nosso horário de atendimento é em breve, e logo te respondemos. 💙";
      const personalizada = msgFora.replace("{nome}", (conv.nome_contato?.split(" ")[0] || ""));
      await enviarWhatsapp(admin, conv.terapeuta_id, conv.telefone, personalizada);
      await admin.from("whatsapp_mensagens_inbox").insert({
        conversa_id, terapeuta_id: conv.terapeuta_id, direcao: "saida", tipo: "texto",
        conteudo: personalizada, status: "enviada", metadata: { bot: true, fora_horario: true },
      });
      return new Response(JSON.stringify({ ok: true, fora_horario: true }), { headers: corsHeaders });
    }

    // Monta contexto clínico
    const ctx = await montarContextoClinico(admin, conv.terapeuta_id, conv.paciente_id, conv.telefone, conv.nome_contato);
    const systemPrompt = buildSystemPrompt(ctx);

    // Histórico recente (últimas 10 mensagens)
    const { data: histData } = await admin
      .from("whatsapp_mensagens_inbox")
      .select("direcao, conteudo, transcricao")
      .eq("conversa_id", conversa_id)
      .order("created_at", { ascending: false })
      .limit(10);
    const hist = (histData as { direcao: string; conteudo: string | null; transcricao: string | null }[] | null) || [];
    const messages: ChatMessage[] = hist.reverse().map((m) => ({
      role: m.direcao === "entrada" ? "user" : "assistant",
      content: m.conteudo || m.transcricao || "[mídia]",
    }));

    // Loop de tools (máx 4 chamadas)
    let resposta_final = "";
    for (let i = 0; i < 4; i++) {
      const ai = await chamarLLM(messages, systemPrompt, true);
      if (!ai) break;
      messages.push(ai);

      if (ai.tool_calls?.length) {
        for (const tc of ai.tool_calls) {
          let args: ToolArgs = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* argumentos malformados — segue com objeto vazio */ }
          const result = await executarTool(admin, tc.function.name, args, ctx, conv.terapeuta_id, conversa_id);
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      resposta_final = ai.content || "";
      break;
    }

    if (!resposta_final) resposta_final = "Recebi sua mensagem! Em instantes te respondo. 💙";

    // Delay simulando humano
    const delay = Math.min(cfg.delay_resposta_segundos || 3, 8);
    await new Promise(r => setTimeout(r, delay * 1000));

    const enviado = await enviarWhatsapp(admin, conv.terapeuta_id, conv.telefone, resposta_final);
    if (enviado) {
      await admin.from("whatsapp_mensagens_inbox").insert({
        conversa_id, terapeuta_id: conv.terapeuta_id, direcao: "saida", tipo: "texto",
        conteudo: resposta_final, status: "enviada",
        metadata: { bot: true, agente_ia: true },
      });
      await admin.from("whatsapp_conversas").update({
        turnos_bot: (conv.turnos_bot || 0) + 1,
      }).eq("id", conversa_id);
      await admin.rpc("incrementar_uso_ia", { p_user_id: conv.terapeuta_id, p_tipo: "agente_whatsapp" });
    }

    return new Response(JSON.stringify({ ok: true, enviado }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[bot-reply] erro:", e);
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
