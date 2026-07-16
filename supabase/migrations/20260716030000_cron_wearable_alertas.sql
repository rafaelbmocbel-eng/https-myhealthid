-- Liga o último motor pronto e desligado: monitor de alertas de wearable.
-- Roda 1x/dia e só INSERE alertas em wearable_alertas (exibidos no card de
-- monitoramento do perfil) — nenhuma mensagem é enviada a ninguém.
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'wearable-alert-monitor';

SELECT cron.schedule(
  'wearable-alert-monitor',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zxulglbcxehqplxainmz.supabase.co/functions/v1/wearable-alert-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
