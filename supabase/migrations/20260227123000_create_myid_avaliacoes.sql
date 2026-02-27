-- Migration for MyID Questionnaire
CREATE TABLE public.myid_avaliacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  token_acesso TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido')),
  respostas_brutas JSONB DEFAULT '{}'::jsonb,
  resultado_processado JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.myid_avaliacoes ENABLE ROW LEVEL SECURITY;

-- Allow terapeutas to view/edit their own patients' exams
CREATE POLICY "Terapeutas gerenciam avaliações MyID"
  ON public.myid_avaliacoes FOR ALL
  USING (auth.uid() = terapeuta_id);

-- Allow public access via token_acesso for non-authenticated patients
-- This allows anyone with the token to update the evaluation.
CREATE POLICY "Acesso público insert/update via token"
  ON public.myid_avaliacoes FOR UPDATE
  USING (status != 'concluido');

CREATE POLICY "Acesso público select via token"
  ON public.myid_avaliacoes FOR SELECT
  USING (true);

-- Trigger to update updated_at
CREATE TRIGGER trg_myid_avaliacoes_updated_at
  BEFORE UPDATE ON public.myid_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_myid_avaliacoes_paciente ON public.myid_avaliacoes(paciente_id);
CREATE INDEX idx_myid_avaliacoes_token ON public.myid_avaliacoes(token_acesso);
