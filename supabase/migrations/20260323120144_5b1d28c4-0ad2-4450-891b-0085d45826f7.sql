
-- Allow anon to read active events for public page
DROP POLICY IF EXISTS "Público lê eventos ativos" ON public.eventos;
CREATE POLICY "Público lê eventos ativos" ON public.eventos FOR SELECT TO anon
  USING (ativo = true);

-- Allow anon to read inscriptions count for vagas check
DROP POLICY IF EXISTS "Público conta inscricoes" ON public.evento_inscricoes;
CREATE POLICY "Público conta inscricoes" ON public.evento_inscricoes FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.eventos e WHERE e.id = evento_id AND e.ativo = true));
