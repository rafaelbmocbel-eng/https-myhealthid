
-- Two-phase patient registration

-- 1) Status column on pacientes
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS cadastro_status text NOT NULL DEFAULT 'completo';

-- Validation trigger (cannot use CHECK if we want it flexible)
CREATE OR REPLACE FUNCTION public.pacientes_validate_cadastro_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.cadastro_status NOT IN ('pendente_paciente', 'completo') THEN
    RAISE EXCEPTION 'cadastro_status inválido: %', NEW.cadastro_status
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pacientes_validate_cadastro_status ON public.pacientes;
CREATE TRIGGER trg_pacientes_validate_cadastro_status
  BEFORE INSERT OR UPDATE OF cadastro_status ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.pacientes_validate_cadastro_status();

CREATE INDEX IF NOT EXISTS idx_pacientes_cadastro_status
  ON public.pacientes (terapeuta_id, cadastro_status)
  WHERE cadastro_status = 'pendente_paciente';

-- 2) RPC: public-read for completing registration (uses portal_token)
CREATE OR REPLACE FUNCTION public.get_paciente_completar_publico(p_token text)
RETURNS TABLE(
  id uuid,
  nome text,
  sobrenome text,
  email text,
  telefone text,
  cadastro_status text,
  terapeuta_nome text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.sobrenome, p.email, p.telefone, p.cadastro_status,
         COALESCE(NULLIF(TRIM(pr.nome || ' ' || COALESCE(pr.sobrenome,'')), ''), 'seu profissional') AS terapeuta_nome
  FROM public.pacientes p
  LEFT JOIN public.profiles pr ON pr.user_id = p.terapeuta_id
  WHERE p.portal_token = p_token
    AND p.ativo = true
  LIMIT 1;
$$;

-- 3) RPC: public-write to complete registration
CREATE OR REPLACE FUNCTION public.salvar_cadastro_paciente_publico(
  p_token text,
  p_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_terapeuta uuid;
  v_lgpd boolean;
BEGIN
  SELECT id, terapeuta_id INTO v_id, v_terapeuta
  FROM public.pacientes
  WHERE portal_token = p_token AND ativo = true
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'token_invalido' USING ERRCODE = '22023';
  END IF;

  v_lgpd := COALESCE((p_data->>'lgpd_aceite')::boolean, false);
  IF NOT v_lgpd THEN
    RAISE EXCEPTION 'lgpd_obrigatorio' USING ERRCODE = '22023';
  END IF;

  UPDATE public.pacientes SET
    nome = COALESCE(NULLIF(p_data->>'nome',''), nome),
    sobrenome = COALESCE(NULLIF(p_data->>'sobrenome',''), sobrenome),
    telefone = COALESCE(NULLIF(p_data->>'telefone',''), telefone),
    data_nascimento = NULLIF(p_data->>'data_nascimento','')::date,
    genero = NULLIF(p_data->>'genero',''),
    cpf = NULLIF(p_data->>'cpf',''),
    cep = NULLIF(p_data->>'cep',''),
    endereco = NULLIF(p_data->>'endereco',''),
    endereco_numero = NULLIF(p_data->>'endereco_numero',''),
    endereco_complemento = NULLIF(p_data->>'endereco_complemento',''),
    bairro = NULLIF(p_data->>'bairro',''),
    cidade = NULLIF(p_data->>'cidade',''),
    uf = NULLIF(p_data->>'uf',''),
    queixa_principal = NULLIF(p_data->>'queixa_principal',''),
    alergias = NULLIF(p_data->>'alergias',''),
    medicamentos_uso = NULLIF(p_data->>'medicamentos_uso',''),
    condicoes_preexistentes = NULLIF(p_data->>'condicoes_preexistentes',''),
    contato_emergencia_nome = NULLIF(p_data->>'contato_emergencia_nome',''),
    contato_emergencia_telefone = NULLIF(p_data->>'contato_emergencia_telefone',''),
    contato_emergencia_parentesco = NULLIF(p_data->>'contato_emergencia_parentesco',''),
    lgpd_aceite_em = COALESCE(lgpd_aceite_em, now()),
    lgpd_versao = COALESCE(lgpd_versao, '1.0'),
    cadastro_status = 'completo',
    updated_at = now()
  WHERE id = v_id;

  -- Termo LGPD
  INSERT INTO public.termos_consentimento (
    paciente_id, terapeuta_id, tipo, versao, texto_termo, aceito, data_aceite
  ) VALUES (
    v_id, v_terapeuta, 'lgpd', '1.0',
    'Autorizo o tratamento dos meus dados pessoais e de saúde para fins clínicos e administrativos, conforme a LGPD.',
    true, now()
  ) ON CONFLICT DO NOTHING;

  -- Notifica o profissional
  INSERT INTO public.notificacoes (terapeuta_id, tipo, titulo, descricao, rota, metadata)
  VALUES (
    v_terapeuta,
    'paciente_completou_cadastro',
    '✅ Paciente completou o cadastro',
    'O paciente terminou de preencher os dados completos.',
    '/pacientes/' || v_id,
    jsonb_build_object('paciente_id', v_id)
  );

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_paciente_completar_publico(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_cadastro_paciente_publico(text, jsonb) TO anon, authenticated;
