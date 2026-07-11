-- Motor de envio de WhatsApp configurável por clínica: Z-API (padrão) ou
-- Evolution API (self-host, mais barato na escala). Cada clínica escolhe o
-- provedor e informa as credenciais correspondentes. O padrão continua 'zapi',
-- então clínicas existentes não mudam nada.
ALTER TABLE public.config_clinica
  ADD COLUMN IF NOT EXISTS whatsapp_provider  text NOT NULL DEFAULT 'zapi',
  ADD COLUMN IF NOT EXISTS evolution_base_url text,
  ADD COLUMN IF NOT EXISTS evolution_instance text,
  ADD COLUMN IF NOT EXISTS evolution_api_key  text;
