// Expiração automática do Wellness Premium (cron diário). Assinatura vencida
// há mais de 3 dias (carência) é cancelada e a conta volta a wellness_free.
// Não envia nenhuma mensagem — só corrige o estado da conta.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireInternal } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try { requireInternal(req); } catch (r) { return r as Response; }
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const limite = new Date(Date.now() - 3 * 86400000).toISOString();
    const { data: vencidas } = await admin.from("wellness_assinaturas")
      .select("id, paciente_id, proxima_cobranca")
      .eq("status", "ativa")
      .not("proxima_cobranca", "is", null)
      .lt("proxima_cobranca", limite);

    let expiradas = 0;
    for (const a of vencidas || []) {
      await admin.from("wellness_assinaturas").update({
        status: "cancelada", data_fim: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("id", a.id);
      // Rebaixa SÓ contas wellness_premium — nunca mexe em paciente clínico
      await admin.from("pacientes").update({ tipo_conta: "wellness_free" })
        .eq("id", a.paciente_id).eq("tipo_conta", "wellness_premium");
      expiradas++;
    }

    return new Response(JSON.stringify({ ok: true, expiradas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
