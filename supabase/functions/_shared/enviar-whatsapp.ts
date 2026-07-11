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
}

const COLS =
  "whatsapp_provider, zapi_instance_id, zapi_token, zapi_client_token, evolution_base_url, evolution_instance, evolution_api_key";

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

// Envia texto simples. Retorna true se o provedor aceitou o envio.
export async function enviarWhatsapp(
  admin: AdminClient,
  terapeuta_id: string,
  phone: string,
  message: string,
): Promise<boolean> {
  const cfg = await getConfig(admin, terapeuta_id);
  if (!cfg) return false;
  const num = String(phone || "").replace(/\D/g, "");
  if (!num || !message) return false;

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
  opts: { mediaUrl: string; mediaType: "image" | "document"; caption?: string; fileName?: string },
): Promise<boolean> {
  const cfg = await getConfig(admin, terapeuta_id);
  if (!cfg) return false;
  const num = String(phone || "").replace(/\D/g, "");
  if (!num || !opts.mediaUrl) return false;

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
