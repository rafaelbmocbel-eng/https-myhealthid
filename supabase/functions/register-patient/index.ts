import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slug, nome, email, password, telefone, lgpd_aceite } = await req.json();

    if (!slug || !nome || !email || !password) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: slug, nome, email, password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Senha deve ter no mínimo 8 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lgpd_aceite) {
      return new Response(
        JSON.stringify({ error: "É necessário aceitar os termos LGPD para se cadastrar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Find the therapist by config_agenda slug
    const { data: config, error: configErr } = await supabaseAdmin
      .from("config_agenda")
      .select("terapeuta_id")
      .eq("slug", slug)
      .maybeSingle();

    if (configErr || !config) {
      return new Response(
        JSON.stringify({ error: "Link de cadastro inválido" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const terapeutaId = config.terapeuta_id;

    // 2) Create auth user (or detect existing)
    const { data: signUpData, error: signUpErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, is_patient: true },
    });

    let userId: string;

    if (signUpErr) {
      // If user already exists, try to find them
      if (signUpErr.message?.includes("already been registered") || signUpErr.message?.includes("already exists")) {
        const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
        if (!existingUser) {
          return new Response(
            JSON.stringify({ error: "E-mail já cadastrado. Use a tela de login do portal." }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        userId = existingUser.id;
      } else {
        const msg = signUpErr.message || '';
        const lower = msg.toLowerCase();
        let friendly = msg;
        if (lower.includes('weak') || lower.includes('pwned')) {
          friendly = 'Senha muito fraca. Escolha uma senha mais forte (evite "123456", "senha", etc.).';
        } else if (lower.includes('invalid') && lower.includes('email')) {
          friendly = 'E-mail inválido. Verifique e tente novamente.';
        }
        return new Response(
          JSON.stringify({ error: friendly }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      userId = signUpData.user.id;
    }

    // 3) Check if patient already linked
    const { data: existing } = await supabaseAdmin
      .from("pacientes")
      .select("id")
      .eq("user_id", userId)
      .eq("terapeuta_id", terapeutaId)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, paciente_id: existing.id, already_existed: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also check by email
    const { data: existingByEmail } = await supabaseAdmin
      .from("pacientes")
      .select("id, user_id")
      .eq("email", email.toLowerCase().trim())
      .eq("terapeuta_id", terapeutaId)
      .maybeSingle();

    if (existingByEmail) {
      // Link the user_id if not yet linked
      if (!existingByEmail.user_id) {
        await supabaseAdmin
          .from("pacientes")
          .update({ user_id: userId })
          .eq("id", existingByEmail.id);
      }
      return new Response(
        JSON.stringify({ success: true, paciente_id: existingByEmail.id, already_existed: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4) Create new patient record
    const nameParts = nome.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ");

    const { data: newPaciente, error: insertErr } = await supabaseAdmin
      .from("pacientes")
      .insert({
        terapeuta_id: terapeutaId,
        nome: firstName,
        sobrenome: lastName,
        email: email.toLowerCase().trim(),
        user_id: userId,
        ativo: true,
        origem: "link_cadastro",
      })
      .select("id")
      .single();

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: "Erro ao criar ficha: " + insertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, paciente_id: newPaciente.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
