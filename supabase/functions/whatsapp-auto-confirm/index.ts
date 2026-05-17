// Lembretes automáticos de agenda via WhatsApp (cron a cada 10min).
// 3 janelas: 24h antes (confirmação) | 2h antes (lembrete) | 1h depois (pós-sessão).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function enviarWhatsapp(supa: any, terapeuta_id: string, phone: string, message: string) {
  const { data: cfg } = await supa
    .from("config_clinica")
    .select("zapi_instance_id, zapi_token, zapi_client_token")
    .eq("terapeuta_id", terapeuta_id)
    .maybeSingle();
  if (!cfg?.zapi_instance_id || !cfg?.zapi_token) return false;
  const baseUrl = `https://api.z-api.io/instances/${cfg.zapi_instance_id}/token/${cfg.zapi_token}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.zapi_client_token) headers["Client-Token"] = cfg.zapi_client_token;
  const r = await fetch(`${baseUrl}/send-text`, {
    method: "POST",
    headers,
    body: JSON.stringify({ phone: phone.replace(/\D/g, ""), message }),
  });
  return r.ok;
}

function aplicar(template: string, nome: string, hora: string, data: string) {
  return (template || "")
    .replaceAll("{nome}", nome)
    .replaceAll("{horario}", hora)
    .replaceAll("{data}", data);
}

async function registrarEnvio(admin: any, terapeuta_id: string, paciente_id: string | null, telefone: string, mensagem: string) {
  // Tenta linkar com conversa existente para aparecer no histórico
  const tail = telefone.replace(/\D/g, "");
  const { data: conv } = await admin.from("whatsapp_conversas")
    .select("id").eq("terapeuta_id", terapeuta_id).eq("telefone", tail).maybeSingle();
  if (!conv) return;
  await admin.from("whatsapp_mensagens_inbox").insert({
    conversa_id: conv.id, terapeuta_id, direcao: "saida", tipo: "texto",
    conteudo: mensagem, status: "enviada",
    metadata: { origem: "auto_reminder" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = Date.now();
    let enviados24 = 0, enviados2h = 0, enviadosPos = 0, noShows = 0;

    // Cache de configurações por terapeuta
    const cfgCache = new Map<string, any>();
    async function getCfg(tid: string) {
      if (cfgCache.has(tid)) return cfgCache.get(tid);
      const { data } = await admin.from("whatsapp_automacoes")
        .select("auto_confirmacao_24h, mensagem_confirmacao, mensagem_lembrete_2h, mensagem_pos_sessao, mensagem_no_show, gatilhos_ativos, no_show_perdoar_primeira, no_show_so_com_pacote")
        .eq("terapeuta_id", tid).maybeSingle();
      cfgCache.set(tid, data);
      return data;
    }

    async function processarPaciente(ag: any) {
      const { data: pac } = await admin
        .from("pacientes")
        .select("nome, telefone")
        .eq("id", ag.paciente_id).maybeSingle();
      if (!pac?.telefone) return null;
      const dt = new Date(ag.data_inicio);
      return {
        pac,
        nome: pac.nome?.split(" ")[0] || "",
        hora: dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
        data: dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }),
      };
    }

    // ── JANELA 1: 24h ± 30min — confirmação
    {
      const start = new Date(now + 23.5 * 3600000).toISOString();
      const end   = new Date(now + 24.5 * 3600000).toISOString();
      const { data: ags } = await admin.from("agendamentos")
        .select("id, terapeuta_id, paciente_id, data_inicio, confirmacao_enviada_em, status")
        .gte("data_inicio", start).lte("data_inicio", end)
        .in("status", ["confirmado", "agendado", "confirmacao_pendente"])
        .is("confirmacao_enviada_em", null);
      for (const ag of ags || []) {
        const cfg = await getCfg(ag.terapeuta_id);
        if (!cfg?.auto_confirmacao_24h && !(cfg?.gatilhos_ativos?.confirmacao_24h)) continue;
        const info = await processarPaciente(ag);
        if (!info) continue;
        const msg = aplicar(cfg.mensagem_confirmacao || "Olá {nome}! Confirmando sua sessão amanhã às {horario}. Responda SIM para confirmar ou diga se prefere reagendar.", info.nome, info.hora, info.data);
        const ok = await enviarWhatsapp(admin, ag.terapeuta_id, info.pac.telefone, msg);
        if (ok) {
          await admin.from("agendamentos").update({
            confirmacao_enviada_em: new Date().toISOString(),
            status: ag.status === "agendado" ? "confirmacao_pendente" : ag.status,
          }).eq("id", ag.id);
          await registrarEnvio(admin, ag.terapeuta_id, ag.paciente_id, info.pac.telefone, msg);
          enviados24++;
        }
      }
    }

    // ── JANELA 2: 2h ± 30min — lembrete final
    {
      const start = new Date(now + 1.5 * 3600000).toISOString();
      const end   = new Date(now + 2.5 * 3600000).toISOString();
      const { data: ags } = await admin.from("agendamentos")
        .select("id, terapeuta_id, paciente_id, data_inicio, lembrete_2h_enviado_em, status")
        .gte("data_inicio", start).lte("data_inicio", end)
        .in("status", ["confirmado", "agendado", "confirmacao_pendente"])
        .is("lembrete_2h_enviado_em", null);
      for (const ag of ags || []) {
        const cfg = await getCfg(ag.terapeuta_id);
        if (!(cfg?.gatilhos_ativos?.lembrete_2h)) continue;
        const info = await processarPaciente(ag);
        if (!info) continue;
        const msg = aplicar(cfg.mensagem_lembrete_2h || "Oi {nome}! Lembrete: sua sessão é hoje às {horario}. Te espero!", info.nome, info.hora, info.data);
        const ok = await enviarWhatsapp(admin, ag.terapeuta_id, info.pac.telefone, msg);
        if (ok) {
          await admin.from("agendamentos").update({ lembrete_2h_enviado_em: new Date().toISOString() }).eq("id", ag.id);
          await registrarEnvio(admin, ag.terapeuta_id, ag.paciente_id, info.pac.telefone, msg);
          enviados2h++;
        }
      }
    }

    // ── JANELA 3: 1h depois — pós-sessão
    {
      const start = new Date(now - 2 * 3600000).toISOString();
      const end   = new Date(now - 1 * 3600000).toISOString();
      const { data: ags } = await admin.from("agendamentos")
        .select("id, terapeuta_id, paciente_id, data_fim, pos_sessao_enviado_em, status")
        .gte("data_fim", start).lte("data_fim", end)
        .in("status", ["confirmado", "concluido", "realizado"])
        .is("pos_sessao_enviado_em", null);
      for (const ag of ags || []) {
        const cfg = await getCfg(ag.terapeuta_id);
        if (!(cfg?.gatilhos_ativos?.pos_sessao)) continue;
        const info = await processarPaciente({ ...ag, data_inicio: ag.data_fim });
        if (!info) continue;
        const msg = aplicar(cfg.mensagem_pos_sessao || "Oi {nome}! Como você está se sentindo após nossa sessão?", info.nome, info.hora, info.data);
        const ok = await enviarWhatsapp(admin, ag.terapeuta_id, info.pac.telefone, msg);
        if (ok) {
          await admin.from("agendamentos").update({ pos_sessao_enviado_em: new Date().toISOString() }).eq("id", ag.id);
          await registrarEnvio(admin, ag.terapeuta_id, ag.paciente_id, info.pac.telefone, msg);
          enviadosPos++;
        }
      }
    }

    // ── JANELA 4: T+10min a T+30min — no-show automático
    // Se o paciente não confirmou nem cancelou, marca como 'falta',
    // incrementa o pacote (sessão contabilizada) e avisa pelo WhatsApp.
    {
      const start = new Date(now - 30 * 60000).toISOString();
      const end   = new Date(now - 10 * 60000).toISOString();
      const { data: ags } = await admin.from("agendamentos")
        .select("id, terapeuta_id, paciente_id, data_inicio, status, no_show_processado_em, confirmado_pelo_paciente_em")
        .gte("data_inicio", start).lte("data_inicio", end)
        .in("status", ["agendado", "confirmacao_pendente"])
        .is("no_show_processado_em", null)
        .is("confirmado_pelo_paciente_em", null);
      for (const ag of ags || []) {
        const cfg = await getCfg(ag.terapeuta_id);
        if (!(cfg?.gatilhos_ativos?.no_show_automatico)) continue;
        const info = await processarPaciente(ag);
        if (!info) continue;

        // Exceção 1: só com pacote ativo
        const { data: pac } = await admin.from("pacotes_sessoes")
          .select("id, sessoes_utilizadas, total_sessoes")
          .eq("paciente_id", ag.paciente_id)
          .eq("terapeuta_id", ag.terapeuta_id)
          .eq("status", "ativo")
          .order("created_at", { ascending: true })
          .limit(1).maybeSingle();
        if (cfg.no_show_so_com_pacote && !pac) continue;

        // Exceção 2: perdoar primeira falta do paciente
        let perdoada = false;
        if (cfg.no_show_perdoar_primeira) {
          const { count } = await admin.from("agendamentos")
            .select("id", { count: "exact", head: true })
            .eq("paciente_id", ag.paciente_id)
            .eq("terapeuta_id", ag.terapeuta_id)
            .eq("status", "falta")
            .not("no_show_processado_em", "is", null);
          if ((count || 0) === 0) perdoada = true;
        }

        const obsTxt = perdoada
          ? "No-show automático: primeira falta — perdoada (não contabilizada)."
          : "No-show automático: paciente não confirmou nem cancelou em até 2h.";

        await admin.from("agendamentos").update({
          status: "falta",
          no_show_processado_em: new Date().toISOString(),
          observacoes: obsTxt,
        }).eq("id", ag.id);

        if (!perdoada && pac && pac.sessoes_utilizadas < pac.total_sessoes) {
          await admin.from("pacotes_sessoes").update({
            sessoes_utilizadas: pac.sessoes_utilizadas + 1,
            updated_at: new Date().toISOString(),
          }).eq("id", pac.id);
        }

        const msgBase = perdoada
          ? "Oi {nome}, notamos que você não compareceu à sessão de hoje às {horario}. Como é sua primeira ausência, não vamos contabilizar — mas combinamos avisar com pelo menos 2h de antecedência, ok? 💙"
          : (cfg.mensagem_no_show || "Oi {nome}, notamos que você não compareceu nem avisou sobre a sessão de hoje às {horario}. Conforme combinado, sessões não canceladas com 2h de antecedência são contabilizadas. Se houve algum imprevisto, fale com a gente. 💙");
        const msg = aplicar(msgBase, info.nome, info.hora, info.data);
        const ok = await enviarWhatsapp(admin, ag.terapeuta_id, info.pac.telefone, msg);
        if (ok) {
          await registrarEnvio(admin, ag.terapeuta_id, ag.paciente_id, info.pac.telefone, msg);
        }

        await admin.from("notificacoes").insert({
          terapeuta_id: ag.terapeuta_id,
          tipo: "no_show_automatico",
          titulo: perdoada ? "🟡 Falta perdoada (primeira)" : "⚠️ Falta registrada automaticamente",
          descricao: `${info.pac.nome || "Paciente"} não compareceu à sessão de ${info.data} ${info.hora}. ${perdoada ? "Não contabilizada (primeira falta)." : "Sessão contabilizada."}`,
          rota: `/agenda`,
          metadata: { agendamento_id: ag.id, paciente_id: ag.paciente_id, perdoada },
        });
        noShows++;
      }
    }

    return new Response(JSON.stringify({ ok: true, enviados24, enviados2h, enviadosPos, noShows }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[auto-confirm] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
