
-- Allow public read of config_agenda via funil_config (for funnel page)
CREATE POLICY "pub_config_agenda_via_funil" ON public.config_agenda
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.funil_config fc
      WHERE fc.terapeuta_id = config_agenda.terapeuta_id
        AND fc.ativo = true
        AND fc.slug IS NOT NULL
    )
  );

-- Allow public read of agendamentos via funil (to check availability)
CREATE POLICY "pub_agendamentos_read_via_funil" ON public.agendamentos
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.funil_config fc
      WHERE fc.terapeuta_id = agendamentos.terapeuta_id
        AND fc.ativo = true
    )
  );

-- Allow public insert of agendamentos via funil (status must be pendente)
CREATE POLICY "pub_agendamentos_insert_via_funil" ON public.agendamentos
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'pendente'
    AND EXISTS (
      SELECT 1 FROM public.funil_config fc
      WHERE fc.terapeuta_id = agendamentos.terapeuta_id
        AND fc.ativo = true
    )
  );
