-- Marca quando o link do portal foi enviado em massa pelo WhatsApp, para o
-- envio em lotes não repetir mensagem para quem já recebeu.
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS portal_link_enviado_em timestamptz;
