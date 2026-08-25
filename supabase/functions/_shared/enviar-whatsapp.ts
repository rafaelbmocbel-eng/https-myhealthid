// Envio de WhatsApp com motor configurável por clínica: Z-API (padrão) ou
// Evolution API. Lê o provedor e as credenciais de config_clinica e despacha
// para a API certa. Para 'zapi' o comportamento é idêntico ao anterior — então
// clínicas existentes não mudam nada; Evolution é opt-in.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type AdminClient = ReturnType<typeof createClient>;

interface WaConfig {
  whatsapp_provider?: string | null;
  zapi_instance_id?: string | null;
  zapi_token?: string | null;
  zapi_client_token?: string | null;
  evolution_base_url?: string | null;
  evolution_instance?: string | null;
  evolution_api_key?: string | null;
  meta_phone_number_id?: string | null;
  meta_access_token?: string | null;
  meta_api_version?: string | null;
}

const COLS =
  "whatsapp_provider, zapi_instance_id, zapi_token, zapi_client_token, evolution_base_url, evolution_instance, evolution_api_key, meta_phone_number_id, meta_access_token, meta_api_version";

/** Template para envio Meta FORA da janela de 24h (mensagem iniciada pela clínica). */
export interface WaTemplate {
  name: string;
  language?: string; // ex.: 'pt_BR'
  components?: unknown[]; // variáveis do template, quando houver
}

async function getConfig(admin: AdminClient, terapeuta_id: string): Promise<WaConfig | null> {
  const { data } = await admin
    .from("config_clinica")
    .select(COLS)
    .eq("terapeuta_id", terapeuta_id)
    .maybeSingle();
  return (data as WaConfig | null) ?? null;
}

function isEvolution(cfg: WaConfig): boolean {
  return (cfg.whatsapp_provider || "zapi").toLowerCase() === "evolution";
}
function isMeta(cfg: WaConfig): boolean {
  return (cfg.whatsapp_provider || "zapi").toLowerCase() === "meta";
}

// Janela de atendimento de 24h da Meta: mensagem de TEXTO LIVRE só pode ser
// enviada se o contato mandou algo nas últimas 24h. Fora disso, só template
// aprovado. Aqui checamos se há mensagem de ENTRADA recente para este número.
async function dentroJanela24h(admin: AdminClient, terapeuta_id: string, num: string): Promise<boolean> {
  try {
    const tail = num.slice(-10);
    const { data: conv } = await admin
      .from("whatsapp_conversas").select("id")
      .eq("terapeuta_id", terapeuta_id).ilike("telefone", `%${tail}`)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!conv) return false;
    const desde = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: msg } = await admin
      .from("whatsapp_mensagens_inbox").select("id")
      .eq("conversa_id", (conv as { id: string }).id).eq("direcao", "entrada")
      .gte("created_at", desde).limit(1).maybeSingle();
    return !!msg;
  } catch {
    return false;
  }
}

// Envio de texto pela Meta (WhatsApp Cloud API). Dentro das 24h manda texto
// livre; fora, manda o template (se fornecido); sem template fora da janela,
// não envia (retorna false) — a automação fica em espera até você criar o template.
async function enviarMeta(
  admin: AdminClient,
  cfg: WaConfig,
  terapeuta_id: string,
  num: string,
  message: string,
  template?: WaTemplate,
): Promise<boolean> {
  if (!cfg.meta_phone_number_id || !cfg.meta_access_token) return false;
  const ver = cfg.meta_api_version || "v21.0";
  const url = `https://graph.facebook.com/${ver}/${cfg.meta_phone_number_id}/messages`;
  const headers = { Authorization: `Bearer ${cfg.meta_access_token}`, "Content-Type": "application/json" };
  const dentro = await dentroJanela24h(admin, terapeuta_id, num);

  let payload: Record<string, unknown>;
  if (dentro) {
    payload = { messaging_product: "whatsapp", to: num, type: "text", text: { body: message, preview_url: true } };
  } else if (template) {
    payload = {
      messaging_product: "whatsapp", to: num, type: "template",
      template: { name: template.name, language: { code: template.language || "pt_BR" }, components: template.components || [] },
    };
  } else {
    console.warn(`[wa-meta] fora da janela de 24h e sem template — não enviado (terapeuta ${terapeuta_id})`);
    return false;
  }
  try {
    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
    if (!r.ok) console.warn(`[wa-meta] envio falhou ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.ok;
  } catch (e) {
    console.warn("[wa-meta] erro de rede:", e);
    return false;
  }
}

// Interruptor geral (modo férias): quando a clínica pausa as automações,
// NENHUMA mensagem automática sai — o bloqueio fica aqui, no ponto único de
// envio, então qualquer motor novo já nasce respeitando a pausa. Envios que o
// profissional faz de propósito (inbox, campanhas) passam { manual: true }.
async function automacoesPausadas(admin: AdminClient, terapeuta_id: string): Promise<boolean> {
  const { data } = await admin
    .from("whatsapp_automacoes")
    .select("automacoes_pausadas")
    .eq("terapeuta_id", terapeuta_id)
    .maybeSingle();
  return (data as { automacoes_pausadas?: boolean } | null)?.automacoes_pausadas === true;
}

// Envia texto simples. Retorna true se o provedor aceitou o envio.
export async function enviarWhatsapp(
  admin: AdminClient,
  terapeuta_id: string,
  phone: string,
  message: string,
  opts?: { manual?: boolean; template?: WaTemplate },
): Promise<boolean> {
  if (!opts?.manual && await automacoesPausadas(admin, terapeuta_id)) return false;
  const cfg = await getConfig(admin, terapeuta_id);
  if (!cfg) return false;
  const num = String(phone || "").replace(/\D/g, "");
  if (!num || !message) return false;

  if (isMeta(cfg)) {
    return await enviarMeta(admin, cfg, terapeuta_id, num, message, opts?.template);
  }

  if (isEvolution(cfg)) {
    if (!cfg.evolution_base_url || !cfg.evolution_instance || !cfg.evolution_api_key) return false;
    const base = cfg.evolution_base_url.replace(/\/+$/, "");
    try {
      const r = await fetch(`${base}/message/sendText/${cfg.evolution_instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.evolution_api_key },
        body: JSON.stringify({ number: num, text: message }),
      });
      return r.ok;
    } catch {
      return false;
    }
  }

  // Padrão: Z-API (comportamento idêntico ao anterior)
  if (!cfg.zapi_instance_id || !cfg.zapi_token) return false;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.zapi_client_token) headers["Client-Token"] = cfg.zapi_client_token;
  try {
    const r = await fetch(
      `https://api.z-api.io/instances/${cfg.zapi_instance_id}/token/${cfg.zapi_token}/send-text`,
      { method: "POST", headers, body: JSON.stringify({ phone: num, message }) },
    );
    return r.ok;
  } catch {
    return false;
  }
}

