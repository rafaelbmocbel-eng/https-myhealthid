-- Daily check-in (humor/dor/energia/sono) preenchido pelo paciente.
-- Faltava nas migrations originais: só existia o trigger de updated_at,
-- nunca o CREATE TABLE (a tabela tinha sido criada direto no Studio do Lovable).
CREATE TABLE public.daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id uuid NOT NULL,
  mood integer CHECK (mood BETWEEN 1 AND 10),
  pain integer CHECK (pain BETWEEN 0 AND 10),
  energy integer CHECK (energy BETWEEN 1 AND 10),
  sleep_hours numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pacientes gerenciam proprio daily log" ON public.daily_logs;
CREATE POLICY "Pacientes gerenciam proprio daily log" ON public.daily_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = daily_logs.paciente_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = daily_logs.paciente_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "Terapeutas gerenciam daily logs" ON public.daily_logs;
CREATE POLICY "Terapeutas gerenciam daily logs" ON public.daily_logs FOR ALL TO authenticated
  USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

CREATE INDEX IF NOT EXISTS idx_daily_logs_paciente ON public.daily_logs(paciente_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_terapeuta ON public.daily_logs(terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_created ON public.daily_logs(created_at DESC);
