-- Agenda o agente-proativo (reativação de clientes inativos, aniversário,
-- exercício pendente, MyID vencido). Os blocos de confirmação/lembrete/pós-sessão
-- foram DESLIGADOS dentro da função — quem cuida disso é o whatsapp-auto-confirm.
--
-- A reativação dispara para pacientes com exatamente 14, 30 e 60 dias sem sessão
-- (a parte por-paciente roda 1x/dia, na faixa 9h BRT). Roda a cada 30 min.
--
-- Pré-requisito: os mesmos CRON_SECRET (Edge Functions) e vault cron_secret já
-- criados para os outros jobs.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'agente-proativo';

SELECT cron.schedule(
  'agente-proativo',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zxulglbcxehqplxainmz.supabase.co/functions/v1/agente-proativo',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
