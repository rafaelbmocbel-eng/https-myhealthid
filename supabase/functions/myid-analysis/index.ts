import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { scores, redFlags, blocos } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é o MOTOR DE ANÁLISE MyID. Analise os scores do paciente e gere recomendações clínicas.

FÓRMULA: MyID = [(D + EFI) × (1 + P/10) + I] / [(R + C) - N]

Variáveis:
- D (Dor): Intensidade sensorial
- EFI (Funcionalidade): Impacto funcional  
- P (Psicológico): Medo, catastrofização, evitação
- I (Inércia): Gatilhos de mudança recentes
- R (Regulação): Sono + Energia + Psicológico (capacidade)
- C (Contexto): Suporte social (capacidade)
- N (Ruído): Traumas, cicatrizes, visceral (subtrator)

Responda APENAS com JSON válido no formato especificado.`;

    const userPrompt = `Scores do paciente:
${JSON.stringify(scores, null, 2)}

Red Flags: ${JSON.stringify(redFlags)}

Dados dos blocos: ${JSON.stringify(blocos)}

Gere um JSON com:
{
  "clinical_priority": {
    "focus_area": "Numerador ou Denominador",
    "reason": "explicação curta",
    "recommendation": "recomendação principal"
  },
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
    
    // Parse JSON from response
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
