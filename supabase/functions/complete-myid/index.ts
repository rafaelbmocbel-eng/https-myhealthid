import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════
// MyID Enhancements — driver primário + reforços por fase + missões
// Reúso simplificado das tabelas de perda e intervenções
// ═══════════════════════════════════════════════════════════
const TABELA_PERDAS: Record<string, { peso: number; bandas: { min: number; max: number; perda: number }[]; critico?: number }> = {
  D: { peso: 20, bandas: [{ min: 0, max: 1, perda: 0 }, { min: 1, max: 3, perda: 3 }, { min: 3, max: 5, perda: 8 }, { min: 5, max: 7, perda: 14 }, { min: 7, max: 11, perda: 20 }] },
  EFI: { peso: 15, bandas: [{ min: 0, max: 2, perda: 0 }, { min: 2, max: 4, perda: 5 }, { min: 4, max: 6, perda: 10 }, { min: 6, max: 8, perda: 13 }, { min: 8, max: 11, perda: 15 }] },
  P: { peso: 5, bandas: [{ min: 0, max: 3, perda: 0 }, { min: 3, max: 5, perda: 2 }, { min: 5, max: 7, perda: 4 }, { min: 7, max: 11, perda: 5 }] },
  I: { peso: 5, bandas: [{ min: 0, max: 0.5, perda: 0 }, { min: 0.5, max: 1.5, perda: 2 }, { min: 1.5, max: 2.5, perda: 4 }, { min: 2.5, max: 11, perda: 5 }] },
  R: { peso: 15, bandas: [{ min: 0, max: 2, perda: 0 }, { min: 2, max: 4, perda: 5 }, { min: 4, max: 6, perda: 10 }, { min: 6, max: 8, perda: 13 }, { min: 8, max: 11, perda: 15 }], critico: 7 },
  C: { peso: 10, bandas: [{ min: 0, max: 2, perda: 0 }, { min: 2, max: 4, perda: 4 }, { min: 4, max: 6, perda: 7 }, { min: 6, max: 11, perda: 10 }] },
  N: { peso: 5, bandas: [{ min: 0, max: 1, perda: 0 }, { min: 1, max: 2, perda: 2 }, { min: 2, max: 3, perda: 4 }, { min: 3, max: 11, perda: 5 }] },
};

const DIM_LABELS: Record<string, string> = {
  D: "Dor", EFI: "Funcionalidade", P: "Psicológico", I: "Inércia",
  R: "Regulação", C: "Contexto", N: "Ruído Sistêmico",
};

const DRIVER_INTERVENCOES: Record<string, { intervencoes: string[]; encaminhamentos: string[] }> = {
  D: { intervencoes: ["Educação em neurociência da dor", "Modulação (TENS/crioterapia/terapia manual)", "Amplitude sem carga", "Respiração diafragmática 3×/dia"], encaminhamentos: ["Avaliação médica se dor > 8/10 persistente"] },
  EFI: { intervencoes: ["Amplitude sem carga", "Adaptações funcionais", "Retorno gradual às AVDs", "Fisioterapia 2–3×/sem"], encaminhamentos: ["Avaliação ocupacional se limitação severa"] },
  P: { intervencoes: ["Educação em neurociência da dor (crenças)", "Exposição gradual ao movimento temido", "Diário de atividades sem dor", "Reestruturação cognitiva"], encaminhamentos: ["Psicoterapia cognitivo-comportamental"] },
  R: { intervencoes: ["Higiene do sono: rotina fixa", "Desligar telas 1h antes de dormir", "Relaxamento pré-sono", "Cafeína só até 14h"], encaminhamentos: ["Avaliação médica se insônia crônica"] },
  C: { intervencoes: ["Gerenciamento de estresse", "Mindfulness e relaxamento", "Reestruturação da rotina de trabalho", "Lazer e socialização programados"], encaminhamentos: ["Encaminhamento psicológico", "Apoio social estruturado"] },
  I: { intervencoes: ["Estabilizar rotina antes de progredir carga", "Adaptar equipamento gradualmente", "Evitar múltiplas mudanças simultâneas"], encaminhamentos: [] },
  N: { intervencoes: ["Investigar fatores viscerais/hormonais", "Monitorar ciclo menstrual (se aplicável)", "Atenção a sinais autonômicos"], encaminhamentos: ["Avaliação médica para fatores sistêmicos ocultos"] },
};

