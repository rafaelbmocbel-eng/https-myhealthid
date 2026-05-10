DROP FUNCTION IF EXISTS public.get_wellness_status();

CREATE OR REPLACE FUNCTION public.get_wellness_status()
RETURNS TABLE(
  paciente_id uuid,
  tipo_conta text,
  is_premium boolean,
  assinatura_status text,
  proxima_cobranca timestamptz,
  consulta_mensal_disponivel boolean,
  ultima_sessao_mensal_em timestamptz,
  trial_ate timestamptz,
  is_in_trial boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH p AS (
    SELECT id, tipo_conta, created_at
    FROM public.pacientes
    WHERE user_id = auth.uid() AND ativo = true
    ORDER BY created_at ASC
    LIMIT 1
  ),
  a AS (
    SELECT wa.*
    FROM public.wellness_assinaturas wa
    JOIN p ON p.id = wa.paciente_id
    ORDER BY wa.created_at DESC
    LIMIT 1
  )
  SELECT
    p.id,
    COALESCE(p.tipo_conta, 'clinico')::text,
    COALESCE(p.tipo_conta = 'wellness_premium', false),
    COALESCE(a.status, 'inativa')::text,
    a.proxima_cobranca,
    CASE
      WHEN p.tipo_conta = 'wellness_premium' AND (a.ultima_sessao_mensal_em IS NULL OR a.ultima_sessao_mensal_em < date_trunc('month', now()))
      THEN true ELSE false
    END,
    a.ultima_sessao_mensal_em,
    (p.created_at + interval '7 days') AS trial_ate,
    (p.tipo_conta = 'wellness_free' AND now() < (p.created_at + interval '7 days')) AS is_in_trial
  FROM p
  LEFT JOIN a ON true;
$$;