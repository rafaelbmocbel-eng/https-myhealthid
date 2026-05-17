
DO $$ BEGIN
  CREATE TYPE public.crm_pipeline_stage AS ENUM ('novo', 'qualificado', 'agendado', 'fechado', 'perdido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.whatsapp_conversas
  ADD COLUMN IF NOT EXISTS pipeline_stage public.crm_pipeline_stage NOT NULL DEFAULT 'novo',
  ADD COLUMN IF NOT EXISTS pipeline_motivo_perda text,
  ADD COLUMN IF NOT EXISTS pipeline_updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_conversas_pipeline
  ON public.whatsapp_conversas(terapeuta_id, pipeline_stage, pipeline_updated_at DESC);
