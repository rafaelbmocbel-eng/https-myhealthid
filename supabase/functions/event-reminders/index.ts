import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIA_LABEL: Record<string, string> = {
  aula: "Aula", workshop: "Workshop", live: "Live",
  triagem: "Triagem", desafio: "Desafio", sazonal: "Evento sazonal", outro: "Evento",
};

function fmtData(dataISO: string, horario: string) {
  const d = new Date(`${dataISO}T${horario}`);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

async function sendZapi(creds: any, telefone: string, mensagem: string) {
  if (!creds?.zapi_ativo || !creds.zapi_instance_id || !creds.zapi_token) return;
  const phone = telefone.replace(/\D/g, "");
  if (phone.length < 10) return;
  const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
  try {
    await fetch(`https://api.z-api.io/instances/${creds.zapi_instance_id}/token/${creds.zapi_token}/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(creds.zapi_client_token ? { "Client-Token": creds.zapi_client_token } : {}),
      },
      body: JSON.stringify({ phone: fullPhone, message: mensagem }),
    });
  } catch (e) {
    console.warn("zapi fail", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = new Date();

    // Janela 24h: eventos entre now+23h e now+25h, lembrete_24h_enviado=false
    // Janela 1h: eventos entre now+30min e now+1.5h, lembrete_1h_enviado=false
    const in23h = new Date(now.getTime() + 23 * 3600 * 1000);
    const in25h = new Date(now.getTime() + 25 * 3600 * 1000);
    const in30m = new Date(now.getTime() + 30 * 60 * 1000);
    const in90m = new Date(now.getTime() + 90 * 60 * 1000);

    // Pega TODOS eventos ativos futuros e filtra em JS (combina data+hora)
    const today = now.toISOString().split("T")[0];
    const { data: eventos } = await supabase
      .from("eventos")
      .select("id, terapeuta_id, titulo, data_evento, horario_inicio, local, link_video, categoria, lembrete_24h_enviado, lembrete_1h_enviado")
      .eq("ativo", true)
      .gte("data_evento", today);

    if (!eventos?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let processed = 0;
    for (const ev of eventos) {
      const inicio = new Date(`${ev.data_evento}T${ev.horario_inicio}-03:00`);
      const need24h = !ev.lembrete_24h_enviado && inicio >= in23h && inicio <= in25h;
      const need1h = !ev.lembrete_1h_enviado && inicio >= in30m && inicio <= in90m;
      if (!need24h && !need1h) continue;

      // Inscritos
      const { data: inscritos } = await supabase
        .from("evento_inscricoes")
        .select("id, nome, telefone, paciente_id")
        .eq("evento_id", ev.id)
        .neq("status", "cancelado");

      if (!inscritos?.length) {
        // Marca como enviado mesmo sem inscritos para não reprocessar
        const upd: any = {};
        if (need24h) upd.lembrete_24h_enviado = true;
        if (need1h) upd.lembrete_1h_enviado = true;
        await supabase.from("eventos").update(upd).eq("id", ev.id);
        continue;
      }

      // Credenciais Z-API do terapeuta
      const { data: cfg } = await supabase
        .from("config_clinica")
        .select("zapi_ativo, zapi_instance_id, zapi_token, zapi_client_token")
        .eq("terapeuta_id", ev.terapeuta_id)
        .maybeSingle();

      const catLabel = CATEGORIA_LABEL[ev.categoria || "outro"] || "Evento";
      const quando = fmtData(ev.data_evento, ev.horario_inicio);
      const localOuLink = ev.link_video ? `🔗 Link: ${ev.link_video}` : ev.local ? `📍 ${ev.local}` : "";

      for (const ins of inscritos) {
        // 1) Notificação no portal (paciente_id)
        if (ins.paciente_id) {
          await supabase.from("chat_mensagens").insert({
            terapeuta_id: ev.terapeuta_id,
            paciente_id: ins.paciente_id,
            remetente: "sistema",
            tipo: "lembrete_evento",
            mensagem: need24h
              ? `⏰ Lembrete: amanhã tem *${ev.titulo}* (${catLabel}) às ${ev.horario_inicio.slice(0, 5)}.${localOuLink ? "\n" + localOuLink : ""}`
              : `🔔 Começa em ~1h: *${ev.titulo}* às ${ev.horario_inicio.slice(0, 5)}.${localOuLink ? "\n" + localOuLink : ""}`,
          });
        }

        // 2) WhatsApp
        if (ins.telefone && cfg?.zapi_ativo) {
          const msg = need24h
            ? `Olá ${ins.nome.split(" ")[0]}! 👋\n\nLembrete: amanhã (${quando}) tem *${ev.titulo}* (${catLabel}).\n${localOuLink}\n\nNos vemos lá! 💪`
            : `Olá ${ins.nome.split(" ")[0]}! ⏰\n\n*${ev.titulo}* começa em ~1h (${ev.horario_inicio.slice(0, 5)}).\n${localOuLink}`;
          await sendZapi(cfg, ins.telefone, msg);
        }
      }

      // Notificação no painel do terapeuta
      await supabase.from("notificacoes").insert({
        terapeuta_id: ev.terapeuta_id,
        tipo: "lembrete_evento",
        titulo: need24h ? `📅 Evento amanhã: ${ev.titulo}` : `⏰ Evento em 1h: ${ev.titulo}`,
        descricao: `${inscritos.length} inscrito${inscritos.length > 1 ? "s" : ""} notificado${inscritos.length > 1 ? "s" : ""}.`,
        rota: "/eventos",
      });

      const upd: any = {};
      if (need24h) upd.lembrete_24h_enviado = true;
      if (need1h) upd.lembrete_1h_enviado = true;
      await supabase.from("eventos").update(upd).eq("id", ev.id);
      processed++;
    }

    return new Response(JSON.stringify({ ok: true, processed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("event-reminders error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
