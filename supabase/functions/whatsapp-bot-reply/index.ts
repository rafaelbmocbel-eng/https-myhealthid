// Bot de primeira resposta + detecção de intenção
// Chamado pelo webhook quando msg de entrada chega
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DIA_KEY = ["dom","seg","ter","qua","qui","sex","sab"];

function dentroDoHorario(cfg: any): boolean {
  const now = new Date();
  const dia = DIA_KEY[now.getDay()];
  const dias: string[] = cfg.dias_semana || [];
  if (!dias.includes(dia)) return false;
  const [hi, mi] = String(cfg.horario_inicio).split(":").map(Number);
  const [hf, mf] = String(cfg.horario_fim).split(":").map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= hi * 60 + mi && cur <= hf * 60 + mf;
}

async function detectarIntencao(texto: string, contexto: string): Promise<any> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;
  const prompt = `Você analisa mensagens de WhatsApp para uma clínica de saúde. Classifique a intenção e gere um resumo curto.

Histórico recente:
${contexto}

Nova mensagem do paciente:
"${texto}"

Retorne JSON com: intencao (uma de: agendar, reagendar, cancelar, duvida_servico, duvida_preco, urgencia, confirmar, saudacao, outro), confianca (0-1), resumo (1 linha em PT-BR), lead_score (0-100 = quão pronto para fechar uma sessão).`;

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return JSON.parse(j.choices?.[0]?.message?.content || "{}");
  } catch (e) {
    console.warn("detectarIntencao falhou:", e);
    return null;
  }
}

async function enviarWhatsapp(terapeuta_id: string, phone: string, message: string) {
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: cfg } = await supa
    .from("config_clinica")
    .select("zapi_instance_id, zapi_token, zapi_client_token")
    .eq("terapeuta_id", terapeuta_id)
    .maybeSingle();
  if (!cfg?.zapi_instance_id || !cfg?.zapi_token) return false;
  const baseUrl = `https://api.z-api.io/instances/${cfg.zapi_instance_id}/token/${cfg.zapi_token}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.zapi_client_token) headers["Client-Token"] = cfg.zapi_client_token;
  const r = await fetch(`${baseUrl}/send-text`, {
    method: "POST", headers,
    body: JSON.stringify({ phone, message }),
  });
  return r.ok;
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
      .select("id, terapeuta_id, telefone, bot_ativo, paciente_id, nome_contato")
      .eq("id", conversa_id).maybeSingle();
    if (!conv) return new Response(JSON.stringify({ ok: false, error: "conversa não encontrada" }), { status: 404, headers: corsHeaders });

    const { data: msg } = await admin
      .from("whatsapp_mensagens_inbox")
      .select("conteudo, tipo, direcao")
      .eq("id", mensagem_id).maybeSingle();
    if (!msg || msg.direcao !== "entrada") {
      return new Response(JSON.stringify({ ok: true, skip: "não é msg de entrada" }), { headers: corsHeaders });
    }
    const texto = msg.conteudo || "[mídia]";

    const { data: cfg } = await admin
      .from("whatsapp_automacoes")
      .select("*")
      .eq("terapeuta_id", conv.terapeuta_id).maybeSingle();
    if (!cfg) return new Response(JSON.stringify({ ok: true, skip: "sem config" }), { headers: corsHeaders });

    // Histórico recente para contexto
    const { data: hist } = await admin
      .from("whatsapp_mensagens_inbox")
      .select("direcao, conteudo")
      .eq("conversa_id", conversa_id)
      .order("created_at", { ascending: false })
      .limit(8);
    const contexto = (hist || []).reverse()
      .map((m: any) => `[${m.direcao === "entrada" ? "paciente" : "clinica"}] ${m.conteudo || ""}`)
      .join("\n");

    // Detecta intenção
    let intencao: any = null;
    if (cfg.detectar_intencao) {
      intencao = await detectarIntencao(texto, contexto);
      if (intencao?.intencao) {
        await admin.from("whatsapp_intencoes").insert({
          terapeuta_id: conv.terapeuta_id,
          conversa_id,
          mensagem_id,
          intencao: intencao.intencao,
          confianca: intencao.confianca || 0,
          resumo: intencao.resumo || null,
          metadata: intencao,
        });
        await admin.from("whatsapp_conversas").update({
          intencao_atual: intencao.intencao,
          lead_score: intencao.lead_score ?? 0,
        }).eq("id", conversa_id);
      }
    }

    // Bot envia resposta?
    if (!cfg.bot_ativo || !conv.bot_ativo) {
      return new Response(JSON.stringify({ ok: true, skip: "bot desativado", intencao }), { headers: corsHeaders });
    }

    // Se já há resposta humana recente (última msg de saída há < 30 min), não responde
    const { data: ultSaida } = await admin
      .from("whatsapp_mensagens_inbox")
      .select("created_at")
      .eq("conversa_id", conversa_id)
      .eq("direcao", "saida")
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();
    if (ultSaida) {
      const diff = Date.now() - new Date(ultSaida.created_at).getTime();
      if (diff < 30 * 60 * 1000) {
        return new Response(JSON.stringify({ ok: true, skip: "humano respondeu recente" }), { headers: corsHeaders });
      }
    }

    const noHorario = dentroDoHorario(cfg);
    const mensagem = noHorario ? cfg.mensagem_saudacao : cfg.mensagem_fora_horario;
    const personalizada = mensagem.replace("{nome}", conv.nome_contato?.split(" ")[0] || "");

    // Aguarda delay (simula humano digitando) — máximo 5s aqui
    const delay = Math.min(cfg.delay_resposta_segundos || 5, 5);
    await new Promise((res) => setTimeout(res, delay * 1000));

    const enviado = await enviarWhatsapp(conv.terapeuta_id, conv.telefone, personalizada);
    if (enviado) {
      await admin.from("whatsapp_mensagens_inbox").insert({
        conversa_id, terapeuta_id: conv.terapeuta_id,
        direcao: "saida", tipo: "texto", conteudo: personalizada,
        status: "enviada", metadata: { bot: true, fora_horario: !noHorario },
      });
    }

    return new Response(JSON.stringify({ ok: true, enviado, intencao }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[bot-reply] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
