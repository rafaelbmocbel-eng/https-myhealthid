-- Provedor Meta (WhatsApp Cloud API) como opção de motor do WhatsApp, ao lado
-- de Z-API e Evolution. Credenciais por clínica em config_clinica. O webhook
-- roteia o terapeuta pelo Phone Number ID (uma clínica por número).
ALTER TABLE public.config_clinica
  ADD COLUMN IF NOT EXISTS meta_phone_number_id text,
  ADD COLUMN IF NOT EXISTS meta_access_token text,
  ADD COLUMN IF NOT EXISTS meta_waba_id text,
  ADD COLUMN IF NOT EXISTS meta_api_version text DEFAULT 'v21.0';

-- Lookup do webhook: terapeuta pelo phone_number_id.
CREATE INDEX IF NOT EXISTS config_clinica_meta_phone_idx
  ON public.config_clinica (meta_phone_number_id)
  WHERE meta_phone_number_id IS NOT NULL;
