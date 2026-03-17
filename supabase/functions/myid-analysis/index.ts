import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { scores, redFlags, blocos, perdas, myid_100 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é o MOTOR DE ANÁLISE MyID-100 v2.0. Analise os scores e perdas do paciente.

FÓRMULA MyID-100 (Modelo Subtração Cumulativa):
MyID_100 = 100 - Σ(Perdas por dimensão) + MED_bonus
Resultado: 0-100 (quanto MAIOR, MELHOR)

Cada dimensão subtrai pontos de 100 (saúde perfeita) usando tabela de perdas não-lineares.

DIMENSÕES DE DEMANDA (score alto = ruim):
- D (Dor): max -20pts
- EFI (Funcionalidade): max -15pts  
- P (Psicológico): max -5pts (amplificador de medo/evitação)
- I (Inércia): max -5pts (mudanças recentes)

DIMENSÕES DE CAPACIDADE (score alto = bom, perda = 10-valor):
- R (Regulação): max -15pts, gatilho crítico ≥7
- C (Contexto): max -10pts
- AF (Atividade Física): max -8pts, gatilho crítico ≥7
- HID (Hidratação): max -6pts
- NUT (Nutrição): max -6pts
- ERG (Ergonomia): max -5pts, gatilho crítico ≥8

RUÍDO E MEDICAÇÃO:
- N (Ruído Sistêmico): max -5pts
- MED: Bônus ou penalidade

CLASSIFICAÇÃO:
- 85-100: EXCELENTE 🟢
- 70-84: BOM 🟡
- 50-69: MODERADO 🟠
- 0-49: CRÍTICO 🔴 (ou se gatilho crítico ativado)

DRIVER PRIMÁRIO = dimensão com maior perda (×1.5 se gatilho crítico).

Responda APENAS com JSON válido no formato especificado.`;

    const userPrompt = `Scores brutos (0-10):
${JSON.stringify(scores, null, 2)}

Perdas calculadas:
${JSON.stringify(perdas, null, 2)}

MyID-100: ${JSON.stringify(myid_100)}

Red Flags: ${JSON.stringify(redFlags)}

Dados dos blocos: ${JSON.stringify(blocos)}

Gere um JSON com:
{
  "clinical_priority": {
    "focus_area": "nome da dimensão driver",
    "reason": "explicação curta",
    "recommendation": "recomendação principal"
  },
  "treatment_phases": [
    { "fase": 1, "titulo": "...", "duracao_semanas": 2, "meta_score": 45, "intervencoes": ["..."] },
    { "fase": 2, "titulo": "...", "duracao_semanas": 2, "meta_score": 55, "intervencoes": ["..."] },
    { "fase": 3, "titulo": "...", "duracao_semanas": 2, "meta_score": 65, "intervencoes": ["..."] }
  ],
  "integration_directives": {
    "fisioterapia": "diretiva",
    "studio_personal": "diretiva",
    "orientacao_geral": "diretiva"
  },
  "alert_level": "verde|amarelo|vermelho",
  "summary": "resumo em 2 frases"
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";
    
    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: content };
    } catch {
      analysis = { summary: content };
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("myid-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
