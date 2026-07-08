-- voice_assessment_jobs: persists job state so the edge function can save its
-- result even when the browser tab closes mid-processing.  On the next app
-- open the frontend finds the completed job and restores the assessment.

CREATE TABLE IF NOT EXISTS public.voice_assessment_jobs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id     UUID        REFERENCES public.pacientes(id) ON DELETE SET NULL,
  audio_path      TEXT,
  audio_mime_type TEXT,
  input_params    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  resultado       JSONB,
  transcricao     TEXT,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_assessment_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terapeuta_own_jobs"
  ON public.voice_assessment_jobs
  FOR ALL TO authenticated
  USING  (terapeuta_id = auth.uid())
  WITH CHECK (terapeuta_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_vaj_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vaj_updated_at
  BEFORE UPDATE ON public.voice_assessment_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_vaj_updated_at();

-- Enable Realtime so the frontend can react to job completion without polling
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'voice_assessment_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_assessment_jobs;
  END IF;
END;
$$;
