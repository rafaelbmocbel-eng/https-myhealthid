// Primeira senha pelo LINK do portal. Caso típico: o cliente entrou antes com
// Google (conta sem senha) e, ao tentar "Cadastrar" pelo link, recebia
// "e-mail já cadastrado" sem conseguir criar a senha — e o e-mail de
// redefinição do Supabase nem sempre chega.
// Regras de segurança: só para a conta JÁ vinculada à ficha deste link, com o
// mesmo e-mail, e só se a conta ainda NÃO tem senha. Trocar uma senha que já
// existe continua exigindo login ou o e-mail de redefinição.
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
    const token = (body?.token || "").toString().trim();
    const email = (body?.email || "").toString().trim().toLowerCase();
    const password = (body?.password || "").toString();

    if (!token) return json({ ok: false, code: "sem_token" });
    if (!email.includes("@")) return json({ ok: false, code: "invalid_email" });
    if (password.length < 8) return json({ ok: false, code: "weak_password" });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: pac } = await admin
      .from("pacientes")
      .select("id, user_id")
      .eq("portal_token", token)
      .maybeSingle();
    if (!pac?.user_id) return json({ ok: false, code: "nao_vinculado" });

    const { data: u, error: errUser } = await admin.auth.admin.getUserById(pac.user_id);
    if (errUser || !u?.user) return json({ ok: false, code: "nao_vinculado" });
    // Mesma resposta para e-mail diferente: não revela qual e-mail está na ficha.
    if ((u.user.email || "").toLowerCase() !== email) return json({ ok: false, code: "nao_vinculado" });

    // Contas só-Google não têm identidade "email"; a marca em app_metadata impede
    // que o link seja usado de novo para trocar a senha recém-criada.
    const temSenha = (u.user.identities || []).some((i: any) => i.provider === "email")
      || u.user.app_metadata?.senha_definida === true;
    if (temSenha) return json({ ok: false, code: "ja_tem_senha" });

    const { error: errUpd } = await admin.auth.admin.updateUserById(pac.user_id, {
      password,
      app_metadata: { ...(u.user.app_metadata || {}), senha_definida: true },
    });
    if (errUpd) {
      const msg = (errUpd.message || "").toLowerCase();
      if (msg.includes("password")) return json({ ok: false, code: "weak_password", error: errUpd.message });
      throw errUpd;
    }
    return json({ ok: true });
  } catch (e: any) {
    return json({ ok: false, error: e?.message || String(e) }, 500);
  }
});
