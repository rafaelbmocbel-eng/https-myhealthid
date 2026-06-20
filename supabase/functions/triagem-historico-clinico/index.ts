// Recebe respostas da bateria de "Histórico Clínico" do portal do paciente
// (fraturas, cirurgias, traumas, acidentes, doenças sistêmicas etc.) e usa IA
// para sugerir sistema/região/severidade. Grava sempre como
// tipo_diagnostico: 'historico_relatado' + status: 'resolvido' (convenção já
// usada no AvatarClinicoCard para manter autorelato fora do score de
// homeostase) e metadata.revisado_profissional: false, para aparecer na fila
// de revisão do profissional sem nunca virar achado clínico por conta própria.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser, corsHeaders } from "../_shared/auth.ts";

interface Answer { categoria: string; pergunta: string; resposta: string }
interface RegionDef { id: string; label: string; sistemas: string[] }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let userId: string;
    try {
      ({ userId } = await requireUser(req));
    } catch (r) {
      return r as Response;
    }

    const body = await req.json();
    const answers: Answer[] = Array.isArray(body?.answers)
      ? body.answers.filter((a: any) => (a?.resposta || "").trim().length >= 2)
      : [];
    const regions: RegionDef[] = Array.isArray(body?.regions) ? body.regions : [];

    if (answers.length === 0) {
      return new Response(JSON.stringify({ criados: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (regions.length === 0) {
      return new Response(JSON.stringify({ error: "regions required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const regionList = regions.map((r) => `- ${r.id} → ${r.label} (sistemas: ${r.sistemas.join(", ")})`).join("\n");

    const systemPrompt = `Você é um assistente clínico que classifica respostas de um questionário de antecedentes/histórico de saúde do paciente (fraturas, cirurgias, traumas, acidentes, doenças sistêmicas, malformações, tratamentos).

Para CADA resposta recebida, retorne:
- categoria: repita exatamente a categoria recebida
- regiao_id: o ID de região anatômica MAIS relevante (escolha sempre uma, mesmo para condições sistêmicas — use o órgão/estrutura mais associado)
- sistema: o sistema corporal correspondente à região escolhida
- tipo_achado: um rótulo clínico curto e objetivo (ex: "Fratura de rádio (relatada)", "Histórico de cirurgia de vesícula", "Trauma cervical tipo chicote (relatado)")
- severidade: 0 a 4, estimando gravidade clínica potencial pela descrição (cirurgias/fraturas antigas e resolvidas tendem a 1, traumas relevantes ou condições ativas 2-3, red flags claras 4)

REGRAS:
- Nunca invente um regiao_id fora da lista abaixo.
- Se a resposta não descrever nada clinicamente relevante (ex: "não", "nunca"), NÃO a inclua no retorno.

REGIÕES DISPONÍVEIS:
${regionList}`;

    const userPrompt = answers
      .map((a) => `Categoria: ${a.categoria}\nPergunta: ${a.pergunta}\nResposta: ${a.resposta}`)
      .join("\n\n");

    const tool = {
      type: "function",
      function: {
        name: "report_historico_clinico",
        description: "Reporta achados de histórico clínico classificados por região/sistema.",
        parameters: {
          type: "object",
          properties: {
            achados: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  categoria: { type: "string" },
                  regiao_id: { type: "string" },
                  sistema: { type: "string" },
                  tipo_achado: { type: "string" },
                  severidade: { type: "integer", minimum: 0, maximum: 4 },
                },
                required: ["categoria", "regiao_id", "sistema", "tipo_achado", "severidade"],
                additionalProperties: false,
              },
            },
          },
          required: ["achados"],
          additionalProperties: false,
        },
      },
    };

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "report_historico_clinico" } },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiRes.text();
      console.error("[triagem-historico-clinico] AI error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "Falha na IA", details: t.slice(0, 300) }), {
        status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : { achados: [] };

    const validIds = new Set(regions.map((r) => r.id));
    const validSistemas = new Set(regions.flatMap((r) => r.sistemas));
    const respostaPorCategoria = new Map(answers.map((a) => [a.categoria, a]));

    const achados = (args.achados ?? []).filter((a: any) =>
      validIds.has(a.regiao_id) && validSistemas.has(a.sistema) && respostaPorCategoria.has(a.categoria)
    );

    if (achados.length === 0) {
      return new Response(JSON.stringify({ criados: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: paciente, error: pacienteErr } = await admin
      .from("pacientes")
      .select("id, terapeuta_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (pacienteErr || !paciente) {
      return new Response(JSON.stringify({ error: "Paciente não encontrado para este usuário." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const eventos = achados.map((a: any) => {
      const origem = respostaPorCategoria.get(a.categoria)!;
      return {
        paciente_id: paciente.id,
        terapeuta_id: paciente.terapeuta_id,
        regiao_id: a.regiao_id,
        sistema: a.sistema,
        tipo_achado: a.tipo_achado,
        tipo_diagnostico: "historico_relatado",
        origem: "autocadastro_paciente",
        severidade: a.severidade,
        status: "resolvido",
        data_inicio: hoje,
        data_resolucao: hoje,
        visivel_paciente: false,
        notas_clinicas: `Relatado pelo paciente no questionário de histórico clínico.\nPergunta: ${origem.pergunta}\nResposta: ${origem.resposta}`,
        metadata: {
          categoria: a.categoria,
          fonte: "questionario_historico_clinico",
          revisado_profissional: false,
        },
      };
    });

    const { error: insErr } = await admin.from("eventos_clinicos_anatomicos").insert(eventos);
    if (insErr) {
      console.error("[triagem-historico-clinico] insert error", insErr);
      return new Response(JSON.stringify({ error: "Não foi possível salvar o histórico." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ criados: eventos.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[triagem-historico-clinico] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
