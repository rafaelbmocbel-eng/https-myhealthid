// Gera plano alimentar personalizado via Lovable AI Gateway.
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é nutricionista clínico (CFN) especialista em prescrição dietética.
Gere um plano alimentar personalizado em JSON, distribuído em refeições ao longo do dia, respeitando objetivo, preferências e restrições.
Use alimentos comuns no Brasil, medidas caseiras E gramatura. Cálculos de macros realistas.
Retorne SOMENTE JSON neste formato:
{
  "titulo": "string curta",
  "resumo": "1-2 frases sobre estratégia",
  "calorias_totais": 2000,
  "macros": { "proteina_g": 150, "carbo_g": 220, "gordura_g": 65 },
  "refeicoes": [
    {
      "nome": "Café da manhã",
      "horario": "07:00",
      "calorias": 450,
      "itens": [
        { "alimento": "Ovos mexidos", "porcao": "2 unidades (100g)", "kcal": 155, "p": 13, "c": 1, "g": 11 }
      ],
      "substituicoes": "string opcional"
    }
  ],
  "orientacoes": ["string", "string"],
  "lista_compras": ["string"]
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    try { await requireUser(req); } catch (r) { return r as Response; }
    const body = await req.json();
    const {
      objetivo, calorias_alvo, refeicoes_por_dia, restricoes, preferencias,
      antropometria, idade, sexo, nivel_atividade, recordatorio,
    } = body || {};
    if (!objetivo) {
      return new Response(JSON.stringify({ error: "objetivo obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const userPrompt = `
Paciente: ${idade ? idade + ' anos' : 'idade ?'}, sexo ${sexo || '?'}, nível de atividade ${nivel_atividade || 'moderado'}.
Antropometria: ${antropometria ? JSON.stringify(antropometria) : 'não informada'}.
Recordatório 24h recente: ${recordatorio ? JSON.stringify(recordatorio).slice(0, 1500) : 'não informado'}.

Objetivo: ${objetivo}
Calorias-alvo: ${calorias_alvo || 'calcular pela necessidade estimada'}
Refeições/dia: ${refeicoes_por_dia || 5}
Restrições/alergias: ${restricoes || 'nenhuma'}
Preferências: ${preferencias || 'sem preferências especiais'}

Gere o plano alimentar completo em JSON conforme o formato.`.trim();

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
