// Recebe respostas da bateria de "Histórico Clínico" do portal do paciente
// (fraturas, cirurgias, traumas, acidentes, doenças sistêmicas etc.) e usa IA
// para sugerir sistema/região/severidade. Grava sempre como
// tipo_diagnostico: 'historico_relatado' + status: 'resolvido' (convenção já
// usada no AvatarClinicoCard para manter autorelato fora do score de
// homeostase) e metadata.revisado_profissional: false, para aparecer na fila
// de revisão do profissional sem nunca virar achado clínico por conta própria.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser, corsHeaders } from "../_shared/auth.ts";
import { hojeBR } from "../_shared/tz.ts";

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

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const regionList = regions.map((r) => `- ${r.id} → ${r.label} (sistemas: ${r.sistemas.join(", ")})`).join("\n");

    const systemPrompt = `Você é um assistente clínico que classifica respostas de um questionário de antecedentes/histórico de saúde do paciente (fraturas, cirurgias, traumas, acidentes, doenças sistêmicas, malformações, tratamentos).

Para CADA resposta recebida, retorne:
- indice: repita exatamente o número "#" da resposta
- categoria: repita exatamente a categoria recebida
- regiao_id: o ID de região anatômica MAIS relevante (escolha sempre uma, mesmo para condições sistêmicas — use o órgão/estrutura mais associado)
- sistema: o sistema corporal correspondente à região escolhida
- tipo_achado: um rótulo clínico curto e objetivo (ex: "Fratura de rádio (relatada)", "Histórico de cirurgia de vesícula", "Trauma cervical tipo chicote (relatado)")
- severidade: 0 a 4, estimando gravidade clínica potencial pela descrição (cirurgias/fraturas antigas e resolvidas tendem a 1, traumas relevantes ou condições ativas 2-3, red flags claras 4)

REGRAS:
- Nunca invente um regiao_id fora da lista abaixo.
- Se a resposta não descrever nada clinicamente relevante (ex: "não", "nunca"), NÃO a inclua no retorno.
- Categoria "historico_familiar" é doença de PARENTES, não do paciente: o tipo_achado deve começar com "Histórico familiar:" (ex: "Histórico familiar: câncer de mama (mãe)") e severidade no máximo 1.

REGIÕES DISPONÍVEIS:
${regionList}`;

    const userPrompt = answers
      .map((a, i) => `#${i}\nCategoria: ${a.categoria}\nPergunta: ${a.pergunta}\nResposta: ${a.resposta}`)
      .join("\n\n");

    // Padrão comprovado no app: JSON mode (response_format). O function-calling
    // forçado (tool_choice) não é bem suportado pelo endpoint OpenAI-compat do
    // Gemini e retornava non-2xx. Pedimos o JSON direto no prompt.
    const formatoPrompt = `\n\nResponda APENAS com um objeto JSON no formato:\n{"achados":[{"indice":<número # da resposta>,"categoria":"<repita a categoria recebida>","regiao_id":"<id da lista>","sistema":"<sistema da região>","tipo_achado":"<rótulo clínico curto>","severidade":<inteiro 0 a 4>}]}\nSe nada for clinicamente relevante, retorne {"achados":[]}.`;

    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 45_000);
    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt + formatoPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
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
    const content = aiData.choices?.[0]?.message?.content ?? "";
    let args: { achados?: any[] } = { achados: [] };
    try {
      args = JSON.parse(content);
    } catch {
      // JSON mode raramente escapa — tenta extrair o objeto do texto
      const m = content.match(/\{[\s\S]*\}/);
      if (m) { try { args = JSON.parse(m[0]); } catch { /* mantém vazio */ } }
    }

    const validIds = new Set(regions.map((r) => r.id));
    const validSistemas = new Set(regions.flatMap((r) => r.sistemas));
    const respostaPorCategoria = new Map(answers.map((a) => [a.categoria, a]));
    // Várias cirurgias/medicamentos têm a mesma categoria: a proveniência vai
    // pelo índice da resposta (a categoria sozinha apontava sempre a última).
    const respostaDoAchado = (a: any): Answer | undefined => {
      const i = Number(a?.indice);
      if (Number.isInteger(i) && answers[i] && answers[i].categoria === a.categoria) return answers[i];
      return respostaPorCategoria.get(a.categoria);
    };

    const achados = (args.achados ?? []).filter((a: any) =>
      validIds.has(a.regiao_id) && validSistemas.has(a.sistema) && respostaDoAchado(a)
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

    // A mesma informação reenviada (o card manda o histórico inteiro a cada
    // envio) gera um único possível achado: compara com o que já existe.
    const norm = (t: string) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
    const { data: existentes } = await admin
      .from("eventos_clinicos_anatomicos")
      .select("regiao_id, tipo_achado, metadata")
      .eq("paciente_id", paciente.id)
      .eq("tipo_diagnostico", "historico_relatado");
    const jaExiste = new Set<string>();
    for (const e of existentes ?? []) {
      const chave = (e as any).metadata?.chave_resposta;
      if (chave) jaExiste.add(`r:${chave}`);
      jaExiste.add(`a:${e.regiao_id}|${norm(e.tipo_achado)}`);
    }

    const hoje = hojeBR();
    const eventos = achados.flatMap((a: any) => {
      const origem = respostaDoAchado(a)!;
      const chaveResposta = `${origem.categoria}|${norm(origem.resposta)}`;
      const chaveAchado = `${a.regiao_id}|${norm(a.tipo_achado)}`;
      if (jaExiste.has(`r:${chaveResposta}`) || jaExiste.has(`a:${chaveAchado}`)) return [];
      jaExiste.add(`r:${chaveResposta}`);
      jaExiste.add(`a:${chaveAchado}`);
      const familiar = origem.categoria === "historico_familiar";
      const sev = Math.max(0, Math.min(4, Math.round(Number(a.severidade) || 0)));
      return [{
        paciente_id: paciente.id,
        terapeuta_id: paciente.terapeuta_id,
        regiao_id: a.regiao_id,
        sistema: a.sistema,
        tipo_achado: familiar && !/^hist[óo]rico familiar/i.test(String(a.tipo_achado)) ? `Histórico familiar: ${a.tipo_achado}` : a.tipo_achado,
        tipo_diagnostico: "historico_relatado",
        origem: "autocadastro_paciente",
        severidade: familiar ? Math.min(sev, 1) : sev,
        status: "resolvido",
        data_inicio: hoje,
        data_resolucao: hoje,
        visivel_paciente: false,
        notas_clinicas: `Relatado pelo paciente no questionário de histórico clínico.\nPergunta: ${origem.pergunta}\nResposta: ${origem.resposta}`,
        metadata: {
          categoria: a.categoria,
          fonte: "questionario_historico_clinico",
          revisado_profissional: false,
          chave_resposta: chaveResposta,
          ...(familiar ? { familiar: true } : {}),
        },
      }];
    });

    if (eventos.length === 0) {
      return new Response(JSON.stringify({ criados: 0, duplicados: achados.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
