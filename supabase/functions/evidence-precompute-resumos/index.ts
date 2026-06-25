// Pré-computa resumo_clinico + aplicacao_pratica para artigos da evidence_library.
// Roda em lotes para economizar tokens — cada artigo é resumido 1x e reutilizado
// para sempre por todas as funções de IA que injetam evidência no prompt.
//
// Uso:
//   POST /functions/v1/evidence-precompute-resumos
//   body opcional: { "batch_size": 20, "model": "gemini-3.1-flash-lite" }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL_DEFAULT = "gemini-3.1-flash-lite";
const BATCH_DEFAULT = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!GEMINI_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
      return json({ error: "Missing env" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const batchSize: number = Math.min(Math.max(body.batch_size ?? BATCH_DEFAULT, 1), 50);
    const model: string = body.model ?? MODEL_DEFAULT;

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: artigos, error: selErr } = await supabase
      .from("evidence_library")
      .select("id, title, abstract, journal, year, study_type, evidence_level, authors")
      .is("resumo_clinico", null)
      .not("abstract", "is", null)
      .limit(batchSize);

    if (selErr) throw selErr;
    if (!artigos || artigos.length === 0) {
      return json({ ok: true, processed: 0, message: "Nenhum artigo pendente" });
    }

    let ok = 0;
    let fail = 0;

    for (const art of artigos) {
      try {
        const sys = `Você é um assistente clínico. Para o artigo científico abaixo, gere 2 textos curtos em português brasileiro:
1) resumo_clinico: 2-3 frases (máx 400 caracteres) com o achado principal e implicação clínica.
2) aplicacao_pratica: 1-2 frases (máx 250 caracteres) explicando como aplicar na prática de fisioterapia/reabilitação/treino.
Seja objetivo, sem floreio acadêmico. Não invente dados que não estão no abstract.`;

        const user = `Título: ${art.title}
Journal: ${art.journal ?? "—"} (${art.year ?? "—"})
Tipo: ${art.study_type ?? "—"} | Nível ${art.evidence_level ?? "—"}
Autores: ${(art.authors ?? []).slice(0, 3).join(", ")}

Abstract:
${(art.abstract ?? "").slice(0, 4000)}`;

        const resp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: sys },
              { role: "user", content: user },
            ],
            tools: [{
              type: "function",
              function: {
                name: "salvar_resumo",
                description: "Salva resumo clínico e aplicação prática",
                parameters: {
                  type: "object",
                  properties: {
                    resumo_clinico: { type: "string" },
                    aplicacao_pratica: { type: "string" },
                  },
                  required: ["resumo_clinico", "aplicacao_pratica"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "salvar_resumo" } },
          }),
        });

        if (!resp.ok) {
          if (resp.status === 429 || resp.status === 402) {
            return json({ ok: false, processed: ok, failed: fail, stopped_at_status: resp.status, message: "Rate limit / créditos — pare e retome depois" }, 200);
          }
          fail++;
          continue;
        }

        const data = await resp.json();
        const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (!args) { fail++; continue; }
        const parsed = JSON.parse(args);

        const { error: upErr } = await supabase
          .from("evidence_library")
          .update({
            resumo_clinico: parsed.resumo_clinico,
            aplicacao_pratica: parsed.aplicacao_pratica,
            resumo_gerado_em: new Date().toISOString(),
            resumo_modelo: model,
          })
          .eq("id", art.id);

        if (upErr) { fail++; continue; }
        ok++;
      } catch (e) {
        console.error("artigo falhou", art.id, e);
        fail++;
      }
    }

    const { count: pendentes } = await supabase
      .from("evidence_library")
      .select("id", { count: "exact", head: true })
      .is("resumo_clinico", null)
      .not("abstract", "is", null);

    return json({ ok: true, processed: ok, failed: fail, pendentes_restantes: pendentes ?? 0, model });
  } catch (e) {
    console.error("evidence-precompute-resumos error:", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
