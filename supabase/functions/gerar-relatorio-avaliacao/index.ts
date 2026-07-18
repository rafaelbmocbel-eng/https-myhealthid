// Gera o RELATÓRIO DE AVALIAÇÃO do cliente: pontos fortes e pontos a melhorar,
// escritos PARA O CLIENTE (linguagem acolhedora, sem jargão), a partir de tudo
// que a avaliação coletou — MyID, avatar clínico (achados anatômicos), testes
// funcionais, bioimpedância, antropometria, sinais vitais e história clínica.
// Disparado automaticamente pelo complete-myid e regenerável pelo profissional.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isInternalCall, requireUser } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um time multidisciplinar de saúde (fisioterapia, educação física, nutrição, psicologia) preparando a DEVOLUTIVA da avaliação para o próprio cliente ler.
Regras de ouro:
- Escreva PARA O CLIENTE, na segunda pessoa ("você"), em português do Brasil, tom acolhedor e motivador — nunca alarmista.
- SEM jargão técnico (troque "dimensão EFI" por "sua disposição para atividades", etc.); SEM diagnósticos, SEM medicamentos.
- Cada ponto a melhorar cita de onde veio (ex.: "sua avaliação mostrou que o sono...") e traz UM primeiro passo simples e seguro.
- Valorize os pontos fortes de verdade — eles sustentam a mudança.
- Feche com uma mensagem curta de incentivo conectada ao acompanhamento no app (missões, diário, exercícios).
Retorne SOMENTE JSON neste formato:
{
  "titulo": "string curta e pessoal",
  "resumo": "3-4 linhas: o retrato geral da avaliação, honesto e encorajador",
  "pontos_fortes": [ { "titulo": "string", "descricao": "1-2 linhas" } ],
  "pontos_a_melhorar": [ { "titulo": "string", "por_que": "o que a avaliação mostrou", "primeiro_passo": "ação simples e segura" } ],
  "proximos_passos": ["string — o que fazer no app/acompanhamento"],
  "mensagem_final": "1-2 linhas de incentivo"
}
Gere 3 a 5 pontos fortes e 3 a 5 pontos a melhorar, priorizando o que os dados mais sustentam.`;

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

    // Autorização: interno (complete-myid/cron) OU dono (o paciente ou o
    // terapeuta dele). Sem isto, qualquer autenticado puxava PHI de qualquer
    // paciente passando um paciente_id alheio (IDOR).
    if (!isInternalCall(req)) {
      let userId: string;
      try { ({ userId } = await requireUser(req)); } catch (r) { return r as Response; }
      const { data: dono } = await admin.from("pacientes")
        .select("user_id, terapeuta_id").eq("id", paciente_id).maybeSingle();
      if (!dono || (dono.user_id !== userId && dono.terapeuta_id !== userId)) {
        return new Response(JSON.stringify({ error: "Sem permissão para este paciente." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const [pacRes, myRes, avatarRes, testesRes, compRes, antroRes, vitaisRes] = await Promise.all([
      admin.from("pacientes").select("terapeuta_id, nome, sexo, data_nascimento, queixa_principal, historia_atual, condicoes_saude")
        .eq("id", paciente_id).maybeSingle(),
      admin.from("myid_avaliacoes").select("resultado_processado")
        .eq("paciente_id", paciente_id).eq("status", "concluido")
        .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("eventos_clinicos_anatomicos").select("*")
        .eq("paciente_id", paciente_id).order("created_at", { ascending: false }).limit(12),
      admin.from("testes_funcionais_paciente").select("tipo_teste, resultado, unidade, classificacao")
        .eq("paciente_id", paciente_id).order("data_teste", { ascending: false }).limit(8),
      admin.from("body_composition").select("weight_kg, body_fat_pct, muscle_mass_kg, visceral_fat")
        .eq("paciente_id", paciente_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("antropometria").select("peso_kg, imc, gordura_pct")
        .eq("paciente_id", paciente_id).order("data_medicao", { ascending: false }).limit(1).maybeSingle(),
      admin.from("sinais_vitais").select("pa_sistolica, pa_diastolica, fc, glicemia")
        .eq("paciente_id", paciente_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const pac = (pacRes.data || {}) as any;
    const resultado = (myRes.data?.resultado_processado || null) as any;
    // Formato variou: scores / component_scores / componentScores. Sem o
    // fallback, o relatório NUNCA era gerado para o formato atual.
    const scores = resultado?.scores || resultado?.component_scores || resultado?.componentScores || null;
    if (!scores) {
      return new Response(JSON.stringify({ ok: false, reason: "sem_myid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const idade = pac.data_nascimento
      ? Math.floor((Date.now() - new Date(pac.data_nascimento).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null;
    const avatarTxt = (avatarRes.data || [])
      .map((e: any) => JSON.stringify(e).slice(0, 250)).join("\n");
    const testesTxt = (testesRes.data || [])
      .map((t: any) => `${t.tipo_teste}: ${t.resultado} ${t.unidade || ""} (${t.classificacao || "?"})`).join("\n");

    const contexto = {
      myid: true,
      avatar: (avatarRes.data || []).length,
      testes: (testesRes.data || []).length,
      bioimpedancia: !!compRes.data,
      antropometria: !!antroRes.data,
      sinais_vitais: !!vitaisRes.data,
    };

    const perfil = [
      `Cliente: ${pac.nome ? String(pac.nome).split(" ")[0] : "?"}, ${idade ? idade + " anos" : "idade ?"}, sexo ${pac.sexo || "?"}.`,
      pac.queixa_principal ? `Queixa: ${String(pac.queixa_principal).slice(0, 300)}` : "",
      pac.historia_atual ? `História: ${String(pac.historia_atual).slice(0, 400)}` : "",
      pac.condicoes_saude ? `Condições de saúde: ${JSON.stringify(pac.condicoes_saude).slice(0, 250)}` : "",
      `MYID (scores 0-10 por dimensão; D/P/I/N altos = pior; R/AF/ERG/HID/NUT/C/EFI baixos = pior): ${JSON.stringify(scores)}`,
      resultado?.myid_score != null ? `Score geral MyID: ${resultado.myid_score}` : "",
      avatarTxt ? `AVATAR CLÍNICO (achados anatômicos registrados):\n${avatarTxt}` : "(sem achados no avatar clínico)",
      testesTxt ? `TESTES FUNCIONAIS:\n${testesTxt}` : "",
      compRes.data ? `Bioimpedância: ${JSON.stringify(compRes.data)}` : "",
      antroRes.data ? `Antropometria: ${JSON.stringify(antroRes.data)}` : "",
      vitaisRes.data ? `Sinais vitais: ${JSON.stringify(vitaisRes.data)}` : "",
    ].filter(Boolean).join("\n");

    const userPrompt = `${perfil}\n\nMonte a devolutiva da avaliação (pontos fortes, pontos a melhorar com primeiro passo, próximos passos no app). Retorne o JSON.`;

    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 120_000);
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
    let rel: any = {};
    try { rel = JSON.parse(content); } catch { const m = content.match(/\{[\s\S]*\}/); if (m) rel = JSON.parse(m[0]); }
    if (!Array.isArray(rel?.pontos_fortes) || !Array.isArray(rel?.pontos_a_melhorar)) {
      throw new Error("A IA não retornou o relatório completo — tente novamente");
    }

    const { error: upErr } = await admin.from("relatorios_avaliacao").upsert({
      terapeuta_id: pac.terapeuta_id ?? null,
      paciente_id,
      conteudo: rel,
      contexto,
      enviado_portal: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "paciente_id" });
    if (upErr) throw new Error(`Falha ao salvar: ${upErr.message}`);

    return new Response(JSON.stringify({ ok: true, relatorio: rel, contexto }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const msg = e?.name === "AbortError" || /abort/i.test(String(e?.message))
      ? "A IA demorou demais — tente de novo"
      : e.message || String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
