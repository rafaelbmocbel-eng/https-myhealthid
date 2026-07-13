// Backfill de dicas IA: gera as dicas personalizadas para TODOS os pacientes
// do terapeuta que já têm MyID concluído e ainda não têm dicas — cobre quem
// respondeu o MyID antes do gatilho automático existir.
// Processa em lote com orçamento de tempo; o app chama de novo até restantes=0.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Autentica o terapeuta — o backfill roda só sobre os pacientes dele.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const authed = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await authed.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Pacientes ativos com MyID concluído
    const { data: avals } = await admin
      .from("myid_avaliacoes")
      .select("paciente_id")
      .eq("terapeuta_id", user.id)
      .eq("status", "concluido")
      .not("paciente_id", "is", null);
    const idsMyid = [...new Set((avals || []).map((a: any) => a.paciente_id as string))];
    if (idsMyid.length === 0) return json({ ok: true, total: 0, gerados: 0, pulados: 0, restantes: 0 });

    // Quem já tem dicas não precisa (idempotente)
    const { data: jaTem } = await admin
      .from("paciente_dicas")
      .select("paciente_id")
      .in("paciente_id", idsMyid);
    const comDicas = new Set((jaTem || []).map((d: any) => d.paciente_id as string));

    // Só pacientes ativos
    const { data: ativos } = await admin
      .from("pacientes")
      .select("id")
      .in("id", idsMyid)
      .eq("ativo", true);
    const idsAtivos = (ativos || []).map((p: any) => p.id as string);

    const pendentes = idsAtivos.filter((id) => !comDicas.has(id));
    const total = idsAtivos.length;

    // Gera sequencialmente com orçamento de tempo (a função tem limite de
    // execução) — o frontend chama de novo enquanto houver restantes.
    const inicio = Date.now();
    const BUDGET_MS = 100_000;
    let gerados = 0, falhas = 0;
    for (const paciente_id of pendentes) {
      if (Date.now() - inicio > BUDGET_MS) break;
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/gerar-dicas-paciente`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ paciente_id }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && (j as any)?.ok) gerados++;
        else falhas++;
      } catch {
        falhas++;
      }
    }

    const restantes = pendentes.length - gerados - falhas;
    return json({
      ok: true,
      total,                       // pacientes ativos com MyID concluído
      ja_tinham: comDicas.size,    // já tinham dicas antes desta chamada
      gerados,                     // gerados agora
      falhas,                      // sem evidência/erro de IA nesta rodada
      restantes: Math.max(0, restantes),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "erro interno" }, 500);
  }
});
