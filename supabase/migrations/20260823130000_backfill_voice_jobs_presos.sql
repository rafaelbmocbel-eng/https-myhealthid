-- Backfill: jobs de avaliação por áudio que ficaram presos em 'processing'.
-- Antes do fix, os returns de erro da voice-assessment não marcavam o job como
-- 'failed' — então falhas ficavam eternamente em 'processing' (por isso a fila
-- mostrava "0 failed" apesar das falhas reais). Aqui higienizamos a fila,
-- marcando como 'failed' os que estão presos há mais de 1 hora (in-flight
-- recentes são preservados). Idempotente: só toca em quem ainda está preso.
UPDATE public.voice_assessment_jobs
SET status = 'failed',
    error_message = COALESCE(
      error_message,
      'Backfill: job preso em processing (falha ocorrida antes do fix de observabilidade, não registrada).'
    ),
    updated_at = now()
WHERE status = 'processing'
  AND created_at < now() - interval '1 hour';
