
CREATE OR REPLACE FUNCTION public.salvar_cadastro_paciente_autenticado(p_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_paciente_id uuid;
  v_terapeuta_id uuid;
  v_lgpd boolean := COALESCE((p_data->>'lgpd_aceite')::boolean, false);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado';
  END IF;
  IF NOT v_lgpd THEN
    RAISE EXCEPTION 'lgpd_obrigatorio';
  END IF;

  SELECT id, terapeuta_id INTO v_paciente_id, v_terapeuta_id
  FROM public.pacientes
  WHERE user_id = v_uid
  LIMIT 1;

  IF v_paciente_id IS NULL THEN
    RAISE EXCEPTION 'paciente_nao_vinculado';
  END IF;

  UPDATE public.pacientes SET
    nome = COALESCE(NULLIF(p_data->>'nome',''), nome),
    sobrenome = COALESCE(NULLIF(p_data->>'sobrenome',''), sobrenome),
    telefone = COALESCE(NULLIF(p_data->>'telefone',''), telefone),
    cpf = COALESCE(NULLIF(p_data->>'cpf',''), cpf),
    data_nascimento = COALESCE(NULLIF(p_data->>'data_nascimento','')::date, data_nascimento),
    genero = COALESCE(NULLIF(p_data->>'genero',''), genero),
    cep = COALESCE(NULLIF(p_data->>'cep',''), cep),
    endereco = COALESCE(NULLIF(p_data->>'endereco',''), endereco),
    endereco_numero = COALESCE(NULLIF(p_data->>'endereco_numero',''), endereco_numero),
    endereco_complemento = COALESCE(NULLIF(p_data->>'endereco_complemento',''), endereco_complemento),
    bairro = COALESCE(NULLIF(p_data->>'bairro',''), bairro),
    cidade = COALESCE(NULLIF(p_data->>'cidade',''), cidade),
    uf = COALESCE(NULLIF(p_data->>'uf',''), uf),
    queixa_principal = COALESCE(NULLIF(p_data->>'queixa_principal',''), queixa_principal),
    alergias = COALESCE(NULLIF(p_data->>'alergias',''), alergias),
    medicamentos_uso = COALESCE(NULLIF(p_data->>'medicamentos_uso',''), medicamentos_uso),
    condicoes_preexistentes = COALESCE(NULLIF(p_data->>'condicoes_preexistentes',''), condicoes_preexistentes),
    contato_emergencia_nome = COALESCE(NULLIF(p_data->>'contato_emergencia_nome',''), contato_emergencia_nome),
    contato_emergencia_telefone = COALESCE(NULLIF(p_data->>'contato_emergencia_telefone',''), contato_emergencia_telefone),
    contato_emergencia_parentesco = COALESCE(NULLIF(p_data->>'contato_emergencia_parentesco',''), contato_emergencia_parentesco),
    cadastro_status = 'completo',
    updated_at = now()
  WHERE id = v_paciente_id;

  INSERT INTO public.termos_consentimento (paciente_id, terapeuta_id, tipo, aceito, aceito_em, ip_aceite)
  VALUES (v_paciente_id, v_terapeuta_id, 'lgpd', true, now(), NULL)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.notificacoes (terapeuta_id, tipo, titulo, mensagem, paciente_id, metadata)
  VALUES (
    v_terapeuta_id,
    'cadastro_completo',
    'Cadastro completado',
    'O paciente concluiu o cadastro pelo portal.',
    v_paciente_id,
    jsonb_build_object('source','portal_autenticado')
  );

  RETURN jsonb_build_object('ok', true, 'paciente_id', v_paciente_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.salvar_cadastro_paciente_autenticado(jsonb) TO authenticated;
