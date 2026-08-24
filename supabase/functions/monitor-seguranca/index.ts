// GUARDIÃO DE SEGURANÇA & DADOS (LGPD) — roda diariamente e verifica o que mais
// importa num app clínico: nenhuma tabela de dados pode estar SEM RLS (o que
// exporia dados de paciente). Usa a função auditoria_seguranca() (SECURITY
// DEFINER, só service_role) para ler o catálogo do Postgres com segurança.
//
// Grava um resumo em `audio_health_checks` (component 'seguranca-dados') e
// alerta o dono por e-mail na transição (surgiu risco / normalizou).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function enviarAlerta(assunto: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("AUDIO_ALERT_EMAIL") || "rafaelbmocbel@gmail.com";
  if (!key) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Guardião My Health ID <noreply@myhealthid.com.br>", to: [to], subject: assunto, html }),
    });
  } catch (e) { console.error("[monitor-seguranca] alerta falhou:", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let semRls: string[] = [], semPolicy: string[] = [], erroExec: string | null = null;
  try {
    const { data, error } = await admin.rpc("auditoria_seguranca");
    if (error) throw error;
    semRls = Array.isArray((data as any)?.tabelas_sem_rls) ? (data as any).tabelas_sem_rls : [];
    semPolicy = Array.isArray((data as any)?.tabelas_rls_sem_policy) ? (data as any).tabelas_rls_sem_policy : [];
  } catch (e) {
    erroExec = (e as Error)?.message || String(e);
  }

  // Crítico = qualquer tabela SEM RLS (dados potencialmente expostos).
  const ok = !erroExec && semRls.length === 0;
  const resumoErro = erroExec
    ? `Falha ao auditar: ${erroExec}`
    : (semRls.length ? `${semRls.length} tabela(s) SEM RLS: ${semRls.join(", ")}` : null);
  const sample = `sem_rls=${semRls.length}, rls_sem_policy=${semPolicy.length}`;

  // Estado anterior (transição) — última linha do componente de segurança.
  const { data: anterior } = await admin.from("audio_health_checks")
    .select("ok").eq("component", "seguranca-dados").order("checked_at", { ascending: false }).limit(1).maybeSingle();
  const estadoAnterior: boolean | null = anterior ? anterior.ok : null;

  await admin.from("audio_health_checks").insert({
    component: "seguranca-dados", ok, http_status: null, latency_ms: null,
    error: resumoErro, sample,
  });

  const agoraBRT = new Date(Date.now() - 3 * 3600_000).toISOString().replace("T", " ").slice(0, 16);
  if (!ok && estadoAnterior !== false) {
    const li = (arr: string[]) => arr.length ? `<ul>${arr.map((t) => `<li><code>${t.replace(/</g, "&lt;")}</code></li>`).join("")}</ul>` : "<p>—</p>";
    await enviarAlerta("🔴 Risco de segurança de dados — My Health ID",
      `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;color:#0f172a">
        <h2 style="color:#b91c1c;margin:0 0 8px">Guardião de Segurança: atenção</h2>
        <p>Verificação de ${agoraBRT} (BRT) encontrou risco na proteção de dados.</p>
        ${erroExec ? `<p style="color:#b91c1c">Erro ao auditar: <code>${erroExec.replace(/</g, "&lt;")}</code></p>` : ""}
        <p><b>Tabelas SEM RLS (dados podem estar expostos):</b></p>
        ${li(semRls)}
        <p style="color:#64748b"><b>RLS sem policy (revisar):</b></p>
        ${li(semPolicy)}
        <p style="color:#64748b">Você recebe este e-mail uma vez por incidente. Um novo chega quando normalizar.</p>
      </div>`);
  } else if (ok && estadoAnterior === false) {
    await enviarAlerta("✅ Segurança de dados normalizada — My Health ID",
      `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;color:#0f172a">
        <h2 style="color:#15803d;margin:0 0 8px">Guardião de Segurança: tudo certo</h2>
        <p>Nenhuma tabela sem RLS em ${agoraBRT} (BRT). Proteção de dados OK.</p>
      </div>`);
  }

  return new Response(JSON.stringify({
    ok,
    tabelas_sem_rls: semRls,
    tabelas_rls_sem_policy: semPolicy,
    estado_anterior: estadoAnterior,
    resumo: erroExec ? `Falha ao auditar: ${erroExec}` : (ok ? "Nenhuma tabela sem RLS — proteção de dados OK." : `${semRls.length} tabela(s) SEM RLS.`),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
