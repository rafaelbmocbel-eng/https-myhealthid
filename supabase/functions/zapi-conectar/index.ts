// Auto-provisionamento de WhatsApp (Z-API) por clínica.
// A clínica clica "Conectar WhatsApp": criamos a instância na Z-API, apontamos
// o webhook e devolvemos o QR Code para ela escanear — sem copiar credenciais.
//
// Secrets necessárias no projeto (uma vez só, pelo dono da plataforma):
//   ZAPI_CLIENT_TOKEN        -> Account Security Token / token de integrador Z-API
//   WHATSAPP_WEBHOOK_SECRET  -> segredo do webhook (já usado pelo whatsapp-webhook)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZAPI = "https://api.z-api.io";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
    if (!clientToken) {
      return json({ error: "ZAPI_CLIENT_TOKEN não configurado no projeto. Adicione o token de integrador da Z-API nas secrets." }, 400);
    }
    const webhookSecret = Deno.env.get("WHATSAPP_WEBHOOK_SECRET") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Autentica o terapeuta
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const authed = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { action } = await req.json().catch(() => ({ action: "provisionar" }));

    const zHeaders = { "Content-Type": "application/json", "Client-Token": clientToken };

    // Aponta o webhook de recebimento pro nosso endpoint, carimbando o
    // instanceId (e o secret, se houver) na URL. Chamado ao provisionar E ao
    // checar status, para auto-reparar conexões antigas sem reescanear o QR.
    const apontarWebhook = async (iid: string, tkn: string) => {
      const params = new URLSearchParams();
      params.set("instanceId", iid);
      if (webhookSecret) params.set("secret", webhookSecret);
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook?${params.toString()}`;
      await fetch(`${ZAPI}/instances/${iid}/token/${tkn}/update-webhook-received`, {
        method: "PUT", headers: zHeaders, body: JSON.stringify({ value: webhookUrl }),
      }).catch(() => { /* best-effort */ });
    };

    // Credenciais já existentes desta clínica (se houver)
    const { data: cfg } = await admin
      .from("config_clinica")
      .select("zapi_instance_id, zapi_token")
      .eq("terapeuta_id", user.id)
      .maybeSingle();
    let instanceId = cfg?.zapi_instance_id || null;
    let token = cfg?.zapi_token || null;

    // ── PROVISIONAR: cria a instância (se ainda não existe) e aponta o webhook ──
    if (action === "provisionar") {
      if (!instanceId || !token) {
        const r = await fetch(`${ZAPI}/instances/integrator/on-demand`, {
          method: "POST",
          headers: zHeaders,
          body: JSON.stringify({ name: `clinica-${user.id.slice(0, 8)}` }),
        });
        const txt = await r.text();
        let parsed: any = {};
        try { parsed = JSON.parse(txt); } catch { /* não-JSON */ }
        if (!r.ok || !(parsed.id && parsed.token)) {
          return json({ error: `Falha ao criar instância na Z-API: ${parsed.error || txt.slice(0, 200)}` }, 502);
        }
        instanceId = parsed.id;
        token = parsed.token;

        await admin.from("config_clinica").upsert({
          terapeuta_id: user.id,
          zapi_instance_id: instanceId,
          zapi_token: token,
          zapi_client_token: clientToken,
          zapi_ativo: true,
        }, { onConflict: "terapeuta_id" });
      }

      // Aponta o webhook de recebimento para o nosso endpoint
      await apontarWebhook(instanceId, token);

      return json({ ok: true, instanceId });
    }

    // Precisa de instância para as próximas ações
    if (!instanceId || !token) {
      return json({ error: "Instância ainda não provisionada. Clique em Conectar primeiro." }, 400);
    }

    // ── QRCODE: devolve a imagem base64 para exibir no app ──
    if (action === "qrcode") {
      const r = await fetch(`${ZAPI}/instances/${instanceId}/token/${token}/qr-code/image`, { headers: zHeaders });
      const txt = await r.text();
      let parsed: any = {};
      try { parsed = JSON.parse(txt); } catch { /* pode vir texto puro base64 */ }
      const value = parsed.value || (txt.startsWith("data:image") ? txt : null);
      if (!value) {
        // Se já conectou, a Z-API não retorna QR
        return json({ qr: null, connected: parsed.connected === true, raw: txt.slice(0, 200) });
      }
      return json({ qr: value.startsWith("data:") ? value : `data:image/png;base64,${value}` });
    }

    // ── STATUS: conectado? (para o app parar de mostrar o QR) ──
    if (action === "status") {
      // Auto-reparo: re-aponta o webhook (com instanceId na URL) sempre que o
      // app checa o status — conserta conexões antigas sem reescanear o QR.
      await apontarWebhook(instanceId, token);
      const r = await fetch(`${ZAPI}/instances/${instanceId}/token/${token}/status`, { headers: zHeaders });
      const parsed = await r.json().catch(() => ({}));
      const connected = parsed.connected === true || parsed.smartphoneConnected === true;
      return json({ connected, status: parsed });
    }

    return json({ error: "ação inválida" }, 400);
  } catch (err) {
    console.error("[zapi-conectar]", err);
    return json({ error: err instanceof Error ? err.message : "erro interno" }, 500);
  }
});
