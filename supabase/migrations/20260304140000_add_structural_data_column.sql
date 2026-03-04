-- Add structural assessment data column to avaliacoes_identidade
-- This stores the full StructuralAssessmentData JSON from the presential evaluation
ALTER TABLE public.avaliacoes_identidade
  ADD COLUMN IF NOT EXISTS dados_estruturais JSONB;

-- Make paciente_nome and dados_avaliacao nullable
-- so we can store structural-only assessments (without MyID questionnaire data)
ALTER TABLE public.avaliacoes_identidade
  ALTER COLUMN paciente_nome DROP NOT NULL;

ALTER TABLE public.avaliacoes_identidade
  ALTER COLUMN dados_avaliacao DROP NOT NULL;