function perdaDe(dim: string, score: number) {
  const cfg = TABELA_PERDAS[dim];
  if (!cfg) return { perda: 0, critico: false };
  const banda = cfg.bandas.find(b => score >= b.min && score < b.max) || cfg.bandas[cfg.bandas.length - 1];
  return { perda: banda.perda, critico: cfg.critico !== undefined && score >= cfg.critico };
}

function buildMyIDEnhancements(cs: any, myidScore: number, classificacao: string) {
  const scores: Record<string, number> = {
    D: Number(cs.D ?? cs.D_pain ?? 0),
    EFI: Number(cs.EFI ?? cs.EFI_functionality ?? 0),
    P: Number(cs.P ?? cs.P_psychological ?? 0),
    I: Number(cs.I ?? cs.I_inertia ?? 0),
    R: Number(cs.R ?? cs.R_regulation ?? 0),
    C: Number(cs.C ?? cs.C_context ?? 0),
    N: Number(cs.N ?? cs.N_noise ?? 0),
  };
  const perdas: Record<string, { perda: number; critico: boolean }> = {};
  let driverKey = "D", maxPerda = 0;
  for (const dim of Object.keys(scores)) {
    const p = perdaDe(dim, scores[dim]);
    perdas[dim] = p;
    const ajustada = p.perda * (p.critico ? 1.5 : 1);
    if (ajustada > maxPerda) { maxPerda = ajustada; driverKey = dim; }
  }
  const di = DRIVER_INTERVENCOES[driverKey] || DRIVER_INTERVENCOES.D;
  const driver = {
    key: driverKey,
    label: DIM_LABELS[driverKey] || driverKey,
    perda: perdas[driverKey].perda,
    score: scores[driverKey],
    intervencoes: di.intervencoes,
    encaminhamentos: di.encaminhamentos,
  };

  // Reforços por fase alinhados às 3 fases da diretriz
  const reforcos_por_fase = [
    {
      numero: 1,
      foco: `Reduzir sobrecarga em ${driver.label}`,
      intervencoes: [
        ...di.intervencoes.slice(0, 3),
        ...(perdas.R.perda >= 10 && driverKey !== "R" ? ["Higiene do sono: rotina fixa"] : []),
        ...(perdas.D.perda >= 14 && driverKey !== "D" ? ["Manejo concomitante da dor"] : []),
      ],
    },
    {
      numero: 2,
      foco: "Capacidade física e funcional",
      intervencoes: [
        "Core e estabilização 3×/sem",
        "Caminhada progressiva (10→30 min/dia)",
        "Mobilidade articular sistêmica",
        ...(perdas.EFI.perda >= 10 ? ["Retorno gradual às AVDs"] : []),
        ...(perdas.C.perda >= 7 ? ["Reestruturação gradual do contexto social"] : []),
      ],
    },
    {
      numero: 3,
      foco: "Prevenção e consolidação de hábitos",
      intervencoes: [
        "Programa domiciliar autônomo",
        "Hidratação 2L/dia",
        "Nutrição: 2 porções de vegetais/dia",
        "Ergonomia: ajuste definitivo do workstation",
        "Reavaliação MyID em 30 dias",
      ],
    },
  ];

  // Missões prioritárias (top 3)
  const missoes: { titulo: string; descricao: string; categoria: string; xp: number; dimensao: string }[] = [];
  if (perdas.D.perda >= 8) missoes.push({ titulo: "Respiração Terapêutica", descricao: "5 min de respiração diafragmática (4-7-8) ao acordar e antes de dormir.", categoria: perdas.D.perda >= 14 ? "urgente" : "importante", xp: 15, dimensao: "D" });
  if (perdas.R.perda >= 10) missoes.push({ titulo: "Ritual do Sono", descricao: "Desligar telas 1h antes de deitar e dormir 30 min mais cedo.", categoria: perdas.R.critico ? "urgente" : "importante", xp: 20, dimensao: "R" });
  if (perdas.P.perda >= 4) missoes.push({ titulo: "Desafio da Coragem", descricao: "Fazer UMA atividade que evita por medo da dor — com calma.", categoria: "urgente", xp: 25, dimensao: "P" });
  if (perdas.C.perda >= 7) missoes.push({ titulo: "Válvula de Escape", descricao: "Identificar UMA fonte de estresse controlável e definir ação para reduzi-la.", categoria: "importante", xp: 30, dimensao: "C" });
  if (missoes.length < 3) missoes.push({ titulo: "Caminhada Progressiva", descricao: "10 min hoje, +5 min a cada 3 dias. Meta: 30 min/dia.", categoria: "oportunidade", xp: 15, dimensao: "AF" });

  return {
    generated_at: new Date().toISOString(),
    myid_score: myidScore,
    classificacao,
    driver,
    reforcos_por_fase,
    missoes_prioritarias: missoes.slice(0, 4),
    meta_final: `MyID ${Math.min(100, Math.round(myidScore + 20))} em 6 semanas`,
  };
}



serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { avaliacao_id, link_avaliacao_id, token_acesso, result, raw_data } = await req.json();

    if (!result) {
      return new Response(JSON.stringify({ error: "result is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!avaliacao_id && !link_avaliacao_id) {
      return new Response(JSON.stringify({ error: "avaliacao_id or link_avaliacao_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Authorization: require either a valid therapist JWT OR a matching token_acesso
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    let authorizedUserId: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      const anon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data } = await anon.auth.getUser(authHeader.replace("Bearer ", "").trim());
      if (data?.user) authorizedUserId = data.user.id;
    }

    let pacienteId: string | null = null;
    let terapeutaId: string | null = null;

    // Path A: via myid_avaliacoes (requires token match OR therapist auth)
    if (avaliacao_id) {
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

      const tokenMatch = token_acesso && avaliacao.token_acesso === token_acesso;
      const therapistMatch = authorizedUserId && authorizedUserId === avaliacao.terapeuta_id;
      let patientSelfMatch = false;
      if (authorizedUserId && !therapistMatch && avaliacao.paciente_id) {
        const { data: pac } = await supabase
          .from("pacientes")
          .select("user_id")
          .eq("id", avaliacao.paciente_id)
          .maybeSingle();
        patientSelfMatch = !!pac && pac.user_id === authorizedUserId;
      }
      
      if (!tokenMatch && !therapistMatch && !patientSelfMatch) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("myid_avaliacoes").update({
        status: "concluido",
        respostas_brutas: raw_data,
        resultado_processado: result,
        updated_at: new Date().toISOString(),
      }).eq("id", avaliacao_id);

      pacienteId = avaliacao.paciente_id;
      terapeutaId = avaliacao.terapeuta_id;
    }

    // Path B: via links_avaliacao (must be active + not expired)
    if (!pacienteId && link_avaliacao_id) {
      const { data: link } = await supabase
        .from("links_avaliacao")
        .select("paciente_id, terapeuta_id, status, data_expiracao")
        .eq("id", link_avaliacao_id)
        .single();

      if (!link || link.status !== "ativo" || (link.data_expiracao && new Date(link.data_expiracao) < new Date())) {
        return new Response(JSON.stringify({ error: "Link inválido ou expirado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      pacienteId = link.paciente_id;
      terapeutaId = link.terapeuta_id;
    }

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
    const redFlags = result.red_flags_detected ?? result.redFlagsDetected ?? false;
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

      // MyID-100 scale: 0-100, higher = better
      const severityDesc = myidNum <= 29
        ? "SITUAÇÃO CRÍTICA — Paciente apresenta sobrecarga sistêmica extrema com múltiplos domínios comprometidos. Necessidade urgente de abordagem multidisciplinar."
        : myidNum <= 49
        ? "SOBRECARGA CRÍTICA — O perfil indica demandas que excedem significativamente a capacidade de regulação do paciente. Intervenção prioritária recomendada."
        : myidNum <= 69
        ? "SOBRECARGA MODERADA — Há desequilíbrio entre demandas e capacidades de recuperação. Monitoramento frequente e ajustes terapêuticos são indicados."
        : myidNum <= 84
        ? "BOA SAÚDE — Perfil bom com espaço para otimização. Tratamento conservador e ajustes de estilo de vida recomendados."
        : "EXCELENTE — O paciente apresenta boa capacidade de regulação com demandas controláveis. Manutenção e prevenção são o foco.";

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

      // Build concise 8-line summary for prontuário
      const topDomains = dimensions.filter(d => d.score >= 5).slice(0, 3).map(d => `${d.name} ${d.score.toFixed(1)}`).join(", ");
      const flagsSummary = redFlags && redFlagAlerts.length > 0 ? ` ⚠️ Red flags detectadas.` : "";
      
      const descricao = `MyID-100: ${myidFormatted}/100 — ${classificacao}.${flagsSummary}
Dor (D): ${scoreD}/10 | Funcionalidade (EFI): ${scoreEFI}/10 | Psicológico (P): ${scoreP}/10
Demanda (I): ${scoreI}/10 | Ruído (N): ${scoreN}/10 | Regulação (R): ${scoreR}/10
Domínios prioritários: ${topDomains || "nenhum em nível crítico"}.
Dor: ${painLocation !== "não especificada" ? painLocation : "local não especificado"}, NRS ${painIntensity}/10, ${painType !== "não especificado" ? painType : ""} ${painFrequency !== "não informada" ? `(${painFrequency})` : ""}.
Estilo de vida: ${lifestyleText}.${psychText ? `\nPerfil psicológico: ${pNum >= 7 ? "componente emocional significativo" : "influência psicológica moderada"}.` : ""}
${severityDesc.split("—")[0].trim()} — ${myidNum <= 49 ? "intervenção prioritária" : myidNum <= 69 ? "monitoramento e ajustes" : "manutenção e prevenção"}.
Avaliação via MyID-100 v2.0. Dados completos no dashboard.`;

      await supabase.from("notas_prontuario").insert({
        paciente_id: pacienteId,
        terapeuta_id: terapeutaId,
        tipo: "myid_resposta",
        titulo: `MyID Respondido — Score ${myidFormatted}/100 (${classificacao})`,
        descricao,
        dados_extras: { avaliacao_id: inserted.id, myid_score: myidScore, classificacao, scores: cs },
        referencia_id: inserted.id,
      });
    } catch (noteErr) {
      console.warn("Nota de prontuário não registrada:", noteErr);
    }

    // 7. ENRIQUECER DIRETRIZ ATIVA COM MELHORIAS BASEADAS NO MyID
    try {
      const { data: protocoloAtivo } = await supabase
        .from("protocolos")
        .select("id, scores_avaliacao")
        .eq("paciente_id", pacienteId)
        .eq("terapeuta_id", terapeutaId)
        .eq("status", "ativo")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (protocoloAtivo?.id) {
        const myidEnhancements = buildMyIDEnhancements(cs, myidScore, classificacao);
        const novosScores = {
          ...(protocoloAtivo.scores_avaliacao || {}),
          myid_enhancements: myidEnhancements,
        };
        await supabase
          .from("protocolos")
          .update({ scores_avaliacao: novosScores })
          .eq("id", protocoloAtivo.id);
        console.log(`[complete-myid] Diretriz ${protocoloAtivo.id} enriquecida com MyID.`);
      }
    } catch (enrichErr) {
      console.warn("Enriquecimento MyID da diretriz falhou (não bloqueante):", enrichErr);
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
