
-- ── Address & LGPD & health fields ────────────────────────────────
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS endereco_numero text,
  ADD COLUMN IF NOT EXISTS endereco_complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS lgpd_aceite_em timestamptz,
  ADD COLUMN IF NOT EXISTS lgpd_versao text,
  ADD COLUMN IF NOT EXISTS contato_emergencia_nome text,
  ADD COLUMN IF NOT EXISTS contato_emergencia_telefone text,
  ADD COLUMN IF NOT EXISTS contato_emergencia_parentesco text,
  ADD COLUMN IF NOT EXISTS alergias text,
  ADD COLUMN IF NOT EXISTS medicamentos_uso text,
  ADD COLUMN IF NOT EXISTS condicoes_preexistentes text,
  ADD COLUMN IF NOT EXISTS queixa_principal text;

-- ── CPF validation function (com dígitos verificadores) ──────────
CREATE OR REPLACE FUNCTION public.is_valid_cpf(p_cpf text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_cpf text;
  v_sum int;
  v_d1 int;
  v_d2 int;
  i int;
BEGIN
  IF p_cpf IS NULL THEN RETURN true; END IF;
  v_cpf := regexp_replace(p_cpf, '\D', '', 'g');
  IF length(v_cpf) <> 11 THEN RETURN false; END IF;
  IF v_cpf ~ '^(\d)\1{10}$' THEN RETURN false; END IF;

  v_sum := 0;
  FOR i IN 1..9 LOOP
    v_sum := v_sum + (substring(v_cpf, i, 1))::int * (11 - i);
  END LOOP;
  v_d1 := (v_sum * 10) % 11;
  IF v_d1 = 10 THEN v_d1 := 0; END IF;
  IF v_d1 <> (substring(v_cpf, 10, 1))::int THEN RETURN false; END IF;

  v_sum := 0;
  FOR i IN 1..10 LOOP
    v_sum := v_sum + (substring(v_cpf, i, 1))::int * (12 - i);
  END LOOP;
  v_d2 := (v_sum * 10) % 11;
  IF v_d2 = 10 THEN v_d2 := 0; END IF;
  RETURN v_d2 = (substring(v_cpf, 11, 1))::int;
END;
$$;

-- ── Trigger: normalize & validate paciente fields ─────────────────
CREATE OR REPLACE FUNCTION public.paciente_normalize_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- email lowercase/trim/empty→null
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(trim(NEW.email));
    IF NEW.email = '' THEN NEW.email := NULL; END IF;
  END IF;
  -- cpf digits only / empty→null
  IF NEW.cpf IS NOT NULL THEN
    NEW.cpf := regexp_replace(NEW.cpf, '\D', '', 'g');
    IF NEW.cpf = '' THEN
      NEW.cpf := NULL;
    ELSIF NOT public.is_valid_cpf(NEW.cpf) THEN
      RAISE EXCEPTION 'CPF inválido' USING ERRCODE = '22023';
    END IF;
  END IF;
  -- cep digits only
  IF NEW.cep IS NOT NULL THEN
    NEW.cep := regexp_replace(NEW.cep, '\D', '', 'g');
    IF NEW.cep = '' THEN NEW.cep := NULL; END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_paciente_normalize_validate ON public.pacientes;
CREATE TRIGGER trg_paciente_normalize_validate
BEFORE INSERT OR UPDATE ON public.pacientes
FOR EACH ROW EXECUTE FUNCTION public.paciente_normalize_validate();

-- ── RPC: excluir paciente completo (transacional) ─────────────────
CREATE OR REPLACE FUNCTION public.excluir_paciente_completo(p_paciente_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_terapeuta uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT terapeuta_id INTO v_terapeuta
  FROM public.pacientes WHERE id = p_paciente_id;

  IF v_terapeuta IS NULL THEN
    RAISE EXCEPTION 'paciente_nao_encontrado';
  END IF;

  IF v_terapeuta <> auth.uid() THEN
    RAISE EXCEPTION 'sem_permissao';
  END IF;

  -- Cascata manual (em transação implícita do RPC)
  DELETE FROM public.links_avaliacao WHERE paciente_id = p_paciente_id;
  DELETE FROM public.links_agenda_paciente WHERE paciente_id = p_paciente_id;

  DELETE FROM public.protocolo_tratamentos
   WHERE protocolo_id IN (SELECT id FROM public.protocolos WHERE paciente_id = p_paciente_id);
  DELETE FROM public.protocolos WHERE paciente_id = p_paciente_id;

  DELETE FROM public.respostas_avaliacao_paciente WHERE paciente_id = p_paciente_id;
  DELETE FROM public.avaliacoes_identidade WHERE paciente_id = p_paciente_id;
  DELETE FROM public.avaliacoes_cob_zero WHERE paciente_id = p_paciente_id;
  DELETE FROM public.studio_medidas WHERE paciente_id = p_paciente_id;
  DELETE FROM public.myid_avaliacoes WHERE paciente_id = p_paciente_id;
  DELETE FROM public.agendamentos WHERE paciente_id = p_paciente_id;
  DELETE FROM public.paciente_servicos WHERE paciente_id = p_paciente_id;
  DELETE FROM public.termos_consentimento WHERE paciente_id = p_paciente_id;

  DELETE FROM public.pacientes WHERE id = p_paciente_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.excluir_paciente_completo(uuid) TO authenticated;
