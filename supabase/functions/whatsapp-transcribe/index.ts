// Transcreve áudios recebidos via WhatsApp usando Lovable AI (Gemini).
// Chamado pelo webhook ou manualmente para uma mensagem específica.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { mensagem_id } = await req.json();
    if (!mensagem_id) throw new Error("mensagem_id required");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: msg, error } = await admin
      .from("whatsapp_mensagens_inbox")
      .select("id, midia_url, tipo, transcricao")
      .eq("id", mensagem_id)
      .single();
    if (error) throw error;
    if (msg.tipo !== "audio" || !msg.midia_url) {
      return new Response(JSON.stringify({ ok: false, reason: "not-audio" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (msg.transcricao) {
      return new Response(JSON.stringify({ ok: true, cached: true, transcricao: msg.transcricao }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Baixa o áudio e converte em base64
    const audioRes = await fetch(msg.midia_url);
    if (!audioRes.ok) throw new Error("audio download failed");
    const buf = new Uint8Array(await audioRes.arrayBuffer());
    let b64 = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < buf.length; i += chunkSize) {
      b64 += String.fromCharCode(...buf.subarray(i, i + chunkSize));
    }
    const base64 = btoa(b64);
    const mime = audioRes.headers.get("content-type") || "audio/ogg";

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um transcritor de áudio em PT-BR. Retorne SOMENTE o texto transcrito, sem comentários." },
          { role: "user", content: [
            { type: "text", text: "Transcreva este áudio:" },
            { type: "input_audio", input_audio: { data: base64, format: mime.includes("mp") ? "mp3" : "ogg" } },
          ]},
        ],
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      throw new Error(`AI gateway: ${aiRes.status} ${t.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const transcricao = aiJson.choices?.[0]?.message?.content?.trim() || "";

    await admin
      .from("whatsapp_mensagens_inbox")
      .update({ transcricao })
      .eq("id", mensagem_id);

    return new Response(JSON.stringify({ ok: true, transcricao }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[whatsapp-transcribe] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
