-- Corrige bug: VoiceAssessment.tsx, patient-self-report e mapeamentoSintomas.ts
-- já inserem o campo "tipo_diagnostico" em eventos_clinicos_anatomicos, mas a
-- coluna pode não existir ainda (se a migração 20260614250000_avatar_tipo_diagnostico.sql
-- não tiver sido aplicada), fazendo o insert automático do Avatar Clínico falhar
-- com "column does not exist".
--
-- Cobre dois cenários:
--   1) Coluna ainda não existe (banco sem 20260614250000) → cria como text+check.
--   2) Coluna já existe (banco com 20260614250000) → apenas garante que
--      'historico_relatado' está na constraint, já que a UI do Avatar Clínico
--      oferece essa opção mas a constraint original não a incluía.

DO $$ BEGIN
  ALTER TABLE public.eventos_clinicos_anatomicos
    ADD COLUMN IF NOT EXISTS tipo_diagnostico text NOT NULL DEFAULT 'achado_clinico';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

ALTER TABLE public.eventos_clinicos_anatomicos
  DROP CONSTRAINT IF EXISTS eventos_clinicos_anatomicos_tipo_diagnostico_check;

ALTER TABLE public.eventos_clinicos_anatomicos
  ADD CONSTRAINT eventos_clinicos_anatomicos_tipo_diagnostico_check
  CHECK (tipo_diagnostico IN (
    'relato_paciente', 'historico_relatado', 'achado_clinico',
    'diagnostico_medico', 'diagnostico_fisioterapia', 'diagnostico_psicologia',
    'diagnostico_nutricao', 'diagnostico_fonoaudiologia', 'diagnostico_outro'
  ));

CREATE INDEX IF NOT EXISTS idx_eca_tipo_diagnostico
  ON public.eventos_clinicos_anatomicos(paciente_id, tipo_diagnostico);
