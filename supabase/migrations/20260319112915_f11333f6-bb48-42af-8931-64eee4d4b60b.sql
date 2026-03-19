
-- Table to persist voice assessments
CREATE TABLE public.avaliacoes_voz (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  terapeuta_id UUID NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE,
  paciente_nome TEXT,
  servico TEXT NOT NULL,
  transcricao TEXT NOT NULL,
  resultado JSON NOT NULL,
  classificacao_severidade TEXT,
  queixa_principal TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.avaliacoes_voz ENABLE ROW LEVEL SECURITY;

-- Therapists manage their own assessments
CREATE POLICY "Terapeutas veem suas avaliacoes voz"
ON public.avaliacoes_voz FOR SELECT
TO authenticated
USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas criam avaliacoes voz"
ON public.avaliacoes_voz FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas deletam avaliacoes voz"
ON public.avaliacoes_voz FOR DELETE
TO authenticated
USING (auth.uid() = terapeuta_id);

-- Patients can see their own
CREATE POLICY "Pacientes leem proprias avaliacoes voz"
ON public.avaliacoes_voz FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.pacientes p
  WHERE p.id = avaliacoes_voz.paciente_id AND p.user_id = auth.uid()
));

-- Timestamp trigger
CREATE TRIGGER update_avaliacoes_voz_updated_at
BEFORE UPDATE ON public.avaliacoes_voz
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
