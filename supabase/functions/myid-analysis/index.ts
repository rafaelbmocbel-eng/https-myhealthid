import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    try { await requireUser(req); } catch (r) { return r as Response; }
    const { scores, redFlags, blocos, perdas, myid_100 } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

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
  "summary": "resumo em 2 frases",
  "insights_baseados_evidencia": ["citações no formato Autor et al. (ano), Journal — achado relevante"]
}`;

    // ───────────────────────────────────────────────────────────────
    // EVIDÊNCIA CIENTÍFICA — busca top 5 estudos relacionados ao perfil
    // ───────────────────────────────────────────────────────────────
    let evidenciaContext = "";
    try {
      const SUPABASE_URL_E = Deno.env.get("SUPABASE_URL");
      const SERVICE_KEY_E = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (SUPABASE_URL_E && SERVICE_KEY_E && GEMINI_API_KEY) {
        const driverName = (perdas && typeof perdas === "object")
          ? Object.entries(perdas as Record<string, number>)
              .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
              .slice(0, 3)
              .map(([k]) => k)
              .join(", ")
          : "";
        const blocosResumo = typeof blocos === "object" ? JSON.stringify(blocos).slice(0, 2000) : "";
        const query = `Perfil MyID-100: dimensões mais comprometidas: ${driverName}. Red flags: ${JSON.stringify(redFlags)}. Contexto clínico: ${blocosResumo}`;

        const embRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/embeddings", {
          method: "POST",
          headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gemini-embedding-001",
            input: query.slice(0, 6000),
            dimensions: 1536,
          }),
        });
        if (embRes.ok) {
          const embJson = await embRes.json();
          const queryEmb = embJson.data?.[0]?.embedding;
          const rpcRes = await fetch(`${SUPABASE_URL_E}/rest/v1/rpc/match_evidence`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: SERVICE_KEY_E, Authorization: `Bearer ${SERVICE_KEY_E}` },
            body: JSON.stringify({
              query_embedding: queryEmb,
              match_count: 5,
              filter_areas: null,
              min_year: new Date().getFullYear() - 15,
            }),
          });
          if (rpcRes.ok) {
            const evidencias = await rpcRes.json();
            // Buscar resumos pré-computados (economia ~70% de tokens) — fallback p/ abstract
            const resumosMap: Record<string, { resumo_clinico?: string | null; aplicacao_pratica?: string | null }> = {};
            if (Array.isArray(evidencias) && evidencias.length > 0) {
              const ids = evidencias.map((e: any) => e.id);
              const resumosRes = await fetch(`${SUPABASE_URL_E}/rest/v1/evidence_library?id=in.(${ids.join(",")})&select=id,resumo_clinico,aplicacao_pratica`, {
                headers: { apikey: SERVICE_KEY_E, Authorization: `Bearer ${SERVICE_KEY_E}` },
              });
              if (resumosRes.ok) {
                const rows = await resumosRes.json();
                for (const r of rows) resumosMap[r.id] = r;
              }
            }
            if (Array.isArray(evidencias) && evidencias.length > 0) {
              evidenciaContext = `\n\nEVIDÊNCIA CIENTÍFICA RELEVANTE (use para sustentar fases, intervenções e preencher "insights_baseados_evidencia" com citações Autor/ano/journal):\n\n` +
                evidencias.map((e: any, i: number) => {
                  const cache = resumosMap[e.id] ?? {};
                  const corpo = cache.resumo_clinico
                    ? `${cache.resumo_clinico}${cache.aplicacao_pratica ? ` Aplicação: ${cache.aplicacao_pratica}` : ""}`
                    : (e.abstract ? e.abstract.slice(0, 400) + "..." : "");
                  return `[${i + 1}] ${e.title}\n  ${(e.authors ?? []).slice(0, 3).join(", ")}${(e.authors ?? []).length > 3 ? " et al." : ""}. ${e.journal ?? ""} (${e.year ?? "—"}). ${e.study_type ?? ""}, evidência ${e.evidence_level ?? "—"}.\n  ${corpo}`;
                }).join("\n\n");
              console.log(`[myid-analysis] Injetou ${evidencias.length} evidências no prompt`);
              fetch(`${SUPABASE_URL_E}/rest/v1/rpc/increment_evidence_citation`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: SERVICE_KEY_E, Authorization: `Bearer ${SERVICE_KEY_E}` },
                body: JSON.stringify({ p_ids: evidencias.map((e: any) => e.id) }),
              }).catch(() => {});
            }
          } else {
            console.warn(`[myid-analysis] match_evidence falhou: ${rpcRes.status}`);
          }
        }
      }
    } catch (e) {
      console.warn("[myid-analysis] evidence search non-blocking error:", e);
    }

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt + evidenciaContext },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const errBody = await response.text();
      throw new Error(`Gemini API error: ${status} - ${errBody}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    let analysis: any = {};
    try {
      analysis = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      analysis = m ? JSON.parse(m[0]) : { summary: content };
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
