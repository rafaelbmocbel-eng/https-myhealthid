ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS tipo_conta text NOT NULL DEFAULT 'clinico'
  CHECK (tipo_conta IN ('clinico','wellness_free','wellness_premium'));

CREATE INDEX IF NOT EXISTS idx_pacientes_tipo_conta ON public.pacientes(tipo_conta);

CREATE TABLE IF NOT EXISTS public.wellness_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','cancelada','inadimplente','pendente')),
  provider text CHECK (provider IN ('stripe','paddle','manual')),
  provider_subscription_id text,
  valor_mensal numeric(10,2) NOT NULL DEFAULT 49.00,
  data_inicio timestamptz NOT NULL DEFAULT now(),
  data_fim timestamptz,
  proxima_cobranca timestamptz,
  ultima_sessao_mensal_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wellness_assin_paciente ON public.wellness_assinaturas(paciente_id);

ALTER TABLE public.wellness_assinaturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wa_pac_select" ON public.wellness_assinaturas;
CREATE POLICY "wa_pac_select" ON public.wellness_assinaturas FOR SELECT
USING (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "wa_ter_all" ON public.wellness_assinaturas;
CREATE POLICY "wa_ter_all" ON public.wellness_assinaturas FOR ALL
USING (paciente_id IN (SELECT id FROM public.pacientes WHERE terapeuta_id = auth.uid()))
WITH CHECK (paciente_id IN (SELECT id FROM public.pacientes WHERE terapeuta_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_wellness_assin_updated_at ON public.wellness_assinaturas;
CREATE TRIGGER trg_wellness_assin_updated_at
BEFORE UPDATE ON public.wellness_assinaturas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.criar_paciente_wellness(
  p_nome text, p_sobrenome text, p_email text, p_telefone text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid; v_terapeuta_id uuid; v_paciente_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT id INTO v_paciente_id FROM public.pacientes WHERE user_id = v_user_id LIMIT 1;
  IF v_paciente_id IS NOT NULL THEN RETURN v_paciente_id; END IF;

  SELECT user_id INTO v_terapeuta_id FROM public.profiles ORDER BY created_at ASC LIMIT 1;
  IF v_terapeuta_id IS NULL THEN RAISE EXCEPTION 'wellness_nao_configurado'; END IF;

  INSERT INTO public.pacientes (
    user_id, terapeuta_id, nome, sobrenome, email, telefone,
    ativo, tipo_conta, portal_token
  ) VALUES (
    v_user_id, v_terapeuta_id, p_nome, COALESCE(p_sobrenome,''), p_email, p_telefone,
    true, 'wellness_free', encode(gen_random_bytes(16), 'hex')
  ) RETURNING id INTO v_paciente_id;

  RETURN v_paciente_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_wellness_status()
RETURNS TABLE(
  paciente_id uuid, tipo_conta text, is_premium boolean,
  assinatura_status text, proxima_cobranca timestamptz,
  consulta_mensal_disponivel boolean, ultima_sessao_mensal_em timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.tipo_conta,
    p.tipo_conta = 'wellness_premium',
    a.status, a.proxima_cobranca,
    (p.tipo_conta = 'wellness_premium'
     AND (a.ultima_sessao_mensal_em IS NULL
          OR a.ultima_sessao_mensal_em < now() - interval '30 days')),
    a.ultima_sessao_mensal_em
  FROM public.pacientes p
  LEFT JOIN LATERAL (
    SELECT * FROM public.wellness_assinaturas wa
    WHERE wa.paciente_id = p.id AND wa.status = 'ativa'
    ORDER BY wa.created_at DESC LIMIT 1
  ) a ON true
  WHERE p.user_id = auth.uid()
  LIMIT 1;
$$;