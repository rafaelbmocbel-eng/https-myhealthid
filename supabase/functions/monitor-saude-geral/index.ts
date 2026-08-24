// GUARDIÃO GERAL DE FUNÇÕES — evolução do Guardião de Áudio. Em vez de vigiar só
// o áudio, testa a cada 6h as DEPENDÊNCIAS CRÍTICAS COMPARTILHADAS de que quase
// todas as funções dependem, mais o fluxo real da voice-assessment:
//
//  - db              → banco acessível (leitura trivial)
//  - gemini-chat     → geração de texto (base de ~26 funções: planos, diretrizes,
//                      revisor de segurança, MyID insights, WhatsApp bot…)
//  - gemini-embed    → embeddings (busca de evidência / RAG: 5 funções)
//  - gemini-audio    → input_audio (avaliação por áudio + transcrição WhatsApp)
//  - voice-assessment→ a função inteira, ponta a ponta (via health-check bypass)
//  - resend          → chave de e-mail configurada (para os próprios alertas)
//
// Grava um resumo em `audio_health_checks` (component 'saude-geral') e o banner
// do painel lê a última linha. Alerta por e-mail na transição (caiu / voltou),
// listando quais componentes falharam. Rodar uma vez também serve de diagnóstico.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";

interface CheckResult { nome: string; ok: boolean; ms: number; erro: string | null; critico: boolean; }

// WAV 16kHz mono (~0,5s) sintetizado em memória — áudio válido para o input_audio.
function gerarWavBase64(): string {
  const sr = 8000, dur = 0.5, n = Math.floor(sr * dur), dataLen = n * 2;
  const buf = new ArrayBuffer(44 + dataLen), dv = new DataView(buf);
  const wr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, "RIFF"); dv.setUint32(4, 36 + dataLen, true); wr(8, "WAVE"); wr(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  wr(36, "data"); dv.setUint32(40, dataLen, true);
  for (let i = 0; i < n; i++) { const s = 0.3 * Math.sin(2 * Math.PI * 440 * i / sr); dv.setInt16(44 + i * 2, s * 32767, true); }
  const bytes = new Uint8Array(buf); let bin = ""; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(bin);
}

