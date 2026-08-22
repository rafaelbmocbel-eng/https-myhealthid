// Revisor de Segurança de Planos — agente clínico que, ANTES de o profissional
// liberar um plano (treino, nutrição ou diretriz), revisa o plano à luz do
// contexto do paciente (MyID + avaliação presencial + questionários +
// restrições/condições) e sinaliza contraindicações, incoerências e sinais de
// alerta. É ADVISÓRIO — não bloqueia; só avisa o profissional.
// Usa o mesmo provedor (Gemini) e os mesmos motores clínicos das outras funções.
import { requireUser } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { carregarMotoresClinicos, textoMyID, textoPresencial, textoQuestionarios, type FocoPlano } from "../_shared/motores-plano.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um REVISOR CLÍNICO DE SEGURANÇA de planos de saúde (fisioterapia/reabilitação, treino, nutrição e diretrizes). Sua função é revisar um plano já elaborado e apontar, à luz do contexto clínico do paciente, apenas o que merece atenção do profissional ANTES de liberar ao paciente.

Procure especificamente:
- CONTRAINDICAÇÕES: o plano propõe algo desaconselhado para uma condição/lesão/restrição/medicação relatada (ex.: carga alta sobre região com achado ativo; alimento que conflita com comorbidade; exercício vigoroso quando a triagem pediu cautela).
- INCOERÊNCIAS: o plano não conversa com a queixa/diagnóstico, com o MyID ou com a avaliação presencial (ex.: foco em região errada; ignora o driver principal do MyID).
- SINAIS DE ALERTA / "red flags": algo que sugira necessidade de encaminhamento ou avaliação adicional antes de prosseguir.
- LACUNAS: falta progressão, falta orientação de segurança em exercício de risco, ausência de reavaliação.

Regras:
- Seja específico e acionável; cite a parte do plano e a razão clínica.
- NÃO invente dados que não estão no contexto. Se o contexto é insuficiente para julgar, diga isso como severidade "baixa".
- Se o plano estiver seguro e coerente, retorne flags: [] e um resumo curto positivo.
- Não reescreva o plano; só aponte e sugira o ajuste.

Responda ESTRITAMENTE em JSON:
{
  "resumo": "1-2 frases",
  "risco_geral": "baixo" | "medio" | "alto",
  "flags": [
    { "severidade": "alta" | "media" | "baixa", "titulo": "curto", "descricao": "o problema e a razão clínica", "sugestao": "o ajuste recomendado", "onde": "a parte do plano (ex.: Fase 2 / refeição do almoço)" }
  ]
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let userId = "";
  try { ({ userId } = await requireUser(req)); } catch (r) { return r as Response; }
  void userId;

  try {
    const body = await req.json().catch(() => ({}));
    const { paciente_id, tipo, plano } = body || {};
    const foco: FocoPlano = tipo === "nutricao" ? "nutricao" : tipo === "treino" ? "treino" : "clinica";

    if (!plano) {
      return new Response(JSON.stringify({ error: "Plano ausente para revisar." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "IA indisponível (sem chave configurada)." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Contexto clínico do paciente (mesmos motores das gerações) + restrições.
    let myidStr = "", presencialTxt = "", questTxt = "", restricoesTxt = "";
    if (paciente_id) {
      const motores = await carregarMotoresClinicos(admin, paciente_id);
      myidStr = textoMyID(motores, foco);
      presencialTxt = textoPresencial(motores, foco);
      questTxt = textoQuestionarios(motores, foco);
      const { data: pac } = await admin.from("pacientes")
        .select("condicoes_preexistentes, alergias, medicamentos_uso, queixa_principal")
        .eq("id", paciente_id).maybeSingle();
      if (pac) {
        const partes: string[] = [];
        if (pac.queixa_principal) partes.push(`Queixa principal: ${pac.queixa_principal}`);
        if (pac.condicoes_preexistentes) partes.push(`Condições preexistentes: ${pac.condicoes_preexistentes}`);
        if (pac.alergias) partes.push(`Alergias: ${pac.alergias}`);
        if (pac.medicamentos_uso) partes.push(`Medicamentos em uso: ${pac.medicamentos_uso}`);
        if (partes.length) restricoesTxt = "\n\n[Ficha do paciente]\n" + partes.join("\n");
      }
    }

    const rotuloTipo = foco === "nutricao" ? "PLANO NUTRICIONAL" : foco === "treino" ? "PLANO DE TREINO/REABILITAÇÃO" : "DIRETRIZ/PLANO DE TRATAMENTO";
    const userPrompt = `
Revise o seguinte ${rotuloTipo} para segurança e coerência clínica.

[Contexto clínico do paciente]${myidStr}${presencialTxt}${questTxt}${restricoesTxt || "\n(sem restrições/condições registradas na ficha)"}

[Plano a revisar — JSON]
${JSON.stringify(plano).slice(0, 12000)}

Aponte contraindicações, incoerências, sinais de alerta e lacunas. Responda no JSON especificado.`.trim();

    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 60_000);
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
    let out: any = {};
    try { out = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) out = JSON.parse(m[0]);
    }

    const flags = Array.isArray(out?.flags) ? out.flags : [];
    return new Response(JSON.stringify({
      resumo: out?.resumo || (flags.length ? "Pontos de atenção encontrados." : "Nenhum ponto crítico encontrado."),
      risco_geral: out?.risco_geral || (flags.some((f: any) => f.severidade === "alta") ? "alto" : flags.length ? "medio" : "baixo"),
      flags,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "Falha ao revisar o plano." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
