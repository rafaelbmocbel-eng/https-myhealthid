
DROP VIEW IF EXISTS public.wearable_metricas_semanais;

CREATE VIEW public.wearable_metricas_semanais
WITH (security_invoker = true) AS
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
