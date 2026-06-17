-- Corrige bug: VoiceAssessment.tsx, patient-self-report e mapeamentoSintomas.ts
-- já inserem o campo "tipo_diagnostico" em eventos_clinicos_anatomicos, mas a
-- coluna nunca foi criada na migração original (20260610115706), fazendo todo
-- insert automático do Avatar Clínico falhar com "column does not exist".

DO $$ BEGIN
  CREATE TYPE public.tipo_diagnostico_evento AS ENUM (
    'achado_clinico', 'historico_relatado', 'relato_paciente', 'diagnostico_fisioterapia'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.eventos_clinicos_anatomicos
  ADD COLUMN IF NOT EXISTS tipo_diagnostico public.tipo_diagnostico_evento NOT NULL DEFAULT 'achado_clinico';

CREATE INDEX IF NOT EXISTS idx_eca_tipo_diagnostico
  ON public.eventos_clinicos_anatomicos(paciente_id, tipo_diagnostico);
