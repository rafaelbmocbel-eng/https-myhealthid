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

const SYSTEM = `Você é um assistente de PRONTUÁRIO CLÍNICO. Gera uma NOTA DE EVOLUÇÃO (SOAP curto) de uma sessão de acompanhamento, LIGADA À DIRETRIZ/CONDUTA vigente do paciente.

REGRA DA CONDUTA (campo "plano"):
- Se PRIMEIRA_VEZ = true (é a primeira sessão desta diretriz, ou a diretriz acabou de mudar numa reavaliação): escreva a CONDUTA/DIRETRIZ NA ÍNTEGRA no campo "plano" — todo o conteúdo da diretriz fornecida, organizado.
- Se PRIMEIRA_VEZ = false: NÃO reescreva a diretriz. No campo "plano" escreva apenas: "Conduta mantida conforme diretriz '<título>' (<data>)." — e, se houver CONDUTA ADICIONAL informada pelo profissional, acrescente-a depois.
- Se NÃO houver diretriz vigente fornecida: use o campo "plano" para a conduta que o profissional relatou hoje.
- Sempre incorpore a CONDUTA ADICIONAL informada, quando houver.

DEMAIS CAMPOS (subjetivo/objetivo/avaliacao): a partir do relato de hoje + contexto. Conciso, clínico, PT-BR. Não invente; marque "não informado" o que faltar. É uma EVOLUÇÃO (progresso desde a última sessão), não uma avaliação nova.

Responda ESTRITAMENTE em JSON:
{
  "subjetivo": "relato do paciente hoje (percepção de melhora/piora)",
  "objetivo": "o que foi observado/realizado hoje",
  "avaliacao": "síntese do estado atual vs sessão anterior (1-2 frases)",
  "plano": "a CONDUTA seguindo a regra acima",
  "evolucao_dor": "Melhora" | "Estável" | "Piora" | "Não informado",
  "resumo": "1 frase resumindo a sessão"
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try { await requireUser(req); } catch (r) { return r as Response; }

  try {
    const body = await req.json().catch(() => ({}));
    const { paciente_id, transcript, perfilProfissional, conduta_adicional } = body || {};
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

    // Contexto clínico + evoluções recentes + diretriz vigente.
    let ctx = "";
    let diretrizTexto = "";
    let primeiraVez = true;
    let diretrizMeta: { id: string; titulo: string; data: string; updated_at: string } | null = null;
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
        .select("tipo, titulo, descricao, dados_extras, created_at")
        .eq("paciente_id", paciente_id)
        .in("tipo", ["evolucao", "fechamento_sessao", "soap_note", "avaliacao_presencial"])
        .order("created_at", { ascending: false }).limit(6);
      if (notas?.length) {
        ctx += "\n\n[Evoluções/notas anteriores (mais recente primeiro)]\n" +
          notas.slice(0, 4).map((n: any) => `• ${new Date(n.created_at).toLocaleDateString("pt-BR")} (${n.tipo}): ${String(n.descricao).slice(0, 400)}`).join("\n");
      }

      // ── Diretriz/conduta VIGENTE — protocolo (fisio) ou diretriz_profissional (outras) ──
      const [protoRes, dirRes] = await Promise.all([
        admin.from("protocolos")
          .select("id, titulo, objetivo_geral, hierarquia_terapeutica, duracao_total, frequencia, status, updated_at")
          .eq("paciente_id", paciente_id).eq("status", "ativo")
          .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
        admin.from("diretrizes_profissionais")
          .select("id, area, titulo, objetivo, conteudo, updated_at")
          .eq("paciente_id", paciente_id)
          .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const proto = protoRes.data as any;
      const dir = dirRes.data as any;
      // Escolhe a mais recente entre as duas fontes.
      const usarProto = proto && (!dir || (proto.updated_at || "") >= (dir.updated_at || ""));
      const fonte = usarProto ? proto : dir;
      if (fonte) {
        diretrizMeta = {
          id: fonte.id,
          titulo: fonte.titulo || (usarProto ? "Plano de Reabilitação" : "Diretriz"),
          data: new Date(fonte.updated_at).toLocaleDateString("pt-BR"),
          updated_at: fonte.updated_at,
        };
        // Texto da diretriz (para escrever na íntegra quando for a 1ª vez).
        diretrizTexto = usarProto
          ? [
              `Título: ${proto.titulo || "—"}`,
              proto.objetivo_geral ? `Objetivo: ${proto.objetivo_geral}` : "",
              proto.duracao_total ? `Duração: ${proto.duracao_total} · Frequência: ${proto.frequencia || "—"}` : "",
              proto.hierarquia_terapeutica ? `Conduta/hierarquia: ${JSON.stringify(proto.hierarquia_terapeutica).slice(0, 3000)}` : "",
            ].filter(Boolean).join("\n")
          : [
              `Título: ${dir.titulo || "—"}`,
              dir.objetivo ? `Objetivo: ${dir.objetivo}` : "",
              dir.conteudo ? `Conteúdo: ${JSON.stringify(dir.conteudo).slice(0, 3000)}` : "",
            ].filter(Boolean).join("\n");

        // Primeira vez desta VERSÃO da diretriz? Procura uma evolução anterior que já
        // referenciou este id + updated_at. Se achou, não é a primeira → "conduta mantida".
        primeiraVez = !((notas || []).some((n: any) =>
          n.tipo === "evolucao" &&
          n.dados_extras?.diretriz_id === fonte.id &&
          n.dados_extras?.diretriz_updated_at === fonte.updated_at
        ));
      }
    }

    const blocoDiretriz = diretrizMeta
      ? `\n\n[Diretriz/conduta vigente] (título: "${diretrizMeta.titulo}", de ${diretrizMeta.data})\nPRIMEIRA_VEZ = ${primeiraVez}\n${primeiraVez ? "→ escreva esta diretriz NA ÍNTEGRA no campo 'plano':" : "→ NÃO reescreva; use 'Conduta mantida conforme diretriz ...'"}\n${diretrizTexto}`
      : `\n\n[Diretriz/conduta vigente] Nenhuma diretriz registrada — use no 'plano' a conduta relatada hoje.`;
    const blocoAdicional = (conduta_adicional && String(conduta_adicional).trim())
      ? `\n\n[Conduta ADICIONAL informada pelo profissional — incorpore no 'plano']\n${String(conduta_adicional).slice(0, 2000)}`
      : "";

    const userPrompt = `
[Contexto do paciente]${ctx || "\n(sem contexto clínico registrado)"}${blocoDiretriz}${blocoAdicional}

[Relato da sessão de hoje — profissional]
${String(transcript).slice(0, 6000)}

Gere a NOTA DE EVOLUÇÃO no JSON especificado, seguindo a REGRA DA CONDUTA.`.trim();

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
      // Metadados da diretriz — o front salva em dados_extras p/ detectar "mantida" na próxima.
      diretriz_id: diretrizMeta?.id || null,
      diretriz_updated_at: diretrizMeta?.updated_at || null,
      diretriz_titulo: diretrizMeta?.titulo || null,
      primeira_vez: primeiraVez,
      tem_diretriz: !!diretrizMeta,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error)?.message || "Falha ao gerar a evolução." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
