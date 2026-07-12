// Diagnóstico do WhatsApp por clínica. Reúne, num único lugar, o que precisamos
// para saber por que mensagens recebidas (ou não) aparecem no Zap:
//  - config da clínica (instância/provedor);
//  - status de conexão na Z-API;
//  - webhooks registrados na Z-API (a URL de recebimento aponta pra nós?);
//  - contagem real de mensagens de ENTRADA/SAÍDA e conversas no banco.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ZAPI = "https://api.z-api.io";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const authed = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Config da clínica ──
    const { data: cfg } = await admin.from("config_clinica")
      .select("zapi_instance_id, zapi_token, zapi_client_token, whatsapp_provider, evolution_base_url, evolution_instance")
      .eq("terapeuta_id", user.id).maybeSingle();
    const provider = (cfg?.whatsapp_provider || "zapi").toLowerCase();
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || cfg?.zapi_client_token || "";

    // ── Contagens reais no banco ──
    const [conversasCnt, entradaCnt, saidaCnt, ultimaEntrada, semSecret] = await Promise.all([
      admin.from("whatsapp_conversas").select("id", { count: "exact", head: true }).eq("terapeuta_id", user.id).eq("arquivada", false),
      admin.from("whatsapp_mensagens_inbox").select("id", { count: "exact", head: true }).eq("terapeuta_id", user.id).eq("direcao", "entrada"),
      admin.from("whatsapp_mensagens_inbox").select("id", { count: "exact", head: true }).eq("terapeuta_id", user.id).eq("direcao", "saida"),
      admin.from("whatsapp_mensagens_inbox").select("created_at").eq("terapeuta_id", user.id).eq("direcao", "entrada").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      Promise.resolve(!Deno.env.get("WHATSAPP_WEBHOOK_SECRET")),
    ]);

    const db = {
      conversas_ativas: conversasCnt.count ?? 0,
      mensagens_entrada: entradaCnt.count ?? 0,   // respostas de clientes recebidas
      mensagens_saida: saidaCnt.count ?? 0,       // que a clínica enviou
      ultima_entrada_em: (ultimaEntrada.data as { created_at?: string } | null)?.created_at ?? null,
      webhook_secret_configurado: !semSecret,
    };

    // ── Z-API: status + webhooks registrados ──
    let zapi: Record<string, unknown> = { configurada: false };
    if (provider === "zapi" && cfg?.zapi_instance_id && cfg?.zapi_token && clientToken) {
      const zHeaders = { "Content-Type": "application/json", "Client-Token": clientToken };
      const base = `${ZAPI}/instances/${cfg.zapi_instance_id}/token/${cfg.zapi_token}`;
      const [stRes, whRes] = await Promise.all([
        fetch(`${base}/status`, { headers: zHeaders }).then(r => r.json()).catch((e) => ({ erro: String(e) })),
        fetch(`${base}/webhooks`, { headers: zHeaders }).then(r => r.json()).catch((e) => ({ erro: String(e) })),
      ]);
      const webhooksTxt = JSON.stringify(whRes);
      zapi = {
        configurada: true,
        instancia: cfg.zapi_instance_id,
        conectada: (stRes as any)?.connected === true || (stRes as any)?.smartphoneConnected === true,
        status_bruto: stRes,
        webhook_recebimento_aponta_pra_nos: webhooksTxt.includes("whatsapp-webhook"),
        webhooks_bruto: whRes,
      };
    } else if (provider === "evolution") {
      zapi = { configurada: true, provider: "evolution", instancia: cfg?.evolution_instance, base: cfg?.evolution_base_url, nota: "Diagnóstico Z-API não se aplica ao Evolution." };
    }

    // ── Veredito ──
    const problemas: string[] = [];
    if (!cfg?.zapi_instance_id && provider === "zapi") problemas.push("Clínica sem instância Z-API — conecte o WhatsApp.");
    if (provider === "zapi" && zapi.configurada && !zapi.conectada) problemas.push("WhatsApp NÃO está conectado na Z-API (reescaneie o QR).");
    if (provider === "zapi" && zapi.configurada && zapi.webhook_recebimento_aponta_pra_nos === false) problemas.push("O webhook de RECEBIMENTO não aponta pro app — clique em Reconectar.");
    if (db.mensagens_entrada === 0) problemas.push("ZERO mensagens de entrada no banco — a Z-API não está entregando as respostas ao webhook (webhook/instância).");

    return json({ ok: true, provider, db, zapi, problemas });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "erro interno" }, 500);
  }
});
