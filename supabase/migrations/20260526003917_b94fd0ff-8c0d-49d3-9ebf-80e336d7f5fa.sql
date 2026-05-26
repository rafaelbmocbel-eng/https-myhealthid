
-- Sprint 4 — Wearables: sync log + alertas + view semanal

CREATE TABLE IF NOT EXISTS public.wearable_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID NOT NULL,
  terapeuta_id UUID NOT NULL,
  fonte TEXT NOT NULL DEFAULT 'capacitor-health',
  steps INTEGER,
  heart_rate INTEGER,
  calories NUMERIC,
  sleep_hours NUMERIC,
  raw_data JSONB DEFAULT '{}'::jsonb,
  sincronizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wearable_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pacientes inserem proprio sync" ON public.wearable_sync_log FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = paciente_id AND p.user_id = auth.uid()));

CREATE POLICY "Pacientes leem proprio sync" ON public.wearable_sync_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = paciente_id AND p.user_id = auth.uid()));

CREATE POLICY "Terapeutas gerenciam sync" ON public.wearable_sync_log FOR ALL TO authenticated
  USING (terapeuta_id = auth.uid())
  WITH CHECK (terapeuta_id = auth.uid());

CREATE INDEX idx_wearable_sync_pac_date ON public.wearable_sync_log(paciente_id, sincronizado_em DESC);

-- Alertas detectados pelo monitor
CREATE TABLE IF NOT EXISTS public.wearable_alertas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id UUID NOT NULL,
  terapeuta_id UUID NOT NULL,
  tipo TEXT NOT NULL, -- 'queda_passos','sono_baixo','fc_elevada','sem_sync'
  severidade TEXT NOT NULL DEFAULT 'medio', -- baixo/medio/alto
  titulo TEXT NOT NULL,
  descricao TEXT,
  metrica_atual NUMERIC,
  metrica_referencia NUMERIC,
  lido BOOLEAN NOT NULL DEFAULT false,
  detectado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wearable_alertas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas gerenciam alertas wearable" ON public.wearable_alertas FOR ALL TO authenticated
  USING (terapeuta_id = auth.uid())
  WITH CHECK (terapeuta_id = auth.uid());

CREATE POLICY "Pacientes leem proprios alertas wearable" ON public.wearable_alertas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = paciente_id AND p.user_id = auth.uid()));

CREATE INDEX idx_wearable_alertas_terap ON public.wearable_alertas(terapeuta_id, detectado_em DESC) WHERE lido = false;

-- View: métricas semanais agregadas (últimos 7 dias)
CREATE OR REPLACE VIEW public.wearable_metricas_semanais AS
SELECT
  paciente_id,
  COUNT(*) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '7 days') AS dias_com_dados,
  ROUND(AVG(steps) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '7 days'))::INTEGER AS passos_media_7d,
  ROUND(AVG(steps) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '14 days' AND date < CURRENT_DATE - INTERVAL '7 days'))::INTEGER AS passos_media_semana_anterior,
  ROUND(AVG(heart_rate_resting) FILTER (WHERE date >= CURRENT_DATE - INTERVAL '7 days'))::INTEGER AS fc_repouso_media_7d,
  MAX(date) AS ultimo_dia_com_dados
FROM public.health_metrics
GROUP BY paciente_id;

GRANT SELECT ON public.wearable_metricas_semanais TO authenticated;
