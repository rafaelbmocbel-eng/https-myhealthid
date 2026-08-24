// Gera exercícios terapêuticos (respiração, alongamento, mobilidade, relaxamento,
// dicas) FUNDAMENTADOS na evidence_library (meta-análises/revisões do PubMed),
// mapeados às dimensões do MyID. Nascem como rascunho (aprovado=false) para o
// profissional revisar — mesmo padrão das diretrizes.
import { requireUser } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logUsoIA } from "../_shared/log-ia.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Perfis do catálogo que mapeiam para as dimensões do MyID (mesmo vocabulário
// usado no Dever de Casa).
const PERFIS = ["DOR_PERCEBIDA", "FUNCIONALIDADE_COMPROMETIDA", "PSICO_COMPORTAMENTAL", "REGULACAO_CRITICA", "ESTRUTURAL", "ERGONOMIA", "HIDRATACAO"];
const CATEGORIAS = ["Respiração", "Relaxamento", "Mobilidade", "Alongamento", "Fortalecimento", "Propriocepção", "Funcional"];

const SYSTEM = `Você é um time clínico (fisioterapia, medicina da dor, neurociência, psicologia, nutrição, educação física) que cria exercícios terapêuticos e dicas SEGUROS, para casa, baseados EXCLUSIVAMENTE na evidência científica fornecida (revisões sistemáticas e meta-análises).
Regras:
- Use SOMENTE o que é sustentado pelos artigos fornecidos. NÃO invente eficácia. NÃO recomende medicamentos, manipulação de alta velocidade, nem nada que exija supervisão presencial.
- Cada exercício deve ser autoaplicável, de baixo risco, com precauções claras.
- Preencha "perfis_indicados" apenas com valores desta lista: ${PERFIS.join(", ")}.
- Preencha "categoria" apenas com: ${CATEGORIAS.join(", ")}.
- Em "evidencia", cite os artigos usados (título curto + doi + nível).
Retorne SOMENTE JSON: { "exercicios": [ {
  "nome": "string",
  "categoria": "uma das categorias",
  "descricao": "para que serve e quando usar (2-3 linhas)",
  "instrucoes": ["passo 1", "passo 2", "..."],
  "precaucoes": ["quando NÃO fazer / sinais de alerta"],
  "perfis_indicados": ["DOR_PERCEBIDA", "..."],
  "nivel_dificuldade": "Iniciante|Intermediário|Avançado",
  "tempo_duracao": "ex: 5 minutos",
  "evidencia": [ { "titulo": "string", "doi": "string ou vazio", "nivel": "string" } ]
} ] }`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    try { await requireUser(req); } catch (r) { return r as Response; }
    const body = await req.json();
    const area: string = (body?.area || "").toString().trim();
    const quantos = Math.min(Math.max(Number(body?.quantos) || 6, 1), 12);
    if (!area) {
      return new Response(JSON.stringify({ error: "area obrigatória" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Artigos da área (as meta-análises mais recentes) para fundamentar.
    const { data: artigos } = await admin.from("evidence_library")
      .select("title, journal, year, doi, evidence_level")
      .contains("health_areas", [area])
      .order("year", { ascending: false })
      .limit(20);
    const lista = (artigos || []) as any[];
    if (lista.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: `Nenhum artigo na base para a área "${area}". Rode a Carga inicial na Base Científica primeiro.` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evidenciaTxt = lista.map((a, i) => `[${i + 1}] ${a.title} (${a.journal || "?"}, ${a.year || "?"}) DOI:${a.doi || "-"} Nível:${a.evidence_level || "-"}`).join("\n");
    const userPrompt = `Área: ${area}. Gere ${quantos} exercícios/dicas terapêuticos para casa, fundamentados SOMENTE nos artigos abaixo (revisões/meta-análises). Distribua entre respiração, alongamento, mobilidade e relaxamento quando fizer sentido.

Artigos disponíveis:
${evidenciaTxt}

Retorne o JSON conforme o formato.`;

    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 55_000);
    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`Gemini API: ${aiRes.status} ${txt.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    await logUsoIA("gerar-exercicios-evidencia", "gemini-2.5-flash", aiJson?.usage);
    const content = aiJson.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]);
    }
    const exercicios: any[] = Array.isArray(parsed?.exercicios) ? parsed.exercicios : [];

    // Insere no catálogo como RASCUNHO (aprovado=false) gerado por IA.
    let inseridos = 0;
    for (const ex of exercicios) {
      if (!ex?.nome) continue;
      const categoria = CATEGORIAS.includes(ex.categoria) ? ex.categoria : "Mobilidade";
      const perfis = Array.isArray(ex.perfis_indicados) ? ex.perfis_indicados.filter((p: string) => PERFIS.includes(p)) : [];
      const { error } = await admin.from("exercicios_biblioteca").insert({
        nome: String(ex.nome).slice(0, 200),
        categoria,
        descricao: ex.descricao ? String(ex.descricao).slice(0, 1000) : null,
        instrucoes: Array.isArray(ex.instrucoes) ? ex.instrucoes : [],
        precaucoes: Array.isArray(ex.precaucoes) ? ex.precaucoes : [],
        perfis_indicados: perfis,
        nivel_dificuldade: ["Iniciante", "Intermediário", "Avançado"].includes(ex.nivel_dificuldade) ? ex.nivel_dificuldade : "Iniciante",
        tempo_duracao: ex.tempo_duracao || "5 minutos",
        evidencia: Array.isArray(ex.evidencia) ? ex.evidencia : [],
        gerado_por_ia: true,
        aprovado: false,
      });
      if (!error) inseridos++;
    }

    return new Response(JSON.stringify({ ok: true, area, artigos_usados: lista.length, gerados: inseridos }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
