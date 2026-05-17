// Agente broadcast — dispara campanha de mensagens em massa personalizadas pela IA
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { montarContextoClinico, buildSystemPrompt } from "../_shared/agente-contexto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function gerarMensagem(systemPrompt: string, intencao: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return intencao;
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Gere uma mensagem WhatsApp PERSONALIZADA para este paciente comunicando: "${intencao}". A mensagem deve ser curta (2-4 linhas), pessoal, e adaptada ao contexto clínico do paciente quando relevante. Não invente fatos. Apenas a mensagem final.` },
      ],
    }),
  });
  if (!r.ok) return intencao;
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() || intencao;
}

async function enviarWhatsapp(admin: any, terapeuta_id: string, phone: string, message: string) {
  const { data: cfg } = await admin.from("config_clinica")
    .select("zapi_instance_id, zapi_token, zapi_client_token")
    .eq("terapeuta_id", terapeuta_id).maybeSingle();
  if (!cfg?.zapi_instance_id || !cfg?.zapi_token) return false;
  const url = `https://api.z-api.io/instances/${cfg.zapi_instance_id}/token/${cfg.zapi_token}/send-text`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.zapi_client_token) headers["Client-Token"] = cfg.zapi_client_token;
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify({ phone, message }) });
  return r.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { broadcast_id } = await req.json();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: bc, error } = await admin.from("agente_broadcasts")
      .select("*").eq("id", broadcast_id).maybeSingle();
    if (error || !bc) throw new Error("broadcast não encontrado");
    if (bc.status === "executando" || bc.status === "concluido") {
      return new Response(JSON.stringify({ ok: false, error: "já em execução ou concluído" }), { headers: corsHeaders });
    }

    await admin.from("agente_broadcasts").update({
      status: "executando", iniciado_em: new Date().toISOString(),
      total: (bc.paciente_ids || []).length,
    }).eq("id", broadcast_id);

    // Resposta imediata; processa async (até timeout do edge runtime)
    (async () => {
      let enviados = 0, erros = 0;
      for (const paciente_id of bc.paciente_ids || []) {
        try {
          const { data: pac } = await admin.from("pacientes")
            .select("telefone").eq("id", paciente_id).maybeSingle();
          if (!pac?.telefone) { erros++; continue; }
          const ctxClinico = await montarContextoClinico(admin, bc.terapeuta_id, paciente_id, pac.telefone, null);
          const msg = await gerarMensagem(buildSystemPrompt(ctxClinico), bc.intencao);
          const ok = await enviarWhatsapp(admin, bc.terapeuta_id, pac.telefone, msg);
          await admin.from("agente_disparos").insert({
            terapeuta_id: bc.terapeuta_id, paciente_id, gatilho: "broadcast",
            ref_id: broadcast_id, conteudo: msg,
            status: ok ? "enviado" : "erro",
          });
          if (ok) enviados++; else erros++;
          await admin.from("agente_broadcasts").update({ enviados, erros }).eq("id", broadcast_id);
          await new Promise(r => setTimeout(r, 5000)); // 5s entre envios
        } catch (e: any) {
          erros++;
        }
      }
      await admin.from("agente_broadcasts").update({
        status: "concluido", concluido_em: new Date().toISOString(),
        enviados, erros,
      }).eq("id", broadcast_id);
    })();

    return new Response(JSON.stringify({ ok: true, total: (bc.paciente_ids || []).length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
