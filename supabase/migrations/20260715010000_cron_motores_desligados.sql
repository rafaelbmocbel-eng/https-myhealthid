-- Liga dois motores que estavam prontos no código mas sem agendamento:
-- 1) notificacoes-inteligentes: regras por driver do MyID (o terapeuta configura
--    as regras; sem regra ativa, o cron não envia nada — opt-in por clínica).
-- 2) event-reminders: lembrete de eventos 24h e 1h antes (flags de dedupe no evento).
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('notificacoes-inteligentes', 'event-reminders');

SELECT cron.schedule(
  'notificacoes-inteligentes',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zxulglbcxehqplxainmz.supabase.co/functions/v1/notificacoes-inteligentes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'event-reminders',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zxulglbcxehqplxainmz.supabase.co/functions/v1/event-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
