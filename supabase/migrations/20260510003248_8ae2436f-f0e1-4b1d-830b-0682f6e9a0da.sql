CREATE TABLE public.paciente_missoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL,
  terapeuta_id uuid NOT NULL,
  source_key text,
  origem text NOT NULL DEFAULT 'manual',
  titulo text NOT NULL,
  descricao text,
  acao_imediata text,
  categoria text NOT NULL DEFAULT 'importante',
  xp_recompensa integer NOT NULL DEFAULT 10,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paciente_id, source_key)
);

CREATE INDEX idx_paciente_missoes_paciente ON public.paciente_missoes(paciente_id);
CREATE INDEX idx_paciente_missoes_terapeuta ON public.paciente_missoes(terapeuta_id);

ALTER TABLE public.paciente_missoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas gerenciam missoes do paciente"
ON public.paciente_missoes
FOR ALL
TO authenticated
USING (auth.uid() = terapeuta_id)
WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Pacientes leem proprias missoes"
ON public.paciente_missoes
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.pacientes p
  WHERE p.id = paciente_missoes.paciente_id
    AND p.user_id = auth.uid()
));

CREATE TRIGGER paciente_missoes_updated_at
BEFORE UPDATE ON public.paciente_missoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.paciente_missoes;