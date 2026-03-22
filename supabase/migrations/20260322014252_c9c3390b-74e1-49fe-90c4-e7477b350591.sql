
-- Drop the overly permissive public profiles read policy
DROP POLICY IF EXISTS "pub_profiles_read" ON public.profiles;

-- Create a secure RPC that returns only public-safe therapist info scoped by agenda token
CREATE OR REPLACE FUNCTION public.get_terapeuta_by_agenda_token(p_token text)
RETURNS TABLE(nome text, sobrenome text, telefone text, especialidade text, bio text, user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pr.nome, pr.sobrenome, pr.telefone, pr.especialidade, pr.bio, pr.user_id
  FROM public.profiles pr
  JOIN public.links_agenda_paciente lap ON lap.terapeuta_id = pr.user_id
  WHERE lap.token = p_token
    AND lap.status = 'ativo'
    AND lap.data_expiracao > now()
  LIMIT 1;
$$;
