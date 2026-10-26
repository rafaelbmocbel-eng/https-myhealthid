// Transcreve ditados curtos (botão "Ditar por voz" do MyID, da História do
// paciente e das condutas do profissional). Mesmo motor da avaliação por voz:
// Whisper no Groq (aceita webm do Android e mp4/AAC do iOS direto) e, se o Groq
// faltar ou falhar, o Gemini como reserva. Só devolve o texto — não salva nada.
import { corsHeaders, requireUser } from "../_shared/auth.ts";
import { logUsoIA } from "../_shared/log-ia.ts";

// Ditado é curto; o limite evita que alguém use esta função para áudios longos
// (esses vão pela avaliação por voz, que sobe o arquivo para o storage).
const MAX_BYTES = 15 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extensao(mime: string): string {
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

async function viaGroq(bytes: Uint8Array, mime: string, apiKey: string): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("file", new File([bytes], `audio.${extensao(mime)}`, { type: mime }));
    form.append("model", "whisper-large-v3-turbo");
    form.append("language", "pt");
    form.append("response_format", "text");
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      signal: AbortSignal.timeout(60_000),
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) {
      console.warn(`[transcrever-audio] Groq ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      return null;
    }
    return (await res.text()).trim() || null;
  } catch (err) {
    console.warn("[transcrever-audio] Groq erro:", err);
    return null;
  }
}

async function viaGemini(base64: string, mime: string, apiKey: string): Promise<string | null> {
  // O Gemini rejeita o mp4 do iOS rotulado como "mp4", mas aceita "aac".
  const formatos = mime.includes("webm") ? ["webm", "ogg"]
    : mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac") ? ["aac", "mp3", "mp4"]
    : [extensao(mime)];
  for (const fmt of formatos) {
    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(90_000),
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: "Transcreva o áudio em PT-BR, palavra por palavra. Responda só com a transcrição, sem comentários." },
            { role: "user", content: [{ type: "input_audio", input_audio: { data: base64, format: fmt } }] },
          ],
        }),
      });
      if (res.status === 400) continue;
      if (!res.ok) return null;
      const data = await res.json();
      await logUsoIA("transcrever-audio", "gemini-2.5-flash", data?.usage);
      const txt = data?.choices?.[0]?.message?.content;
      return typeof txt === "string" && txt.trim() ? txt.trim() : null;
    } catch (err) {
      console.warn("[transcrever-audio] Gemini erro:", err);
      return null;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    try { await requireUser(req); } catch (r) { return r as Response; }

    const { audioBase64, audioMimeType } = await req.json();
    if (typeof audioBase64 !== "string" || audioBase64.length < 100) {
      return json({ error: "Áudio vazio ou curto demais." }, 400);
    }
    const mime = String(audioMimeType || "audio/webm").split(";")[0].toLowerCase().trim();

    const bin = atob(audioBase64);
    if (bin.length > MAX_BYTES) return json({ error: "Ditado longo demais. Grave em partes menores." }, 413);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    const groqKey = Deno.env.get("GROQ_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    let texto = groqKey ? await viaGroq(bytes, mime, groqKey) : null;
    if (!texto && geminiKey) texto = await viaGemini(audioBase64, mime, geminiKey);

    if (!texto) return json({ error: "Não foi possível transcrever o áudio. Tente de novo." }, 502);
    return json({ texto });
  } catch (err) {
    console.error("[transcrever-audio]", err);
    return json({ error: "Erro ao transcrever o áudio." }, 500);
  }
});
