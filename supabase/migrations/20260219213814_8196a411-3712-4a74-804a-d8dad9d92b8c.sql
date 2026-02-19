
-- Allow public read of config_agenda when accessed via valid agenda link
CREATE POLICY "Config agenda visível via link público ativo"
ON public.config_agenda FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.links_agenda_paciente lap
    WHERE lap.terapeuta_id = config_agenda.terapeuta_id
      AND lap.status = 'ativo'
      AND lap.data_expiracao > now()
  )
);

-- Allow public read of therapist profile via valid agenda link (for name/phone display)
CREATE POLICY "Perfil terapeuta visível via link de agenda público"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.links_agenda_paciente lap
    WHERE lap.terapeuta_id = profiles.user_id
      AND lap.status = 'ativo'
      AND lap.data_expiracao > now()
  )
);
