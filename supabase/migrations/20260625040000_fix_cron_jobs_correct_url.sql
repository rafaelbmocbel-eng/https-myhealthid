-- Corrige os cron jobs criados em 20260614120000_fix_cron_jobs.sql, que apontavam
-- para um projeto Supabase diferente do real (mgdzlzpzjpnswpqdtylz em vez de
-- rbzmojurvypksubeigbt) e nunca chegaram a ser executados (pg_cron não habilitado).
--
-- O segredo usado para autenticar as chamadas do cron NÃO fica neste arquivo.
-- Antes de rodar esta migration, crie-o uma vez no SQL Editor:
--
--   select vault.create_secret('<valor-do-seu-CRON_SECRET>', 'cron_secret');
--
-- E configure o MESMO valor como secret CRON_SECRET em
-- Project Settings → Edge Functions → Secrets.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('whatsapp-auto-confirm', 'crm-cadencia-runner', 'broadcast-scheduler', 'whatsapp-auto-confirm-diario');

-- Lembretes/confirmação/check-in de agenda a cada 10 minutos
SELECT cron.schedule(
  'whatsapp-auto-confirm',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rbzmojurvypksubeigbt.supabase.co/functions/v1/whatsapp-auto-confirm',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Cadências CRM a cada 15 minutos
SELECT cron.schedule(
  'crm-cadencia-runner',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rbzmojurvypksubeigbt.supabase.co/functions/v1/crm-cadencia-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Broadcasts agendados a cada hora
SELECT cron.schedule(
  'broadcast-scheduler',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rbzmojurvypksubeigbt.supabase.co/functions/v1/broadcast-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
