// Gera a DIRETRIZ NUTRICIONAL do paciente: acompanhamento por fases (com metas
// mensuráveis, orientações e marcadores de exame a acompanhar), a partir de
// TODOS os dados clínicos disponíveis — exames importados, bioimpedância,
// antropometria, sinais vitais, anamnese nutricional, MyID e história clínica.
// O resultado é salvo como RASCUNHO em diretrizes_profissionais: o profissional
// revisa e só então envia ao portal do cliente.
import { requireUser } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um GRUPO de nutricionistas clínicos com 15 anos de experiência (CFN/ASBRAN), montando juntos o acompanhamento nutricional de um cliente premium.
Padrão de qualidade: diretriz digna de consultório — fases progressivas com duração definida, metas MENSURÁVEIS (com como medir), orientações práticas, marcadores de exame a acompanhar com valores-alvo, e reavaliação definida ao fim de cada fase.
Baseie TUDO nos dados clínicos fornecidos (exames, bioimpedância, anamnese, MyID). Quando um exame indicar alteração (glicemia, lipidograma, vitaminas...), a diretriz DEVE endereçar isso com meta e marcador específicos, citando o dado.
Nada de prescrição de medicamentos ou suplementação com dose — no máximo "discutir suplementação de X com o profissional".
Retorne SOMENTE JSON neste formato:
{
  "titulo": "string curta",
  "objetivo": "string (1-2 linhas)",
  "resumo_clinico": "string: o que os dados mostram e o que a diretriz ataca (3-4 linhas)",
  "fases": [
    {
      "numero": 1,
      "titulo": "ex: Adaptação",
      "duracao_semanas": 4,
      "foco": "string curta",
      "metas": [ { "descricao": "string", "como_medir": "string" } ],
      "orientacoes": ["string"],
      "marcadores": [ { "nome": "ex: Glicemia em jejum", "atual": "valor atual se houver", "alvo": "ex: < 99 mg/dL" } ],
      "reavaliacao": "o que repetir/medir ao fim da fase"
    }
  ],
  "alertas": ["pontos de atenção para o profissional"]
}
Gere 3 fases (adaptação → desenvolvimento → consolidação), coerentes entre si e com progressão real.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let userId: string;
    try { ({ userId } = await requireUser(req)); } catch (r) { return r as Response; }
    const body = await req.json();
    const paciente_id: string = (body?.paciente_id || "").toString();
    if (!paciente_id) {
      return new Response(JSON.stringify({ error: "paciente_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // O paciente precisa ser deste profissional
    const { data: pac } = await admin.from("pacientes")
      .select("id, nome, sexo, data_nascimento, queixa_principal, historia_atual, condicoes_saude")
      .eq("id", paciente_id).eq("terapeuta_id", userId).maybeSingle();
    if (!pac) {
      return new Response(JSON.stringify({ error: "Paciente não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Todos os dados clínicos disponíveis
    const [exames, body_comp, antropo, vitais, anamnese, myid] = await Promise.all([
      admin.from("exames_importados").select("tipo, data_exame, dados_extraidos")
        .eq("paciente_id", paciente_id).order("data_exame", { ascending: false }).limit(5),
      admin.from("body_composition").select("*")
        .eq("paciente_id", paciente_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("antropometria").select("peso_kg, altura_cm, imc, gordura_pct, data_medicao")
        .eq("paciente_id", paciente_id).order("data_medicao", { ascending: false }).limit(1).maybeSingle(),
      admin.from("sinais_vitais").select("pa_sistolica, pa_diastolica, fc, glicemia, peso_kg, created_at")
        .eq("paciente_id", paciente_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("nutricao_anamnese").select("respostas")
        .eq("paciente_id", paciente_id).maybeSingle(),
      admin.from("myid_avaliacoes").select("resultado_processado")
        .eq("paciente_id", paciente_id).eq("status", "concluido")
        .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const idade = pac.data_nascimento
      ? Math.floor((Date.now() - new Date(pac.data_nascimento).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null;
    const scores = (myid.data?.resultado_processado as any)?.scores || null;
    const examesTxt = (exames.data || []).map((e: any) =>
      `Exame ${e.tipo || "?"} (${e.data_exame || "?"}): ${JSON.stringify(e.dados_extraidos).slice(0, 900)}`).join("\n");

    const contexto = {
      exames: (exames.data || []).length,
      bioimpedancia: !!body_comp.data,
      antropometria: !!antropo.data,
      sinais_vitais: !!vitais.data,
      anamnese: !!anamnese.data,
      myid: !!scores,
    };

    const perfil = [
      `Paciente: ${idade ? idade + " anos" : "idade ?"}, sexo ${pac.sexo || "?"}.`,
      pac.queixa_principal ? `Queixa: ${String(pac.queixa_principal).slice(0, 300)}` : "",
      pac.historia_atual ? `História: ${String(pac.historia_atual).slice(0, 500)}` : "",
      pac.condicoes_saude ? `Condições de saúde: ${JSON.stringify(pac.condicoes_saude).slice(0, 300)}` : "",
      body_comp.data ? `Bioimpedância: ${JSON.stringify(body_comp.data).slice(0, 600)}` : "",
      antropo.data ? `Antropometria: ${JSON.stringify(antropo.data)}` : "",
      vitais.data ? `Sinais vitais: ${JSON.stringify(vitais.data)}` : "",
      anamnese.data ? `Anamnese nutricional: ${JSON.stringify(anamnese.data.respostas).slice(0, 800)}` : "",
      scores ? `MyID (scores por dimensão): ${JSON.stringify(scores)}` : "",
      examesTxt ? `EXAMES CLÍNICOS:\n${examesTxt}` : "(sem exames importados)",
    ].filter(Boolean).join("\n");

    const userPrompt = `${perfil}\n\nObjetivo pedido pelo profissional: ${body?.objetivo || "melhora global do estado nutricional"}.\nObservações do profissional: ${body?.observacoes || "-"}\n\nMonte a diretriz nutricional por fases. Retorne o JSON.`;

    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 55_000);
    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST", signal: ctrl.signal,
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userPrompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!aiRes.ok) throw new Error(`Gemini API: ${aiRes.status}`);
    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content || "{}";
    let diretriz: any = {};
    try { diretriz = JSON.parse(content); } catch { const m = content.match(/\{[\s\S]*\}/); if (m) diretriz = JSON.parse(m[0]); }
    if (!Array.isArray(diretriz?.fases) || diretriz.fases.length === 0) {
      throw new Error("A IA não retornou fases válidas — tente novamente");
    }

    // Regerar substitui o rascunho — 1 diretriz por área/paciente (histórico: fase 2)
    const { error: upErr } = await admin.from("diretrizes_profissionais").upsert({
      terapeuta_id: userId,
      paciente_id,
      area: "nutricao",
      titulo: diretriz.titulo || "Diretriz nutricional",
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
