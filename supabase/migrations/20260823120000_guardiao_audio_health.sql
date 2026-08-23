-- GUARDIÃO DE ÁUDIO — tabela de health-checks do motor de transcrição (Gemini)
-- e agendamento (cron) a cada 6h. A função monitor-audio-saude grava aqui e o
-- banner do painel do profissional lê a última linha.

CREATE TABLE IF NOT EXISTS public.audio_health_checks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at  timestamptz NOT NULL DEFAULT now(),
  component   text NOT NULL DEFAULT 'gemini-audio',
  ok          boolean NOT NULL,
  http_status int,
  latency_ms  int,
  error       text,
  sample      text
);

CREATE INDEX IF NOT EXISTS audio_health_checks_checked_at_idx
  ON public.audio_health_checks (checked_at DESC);

-- RLS: qualquer profissional autenticado pode LER o status (para o banner).
-- A escrita é feita pela função com a service role, que ignora RLS.
ALTER TABLE public.audio_health_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audio_health_select_autenticado" ON public.audio_health_checks;
CREATE POLICY "audio_health_select_autenticado"
  ON public.audio_health_checks
  FOR SELECT
  TO authenticated
  USING (true);

-- ── Cron a cada 6 horas ────────────────────────────────────────────
-- Pré-requisito (uma vez, pelo dono): o segredo 'cron_secret' já existe no
-- vault (usado pelos outros crons). Reutilizamos o mesmo.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname = 'monitor-audio-saude';

SELECT cron.schedule(
  'monitor-audio-saude',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zxulglbcxehqplxainmz.supabase.co/functions/v1/monitor-audio-saude',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
