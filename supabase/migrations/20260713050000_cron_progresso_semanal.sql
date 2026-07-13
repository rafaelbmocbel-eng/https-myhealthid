-- Mensagem semanal de progresso no Zap — domingo 21:00 UTC (18:00 BRT).
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'zap-progresso-semanal';

SELECT cron.schedule(
  'zap-progresso-semanal',
  '0 21 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://zxulglbcxehqplxainmz.supabase.co/functions/v1/zap-progresso-semanal',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
