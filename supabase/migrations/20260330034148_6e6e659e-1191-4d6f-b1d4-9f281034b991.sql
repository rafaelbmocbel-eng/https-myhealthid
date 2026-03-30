
-- Fix 1: Broken RLS on respostas_avaliacao_paciente
-- Drop and recreate INSERT policy with correct comparison
DROP POLICY IF EXISTS "Inserção pública via link válido" ON public.respostas_avaliacao_paciente;
CREATE POLICY "Inserção pública via link válido"
  ON public.respostas_avaliacao_paciente FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.links_avaliacao la
      WHERE la.id = respostas_avaliacao_paciente.link_id
        AND la.status = 'ativo'
        AND la.data_expiracao > now()
        AND la.paciente_id = respostas_avaliacao_paciente.paciente_id
    )
  );

-- Drop and recreate SELECT policy with correct comparison
DROP POLICY IF EXISTS "Leitura pública via link válido" ON public.respostas_avaliacao_paciente;
CREATE POLICY "Leitura pública via link válido"
  ON public.respostas_avaliacao_paciente FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.links_avaliacao la
      WHERE la.id = respostas_avaliacao_paciente.link_id
        AND la.status = 'ativo'
        AND la.data_expiracao > now()
        AND la.paciente_id = respostas_avaliacao_paciente.paciente_id
    )
  );

-- Fix 2: PIX key exposure on eventos - create RPC to serve payment data only to registered attendees
CREATE OR REPLACE FUNCTION public.get_evento_pagamento(p_evento_id uuid, p_inscricao_id uuid)
RETURNS TABLE(pix_chave text, pix_tipo text, pix_nome text, link_pagamento text, valor numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.pix_chave, e.pix_tipo, e.pix_nome, e.link_pagamento, e.valor
  FROM public.eventos e
  WHERE e.id = p_evento_id
    AND e.ativo = true
    AND e.cobrar_pagamento = true
    AND EXISTS (
      SELECT 1 FROM public.evento_inscricoes ei
      WHERE ei.id = p_inscricao_id
        AND ei.evento_id = p_evento_id
        AND ei.status != 'cancelado'
    );
$$;

-- Remove anon SELECT on eventos base table and replace with a policy that excludes sensitive columns
-- We can't do column-level RLS, so we create a view for public access
DROP POLICY IF EXISTS "Público lê eventos ativos" ON public.eventos;

-- Create a new anon policy that still allows reading but we'll handle PIX via RPC
-- Actually we need to keep anon read for event listing, but exclude PIX columns via a view
CREATE VIEW public.eventos_publicos AS
SELECT id, terapeuta_id, data_evento, horario_inicio, horario_fim, vagas_max, valor, 
       cobrar_pagamento, ativo, created_at, updated_at, titulo, descricao, local, descricao_formulario
FROM public.eventos
WHERE ativo = true;

-- Grant access to the view
GRANT SELECT ON public.eventos_publicos TO anon;
GRANT SELECT ON public.eventos_publicos TO authenticated;

-- Fix 3: Storage policies - restrict DELETE/UPDATE on exercise-images to owner
DROP POLICY IF EXISTS "Terapeutas delete exercise images" ON storage.objects;
CREATE POLICY "Terapeutas delete exercise images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'exercise-images'
    AND auth.uid() = owner
  );

DROP POLICY IF EXISTS "Terapeutas update exercise images" ON storage.objects;
CREATE POLICY "Terapeutas update exercise images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'exercise-images'
    AND auth.uid() = owner
  );
