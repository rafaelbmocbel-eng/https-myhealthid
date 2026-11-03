-- Pedido semanal do check-in de bem-estar no Zap: domingo, a cada 10 minutos, de 21:30 a 23:50 UTC
-- (18:30 a 20:50 em Brasília). Começa 30 minutos depois do progresso semanal (domingo 21:00 UTC), que usa o
-- mesmo número de WhatsApp. O pg_cron aceita uma expressão por job, então são dois jobs:
--   zap-checkin-semanal        30,40,50 21 * * 0   (21:30, 21:40 e 21:50 UTC)
--   zap-checkin-semanal-noite  */10 22-23 * * 0    (22:00 a 23:50 UTC)
-- São 15 rodadas por domingo. A função zap-checkin-semanal confere a janela (18:30 a 21:00 de Brasília), o gatilho de
-- cada profissional (desligado por padrão) e envia no máximo 5 clientes por profissional por rodada.
-- timeout_milliseconds := 120000: o padrão do pg_net (5 s) estoura em rodadas com várias mensagens e pausas.
-- O bloco só age onde existe o pg_cron (bancos locais e de teste não têm).
DO $agendar$
DECLARE
  v_comando constant text := $job$
    SELECT net.http_post(
      url := 'https://zxulglbcxehqplxainmz.supabase.co/functions/v1/zap-checkin-semanal',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $job$;
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    PERFORM cron.unschedule(jobname)
    FROM cron.job
    WHERE jobname IN ('zap-checkin-semanal', 'zap-checkin-semanal-noite');

    PERFORM cron.schedule('zap-checkin-semanal', '30,40,50 21 * * 0', v_comando);
    PERFORM cron.schedule('zap-checkin-semanal-noite', '*/10 22-23 * * 0', v_comando);
  END IF;
END
$agendar$;
