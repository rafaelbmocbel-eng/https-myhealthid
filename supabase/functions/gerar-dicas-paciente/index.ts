// Gera dicas/exercícios de evidência PERSONALIZADAS para um paciente, a partir
// do MyID (dimensões críticas) + história clínica + meta-análises da
// evidence_library. Chamada automaticamente ao concluir o MyID. Salva 1 registro
// por paciente em paciente_dicas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Dimensão MyID (com perda) → áreas de evidência mais relevantes para buscar.
const DIM_TO_AREAS: Record<string, string[]> = {
  D: ["fisioterapia", "neurociencia"], EFI: ["fisioterapia", "educacao_fisica"],
  P: ["psicologia", "neurociencia"], R: ["psicologia", "neurociencia"],
  AF: ["fisioterapia", "educacao_fisica"], ERG: ["fisioterapia"], HID: ["nutricao"],
};

const SYSTEM = `Você é um time clínico (fisioterapia, medicina da dor, neurociência, psicologia, nutrição, educação física). Crie DICAS e exercícios terapêuticos SEGUROS, para casa, personalizados para ESTE paciente, baseados EXCLUSIVAMENTE na evidência científica fornecida.
Estas dicas são o nível GRATUITO: gerais e seguras (o plano individualizado é feito pelo profissional), mas devem CONVERSAR com a jornada do paciente no app — quando fizer sentido, conecte a dica aos hábitos que o app acompanha (registrar como se sente no diário, fazer os exercícios do dia, constância semanal), incentivando a rotina.
Regras: use só o que os artigos sustentam; nada de medicamentos, manipulação ou nada que exija supervisão; cada item autoaplicável e de baixo risco, com precaução; tom acolhedor. É APOIO, não substitui profissional.
Retorne SOMENTE JSON: { "dicas": [ {
  "nome": "string", "categoria": "Respiração|Alongamento|Mobilidade|Relaxamento|Fortalecimento|Dica",
  "descricao": "para que serve e por que combina com o perfil dele (2 linhas)",
  "instrucoes": ["passo 1","passo 2"], "precaucoes": ["quando evitar"],
  "tempo_duracao": "ex: 5 minutos"
} ] }`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
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

    // MyID + história do paciente
    const [myRes, pacRes] = await Promise.all([
      admin.from("myid_avaliacoes").select("resultado_processado")
        .eq("paciente_id", paciente_id).eq("status", "concluido")
        .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("pacientes").select("terapeuta_id, queixa_principal, historia_atual, condicoes_saude")
        .eq("id", paciente_id).maybeSingle(),
    ]);
    const scores = (myRes.data?.resultado_processado as any)?.scores || {};
    const pac = (pacRes.data || {}) as any;

    // Dimensões críticas → áreas de evidência
    const areas = new Set<string>(["fisioterapia"]);
    Object.entries(scores).forEach(([dim, val]) => {
      const v = Number(val); if (Number.isNaN(v)) return;
      const isDemanda = ["D", "EFI", "P", "I"].includes(dim);
      const critica = isDemanda ? v >= 6 : v <= 5;
      if (critica && DIM_TO_AREAS[dim]) DIM_TO_AREAS[dim].forEach(a => areas.add(a));
    });

    // Artigos de evidência dessas áreas
    const { data: artigos } = await admin.from("evidence_library")
      .select("title, journal, year, evidence_level, health_areas")
      .overlaps("health_areas", Array.from(areas))
      .order("year", { ascending: false })
      .limit(18);
    const lista = (artigos || []) as any[];
    if (lista.length === 0) {
      return new Response(JSON.stringify({ ok: false, reason: "sem_evidencia" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evidenciaTxt = lista.map((a, i) => `[${i + 1}] ${a.title} (${a.journal || "?"}, ${a.year || "?"}) Nível:${a.evidence_level || "-"}`).join("\n");
    const perfilTxt = [
      Object.keys(scores).length ? `Dimensões MyID (scores): ${JSON.stringify(scores)}` : "",
      pac.queixa_principal ? `Queixa: ${String(pac.queixa_principal).slice(0, 300)}` : "",
      pac.historia_atual ? `História: ${String(pac.historia_atual).slice(0, 500)}` : "",
      pac.condicoes_saude ? `Condições: ${JSON.stringify(pac.condicoes_saude).slice(0, 300)}` : "",
    ].filter(Boolean).join("\n");

    const userPrompt = `Perfil do paciente:\n${perfilTxt || "(pouca informação — foque em dicas gerais seguras)"}\n\nGere de 5 a 7 dicas/exercícios personalizados, fundamentados SOMENTE nos artigos abaixo. Priorize as dimensões mais críticas do MyID.\n\nArtigos:\n${evidenciaTxt}\n\nRetorne o JSON.`;

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
    let parsed: any = {};
    try { parsed = JSON.parse(content); } catch { const m = content.match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); }
    const dicas = Array.isArray(parsed?.dicas) ? parsed.dicas : [];
    if (dicas.length === 0) {
      return new Response(JSON.stringify({ ok: false, reason: "sem_dicas" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { error: upErr } = await admin.from("paciente_dicas").upsert({
      paciente_id, terapeuta_id: pac.terapeuta_id ?? null,
      dicas, gerado_em: new Date().toISOString(),
    }, { onConflict: "paciente_id" });
    if (upErr) {
      return new Response(JSON.stringify({ ok: false, error: `Falha ao salvar: ${upErr.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirma que o registro está mesmo no banco antes de dizer "criou".
    const { data: confirma, error: readErr } = await admin
      .from("paciente_dicas").select("dicas, terapeuta_id").eq("paciente_id", paciente_id).maybeSingle();
    const salvas = Array.isArray((confirma as any)?.dicas) ? (confirma as any).dicas.length : 0;
    if (readErr || salvas === 0) {
      return new Response(JSON.stringify({ ok: false, error: `Gerou mas não confirmou no banco (${readErr?.message || "0 salvas"})` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true, geradas: salvas,
      dicas: (confirma as any)?.dicas ?? dicas,
      terapeuta_dono: (confirma as any)?.terapeuta_id ?? null,
      areas: Array.from(areas),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
