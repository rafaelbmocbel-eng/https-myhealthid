// Assistente de Prontuário / Evolução — gera uma NOTA DE EVOLUÇÃO estruturada
// (SOAP curto) a partir de um relato rápido da sessão do profissional + o
// contexto clínico do paciente (avaliação presencial, MyID, questionários,
// evoluções anteriores). É apoio: o profissional revisa e salva.
// Mesmo provedor (Gemini) e motores clínicos das outras funções.
import { requireUser } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { carregarMotoresClinicos, textoMyID, textoPresencial, textoQuestionarios, type FocoPlano } from "../_shared/motores-plano.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um assistente de PRONTUÁRIO CLÍNICO. Recebe o relato rápido de uma SESSÃO de acompanhamento (fisioterapia/reabilitação, treino, nutrição ou clínica) e o CONTEXTO do paciente, e produz uma NOTA DE EVOLUÇÃO concisa, no formato SOAP, focada no PROGRESSO desde a última sessão.

Regras:
- Seja CONCISO e clínico. Não invente achados: use só o que está no relato/contexto. Marque como "não informado" o que faltar.
- Ligue a sessão de hoje ao histórico (avaliação, diagnóstico, evoluções anteriores) quando fizer sentido — é uma EVOLUÇÃO, não uma avaliação nova.
- Português Brasileiro. Não prescreva nada fora do que o profissional relatou.

Responda ESTRITAMENTE em JSON:
{
  "subjetivo": "relato do paciente hoje (queixa, percepção de melhora/piora)",
  "objetivo": "o que foi observado/realizado (condutas, exercícios, testes)",
  "avaliacao": "síntese do estado atual e comparação com a sessão anterior (1-2 frases)",
  "plano": "conduta para a próxima sessão / orientações",
  "evolucao_dor": "Melhora" | "Estável" | "Piora" | "Não informado",
  "resumo": "1 frase resumindo a sessão"
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try { await requireUser(req); } catch (r) { return r as Response; }

  try {
    const body = await req.json().catch(() => ({}));
    const { paciente_id, transcript, perfilProfissional } = body || {};
    if (!transcript || String(transcript).trim().length < 10) {
      return new Response(JSON.stringify({ error: "Descreva a sessão com pelo menos algumas palavras." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "IA indisponível (sem chave configurada)." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const foco: FocoPlano = perfilProfissional === "nutricionista" ? "nutricao" : perfilProfissional === "educador_fisico" ? "treino" : "clinica";

    // Contexto clínico + evoluções recentes.
    let ctx = "";
    if (paciente_id) {
      try {
        const motores = await carregarMotoresClinicos(admin, paciente_id);
        ctx += textoMyID(motores, foco) + textoPresencial(motores, foco) + textoQuestionarios(motores, foco);
      } catch (_e) { /* contexto é best-effort */ }
      const { data: pac } = await admin.from("pacientes")
        .select("queixa_principal, condicoes_preexistentes, cassi_diagnostico")
        .eq("id", paciente_id).maybeSingle();
      if (pac) {
        const p: string[] = [];
        if (pac.queixa_principal) p.push(`Queixa principal: ${pac.queixa_principal}`);
        if (pac.cassi_diagnostico) p.push(`Diagnóstico: ${pac.cassi_diagnostico}`);
        if (pac.condicoes_preexistentes) p.push(`Condições: ${pac.condicoes_preexistentes}`);
        if (p.length) ctx += "\n\n[Ficha]\n" + p.join("\n");
      }
      const { data: notas } = await admin.from("notas_prontuario")
        .select("tipo, titulo, descricao, created_at")
        .eq("paciente_id", paciente_id)
        .in("tipo", ["evolucao", "fechamento_sessao", "soap_note", "avaliacao_presencial"])
        .order("created_at", { ascending: false }).limit(4);
      if (notas?.length) {
        ctx += "\n\n[Evoluções/notas anteriores (mais recente primeiro)]\n" +
          notas.map((n: any) => `• ${new Date(n.created_at).toLocaleDateString("pt-BR")} (${n.tipo}): ${String(n.descricao).slice(0, 400)}`).join("\n");
      }
    }

    const userPrompt = `
[Contexto do paciente]${ctx || "\n(sem contexto clínico registrado)"}

[Relato da sessão de hoje — profissional]
${String(transcript).slice(0, 6000)}

Gere a NOTA DE EVOLUÇÃO no JSON especificado.`.trim();

    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 60_000);
    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        temperature: 0.2,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite de uso atingido. Tente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`Gemini API: ${aiRes.status} ${txt.slice(0, 200)}`);
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content || "{}";
    let out: any = {};
    try { out = JSON.parse(content); } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) out = JSON.parse(m[0]);
    }

    return new Response(JSON.stringify({
      subjetivo: out?.subjetivo || "",
      objetivo: out?.objetivo || "",
      avaliacao: out?.avaliacao || "",
      plano: out?.plano || "",
      evolucao_dor: out?.evolucao_dor || "Não informado",
      resumo: out?.resumo || "",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error)?.message || "Falha ao gerar a evolução." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
