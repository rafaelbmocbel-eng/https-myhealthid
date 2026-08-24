// Gera plano de treino periodizado via Google Gemini API.
// A IA escolhe os exercícios DO BANCO da clínica (Biblioteca de GIFs + catálogo),
// referenciando por id — e o gif_url volta junto de cada exercício. Se houver
// paciente_id, usa o MyID dele para personalizar.
import { requireUser } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logUsoIA } from "../_shared/log-ia.ts";
import { carregarMotoresClinicos, textoMyID, textoPresencial, textoQuestionarios } from "../_shared/motores-plano.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é uma EQUIPE de personal trainers e educadores físicos com 15 anos de mercado (ACSM/NSCA/CBCE), planejando juntos como fariam para um cliente premium.
Padrão de qualidade: plano digno de consultoria — periodização real, progressão de carga/volume explícita entre fases, técnica e segurança em cada exercício, e coerência total com o perfil MyID e a condição clínica do paciente.

PERIODIZAÇÃO (parte teórica — siga com rigor):
- Divida a duração TOTAL informada em 2 a 4 fases progressivas. A SOMA das "semanas" de TODAS as fases DEVE ser EXATAMENTE igual à duração total informada (ex.: total 8 semanas → fases 3+3+2 ou 2+3+3; total 12 → 4+4+4). NUNCA deixe a soma diferente do total.
- Cada fase tem um foco fisiológico claro e progressivo: Fase 1 Adaptação anatômica/aprendizado motor (volume moderado, intensidade baixa, ADM e técnica) → Fase 2 Desenvolvimento (aumento progressivo de volume, depois intensidade/carga) → Fase 3 Consolidação/Especialização (maior intensidade, densidade ou especificidade ao objetivo). Em planos ≥ 12 semanas, inclua 1 semana de deload/regeneração.
- Explicite a PROGRESSÃO entre fases no campo "objetivo" de cada fase (o que aumenta: séries, repetições, carga, densidade, complexidade) e mantenha coerência com o objetivo (ex.: emagrecimento = maior densidade e gasto calórico; força = maior intensidade/menos reps; hipertrofia = volume na zona 6-12).
- Parâmetros baseados em evidência por objetivo: força 3-6 reps/descanso 2-3min; hipertrofia 6-12 reps/descanso 60-90s; resistência/emagrecimento 12-20 reps ou circuitos/descanso 30-60s; iniciante e condições clínicas = progressão conservadora.
- Frequência e nº de sessões por semana coerentes com a "Frequência" informada. Cada sessão com aquecimento específico e desaquecimento.

PRIORIZE os exercícios da biblioteca do profissional (que têm demonstração em GIF para o paciente ver) sempre que cobrirem o objetivo — o paciente executa muito melhor vendo o movimento.
Quando for fornecida uma lista de "Exercícios disponíveis no banco", você DEVE escolher APENAS exercícios dessa lista e preencher o campo "id" com o id EXATO da lista. NUNCA invente exercícios fora da lista nesse caso.
Retorne SOMENTE JSON neste formato (o campo "semanas" de cada fase é OBRIGATÓRIO e a soma deve bater com o total):
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
        .select("terapeuta_id, user_id, tipo_conta, created_at").eq("id", paciente_id).maybeSingle();
      bankOwner = ((pacRow as any)?.terapeuta_id) || userId;

      // TRAVA DE ENTITLEMENT: se quem chama é o PRÓPRIO cliente (não o
      // profissional), gerar o plano com IA exige Premium ou período de teste.
      // Cliente clínico não gera sozinho — paga o Premium ou o profissional monta.
      if ((pacRow as any)?.user_id && (pacRow as any).user_id === userId) {
        const tipo = (pacRow as any).tipo_conta;
        const emTeste = tipo === "wellness_free" &&
          Date.now() < new Date((pacRow as any).created_at).getTime() + 7 * 86400000;
        if (tipo !== "wellness_premium" && !emTeste) {
          return new Response(JSON.stringify({ error: "Recurso Premium: assine o Premium ou peça ao seu profissional para montar o plano." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
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

    const listaBlock = disponiveis.length
      ? `\n\nExercícios disponíveis no banco da clínica — use SOMENTE estes e preencha "id" com o id exato (NÃO invente exercícios fora desta lista):\n${disponiveis.slice(0, 250).map((e) => `- [${e.id}] ${e.nome}${e.grupo ? ` (${e.grupo})` : ""}`).join("\n")}`
      : "";

    // TRÊS MOTORES (fonte única em _shared/motores-plano.ts): MyID +
    // questionários clínicos validados + avaliação presencial (achados do
    // avatar clínico E as observações/notas do profissional no atendimento).
    let myidStr = "";
    let questTxt = "";
    let presencialTxt = "";
    if (paciente_id) {
      const motores = await carregarMotoresClinicos(admin, paciente_id);
      myidStr = textoMyID(motores, "treino");
      questTxt = textoQuestionarios(motores, "treino");
      presencialTxt = textoPresencial(motores, "treino");
    }

    const userPrompt = `
Paciente: ${idade ? idade + ' anos' : 'idade não informada'}, sexo ${sexo || 'não informado'}.
Antropometria: ${antropometria ? JSON.stringify(antropometria) : 'não informada'}.
Testes funcionais: ${testes ? JSON.stringify(testes) : 'não informados'}.

Objetivo: ${objetivo}
Nível: ${nivel}
Frequência: ${frequencia_semanal}x/semana
Duração total: ${duracao_semanas || 12} semanas (a SOMA das semanas das fases DEVE ser exatamente ${duracao_semanas || 12})
Restrições/lesões: ${restricoes || 'nenhuma'}${presencialTxt}${myidStr}${questTxt}${listaBlock}

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
    await logUsoIA("gerar-plano-treino", "gemini-2.5-flash", aiJson?.usage);
    const content = aiJson.choices?.[0]?.message?.content || "{}";
    let plano: any = {};
    try { plano = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) plano = JSON.parse(m[0]);
    }

    // Correção determinística das durações: garante que a soma das semanas das
    // fases seja EXATAMENTE a duração total (a IA às vezes erra por 1-2 semanas).
    const totalSemanas = Number(duracao_semanas) || 12;
    if (Array.isArray(plano?.fases) && plano.fases.length > 0) {
      plano.fases.forEach((f: any) => { f.semanas = Math.max(1, Math.round(Number(f.semanas) || 0)); });
      let soma = plano.fases.reduce((s: number, f: any) => s + f.semanas, 0);
      if (soma !== totalSemanas) {
        // Ajusta a última fase para fechar o total (mantém ≥ 1 semana).
        const ultima = plano.fases[plano.fases.length - 1];
        ultima.semanas = Math.max(1, ultima.semanas + (totalSemanas - soma));
        // Se ainda não bater (ex.: total menor que nº de fases), redistribui.
        soma = plano.fases.reduce((s: number, f: any) => s + f.semanas, 0);
        if (soma !== totalSemanas && plano.fases.length <= totalSemanas) {
          const base = Math.floor(totalSemanas / plano.fases.length);
          let resto = totalSemanas - base * plano.fases.length;
          plano.fases.forEach((f: any) => { f.semanas = base + (resto-- > 0 ? 1 : 0); });
        }
      }
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
