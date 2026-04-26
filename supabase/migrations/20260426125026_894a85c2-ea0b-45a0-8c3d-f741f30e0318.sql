-- ============================================
-- 1) funil_leads: token de sessão para UPDATE anônimo
-- ============================================
ALTER TABLE public.funil_leads
  ADD COLUMN IF NOT EXISTS session_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_funil_leads_session_token
  ON public.funil_leads (session_token);

-- Substitui política anônima de UPDATE por uma que exige o token via header
DROP POLICY IF EXISTS "Anon atualiza proprio lead em andamento" ON public.funil_leads;

CREATE POLICY "Anon atualiza proprio lead com token"
ON public.funil_leads
FOR UPDATE
TO anon
USING (
  status = 'em_andamento'
  AND session_token::text = current_setting('request.headers', true)::json->>'x-lead-token'
)
WITH CHECK (
  session_token::text = current_setting('request.headers', true)::json->>'x-lead-token'
);

-- ============================================
-- 2) evento_respostas: remover SELECT anônimo
-- ============================================
DROP POLICY IF EXISTS "Anon lê respostas de eventos ativos" ON public.evento_respostas;

-- ============================================
-- 3) pagamentos_paciente: remover política INSERT permissiva duplicada
-- ============================================
DROP POLICY IF EXISTS "Pacientes criam pagamentos" ON public.pagamentos_paciente;
-- Remover também SELECT redundante (mantém "Pacientes leem próprios pagamentos")
DROP POLICY IF EXISTS "Pacientes veem seus pagamentos" ON public.pagamentos_paciente;

-- ============================================
-- 4) realtime.messages: escopar subscriptions por usuário
-- ============================================
DROP POLICY IF EXISTS "auth_realtime_topic_scoped" ON realtime.messages;

-- Apenas autenticados; o backend Realtime faz o filtro postgres_changes via RLS da tabela base.
-- Adicionalmente, esta política bloqueia mensagens de broadcast/presence que não passam pela RLS.
CREATE POLICY "auth_realtime_postgres_changes_only"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Permite apenas eventos do tipo postgres_changes (já protegidos por RLS de cada tabela)
  extension = 'postgres_changes'
);