-- =============================================
-- FIX 1: Remove anon PII exposure on evento_inscricoes
-- Replace full-row SELECT with security definer count functions
-- =============================================

-- Drop the permissive anon SELECT policy that exposes PII
DROP POLICY IF EXISTS "Público conta inscricoes" ON public.evento_inscricoes;

-- Create security definer function for counting inscriptions (no PII exposed)
CREATE OR REPLACE FUNCTION public.count_evento_inscricoes(p_evento_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM public.evento_inscricoes
  WHERE evento_id = p_evento_id
    AND status != 'cancelado';
$$;

-- Create security definer function for getting active inscription IDs only (no PII)
CREATE OR REPLACE FUNCTION public.get_active_inscricao_ids(p_evento_id uuid)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ei.id
  FROM public.evento_inscricoes ei
  WHERE ei.evento_id = p_evento_id
    AND ei.status != 'cancelado';
$$;

GRANT EXECUTE ON FUNCTION public.count_evento_inscricoes TO anon;
GRANT EXECUTE ON FUNCTION public.count_evento_inscricoes TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_inscricao_ids TO anon;
GRANT EXECUTE ON FUNCTION public.get_active_inscricao_ids TO authenticated;

-- =============================================
-- FIX 2: Strengthen respostas_avaliacao_paciente INSERT policy
-- Validate paciente_id matches the link's actual patient
-- =============================================

DROP POLICY IF EXISTS "Inserção pública via link válido" ON public.respostas_avaliacao_paciente;

CREATE POLICY "Inserção pública via link válido"
  ON public.respostas_avaliacao_paciente
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.links_avaliacao la
      WHERE la.id = link_id
        AND la.status = 'ativo'
        AND la.data_expiracao > now()
        AND la.paciente_id = paciente_id
    )
  );

-- Also strengthen the public SELECT policy to validate paciente_id
DROP POLICY IF EXISTS "Leitura pública via link válido" ON public.respostas_avaliacao_paciente;

CREATE POLICY "Leitura pública via link válido"
  ON public.respostas_avaliacao_paciente
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.links_avaliacao la
      WHERE la.id = link_id
        AND la.status = 'ativo'
        AND la.data_expiracao > now()
        AND la.paciente_id = paciente_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.links_avaliacao la
      WHERE la.id = respostas_avaliacao_paciente.link_id
        AND la.terapeuta_id = auth.uid()
    )
  );