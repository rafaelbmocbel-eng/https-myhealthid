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

// Detecta a origem do lead pela 1ª mensagem, marcada pelos links de captação
// (ex.: "... vim pelo Instagram"). Retorna null se não reconhecer.
function detectarOrigem(txt: string | null): string | null {
  const t = (txt || "").toLowerCase();
  if (/\binstagram\b|\binsta\b|\big\b/.test(t)) return "Instagram";
  if (/\bgoogle\b/.test(t)) return "Google";
  if (/\bfacebook\b|\bface\b|\bfb\b/.test(t)) return "Facebook";
  if (/\btiktok\b|\btik tok\b/.test(t)) return "TikTok";
  if (/\bsite\b|\bwebsite\b/.test(t)) return "Site";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Verificação do webhook da Meta (WhatsApp Cloud API): a Meta faz um GET com
  // hub.mode/hub.verify_token/hub.challenge e espera o challenge de volta em
  // texto puro. O verify_token é definido pelo dono da plataforma no secret
  // WHATSAPP_META_VERIFY_TOKEN e digitado igual no painel da Meta.
  if (req.method === "GET") {
    const u = new URL(req.url);
    const mode = u.searchParams.get("hub.mode");
    const tokenQ = u.searchParams.get("hub.verify_token");
    const challenge = u.searchParams.get("hub.challenge");
    const expected = Deno.env.get("WHATSAPP_META_VERIFY_TOKEN");
    if (mode === "subscribe" && expected && tokenQ === expected) {
      return new Response(challenge ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("forbidden", { status: 403 });
  }

  // Segredo do webhook. Só é EXIGIDO se WHATSAPP_WEBHOOK_SECRET estiver
  // configurado no projeto — e nesse caso o zapi-conectar aponta a URL com
  // ?secret=... Se o segredo NÃO estiver configurado, o zapi-conectar aponta a
  // URL sem secret; então aqui também não exigimos (senão o recebimento ficaria
  // 100% quebrado quando o dono da plataforma não criou o segredo).
  const expectedSecret = Deno.env.get("WHATSAPP_WEBHOOK_SECRET");
  if (expectedSecret) {
    const provided = new URL(req.url).searchParams.get("secret") || req.headers.get("x-webhook-secret");
    if (provided !== expectedSecret) {
      console.warn("[whatsapp-webhook] unauthorized: secret mismatch");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const rawBody = await req.json();
    console.log("[whatsapp-webhook] payload:", JSON.stringify(rawBody).slice(0, 500));

    // Meta (WhatsApp Cloud API) tem formato próprio. Normaliza para o mesmo shape
    // "estilo Z-API" que o resto da função já entende, e guarda o phone_number_id
    // para rotear o terapeuta. Se não for Meta, segue com o corpo original.
    let body: any = rawBody;
    let metaPhoneNumberId: string | null = null;
    if (rawBody?.object === "whatsapp_business_account") {
      const value = rawBody.entry?.[0]?.changes?.[0]?.value;
      metaPhoneNumberId = value?.metadata?.phone_number_id || null;
      const m = value?.messages?.[0];
      if (!m) {
        // Sem mensagem (status de entrega/leitura, etc.) — ignora.
        return new Response(JSON.stringify({ ok: true, ignored: "meta-sem-mensagem" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const contatoNome = value?.contacts?.[0]?.profile?.name || null;
      body = { phone: m.from, fromMe: false, messageId: m.id, senderName: contatoNome, isGroup: false };
      // Mídia na Cloud API vem como ID (precisa ser resolvida via Graph API com o
      // token); nesta fase capturamos texto por completo e guardamos o media id.
      if (m.type === "text") body.text = { message: m.text?.body };
      else if (m.type === "image") body.image = { imageUrl: null, caption: m.image?.caption || null, mediaId: m.image?.id };
      else if (m.type === "audio") body.audio = { audioUrl: null, mediaId: m.audio?.id };
      else if (m.type === "video") body.video = { videoUrl: null, caption: m.video?.caption || null, mediaId: m.video?.id };
      else if (m.type === "document") body.document = { documentUrl: null, fileName: m.document?.filename || null, mediaId: m.document?.id };
      else if (m.type === "button") body.text = { message: m.button?.text || "" };
      else if (m.type === "interactive") body.text = { message: m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || "" };
    }

    // Z-API envia eventos diversos; aceitamos os de mensagem (text, image, audio, etc.)
    // Estrutura típica: { phone, fromMe, messageId, text:{message}, image:{caption,imageUrl}, audio:{audioUrl}, ... }
    const phone = cleanPhone(body.phone || body.from || "");
    const fromMe = body.fromMe === true;
    const messageId = body.messageId || body.id || null;

    // Ignora mensagens de GRUPOS do WhatsApp — não entram no Zap/Captação.
    const rawId = String(body.phone || body.chatId || body.from || "");
    const ehGrupo = body.isGroup === true || body.isGroup === "true"
      || /@g\.us/i.test(rawId) || /-\d/.test(rawId) || phone.length > 14;
    if (ehGrupo) {
      return new Response(JSON.stringify({ ok: true, ignored: "grupo" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Identifica a instância pelo corpo OU pela query da URL (que nós carimbamos
    // ao registrar o webhook) — assim a identificação não depende de a Z-API
    // incluir o campo no payload.
    const urlInstance = new URL(req.url).searchParams.get("instanceId") || new URL(req.url).searchParams.get("instance");
    const instanceId = body.instanceId || body.instance || urlInstance || null;
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

    // Descobre o terapeuta dono EXCLUSIVAMENTE pela instância Z-API.
    // Multi-tenant: NUNCA usar fallback para "a primeira clínica ativa" — isso
    // entregaria a mensagem de um paciente para a clínica errada. Sem instância
    // reconhecida, a mensagem é registrada como não-roteada e descartada.
    let terapeuta_id: string | null = null;
    if (metaPhoneNumberId) {
      // Meta: roteia pelo Phone Number ID da Cloud API (uma clínica por número).
      const { data } = await admin
        .from("config_clinica")
        .select("terapeuta_id")
        .eq("meta_phone_number_id", metaPhoneNumberId)
        .maybeSingle();
      terapeuta_id = data?.terapeuta_id ?? null;
    } else if (instanceId) {
      const { data } = await admin
        .from("config_clinica")
        .select("terapeuta_id")
        .eq("zapi_instance_id", instanceId)
        .maybeSingle();
      terapeuta_id = data?.terapeuta_id ?? null;
    }
    if (!terapeuta_id) {
      console.warn("[whatsapp-webhook] origem não reconhecida (não-roteada):", metaPhoneNumberId || instanceId);
      return new Response(
        JSON.stringify({ ok: true, ignored: "origem-nao-reconhecida", metaPhoneNumberId, instanceId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Tenta vincular paciente pela TERMINAÇÃO do telefone (só dígitos), via RPC
    // — o cadastro guarda o telefone com máscara "(91) 98765-4321", então casar
    // por texto não funcionava e a resposta caía sem paciente_id.
    let paciente_id: string | null = null;
    const tail = phone.slice(-10);
    const { data: pacRows } = await admin.rpc("paciente_por_telefone_norm", {
      p_terapeuta: terapeuta_id,
      p_telefone: phone,
    });
    const pac = (Array.isArray(pacRows) ? pacRows[0] : pacRows) as
      { id: string; nome?: string | null; sobrenome?: string | null } | null;
    if (pac) paciente_id = pac.id;

    // Upsert conversa. Para paciente CADASTRADO, casa pelo paciente_id (uma
    // conversa por paciente, à prova de qualquer diferença de formato de
    // telefone — 55, 9º dígito, etc.). Só para não-cadastrado cai no telefone.
    const nome_contato = senderName || (pac ? `${pac.nome ?? ""} ${pac.sobrenome ?? ""}`.trim() : null);
    let conversaId: string;
    let existing: { id: string } | null = null;
    if (paciente_id) {
      const { data } = await admin
        .from("whatsapp_conversas").select("id")
        .eq("terapeuta_id", terapeuta_id).eq("paciente_id", paciente_id)
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      existing = data;
    }
    if (!existing) {
      const { data } = await admin
        .from("whatsapp_conversas").select("id")
        .eq("terapeuta_id", terapeuta_id).ilike("telefone", `%${tail}`)
        .order("created_at", { ascending: true }).limit(1).maybeSingle();
      existing = data;
    }

    if (existing) {
      conversaId = existing.id;
      await admin.from("whatsapp_conversas").update({
        paciente_id: paciente_id ?? undefined,
        nome_contato: nome_contato ?? undefined,
      }).eq("id", conversaId);
    } else {
      // Detecta a origem do lead pela 1ª mensagem (links de captação marcados)
      const origem = !fromMe ? detectarOrigem(conteudo) : null;
      const { data: created, error: cErr } = await admin
        .from("whatsapp_conversas")
        .insert({ terapeuta_id, telefone: phone, paciente_id, nome_contato, origem })
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

    // Lookup do id da mensagem recém-inserida (para transcrição e bot)
    let novaMsgId: string | null = null;
    try {
      if (messageId) {
        const { data: novaMsg } = await admin
          .from("whatsapp_mensagens_inbox")
          .select("id")
          .eq("conversa_id", conversaId)
          .eq("zapi_message_id", messageId)
          .maybeSingle();
        novaMsgId = novaMsg?.id ?? null;
      }
      // Fallback: pega a mais recente desta conversa/direção (cobre casos sem messageId)
      if (!novaMsgId) {
        const { data: novaMsg } = await admin
          .from("whatsapp_mensagens_inbox")
          .select("id")
          .eq("conversa_id", conversaId)
          .eq("direcao", fromMe ? "saida" : "entrada")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        novaMsgId = novaMsg?.id ?? null;
      }
    } catch (e) { console.warn("lookup nova msg falhou:", e); }

    // Captura de NPS: se o cliente respondeu só um número 0–10 e recebeu a
    // pergunta de NPS nos últimos 7 dias, guarda a nota (1 por pergunta).
    try {
      if (!fromMe && tipo === "texto" && paciente_id && conteudo && /^\s*(?:10|[0-9])\s*$/.test(conteudo)) {
        const seteDias = new Date(Date.now() - 7 * 86400000).toISOString();
        const { count: perguntou } = await admin.from("agente_disparos")
          .select("id", { count: "exact", head: true })
          .eq("paciente_id", paciente_id)
          .eq("gatilho", "nps_pos_sessao")
          .gte("created_at", seteDias);
        if ((perguntou || 0) > 0) {
          const { count: jaRespondeu } = await admin.from("nps_respostas")
            .select("id", { count: "exact", head: true })
            .eq("paciente_id", paciente_id)
            .gte("created_at", seteDias);
          if ((jaRespondeu || 0) === 0) {
            await admin.from("nps_respostas").insert({
              terapeuta_id, paciente_id, nota: parseInt(conteudo.trim(), 10),
            });
          }
        }
      }
    } catch (e) { console.warn("captura NPS falhou:", e); }

    const internalHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    };

    // Transcrição de áudio em background
    if (tipo === "audio" && !fromMe && midia_url && novaMsgId) {
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-transcribe`, {
        method: "POST",
        headers: internalHeaders,
        body: JSON.stringify({ mensagem_id: novaMsgId }),
      }).catch((e) => console.warn("transcribe trigger failed:", e));
    }

    // Bot de resposta + detecção de intenção (apenas msgs de entrada)
    if (!fromMe && novaMsgId) {
      fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-bot-reply`, {
        method: "POST",
        headers: internalHeaders,
        body: JSON.stringify({ conversa_id: conversaId, mensagem_id: novaMsgId }),
      }).catch((e) => console.warn("bot-reply trigger failed:", e));
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
