// Gera a DIRETRIZ DE TRATAMENTO por LENTE (médico, psicólogo, terapeuta
// ocupacional, dentista) — plano por fases com metas mensuráveis, orientações e
// marcadores a acompanhar, a partir da AVALIAÇÃO PRESENCIAL (achados do avatar
// clínico + observações do profissional), MyID, questionários e história.
// Mesmo molde das diretrizes de treino/nutrição; salva RASCUNHO em
// diretrizes_profissionais na área da lente.
import { requireUser } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logUsoIA } from "../_shared/log-ia.ts";
import { carregarMotoresClinicos, textoMyID, textoPresencial, textoQuestionarios } from "../_shared/motores-plano.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Área (coluna diretrizes_profissionais.area) → persona + fases-guia da lente.
const LENTES: Record<string, { persona: string; fasesGuia: string }> = {
  fisioterapia: {
    persona: `Você é uma EQUIPE de fisioterapeutas montando o PLANO DE TRATAMENTO fisioterápico de um paciente, a partir da avaliação presencial (achados do avatar clínico + observações do profissional), MyID e questionários.
Cubra TODA a fisioterapia — identifique a(s) área(s) pelos achados e escolha a conduta e os EXERCÍCIOS/TÉCNICAS TERAPÊUTICAS ESPECÍFICAS de CADA condição encontrada, seja qual for:
- Ortopédica/traumato-ortopédica e pós-operatória (tendinopatias, entorses, fraturas, pós-cirúrgico de ombro/joelho/quadril, LCA, manguito rotador...);
- Coluna/postural (lombalgia, cervicalgia, hérnia, escoliose — Schroth/SEAS, McKenzie, estabilização segmentar, RPG);
- Neurofuncional (AVC, Parkinson, lesão medular, paralisia, neuropatias — facilitação neuromuscular, treino de marcha e equilíbrio, Bobath/PNF);
- Cardiorrespiratória e pneumofuncional (DPOC, pós-COVID, reabilitação cardíaca, higiene brônquica, treino ventilatório, condicionamento);
- Uroginecológica/pélvica (incontinência, pós-parto, disfunções do assoalho pélvico — Kegel, biofeedback);
- ATM/DTM, esportiva (retorno ao esporte, prevenção de lesão, pliometria), reumatológica, geriátrica (quedas, sarcopenia), vestibular (VPPB — Epley, reabilitação vestibular), linfática, respiratória pediátrica etc.
Se a área específica não estiver explícita, deduza pelos achados/queixa e trate de acordo. Estruture SEMPRE por fases (controle da dor/proteção → mobilização e fortalecimento → retorno funcional/manutenção), respeitando severidade e as observações do profissional. Em cada fase, liste os exercícios/técnicas específicos com progressão. Marcadores por fase: ADM, dor (EVA), força/estabilidade, funcionalidade (com alvo). Cite evidência quando aplicável. NÃO prescreva medicação; sinalize encaminhamentos médicos quando indicado.`,
    fasesGuia: "Gere 3 fases (controle e proteção → mobilização e fortalecimento → retorno funcional/manutenção).",
  },
  medicina: {
    persona: "Você é uma EQUIPE médica montando o PLANO DE CONDUTA/tratamento de um paciente. Estruture como conduta clínica por fases: hipóteses/objetivos, orientações, exames e marcadores a acompanhar (com alvo), reavaliação. Cite diretrizes (SBC, SBEM, NICE, UpToDate) quando aplicável. NÃO prescreva doses de medicação — indique classes/linhas de cuidado e sinalize o que decidir na consulta. Sinalize encaminhamentos.",
    fasesGuia: "Gere 3 fases (estabilização/diagnóstico → tratamento → manutenção/prevenção).",
  },
  psicologia: {
    persona: "Você é uma EQUIPE de psicólogos montando o PLANO TERAPÊUTICO de um paciente. Estruture por fases: objetivos terapêuticos, abordagem/técnicas (TCC, ACT, etc. conforme quadro), tarefas/orientações e marcadores (PHQ-9, GAD-7, K10) com alvo, e reavaliação. Foco em vínculo, funcionalidade e segurança. NÃO prescreva medicação (encaminhe ao psiquiatra quando indicado). Sinalize risco quando houver.",
    fasesGuia: "Gere 3 fases (acolhimento/estabilização → processo terapêutico → consolidação/alta).",
  },
  terapia_ocupacional: {
    persona: "Você é uma EQUIPE de terapeutas ocupacionais montando o PLANO OCUPACIONAL de um paciente. Estruture por fases: ocupações significativas e AVDs-alvo, intervenções e adaptações de ambiente/tecnologia assistiva, orientações e marcadores de desempenho ocupacional (com alvo), reavaliação. Referencial AOTA/OTPF, CIF. Vincule sempre à atividade significativa.",
    fasesGuia: "Gere 3 fases (avaliação/adaptação → treino de desempenho → participação/manutenção).",
  },
  odontologia: {
    persona: "Você é uma EQUIPE de cirurgiões-dentistas montando o PLANO DE TRATAMENTO odontológico de um paciente. Estruture por fases: controle de urgência/dor, adequação do meio bucal (higiene, periodontia, cárie), reabilitação e manutenção/preventivo. Orientações de higiene e hábitos (bruxismo, tabagismo), marcadores a acompanhar (índice de placa, sangramento) com alvo, reavaliação. NÃO prescreva medicação sistêmica fora do escopo; sinalize encaminhamentos médicos.",
    fasesGuia: "Gere 3 fases (urgência/adequação do meio bucal → reabilitação → manutenção/preventivo).",
  },
};

