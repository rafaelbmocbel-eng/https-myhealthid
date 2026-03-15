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
      const painLocation = rd.painLocation || rd.localizacao_dor || rd.bloco_2_location || "não especificada";
      const painDuration = rd.painDuration || rd.duracao_dor || rd.bloco_1_duration || "não informada";
      const painIntensity = rd.painIntensity ?? rd.intensidade_dor ?? rd.nrs ?? rd.bloco_2_nrs ?? "N/A";
      const sleepQuality = rd.sleepQuality ?? rd.qualidade_sono ?? rd.bloco_5_sleep_quality ?? "N/A";
      const stressLevel = rd.stressLevel ?? rd.nivel_estresse ?? rd.bloco_5_stress ?? "N/A";
      const activityLevel = rd.activityLevel ?? rd.nivel_atividade ?? rd.bloco_5_activity ?? "N/A";
      const hydration = rd.hydration ?? rd.hidratacao ?? rd.bloco_5_hydration ?? "N/A";
      const sleepHours = rd.sleepHours ?? rd.horas_sono ?? rd.bloco_5_sleep_hours ?? "N/A";
      const painFrequency = rd.painFrequency ?? rd.frequencia_dor ?? rd.bloco_2_frequency ?? "não informada";
      const painType = rd.painType ?? rd.tipo_dor ?? rd.bloco_2_type ?? "não especificado";
      const workImpact = rd.bloco_3_work ?? rd.trabalho_impacto ?? "N/A";
      const exerciseImpact = rd.bloco_3_exercise ?? rd.exercicio_impacto ?? "N/A";
      const socialImpact = rd.bloco_3_social ?? rd.social_impacto ?? "N/A";
      const catastrophizing = rd.bloco_4_catastrophizing ?? rd.catastrofizacao ?? null;
      const fearAvoidance = rd.bloco_4_fear ?? rd.medo_evitacao ?? null;
      const nutrition = rd.nutrition ?? rd.alimentacao ?? rd.bloco_5_nutrition ?? "N/A";

      const flagsText = redFlags && redFlagAlerts.length > 0
        ? `\n⚠️ RED FLAGS DETECTADAS:\n${redFlagAlerts.map((f: string) => `  🚨 ${f}`).join("\n")}\n  ➡️ Requer avaliação médica complementar antes de prosseguir com condutas.`
        : "";

      // Generate severity interpretation
      const dNum = Number(scoreD);
      const efiNum = Number(scoreEFI);
      const pNum = Number(scoreP);
      const iNum = Number(scoreI);
      const nNum = Number(scoreN);
      const myidNum = Number(myidScore);

      const severityDesc = myidNum >= 8
        ? "RISCO DE CRONIFICAÇÃO — Paciente apresenta sobrecarga sistêmica extrema com múltiplos domínios comprometidos. Necessidade urgente de abordagem multidisciplinar e reavaliação de condutas atuais."
        : myidNum >= 6
        ? "SOBRECARGA CRÍTICA — O perfil indica demandas que excedem significativamente a capacidade de regulação do paciente. Intervenção prioritária recomendada nos domínios mais comprometidos."
        : myidNum >= 3
        ? "SOBRECARGA MODERADA — Há desequilíbrio entre demandas e capacidades de recuperação. Monitoramento frequente e ajustes terapêuticos são indicados."
        : "RECUPERAÇÃO FAVORÁVEL — O paciente apresenta boa capacidade de regulação com demandas controláveis. Manutenção e prevenção são o foco.";

      // Identify top concerns
      const dimensions = [
        { name: "Dor", score: dNum, desc: "intensidade e frequência da dor reportada" },
        { name: "Funcionalidade", score: efiNum, desc: "limitação funcional nas atividades diárias" },
        { name: "Psicológico", score: pNum, desc: "fatores emocionais como catastrofização, medo e ansiedade" },
        { name: "Demanda/Inércia", score: iNum, desc: "carga de demandas físicas e ocupacionais" },
        { name: "Ruído Sistêmico", score: nNum, desc: "fatores de estilo de vida como sono, estresse e hidratação" },
      ].sort((a, b) => b.score - a.score);

      const topConcerns = dimensions.filter(d => d.score >= 5);
      const topConcernsText = topConcerns.length > 0
        ? topConcerns.map(d => `  • ${d.name} (${d.score.toFixed(1)}/10): ${d.desc}`).join("\n")
        : "  Nenhum domínio em nível crítico identificado.";

      // Build lifestyle summary
      const lifestyleItems = [];
      if (sleepHours !== "N/A") lifestyleItems.push(`sono de ${sleepHours}h/noite`);
      if (sleepQuality !== "N/A") lifestyleItems.push(`qualidade do sono ${Number(sleepQuality) <= 4 ? "prejudicada" : Number(sleepQuality) >= 7 ? "adequada" : "moderada"} (${sleepQuality}/10)`);
      if (stressLevel !== "N/A") lifestyleItems.push(`estresse ${Number(stressLevel) >= 7 ? "elevado" : Number(stressLevel) >= 4 ? "moderado" : "baixo"} (${stressLevel}/10)`);
      if (activityLevel !== "N/A") lifestyleItems.push(`atividade física ${Number(activityLevel) <= 3 ? "insuficiente" : Number(activityLevel) >= 7 ? "ativa" : "moderada"} (${activityLevel}/10)`);
      if (hydration !== "N/A") lifestyleItems.push(`hidratação ${Number(hydration) <= 4 ? "insuficiente" : "adequada"} (${hydration}/10)`);
      if (nutrition !== "N/A") lifestyleItems.push(`alimentação (${nutrition}/10)`);
      const lifestyleText = lifestyleItems.length > 0 ? lifestyleItems.join(", ") : "dados de estilo de vida não informados";

      // Build functional impact summary  
      const funcItems = [];
      if (workImpact !== "N/A") funcItems.push(`trabalho ${workImpact}/10`);
      if (exerciseImpact !== "N/A") funcItems.push(`exercício ${exerciseImpact}/10`);
      if (socialImpact !== "N/A") funcItems.push(`vida social ${socialImpact}/10`);
      const funcText = funcItems.length > 0 ? funcItems.join(", ") : "";

      // Psychological profile
      let psychText = "";
      if (pNum >= 5) {
        const psychDetails = [];
        if (catastrophizing !== null) psychDetails.push(`catastrofização presente`);
        if (fearAvoidance !== null) psychDetails.push(`medo-evitação identificado`);
        psychText = psychDetails.length > 0
          ? `Componente psicológico significativo (${scoreP}/10) com ${psychDetails.join(" e ")}.`
          : `Componente psicológico elevado (${scoreP}/10) — sugere-se investigação de crenças disfuncionais e estratégias de coping.`;
      }

      const descricao = `📋 QUESTIONÁRIO MyID RESPONDIDO PELO PACIENTE — ${pacienteNome}

🎯 RESULTADO GERAL: Score MyID ${myidFormatted}/10 — ${classificacao}
📌 ${severityDesc}
${flagsText}

📊 PERFIL MULTIDIMENSIONAL:
• Dor (D): ${scoreD}/10 — ${dNum >= 7 ? "dor intensa" : dNum >= 4 ? "dor moderada" : "dor leve/controlada"}${painLocation !== "não especificada" ? `, localizada em ${painLocation}` : ""}${painType !== "não especificado" ? `, tipo ${painType}` : ""}${painFrequency !== "não informada" ? `, frequência: ${painFrequency}` : ""}${painDuration !== "não informada" ? `, duração: ${painDuration}` : ""}
• Funcionalidade (EFI): ${scoreEFI}/10 — ${efiNum >= 7 ? "limitação funcional severa" : efiNum >= 4 ? "limitação funcional moderada" : "funcionalidade preservada"}${funcText ? ` (impacto: ${funcText})` : ""}
• Psicológico (P): ${scoreP}/10 — ${pNum >= 7 ? "componente emocional significativo" : pNum >= 4 ? "influência psicológica moderada" : "perfil emocional estável"}
• Demanda (I): ${scoreI}/10 — ${iNum >= 7 ? "sobrecarga de demandas elevada" : iNum >= 4 ? "demandas moderadas" : "demandas controladas"}
• Ruído Sistêmico (N): ${scoreN}/10 — ${nNum >= 7 ? "múltiplos fatores de estilo de vida comprometidos" : nNum >= 4 ? "alguns fatores de regulação afetados" : "estilo de vida favorável à recuperação"}
• Regulação (R): ${scoreR}/10
• Contexto (C): ${scoreC}/10

🔍 DOMÍNIOS PRIORITÁRIOS (scores ≥ 5):
${topConcernsText}

🧬 ESTILO DE VIDA REPORTADO:
Paciente refere ${lifestyleText}. Intensidade de dor reportada (NRS): ${painIntensity}/10.
${psychText ? `\n🧠 PERFIL PSICOLÓGICO:\n${psychText}` : ""}

📝 INTERPRETAÇÃO CLÍNICA:
O paciente ${pacienteNome} apresenta um índice MyID de ${myidFormatted}/10, classificado como "${classificacao}". ${topConcerns.length >= 3 ? "O perfil revela comprometimento em múltiplas dimensões, sugerindo uma condição de complexidade elevada que demanda abordagem integrada e multidisciplinar." : topConcerns.length >= 1 ? `Os domínios de ${topConcerns.map(d => d.name).join(" e ")} requerem atenção prioritária nas condutas terapêuticas.` : "O perfil sistêmico encontra-se em faixa favorável, com foco recomendado em manutenção e prevenção."} ${dNum >= 6 && efiNum >= 6 ? "A combinação de dor intensa com limitação funcional significativa indica necessidade de intervenção analgésica associada à reabilitação funcional progressiva." : ""} ${pNum >= 6 ? "O componente psicológico elevado sugere que estratégias de educação em dor, terapia cognitivo-comportamental ou técnicas de regulação emocional devem ser incorporadas ao plano terapêutico." : ""} ${nNum >= 6 ? "Os fatores de estilo de vida comprometidos (ruído sistêmico) podem estar perpetuando o quadro — orientações sobre higiene do sono, manejo do estresse e hábitos saudáveis são essenciais." : ""}

🔄 Avaliação preenchida pelo paciente via link público. Dados completos disponíveis para análise detalhada no dashboard.`;

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
