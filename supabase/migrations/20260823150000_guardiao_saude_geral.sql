-- Guardião GERAL de funções: substitui o cron do monitor de áudio pelo monitor
-- geral (que já inclui o áudio + gemini chat/embeddings + banco + voice-assessment
-- ponta a ponta). Reusa a tabela audio_health_checks (component 'saude-geral').
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Desliga o cron antigo (só de áudio) — o geral cobre o áudio também.
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'monitor-audio-saude';
SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'monitor-saude-geral';

SELECT cron.schedule(
  'monitor-saude-geral',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zxulglbcxehqplxainmz.supabase.co/functions/v1/monitor-saude-geral',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
