import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    let created = 0;

    // ─── 1. LEMBRETE DE SESSÃO (tomorrow's appointments) ───
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()).toISOString();
    const tomorrowEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1).toISOString();

    const { data: agendamentos } = await supabase
      .from("agendamentos")
      .select("id, terapeuta_id, paciente_id, data_inicio, titulo, status")
      .eq("status", "confirmado")
      .gte("data_inicio", tomorrowStart)
      .lt("data_inicio", tomorrowEnd)
      .not("paciente_id", "is", null);

    for (const ag of agendamentos || []) {
      const { data: paciente } = await supabase
        .from("pacientes")
        .select("nome")
        .eq("id", ag.paciente_id)
        .single();

      const nome = paciente?.nome || "Paciente";
      const hora = new Date(ag.data_inicio).toLocaleTimeString("pt-BR", {
        hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
      });

      // Check if already sent today
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const { data: existing } = await supabase
        .from("chat_mensagens")
        .select("id")
        .eq("paciente_id", ag.paciente_id)
        .eq("tipo", "lembrete_sessao")
        .gte("created_at", todayStart)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from("chat_mensagens").insert({
        terapeuta_id: ag.terapeuta_id,
        paciente_id: ag.paciente_id,
        remetente: "sistema",
        tipo: "lembrete_sessao",
        mensagem: `📅 Olá ${nome}! Lembrete: você tem sessão amanhã às ${hora}. Confirme sua presença! 😊`,
      });
      created++;
    }

    // ─── 2. PÓS-ATENDIMENTO (sessions completed today) ───
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const { data: concluidos } = await supabase
      .from("agendamentos")
      .select("id, terapeuta_id, paciente_id")
      .eq("status", "concluido")
      .gte("data_inicio", todayStart)
      .lt("data_inicio", todayEnd)
      .not("paciente_id", "is", null);

    for (const ag of concluidos || []) {
      const { data: paciente } = await supabase
        .from("pacientes")
        .select("nome")
        .eq("id", ag.paciente_id)
        .single();

      const nome = paciente?.nome || "Paciente";

      const { data: existing } = await supabase
        .from("chat_mensagens")
        .select("id")
        .eq("paciente_id", ag.paciente_id)
        .eq("tipo", "pos_atendimento")
        .gte("created_at", todayStart)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from("chat_mensagens").insert({
        terapeuta_id: ag.terapeuta_id,
        paciente_id: ag.paciente_id,
        remetente: "sistema",
        tipo: "pos_atendimento",
        mensagem: `✅ Olá ${nome}! Obrigado pela sessão de hoje. Lembre-se de seguir as orientações e preencher seu diário. Qualquer dúvida, estou aqui! 💪`,
      });
      created++;
    }

    // ─── 3. REENGAJAMENTO (inactive 14+ days) ───
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: allPacientes } = await supabase
      .from("pacientes")
      .select("id, nome, terapeuta_id")
      .eq("ativo", true);

    for (const pac of allPacientes || []) {
      // Check last appointment
      const { data: lastAg } = await supabase
        .from("agendamentos")
        .select("data_inicio")
        .eq("paciente_id", pac.id)
        .order("data_inicio", { ascending: false })
        .limit(1);

      if (!lastAg || lastAg.length === 0) continue;

      const lastDate = new Date(lastAg[0].data_inicio);
      const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSince < 14) continue;

      // Check if we sent reengajamento in the last 7 days
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: existing } = await supabase
        .from("chat_mensagens")
        .select("id")
        .eq("paciente_id", pac.id)
        .eq("tipo", "reengajamento")
        .gte("created_at", sevenDaysAgo.toISOString())
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from("chat_mensagens").insert({
        terapeuta_id: pac.terapeuta_id,
        paciente_id: pac.id,
        remetente: "sistema",
        tipo: "reengajamento",
        mensagem: `🔄 Olá ${pac.nome}! Sentimos sua falta! 😊 Já se passaram ${daysSince} dias desde sua última sessão. Que tal agendarmos um retorno? Sua continuidade é importante! 💪`,
      });
      created++;
    }

    // ─── 4. ANIVERSÁRIO ───
    const todayMMDD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const { data: aniversariantes } = await supabase
      .from("pacientes")
      .select("id, nome, terapeuta_id, data_nascimento")
      .eq("ativo", true)
      .not("data_nascimento", "is", null);

    for (const pac of aniversariantes || []) {
      if (!pac.data_nascimento) continue;
      const nascMMDD = pac.data_nascimento.substring(5, 10); // "YYYY-MM-DD" → "MM-DD"
      if (nascMMDD !== todayMMDD) continue;

      const { data: existing } = await supabase
        .from("chat_mensagens")
        .select("id")
        .eq("paciente_id", pac.id)
        .eq("tipo", "aniversario")
        .gte("created_at", todayStart)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await supabase.from("chat_mensagens").insert({
        terapeuta_id: pac.terapeuta_id,
        paciente_id: pac.id,
        remetente: "sistema",
        tipo: "aniversario",
        mensagem: `🎂🎉 Parabéns, ${pac.nome}! Desejamos muita saúde e felicidade! Continue cuidando de você. Um grande abraço! 💙`,
      });
      created++;
    }

    return new Response(
      JSON.stringify({ message: "Auto-messages processed", created }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in auto-messages:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
