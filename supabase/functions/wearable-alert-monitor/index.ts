import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireInternal } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

interface AlertaPayload {
  paciente_id: string;
  terapeuta_id: string;
  tipo: string;
  severidade: "baixo" | "medio" | "alto";
  titulo: string;
  descricao: string;
  metrica_atual?: number | null;
  metrica_referencia?: number | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try { requireInternal(req); } catch (r) { return r as Response; }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Pega métricas semanais de todos os pacientes que têm wearable
    const { data: metricas, error: errMetrics } = await supabase
      .from("wearable_metricas_semanais")
      .select("*");

    if (errMetrics) throw errMetrics;

    // 2) Mapeia paciente → terapeuta
    const pacienteIds = (metricas ?? []).map((m: any) => m.paciente_id);
    const { data: pacientes } = await supabase
      .from("pacientes")
      .select("id, terapeuta_id, nome")
      .in("id", pacienteIds.length ? pacienteIds : ["00000000-0000-0000-0000-000000000000"]);

    const pacMap = new Map<string, { terapeuta_id: string; nome: string }>();
    (pacientes ?? []).forEach((p: any) => pacMap.set(p.id, { terapeuta_id: p.terapeuta_id, nome: p.nome }));

    const alertas: AlertaPayload[] = [];
    const hoje = new Date();

    for (const m of metricas ?? []) {
      const pac = pacMap.get(m.paciente_id);
      if (!pac) continue;

      // Queda de passos ≥50%
      if (m.passos_media_7d && m.passos_media_semana_anterior && m.passos_media_semana_anterior > 0) {
        const queda = 1 - m.passos_media_7d / m.passos_media_semana_anterior;
        if (queda >= 0.5) {
          alertas.push({
            paciente_id: m.paciente_id,
            terapeuta_id: pac.terapeuta_id,
            tipo: "queda_passos",
            severidade: queda >= 0.7 ? "alto" : "medio",
            titulo: `${pac.nome}: queda de ${Math.round(queda * 100)}% em passos`,
            descricao: `Média 7d: ${m.passos_media_7d} passos vs ${m.passos_media_semana_anterior} na semana anterior.`,
            metrica_atual: m.passos_media_7d,
            metrica_referencia: m.passos_media_semana_anterior,
          });
        }
      }

      // FC de repouso elevada (>85bpm sustentada)
      if (m.fc_repouso_media_7d && m.fc_repouso_media_7d > 85) {
        alertas.push({
          paciente_id: m.paciente_id,
          terapeuta_id: pac.terapeuta_id,
          tipo: "fc_elevada",
          severidade: m.fc_repouso_media_7d > 95 ? "alto" : "medio",
          titulo: `${pac.nome}: FC repouso elevada (${m.fc_repouso_media_7d} bpm)`,
          descricao: "Média de 7 dias acima do esperado. Avaliar estresse/recuperação.",
          metrica_atual: m.fc_repouso_media_7d,
          metrica_referencia: 70,
        });
      }

      // Sem sync há ≥3 dias
      if (m.ultimo_dia_com_dados) {
        const diff = Math.floor((hoje.getTime() - new Date(m.ultimo_dia_com_dados).getTime()) / 86_400_000);
        if (diff >= 3) {
          alertas.push({
            paciente_id: m.paciente_id,
            terapeuta_id: pac.terapeuta_id,
            tipo: "sem_sync",
            severidade: diff >= 7 ? "alto" : "baixo",
            titulo: `${pac.nome}: sem sincronização há ${diff} dias`,
            descricao: "Wearable parou de enviar dados. Verifique com o paciente.",
            metrica_atual: diff,
            metrica_referencia: 1,
          });
        }
      }
    }

    // Sono baixo (últimos 7d) — consulta separada
    const seteDiasAtras = new Date(Date.now() - 7 * 86_400_000).toISOString().split("T")[0];
    const { data: sleeps } = await supabase
      .from("sleep_logs")
      .select("paciente_id, total_hours")
      .gte("date", seteDiasAtras);

    const sleepByPac = new Map<string, number[]>();
    (sleeps ?? []).forEach((s: any) => {
      const arr = sleepByPac.get(s.paciente_id) ?? [];
      arr.push(Number(s.total_hours) || 0);
      sleepByPac.set(s.paciente_id, arr);
    });

    for (const [pid, horas] of sleepByPac.entries()) {
      const media = horas.reduce((a, b) => a + b, 0) / horas.length;
      if (media < 6 && horas.length >= 3) {
        const pac = pacMap.get(pid);
        if (!pac) continue;
        alertas.push({
          paciente_id: pid,
          terapeuta_id: pac.terapeuta_id,
          tipo: "sono_baixo",
          severidade: media < 5 ? "alto" : "medio",
          titulo: `${pac.nome}: sono médio de ${media.toFixed(1)}h`,
          descricao: "Sono insuficiente nos últimos 7 dias. Considerar intervenção em R1.",
          metrica_atual: Math.round(media * 10) / 10,
          metrica_referencia: 7,
        });
      }
    }

    // Dedup: não recriar alerta do mesmo tipo se houver não-lido nas últimas 24h
    let inseridos = 0;
    for (const a of alertas) {
      const ontem = new Date(Date.now() - 86_400_000).toISOString();
      const { data: existente } = await supabase
        .from("wearable_alertas")
        .select("id")
        .eq("paciente_id", a.paciente_id)
        .eq("tipo", a.tipo)
        .gte("detectado_em", ontem)
        .maybeSingle();

      if (existente) continue;

      const { error } = await supabase.from("wearable_alertas").insert(a);
      if (!error) inseridos++;
    }

    return new Response(
      JSON.stringify({ ok: true, avaliados: metricas?.length ?? 0, alertas_gerados: inseridos }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[wearable-alert-monitor]", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
