
-- Fix: Change public-facing policies from RESTRICTIVE to PERMISSIVE
-- so anonymous patients can access scheduling via valid tokens

-- AGENDAMENTOS: public read
DROP POLICY IF EXISTS "pub_agendamentos_read" ON public.agendamentos;
CREATE POLICY "pub_agendamentos_read" ON public.agendamentos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM links_agenda_paciente lap
      WHERE lap.terapeuta_id = agendamentos.terapeuta_id
        AND lap.status::text = 'ativo'
        AND lap.data_expiracao > now()
    )
  );

-- AGENDAMENTOS: public insert via token
DROP POLICY IF EXISTS "pub_agendamentos_insert_via_token" ON public.agendamentos;
CREATE POLICY "pub_agendamentos_insert_via_token" ON public.agendamentos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM links_agenda_paciente lap
      WHERE lap.terapeuta_id = agendamentos.terapeuta_id
        AND lap.paciente_id = agendamentos.paciente_id
        AND lap.status::text = 'ativo'
        AND lap.data_expiracao > now()
    )
    AND status = 'pendente'
  );

-- CONFIG_AGENDA: public read
DROP POLICY IF EXISTS "pub_config_agenda_read" ON public.config_agenda;
CREATE POLICY "pub_config_agenda_read" ON public.config_agenda
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM links_agenda_paciente lap
      WHERE lap.terapeuta_id = config_agenda.terapeuta_id
        AND lap.status::text = 'ativo'
        AND lap.data_expiracao > now()
    )
  );

-- PROFILES: public read
DROP POLICY IF EXISTS "pub_profiles_read" ON public.profiles;
CREATE POLICY "pub_profiles_read" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM links_agenda_paciente lap
      WHERE lap.terapeuta_id = profiles.user_id
        AND lap.status::text = 'ativo'
        AND lap.data_expiracao > now()
    )
  );

-- LINKS_AGENDA_PACIENTE: public read
DROP POLICY IF EXISTS "pub_links_agenda_read" ON public.links_agenda_paciente;
CREATE POLICY "pub_links_agenda_read" ON public.links_agenda_paciente
  FOR SELECT USING (
    status::text = 'ativo' AND data_expiracao > now()
  );

-- LINKS_AGENDA_PACIENTE: public update access
DROP POLICY IF EXISTS "pub_links_agenda_update_access" ON public.links_agenda_paciente;
CREATE POLICY "pub_links_agenda_update_access" ON public.links_agenda_paciente
  FOR UPDATE USING (
    status::text = 'ativo' AND data_expiracao > now()
  ) WITH CHECK (
    status::text = 'ativo'
  );
