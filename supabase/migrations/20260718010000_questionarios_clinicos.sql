-- Questionários clínicos baseados em evidência (premium, adaptativos ao MyID):
-- PAR-Q+ (segurança pré-exercício), PSFS (metas funcionais), START Back
-- (estratificação de risco da dor), ISI (insônia) e PHQ-4 (ansiedade/depressão).
-- O MyID decide QUAIS aparecem; cada resposta guarda escore e classificação
-- calculados pelos pontos de corte validados.
CREATE TABLE IF NOT EXISTS public.questionarios_clinicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL,
  terapeuta_id uuid,
  instrumento text NOT NULL CHECK (instrumento IN ('parq','psfs','sbst','odi','ndi','isi','phq4')),
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  escore numeric,
  classificacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.questionarios_clinicos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Paciente gerencia proprios questionarios" ON public.questionarios_clinicos;
CREATE POLICY "Paciente gerencia proprios questionarios" ON public.questionarios_clinicos
  FOR ALL TO authenticated
  USING (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()))
  WITH CHECK (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Terapeuta le questionarios dos pacientes" ON public.questionarios_clinicos;
CREATE POLICY "Terapeuta le questionarios dos pacientes" ON public.questionarios_clinicos
  FOR SELECT TO authenticated
  USING (paciente_id IN (SELECT id FROM public.pacientes WHERE terapeuta_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_quest_clinicos_paciente
  ON public.questionarios_clinicos (paciente_id, instrumento, created_at DESC);
