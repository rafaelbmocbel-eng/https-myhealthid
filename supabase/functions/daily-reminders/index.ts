import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireInternal } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
  try { requireInternal(req); } catch (r) { return r as Response; }
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get tomorrow's date range
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()).toISOString();
    const tomorrowEnd = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1).toISOString();

    // Fetch all confirmed appointments for tomorrow
    const { data: agendamentos, error: agError } = await supabase
      .from("agendamentos")
      .select("id, terapeuta_id, paciente_id, data_inicio, data_fim, titulo, tipo_atendimento, status")
      .eq("status", "confirmado")
      .gte("data_inicio", tomorrowStart)
      .lt("data_inicio", tomorrowEnd);

    if (agError) throw agError;
    if (!agendamentos || agendamentos.length === 0) {
      return new Response(JSON.stringify({ message: "No appointments for tomorrow", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get unique paciente_ids to fetch names
    const pacienteIds = [...new Set(agendamentos.filter(a => a.paciente_id).map(a => a.paciente_id))];
    const { data: pacientes } = await supabase
      .from("pacientes")
      .select("id, nome, sobrenome, telefone")
      .in("id", pacienteIds);

    const pacienteMap = new Map((pacientes || []).map(p => [p.id, p]));

    // Group by terapeuta_id
    const byTerapeuta = new Map<string, typeof agendamentos>();
    for (const ag of agendamentos) {
      const list = byTerapeuta.get(ag.terapeuta_id) || [];
      list.push(ag);
      byTerapeuta.set(ag.terapeuta_id, list);
    }

    // Check notification preferences
    const terapeutaIds = [...byTerapeuta.keys()];
    const { data: prefs } = await supabase
      .from("preferencias_notificacao")
      .select("terapeuta_id, lembrete_consulta")
      .in("terapeuta_id", terapeutaIds);

    const prefMap = new Map((prefs || []).map(p => [p.terapeuta_id, p]));

    let created = 0;

    for (const [terapeutaId, ags] of byTerapeuta.entries()) {
      // Check if therapist has reminders enabled (default: true)
      const pref = prefMap.get(terapeutaId);
      if (pref && pref.lembrete_consulta === false) continue;

      // Create a summary notification
      const count = ags.length;
      const firstThree = ags.slice(0, 3).map(ag => {
        const pac = ag.paciente_id ? pacienteMap.get(ag.paciente_id) : null;
        const hora = new Date(ag.data_inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
        const nome = pac ? `${pac.nome} ${pac.sobrenome}` : ag.titulo || "Agendamento";
        return `${hora} - ${nome}`;
      });

      const descricao = count <= 3
        ? firstThree.join(" | ")
        : `${firstThree.join(" | ")} (+${count - 3} mais)`;

      const tomorrowLabel = tomorrow.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

      // Check if we already created this notification today (idempotency)
      const { data: existing } = await supabase
        .from("notificacoes")
        .select("id")
        .eq("terapeuta_id", terapeutaId)
        .eq("tipo", "lembrete_amanha")
        .gte("created_at", new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())
        .limit(1);

      if (existing && existing.length > 0) continue;

      const { error: insertError } = await supabase.from("notificacoes").insert({
        terapeuta_id: terapeutaId,
        tipo: "lembrete_amanha",
        titulo: `📅 ${count} sessão${count > 1 ? "ões" : ""} amanhã (${tomorrowLabel})`,
        descricao,
        rota: "/agenda",
      });

      if (!insertError) created++;
    }

    return new Response(
      JSON.stringify({ message: "Reminders created", created, totalAppointments: agendamentos.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in daily-reminders:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
