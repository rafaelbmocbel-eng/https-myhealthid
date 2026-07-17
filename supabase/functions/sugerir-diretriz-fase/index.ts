import { corsHeaders, requireUser } from '../_shared/auth.ts';

interface Body {
  tipo: 'exercicios' | 'tecnicas';
  faseNumero: number;
  faseTitulo: string;
  objetivo: string;
  queixa?: string;
  jaSelecionados?: string[];
  driverMyID?: { label: string; key: string; score: number };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try { await requireUser(req); } catch (r) { return r as Response; }

  try {
    const body = (await req.json()) as Body;
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

    const alvo = body.tipo === 'exercicios' ? 'exercícios terapêuticos' : 'técnicas/condutas manuais e educativas';
    const driver = body.driverMyID;
    const sys = `Você é um fisioterapeuta sênior. Sugira 5 ${alvo} BASEADOS EM EVIDÊNCIA para a fase clínica descrita. Use vocabulário clínico brasileiro. Cada item deve ter nível de evidência (A, B ou C) e uma justificativa curta (motivo) que cite explicitamente a EVIDÊNCIA CLÍNICA do paciente que motivou a escolha — não uma justificativa genérica de manual.${driver ? ` O paciente tem o domínio MyID "${driver.label}" (${driver.key}) como driver primário de sobrecarga (score ${driver.score}/10); priorize itens que atuem diretamente sobre esse domínio e mencione isso no motivo (ex.: "Indicado por: MyID ${driver.key}=${driver.score} (${driver.label}) — driver primário").` : ''}`;

    // Buscar top-5 evidências (usa resumos pré-computados para economizar tokens)
    let evidenciaContext = "";
    try {
      const SUPABASE_URL_E = Deno.env.get("SUPABASE_URL");
      const SERVICE_KEY_E = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (SUPABASE_URL_E && SERVICE_KEY_E) {
        const query = `Fase ${body.faseNumero} de tratamento (${body.faseTitulo}). Objetivo: ${body.objetivo || ""}. Queixa: ${body.queixa || ""}. Driver MyID: ${driver?.label ?? ""}. Tipo de busca: ${alvo}.`;
        const embRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/embeddings", {
          method: "POST",
          headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "gemini-embedding-001", input: query.slice(0, 4000), dimensions: 1536 }),
        });
        if (embRes.ok) {
          const embJson = await embRes.json();
          const queryEmb = embJson.data?.[0]?.embedding;
          const rpcRes = await fetch(`${SUPABASE_URL_E}/rest/v1/rpc/match_evidence`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: SERVICE_KEY_E, Authorization: `Bearer ${SERVICE_KEY_E}` },
            body: JSON.stringify({ query_embedding: queryEmb, match_count: 5, filter_areas: null, min_year: new Date().getFullYear() - 15 }),
          });
          if (rpcRes.ok) {
            const evidencias = await rpcRes.json();
            if (Array.isArray(evidencias) && evidencias.length > 0) {
              const ids = evidencias.map((e: any) => e.id);
              const resumosRes = await fetch(`${SUPABASE_URL_E}/rest/v1/evidence_library?id=in.(${ids.join(",")})&select=id,resumo_clinico,aplicacao_pratica`, {
                headers: { apikey: SERVICE_KEY_E, Authorization: `Bearer ${SERVICE_KEY_E}` },
              });
              const resumos: Record<string, any> = {};
              if (resumosRes.ok) for (const r of await resumosRes.json()) resumos[r.id] = r;
              evidenciaContext = `\n\nEVIDÊNCIA CIENTÍFICA (cite no campo "motivo" quando aplicável, Autor (ano)):\n` +
                evidencias.map((e: any, i: number) => {
                  const c = resumos[e.id] ?? {};
                  const corpo = c.resumo_clinico ? `${c.resumo_clinico}${c.aplicacao_pratica ? " | " + c.aplicacao_pratica : ""}` : (e.abstract?.slice(0, 300) ?? "");
                  return `[${i + 1}] ${(e.authors ?? []).slice(0, 2).join(", ")}${(e.authors ?? []).length > 2 ? " et al." : ""} (${e.year ?? "—"}) — Nível ${e.evidence_level ?? "—"}: ${corpo}`;
                }).join("\n");
              fetch(`${SUPABASE_URL_E}/rest/v1/rpc/increment_evidence_citation`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: SERVICE_KEY_E, Authorization: `Bearer ${SERVICE_KEY_E}` },
                body: JSON.stringify({ p_ids: ids }),
              }).catch(() => {});
            }
          }
        }
      }
    } catch (e) { console.warn("[sugerir-diretriz] evidence opcional:", e); }

    const user = `Fase ${body.faseNumero} — ${body.faseTitulo}
Objetivo: ${body.objetivo || 'não informado'}
Queixa principal: ${body.queixa || 'não informada'}
Já selecionados (não repetir): ${(body.jaSelecionados || []).join(', ') || 'nenhum'}
${driver ? `Driver MyID do paciente: ${driver.label} (${driver.key}) — score ${driver.score}/10, principal fator de sobrecarga identificado na última avaliação.` : ''}${evidenciaContext}

Retorne ${body.tipo === 'exercicios' ? '5 exercícios' : '5 técnicas'} adequados a esta fase.`;

    const itemSchema = body.tipo === 'exercicios'
      ? {
          type: 'object',
          properties: {
            nome: { type: 'string' },
            categoria: { type: 'string', description: 'mobilidade, fortalecimento, controle motor, propriocepção, cardio, etc.' },
            series: { type: 'string' },
            repeticoes: { type: 'string' },
            duracao: { type: 'string' },
            nivel_evidencia: { type: 'string', enum: ['A', 'B', 'C'] },
            motivo: { type: 'string', description: 'Justificativa rastreável (1-2 frases). Se houver driver MyID, citar a dimensão e o score, ex.: "Indicado por: MyID D=4 (Dor) — driver primário".' },
          },
          required: ['nome', 'categoria', 'series', 'repeticoes', 'nivel_evidencia', 'motivo'],
        }
      : {
          type: 'object',
          properties: {
            nome: { type: 'string' },
            categoria: { type: 'string' },
            duracao: { type: 'string' },
            frequencia: { type: 'string' },
            nivel_evidencia: { type: 'string', enum: ['A', 'B', 'C'] },
            motivo: { type: 'string', description: 'Justificativa rastreável (1-2 frases). Se houver driver MyID, citar a dimensão e o score, ex.: "Indicado por: MyID R=8 (Regulação) — driver primário".' },
          },
          required: ['nome', 'categoria', 'nivel_evidencia', 'motivo'],
        };

    // JSON mode (response_format) — o function-calling forçado (tool_choice)
    // não é bem suportado pelo endpoint OpenAI-compat do Gemini e retorna non-2xx.
    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: `${sys}\n\nResponda APENAS com um objeto JSON no formato {"sugestoes": [ ... ]}, onde cada item segue: ${JSON.stringify(itemSchema)}.` },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (resp.status === 429) return new Response(JSON.stringify({ error: 'Limite de requisições atingido, tente novamente em instantes.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (resp.status === 402) return new Response(JSON.stringify({ error: 'Créditos da IA esgotados. Adicione créditos em Configurações.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!resp.ok) {
      const t = await resp.text();
      console.error('gateway error', resp.status, t);
      return new Response(JSON.stringify({ error: 'Erro na IA' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content ?? '';
    let args: { sugestoes?: any[] } = { sugestoes: [] };
    try {
      args = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) { try { args = JSON.parse(m[0]); } catch { /* mantém vazio */ } }
    }

    return new Response(JSON.stringify({ sugestoes: args.sugestoes || [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'erro' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
