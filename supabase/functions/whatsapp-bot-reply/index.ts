// Agente IA conversacional do WhatsApp — responde, agenda, escala, com contexto clínico
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { montarContextoClinico, buildSystemPrompt } from "../_shared/agente-contexto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DIA_KEY = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

function dentroDoHorario(cfg: any): boolean {
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

async function enviarWhatsapp(admin: any, terapeuta_id: string, phone: string, message: string) {
  const { data: cfg } = await admin
    .from("config_clinica")
    .select("zapi_instance_id, zapi_token, zapi_client_token")
    .eq("terapeuta_id", terapeuta_id).maybeSingle();
  if (!cfg?.zapi_instance_id || !cfg?.zapi_token) return false;
  const baseUrl = `https://api.z-api.io/instances/${cfg.zapi_instance_id}/token/${cfg.zapi_token}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.zapi_client_token) headers["Client-Token"] = cfg.zapi_client_token;
  const r = await fetch(`${baseUrl}/send-text`, {
    method: "POST", headers, body: JSON.stringify({ phone, message }),
  });
  return r.ok;
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
      name: "cancelar_proxima_sessao",
      description: "Cancela a próxima sessão agendada do paciente.",
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

async function executarTool(admin: any, name: string, args: any, ctx: any, terapeuta_id: string, conversa_id: string) {
  try {
    if (name === "consultar_horarios_disponiveis") {
      const dias = Math.min(14, Math.max(1, args.dias_a_frente || 7));
      const inicio = new Date();
      const fim = new Date(Date.now() + dias * 86400000);
      const { data: cfg } = await admin.from("config_agenda")
        .select("horario_inicio, horario_fim, duracao_padrao, dias_semana")
        .eq("terapeuta_id", terapeuta_id).maybeSingle();
      const { data: ocupados } = await admin.from("agendamentos")
        .select("data_inicio, data_fim")
        .eq("terapeuta_id", terapeuta_id)
        .gte("data_inicio", inicio.toISOString())
        .lte("data_inicio", fim.toISOString())
        .neq("status", "cancelado");
      const slots: string[] = [];
      const dur = (cfg as any)?.duracao_padrao || 60;
      const hi = String((cfg as any)?.horario_inicio || "08:00").split(":").map(Number);
      const hf = String((cfg as any)?.horario_fim || "18:00").split(":").map(Number);
      const diasOk: string[] = (cfg as any)?.dias_semana || ["seg","ter","qua","qui","sex"];
      for (let d = 0; d < dias; d++) {
        const dia = new Date(inicio.getTime() + d * 86400000);
        if (!diasOk.includes(DIA_KEY[dia.getDay()])) continue;
        for (let m = hi[0] * 60 + hi[1]; m + dur <= hf[0] * 60 + hf[1]; m += dur) {
          const slot = new Date(dia);
          slot.setHours(Math.floor(m / 60), m % 60, 0, 0);
          if (slot < new Date(Date.now() + 2 * 3600000)) continue;
          const ocupado = (ocupados || []).some((o: any) =>
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
      const data_iso = args.data_iso;
      const data_inicio = new Date(data_iso);
      const data_fim = new Date(data_inicio.getTime() + 60 * 60000);
      const { data, error } = await admin.from("agendamentos").insert({
        terapeuta_id, paciente_id: ctx.paciente.id,
        data_inicio: data_inicio.toISOString(),
        data_fim: data_fim.toISOString(),
        status: "confirmacao_pendente",
        observacao: args.observacao || "Agendado via assistente IA",
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

    if (name === "cancelar_proxima_sessao") {
      if (!ctx.proxima_sessao) return { ok: false, erro: "Nenhuma sessão futura encontrada." };
      await admin.from("agendamentos").update({
        status: "cancelado",
        observacao: `Cancelado via bot: ${args.motivo}`,
      }).eq("id", ctx.proxima_sessao.id);
      await admin.from("notificacoes").insert({
        terapeuta_id, tipo: "cancelamento_bot",
        titulo: "⚠️ Cancelamento via bot",
        descricao: `${ctx.paciente.nome} cancelou sessão ${new Date(ctx.proxima_sessao.data).toLocaleString("pt-BR")}. Motivo: ${args.motivo}`,
        rota: `/agenda`,
        metadata: { agendamento_id: ctx.proxima_sessao.id },
      });
      return { ok: true };
    }

    if (name === "escalar_para_humano") {
      await admin.from("whatsapp_conversas").update({
        bot_ativo: false,
        requer_atencao: true,
        motivo_escalonamento: args.motivo,
      }).eq("id", conversa_id);
      await admin.from("notificacoes").insert({
        terapeuta_id, tipo: "whatsapp_escalonamento",
        titulo: "🚨 Conversa precisa de atenção",
        descricao: `${ctx.paciente.nome || ctx.paciente.primeiro_nome}: ${args.motivo}`,
        rota: `/crm?tab=inbox&c=${conversa_id}`,
        metadata: { conversa_id },
      });
      return { ok: true, mensagem_ao_paciente: "Vou pedir para o(a) profissional te responder pessoalmente, ok? Em instantes alguém entra em contato." };
    }

    return { ok: false, erro: "Tool desconhecida" };
  } catch (e: any) {
    return { ok: false, erro: e.message };
  }
}

async function chamarLLM(messages: any[], systemPrompt: string, allowTools = true) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      ...(allowTools ? { tools, tool_choice: "auto" } : {}),
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AI gateway ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  return j.choices?.[0]?.message;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { conversa_id, mensagem_id } = await req.json();
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: conv } = await admin
      .from("whatsapp_conversas")
      .select("id, terapeuta_id, telefone, bot_ativo, paciente_id, nome_contato, turnos_bot, requer_atencao")
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

    const { data: cfg } = await admin
      .from("whatsapp_automacoes").select("*")
      .eq("terapeuta_id", conv.terapeuta_id).maybeSingle();
    if (!cfg || !cfg.bot_ativo) {
      return new Response(JSON.stringify({ ok: true, skip: "bot desativado" }), { headers: corsHeaders });
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
    const { data: ultSaida } = await admin
      .from("whatsapp_mensagens_inbox")
      .select("created_at, metadata")
      .eq("conversa_id", conversa_id)
      .eq("direcao", "saida")
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();
    if (ultSaida && !(ultSaida.metadata as any)?.bot) {
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
    const { data: hist } = await admin
      .from("whatsapp_mensagens_inbox")
      .select("direcao, conteudo, transcricao")
      .eq("conversa_id", conversa_id)
      .order("created_at", { ascending: false })
      .limit(10);
    const messages: any[] = ((hist || []).reverse()).map((m: any) => ({
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
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch {}
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
  } catch (e: any) {
    console.error("[bot-reply] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
