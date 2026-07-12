// Gera plano alimentar personalizado via Google Gemini API — baseado em
// evidências e no perfil clínico do paciente (MyID + história).
import { requireUser } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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
      antropometria, idade, sexo, nivel_atividade, recordatorio, paciente_id,
    } = body || {};
    if (!objetivo) {
      return new Response(JSON.stringify({ error: "objetivo obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    // Perfil clínico do paciente (MyID + história) para personalizar por evidência.
    let perfilClinico = "";
    if (paciente_id) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const [myRes, pacRes] = await Promise.all([
        admin.from("myid_avaliacoes").select("resultado_processado")
          .eq("paciente_id", paciente_id).eq("status", "concluido")
          .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        admin.from("pacientes").select("queixa_principal, historia_atual, condicoes_saude")
          .eq("id", paciente_id).maybeSingle(),
      ]);
      const scores = (myRes.data?.resultado_processado as any)?.scores;
      const pac = pacRes.data as any;
      const partes: string[] = [];
      if (scores) partes.push(`Perfil MyID (scores por dimensão): ${JSON.stringify(scores)}`);
      if (pac?.queixa_principal) partes.push(`Queixa principal: ${String(pac.queixa_principal).slice(0, 400)}`);
      if (pac?.historia_atual) partes.push(`História: ${String(pac.historia_atual).slice(0, 600)}`);
      if (pac?.condicoes_saude) partes.push(`Condições de saúde: ${JSON.stringify(pac.condicoes_saude).slice(0, 400)}`);
      if (partes.length) {
        perfilClinico = `\nPerfil clínico do paciente (use para personalizar, com base em evidências; considere comorbidades e sinais das dimensões mais críticas):\n${partes.join("\n")}`;
      }
    }

    const userPrompt = `
Paciente: ${idade ? idade + ' anos' : 'idade ?'}, sexo ${sexo || '?'}, nível de atividade ${nivel_atividade || 'moderado'}.
Antropometria: ${antropometria ? JSON.stringify(antropometria) : 'não informada'}.
Recordatório 24h recente: ${recordatorio ? JSON.stringify(recordatorio).slice(0, 1500) : 'não informado'}.${perfilClinico}

Objetivo: ${objetivo}
Calorias-alvo: ${calorias_alvo || 'calcular pela necessidade estimada'}
Refeições/dia: ${refeicoes_por_dia || 5}
Restrições/alergias: ${restricoes || 'nenhuma'}
Preferências: ${preferencias || 'sem preferências especiais'}

Gere o plano alimentar completo em JSON conforme o formato. Baseie-se em diretrizes e evidências científicas; NÃO faça recomendações fora de escopo (medicamentos, suplementação de risco).`.trim();

    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 45_000);
    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
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
      throw new Error(`Gemini API: ${aiRes.status} ${txt.slice(0, 200)}`);
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
