
-- 1. Create SECURITY DEFINER function to check if a terapeuta has any active agenda link
-- This replaces direct table access in dependent policies
CREATE OR REPLACE FUNCTION public.has_active_agenda_link(p_terapeuta_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.links_agenda_paciente
    WHERE terapeuta_id = p_terapeuta_id
      AND status = 'ativo'
      AND data_expiracao > now()
  );
$$;

-- 2. Create SECURITY DEFINER function to check active agenda link with paciente
CREATE OR REPLACE FUNCTION public.has_active_agenda_link_for_paciente(p_terapeuta_id uuid, p_paciente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.links_agenda_paciente
    WHERE terapeuta_id = p_terapeuta_id
      AND paciente_id = p_paciente_id
      AND status = 'ativo'
      AND data_expiracao > now()
  );
$$;

-- 3. Drop the public policies that expose tokens
DROP POLICY IF EXISTS "pub_links_agenda_read" ON public.links_agenda_paciente;
DROP POLICY IF EXISTS "pub_links_agenda_update_access" ON public.links_agenda_paciente;
DROP POLICY IF EXISTS "pub_links_avaliacao_read" ON public.links_avaliacao;

-- 4. Update dependent policies on agendamentos to use SECURITY DEFINER functions
DROP POLICY IF EXISTS "pub_agendamentos_read" ON public.agendamentos;
CREATE POLICY "pub_agendamentos_read"
  ON public.agendamentos FOR SELECT TO public
  USING (has_active_agenda_link(terapeuta_id));

DROP POLICY IF EXISTS "pub_agendamentos_insert_via_token" ON public.agendamentos;
CREATE POLICY "pub_agendamentos_insert_via_token"
  ON public.agendamentos FOR INSERT TO public
  WITH CHECK (
    has_active_agenda_link_for_paciente(terapeuta_id, paciente_id)
    AND status = 'pendente'
  );

DROP POLICY IF EXISTS "pub_agendamentos_read_via_funil" ON public.agendamentos;
CREATE POLICY "pub_agendamentos_read_via_funil"
  ON public.agendamentos FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM funil_config fc
    WHERE fc.terapeuta_id = agendamentos.terapeuta_id AND fc.ativo = true
  ));

-- 5. Update dependent policies on config_agenda
DROP POLICY IF EXISTS "pub_config_agenda_read" ON public.config_agenda;
CREATE POLICY "pub_config_agenda_read"
  ON public.config_agenda FOR SELECT TO public
  USING (has_active_agenda_link(terapeuta_id));

-- 6. Update dependent policies on profiles
DROP POLICY IF EXISTS "pub_profiles_read" ON public.profiles;
CREATE POLICY "pub_profiles_read"
  ON public.profiles FOR SELECT TO public
  USING (has_active_agenda_link(user_id));
