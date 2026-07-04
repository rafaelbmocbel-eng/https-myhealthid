-- A função link_patient_user_by_token estava declarada nos tipos TypeScript
-- mas nunca foi criada no banco — por isso o vínculo via link do portal falhava
-- silenciosamente e o paciente recebia "Conta não vinculada".
--
-- Esta função é chamada em PacienteLogin.tsx após o login/cadastro do paciente:
--   supabase.rpc('link_patient_user_by_token', { p_token: portalToken })
-- Ela vincula paciente.user_id ao auth.uid() via portal_token gerado pelo terapeuta.

CREATE OR REPLACE FUNCTION public.link_patient_user_by_token(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_token IS NULL OR p_token = '' THEN
    RETURN NULL;
  END IF;

  -- Vincula o paciente ao usuário autenticado via portal_token
  UPDATE public.pacientes
  SET user_id    = auth.uid(),
      updated_at = now()
  WHERE portal_token = p_token
    AND ativo = true
    AND (user_id IS NULL OR user_id = auth.uid())
  RETURNING id INTO v_paciente_id;

  -- Se não encontrou pelo token, verifica se o paciente já está vinculado
  -- (cenário de duplo clique ou recarregamento após vínculo anterior)
  IF v_paciente_id IS NULL THEN
    SELECT id INTO v_paciente_id
    FROM public.pacientes
    WHERE portal_token = p_token AND user_id = auth.uid()
    LIMIT 1;
  END IF;

  RETURN v_paciente_id;
END;
$$;

-- Garante permissão para usuários autenticados
GRANT EXECUTE ON FUNCTION public.link_patient_user_by_token(text) TO authenticated;

-- Também garante GRANT explícito para a função de fallback por e-mail
-- (faltava nas migrations anteriores)
GRANT EXECUTE ON FUNCTION public.link_patient_user_by_email() TO authenticated;
