-- Log de uso de IA: tokens e custo estimado por chamada ao Gemini. Alimenta o
-- Guardião de Custo (monitor-ia-uso), que soma o gasto diário e alerta antes de
-- estourar cota/fatura. Escrito pelo _shared/log-ia.ts (service role).
CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  function_name text NOT NULL,
  model text,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  est_cost_usd numeric(12,6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_log_created_idx ON public.ai_usage_log (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_log_fn_created_idx ON public.ai_usage_log (function_name, created_at DESC);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- service_role (edge functions) ignora RLS. Política explícita de leitura para o
-- super-admin — também evita que o Guardião de Segurança acuse "RLS sem policy".
DROP POLICY IF EXISTS "ai_usage_log super admin read" ON public.ai_usage_log;
CREATE POLICY "ai_usage_log super admin read" ON public.ai_usage_log
  FOR SELECT USING (auth.jwt() ->> 'email' = 'rafaelbmocbel@gmail.com');
