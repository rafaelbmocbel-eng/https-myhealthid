-- Cron do Guardião de Custo/Quota de IA: roda 1x/dia às 10h UTC (~07h BRT).
-- Soma o gasto do dia pelo banco (ai_usage_log) e alerta na transição.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'monitor-ia-uso';

SELECT cron.schedule(
  'monitor-ia-uso',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zxulglbcxehqplxainmz.supabase.co/functions/v1/monitor-ia-uso',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
