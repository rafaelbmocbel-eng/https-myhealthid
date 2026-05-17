
-- Configurações de automação por terapeuta
CREATE TABLE public.whatsapp_automacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL UNIQUE,
  bot_ativo boolean NOT NULL DEFAULT false,
  delay_resposta_segundos integer NOT NULL DEFAULT 30,
  horario_inicio time NOT NULL DEFAULT '08:00',
  horario_fim time NOT NULL DEFAULT '20:00',
  dias_semana jsonb NOT NULL DEFAULT '["seg","ter","qua","qui","sex"]'::jsonb,
  mensagem_saudacao text NOT NULL DEFAULT 'Olá! 👋 Sou o assistente virtual. Em instantes um profissional vai te responder. Como posso ajudar?',
  mensagem_fora_horario text NOT NULL DEFAULT 'Olá! Estamos fora do horário de atendimento. Retornaremos assim que possível 💙',
  auto_confirmacao_24h boolean NOT NULL DEFAULT true,
  mensagem_confirmacao text NOT NULL DEFAULT 'Olá {nome}! Confirmando sua sessão amanhã às {horario}. Responda "SIM" para confirmar ou "REAGENDAR".',
  detectar_intencao boolean NOT NULL DEFAULT true,
  pausar_bot_apos_humano boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_automacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terapeuta_select_automacoes" ON public.whatsapp_automacoes
  FOR SELECT USING (auth.uid() = terapeuta_id);
CREATE POLICY "terapeuta_insert_automacoes" ON public.whatsapp_automacoes
  FOR INSERT WITH CHECK (auth.uid() = terapeuta_id);
CREATE POLICY "terapeuta_update_automacoes" ON public.whatsapp_automacoes
  FOR UPDATE USING (auth.uid() = terapeuta_id);
CREATE POLICY "terapeuta_delete_automacoes" ON public.whatsapp_automacoes
  FOR DELETE USING (auth.uid() = terapeuta_id);

CREATE TRIGGER trg_automacoes_updated
  BEFORE UPDATE ON public.whatsapp_automacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Log de intenções detectadas pela IA
CREATE TABLE public.whatsapp_intencoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  conversa_id uuid NOT NULL REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  mensagem_id uuid REFERENCES public.whatsapp_mensagens_inbox(id) ON DELETE SET NULL,
  intencao text NOT NULL,
  confianca numeric NOT NULL DEFAULT 0,
  resumo text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_intencoes_conversa ON public.whatsapp_intencoes(conversa_id, created_at DESC);
CREATE INDEX idx_intencoes_terapeuta ON public.whatsapp_intencoes(terapeuta_id, created_at DESC);

ALTER TABLE public.whatsapp_intencoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terapeuta_select_intencoes" ON public.whatsapp_intencoes
  FOR SELECT USING (auth.uid() = terapeuta_id);
CREATE POLICY "terapeuta_insert_intencoes" ON public.whatsapp_intencoes
  FOR INSERT WITH CHECK (auth.uid() = terapeuta_id);
CREATE POLICY "terapeuta_delete_intencoes" ON public.whatsapp_intencoes
  FOR DELETE USING (auth.uid() = terapeuta_id);

-- Colunas extras na conversa
ALTER TABLE public.whatsapp_conversas
  ADD COLUMN IF NOT EXISTS bot_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS intencao_atual text,
  ADD COLUMN IF NOT EXISTS lead_score integer NOT NULL DEFAULT 0;
