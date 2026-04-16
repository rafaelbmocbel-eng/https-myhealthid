
CREATE TABLE public.chat_mensagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  terapeuta_id UUID NOT NULL,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  remetente TEXT NOT NULL DEFAULT 'terapeuta' CHECK (remetente IN ('terapeuta', 'paciente', 'sistema')),
  mensagem TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'manual' CHECK (tipo IN ('manual', 'lembrete_sessao', 'pos_atendimento', 'reengajamento', 'aniversario', 'boas_vindas')),
  lida BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_mensagens_terapeuta ON public.chat_mensagens(terapeuta_id);
CREATE INDEX idx_chat_mensagens_paciente ON public.chat_mensagens(paciente_id);
CREATE INDEX idx_chat_mensagens_created ON public.chat_mensagens(created_at DESC);

ALTER TABLE public.chat_mensagens ENABLE ROW LEVEL SECURITY;

-- Profissional lê mensagens dos seus pacientes
CREATE POLICY "Terapeutas leem suas mensagens de chat"
ON public.chat_mensagens FOR SELECT
TO authenticated
USING (auth.uid() = terapeuta_id);

-- Profissional cria mensagens
CREATE POLICY "Terapeutas criam mensagens de chat"
ON public.chat_mensagens FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = terapeuta_id AND remetente IN ('terapeuta', 'sistema'));

-- Profissional atualiza mensagens (marcar como lida)
CREATE POLICY "Terapeutas atualizam mensagens de chat"
ON public.chat_mensagens FOR UPDATE
TO authenticated
USING (auth.uid() = terapeuta_id);

-- Paciente lê suas mensagens
CREATE POLICY "Pacientes leem suas mensagens de chat"
ON public.chat_mensagens FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.pacientes p
  WHERE p.id = chat_mensagens.paciente_id AND p.user_id = auth.uid()
));

-- Paciente cria mensagens
CREATE POLICY "Pacientes criam mensagens de chat"
ON public.chat_mensagens FOR INSERT
TO authenticated
WITH CHECK (
  remetente = 'paciente' AND
  EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = chat_mensagens.paciente_id AND p.user_id = auth.uid() AND p.ativo = true
  )
);

-- Paciente marca mensagens como lidas
CREATE POLICY "Pacientes atualizam leitura de chat"
ON public.chat_mensagens FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.pacientes p
  WHERE p.id = chat_mensagens.paciente_id AND p.user_id = auth.uid()
));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_mensagens;
