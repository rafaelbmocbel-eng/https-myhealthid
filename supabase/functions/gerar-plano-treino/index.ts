// Gera plano de treino periodizado via Lovable AI Gateway.
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é educador físico especialista em prescrição de treino (ACSM/NSCA/CBCE).
Gere um plano de treino periodizado em JSON estruturado, com fases progressivas (adaptação → desenvolvimento → consolidação) e exercícios específicos por sessão.
Retorne SOMENTE JSON neste formato:
{
  "titulo": "string curta",
  "resumo": "1-2 frases sobre estratégia",
  "fases": [
    {
      "nome": "Fase 1 - Adaptação",
      "semanas": 4,
      "objetivo": "string",
      "sessoes": [
        {
          "nome": "Treino A - Membros Inferiores",
          "duracao_min": 50,
          "aquecimento": "string",
          "exercicios": [
            { "nome": "Agachamento livre", "series": 3, "reps": "12-15", "carga": "moderada", "descanso_s": 60, "obs": "ADM completa" }
          ],
          "desaquecimento": "string"
        }
      ]
    }
  ],
  "observacoes_gerais": "string"
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    try { await requireUser(req); } catch (r) { return r as Response; }
    const body = await req.json();
    const { objetivo, nivel, frequencia_semanal, duracao_semanas, restricoes, antropometria, testes, idade, sexo } = body || {};
    if (!objetivo || !nivel || !frequencia_semanal) {
      return new Response(JSON.stringify({ error: "objetivo, nivel, frequencia_semanal obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userPrompt = `
Paciente: ${idade ? idade + ' anos' : 'idade não informada'}, sexo ${sexo || 'não informado'}.
Antropometria: ${antropometria ? JSON.stringify(antropometria) : 'não informada'}.
Testes funcionais: ${testes ? JSON.stringify(testes) : 'não informados'}.

Objetivo: ${objetivo}
Nível: ${nivel}
Frequência: ${frequencia_semanal}x/semana
Duração total: ${duracao_semanas || 12} semanas
Restrições/lesões: ${restricoes || 'nenhuma'}

Gere o plano periodizado completo em JSON.`.trim();

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway: ${aiRes.status} ${txt.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content || "{}";
    let plano: any = {};
    try { plano = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) plano = JSON.parse(m[0]);
    }

    return new Response(JSON.stringify({ ok: true, plano }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
