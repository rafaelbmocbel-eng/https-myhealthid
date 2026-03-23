
-- Allow anon to read active events for public page
CREATE POLICY "Público lê eventos ativos" ON public.eventos FOR SELECT TO anon
  USING (ativo = true);

-- Allow anon to read inscriptions count for vagas check
CREATE POLICY "Público conta inscricoes" ON public.evento_inscricoes FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.eventos e WHERE e.id = evento_id AND e.ativo = true));
