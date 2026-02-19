
-- Fix: Convert all public-facing SELECT policies to PERMISSIVE
-- The previous migration created them as RESTRICTIVE which blocks anonymous access

-- Drop all the restrictive public policies
DROP POLICY IF EXISTS "Config agenda visível via link público ativo" ON public.config_agenda;
DROP POLICY IF EXISTS "Perfil terapeuta visível via link de agenda público" ON public.profiles;
DROP POLICY IF EXISTS "Agendamentos de terapeuta visíveis via link público" ON public.agendamentos;
DROP POLICY IF EXISTS "Links de agenda ativos acessíveis publicamente" ON public.links_agenda_paciente;
DROP POLICY IF EXISTS "Links de avaliação ativos acessíveis publicamente" ON public.links_avaliacao;

-- Recreate as PERMISSIVE (explicit) for anon + authenticated
CREATE POLICY "pub_config_agenda_read"
ON public.config_agenda FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.links_agenda_paciente lap
    WHERE lap.terapeuta_id = config_agenda.terapeuta_id
      AND lap.status = 'ativo'
      AND lap.data_expiracao > now()
  )
);

CREATE POLICY "pub_profiles_read"
ON public.profiles FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.links_agenda_paciente lap
    WHERE lap.terapeuta_id = profiles.user_id
      AND lap.status = 'ativo'
      AND lap.data_expiracao > now()
  )
);

CREATE POLICY "pub_agendamentos_read"
ON public.agendamentos FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.links_agenda_paciente lap
    WHERE lap.terapeuta_id = agendamentos.terapeuta_id
      AND lap.status = 'ativo'
      AND lap.data_expiracao > now()
  )
);

CREATE POLICY "pub_links_agenda_read"
ON public.links_agenda_paciente FOR SELECT TO anon, authenticated
USING (
  status = 'ativo' AND data_expiracao > now()
);

CREATE POLICY "pub_links_avaliacao_read"
ON public.links_avaliacao FOR SELECT TO anon, authenticated
USING (
  status = 'ativo' AND data_expiracao > now()
);
