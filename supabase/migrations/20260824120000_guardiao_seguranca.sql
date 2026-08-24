-- Guardião de Segurança & Dados (LGPD): função de auditoria + cron diário.
-- A função lê o catálogo do Postgres (RLS por tabela / policies) e devolve os
-- achados. É SECURITY DEFINER e só o service_role pode executar — nenhum cliente
-- (anon/authenticated) tem acesso.

CREATE OR REPLACE FUNCTION public.auditoria_seguranca()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT jsonb_build_object(
    -- Tabelas do schema public SEM RLS habilitado (risco: dados expostos).
    'tabelas_sem_rls', COALESCE((
      SELECT jsonb_agg(c.relname ORDER BY c.relname)
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
    ), '[]'::jsonb),
    -- Tabelas com RLS habilitado mas SEM nenhuma policy (ou está tudo bloqueado,
    -- ou é configuração incompleta — vale revisar).
    'tabelas_rls_sem_policy', COALESCE((
      SELECT jsonb_agg(c.relname ORDER BY c.relname)
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = true
        AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid)
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.auditoria_seguranca() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auditoria_seguranca() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auditoria_seguranca() TO service_role;

-- ── Cron diário (09:00 UTC ≈ 06:00 BRT) ──────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'monitor-seguranca';

SELECT cron.schedule(
  'monitor-seguranca',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zxulglbcxehqplxainmz.supabase.co/functions/v1/monitor-seguranca',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
