CREATE OR REPLACE FUNCTION public.get_patient_by_portal_token(p_token text)
RETURNS TABLE(
  id uuid,
  nome text,
  sobrenome text,
  email text,
  telefone text,
  user_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.sobrenome, p.email, p.telefone, p.user_id
  FROM public.pacientes p
  WHERE p.portal_token = p_token
  LIMIT 1;
$$;