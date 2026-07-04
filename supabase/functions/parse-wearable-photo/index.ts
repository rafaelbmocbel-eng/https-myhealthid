// Extrai métricas de saúde (passos, FC, sono, calorias) da foto/screenshot de um smartwatch.
// Usa Gemini Vision via Lovable AI Gateway.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um assistente que extrai métricas de saúde de screenshots ou fotos de smartwatches, apps de fitness (Apple Health, Google Fit, Mi Fit, Samsung Health, Fitbit, Garmin, Strava etc) ou dashboards de wearables.
Retorne SOMENTE JSON válido neste formato exato:
{
  "steps": number | null,
  "heart_rate_avg": number | null,
  "heart_rate_resting": number | null,
  "calories": number | null,
  "sleep_hours": number | null,
  "spo2": number | null,
  "active_minutes": number | null,
  "distance_km": number | null,
  "date_hint": "YYYY-MM-DD ou null (se a foto mostrar data)",
  "confidence": "alta" | "media" | "baixa",
  "notas": "1 frase curta sobre o que foi identificado (fonte/app/período)"
}
Regras:
- Passos: número inteiro (ex: 8432).
- FC: bpm inteiro.
- Sono: horas em decimal (ex: 7.5).
- Distância: km em decimal.
- Se um campo não aparecer na imagem, use null (NUNCA invente).
- Se a imagem não for de saúde/fitness, retorne todos os campos null e confidence "baixa".`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let userId: string;
    try { ({ userId } = await requireUser(req)); } catch (r) { return r as Response; }

    const { paciente_id, file_base64, mime } = await req.json();
    if (!paciente_id || !file_base64 || !mime) {
      return new Response(JSON.stringify({ error: "paciente_id, file_base64, mime obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const dataUrl = `data:${mime};base64,${file_base64}`;

    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: "Extraia as métricas visíveis desta imagem. Responda SOMENTE com o JSON." },
            { type: "image_url", image_url: { url: dataUrl } },
          ]},
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Limite de requisições de IA atingido. Tente novamente em alguns instantes." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "Créditos de IA insuficientes. Adicione créditos no workspace." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`AI Gateway: ${aiRes.status} ${txt.slice(0, 300)}`);
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content || "{}";
    let dados: Record<string, unknown> = {};
    try { dados = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) dados = JSON.parse(m[0]);
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Confirma acesso ao paciente (dono ou próprio paciente)
    const { data: paciente } = await supa
      .from("pacientes")
      .select("id, terapeuta_id, user_id")
      .eq("id", paciente_id)
      .maybeSingle();

    if (!paciente) {
      return new Response(JSON.stringify({ error: "Paciente não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (paciente.terapeuta_id !== userId && paciente.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const dateStr = typeof dados.date_hint === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dados.date_hint)
      ? dados.date_hint : today;

    const steps = typeof dados.steps === "number" ? Math.round(dados.steps) : null;
    const heart_rate_avg = typeof dados.heart_rate_avg === "number" ? Math.round(dados.heart_rate_avg) : null;
    const heart_rate_resting = typeof dados.heart_rate_resting === "number" ? Math.round(dados.heart_rate_resting) : null;
    const calories = typeof dados.calories === "number" ? Math.round(dados.calories) : null;
    const sleep_hours = typeof dados.sleep_hours === "number" ? dados.sleep_hours : null;
    const spo2 = typeof dados.spo2 === "number" ? Math.round(dados.spo2) : null;
    const active_minutes = typeof dados.active_minutes === "number" ? Math.round(dados.active_minutes) : null;
    const distance_km = typeof dados.distance_km === "number" ? dados.distance_km : null;

    // Grava em health_metrics (source foto-ocr)
    if (steps !== null || heart_rate_avg !== null || calories !== null || spo2 !== null) {
      await supa.from("health_metrics").upsert({
        paciente_id,
        terapeuta_id: paciente.terapeuta_id,
        date: dateStr,
        source: "foto-ocr",
        steps: steps ?? 0,
        heart_rate_avg,
        heart_rate_resting,
        calories_burned: calories,
        spo2_avg: spo2,
        active_minutes,
        distance_km,
      }, { onConflict: "paciente_id,date,source" });
    }

    // Sleep opcional
    if (sleep_hours !== null) {
      await supa.from("sleep_logs").upsert({
        paciente_id,
        terapeuta_id: paciente.terapeuta_id,
        date: dateStr,
        source: "foto-ocr",
        total_hours: sleep_hours,
      }, { onConflict: "paciente_id,date" });
    }

    // Log estruturado (alimenta o monitor pro e evita dedup)
    await supa.from("wearable_sync_log").insert({
      paciente_id,
      terapeuta_id: paciente.terapeuta_id,
      fonte: "foto-ocr",
      steps,
      heart_rate: heart_rate_avg,
      calories,
      sleep_hours,
      raw_data: dados as unknown,
    });

    return new Response(JSON.stringify({ ok: true, dados, date: dateStr }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[parse-wearable-photo] erro:", e);
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
