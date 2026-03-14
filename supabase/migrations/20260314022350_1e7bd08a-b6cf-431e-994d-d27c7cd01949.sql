-- Diário do paciente: persistência real dos registros diários

CREATE TABLE IF NOT EXISTS public.daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id uuid NOT NULL,
  mood integer NOT NULL DEFAULT 3,
  pain integer NOT NULL DEFAULT 0,
  energy integer NOT NULL DEFAULT 3,
  sleep_hours numeric(4,1) NOT NULL DEFAULT 8,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_daily_logs_paciente_created_at
  ON public.daily_logs (paciente_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_logs' AND policyname = 'Terapeutas gerenciam diarios dos pacientes'
  ) THEN
    CREATE POLICY "Terapeutas gerenciam diarios dos pacientes"
    ON public.daily_logs
    FOR ALL
    TO authenticated
    USING (auth.uid() = terapeuta_id)
    WITH CHECK (auth.uid() = terapeuta_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_logs' AND policyname = 'Pacientes leem proprio diario'
  ) THEN
    CREATE POLICY "Pacientes leem proprio diario"
    ON public.daily_logs
    FOR SELECT
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.pacientes p
        WHERE p.id = daily_logs.paciente_id
          AND p.user_id = auth.uid()
          AND p.ativo = true
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_logs' AND policyname = 'Pacientes inserem proprio diario'
  ) THEN
    CREATE POLICY "Pacientes inserem proprio diario"
    ON public.daily_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.pacientes p
        WHERE p.id = daily_logs.paciente_id
          AND p.user_id = auth.uid()
          AND p.terapeuta_id = daily_logs.terapeuta_id
          AND p.ativo = true
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_logs' AND policyname = 'Pacientes atualizam proprio diario'
  ) THEN
    CREATE POLICY "Pacientes atualizam proprio diario"
    ON public.daily_logs
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.pacientes p
        WHERE p.id = daily_logs.paciente_id
          AND p.user_id = auth.uid()
          AND p.ativo = true
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.pacientes p
        WHERE p.id = daily_logs.paciente_id
          AND p.user_id = auth.uid()
          AND p.terapeuta_id = daily_logs.terapeuta_id
          AND p.ativo = true
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_logs' AND policyname = 'Pacientes removem proprio diario'
  ) THEN
    CREATE POLICY "Pacientes removem proprio diario"
    ON public.daily_logs
    FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.pacientes p
        WHERE p.id = daily_logs.paciente_id
          AND p.user_id = auth.uid()
          AND p.ativo = true
      )
    );
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_daily_logs_updated_at ON public.daily_logs;
CREATE TRIGGER update_daily_logs_updated_at
BEFORE UPDATE ON public.daily_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();