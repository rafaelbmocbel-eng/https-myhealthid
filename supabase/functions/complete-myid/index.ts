import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { avaliacao_id, result, raw_data } = await req.json();

    if (!avaliacao_id || !result) {
      return new Response(JSON.stringify({ error: "avaliacao_id and result are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Get the myid_avaliacoes record
    const { data: avaliacao, error: fetchErr } = await supabase
      .from("myid_avaliacoes")
      .select("*")
      .eq("id", avaliacao_id)
      .single();

    if (fetchErr || !avaliacao) {
      return new Response(JSON.stringify({ error: "Avaliação não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Update myid_avaliacoes status
    await supabase.from("myid_avaliacoes").update({
      status: "concluido",
      respostas_brutas: raw_data,
      resultado_processado: result,
      updated_at: new Date().toISOString(),
    }).eq("id", avaliacao_id);

    const pacienteId = avaliacao.paciente_id;
    const terapeutaId = avaliacao.terapeuta_id;

    if (!pacienteId || !terapeutaId) {
      return new Response(JSON.stringify({ ok: true, synced: false, reason: "missing paciente_id or terapeuta_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Get patient name
    const { data: paciente } = await supabase
      .from("pacientes")
      .select("nome, sobrenome")
      .eq("id", pacienteId)
      .single();

    const pacienteNome = paciente ? `${paciente.nome} ${paciente.sobrenome}`.trim() : "Paciente";

    // Extract scores from result
    const cs = result.component_scores || result.componentScores || {};
    const myidScore = result.MyID_score ?? result.myidScore ?? 0;
    const classificacao = result.classification ?? result.classificacao ?? "N/A";
    const redFlags = result.red_flags ?? result.redFlagsDetected ?? false;
    const redFlagAlerts = result.red_flag_alerts ?? result.redFlagAlerts ?? [];

    // 4. Insert into avaliacoes_identidade
    const payload = {
      terapeuta_id: terapeutaId,
      paciente_id: pacienteId,
      paciente_nome: pacienteNome,
      data_avaliacao: new Date().toISOString().split("T")[0],
      dados_avaliacao: { resultado: result, respostas: raw_data },
      classificacao,
      myid_score: myidScore,
      myid_analysis: result,
      score_i: cs.I ?? cs.I_inertia ?? 0,
      score_n: cs.N ?? cs.N_noise ?? 0,
      score_p: cs.P ?? cs.P_psychological ?? 0,
      score_c: cs.C ?? cs.C_context ?? 0,
      score_d: cs.D ?? cs.D_pain ?? 0,
      score_r: cs.R ?? cs.R_regulation ?? 0,
      score_efi: cs.EFI ?? cs.EFI_functionality ?? 0,
      red_flags: redFlags ? redFlagAlerts : null,
      score_e: null,
      score_f: null,
      id_final: null,
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("avaliacoes_identidade")
      .insert(payload)
      .select()
      .single();

    if (insertErr) {
      console.error("Insert avaliacoes_identidade error:", insertErr);
      return new Response(JSON.stringify({ ok: true, synced: false, error: insertErr.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Register evolution record
    try {
      const { data: previousAvals } = await supabase
        .from("avaliacoes_identidade")
        .select("id, created_at, score_e, score_p, score_c, score_f, score_d, score_r, score_efi, id_final, myid_score, score_i, score_n")
        .eq("paciente_id", pacienteId)
        .eq("terapeuta_id", terapeutaId)
        .neq("id", inserted.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const { count } = await supabase
        .from("evolucao_paciente")
        .select("id", { count: "exact", head: true })
        .eq("paciente_id", pacienteId)
        .eq("terapeuta_id", terapeutaId);

      const numeroAvaliacao = (count || 0) + 1;
      const prev = previousAvals?.[0] || null;

      const scores = {
        score_e: inserted.score_e,
        score_p: inserted.score_p,
        score_c: inserted.score_c,
        score_f: inserted.score_f,
        score_d: inserted.score_d,
        score_r: inserted.score_r,
        score_efi: inserted.score_efi,
        score_i: inserted.score_i,
        score_n: inserted.score_n,
        myid_score: inserted.myid_score,
      };

      const deltas = prev ? {
        delta_e: (inserted.score_e ?? 0) - (prev.score_e ?? 0),
        delta_p: (inserted.score_p ?? 0) - (prev.score_p ?? 0),
        delta_c: (inserted.score_c ?? 0) - (prev.score_c ?? 0),
        delta_f: (inserted.score_f ?? 0) - (prev.score_f ?? 0),
        delta_d: (inserted.score_d ?? 0) - (prev.score_d ?? 0),
        delta_r: (inserted.score_r ?? 0) - (prev.score_r ?? 0),
        delta_efi: (inserted.score_efi ?? 0) - (prev.score_efi ?? 0),
        delta_i: (inserted.score_i ?? 0) - (prev.score_i ?? 0),
        delta_n: (inserted.score_n ?? 0) - (prev.score_n ?? 0),
        delta_id_final: (inserted.myid_score ?? 0) - (prev.myid_score ?? prev.id_final ?? 0),
      } : {
        delta_e: 0, delta_p: 0, delta_c: 0, delta_f: 0,
        delta_d: 0, delta_r: 0, delta_efi: 0, delta_i: 0, delta_n: 0, delta_id_final: 0,
      };

      const diasDesdeAnterior = prev
        ? Math.round((new Date(inserted.created_at).getTime() - new Date(prev.created_at).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      await supabase.from("evolucao_paciente").insert({
        paciente_id: pacienteId,
        terapeuta_id: terapeutaId,
        avaliacao_atual_id: inserted.id,
        avaliacao_anterior_id: prev?.id || null,
        numero_avaliacao: numeroAvaliacao,
        classificacao: inserted.classificacao,
        id_final: inserted.id_final,
        ...scores,
        ...deltas,
        dias_desde_anterior: diasDesdeAnterior,
      });
    } catch (evolErr) {
      console.warn("Evolução não registrada:", evolErr);
    }

    // 6. AUTO-GENERATE PRONTUÁRIO NOTE
    try {
      const scoreD = Number(cs.D ?? cs.D_pain ?? 0).toFixed(1);
      const scoreEFI = Number(cs.EFI ?? cs.EFI_functionality ?? 0).toFixed(1);
      const scoreP = Number(cs.P ?? cs.P_psychological ?? 0).toFixed(1);
      const scoreI = Number(cs.I ?? cs.I_inertia ?? 0).toFixed(1);
      const scoreN = Number(cs.N ?? cs.N_noise ?? 0).toFixed(1);
      const scoreR = Number(cs.R ?? cs.R_regulation ?? 0).toFixed(1);
      const scoreC = Number(cs.C ?? cs.C_context ?? 0).toFixed(1);
      const myidFormatted = Number(myidScore).toFixed(1);

      // Build descriptive summary from raw_data
      const rd = raw_data || {};
      const painLocation = rd.painLocation || rd.localizacao_dor || "não especificada";
      const painDuration = rd.painDuration || rd.duracao_dor || "não informada";
      const painIntensity = rd.painIntensity ?? rd.intensidade_dor ?? rd.nrs ?? "N/A";
      const sleepQuality = rd.sleepQuality ?? rd.qualidade_sono ?? "N/A";
      const stressLevel = rd.stressLevel ?? rd.nivel_estresse ?? "N/A";
      const activityLevel = rd.activityLevel ?? rd.nivel_atividade ?? "N/A";
      const hydration = rd.hydration ?? rd.hidratacao ?? "N/A";

      const flagsText = redFlags && redFlagAlerts.length > 0
        ? `\n⚠️ RED FLAGS DETECTADAS: ${redFlagAlerts.join(", ")}`
        : "";

      const descricao = `📋 QUESTIONÁRIO MyID RESPONDIDO PELO PACIENTE

🎯 Score MyID: ${myidFormatted}/10 — Classificação: ${classificacao}

📊 SCORES POR DIMENSÃO:
• Dor (D): ${scoreD}/10
• Funcionalidade (EFI): ${scoreEFI}/10
• Psicológico (P): ${scoreP}/10
• Inércia/Demanda (I): ${scoreI}/10
• Ruído Sistêmico (N): ${scoreN}/10
• Regulação (R): ${scoreR}/10
• Contexto (C): ${scoreC}/10

📝 CARACTERÍSTICAS REPORTADAS:
• Localização da dor: ${painLocation}
• Duração da dor: ${painDuration}
• Intensidade (NRS): ${painIntensity}/10
• Qualidade do sono: ${sleepQuality}/10
• Nível de estresse: ${stressLevel}/10
• Nível de atividade física: ${activityLevel}/10
• Hidratação: ${hydration}/10
${flagsText}

🔄 Dados completos armazenados para análise detalhada.
Avaliação nº ${pacienteNome} — preenchida pelo paciente via link público.`;

      await supabase.from("notas_prontuario").insert({
        paciente_id: pacienteId,
        terapeuta_id: terapeutaId,
        tipo: "myid_resposta",
        titulo: `MyID Respondido — Score ${myidFormatted} (${classificacao})`,
        descricao,
        dados_extras: { avaliacao_id: inserted.id, myid_score: myidScore, classificacao, scores: cs },
        referencia_id: inserted.id,
      });
    } catch (noteErr) {
      console.warn("Nota de prontuário não registrada:", noteErr);
    }

    return new Response(JSON.stringify({ ok: true, synced: true, avaliacao_identidade_id: inserted.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("complete-myid error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
