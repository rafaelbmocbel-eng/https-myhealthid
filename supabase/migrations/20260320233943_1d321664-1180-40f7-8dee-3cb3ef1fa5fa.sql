
-- 1. Create RPC for public funnel data (no payment info)
CREATE OR REPLACE FUNCTION public.get_funil_publico(p_slug text)
RETURNS TABLE(
  id uuid,
  terapeuta_id uuid,
  slug text,
  ativo boolean,
  mensagem_boas_vindas text,
  mensagem_diferenciais text,
  mensagem_servicos text,
  mensagem_agendamento text,
  mensagem_pagamento text,
  mensagem_confirmacao text,
  diferenciais jsonb,
  servicos jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fc.id, fc.terapeuta_id, fc.slug, fc.ativo,
         fc.mensagem_boas_vindas, fc.mensagem_diferenciais, fc.mensagem_servicos,
         fc.mensagem_agendamento, fc.mensagem_pagamento, fc.mensagem_confirmacao,
         fc.diferenciais, fc.servicos
  FROM public.funil_config fc
  WHERE fc.slug = p_slug AND fc.ativo = true
  LIMIT 1;
$$;

-- 2. Create RPC for payment details (requires valid lead in payment step)
CREATE OR REPLACE FUNCTION public.get_funil_pagamento(p_funil_config_id uuid, p_lead_id uuid)
RETURNS TABLE(
  pix_chave text,
  pix_tipo text,
  pix_nome text,
  link_cartao text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fc.pix_chave, fc.pix_tipo, fc.pix_nome, fc.link_cartao
  FROM public.funil_config fc
  WHERE fc.id = p_funil_config_id
    AND fc.ativo = true
    AND EXISTS (
      SELECT 1 FROM public.funil_leads fl
      WHERE fl.id = p_lead_id
        AND fl.funil_config_id = p_funil_config_id
        AND fl.etapa_atual IN ('pagamento', 'confirmacao')
    );
$$;

-- 3. Remove the overly permissive anon SELECT policy
DROP POLICY IF EXISTS "Público lê funil ativo" ON public.funil_config;
