// Processa execuções pendentes de cadências CRM — invocado via cron a cada 15min
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireInternal } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function enviarWhatsapp(supa: any, terapeuta_id: string, phone: string, message: string) {
  const { data: cfg } = await supa
    .from("config_clinica")
    .select("zapi_instance_id, zapi_token, zapi_client_token")
    .eq("terapeuta_id", terapeuta_id)
    .maybeSingle();
  if (!cfg?.zapi_instance_id || !cfg?.zapi_token) return { ok: false, err: "zapi_nao_configurado" };
  const baseUrl = `https://api.z-api.io/instances/${cfg.zapi_instance_id}/token/${cfg.zapi_token}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.zapi_client_token) headers["Client-Token"] = cfg.zapi_client_token;
  const r = await fetch(`${baseUrl}/send-text`, {
    method: "POST", headers,
    body: JSON.stringify({ phone: phone.replace(/\D/g, ""), message }),
  });
  return { ok: r.ok, err: r.ok ? null : await r.text() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try { requireInternal(req); } catch (r) { return r as Response; }
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: pendentes } = await admin
      .from("crm_cadencia_execucoes")
      .select("id, conversa_id, passo_id, terapeuta_id, cadencia_id")
      .eq("status", "pendente")
      .lte("agendado_para", new Date().toISOString())
      .limit(100);

    let enviados = 0, falhas = 0, skipados = 0;

    for (const exec of pendentes || []) {
      // Skip se conversa teve resposta humana após o agendamento da execução
      const { data: conv } = await admin
        .from("whatsapp_conversas")
        .select("telefone, pipeline_stage, ultima_direcao, ultima_mensagem_em, nome_contato, arquivada")
        .eq("id", exec.conversa_id).maybeSingle();

      if (!conv || conv.arquivada) {
        await admin.from("crm_cadencia_execucoes").update({ status: "cancelado", erro: "conversa_inativa" }).eq("id", exec.id);
        skipados++; continue;
      }

      // Se paciente respondeu, pausa cadência (avança o lead pro humano)
      if (conv.ultima_direcao === "entrada") {
        await admin.from("crm_cadencia_execucoes").update({ status: "pausado", erro: "paciente_respondeu" }).eq("id", exec.id);
        skipados++; continue;
      }

      const { data: passo } = await admin
        .from("crm_cadencia_passos")
        .select("mensagem, ordem")
        .eq("id", exec.passo_id).maybeSingle();
      if (!passo) { skipados++; continue; }

      const primeiroNome = conv.nome_contato?.split(" ")[0] || "";
      const msg = passo.mensagem.replace(/\{nome\}/g, primeiroNome);

      const res = await enviarWhatsapp(admin, exec.terapeuta_id, conv.telefone, msg);
      if (res.ok) {
        await admin.from("crm_cadencia_execucoes").update({
          status: "enviado", enviado_em: new Date().toISOString(),
        }).eq("id", exec.id);
        // Registra mensagem na thread
        await admin.from("whatsapp_mensagens_inbox").insert({
          conversa_id: exec.conversa_id,
          terapeuta_id: exec.terapeuta_id,
          direcao: "saida",
          conteudo: msg,
          tipo: "texto",
          status: "enviada",
          metadata: { origem: "cadencia", cadencia_id: exec.cadencia_id, passo_ordem: passo.ordem },
        });
        enviados++;
      } else {
        await admin.from("crm_cadencia_execucoes").update({
          status: "falha", erro: String(res.err).slice(0, 500),
        }).eq("id", exec.id);
        falhas++;
      }
    }

    return new Response(JSON.stringify({ ok: true, total: pendentes?.length || 0, enviados, falhas, skipados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[cadencia-runner] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
