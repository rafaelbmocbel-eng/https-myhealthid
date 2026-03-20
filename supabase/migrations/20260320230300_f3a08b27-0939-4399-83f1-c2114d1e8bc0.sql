
-- Sleep logs table
CREATE TABLE public.sleep_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  bedtime timestamptz,
  wake_time timestamptz,
  total_hours numeric NOT NULL DEFAULT 0,
  deep_sleep_hours numeric,
  light_sleep_hours numeric,
  rem_sleep_hours numeric,
  awake_minutes integer,
  sleep_quality integer CHECK (sleep_quality BETWEEN 1 AND 5),
  source text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(paciente_id, date)
);

ALTER TABLE public.sleep_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pacientes gerenciam proprio sono" ON public.sleep_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = sleep_logs.paciente_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = sleep_logs.paciente_id AND p.user_id = auth.uid()));

CREATE POLICY "Terapeutas gerenciam sono" ON public.sleep_logs FOR ALL TO authenticated
  USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

CREATE INDEX idx_sleep_logs_paciente ON public.sleep_logs(paciente_id);
CREATE INDEX idx_sleep_logs_date ON public.sleep_logs(paciente_id, date);

CREATE TRIGGER trg_sleep_logs_updated_at BEFORE UPDATE ON public.sleep_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Water intake table
CREATE TABLE public.water_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount_ml integer NOT NULL DEFAULT 0,
  goal_ml integer NOT NULL DEFAULT 2000,
  entries jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(paciente_id, date)
);

ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pacientes gerenciam propria agua" ON public.water_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = water_logs.paciente_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = water_logs.paciente_id AND p.user_id = auth.uid()));

CREATE POLICY "Terapeutas gerenciam agua" ON public.water_logs FOR ALL TO authenticated
  USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

CREATE INDEX idx_water_logs_paciente ON public.water_logs(paciente_id);
CREATE INDEX idx_water_logs_date ON public.water_logs(paciente_id, date);

CREATE TRIGGER trg_water_logs_updated_at BEFORE UPDATE ON public.water_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Nutrition / meals table
CREATE TABLE public.meal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  meal_type text NOT NULL DEFAULT 'snack',
  description text,
  calories integer,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  photo_url text,
  time_eaten timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pacientes gerenciam proprias refeicoes" ON public.meal_logs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = meal_logs.paciente_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = meal_logs.paciente_id AND p.user_id = auth.uid()));

CREATE POLICY "Terapeutas gerenciam refeicoes" ON public.meal_logs FOR ALL TO authenticated
  USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

CREATE INDEX idx_meal_logs_paciente ON public.meal_logs(paciente_id);
CREATE INDEX idx_meal_logs_date ON public.meal_logs(paciente_id, date);

CREATE TRIGGER trg_meal_logs_updated_at BEFORE UPDATE ON public.meal_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Body composition table
CREATE TABLE public.body_composition (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric,
  height_cm numeric,
  bmi numeric,
  body_fat_pct numeric,
  muscle_mass_kg numeric,
  visceral_fat integer,
  waist_cm numeric,
  hip_cm numeric,
  chest_cm numeric,
  arm_cm numeric,
  thigh_cm numeric,
  source text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.body_composition ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pacientes gerenciam propria composicao" ON public.body_composition FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = body_composition.paciente_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = body_composition.paciente_id AND p.user_id = auth.uid()));

CREATE POLICY "Terapeutas gerenciam composicao" ON public.body_composition FOR ALL TO authenticated
  USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

CREATE INDEX idx_body_composition_paciente ON public.body_composition(paciente_id);
CREATE INDEX idx_body_composition_date ON public.body_composition(paciente_id, date);

CREATE TRIGGER trg_body_composition_updated_at BEFORE UPDATE ON public.body_composition
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Health metrics (steps, heart rate, SpO2, stress from smartwatch)
CREATE TABLE public.health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  steps integer DEFAULT 0,
  calories_burned integer,
  heart_rate_avg integer,
  heart_rate_min integer,
  heart_rate_max integer,
  heart_rate_resting integer,
  spo2_avg integer,
  spo2_min integer,
  stress_level integer,
  active_minutes integer,
  distance_km numeric,
  floors_climbed integer,
  source text NOT NULL DEFAULT 'manual',
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(paciente_id, date, source)
);

ALTER TABLE public.health_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pacientes gerenciam proprias metricas" ON public.health_metrics FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = health_metrics.paciente_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = health_metrics.paciente_id AND p.user_id = auth.uid()));

CREATE POLICY "Terapeutas gerenciam metricas" ON public.health_metrics FOR ALL TO authenticated
  USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

CREATE INDEX idx_health_metrics_paciente ON public.health_metrics(paciente_id);
CREATE INDEX idx_health_metrics_date ON public.health_metrics(paciente_id, date);

CREATE TRIGGER trg_health_metrics_updated_at BEFORE UPDATE ON public.health_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
