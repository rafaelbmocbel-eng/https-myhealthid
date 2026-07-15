// Ativação AUTOMÁTICA do Wellness Premium: o app chama esta função quando o
// cliente volta do checkout SumUp. Ela confirma o pagamento direto na API do
// SumUp (nunca confia no navegador), ativa/renova a assinatura por 31 dias e
// promove a conta para wellness_premium. Idempotente por checkout_id.
import { requireUser } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MS_31D = 31 * 86400000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let userId: string;
    try { ({ userId } = await requireUser(req)); } catch (r) { return r as Response; }
    const { checkout_id } = await req.json();
    if (!checkout_id) {
      return new Response(JSON.stringify({ error: "checkout_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const SUMUP_API_KEY = Deno.env.get("SUMUP_API_KEY");
    if (!SUMUP_API_KEY) throw new Error("SUMUP_API_KEY not configured");

    // Confirma o pagamento NA FONTE
    const ckRes = await fetch(`https://api.sumup.com/v0.1/checkouts/${encodeURIComponent(checkout_id)}`, {
      headers: { Authorization: `Bearer ${SUMUP_API_KEY}` },
    });
    if (!ckRes.ok) throw new Error(`SumUp: ${ckRes.status}`);
    const ck = await ckRes.json();

    // O checkout precisa ser DESTE usuário (a referência carrega o user id)
    const ref = String(ck.checkout_reference || "");
    if (!ref.includes(userId)) {
      return new Response(JSON.stringify({ error: "Pagamento não pertence a esta conta" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (ck.status !== "PAID") {
      return new Response(JSON.stringify({ ok: false, status: ck.status || "PENDENTE" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (Number(ck.amount) < 49) {
      return new Response(JSON.stringify({ error: "Valor pago menor que o plano" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: pac } = await admin.from("pacientes")
      .select("id, tipo_conta").eq("user_id", userId).maybeSingle();
    if (!pac) {
      return new Response(JSON.stringify({ error: "Cadastro de paciente não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotência: este checkout já ativou?
    const { data: jaUsado } = await admin.from("wellness_assinaturas")
      .select("id, proxima_cobranca").eq("provider_subscription_id", checkout_id).maybeSingle();
    if (jaUsado) {
      return new Response(JSON.stringify({ ok: true, ja_ativado: true, premium_ate: jaUsado.proxima_cobranca }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Renovação estende a partir do vencimento atual (pagar antes não perde dias)
    const { data: ativa } = await admin.from("wellness_assinaturas")
      .select("id, proxima_cobranca").eq("paciente_id", pac.id).eq("status", "ativa")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    const base = ativa?.proxima_cobranca ? Math.max(Date.now(), new Date(ativa.proxima_cobranca).getTime()) : Date.now();
    const premiumAte = new Date(base + MS_31D).toISOString();

    if (ativa) {
      const { error } = await admin.from("wellness_assinaturas").update({
        proxima_cobranca: premiumAte,
        provider: "sumup",
        provider_subscription_id: checkout_id,
        updated_at: new Date().toISOString(),
      }).eq("id", ativa.id);
      if (error) throw error;
    } else {
      const { error } = await admin.from("wellness_assinaturas").insert({
        paciente_id: pac.id, status: "ativa", provider: "sumup",
        provider_subscription_id: checkout_id, valor_mensal: 49,
        data_inicio: new Date().toISOString(), proxima_cobranca: premiumAte,
      });
      if (error) throw error;
    }
    await admin.from("pacientes").update({ tipo_conta: "wellness_premium" }).eq("id", pac.id);

    return new Response(JSON.stringify({ ok: true, premium_ate: premiumAte }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
