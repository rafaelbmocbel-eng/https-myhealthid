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
  is_in_trial boolean,
  acesso_clinico text,
  acesso_clinico_expira_em timestamptz,
  dias_restantes_carencia integer
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
  ),
  pacote_ativo AS (
    SELECT 1
    FROM public.pacotes_sessoes ps
    JOIN p ON p.id = ps.paciente_id
    WHERE ps.status = 'ativo'
      AND ps.sessoes_utilizadas < ps.total_sessoes
    LIMIT 1
  ),
  ultimo_pag AS (
    SELECT MAX(updated_at) AS dt
    FROM public.pagamentos_paciente pp
    JOIN p ON p.id = pp.paciente_id
    WHERE pp.status = 'pago'
  ),
  ultimo_pacote AS (
    SELECT MAX(COALESCE(ps.data_fim, ps.data_inicio)::timestamptz) AS dt
    FROM public.pacotes_sessoes ps
    JOIN p ON p.id = ps.paciente_id
  ),
  ref AS (
    SELECT GREATEST(
      COALESCE((SELECT dt FROM ultimo_pag), p.created_at),
      COALESCE((SELECT dt FROM ultimo_pacote), p.created_at),
      p.created_at
    ) AS dt
    FROM p
  ),
  calc AS (
    SELECT
      EXISTS(SELECT 1 FROM pacote_ativo) AS tem_pacote_ativo,
      (SELECT dt FROM ref) AS ref_dt,
      EXTRACT(epoch FROM (now() - (SELECT dt FROM ref)))/86400 AS dias_desde_ref
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
    (p.tipo_conta = 'wellness_free' AND now() < (p.created_at + interval '7 days')) AS is_in_trial,
    -- acesso_clinico
    CASE
      WHEN p.tipo_conta <> 'clinico' THEN 'ativo'
      WHEN c.tem_pacote_ativo OR c.dias_desde_ref <= 30 THEN 'ativo'
      WHEN c.dias_desde_ref <= 60 THEN 'carencia'
      ELSE 'bloqueado'
    END::text,
    -- expira_em
    CASE
      WHEN p.tipo_conta <> 'clinico' THEN NULL
      WHEN c.tem_pacote_ativo OR c.dias_desde_ref <= 30 THEN c.ref_dt + interval '30 days'
      WHEN c.dias_desde_ref <= 60 THEN c.ref_dt + interval '60 days'
      ELSE NULL
    END,
    -- dias_restantes_carencia
    CASE
      WHEN p.tipo_conta <> 'clinico' THEN NULL
      WHEN c.dias_desde_ref > 30 AND c.dias_desde_ref <= 60
        THEN GREATEST(0, 60 - c.dias_desde_ref)::integer
      ELSE NULL
    END
  FROM p
  LEFT JOIN a ON true
  LEFT JOIN calc c ON true;
$$;