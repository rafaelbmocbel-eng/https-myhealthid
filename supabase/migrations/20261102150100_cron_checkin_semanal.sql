-- Pedido semanal do check-in de bem-estar no Zap: domingo, a cada 10 minutos de 21:00 a 23:50 UTC
-- (18:00 a 20:50 em Brasília). A função zap-checkin-semanal confere a janela, o gatilho de cada
-- profissional (desligado por padrão) e envia no máximo 5 clientes por profissional por rodada.
-- O bloco só age onde existe o pg_cron (bancos locais e de teste não têm).
DO $agendar$
BEGIN
  IF to_regnamespace('cron') IS NOT NULL THEN
    PERFORM cron.unschedule(jobname)
    FROM cron.job
    WHERE jobname = 'zap-checkin-semanal';

    PERFORM cron.schedule(
      'zap-checkin-semanal',
      '*/10 21-23 * * 0',
      $job$
      SELECT net.http_post(
        url := 'https://zxulglbcxehqplxainmz.supabase.co/functions/v1/zap-checkin-semanal',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
        ),
        body := '{}'::jsonb
      );
      $job$
    );
  END IF;
END
$agendar$;
