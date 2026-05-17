// Webhook receptor da Z-API — recebe mensagens entrantes/saintes e grava na inbox.
// Configure no painel Z-API: https://<project>.supabase.co/functions/v1/whatsapp-webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function cleanPhone(p: string) {
  return String(p || "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("[whatsapp-webhook] payload:", JSON.stringify(body).slice(0, 500));

    // Z-API envia eventos diversos; aceitamos os de mensagem (text, image, audio, etc.)
    // Estrutura típica: { phone, fromMe, messageId, text:{message}, image:{caption,imageUrl}, audio:{audioUrl}, ... }
    const phone = cleanPhone(body.phone || body.from || "");
    const fromMe = body.fromMe === true;
    const messageId = body.messageId || body.id || null;
    const instanceId = body.instanceId || body.instance || null;
    const senderName = body.senderName || body.chatName || body.notifyName || null;

    if (!phone) {
      return new Response(JSON.stringify({ ok: true, ignored: "no-phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determina tipo + conteúdo
    let tipo = "texto";
    let conteudo: string | null = null;
    let midia_url: string | null = null;
    if (body.text?.message) { tipo = "texto"; conteudo = body.text.message; }
    else if (body.image) { tipo = "imagem"; midia_url = body.image.imageUrl; conteudo = body.image.caption || null; }
    else if (body.audio) { tipo = "audio"; midia_url = body.audio.audioUrl; }
    else if (body.video) { tipo = "video"; midia_url = body.video.videoUrl; conteudo = body.video.caption || null; }
    else if (body.document) { tipo = "documento"; midia_url = body.document.documentUrl; conteudo = body.document.fileName || null; }
    else {
      // Eventos sem conteúdo de mensagem (status, presence, etc) — ignora
      return new Response(JSON.stringify({ ok: true, ignored: "no-message-body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Descobre o terapeuta dono pela instância Z-API
    let terapeuta_id: string | null = null;
    if (instanceId) {
      const { data } = await admin
        .from("config_clinica")
        .select("terapeuta_id")
        .eq("zapi_instance_id", instanceId)
        .maybeSingle();
      terapeuta_id = data?.terapeuta_id ?? null;
    }
    // Fallback: primeiro terapeuta com Z-API ativa
    if (!terapeuta_id) {
      const { data } = await admin
        .from("config_clinica")
        .select("terapeuta_id")
        .eq("zapi_ativo", true)
        .limit(1)
        .maybeSingle();
      terapeuta_id = data?.terapeuta_id ?? null;
    }
    if (!terapeuta_id) {
      return new Response(JSON.stringify({ ok: false, error: "no-terapeuta" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenta vincular paciente pelo telefone
    let paciente_id: string | null = null;
    const tail = phone.slice(-10);
    const { data: pac } = await admin
      .from("pacientes")
      .select("id, nome, sobrenome")
      .eq("terapeuta_id", terapeuta_id)
      .ilike("telefone", `%${tail}`)
      .limit(1)
      .maybeSingle();
    if (pac) paciente_id = pac.id;

    // Upsert conversa
    const nome_contato = senderName || (pac ? `${pac.nome ?? ""} ${pac.sobrenome ?? ""}`.trim() : null);
    let conversaId: string;
    const { data: existing } = await admin
      .from("whatsapp_conversas")
      .select("id")
      .eq("terapeuta_id", terapeuta_id)
      .eq("telefone", phone)
      .maybeSingle();

    if (existing) {
      conversaId = existing.id;
      await admin.from("whatsapp_conversas").update({
        paciente_id: paciente_id ?? undefined,
        nome_contato: nome_contato ?? undefined,
      }).eq("id", conversaId);
    } else {
      const { data: created, error: cErr } = await admin
        .from("whatsapp_conversas")
        .insert({ terapeuta_id, telefone: phone, paciente_id, nome_contato })
        .select("id").single();
      if (cErr) throw cErr;
      conversaId = created.id;
    }

    // Insere mensagem
    const { error: mErr } = await admin.from("whatsapp_mensagens_inbox").insert({
      conversa_id: conversaId,
      terapeuta_id,
      direcao: fromMe ? "saida" : "entrada",
      tipo,
      conteudo,
      midia_url,
      zapi_message_id: messageId,
      status: fromMe ? "enviada" : "recebida",
      metadata: { raw_event: body.type ?? null },
    });
    if (mErr) throw mErr;

    // Dispara transcrição em background se for áudio recebido
    if (tipo === "audio" && !fromMe && midia_url) {
      try {
        const { data: novaMsg } = await admin
          .from("whatsapp_mensagens_inbox")
          .select("id")
          .eq("conversa_id", conversaId)
          .eq("zapi_message_id", messageId)
          .maybeSingle();
        if (novaMsg?.id) {
          // não aguarda — fire and forget
          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-transcribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mensagem_id: novaMsg.id }),
          }).catch((e) => console.warn("transcribe trigger failed:", e));
        }
      } catch (e) { console.warn("transcribe trigger lookup failed:", e); }
    }

    return new Response(JSON.stringify({ ok: true, conversa_id: conversaId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[whatsapp-webhook] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
