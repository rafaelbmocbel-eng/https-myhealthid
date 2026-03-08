
-- Tabela para registrar todas as mensagens enviadas via WhatsApp
CREATE TABLE public.mensagens_whatsapp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  terapeuta_id UUID NOT NULL,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'manual',
  template_id TEXT,
  mensagem TEXT NOT NULL,
  canal TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'enviada',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.mensagens_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas veem suas mensagens"
  ON public.mensagens_whatsapp FOR SELECT
  TO authenticated
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas inserem mensagens"
  ON public.mensagens_whatsapp FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas deletam suas mensagens"
  ON public.mensagens_whatsapp FOR DELETE
  TO authenticated
  USING (auth.uid() = terapeuta_id);

-- Index para busca rápida por paciente
CREATE INDEX idx_mensagens_whatsapp_paciente ON public.mensagens_whatsapp(paciente_id, created_at DESC);
CREATE INDEX idx_mensagens_whatsapp_terapeuta ON public.mensagens_whatsapp(terapeuta_id, created_at DESC);