// Envia mídia (imagem ou documento) com legenda opcional. Usado pela inbox.
export async function enviarWhatsappMidia(
  admin: AdminClient,
  terapeuta_id: string,
  phone: string,
  opts: { mediaUrl: string; mediaType: "image" | "document"; caption?: string; fileName?: string; manual?: boolean },
): Promise<boolean> {
  if (!opts.manual && await automacoesPausadas(admin, terapeuta_id)) return false;
  const cfg = await getConfig(admin, terapeuta_id);
  if (!cfg) return false;
  const num = String(phone || "").replace(/\D/g, "");
  if (!num || !opts.mediaUrl) return false;

  if (isMeta(cfg)) {
    if (!cfg.meta_phone_number_id || !cfg.meta_access_token) return false;
    // Mídia por link só sai DENTRO da janela de 24h; fora disso exigiria template
    // de mídia aprovado (fica pra fase de templates).
    if (!(await dentroJanela24h(admin, terapeuta_id, num))) {
      console.warn("[wa-meta] mídia fora da janela de 24h — não enviada");
      return false;
    }
    const ver = cfg.meta_api_version || "v21.0";
    const url = `https://graph.facebook.com/${ver}/${cfg.meta_phone_number_id}/messages`;
    const headers = { Authorization: `Bearer ${cfg.meta_access_token}`, "Content-Type": "application/json" };
    const isImg = opts.mediaType === "image";
    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp", to: num, type: isImg ? "image" : "document",
      [isImg ? "image" : "document"]: isImg
        ? { link: opts.mediaUrl, caption: opts.caption || undefined }
        : { link: opts.mediaUrl, caption: opts.caption || undefined, filename: opts.fileName || "documento.pdf" },
    };
    try {
      const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
      if (!r.ok) console.warn(`[wa-meta] mídia falhou ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return r.ok;
    } catch (e) {
      console.warn("[wa-meta] mídia erro de rede:", e);
      return false;
    }
  }

  if (isEvolution(cfg)) {
    if (!cfg.evolution_base_url || !cfg.evolution_instance || !cfg.evolution_api_key) return false;
    const base = cfg.evolution_base_url.replace(/\/+$/, "");
    const body: Record<string, unknown> = {
      number: num,
      mediatype: opts.mediaType,
      media: opts.mediaUrl,
      caption: opts.caption || "",
    };
    if (opts.mediaType === "document") body.fileName = opts.fileName || "documento.pdf";
    try {
      const r = await fetch(`${base}/message/sendMedia/${cfg.evolution_instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.evolution_api_key },
        body: JSON.stringify(body),
      });
      return r.ok;
    } catch {
      return false;
    }
  }

  // Padrão: Z-API
  if (!cfg.zapi_instance_id || !cfg.zapi_token) return false;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.zapi_client_token) headers["Client-Token"] = cfg.zapi_client_token;
  const baseUrl = `https://api.z-api.io/instances/${cfg.zapi_instance_id}/token/${cfg.zapi_token}`;
  const endpoint = opts.mediaType === "image" ? "send-image" : "send-document/pdf";
  const payload = opts.mediaType === "image"
    ? { phone: num, image: opts.mediaUrl, caption: opts.caption || "" }
    : { phone: num, document: opts.mediaUrl, fileName: opts.fileName || "documento.pdf", caption: opts.caption || "" };
  try {
    const r = await fetch(`${baseUrl}/${endpoint}`, {
      method: "POST", headers, body: JSON.stringify(payload),
    });
    return r.ok;
  } catch {
    return false;
  }
}
