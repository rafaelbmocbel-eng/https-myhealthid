// Tradução AUTOMÁTICA (em lote) dos nomes da biblioteca de exercícios — para
// TODOS os profissionais, sem depender de ninguém clicar. Roda com service role
// (cron ou super-admin), processa só as linhas ainda não traduzidas
// (nome_traduzido_em NULL), em lotes limitados por rodada, reusa o cache de
// tradução (getCachedDeterministic) e marca o que traduziu. Assim avança a cada
// rodada e vira no-op quando termina. Nunca lança para o cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCachedDeterministic, saveCache, sha256Hex } from "../_shared/ai-cache.ts";
import { logUsoIA } from "../_shared/log-ia.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPER_ADMINS = ["rafaelbmocbel@gmail.com"];
const MAX_POR_RODADA = 300; // limita o custo por execução

const SYSTEM = `Você é um tradutor especializado em educação física e fisioterapia. Traduza nomes de exercícios do inglês para o português do Brasil, usando a nomenclatura consagrada nas academias e clínicas brasileiras.
Regras:
- Traduza o nome COMPLETO, de forma natural (ex.: "dumbbell goblet squat" → "Agachamento goblet com halteres"; "seated cable row" → "Remada baixa sentada no cabo").
- Mantenha termos consagrados que os brasileiros usam em inglês quando for o padrão (burpee, kettlebell, hip thrust, mountain climber podem ficar, mas prefira o português quando existir uso corrente).
- Se o nome já estiver todo em português, devolva-o igual (só corrija capitalização/erros óbvios).
- Primeira letra maiúscula, sem ponto final, sem underscores ou hífens de arquivo, sem "converted" nem parênteses vazios.
Retorne SOMENTE JSON: { "itens": [ { "id": "string", "nome_pt": "string" } ] } — um item para CADA id recebido, na mesma ordem.`;

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const CRON_SECRET = Deno.env.get("CRON_SECRET");
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

  // Autorização: cron (secret) OU super-admin logado (para o botão no Admin).
  const provided = req.headers.get("x-cron-secret") || new URL(req.url).searchParams.get("secret");
  let autorizado = !!CRON_SECRET && provided === CRON_SECRET;
  if (!autorizado) {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (token) {
      try {
        const authClient = createClient(SUPABASE_URL, ANON);
        const { data } = await authClient.auth.getUser(token);
        const email = data?.user?.email?.toLowerCase() || "";
        if (SUPER_ADMINS.includes(email)) autorizado = true;
      } catch { /* token inválido → não autoriza */ }
    }
  }
  if (!autorizado) return json({ error: "não autorizado" }, 401);
  if (!GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY não configurada" }, 500);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Só linhas ainda não traduzidas (avança a cada rodada).
    const { data: exs, error: selErr } = await admin
      .from("biblioteca_exercicios")
      .select("id, nome, nome_original")
      .is("nome_traduzido_em", null)
      .eq("ativo", true)
      .limit(MAX_POR_RODADA);
    if (selErr) throw selErr;
    const todos = (exs || []) as { id: string; nome: string; nome_original: string | null }[];

    // Quantos ainda faltam (para o chamador saber se precisa de mais rodadas).
    const { count: restantes } = await admin
      .from("biblioteca_exercicios")
      .select("id", { count: "exact", head: true })
      .is("nome_traduzido_em", null)
      .eq("ativo", true);

    if (todos.length === 0) return json({ ok: true, total: 0, traduzidos: 0, restantes: restantes ?? 0 });

    let traduzidos = 0, falhas = 0, doCache = 0;
    const agoraIso = () => new Date().toISOString();
    const chaveNome = (e: { nome: string; nome_original: string | null }) =>
      sha256Hex(`traduz-nome|v1|${(e.nome_original || e.nome || "").trim().toLowerCase()}`);

    // Aplica: atualiza o nome E marca como traduzido (por id, sem filtro de dono).
    const aplicar = async (id: string, nome: string): Promise<boolean> => {
      if (!nome || nome.length > 120) return false;
      const { error } = await admin.from("biblioteca_exercicios")
        .update({ nome, nome_traduzido_em: agoraIso() }).eq("id", id);
      return !error;
    };

    const LOTE = 80;
    for (let i = 0; i < todos.length; i += LOTE) {
      const lote = todos.slice(i, i + LOTE);
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
        if (!aiRes.ok) throw new Error(`Gemini ${aiRes.status}`);
        const aiJson = await aiRes.json();
        await logUsoIA("traduzir-biblioteca-batch", "gemini-2.5-flash", aiJson?.usage);
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
            if (hashById[it.id]) await saveCache(admin, "traduzir-nome", hashById[it.id], { nome_pt: nome }, "gemini-2.5-flash");
          } else falhas++;
        }
        // Falha da IA (batch): NÃO marca — retorna null e é tentado na próxima rodada.
      } catch (e) {
        console.warn("[traduzir-batch] lote falhou:", e);
        falhas += pendentes.length;
      }
    }

    const faltamAgora = Math.max(0, (restantes ?? 0) - traduzidos);
    return json({ ok: true, processados: todos.length, traduzidos, falhas, do_cache: doCache, restantes: faltamAgora });
  } catch (e) {
    console.error("[traduzir-batch] erro:", e);
    return json({ error: (e as Error)?.message || "falha" }, 500);
  }
});
