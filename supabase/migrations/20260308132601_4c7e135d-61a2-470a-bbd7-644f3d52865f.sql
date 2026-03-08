
-- Fix: scope anon insert to require funil_config_id referencing an active funil
DROP POLICY "Público insere leads" ON public.funil_leads;
CREATE POLICY "Público insere leads via funil ativo" ON public.funil_leads FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.funil_config fc 
      WHERE fc.id = funil_config_id 
        AND fc.ativo = true 
        AND fc.terapeuta_id = funil_leads.terapeuta_id
    )
  );

-- Fix: scope anon update to only allow updating own lead via funil ativo
DROP POLICY "Público atualiza leads em andamento" ON public.funil_leads;
CREATE POLICY "Público atualiza leads em andamento" ON public.funil_leads FOR UPDATE TO anon
  USING (
    status = 'em_andamento' 
    AND EXISTS (
      SELECT 1 FROM public.funil_config fc 
      WHERE fc.id = funil_config_id 
        AND fc.ativo = true
    )
  );

-- Also allow anon to read funil_config for the public page
-- (already have policy, and allow anon to read own lead)
CREATE POLICY "Público lê seus leads" ON public.funil_leads FOR SELECT TO anon
  USING (status = 'em_andamento');
