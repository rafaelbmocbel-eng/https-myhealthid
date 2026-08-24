// GUARDIÃO DE CUSTO/QUOTA DE IA. Uma vez por dia:
//  - Soma o gasto estimado de IA (ai_usage_log) das últimas 24h e 7 dias — pelo
//    banco, sem gastar nenhum crédito de IA.
//  - Faz UM ping barato (1 token) para saber o status dos créditos do Gemini.
//  - Alerta por e-mail ANTES de virar problema: se o gasto de 24h passar do teto
//    (AI_COST_ALERT_USD, padrão 2 USD) ou se os créditos estiverem esgotados/
//    rate-limited. Alerta só na transição (entrou em alerta / normalizou), como
//    os outros guardiões — sem spam diário.
//  - Grava resumo em audio_health_checks (component 'ia-uso') para o painel.
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
  } catch (e) { console.error("[monitor-ia-uso] alerta falhou:", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GEMINI = Deno.env.get("GEMINI_API_KEY");
  const TETO = Number(Deno.env.get("AI_COST_ALERT_USD") || "2") || 2;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const agora = Date.now();
  const desde24h = new Date(agora - 24 * 3600_000).toISOString();
  const desde7d = new Date(agora - 7 * 24 * 3600_000).toISOString();

  // ── Gasto pelas linhas do log (sem custo de IA) ──
  const somar = (rows: any[]) => (rows || []).reduce((s, r) => s + Number(r.est_cost_usd || 0), 0);
  const { data: rows24 } = await admin.from("ai_usage_log").select("function_name, est_cost_usd").gte("created_at", desde24h);
  const { data: rows7 } = await admin.from("ai_usage_log").select("est_cost_usd").gte("created_at", desde7d);
  const custo24 = somar(rows24 || []);
  const custo7 = somar(rows7 || []);
  const chamadas24 = (rows24 || []).length;

  // Top funções nas últimas 24h
  const porFn: Record<string, { n: number; usd: number }> = {};
  for (const r of rows24 || []) {
    const k = r.function_name || "?";
    porFn[k] = porFn[k] || { n: 0, usd: 0 };
    porFn[k].n++; porFn[k].usd += Number(r.est_cost_usd || 0);
  }
  const top = Object.entries(porFn).sort((a, b) => b[1].usd - a[1].usd).slice(0, 6);

  // ── Efetividade do cache (economia acumulada em chamadas evitadas) ──
  let cacheHits = 0, cacheLinhas = 0;
  try {
    const { data: cache } = await admin.from("ai_response_cache").select("hit_count");
    cacheLinhas = (cache || []).length;
    cacheHits = (cache || []).reduce((s: number, c: any) => s + Number(c.hit_count || 0), 0);
  } catch { /* tabela pode não existir em algum ambiente */ }

  // ── Ping barato de créditos (1 token) ──
  let creditos = "desconhecido";
  if (GEMINI) {
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GEMINI}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gemini-3.1-flash-lite", messages: [{ role: "user", content: "ping" }], max_tokens: 1 }),
      });
      if (r.ok) { creditos = "ativo"; try { await r.text(); } catch { /* drain */ } }
      else if (r.status === 402) creditos = "esgotado";
      else if (r.status === 429) creditos = "rate_limited";
      else if (r.status === 401 || r.status === 403) creditos = "chave_invalida";
      else creditos = `erro_${r.status}`;
    } catch (e) { creditos = "falha_conexao"; }
  } else {
    creditos = "sem_chave";
  }

  const creditosOk = creditos === "ativo";
  const dentroTeto = custo24 <= TETO;
  const ok = creditosOk && dentroTeto;
  const sample = `24h=$${custo24.toFixed(4)} (${chamadas24} cham.) · 7d=$${custo7.toFixed(4)} · créditos=${creditos} · teto=$${TETO}`;

  // Estado anterior (transição)
  const { data: anterior } = await admin.from("audio_health_checks")
    .select("ok").eq("component", "ia-uso").order("checked_at", { ascending: false }).limit(1).maybeSingle();
  const estadoAnterior: boolean | null = anterior ? anterior.ok : null;

  await admin.from("audio_health_checks").insert({
    component: "ia-uso", ok, http_status: null, latency_ms: null,
    error: ok ? null : (!creditosOk ? `créditos: ${creditos}` : `gasto 24h $${custo24.toFixed(2)} acima do teto $${TETO}`),
    sample,
  });

  const agoraBRT = new Date(agora - 3 * 3600_000).toISOString().replace("T", " ").slice(0, 16);
  const topHtml = top.map(([fn, v]) => `<tr><td style="padding:2px 10px 2px 0;color:#64748b">${fn}</td><td>${v.n}×</td><td>$${v.usd.toFixed(4)}</td></tr>`).join("");

  if (!ok && estadoAnterior !== false) {
    const motivo = !creditosOk
      ? `Créditos do Gemini: <b>${creditos}</b>.`
      : `Gasto estimado nas últimas 24h: <b>$${custo24.toFixed(2)}</b> — acima do teto de $${TETO}.`;
    await enviarAlerta("🟡 Custo/Quota de IA em alerta — My Health ID",
      `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;color:#0f172a">
        <h2 style="color:#b45309;margin:0 0 8px">Guardião de Custo de IA</h2>
        <p>${motivo} Detectado em <b>${agoraBRT} (BRT)</b>.</p>
        <p style="color:#64748b">7 dias: $${custo7.toFixed(2)} · ${chamadas24} chamadas em 24h · cache evitou ${cacheHits} chamadas.</p>
        <table style="border-collapse:collapse;margin:10px 0"><tr style="color:#94a3b8"><td>função</td><td>chamadas</td><td>custo</td></tr>${topHtml}</table>
        <p style="color:#64748b">Você recebe este e-mail uma vez por incidente. Ajuste o teto pela variável AI_COST_ALERT_USD.</p>
      </div>`);
  } else if (ok && estadoAnterior === false) {
    await enviarAlerta("✅ Custo/Quota de IA normalizado — My Health ID",
      `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;color:#0f172a">
        <h2 style="color:#15803d;margin:0 0 8px">Guardião de Custo de IA</h2>
        <p>Voltou ao normal em <b>${agoraBRT} (BRT)</b>. Créditos ${creditos}; gasto 24h $${custo24.toFixed(2)} (teto $${TETO}).</p>
      </div>`);
  }

  return new Response(JSON.stringify({
    ok, creditos, custo_24h_usd: custo24, custo_7d_usd: custo7, chamadas_24h: chamadas24,
    teto_usd: TETO, cache_hits: cacheHits, cache_linhas: cacheLinhas,
    top: top.map(([fn, v]) => ({ funcao: fn, chamadas: v.n, custo_usd: v.usd })),
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
