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

    // Dono do banco de GIFs: quando o CLIENTE gera o próprio plano, o
    // biblioteca_exercicios dele (paciente) é vazio — os GIFs pertencem ao
    // PROFISSIONAL. Então usamos o banco do profissional do paciente; se ele
    // não tem profissional (ou o banco está vazio), caímos no banco da
    // plataforma (qualquer biblioteca com GIF) para o cliente também ter a
    // demonstração em vídeo. Profissional gerando: bankOwner = ele mesmo.
    let bankOwner: string | null = userId;
    if (paciente_id) {
      const { data: pacRow } = await admin.from("pacientes")
        .select("terapeuta_id").eq("id", paciente_id).maybeSingle();
      bankOwner = ((pacRow as any)?.terapeuta_id) || userId;
    }
    const BANK_COLS = "id, nome, grupo_muscular, gif_url, gif_url_fem, orientacoes, series_padrao, repeticoes_padrao, descanso_padrao_segundos";
    let bibData: any[] = [];
    {
      const { data } = await admin.from("biblioteca_exercicios")
        .select(BANK_COLS).eq("terapeuta_id", bankOwner).eq("ativo", true).limit(250);
      bibData = data || [];
    }
    if (bibData.length === 0) {
      // Fallback: banco da plataforma — só exercícios com GIF, de qualquer profissional.
      const { data } = await admin.from("biblioteca_exercicios")
        .select(BANK_COLS).eq("ativo", true).not("gif_url", "is", null).limit(250);
      bibData = data || [];
    }
    const { data: catData } = await admin.from("exercicios_biblioteca")
      .select("id, nome, categoria").limit(250);

    // Se a paciente é mulher e o exercício tem a variante com avatar feminino,
    // entrega o GIF feminino.
    const prefereFem = /^f/i.test(String(sexo || ""));
    type Disp = { id: string; nome: string; grupo: string; gif_url: string | null; orientacoes: string | null; series?: number; reps?: number; descanso?: number };
    const disponiveis: Disp[] = [
      ...bibData.map((e) => ({
        id: e.id, nome: e.nome, grupo: e.grupo_muscular || "",
        gif_url: (prefereFem && e.gif_url_fem) ? e.gif_url_fem : (e.gif_url || null),
        orientacoes: e.orientacoes || null,
        series: e.series_padrao ?? undefined, reps: e.repeticoes_padrao ?? undefined, descanso: e.descanso_padrao_segundos ?? undefined,
      })),
      ...((catData || []) as any[]).map((e) => ({ id: e.id, nome: e.nome, grupo: e.categoria || "", gif_url: null, orientacoes: null })),
    ];
    const mapa = new Map(disponiveis.map((e) => [e.id, e]));

    // MyID (opcional) para personalizar
    let myidStr = "";
    if (paciente_id) {
      const { data: my } = await admin.from("myid_avaliacoes")
        .select("resultado_processado")
        .eq("paciente_id", paciente_id).eq("status", "concluido")
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      const _rp = (my?.resultado_processado as any);
    // formato variou entre gerações: component_scores (atual), componentScores ou scores
    const scores = (_rp?.scores || _rp?.component_scores || _rp?.componentScores);
      if (scores) myidStr = `\nPerfil MyID (scores por dimensão): ${JSON.stringify(scores)}. Priorize exercícios que atendam às dimensões mais críticas do paciente.`;
    }

    const listaBlock = disponiveis.length
      ? `\n\nExercícios disponíveis no banco da clínica — use SOMENTE estes e preencha "id" com o id exato (NÃO invente exercícios fora desta lista):\n${disponiveis.slice(0, 250).map((e) => `- [${e.id}] ${e.nome}${e.grupo ? ` (${e.grupo})` : ""}`).join("\n")}`
      : "";


    // Questionários clínicos validados (PAR-Q+, PSFS, START Back, ISI, PHQ-4)
    let questTxt = "";
    try {
      const { data: quests } = await admin.from("questionarios_clinicos")
        .select("instrumento, escore, classificacao, respostas, created_at")
        .eq("paciente_id", paciente_id).order("created_at", { ascending: false }).limit(20);
      const ult = new Map<string, any>();
      (quests || []).forEach((q: any) => { if (!ult.has(q.instrumento)) ult.set(q.instrumento, q); });
      questTxt = [...ult.values()].map((q: any) => {
        const metas = Array.isArray(q.respostas?.atividades)
          ? ` — metas do paciente: ${q.respostas.atividades.map((a: any) => `${a.nome} (${a.nota}/10)`).join(", ")}`
          : "";
        return `${String(q.instrumento).toUpperCase()}: escore ${q.escore}, ${q.classificacao}${metas}`;
      }).join("\n");
    } catch (_qErr) { /* tabela pode não existir ainda — segue sem */ }

    // AVALIAÇÃO PRESENCIAL do profissional: achados do avatar clínico +
    // queixa/história. É o que o profissional viu no atendimento — prioridade
    // clínica ao montar o treino.
    let presencialTxt = "";
    if (paciente_id) {
      try {
        const [evRes, pacRes] = await Promise.all([
          admin.from("eventos_clinicos_anatomicos")
            .select("regiao_id, sistema, tipo_achado, severidade, status")
            .eq("paciente_id", paciente_id).neq("status", "resolvido").limit(20),
          admin.from("pacientes").select("queixa_principal, historia_atual, condicoes_saude")
            .eq("id", paciente_id).maybeSingle(),
        ]);
        const evs = (evRes.data || []) as any[];
        const pac = pacRes.data as any;
        const partes: string[] = [];
        if (pac?.queixa_principal) partes.push(`Queixa principal: ${String(pac.queixa_principal).slice(0, 300)}`);
        if (pac?.historia_atual) partes.push(`História atual: ${String(pac.historia_atual).slice(0, 400)}`);
        if (pac?.condicoes_saude) partes.push(`Condições de saúde: ${JSON.stringify(pac.condicoes_saude).slice(0, 300)}`);
        if (evs.length) partes.push(`Achados registrados no avatar clínico: ${evs.map((e) => `${e.tipo_achado} (região ${e.regiao_id}, severidade ${e.severidade})`).join("; ")}`);
        if (partes.length) {
          presencialTxt = `\nAVALIAÇÃO PRESENCIAL (achados do profissional — trate como PRIORIDADE clínica: evite sobrecarregar regiões com achados ativos, inclua trabalho específico/terapêutico onde indicado e progrida com cautela nessas áreas):\n${partes.join("\n")}`;
        }
      } catch (_pErr) { /* segue sem */ }
    }

    const userPrompt = `
Paciente: ${idade ? idade + ' anos' : 'idade não informada'}, sexo ${sexo || 'não informado'}.
Antropometria: ${antropometria ? JSON.stringify(antropometria) : 'não informada'}.
Testes funcionais: ${testes ? JSON.stringify(testes) : 'não informados'}.

Objetivo: ${objetivo}
Nível: ${nivel}
Frequência: ${frequencia_semanal}x/semana
Duração total: ${duracao_semanas || 12} semanas
Restrições/lesões: ${restricoes || 'nenhuma'}${presencialTxt}${myidStr}${questTxt ? `\nQUESTIONÁRIOS CLÍNICOS VALIDADOS (respeite: PARQ requer_atencao = plano CONSERVADOR e alerta para avaliação presencial antes de intensificar; SBST alto_risco = abordagem biopsicossocial e progressão cautelosa; PSFS = use as metas do paciente como objetivos do plano; ISI/PHQ4 alterados = considere sono/estresse na periodização):\n${questTxt}` : ''}${listaBlock}

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

    // Enriquece cada exercício com o gif_url, o nome canônico e as ORIENTAÇÕES
    // oficiais do banco (execução correta) — para o plano ficar bem explicado.
    if (disponiveis.length && plano?.fases) {
      for (const f of plano.fases || []) {
        for (const s of f.sessoes || []) {
          for (const ex of s.exercicios || []) {
            const ref = ex?.id ? mapa.get(ex.id) : null;
            if (ref) {
              ex.nome = ref.nome;
              ex.gif_url = ref.gif_url;
              if (ref.orientacoes) ex.orientacoes = ref.orientacoes;
            }
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
