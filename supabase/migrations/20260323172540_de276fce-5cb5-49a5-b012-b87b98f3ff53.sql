-- Backfill existing service visibility configs to include the Eventos module
UPDATE public.config_agenda
SET servicos_ativos = COALESCE(servicos_ativos, '{}'::jsonb) || jsonb_build_object('eventos', COALESCE((servicos_ativos->>'eventos')::boolean, true))
WHERE servicos_ativos IS NULL OR NOT (servicos_ativos ? 'eventos');

-- Ensure newly created config_agenda rows keep Eventos enabled by default
ALTER TABLE public.config_agenda
ALTER COLUMN servicos_ativos SET DEFAULT '{"studio": true, "cob_zero": true, "identidade": true, "eventos": true}'::jsonb;