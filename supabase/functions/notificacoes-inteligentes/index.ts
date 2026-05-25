// ═══════════════════════════════════════════════════════════
// NOTIFICAÇÕES INTELIGENTES — Sprint 1
// Cron a cada 30 min. Para cada terapeuta com feature ativa,
// identifica o driver primário do MyID mais recente de cada
// paciente e dispara as regras correspondentes na janela atual.
// ═══════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, requireInternal } from "../_shared/auth.ts";

interface Regra {
  id: string;
  terapeuta_id: string;
  driver: string;
  titulo: string;
  template_mensagem: string;
  canal: "in_app" | "whatsapp" | "push";
  horario_envio: string; // HH:MM:SS
  dias_semana: number[];
  intervalo_repeticao_horas: number | null;
  ativo: boolean;
}

function nowInBRT(): { hour: number; minute: number; weekday: number; iso: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const hour = parseInt(parts.find(p => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find(p => p.type === "minute")?.value || "0", 10);
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const wd = parts.find(p => p.type === "weekday")?.value || "Sun";
  return { hour, minute, weekday: weekdayMap[wd] ?? 0, iso: new Date().toISOString() };
}

function applyTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    try { requireInternal(req); } catch (r) { return r as Response; }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { hour, minute, weekday } = nowInBRT();
    const nowMinutes = hour * 60 + minute;

    // 1. Terapeutas com feature ativa
    const { data: configs } = await supabase
      .from("notificacao_inteligente_config")
      .select("terapeuta_id, janela_minutos")
      .eq("ativa", true);

    if (!configs?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no active configs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;
    const errors: string[] = [];

    for (const cfg of configs) {
      const janela = cfg.janela_minutos ?? 30;

      // 2. Regras ativas do terapeuta dentro da janela atual
      const { data: regras } = await supabase
        .from("notificacao_regras")
        .select("*")
        .eq("terapeuta_id", cfg.terapeuta_id)
        .eq("ativo", true);

      const regrasDevidas = (regras || []).filter((r: Regra) => {
        if (!r.dias_semana?.includes(weekday)) return false;
        const [h, m] = r.horario_envio.split(":").map(Number);
        const ruleMin = h * 60 + m;
        const diff = nowMinutes - ruleMin;
        // Dentro da janela após o horário (não envia se atrasou demais)
        if (diff >= 0 && diff < janela) return true;
        // Repetição periódica
        if (r.intervalo_repeticao_horas) {
          const intervalMin = r.intervalo_repeticao_horas * 60;
          if (diff >= 0 && diff % intervalMin < janela) return true;
        }
        return false;
      });

      if (!regrasDevidas.length) continue;

      // 3. Pacientes ativos do terapeuta
      const { data: pacientes } = await supabase
        .from("pacientes")
        .select("id, nome, telefone, user_id")
        .eq("terapeuta_id", cfg.terapeuta_id)
        .eq("ativo", true);

      if (!pacientes?.length) continue;

      // 4. Último MyID concluído de cada paciente (para driver)
      const { data: avals } = await supabase
        .from("myid_avaliacoes")
        .select("paciente_id, resultado_processado, created_at")
        .eq("terapeuta_id", cfg.terapeuta_id)
        .eq("status", "concluida")
        .in("paciente_id", pacientes.map(p => p.id))
        .order("created_at", { ascending: false });

      const driverByPaciente = new Map<string, string>();
      for (const a of avals || []) {
        if (driverByPaciente.has(a.paciente_id)) continue;
        const driver = (a.resultado_processado as any)?.myid_100?.driver_primario?.dimensao;
        if (driver) driverByPaciente.set(a.paciente_id, driver);
      }

      // 5. Para cada regra, achar pacientes elegíveis
      for (const regra of regrasDevidas) {
        const pacientesElegiveis = pacientes.filter(p => {
          const drv = driverByPaciente.get(p.id);
          return regra.driver === "ANY" || drv === regra.driver;
        });

        if (!pacientesElegiveis.length) continue;

        // 6. Dedupe: não reenviar mesma regra ao mesmo paciente nas últimas N horas
        const dedupeWindow = (regra.intervalo_repeticao_horas || 6) * 3600 * 1000;
        const since = new Date(Date.now() - dedupeWindow).toISOString();
        const { data: recentes } = await supabase
          .from("notificacao_envios")
          .select("paciente_id")
          .eq("regra_id", regra.id)
          .gte("enviado_em", since);
        const recentesSet = new Set((recentes || []).map(r => r.paciente_id));

        const toSend = pacientesElegiveis.filter(p => !recentesSet.has(p.id));
        if (!toSend.length) continue;

        // 7. Enviar
        for (const pac of toSend) {
          const primeiroNome = (pac.nome || "").split(" ")[0] || "tudo bem";
          const mensagem = applyTemplate(regra.template_mensagem, { nome: primeiroNome });

          try {
            // 7a. Log + cria notificação in-app sempre (também para histórico do terapeuta)
            await supabase.from("notificacao_envios").insert({
              regra_id: regra.id,
              terapeuta_id: regra.terapeuta_id,
              paciente_id: pac.id,
              driver: regra.driver,
              canal: regra.canal,
              mensagem,
              status: "enviado",
            });

            // 7b. Cria notificação no hub do terapeuta (tipo: dica_inteligente)
            if (regra.canal === "in_app") {
              await supabase.from("notificacoes").insert({
                terapeuta_id: regra.terapeuta_id,
                tipo: "dica_inteligente",
                titulo: regra.titulo,
                descricao: `${primeiroNome}: ${mensagem}`,
                rota: `/paciente/${pac.id}`,
                metadata: { paciente_id: pac.id, driver: regra.driver, regra_id: regra.id },
              });
            }

            // 7c. WhatsApp (se canal e telefone)
            if (regra.canal === "whatsapp" && pac.telefone) {
              try {
                await fetch(
                  `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                    },
                    body: JSON.stringify({
                      telefone: pac.telefone,
                      mensagem,
                      terapeuta_id: regra.terapeuta_id,
                      paciente_id: pac.id,
                    }),
                  }
                );
              } catch (whErr) {
                console.warn("[notif] whatsapp falhou:", whErr);
              }
            }

            totalSent++;
          } catch (e) {
            errors.push(`pac=${pac.id} regra=${regra.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: totalSent, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notificacoes-inteligentes error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
