import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pacienteId } = await req.json();
    if (!pacienteId) throw new Error("pacienteId obrigatório");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validar usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) throw new Error("Não autenticado");

    // Paciente
    const { data: paciente } = await supabase
      .from("pacientes")
      .select("nome, sobrenome, data_nascimento, queixa_principal, observacoes")
      .eq("id", pacienteId)
      .maybeSingle();

    // Última MyID concluída
    const { data: myid } = await supabase
      .from("myid_avaliacoes")
      .select("resultado_processado, myid_score_parcial, updated_at, red_flags_detectadas")
      .eq("paciente_id", pacienteId)
      .eq("status", "concluido")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Últimas 5 notas de prontuário
    const { data: notas } = await supabase
      .from("notas_prontuario")
      .select("tipo, conteudo, created_at")
      .eq("paciente_id", pacienteId)
      .order("created_at", { ascending: false })
      .limit(5);

    // Últimos 5 atendimentos
    const { data: sessoes } = await supabase
      .from("agendamentos")
      .select("data_inicio, status, observacoes")
      .eq("paciente_id", pacienteId)
      .order("data_inicio", { ascending: false })
      .limit(5);

    const idade = paciente?.data_nascimento
      ? Math.floor((Date.now() - new Date(paciente.data_nascimento).getTime()) / 31557600000)
      : null;

    const systemPrompt = `Você é um assistente clínico que produz briefings rápidos para fisioterapeutas antes do atendimento. Seja direto, clínico e útil — sem jargão decorativo. Português do Brasil.`;

    const userPrompt = `Gere um RESUMO DE 30 SEGUNDOS sobre este paciente, no formato exato:

**🎯 Foco hoje:** [1 frase com a prioridade clínica do dia]

**📊 Estado atual:**
- [bullet curto sobre score MyID e principal perda]
- [bullet sobre dor/funcionalidade]
- [bullet sobre fator psicológico/contexto se relevante]

**⚠️ Atenção:** [red flag, alerta, ou "nenhum alerta crítico"]

**💡 Sugestão de abordagem:** [1-2 frases acionáveis para esta sessão]

DADOS:
Paciente: ${paciente?.nome} ${paciente?.sobrenome ?? ""}${idade ? `, ${idade} anos` : ""}
Queixa: ${paciente?.queixa_principal ?? "—"}
Observações: ${paciente?.observacoes ?? "—"}

MyID (${myid?.updated_at ? new Date(myid.updated_at).toLocaleDateString("pt-BR") : "sem MyID concluído"}):
Score: ${myid?.myid_score_parcial ?? "—"}
Red flags: ${myid?.red_flags_detectadas ? "SIM" : "não"}
Resultado: ${JSON.stringify(myid?.resultado_processado ?? {}).slice(0, 2500)}

Últimas notas: ${JSON.stringify(notas ?? []).slice(0, 1500)}

Últimas sessões: ${JSON.stringify(sessoes ?? []).slice(0, 800)}

Mantenha tudo em no máximo 8 linhas no total. Sem introdução, sem despedida.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429)
        return new Response(JSON.stringify({ error: "Limite de requisições. Tente em alguns segundos." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402)
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResp.json();
    const resumo = aiData.choices?.[0]?.message?.content?.trim() || "Sem dados suficientes para gerar resumo.";

    return new Response(
      JSON.stringify({
        resumo,
        contexto: {
          temMyID: !!myid,
          score: myid?.myid_score_parcial ?? null,
          redFlags: !!myid?.red_flags_detectadas,
          dataMyID: myid?.updated_at ?? null,
          totalNotas: notas?.length ?? 0,
          totalSessoes: sessoes?.length ?? 0,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("resumo-30s error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
