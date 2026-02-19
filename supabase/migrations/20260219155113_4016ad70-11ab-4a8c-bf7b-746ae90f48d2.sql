
-- Tabela para avaliações salvas do Método Identidade
CREATE TABLE IF NOT EXISTS public.avaliacoes_identidade (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  terapeuta_id uuid NOT NULL,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  paciente_nome text NOT NULL,
  data_avaliacao text NOT NULL,
  dados_avaliacao jsonb NOT NULL,
  id_final numeric,
  classificacao text,
  score_e numeric,
  score_p numeric,
  score_c numeric,
  score_f numeric,
  score_d numeric,
  score_r numeric,
  score_efi numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.avaliacoes_identidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas veem suas avaliações identidade"
  ON public.avaliacoes_identidade FOR SELECT
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas inserem avaliações identidade"
  ON public.avaliacoes_identidade FOR INSERT
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas editam suas avaliações identidade"
  ON public.avaliacoes_identidade FOR UPDATE
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas deletam suas avaliações identidade"
  ON public.avaliacoes_identidade FOR DELETE
  USING (auth.uid() = terapeuta_id);

-- Atualiza updated_at automaticamente
CREATE TRIGGER update_avaliacoes_identidade_updated_at
  BEFORE UPDATE ON public.avaliacoes_identidade
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Tabela para avaliações salvas do COB° ZERO
CREATE TABLE IF NOT EXISTS public.avaliacoes_cob_zero (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  terapeuta_id uuid NOT NULL,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  paciente_nome text NOT NULL,
  data_avaliacao text NOT NULL,
  dados_avaliacao jsonb NOT NULL,
  cobb_angle numeric,
  lenke_type text,
  risco_level text,
  risco_percentage numeric,
  score_e numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.avaliacoes_cob_zero ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas veem suas avaliações cob zero"
  ON public.avaliacoes_cob_zero FOR SELECT
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas inserem avaliações cob zero"
  ON public.avaliacoes_cob_zero FOR INSERT
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas editam suas avaliações cob zero"
  ON public.avaliacoes_cob_zero FOR UPDATE
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas deletam suas avaliações cob zero"
  ON public.avaliacoes_cob_zero FOR DELETE
  USING (auth.uid() = terapeuta_id);

CREATE TRIGGER update_avaliacoes_cob_zero_updated_at
  BEFORE UPDATE ON public.avaliacoes_cob_zero
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
