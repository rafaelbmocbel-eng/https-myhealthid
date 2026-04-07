
-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "pub_links_agenda_read_by_token" ON public.links_agenda_paciente;

-- Drop the overly permissive public UPDATE policy
DROP POLICY IF EXISTS "pub_links_agenda_update_tracking" ON public.links_agenda_paciente;

-- Create a security definer function to look up a link by its exact token
CREATE OR REPLACE FUNCTION public.get_agenda_link_by_token(p_token text)
RETURNS TABLE(
  id uuid,
  paciente_id uuid,
  terapeuta_id uuid,
  token varchar,
  data_criacao timestamptz,
  data_expiracao timestamptz,
  acessos_totais int,
  data_primeiro_acesso timestamptz,
  data_ultimo_acesso timestamptz,
  status varchar,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.paciente_id, l.terapeuta_id, l.token, l.data_criacao,
         l.data_expiracao, l.acessos_totais, l.data_primeiro_acesso,
         l.data_ultimo_acesso, l.status, l.created_at, l.updated_at
  FROM public.links_agenda_paciente l
  WHERE l.token = p_token
    AND l.status = 'ativo'
    AND l.data_expiracao > now()
  LIMIT 1;
$$;

-- Create a security definer function to update access tracking
CREATE OR REPLACE FUNCTION public.track_agenda_link_access(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.links_agenda_paciente
  SET acessos_totais = COALESCE(acessos_totais, 0) + 1,
      data_ultimo_acesso = now(),
      data_primeiro_acesso = COALESCE(data_primeiro_acesso, now()),
      updated_at = now()
  WHERE token = p_token
    AND status = 'ativo'
    AND data_expiracao > now();
END;
$$;
