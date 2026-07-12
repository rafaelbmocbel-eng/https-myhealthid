-- Origem do lead (Instagram, Google, Facebook, TikTok…) capturada quando ele
-- chega por um link de captação com mensagem marcada. Preenchida pelo webhook
-- na primeira mensagem; exibida na aba Captação.
ALTER TABLE public.whatsapp_conversas
  ADD COLUMN IF NOT EXISTS origem text;
