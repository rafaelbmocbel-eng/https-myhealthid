import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { evento_id, nome, email, telefone, respostas, paciente_id: body_paciente_id } = await req.json();
    if (!evento_id || !nome) {
      return new Response(JSON.stringify({ error: "nome e evento_id obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check event exists and is active
    const { data: evento, error: evErr } = await supabase
      .from("eventos")
      .select("*")
      .eq("id", evento_id)
      .eq("ativo", true)
      .single();

    if (evErr || !evento) {
      return new Response(JSON.stringify({ error: "Evento não encontrado ou inativo" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check vagas
    if (evento.vagas_max) {
      const { count } = await supabase
        .from("evento_inscricoes")
        .select("*", { count: "exact", head: true })
        .eq("evento_id", evento_id)
        .neq("status", "cancelado");
      if ((count || 0) >= evento.vagas_max) {
        return new Response(JSON.stringify({ error: "Vagas esgotadas" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Determine paciente_id
    let paciente_id: string | null = body_paciente_id || null;
    let ja_era_paciente = false;

    // If paciente_id was passed (from patient portal), verify it exists
    if (paciente_id) {
      const { data: existingPac } = await supabase
        .from("pacientes")
        .select("id")
        .eq("id", paciente_id)
        .maybeSingle();
      if (existingPac) {
        ja_era_paciente = true;
      } else {
        paciente_id = null;
      }
    }

    // If no paciente_id yet, try to find by email
    if (!paciente_id && email) {
      const { data: existing } = await supabase
        .from("pacientes")
        .select("id")
        .eq("terapeuta_id", evento.terapeuta_id)
        .ilike("email", email.trim())
        .maybeSingle();

      if (existing) {
        paciente_id = existing.id;
        ja_era_paciente = true;
      }
    }

    // Check if already inscribed
    if (paciente_id) {
      const { data: existingInsc } = await supabase
        .from("evento_inscricoes")
        .select("id")
        .eq("evento_id", evento_id)
        .eq("paciente_id", paciente_id)
        .neq("status", "cancelado")
        .maybeSingle();

      if (existingInsc) {
        return new Response(JSON.stringify({ error: "Você já está inscrito neste evento" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Auto-register as patient if new
    if (!paciente_id) {
      const nameParts = nome.trim().split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ") || "";

      const { data: newPaciente } = await supabase
        .from("pacientes")
        .insert({
          terapeuta_id: evento.terapeuta_id,
          nome: firstName,
          sobrenome: lastName,
          email: email || null,
          telefone: telefone || null,
          observacoes: `Cadastro via evento: ${evento.titulo}`,
        })
        .select("id")
        .single();

      if (newPaciente) paciente_id = newPaciente.id;
    }

    // Create inscription
    const { data: inscricao, error: insErr } = await supabase
      .from("evento_inscricoes")
      .insert({
        evento_id,
        paciente_id,
        nome,
        email: email || null,
        telefone: telefone || null,
        ja_era_paciente,
        pago: !evento.cobrar_pagamento,
      })
      .select("id")
      .single();

    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Save answers
    if (respostas && Array.isArray(respostas) && respostas.length > 0) {
      const rows = respostas.map((r: { pergunta_id: string; resposta: any }) => ({
        inscricao_id: inscricao.id,
        pergunta_id: r.pergunta_id,
        resposta: r.resposta,
      }));
      await supabase.from("evento_respostas").insert(rows);
    }

    // Notify therapist
    await supabase.from("notificacoes").insert({
      terapeuta_id: evento.terapeuta_id,
      tipo: "evento",
      titulo: `Nova inscrição: ${evento.titulo}`,
      descricao: `${nome} se inscreveu no evento "${evento.titulo}".${ja_era_paciente ? " (Paciente ativo)" : " (Novo paciente cadastrado)"}`,
      rota: "/eventos",
    });

    return new Response(
      JSON.stringify({ success: true, inscricao_id: inscricao.id, ja_era_paciente }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
