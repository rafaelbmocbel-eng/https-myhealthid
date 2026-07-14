// Gera plano de treino periodizado via Google Gemini API.
// A IA escolhe os exercícios DO BANCO da clínica (Biblioteca de GIFs + catálogo),
// referenciando por id — e o gif_url volta junto de cada exercício. Se houver
// paciente_id, usa o MyID dele para personalizar.
import { requireUser } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é uma EQUIPE de personal trainers e educadores físicos com 15 anos de mercado (ACSM/NSCA/CBCE), planejando juntos como fariam para um cliente premium.
Padrão de qualidade: plano digno de consultoria — periodização real, progressão de carga/volume explícita entre fases, técnica e segurança em cada exercício, e coerência total com o perfil MyID e a condição clínica do paciente.
Gere um plano de treino periodizado em JSON estruturado, com fases progressivas (adaptação → desenvolvimento → consolidação) e exercícios específicos por sessão.
PRIORIZE os exercícios da biblioteca do profissional (que têm demonstração em GIF para o paciente ver) sempre que cobrirem o objetivo — o paciente executa muito melhor vendo o movimento.
Quando for fornecida uma lista de "Exercícios disponíveis no banco", você DEVE escolher APENAS exercícios dessa lista e preencher o campo "id" com o id EXATO da lista. NUNCA invente exercícios fora da lista nesse caso.
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
            { "id": "id-do-banco-ou-vazio", "nome": "Agachamento livre", "series": 3, "reps": "12-15", "carga": "moderada", "descanso_s": 60, "obs": "ADM completa" }
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
    let userId: string;
    try { ({ userId } = await requireUser(req)); } catch (r) { return r as Response; }
    const body = await req.json();
    const { objetivo, nivel, frequencia_semanal, duracao_semanas, restricoes, antropometria, testes, idade, sexo, paciente_id } = body || {};
    if (!objetivo || !nivel || !frequencia_semanal) {
      return new Response(JSON.stringify({ error: "objetivo, nivel, frequencia_semanal obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cardápio de exercícios do banco: biblioteca de GIFs do profissional +
    // catálogo terapêutico. A IA escolhe SÓ daqui.
    const [bibRes, catRes] = await Promise.all([
      admin.from("biblioteca_exercicios")
        .select("id, nome, grupo_muscular, gif_url, gif_url_fem")
        .eq("terapeuta_id", userId).eq("ativo", true).limit(250),
      admin.from("exercicios_biblioteca")
        .select("id, nome, categoria").limit(250),
    ]);
    // Se a paciente é mulher e o exercício tem a variante com avatar feminino,
    // entrega o GIF feminino.
    const prefereFem = /^f/i.test(String(sexo || ""));
    type Disp = { id: string; nome: string; grupo: string; gif_url: string | null };
    const disponiveis: Disp[] = [
      ...((bibRes.data || []) as any[]).map((e) => ({
        id: e.id, nome: e.nome, grupo: e.grupo_muscular || "",
        gif_url: (prefereFem && e.gif_url_fem) ? e.gif_url_fem : (e.gif_url || null),
      })),
      ...((catRes.data || []) as any[]).map((e) => ({ id: e.id, nome: e.nome, grupo: e.categoria || "", gif_url: null })),
    ];
    const mapa = new Map(disponiveis.map((e) => [e.id, e]));

    // MyID (opcional) para personalizar
    let myidStr = "";
    if (paciente_id) {
      const { data: my } = await admin.from("myid_avaliacoes")
        .select("resultado_processado")
        .eq("paciente_id", paciente_id).eq("status", "concluido")
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      const scores = (my?.resultado_processado as any)?.scores;
      if (scores) myidStr = `\nPerfil MyID (scores por dimensão): ${JSON.stringify(scores)}. Priorize exercícios que atendam às dimensões mais críticas do paciente.`;
    }

    const listaBlock = disponiveis.length
      ? `\n\nExercícios disponíveis no banco da clínica — use SOMENTE estes e preencha "id" com o id exato (NÃO invente exercícios fora desta lista):\n${disponiveis.slice(0, 250).map((e) => `- [${e.id}] ${e.nome}${e.grupo ? ` (${e.grupo})` : ""}`).join("\n")}`
      : "";

    const userPrompt = `
Paciente: ${idade ? idade + ' anos' : 'idade não informada'}, sexo ${sexo || 'não informado'}.
Antropometria: ${antropometria ? JSON.stringify(antropometria) : 'não informada'}.
Testes funcionais: ${testes ? JSON.stringify(testes) : 'não informados'}.

Objetivo: ${objetivo}
Nível: ${nivel}
Frequência: ${frequencia_semanal}x/semana
Duração total: ${duracao_semanas || 12} semanas
Restrições/lesões: ${restricoes || 'nenhuma'}${myidStr}${listaBlock}

Gere o plano periodizado completo em JSON.`.trim();

    // Plano periodizado completo + lista de até 250 exercícios da biblioteca:
    // geração longa — 45s abortava antes da IA terminar.
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 120_000);
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

    // Enriquece cada exercício com o gif_url e o nome canônico do banco.
    if (disponiveis.length && plano?.fases) {
      for (const f of plano.fases || []) {
        for (const s of f.sessoes || []) {
          for (const ex of s.exercicios || []) {
            const ref = ex?.id ? mapa.get(ex.id) : null;
            if (ref) { ex.nome = ref.nome; ex.gif_url = ref.gif_url; }
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, plano, usou_banco: disponiveis.length > 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = e?.name === "AbortError" || /abort/i.test(String(e?.message))
      ? "A IA demorou demais para responder. Tente de novo — a segunda tentativa costuma ser mais rápida."
      : e.message || String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
