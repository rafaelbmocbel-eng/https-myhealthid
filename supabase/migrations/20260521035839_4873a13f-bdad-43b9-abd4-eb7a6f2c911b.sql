-- Link patient directly to convenios (registered plans)
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS convenio_id uuid REFERENCES public.convenios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pacientes_convenio_id ON public.pacientes(convenio_id);

-- Free plano_saude: was a check constraint with hardcoded FUSEX/CASSI/TRT.
-- Now the plan name comes from the convenios table, so we drop the rigid check.
ALTER TABLE public.pacientes
  DROP CONSTRAINT IF EXISTS pacientes_plano_saude_check;