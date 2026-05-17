// Confirmação automática 24h antes da sessão — invocado via cron
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
  if (!cfg?.zapi_instance_id || !cfg?.zapi_token) return false;
  const baseUrl = `https://api.z-api.io/instances/${cfg.zapi_instance_id}/token/${cfg.zapi_token}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.zapi_client_token) headers["Client-Token"] = cfg.zapi_client_token;
  const r = await fetch(`${baseUrl}/send-text`, {
    method: "POST", headers,
    body: JSON.stringify({ phone: phone.replace(/\D/g, ""), message }),
  });
  return r.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Janela alvo: agendamentos entre 23h e 25h a partir de agora
    const start = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
    const end = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();

    const { data: ags } = await admin
      .from("agendamentos")
      .select("id, terapeuta_id, paciente_id, data_inicio, confirmacao_enviada_em, status")
      .gte("data_inicio", start)
      .lte("data_inicio", end)
      .in("status", ["confirmado", "agendado"])
      .is("confirmacao_enviada_em", null);

    let enviados = 0;
    for (const ag of ags || []) {
      const { data: cfg } = await admin
        .from("whatsapp_automacoes")
        .select("auto_confirmacao_24h, mensagem_confirmacao")
        .eq("terapeuta_id", ag.terapeuta_id).maybeSingle();
      if (!cfg?.auto_confirmacao_24h) continue;

      const { data: pac } = await admin
        .from("pacientes")
        .select("nome, telefone")
        .eq("id", ag.paciente_id).maybeSingle();
      if (!pac?.telefone) continue;

      const dt = new Date(ag.data_inicio);
      const hora = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
      const msg = (cfg.mensagem_confirmacao || "Confirme sua sessão amanhã às {horario}")
        .replace("{nome}", pac.nome?.split(" ")[0] || "")
        .replace("{horario}", hora);

      const ok = await enviarWhatsapp(admin, ag.terapeuta_id, pac.telefone, msg);
      if (ok) {
        await admin.from("agendamentos").update({
          confirmacao_enviada_em: new Date().toISOString(),
        }).eq("id", ag.id);
        enviados++;
      }
    }

    return new Response(JSON.stringify({ ok: true, processados: ags?.length || 0, enviados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[auto-confirm] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
