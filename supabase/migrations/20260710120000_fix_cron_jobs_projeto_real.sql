-- Corrige a URL dos cron jobs para o projeto REAL (zxulglbcxehqplxainmz).
-- As versões anteriores apontavam para projetos ERRADOS (mgdzlzpzjpnswpqdtylz e
-- depois rbzmojurvypksubeigbt), então NENHUMA automação de WhatsApp disparava.
--
-- Pré-requisito (uma vez só, pelo dono da plataforma):
--   1) No SQL Editor do Supabase, rode:
--        select vault.create_secret('<UMA_SENHA_SECRETA>', 'cron_secret');
--   2) Em Project Settings → Edge Functions → Secrets, crie CRON_SECRET com
--      o MESMO valor.
--   (O segredo autentica as chamadas do cron; por isso não fica neste arquivo.)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamentos antigos (com URL errada) para recriar com a correta.
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
  'whatsapp-auto-confirm', 'crm-cadencia-runner',
  'broadcast-scheduler', 'whatsapp-auto-confirm-diario'
);

-- Confirmação 24h antes · lembrete 2h antes · pós-sessão 1h depois — a cada 10 min
SELECT cron.schedule(
  'whatsapp-auto-confirm',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zxulglbcxehqplxainmz.supabase.co/functions/v1/whatsapp-auto-confirm',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Cadências CRM (nutrição de leads e reativação de clientes) — a cada 15 min
SELECT cron.schedule(
  'crm-cadencia-runner',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zxulglbcxehqplxainmz.supabase.co/functions/v1/crm-cadencia-runner',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Promoções/broadcasts agendados — a cada hora
SELECT cron.schedule(
  'broadcast-scheduler',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zxulglbcxehqplxainmz.supabase.co/functions/v1/broadcast-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
