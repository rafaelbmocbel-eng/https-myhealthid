
-- Table for automatic clinical timeline entries (prontuário)
CREATE TABLE public.notas_prontuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'geral',
  titulo text NOT NULL,
  descricao text NOT NULL,
  dados_extras jsonb DEFAULT '{}'::jsonb,
  referencia_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.notas_prontuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas veem notas dos seus pacientes"
  ON public.notas_prontuario FOR SELECT TO authenticated
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas inserem notas"
  ON public.notas_prontuario FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas deletam notas"
  ON public.notas_prontuario FOR DELETE TO authenticated
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Pacientes leem próprias notas"
  ON public.notas_prontuario FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = notas_prontuario.paciente_id AND p.user_id = auth.uid()
  ));

-- Service role needs to insert via edge functions
CREATE POLICY "Service insere notas prontuario"
  ON public.notas_prontuario FOR INSERT TO public
  WITH CHECK (true);
