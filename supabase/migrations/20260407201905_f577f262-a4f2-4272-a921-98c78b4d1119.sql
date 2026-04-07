-- Allow anonymous/public users to SELECT links_agenda_paciente (for agenda public page)
CREATE POLICY "pub_links_agenda_read_by_token"
ON public.links_agenda_paciente
FOR SELECT
TO public
USING (status = 'ativo' AND data_expiracao > now());

-- Allow anonymous/public users to UPDATE access tracking fields on links_agenda_paciente
CREATE POLICY "pub_links_agenda_update_tracking"
ON public.links_agenda_paciente
FOR UPDATE
TO public
USING (status = 'ativo' AND data_expiracao > now())
WITH CHECK (status = 'ativo' AND data_expiracao > now());

-- Allow anonymous users to INSERT new pacientes via public agenda link
CREATE POLICY "pub_pacientes_insert_via_agenda"
ON public.pacientes
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.links_agenda_paciente lap
    WHERE lap.terapeuta_id = pacientes.terapeuta_id
      AND lap.status = 'ativo'
      AND lap.data_expiracao > now()
  )
);

-- Allow anonymous users to SELECT pacientes by portal_token (for portal gate)
CREATE POLICY "pub_pacientes_read_by_portal_token"
ON public.pacientes
FOR SELECT
TO public
USING (portal_token IS NOT NULL AND portal_token != '');