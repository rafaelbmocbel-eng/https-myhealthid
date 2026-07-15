-- Recorrência operacional do Wellness Premium: todo dia ao meio-dia UTC
-- (9h BRT) expira assinaturas vencidas há mais de 3 dias (carência) e
-- rebaixa a conta para wellness_free. Não envia mensagem nenhuma.
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'wellness-recorrencia';

SELECT cron.schedule(
  'wellness-recorrencia',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zxulglbcxehqplxainmz.supabase.co/functions/v1/wellness-recorrencia',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
