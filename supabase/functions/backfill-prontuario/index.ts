import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Get the calling user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const terapeutaId = user.id;
    let notasCriadas = 0;

    // 1. Get existing notas to avoid duplicates
    const { data: existingNotas } = await supabase
      .from("notas_prontuario")
      .select("referencia_id, tipo")
      .eq("terapeuta_id", terapeutaId);
    
    const existingRefs = new Set((existingNotas || []).map((n: any) => `${n.tipo}:${n.referencia_id}`));

    // 2. Backfill from avaliacoes_identidade
    const { data: avaliacoes } = await supabase
      .from("avaliacoes_identidade")
      .select("*")
      .eq("terapeuta_id", terapeutaId)
      .order("created_at", { ascending: true });

    for (const av of (avaliacoes || [])) {
      const key = `myid_resposta:${av.id}`;
      if (existingRefs.has(key)) continue;

      const myidScore = Number(av.myid_score ?? 0).toFixed(1);
      const classificacao = av.classificacao || "N/A";
      const dados = (av.dados_avaliacao || {}) as any;
      const resultado = dados?.resultado || {};
      const cs = resultado?.componentScores || resultado?.component_scores || {};

      const scoreD = Number(cs.D ?? av.score_d ?? 0).toFixed(1);
      const scoreEFI = Number(cs.EFI ?? av.score_efi ?? 0).toFixed(1);
      const scoreP = Number(cs.P ?? av.score_p ?? 0).toFixed(1);
      const scoreI = Number(cs.I ?? av.score_i ?? 0).toFixed(1);
      const scoreN = Number(cs.N ?? av.score_n ?? 0).toFixed(1);
      const scoreR = Number(cs.R ?? av.score_r ?? 0).toFixed(1);
      const scoreC = Number(cs.C ?? av.score_c ?? 0).toFixed(1);

      const isMyID = av.myid_score !== null && av.myid_score !== undefined;
      const isStructural = (dados?._type === 'structural');

      let descricao: string;
      let titulo: string;
      let tipo: string;

      if (isStructural) {
        tipo = "avaliacao_profissional";
        titulo = `Avaliação Estrutural — Score ${Number(av.score_e ?? 0).toFixed(1)}`;
        descricao = `🩺 AVALIAÇÃO PROFISSIONAL — Método Identidade (Estrutural)

📊 Score Estrutural: ${Number(av.score_e ?? 0).toFixed(1)}
${classificacao !== 'N/A' ? `🎯 Classificação: ${classificacao}` : ''}

Avaliação realizada presencialmente pelo terapeuta.
Paciente: ${av.paciente_nome}
Data: ${av.data_avaliacao}`;
      } else if (isMyID) {
        tipo = "myid_resposta";
        titulo = `MyID Respondido — Score ${myidScore} (${classificacao})`;
        descricao = `📋 QUESTIONÁRIO MyID RESPONDIDO

🎯 Score MyID: ${myidScore}/10 — Classificação: ${classificacao}

📊 SCORES POR DIMENSÃO:
• Dor (D): ${scoreD}/10
• Funcionalidade (EFI): ${scoreEFI}/10
• Psicológico (P): ${scoreP}/10
• Inércia/Demanda (I): ${scoreI}/10
• Ruído Sistêmico (N): ${scoreN}/10
• Regulação (R): ${scoreR}/10
• Contexto (C): ${scoreC}/10

Paciente: ${av.paciente_nome}
Data: ${av.data_avaliacao}`;
      } else {
        tipo = "avaliacao_profissional";
        titulo = `Avaliação Identidade — ${av.paciente_nome}`;
        descricao = `🩺 AVALIAÇÃO PROFISSIONAL — Método Identidade

📊 SCORES:
• E: ${Number(av.score_e ?? 0).toFixed(1)} • P: ${Number(av.score_p ?? 0).toFixed(1)}
• C: ${Number(av.score_c ?? 0).toFixed(1)} • D: ${Number(av.score_d ?? 0).toFixed(1)}
• R: ${Number(av.score_r ?? 0).toFixed(1)} • EFI: ${Number(av.score_efi ?? 0).toFixed(1)}
${classificacao !== 'N/A' ? `🎯 Classificação: ${classificacao}` : ''}

Paciente: ${av.paciente_nome}
Data: ${av.data_avaliacao}`;
      }

      await supabase.from("notas_prontuario").insert({
        paciente_id: av.paciente_id,
        terapeuta_id: terapeutaId,
        tipo,
        titulo,
        descricao,
        dados_extras: { backfill: true, myid_score: av.myid_score, classificacao },
        referencia_id: av.id,
        created_at: av.created_at,
      });
      notasCriadas++;
    }

    // 3. Backfill from daily_logs
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
        paciente_id: log.paciente_id,
        terapeuta_id: terapeutaId,
        tipo: "diario_paciente",
        titulo: `Diário — Dor ${log.pain}/10, Humor ${log.mood}/5, Sono ${log.sleep_hours}h`,
        descricao: `📱 DIÁRIO DO PACIENTE (Auto-reportado)

😊 Humor: ${moodLabels[log.mood] || log.mood}/5
🩹 Dor: ${log.pain}/10
⚡ Energia: ${log.energy}/5
😴 Sono: ${log.sleep_hours}h
${log.notes ? `\n📝 Observações:\n"${log.notes}"` : ''}`,
        dados_extras: { backfill: true, mood: log.mood, pain: log.pain, energy: log.energy, sleep: log.sleep_hours },
        referencia_id: log.id,
        created_at: log.created_at,
      });
      notasCriadas++;
    }

    // 4. Backfill from controle_sessoes
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
        paciente_id: sess.paciente_id,
        terapeuta_id: terapeutaId,
        tipo: "sessao_confirmada",
        titulo: `Sessão ${sess.tipo_atendimento || 'Retorno'} — ${dataSessao}`,
        descricao: `✅ ATENDIMENTO REGISTRADO

📅 Data: ${dataSessao}
⏱️ Duração: ${sess.duracao_minutos || 45} minutos
🏷️ Tipo: ${sess.tipo_atendimento || 'Retorno'}
📌 Status: ${sess.status}
${sess.observacoes ? `\n📝 Observações:\n${sess.observacoes}` : ''}`,
        dados_extras: { backfill: true, tipo: sess.tipo_atendimento, duracao: sess.duracao_minutos },
        referencia_id: sess.id,
        created_at: sess.created_at,
      });
      notasCriadas++;
    }

    return new Response(JSON.stringify({ ok: true, notas_criadas: notasCriadas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("backfill-prontuario error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
