// Edge function: paciente conta sua história de dor por voz/texto.
// Junta as respostas, chama voice-assessment (IA clínica) e salva em avaliacoes_voz.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Answer { pergunta: string; resposta: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Valida JWT do paciente
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const answers: Answer[] = Array.isArray(body?.answers) ? body.answers : [];
    const filled = answers.filter(a => (a?.resposta || "").trim().length >= 3);
    if (filled.length < 2) {
      return new Response(JSON.stringify({ error: "Conte um pouco mais sobre como você está." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service-role client (bypassa RLS para resolver paciente e gravar)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: paciente, error: pacErr } = await admin
      .from("pacientes")
      .select("id, nome, sobrenome, terapeuta_id, data_nascimento, sexo")
      .eq("user_id", userId)
      .maybeSingle();
    if (pacErr || !paciente) {
      return new Response(JSON.stringify({ error: "paciente_nao_encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Anti-spam: 1 envio por 24h
    const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recente } = await admin
      .from("avaliacoes_voz")
      .select("id, created_at, resultado")
      .eq("paciente_id", paciente.id)
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(5);
    const recenteHistoria = (recente || []).find((r: any) =>
      r?.resultado?._meta?.origem === "portal_paciente_historia"
    );
    if (recenteHistoria) {
      return new Response(JSON.stringify({
        error: "Você já enviou sua história nas últimas 24h. Tente novamente amanhã.",
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Conta se é a primeira avaliação do paciente
    const { count: totalAvals } = await admin
      .from("avaliacoes_voz")
      .select("id", { count: "exact", head: true })
      .eq("paciente_id", paciente.id);
    const tipo: "inicial" | "atualizacao" = (totalAvals ?? 0) === 0 ? "inicial" : "atualizacao";

    // Monta transcrição estruturada
    const patientName = `${paciente.nome ?? ""} ${paciente.sobrenome ?? ""}`.trim();
    const transcript = filled
      .map(a => `Pergunta: ${a.pergunta}\nResposta: ${a.resposta.trim()}`)
      .join("\n\n");

    // Chama voice-assessment (IA clínica) reusando infra existente
    let assessment: any = null;
    try {
      const aiRes = await fetch(`${SUPABASE_URL}/functions/v1/voice-assessment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE}`,
          apikey: SERVICE_ROLE,
        },
        body: JSON.stringify({
          transcript,
          serviceType: "identidade",
          patientName,
        }),
      });
      if (aiRes.ok) {
        assessment = await aiRes.json();
      } else {
        console.warn("[historia-paciente] voice-assessment falhou:", aiRes.status, await aiRes.text());
      }
    } catch (e) {
      console.error("[historia-paciente] erro ao chamar IA:", e);
    }

    const resultado = {
      ...(assessment || {}),
      _meta: {
        origem: "portal_paciente_historia",
        tipo,
        savedAt: new Date().toISOString(),
        respostas_estruturadas: filled,
        precisa_exame_fisico: tipo === "inicial",
      },
    };

    const { data: inserted, error: insErr } = await admin
      .from("avaliacoes_voz")
      .insert({
        terapeuta_id: paciente.terapeuta_id,
        paciente_id: paciente.id,
        paciente_nome: patientName || null,
        servico: "identidade",
        transcricao: transcript,
        resultado,
        classificacao_severidade: assessment?.classificacao_severidade ?? null,
        queixa_principal: assessment?.queixa_principal ?? null,
      })
      .select("id")
      .single();
    if (insErr) {
      console.error("[historia-paciente] insert error:", insErr);
      return new Response(JSON.stringify({ error: "Não foi possível salvar sua história." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Notifica o profissional
    await admin.from("notificacoes").insert({
      terapeuta_id: paciente.terapeuta_id,
      tipo: tipo === "inicial" ? "historia_paciente_inicial" : "historia_paciente_atualizacao",
      titulo: tipo === "inicial"
        ? "🎙️ Nova história contada — avaliação inicial"
        : "🎙️ Paciente atualizou a história",
      descricao: `${patientName || "Paciente"} ${tipo === "inicial"
        ? "respondeu a primeira história em voz. Falta o exame físico para concluir a avaliação."
        : "enviou uma atualização do quadro atual."}`,
      rota: `/pacientes/${paciente.id}?tab=acompanhamento`,
      metadata: {
        avaliacao_id: inserted.id,
        paciente_id: paciente.id,
        tipo,
      },
    });

    return new Response(JSON.stringify({ ok: true, id: inserted.id, tipo }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[historia-paciente] erro:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
