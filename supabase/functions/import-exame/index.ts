// Importa exame (imagem ou PDF) via Gemini Vision e extrai dados estruturados.
import { requireUser } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um assistente clínico que extrai dados estruturados de exames médicos (laboratoriais ou de imagem).
Retorne SOMENTE JSON válido neste formato:
{
  "tipo": "laboratorial" | "imagem" | "outro",
  "nome_exame": "string (ex: Hemograma completo, Raio-X de tórax)",
  "data_exame": "YYYY-MM-DD ou null",
  "resumo": "1-3 frases resumindo achados principais",
  "valores": [
    { "parametro": "Hemoglobina", "valor": "14.2", "unidade": "g/dL", "referencia": "12-16", "alterado": false }
  ],
  "achados": ["string"],
  "vitais": { "pa_sistolica": null, "pa_diastolica": null, "fc": null, "spo2": null, "temperatura": null, "peso_kg": null, "altura_cm": null, "glicemia": null },
  "conclusao": "string ou null"
}
Use null quando não houver dado. Não inclua nada além do JSON.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let user;
    try { user = await requireUser(req); } catch (r) { return r as Response; }

    const { paciente_id, file_base64, mime, file_name } = await req.json();
    if (!paciente_id || !file_base64 || !mime) {
      return new Response(JSON.stringify({ error: "paciente_id, file_base64, mime obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const dataUrl = `data:${mime};base64,${file_base64}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: [
            { type: "text", text: `Extraia os dados deste exame${file_name ? ` (arquivo: ${file_name})` : ""}. Retorne SOMENTE JSON.` },
            { type: "image_url", image_url: { url: dataUrl } },
          ]},
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`AI gateway: ${aiRes.status} ${txt.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content || "{}";
    let dados: any = {};
    try { dados = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) dados = JSON.parse(m[0]);
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error } = await supa.from("exames_importados").insert({
      terapeuta_id: user.id,
      paciente_id,
      tipo: dados.tipo || null,
      data_exame: dados.data_exame || null,
      dados_extraidos: dados,
      status: "processado",
    }).select().single();
    if (error) throw error;

    // Auto-fill sinais vitais se vierem do exame
    const v = dados.vitais || {};
    const hasVitais = Object.values(v).some((x: any) => x !== null && x !== undefined && x !== "");
    if (hasVitais) {
      await supa.from("sinais_vitais").insert({
        terapeuta_id: user.id,
        paciente_id,
        pa_sistolica: v.pa_sistolica ?? null,
        pa_diastolica: v.pa_diastolica ?? null,
        fc: v.fc ?? null,
        spo2: v.spo2 ?? null,
        temperatura: v.temperatura ?? null,
        peso_kg: v.peso_kg ?? null,
        altura_cm: v.altura_cm ?? null,
        glicemia: v.glicemia ?? null,
        observacao: `Importado de exame: ${dados.nome_exame || "exame"}`,
      });
    }

    return new Response(JSON.stringify({ ok: true, exame: row, vitais_importados: hasVitais }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
