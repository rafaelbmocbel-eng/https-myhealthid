-- WhatsApp oficial (Meta Cloud API): fora da janela de 24h só saem MODELOS
-- aprovados. Cada clínica informa o nome do modelo aprovado de cada automação.
-- Formato: { "confirmacao_24h": {"nome": "...", "idioma": "pt_BR"}, ... }
ALTER TABLE public.config_clinica ADD COLUMN IF NOT EXISTS meta_templates jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Mensagens personalizadas (IA) que não cabem num modelo: sai o modelo
-- "contato_generico" convidando a responder, e o texto original espera aqui —
-- é entregue assim que o paciente responder (janela de 24h aberta).
CREATE TABLE IF NOT EXISTS public.whatsapp_envios_pendentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  telefone text NOT NULL,
  conteudo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  enviado_em timestamptz
);
CREATE INDEX IF NOT EXISTS idx_wa_pendentes_abertos
  ON public.whatsapp_envios_pendentes (terapeuta_id, telefone) WHERE enviado_em IS NULL;
ALTER TABLE public.whatsapp_envios_pendentes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dono ve pendentes" ON public.whatsapp_envios_pendentes;
CREATE POLICY "dono ve pendentes" ON public.whatsapp_envios_pendentes
  FOR SELECT TO authenticated USING (terapeuta_id = auth.uid());