function systemPrompt(area: string): string {
  const l = LENTES[area];
  return `${l.persona}
Padrão de qualidade: diretriz digna de consultório — fases progressivas com duração definida, metas MENSURÁVEIS (com como medir), orientações práticas, marcadores a acompanhar com valores-alvo e reavaliação ao fim de cada fase.
Baseie TUDO nos dados fornecidos. Os achados da AVALIAÇÃO PRESENCIAL e as observações do profissional têm PRIORIDADE. Não recomende nada fora do escopo da sua profissão.
Retorne SOMENTE JSON neste formato:
{
  "titulo": "string curta",
  "objetivo": "string (1-2 linhas)",
  "resumo_clinico": "string: o que os dados mostram e o que a diretriz ataca (3-4 linhas)",
  "fases": [
    { "numero": 1, "titulo": "string", "duracao_semanas": 4, "foco": "string curta",
      "metas": [ { "descricao": "string", "como_medir": "string" } ],
      "orientacoes": ["string"],
      "marcadores": [ { "nome": "string", "atual": "valor atual se houver", "alvo": "string" } ],
      "reavaliacao": "o que repetir/medir ao fim da fase" }
  ],
  "alertas": ["pontos de atenção para o profissional"]
}
${l.fasesGuia}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let userId: string;
    try { ({ userId } = await requireUser(req)); } catch (r) { return r as Response; }
    const body = await req.json();
    const paciente_id: string = (body?.paciente_id || "").toString();
    const area: string = (body?.area || "").toString();
    if (!paciente_id) {
      return new Response(JSON.stringify({ error: "paciente_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!LENTES[area]) {
      return new Response(JSON.stringify({ error: `área inválida: ${area}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: pac } = await admin.from("pacientes")
      .select("id, sexo, data_nascimento")
      .eq("id", paciente_id).eq("terapeuta_id", userId).maybeSingle();
    if (!pac) {
      return new Response(JSON.stringify({ error: "Paciente não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const idade = pac.data_nascimento
      ? Math.floor((Date.now() - new Date(pac.data_nascimento).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null;

    // TRÊS MOTORES: MyID + questionários validados + avaliação presencial.
    const motores = await carregarMotoresClinicos(admin, paciente_id);
    const contexto = {
      myid: !!motores.scores,
      questionarios: motores.questionarios.length,
      avaliacao_presencial: motores.presencial.length,
    };

    const perfil = [
      `Paciente: ${idade ? idade + " anos" : "idade ?"}, sexo ${pac.sexo || "?"}.`,
      textoPresencial(motores, "clinica"),
      textoMyID(motores, "clinica"),
      textoQuestionarios(motores, "clinica"),
    ].filter(Boolean).join("\n");

    const userPrompt = `${perfil}\n\nObjetivo pedido pelo profissional: ${body?.objetivo || "conduta clínica adequada ao quadro"}.\nObservações do profissional: ${body?.observacoes || "-"}\n\nMonte a diretriz de tratamento por fases. Retorne o JSON.`;

    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 120_000);
    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST", signal: ctrl.signal,
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt(area) }, { role: "user", content: userPrompt }],
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
    await logUsoIA("gerar-diretriz-clinica", "gemini-2.5-flash", aiJson?.usage);
    const content = aiJson.choices?.[0]?.message?.content || "{}";
    let diretriz: any = {};
    try { diretriz = JSON.parse(content); } catch { const m = content.match(/\{[\s\S]*\}/); if (m) diretriz = JSON.parse(m[0]); }
    if (!Array.isArray(diretriz?.fases) || diretriz.fases.length === 0) {
      throw new Error("A IA não retornou fases válidas — tente novamente");
    }

    const { error: upErr } = await admin.from("diretrizes_profissionais").upsert({
      terapeuta_id: userId,
      paciente_id,
      area,
      titulo: diretriz.titulo || "Diretriz de tratamento",
      objetivo: diretriz.objetivo || body?.objetivo || null,
      status: "rascunho",
      conteudo: diretriz,
      contexto,
      enviada_portal: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: "terapeuta_id,paciente_id,area" });
    if (upErr) throw new Error(`Falha ao salvar: ${upErr.message}`);

    return new Response(JSON.stringify({ ok: true, diretriz, contexto }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
