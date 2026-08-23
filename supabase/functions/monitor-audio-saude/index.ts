// GUARDIÃO DE ÁUDIO — health-check do motor de transcrição (Gemini) do qual
// dependem TODAS as funções de áudio do app (voice-assessment / avaliação
// presencial por áudio, whatsapp-transcribe, etc.). Roda a cada 6h por cron.
//
// O que faz:
//  1. Sintetiza um pequeno áudio WAV válido em memória (sem depender de arquivo).
//  2. Manda pro MESMO endpoint/parâmetros que a avaliação presencial usa
//     (Gemini OpenAI-compat, input_audio) e mede status/latência/erro.
//  3. Grava o resultado em `audio_health_checks`.
//  4. Se o pipeline QUEBROU (transição ok→falha) ou VOLTOU (falha→ok), avisa
//     o dono por e-mail (Resend). O banner no painel do profissional lê a
//     última linha da tabela.
//
// Rodar UMA vez já serve de diagnóstico: a resposta traz o status/erro real
// que o Gemini devolve agora — é assim que se descobre por que a avaliação
// por áudio parou.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Sintetiza um WAV PCM mono 8kHz (~0,7s), dois tons curtos. É um áudio
// válido e não-silencioso — suficiente para exercitar o caminho input_audio
// do Gemini (aceitação de formato, chave, quota, modelo). Não precisa ser
// fala real: o que quebra o pipeline (400 formato / 401 chave / 429 quota /
// 5xx) falha independentemente do conteúdo.
function gerarWavBase64(): string {
  const sr = 8000, dur = 0.7;
  const n = Math.floor(sr * dur);
  const dataLen = n * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const dv = new DataView(buf);
  const wr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  wr(0, "RIFF"); dv.setUint32(4, 36 + dataLen, true); wr(8, "WAVE");
  wr(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  wr(36, "data"); dv.setUint32(40, dataLen, true);
  for (let i = 0; i < n; i++) {
    const f = i < n / 2 ? 350 : 520;
    const s = Math.max(-1, Math.min(1, 0.35 * Math.sin((2 * Math.PI * f * i) / sr)));
    dv.setInt16(44 + i * 2, s * 32767, true);
  }
  // base64 em chunks (evita estouro de call-stack)
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(bin);
}

async function enviarAlertaEmail(assunto: string, htmlCorpo: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const destino = Deno.env.get("AUDIO_ALERT_EMAIL") || "rafaelbmocbel@gmail.com";
  if (!resendKey) { console.log("[monitor-audio] Sem RESEND_API_KEY; alerta não enviado."); return; }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Guardião de Áudio <noreply@metodoidentidade.app>",
        to: [destino],
        subject: assunto,
        html: htmlCorpo,
      }),
    });
    if (!r.ok) console.error("[monitor-audio] Resend falhou:", await r.text().catch(() => ""));
  } catch (e) {
    console.error("[monitor-audio] Erro ao enviar alerta:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const inicio = Date.now();

  let ok = false, httpStatus = 0, erro: string | null = null, amostra: string | null = null;

  if (!GEMINI_API_KEY) {
    erro = "GEMINI_API_KEY não configurada no ambiente da função.";
  } else {
    try {
      const audioB64 = gerarWavBase64();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 60_000);
      // Mesma chamada da PASS 1 da voice-assessment (input_audio, gemini-2.5-flash).
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: "Você é um transcritor. Transcreva o áudio em PT-BR. Se não houver fala, responda apenas 'OK'." },
            {
              role: "user",
              content: [
                { type: "input_audio", input_audio: { data: audioB64, format: "wav" } },
                { type: "text", text: "Transcreva o áudio." },
              ],
            },
          ],
        }),
      });
      clearTimeout(timer);
      httpStatus = res.status;
      if (res.ok) {
        const data = await res.json().catch(() => null);
        const txt = data?.choices?.[0]?.message?.content;
        // Sucesso = endpoint aceitou o áudio e respondeu no formato esperado.
        // Conteúdo vazio para um áudio de tom é aceitável (não há fala).
        if (data && Array.isArray(data.choices)) {
          ok = true;
          amostra = typeof txt === "string" ? txt.slice(0, 200) : "(sem texto — esperado para tom)";
        } else {
          erro = "Resposta 200 mas sem 'choices' — formato inesperado do Gemini.";
        }
      } else {
        const body = await res.text().catch(() => "");
        erro = `Gemini ${res.status}: ${body.slice(0, 300)}`;
      }
    } catch (e) {
      erro = `Exceção: ${(e as Error)?.message || String(e)}`;
    }
  }

  const latencia = Date.now() - inicio;

  // Estado anterior (para detectar transição e evitar spam de alerta).
  const { data: anterior } = await admin
    .from("audio_health_checks")
    .select("ok")
    .order("checked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const estadoAnterior: boolean | null = anterior ? anterior.ok : null;

  // Grava o resultado deste check.
  await admin.from("audio_health_checks").insert({
    component: "gemini-audio",
    ok, http_status: httpStatus || null, latency_ms: latencia, error: erro, sample: amostra,
  });

  // Alertas por transição.
  const agoraBRT = new Date(Date.now() - 3 * 3600_000).toISOString().replace("T", " ").slice(0, 16);
  if (!ok && estadoAnterior !== false) {
    // caiu agora (antes estava ok, ou é o primeiro check e já falhou)
    await enviarAlertaEmail(
      "🔴 Áudio fora do ar — avaliação por áudio pode não funcionar",
      `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;color:#0f172a">
        <h2 style="color:#b91c1c;margin:0 0 8px">Pipeline de áudio falhou</h2>
        <p>O health-check do motor de transcrição (Gemini) <b>falhou</b>. Funções que dependem de áudio — incluindo a <b>avaliação presencial por áudio</b> e a transcrição de WhatsApp — podem estar fora do ar.</p>
        <table style="border-collapse:collapse;margin:10px 0">
          <tr><td style="padding:2px 10px 2px 0;color:#64748b">Quando</td><td><b>${agoraBRT} (BRT)</b></td></tr>
          <tr><td style="padding:2px 10px 2px 0;color:#64748b">HTTP</td><td>${httpStatus || "—"}</td></tr>
          <tr><td style="padding:2px 10px 2px 0;color:#64748b">Erro</td><td><code>${(erro || "").replace(/</g, "&lt;")}</code></td></tr>
          <tr><td style="padding:2px 10px 2px 0;color:#64748b">Latência</td><td>${latencia} ms</td></tr>
        </table>
        <p style="color:#64748b">Você recebe este e-mail uma vez por incidente (não a cada verificação). Um novo e-mail chega quando o serviço voltar.</p>
      </div>`,
    );
  } else if (ok && estadoAnterior === false) {
    // voltou ao normal
    await enviarAlertaEmail(
      "✅ Áudio normalizado — transcrição voltou a funcionar",
      `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;color:#0f172a">
        <h2 style="color:#15803d;margin:0 0 8px">Pipeline de áudio recuperado</h2>
        <p>O motor de transcrição voltou a responder normalmente em <b>${agoraBRT} (BRT)</b> (latência ${latencia} ms).</p>
      </div>`,
    );
  }

  return new Response(JSON.stringify({
    ok,
    http_status: httpStatus || null,
    latency_ms: latencia,
    error: erro,
    sample: amostra,
    estado_anterior: estadoAnterior,
    diagnostico: ok
      ? "Motor de áudio OK — endpoint aceitou o áudio e respondeu."
      : "Motor de áudio FALHOU — veja 'error' para a causa real (400=formato/endpoint, 401/403=chave, 429=quota, 5xx=Google).",
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
