-- Anamnese nutricional do paciente (card de perguntas do plano alimentar).
-- Respostas em jsonb: objetivo, restricoes, alergias, preferencias,
-- refeicoes_por_dia, rotina, aversoes, etc. 1 registro por paciente.
CREATE TABLE IF NOT EXISTS public.nutricao_anamnese (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL UNIQUE,
  terapeuta_id uuid,
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nutricao_anamnese ENABLE ROW LEVEL SECURITY;

-- Paciente lê e escreve a própria anamnese
DROP POLICY IF EXISTS "Paciente le sua anamnese" ON public.nutricao_anamnese;
CREATE POLICY "Paciente le sua anamnese" ON public.nutricao_anamnese
  FOR SELECT USING (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Paciente escreve sua anamnese" ON public.nutricao_anamnese;
CREATE POLICY "Paciente escreve sua anamnese" ON public.nutricao_anamnese
  FOR INSERT WITH CHECK (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Paciente atualiza sua anamnese" ON public.nutricao_anamnese;
CREATE POLICY "Paciente atualiza sua anamnese" ON public.nutricao_anamnese
  FOR UPDATE USING (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

-- Terapeuta lê/escreve a anamnese dos seus pacientes
DROP POLICY IF EXISTS "Terapeuta le anamnese dos pacientes" ON public.nutricao_anamnese;
CREATE POLICY "Terapeuta le anamnese dos pacientes" ON public.nutricao_anamnese
  FOR SELECT USING (paciente_id IN (SELECT id FROM public.pacientes WHERE terapeuta_id = auth.uid()));

DROP POLICY IF EXISTS "Terapeuta escreve anamnese dos pacientes" ON public.nutricao_anamnese;
CREATE POLICY "Terapeuta escreve anamnese dos pacientes" ON public.nutricao_anamnese
  FOR INSERT WITH CHECK (paciente_id IN (SELECT id FROM public.pacientes WHERE terapeuta_id = auth.uid()));

DROP POLICY IF EXISTS "Terapeuta atualiza anamnese dos pacientes" ON public.nutricao_anamnese;
CREATE POLICY "Terapeuta atualiza anamnese dos pacientes" ON public.nutricao_anamnese
  FOR UPDATE USING (paciente_id IN (SELECT id FROM public.pacientes WHERE terapeuta_id = auth.uid()));
