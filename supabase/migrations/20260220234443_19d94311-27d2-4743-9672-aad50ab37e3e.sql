
-- Fix: Change agendamentos RLS policies from RESTRICTIVE to PERMISSIVE
-- so that anonymous users (patients) can insert/read via public token policies

-- Drop all existing policies
DROP POLICY IF EXISTS "Terapeutas deletam seus agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Terapeutas editam seus agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Terapeutas inserem agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "Terapeutas veem seus agendamentos" ON public.agendamentos;
DROP POLICY IF EXISTS "pub_agendamentos_insert_via_token" ON public.agendamentos;
DROP POLICY IF EXISTS "pub_agendamentos_read" ON public.agendamentos;

-- Recreate as PERMISSIVE (default) so only ONE needs to pass
CREATE POLICY "Terapeutas deletam seus agendamentos"
  ON public.agendamentos FOR DELETE
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas editam seus agendamentos"
  ON public.agendamentos FOR UPDATE
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas inserem agendamentos"
  ON public.agendamentos FOR INSERT
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas veem seus agendamentos"
  ON public.agendamentos FOR SELECT
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "pub_agendamentos_insert_via_token"
  ON public.agendamentos FOR INSERT
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM links_agenda_paciente lap
      WHERE lap.terapeuta_id = agendamentos.terapeuta_id
        AND lap.paciente_id = agendamentos.paciente_id
        AND lap.status::text = 'ativo'
        AND lap.data_expiracao > now()
    ))
    AND status = 'pendente'
  );

CREATE POLICY "pub_agendamentos_read"
  ON public.agendamentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM links_agenda_paciente lap
      WHERE lap.terapeuta_id = agendamentos.terapeuta_id
        AND lap.status::text = 'ativo'
        AND lap.data_expiracao > now()
    )
  );

-- Also fix config_agenda and profiles public read policies
DROP POLICY IF EXISTS "Terapeutas veem própria config" ON public.config_agenda;
DROP POLICY IF EXISTS "pub_config_agenda_read" ON public.config_agenda;
DROP POLICY IF EXISTS "Terapeutas editam config" ON public.config_agenda;
DROP POLICY IF EXISTS "Terapeutas inserem config" ON public.config_agenda;

CREATE POLICY "Terapeutas veem própria config"
  ON public.config_agenda FOR SELECT
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas editam config"
  ON public.config_agenda FOR UPDATE
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas inserem config"
  ON public.config_agenda FOR INSERT
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "pub_config_agenda_read"
  ON public.config_agenda FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM links_agenda_paciente lap
      WHERE lap.terapeuta_id = config_agenda.terapeuta_id
        AND lap.status::text = 'ativo'
        AND lap.data_expiracao > now()
    )
  );

-- Fix profiles public read
DROP POLICY IF EXISTS "Usuários veem próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "pub_profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "Usuários editam próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Usuários inserem próprio perfil" ON public.profiles;

CREATE POLICY "Usuários veem próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários editam próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários inserem próprio perfil"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "pub_profiles_read"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM links_agenda_paciente lap
      WHERE lap.terapeuta_id = profiles.user_id
        AND lap.status::text = 'ativo'
        AND lap.data_expiracao > now()
    )
  );

-- Fix links_agenda_paciente public policies too
DROP POLICY IF EXISTS "Terapeutas gerenciam links de agenda" ON public.links_agenda_paciente;
DROP POLICY IF EXISTS "pub_links_agenda_read" ON public.links_agenda_paciente;
DROP POLICY IF EXISTS "pub_links_agenda_update_access" ON public.links_agenda_paciente;

CREATE POLICY "Terapeutas gerenciam links de agenda"
  ON public.links_agenda_paciente FOR ALL
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "pub_links_agenda_read"
  ON public.links_agenda_paciente FOR SELECT
  USING (status::text = 'ativo' AND data_expiracao > now());

CREATE POLICY "pub_links_agenda_update_access"
  ON public.links_agenda_paciente FOR UPDATE
  USING (status::text = 'ativo' AND data_expiracao > now())
  WITH CHECK (status::text = 'ativo');
