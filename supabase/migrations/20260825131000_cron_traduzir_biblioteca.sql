-- Cron da tradução automática da biblioteca: roda de hora em hora, processa até
-- 300 nomes por vez (com cache barato) e para sozinho quando não há mais nomes
-- sem tradução (nome_traduzido_em NULL) — vira no-op.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'traduzir-biblioteca-batch';

SELECT cron.schedule(
  'traduzir-biblioteca-batch',
  '7 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zxulglbcxehqplxainmz.supabase.co/functions/v1/traduzir-biblioteca-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
