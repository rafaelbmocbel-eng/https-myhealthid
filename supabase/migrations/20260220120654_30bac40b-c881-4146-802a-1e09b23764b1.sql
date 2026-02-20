
-- Tabela de evolução para rastrear progresso entre avaliações
CREATE TABLE public.evolucao_paciente (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id UUID NOT NULL,
  avaliacao_atual_id UUID NOT NULL REFERENCES public.avaliacoes_identidade(id) ON DELETE CASCADE,
  avaliacao_anterior_id UUID REFERENCES public.avaliacoes_identidade(id) ON DELETE SET NULL,
  data_registro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Scores atuais
  score_e NUMERIC,
  score_p NUMERIC,
  score_c NUMERIC,
  score_f NUMERIC,
  score_d NUMERIC,
  score_r NUMERIC,
  score_efi NUMERIC,
  id_final NUMERIC,
  classificacao TEXT,
  -- Deltas (diferença em relação à avaliação anterior)
  delta_e NUMERIC DEFAULT 0,
  delta_p NUMERIC DEFAULT 0,
  delta_c NUMERIC DEFAULT 0,
  delta_f NUMERIC DEFAULT 0,
  delta_d NUMERIC DEFAULT 0,
  delta_r NUMERIC DEFAULT 0,
  delta_efi NUMERIC DEFAULT 0,
  delta_id_final NUMERIC DEFAULT 0,
  -- Metadados
  numero_avaliacao INTEGER NOT NULL DEFAULT 1,
  dias_desde_anterior INTEGER,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.evolucao_paciente ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Terapeutas veem evolução dos seus pacientes"
  ON public.evolucao_paciente FOR SELECT
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas inserem evolução"
  ON public.evolucao_paciente FOR INSERT
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas editam evolução"
  ON public.evolucao_paciente FOR UPDATE
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas deletam evolução"
  ON public.evolucao_paciente FOR DELETE
  USING (auth.uid() = terapeuta_id);

-- Indexes
CREATE INDEX idx_evolucao_paciente_id ON public.evolucao_paciente(paciente_id);
CREATE INDEX idx_evolucao_terapeuta_id ON public.evolucao_paciente(terapeuta_id);
CREATE INDEX idx_evolucao_data ON public.evolucao_paciente(data_registro DESC);

-- Trigger para updated_at
CREATE TRIGGER update_evolucao_paciente_updated_at
  BEFORE UPDATE ON public.evolucao_paciente
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
