-- Corrige os cron jobs do WhatsApp para usar o CRON_SECRET
-- (defina CRON_SECRET em Supabase → Edge Functions → Secrets e use o mesmo valor abaixo)
--
-- INSTRUÇÃO:
--   1. No painel Supabase → Project Settings → Edge Functions, adicione:
--      CRON_SECRET = qualquer-string-secreta-de-sua-escolha
--   2. Substitua 'SEU_CRON_SECRET_AQUI' pelo mesmo valor abaixo antes de rodar esta migration.
--
-- URL DO PROJETO: https://mgdzlzpzjpnswpqdtylz.supabase.co

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove jobs antigos (horário errado e auth errada)
SELECT cron.unschedule('whatsapp-auto-confirm-diario')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-auto-confirm-diario'
);

-- Lembretes de agenda a cada 10 minutos
SELECT cron.schedule(
  'whatsapp-auto-confirm',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://mgdzlzpzjpnswpqdtylz.supabase.co/functions/v1/whatsapp-auto-confirm',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer SEU_CRON_SECRET_AQUI"}'::jsonb,
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
    url := 'https://mgdzlzpzjpnswpqdtylz.supabase.co/functions/v1/crm-cadencia-runner',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer SEU_CRON_SECRET_AQUI"}'::jsonb,
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
    url := 'https://mgdzlzpzjpnswpqdtylz.supabase.co/functions/v1/broadcast-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer SEU_CRON_SECRET_AQUI"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
