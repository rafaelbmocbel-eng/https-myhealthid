
-- Create notifications table for therapist alerts
CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'geral',
  titulo text NOT NULL,
  descricao text NOT NULL,
  lida boolean NOT NULL DEFAULT false,
  rota text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas leem suas notificacoes"
ON public.notificacoes FOR SELECT
TO authenticated
USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas atualizam suas notificacoes"
ON public.notificacoes FOR UPDATE
TO authenticated
USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas inserem notificacoes"
ON public.notificacoes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas deletam notificacoes"
ON public.notificacoes FOR DELETE
TO authenticated
USING (auth.uid() = terapeuta_id);

CREATE INDEX idx_notificacoes_terapeuta ON public.notificacoes(terapeuta_id, lida, created_at DESC);

-- Notification preferences table
CREATE TABLE public.preferencias_notificacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL UNIQUE,
  lembrete_consulta boolean NOT NULL DEFAULT true,
  alerta_falta boolean NOT NULL DEFAULT true,
  diario_pendente boolean NOT NULL DEFAULT true,
  questionario_pendente boolean NOT NULL DEFAULT true,
  nps_recebido boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.preferencias_notificacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas gerenciam preferencias"
ON public.preferencias_notificacao FOR ALL
TO authenticated
USING (auth.uid() = terapeuta_id)
WITH CHECK (auth.uid() = terapeuta_id);
