
-- Add new MyID scores (I = Inertia, N = Systemic Noise) to avaliacoes_identidade
ALTER TABLE public.avaliacoes_identidade 
  ADD COLUMN IF NOT EXISTS score_i numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS score_n numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS red_flags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS myid_score numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS myid_analysis jsonb DEFAULT NULL;

-- Add new scores to evolucao_paciente
ALTER TABLE public.evolucao_paciente
  ADD COLUMN IF NOT EXISTS score_i numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS score_n numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delta_i numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delta_n numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS myid_score numeric DEFAULT NULL;