async function timed(nome: string, critico: boolean, fn: () => Promise<void>): Promise<CheckResult> {
  const t0 = Date.now();
  // Tenta 2x (retry após 2s) — evita alarme por blip transitório de API externa
  // (rate-limit/500 momentâneo do Gemini). Só declara falha se as duas tentativas caírem.
  let ultimoErro = "";
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try { await fn(); return { nome, ok: true, ms: Date.now() - t0, erro: null, critico }; }
    catch (e) {
      ultimoErro = (e as Error)?.message?.slice(0, 300) || String(e);
      if (tentativa === 0) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return { nome, ok: false, ms: Date.now() - t0, erro: ultimoErro, critico };
}

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
  } catch (e) { console.error("[monitor-geral] alerta falhou:", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GEMINI = Deno.env.get("GEMINI_API_KEY");
  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const geminiHeaders = { Authorization: `Bearer ${GEMINI}`, "Content-Type": "application/json" };
  const withTimeout = (ms: number) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };

  const checks: CheckResult[] = [];

  // 1. Banco
  checks.push(await timed("db", true, async () => {
    const { error } = await admin.from("planos").select("id").limit(1);
    if (error) throw new Error(error.message);
  }));

  // 2. Gemini chat (texto) — base de ~26 funções
  checks.push(await timed("gemini-chat", true, async () => {
    if (!GEMINI) throw new Error("GEMINI_API_KEY ausente");
    const r = await fetch(`${GEMINI_BASE}/chat/completions`, {
      method: "POST", signal: withTimeout(30_000), headers: geminiHeaders,
      body: JSON.stringify({ model: "gemini-2.5-flash", messages: [{ role: "user", content: "Responda apenas: OK" }], max_tokens: 4 }),
    });
    if (!r.ok) throw new Error(`chat ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const d = await r.json();
    if (!d?.choices?.[0]) throw new Error("chat 200 sem choices");
  }));

  // 3. Gemini embeddings — busca de evidência / RAG
  checks.push(await timed("gemini-embed", true, async () => {
    if (!GEMINI) throw new Error("GEMINI_API_KEY ausente");
    const r = await fetch(`${GEMINI_BASE}/embeddings`, {
      method: "POST", signal: withTimeout(30_000), headers: geminiHeaders,
      body: JSON.stringify({ model: "gemini-embedding-001", input: "teste de saúde", dimensions: 1536 }),
    });
    if (!r.ok) throw new Error(`embed ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const d = await r.json();
    if (!d?.data?.[0]?.embedding) throw new Error("embed 200 sem vetor");
  }));

  // 4. Gemini áudio (input_audio) — avaliação por áudio + WhatsApp transcribe
  checks.push(await timed("gemini-audio", true, async () => {
    if (!GEMINI) throw new Error("GEMINI_API_KEY ausente");
    const r = await fetch(`${GEMINI_BASE}/chat/completions`, {
      method: "POST", signal: withTimeout(45_000), headers: geminiHeaders,
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: [
          { type: "input_audio", input_audio: { data: gerarWavBase64(), format: "wav" } },
          { type: "text", text: "Transcreva." },
        ] }],
        max_tokens: 8,
      }),
    });
    if (!r.ok) throw new Error(`audio ${r.status}: ${(await r.text()).slice(0, 160)}`);
    const d = await r.json();
    if (!Array.isArray(d?.choices)) throw new Error("audio 200 sem choices");
  }));

  // 5. voice-assessment ponta a ponta — CARO (gera laudo completo). Roda 1×/dia
  //    (tick das 06h UTC do cron de 6h), OU sob demanda com body {"e2e":true}.
  //    Os outros 3 ticks já cobrem o caminho de áudio pelo probe 'gemini-audio'
  //    acima; este e2e valida a função inteira (fila de jobs, RAG, wiring).
  //    Tem componente e transição próprios ('voice-e2e') para não gerar um falso
  //    "normalizado" nos ticks em que não roda.
  let body: any = {};
  try { body = await req.clone().json(); } catch { /* sem corpo */ }
  const horaUtc = new Date().getUTCHours();
  const rodarE2e = CRON_SECRET && (body?.e2e === true || horaUtc === 6);
  if (rodarE2e) {
    const e2e = await timed("voice-e2e", true, async () => {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/voice-assessment`, {
        method: "POST", signal: withTimeout(110_000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, "x-healthcheck": CRON_SECRET! },
        body: JSON.stringify({ healthcheck: true, transcript: "Health-check: dor lombar mecânica há 3 meses.", perfilProfissional: "fisioterapeuta" }),
      });
      if (!r.ok) throw new Error(`voice-assessment ${r.status}: ${(await r.text()).slice(0, 160)}`);
      const d = await r.json();
      if (!d?.assessment) throw new Error("voice-assessment 200 sem assessment");
    });
    const { data: e2eAnt } = await admin.from("audio_health_checks")
      .select("ok").eq("component", "voice-e2e").order("checked_at", { ascending: false }).limit(1).maybeSingle();
    const e2eAntOk: boolean | null = e2eAnt ? e2eAnt.ok : null;
    await admin.from("audio_health_checks").insert({
      component: "voice-e2e", ok: e2e.ok, http_status: null, latency_ms: e2e.ms, error: e2e.erro, sample: `voice-e2e=${e2e.ok ? "ok" : "FALHOU"}(${e2e.ms}ms)`,
    });
    const agoraE2e = new Date(Date.now() - 3 * 3600_000).toISOString().replace("T", " ").slice(0, 16);
    if (!e2e.ok && e2eAntOk !== false) {
      await enviarAlerta("🔴 Avaliação por áudio (ponta a ponta) falhou — My Health ID",
        `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;color:#0f172a">
          <h2 style="color:#b91c1c;margin:0 0 8px">Guardião: voice-assessment ponta a ponta falhou</h2>
          <p>O teste diário da avaliação por áudio completa falhou em <b>${agoraE2e} (BRT)</b>.</p>
          <p style="color:#64748b">Erro: ${(e2e.erro || "").replace(/</g, "&lt;")}</p>
        </div>`);
    } else if (e2e.ok && e2eAntOk === false) {
      await enviarAlerta("✅ Avaliação por áudio (ponta a ponta) normalizada — My Health ID",
        `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;color:#0f172a">
          <h2 style="color:#15803d;margin:0 0 8px">Guardião: voice-assessment ponta a ponta OK</h2>
          <p>O teste diário da avaliação por áudio completa voltou a passar em <b>${agoraE2e} (BRT)</b>.</p>
        </div>`);
    }
  }

  // 6. Resend (config para os próprios alertas) — não-crítico
  checks.push(await timed("resend", false, async () => {
    if (!Deno.env.get("RESEND_API_KEY")) throw new Error("RESEND_API_KEY ausente (alertas por e-mail desligados)");
  }));

  const criticos = checks.filter((c) => c.critico);
  const overallOk = criticos.every((c) => c.ok);
  const falhas = checks.filter((c) => !c.ok);
  const resumoErro = falhas.length ? falhas.map((c) => `${c.nome}: ${c.erro}`).join(" | ") : null;
  const sample = checks.map((c) => `${c.nome}=${c.ok ? "ok" : "FALHOU"}(${c.ms}ms)`).join(", ");
  const latenciaTotal = checks.reduce((s, c) => s + c.ms, 0);

  // Estado anterior (transição) — última linha do resumo geral.
  const { data: anterior } = await admin.from("audio_health_checks")
    .select("ok").eq("component", "saude-geral").order("checked_at", { ascending: false }).limit(1).maybeSingle();
  const estadoAnterior: boolean | null = anterior ? anterior.ok : null;

  await admin.from("audio_health_checks").insert({
    component: "saude-geral", ok: overallOk, http_status: null, latency_ms: latenciaTotal, error: resumoErro, sample,
  });

  const agoraBRT = new Date(Date.now() - 3 * 3600_000).toISOString().replace("T", " ").slice(0, 16);
  if (!overallOk && estadoAnterior !== false) {
    const linhas = checks.map((c) => `<tr><td style="padding:2px 10px 2px 0;color:#64748b">${c.nome}</td><td>${c.ok ? "✅ OK" : "🔴 FALHOU"}</td><td style="color:#64748b">${(c.erro || "").replace(/</g, "&lt;")}</td></tr>`).join("");
    await enviarAlerta("🔴 Alguma função crítica caiu — My Health ID",
      `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;color:#0f172a">
        <h2 style="color:#b91c1c;margin:0 0 8px">Guardião: falha em dependência crítica</h2>
        <p>Uma ou mais dependências que sustentam as funções do app falharam em <b>${agoraBRT} (BRT)</b>. Funções afetadas podem incluir geração de planos por IA, avaliação por áudio, MyID e WhatsApp.</p>
        <table style="border-collapse:collapse;margin:10px 0">${linhas}</table>
        <p style="color:#64748b">Você recebe este e-mail uma vez por incidente. Um novo chega quando tudo normalizar.</p>
      </div>`);
  } else if (overallOk && estadoAnterior === false) {
    await enviarAlerta("✅ Tudo normalizado — My Health ID",
      `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;color:#0f172a">
        <h2 style="color:#15803d;margin:0 0 8px">Guardião: dependências normalizadas</h2>
        <p>Todas as dependências críticas voltaram a responder em <b>${agoraBRT} (BRT)</b>.</p>
      </div>`);
  }

  return new Response(JSON.stringify({
    ok: overallOk,
    checks: checks.map((c) => ({ nome: c.nome, ok: c.ok, ms: c.ms, critico: c.critico, erro: c.erro })),
    estado_anterior: estadoAnterior,
    resumo: overallOk ? "Todas as dependências críticas OK." : `Falha em: ${falhas.map((c) => c.nome).join(", ")}.`,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
