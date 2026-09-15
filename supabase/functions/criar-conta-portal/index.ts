// Cria a conta do PORTAL DO CLIENTE já CONFIRMADA (sem enviar e-mail de
// confirmação). Motivo: o envio de e-mail do Supabase estava falhando
// ("Error sending confirmation email") e travava o cliente na criação da senha.
// O vínculo do paciente é pelo LINK/token (ou e-mail), não pela confirmação —
// então confirmamos direto e o cliente entra na hora.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body?.email || "").toString().trim().toLowerCase();
    const password = (body?.password || "").toString();
    const nome = (body?.nome || "").toString().trim();

    if (!email || !email.includes("@")) return json({ error: "E-mail inválido.", code: "invalid_email" }, 400);
    if (password.length < 8) return json({ error: "A senha precisa de ao menos 8 caracteres.", code: "weak_password" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // já confirma — NÃO envia e-mail de confirmação
      user_metadata: { nome, is_patient: true },
    });

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists") || msg.includes("duplicate")) {
        return json({ error: "E-mail já cadastrado.", code: "email_exists" }, 409);
      }
      if (msg.includes("password")) return json({ error: error.message, code: "weak_password" }, 400);
      throw error;
    }

    return json({ ok: true, user_id: data.user?.id ?? null });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});
