// Traduz TODOS os nomes da biblioteca de exercícios do terapeuta para
// português brasileiro (nomenclatura de academia), via Gemini. O dicionário
// local do upload cobre os termos comuns; esta função pega o nome COMPLETO —
// inclusive o que ficou em inglês ou misturado — e devolve um nome natural.
import { requireUser } from "../_shared/auth.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCachedDeterministic, saveCache, sha256Hex } from "../_shared/ai-cache.ts";
import { logUsoIA } from "../_shared/log-ia.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um tradutor especializado em educação física e fisioterapia. Traduza nomes de exercícios do inglês para o português do Brasil, usando a nomenclatura consagrada nas academias e clínicas brasileiras.
Regras:
- Traduza o nome COMPLETO, de forma natural (ex.: "dumbbell goblet squat" → "Agachamento goblet com halteres"; "seated cable row" → "Remada baixa sentada no cabo").
- Mantenha termos consagrados que os brasileiros usam em inglês quando for o padrão (burpee, kettlebell, hip thrust, mountain climber podem ficar, mas prefira o português quando existir uso corrente).
- Se o nome já estiver todo em português, devolva-o igual (só corrija capitalização/erros óbvios).
- Primeira letra maiúscula, sem ponto final, sem underscores ou hífens de arquivo.
Retorne SOMENTE JSON: { "itens": [ { "id": "string", "nome_pt": "string" } ] } — um item para CADA id recebido, na mesma ordem.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let userId: string;
    try { ({ userId } = await requireUser(req)); } catch (r) { return r as Response; }
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: exs, error: selErr } = await admin
      .from("biblioteca_exercicios")
      .select("id, nome, nome_original")
      .eq("terapeuta_id", userId)
      .eq("ativo", true)
      .order("nome");
    if (selErr) throw selErr;
    const todos = (exs || []) as { id: string; nome: string; nome_original: string | null }[];
    if (todos.length === 0) {
      return new Response(JSON.stringify({ ok: true, total: 0, traduzidos: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let traduzidos = 0, falhas = 0, doCache = 0;
    // Chave de cache por NOME de origem (determinística, reutilizável entre
    // profissionais): a tradução de "dumbbell goblet squat" é sempre a mesma.
    const chaveNome = async (e: { nome: string; nome_original: string | null }) =>
      sha256Hex(`traduz-nome|v1|${(e.nome_original || e.nome).trim().toLowerCase()}`);

    const aplicar = async (id: string, nome: string): Promise<boolean> => {
      if (!nome || nome.length > 120) return false;
      const { error: upErr } = await admin
        .from("biblioteca_exercicios").update({ nome }).eq("id", id).eq("terapeuta_id", userId);
      return !upErr;
    };

    const LOTE = 80;
    for (let i = 0; i < todos.length; i += LOTE) {
      const lote = todos.slice(i, i + LOTE);

      // 1) Resolve o que já está em cache; só o restante vai para a IA.
      const pendentes: { id: string; nome: string; nome_original: string | null; _hash: string }[] = [];
      for (const e of lote) {
        const h = await chaveNome(e);
        const cached = await getCachedDeterministic(admin, "traduzir-nome", h);
        const nomePt = (cached?.nome_pt || "").trim();
        if (nomePt) {
          if (await aplicar(e.id, nomePt)) { traduzidos++; doCache++; } else falhas++;
        } else {
          pendentes.push({ ...e, _hash: h });
        }
      }
      if (pendentes.length === 0) continue;

      const hashById: Record<string, string> = {};
      for (const p of pendentes) hashById[p.id] = p._hash;
      const listaTxt = pendentes
        .map((e) => `${e.id} ||| ${e.nome_original || e.nome} ||| atual: ${e.nome}`)
        .join("\n");
      const userPrompt = `Exercícios (formato: id ||| nome original do arquivo ||| nome atual no app). Traduza a partir do nome ORIGINAL quando existir; senão, do atual.\n\n${listaTxt}\n\nRetorne o JSON com um item por id.`;

      try {
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
        await logUsoIA("traduzir-biblioteca", "gemini-2.5-flash", aiJson?.usage);
        const content = aiJson.choices?.[0]?.message?.content || "{}";
        let parsed: any = {};
        try { parsed = JSON.parse(content); } catch { const m = content.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); }
        const itens: { id: string; nome_pt: string }[] = Array.isArray(parsed?.itens) ? parsed.itens : [];
        const validos = new Set(pendentes.map((e) => e.id));
        for (const it of itens) {
          const nome = (it?.nome_pt || "").trim();
          if (!it?.id || !validos.has(it.id) || !nome || nome.length > 120) continue;
          if (await aplicar(it.id, nome)) {
            traduzidos++;
            // Guarda a tradução por nome de origem para reuso futuro (todos os profissionais).
            if (hashById[it.id]) await saveCache(admin, "traduzir-nome", hashById[it.id], { nome_pt: nome }, "gemini-2.5-flash");
          } else falhas++;
        }
      } catch {
        falhas += pendentes.length;
      }
    }

    return new Response(JSON.stringify({ ok: true, total: todos.length, traduzidos, falhas, cache: doCache }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
