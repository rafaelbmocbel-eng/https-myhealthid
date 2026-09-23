-- Cadastro wellness (free) vinculava o cliente ao PRIMEIRO profissional da base
-- (profiles ORDER BY created_at LIMIT 1). Desde o autocadastro, terapeuta_id é
-- opcional: o cliente free fica sem profissional até escolher um na vitrine.
CREATE OR REPLACE FUNCTION public.criar_paciente_wellness(
  p_nome text, p_sobrenome text, p_email text, p_telefone text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid; v_paciente_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT id INTO v_paciente_id FROM public.pacientes WHERE user_id = v_user_id LIMIT 1;
  IF v_paciente_id IS NOT NULL THEN RETURN v_paciente_id; END IF;

  INSERT INTO public.pacientes (
    user_id, terapeuta_id, nome, sobrenome, email, telefone,
    ativo, tipo_conta, portal_token
  ) VALUES (
    v_user_id, NULL, p_nome, COALESCE(p_sobrenome,''), p_email, p_telefone,
    true, 'wellness_free', encode(gen_random_bytes(16), 'hex')
  ) RETURNING id INTO v_paciente_id;

  RETURN v_paciente_id;
END; $$;
