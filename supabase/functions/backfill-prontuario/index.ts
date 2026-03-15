import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function generateRichMyIDNote(av: any, cs: any) {
  const myidScore = Number(av.myid_score ?? 0);
  const myidFormatted = myidScore.toFixed(1);
  const classificacao = av.classificacao || "N/A";
  const dNum = Number(cs.D ?? av.score_d ?? 0);
  const efiNum = Number(cs.EFI ?? av.score_efi ?? 0);
  const pNum = Number(cs.P ?? av.score_p ?? 0);
  const iNum = Number(cs.I ?? av.score_i ?? 0);
  const nNum = Number(cs.N ?? av.score_n ?? 0);
  const rNum = Number(cs.R ?? av.score_r ?? 0);
  const cNum = Number(cs.C ?? av.score_c ?? 0);

  const severityDesc = myidScore >= 8
    ? "RISCO DE CRONIFICAÇÃO — Paciente apresenta sobrecarga sistêmica extrema com múltiplos domínios comprometidos. Necessidade urgente de abordagem multidisciplinar."
    : myidScore >= 6
    ? "SOBRECARGA CRÍTICA — O perfil indica demandas que excedem significativamente a capacidade de regulação do paciente. Intervenção prioritária recomendada."
    : myidScore >= 3
    ? "SOBRECARGA MODERADA — Há desequilíbrio entre demandas e capacidades de recuperação. Monitoramento frequente e ajustes terapêuticos são indicados."
    : "RECUPERAÇÃO FAVORÁVEL — O paciente apresenta boa capacidade de regulação com demandas controláveis.";

  const dimensions = [
    { name: "Dor", score: dNum, desc: "intensidade e frequência da dor reportada" },
    { name: "Funcionalidade", score: efiNum, desc: "limitação funcional nas atividades diárias" },
    { name: "Psicológico", score: pNum, desc: "fatores emocionais como catastrofização e ansiedade" },
    { name: "Demanda/Inércia", score: iNum, desc: "carga de demandas físicas e ocupacionais" },
    { name: "Ruído Sistêmico", score: nNum, desc: "fatores de estilo de vida como sono, estresse e hidratação" },
  ].sort((a, b) => b.score - a.score);

  const topConcerns = dimensions.filter(d => d.score >= 5);
  const topConcernsText = topConcerns.length > 0
    ? topConcerns.map(d => `  • ${d.name} (${d.score.toFixed(1)}/10): ${d.desc}`).join("\n")
    : "  Nenhum domínio em nível crítico identificado.";

  // Extract raw data if available
  const dados = (av.dados_avaliacao || {}) as any;
  const rd = dados?.respostas || dados?.resultado?.raw_data || {};
  const painLocation = rd.painLocation || rd.localizacao_dor || rd.bloco_2_location || "";
  const painIntensity = rd.painIntensity ?? rd.nrs ?? rd.bloco_2_nrs ?? "";
  const sleepHours = rd.sleepHours ?? rd.horas_sono ?? rd.bloco_5_sleep_hours ?? "";
  const stressLevel = rd.stressLevel ?? rd.nivel_estresse ?? rd.bloco_5_stress ?? "";

  const redFlags = av.red_flags;
  const flagsText = redFlags && Array.isArray(redFlags) && redFlags.length > 0
    ? `\n⚠️ RED FLAGS DETECTADAS:\n${redFlags.map((f: string) => `  🚨 ${f}`).join("\n")}\n  ➡️ Requer avaliação médica complementar.`
    : "";

  const clinicalNarrative = topConcerns.length >= 3
    ? "O perfil revela comprometimento em múltiplas dimensões, sugerindo condição de complexidade elevada que demanda abordagem integrada e multidisciplinar."
    : topConcerns.length >= 1
    ? `Os domínios de ${topConcerns.map(d => d.name).join(" e ")} requerem atenção prioritária nas condutas terapêuticas.`
    : "O perfil sistêmico encontra-se em faixa favorável, com foco recomendado em manutenção e prevenção.";

  const painCombo = dNum >= 6 && efiNum >= 6
    ? " A combinação de dor intensa com limitação funcional significativa indica necessidade de intervenção analgésica associada à reabilitação funcional progressiva."
    : "";
  const psychoNote = pNum >= 6
    ? " O componente psicológico elevado sugere que estratégias de educação em dor e regulação emocional devem ser incorporadas ao plano terapêutico."
    : "";
  const noiseNote = nNum >= 6
    ? " Os fatores de estilo de vida comprometidos podem estar perpetuando o quadro — orientações sobre higiene do sono, manejo do estresse e hábitos saudáveis são essenciais."
    : "";

  return `📋 QUESTIONÁRIO MyID RESPONDIDO PELO PACIENTE — ${av.paciente_nome}

🎯 RESULTADO GERAL: Score MyID ${myidFormatted}/10 — ${classificacao}
📌 ${severityDesc}
${flagsText}

📊 PERFIL MULTIDIMENSIONAL:
• Dor (D): ${dNum.toFixed(1)}/10 — ${dNum >= 7 ? "dor intensa" : dNum >= 4 ? "dor moderada" : "dor leve/controlada"}${painLocation ? `, localizada em ${painLocation}` : ""}
• Funcionalidade (EFI): ${efiNum.toFixed(1)}/10 — ${efiNum >= 7 ? "limitação funcional severa" : efiNum >= 4 ? "limitação funcional moderada" : "funcionalidade preservada"}
• Psicológico (P): ${pNum.toFixed(1)}/10 — ${pNum >= 7 ? "componente emocional significativo" : pNum >= 4 ? "influência psicológica moderada" : "perfil emocional estável"}
• Demanda (I): ${iNum.toFixed(1)}/10 — ${iNum >= 7 ? "sobrecarga de demandas elevada" : iNum >= 4 ? "demandas moderadas" : "demandas controladas"}
• Ruído Sistêmico (N): ${nNum.toFixed(1)}/10 — ${nNum >= 7 ? "múltiplos fatores comprometidos" : nNum >= 4 ? "alguns fatores afetados" : "estilo de vida favorável"}
• Regulação (R): ${rNum.toFixed(1)}/10
• Contexto (C): ${cNum.toFixed(1)}/10

🔍 DOMÍNIOS PRIORITÁRIOS (scores ≥ 5):
${topConcernsText}
${sleepHours || stressLevel || painIntensity ? `
🧬 DADOS REPORTADOS:${painIntensity ? ` NRS ${painIntensity}/10.` : ""}${sleepHours ? ` Sono: ${sleepHours}h/noite.` : ""}${stressLevel ? ` Estresse: ${stressLevel}/10.` : ""}` : ""}

📝 INTERPRETAÇÃO CLÍNICA:
O paciente ${av.paciente_nome} apresenta um índice MyID de ${myidFormatted}/10, classificado como "${classificacao}". ${clinicalNarrative}${painCombo}${psychoNote}${noiseNote}

🔄 Avaliação preenchida pelo paciente. Dados completos disponíveis no dashboard.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const terapeutaId = user.id;
    const body = await req.json().catch(() => ({}));
    const forceRegenerate = body.force === true;
    let notasCriadas = 0;

    // If force regenerate, delete existing MyID notes to recreate with rich format
    if (forceRegenerate) {
      await supabase
        .from("notas_prontuario")
        .delete()
        .eq("terapeuta_id", terapeutaId)
        .in("tipo", ["myid_resposta", "avaliacao_profissional"]);
    }

    // Get existing notas to avoid duplicates
    const { data: existingNotas } = await supabase
      .from("notas_prontuario")
      .select("referencia_id, tipo")
      .eq("terapeuta_id", terapeutaId);
    
    const existingRefs = new Set((existingNotas || []).map((n: any) => `${n.tipo}:${n.referencia_id}`));

    // Backfill from avaliacoes_identidade
    const { data: avaliacoes } = await supabase
      .from("avaliacoes_identidade")
      .select("*")
      .eq("terapeuta_id", terapeutaId)
      .order("created_at", { ascending: true });

    for (const av of (avaliacoes || [])) {
      const isMyID = av.myid_score !== null && av.myid_score !== undefined;
      const dados = (av.dados_avaliacao || {}) as any;
      const isStructural = dados?._type === 'structural';
      const resultado = dados?.resultado || {};
      const cs = resultado?.componentScores || resultado?.component_scores || {};

      let tipo: string;
      let titulo: string;
      let descricao: string;

      if (isStructural) {
        tipo = "avaliacao_profissional";
        const key = `${tipo}:${av.id}`;
        if (existingRefs.has(key)) continue;
        titulo = `Avaliação Estrutural — Score ${Number(av.score_e ?? 0).toFixed(1)}`;
        descricao = `🩺 AVALIAÇÃO PROFISSIONAL — Método Identidade (Estrutural)

📊 Score Estrutural: ${Number(av.score_e ?? 0).toFixed(1)}
${av.classificacao ? `🎯 Classificação: ${av.classificacao}` : ''}

Avaliação realizada presencialmente pelo terapeuta.
Paciente: ${av.paciente_nome} — Data: ${av.data_avaliacao}`;
      } else if (isMyID) {
        tipo = "myid_resposta";
        const key = `${tipo}:${av.id}`;
        if (existingRefs.has(key)) continue;
        titulo = `MyID Respondido — Score ${Number(av.myid_score).toFixed(1)} (${av.classificacao || "N/A"})`;
        descricao = generateRichMyIDNote(av, cs);
      } else {
        tipo = "avaliacao_profissional";
        const key = `${tipo}:${av.id}`;
        if (existingRefs.has(key)) continue;
        titulo = `Avaliação Identidade — ${av.paciente_nome}`;
        descricao = `🩺 AVALIAÇÃO PROFISSIONAL — Método Identidade

📊 SCORES:
• E: ${Number(av.score_e ?? 0).toFixed(1)} • P: ${Number(av.score_p ?? 0).toFixed(1)}
• C: ${Number(av.score_c ?? 0).toFixed(1)} • D: ${Number(av.score_d ?? 0).toFixed(1)}
• R: ${Number(av.score_r ?? 0).toFixed(1)} • EFI: ${Number(av.score_efi ?? 0).toFixed(1)}
${av.classificacao ? `🎯 Classificação: ${av.classificacao}` : ''}

Paciente: ${av.paciente_nome} — Data: ${av.data_avaliacao}`;
      }

      await supabase.from("notas_prontuario").insert({
        paciente_id: av.paciente_id,
        terapeuta_id: terapeutaId,
        tipo, titulo, descricao,
        dados_extras: { backfill: true, myid_score: av.myid_score, classificacao: av.classificacao },
        referencia_id: av.id,
        created_at: av.created_at,
      });
      notasCriadas++;
    }

    // Backfill from daily_logs (only if not force — those are fine)
    if (!forceRegenerate) {
      const { data: logs } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("terapeuta_id", terapeutaId)
        .order("created_at", { ascending: true });

      for (const log of (logs || [])) {
        const key = `diario_paciente:${log.id}`;
        if (existingRefs.has(key)) continue;
        const moodLabels = ['', '😔 Muito Ruim', '😟 Ruim', '😐 Neutro', '🙂 Bom', '😊 Muito Bom'];
        await supabase.from("notas_prontuario").insert({
          paciente_id: log.paciente_id, terapeuta_id: terapeutaId,
          tipo: "diario_paciente",
          titulo: `Diário — Dor ${log.pain}/10, Humor ${log.mood}/5, Sono ${log.sleep_hours}h`,
          descricao: `📱 DIÁRIO DO PACIENTE\n😊 Humor: ${moodLabels[log.mood] || log.mood}/5\n🩹 Dor: ${log.pain}/10\n⚡ Energia: ${log.energy}/5\n😴 Sono: ${log.sleep_hours}h${log.notes ? `\n📝 "${log.notes}"` : ''}`,
          dados_extras: { backfill: true },
          referencia_id: log.id, created_at: log.created_at,
        });
        notasCriadas++;
      }

      const { data: sessoes } = await supabase
        .from("controle_sessoes")
        .select("*")
        .eq("terapeuta_id", terapeutaId)
        .order("created_at", { ascending: true });

      for (const sess of (sessoes || [])) {
        const key = `sessao_confirmada:${sess.id}`;
        if (existingRefs.has(key)) continue;
        const dataSessao = new Date(sess.data_sessao).toLocaleDateString('pt-BR');
        await supabase.from("notas_prontuario").insert({
          paciente_id: sess.paciente_id, terapeuta_id: terapeutaId,
          tipo: "sessao_confirmada",
          titulo: `Sessão ${sess.tipo_atendimento || 'Retorno'} — ${dataSessao}`,
          descricao: `✅ ATENDIMENTO\n📅 ${dataSessao}\n⏱️ ${sess.duracao_minutos || 45}min\n🏷️ ${sess.tipo_atendimento || 'Retorno'}${sess.observacoes ? `\n📝 ${sess.observacoes}` : ''}`,
          dados_extras: { backfill: true },
          referencia_id: sess.id, created_at: sess.created_at,
        });
        notasCriadas++;
      }
    }

    return new Response(JSON.stringify({ ok: true, notas_criadas: notasCriadas, force: forceRegenerate }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("backfill-prontuario error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
