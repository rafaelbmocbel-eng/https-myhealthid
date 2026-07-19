-- PLANO CLÍNICA — ciclo de vida da equipe (criar → convidar → aceitar → gerir).
-- A base multiprofissional já existia dark-launched; aqui entram as RPCs que a
-- interface usa. Todas SECURITY DEFINER porque a RLS bloqueia o convidado de
-- ler o convite e de inserir o próprio vínculo (só o dono gerencia membros).

-- Cria (ou devolve) a clínica do dono e o vincula como membro 'dono' ativo.
CREATE OR REPLACE FUNCTION public.criar_minha_clinica(p_nome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_perfil public.perfil_profissional;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'nao_autenticado'; END IF;
  SELECT id INTO v_id FROM public.clinicas WHERE dono_user_id = v_uid ORDER BY created_at LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT perfil_profissional INTO v_perfil FROM public.profiles WHERE user_id = v_uid;
  INSERT INTO public.clinicas (dono_user_id, nome, ativa, limite_profissionais)
    VALUES (v_uid, COALESCE(NULLIF(btrim(p_nome), ''), 'Minha Clínica'), true, 20)
    RETURNING id INTO v_id;
  INSERT INTO public.clinica_membros (clinica_id, user_id, papel, status, perfil_profissional, aceito_em)
    VALUES (v_id, v_uid, 'dono', 'ativo', v_perfil, now())
    ON CONFLICT (clinica_id, user_id) DO NOTHING;
  RETURN v_id;
END; $$;

-- Dono cria um convite (por e-mail/papel) respeitando o limite de assentos.
-- Retorna o token — a interface monta o link /clinica/convite/<token>.
CREATE OR REPLACE FUNCTION public.convidar_clinica(p_email text, p_papel text DEFAULT 'profissional')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_cli public.clinicas%ROWTYPE; v_token text; v_ativos int; v_pend int; v_papel public.clinica_papel;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'nao_autenticado'; END IF;
  SELECT * INTO v_cli FROM public.clinicas WHERE dono_user_id = v_uid ORDER BY created_at LIMIT 1;
  IF v_cli.id IS NULL THEN RAISE EXCEPTION 'sem_clinica: crie a clínica antes de convidar'; END IF;
  v_papel := (CASE WHEN p_papel IN ('profissional','recepcao') THEN p_papel ELSE 'profissional' END)::public.clinica_papel;
  SELECT count(*) INTO v_ativos FROM public.clinica_membros WHERE clinica_id = v_cli.id AND status = 'ativo';
  SELECT count(*) INTO v_pend FROM public.clinica_convites WHERE clinica_id = v_cli.id AND status = 'pendente' AND expira_em > now();
  IF (v_ativos + v_pend) >= v_cli.limite_profissionais THEN
    RAISE EXCEPTION 'limite_atingido: a clínica atingiu o limite de % profissionais', v_cli.limite_profissionais;
  END IF;
  INSERT INTO public.clinica_convites (clinica_id, email, papel)
    VALUES (v_cli.id, lower(btrim(p_email)), v_papel)
    RETURNING token INTO v_token;
  RETURN v_token;
END; $$;

-- O profissional logado aceita um convite pelo token e vira membro ativo.
CREATE OR REPLACE FUNCTION public.aceitar_convite_clinica(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_conv public.clinica_convites%ROWTYPE; v_cli public.clinicas%ROWTYPE; v_ativos int; v_perfil public.perfil_profissional;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'nao_autenticado'; END IF;
  SELECT * INTO v_conv FROM public.clinica_convites WHERE token = p_token;
  IF v_conv.id IS NULL THEN RAISE EXCEPTION 'convite_invalido'; END IF;
  IF v_conv.status <> 'pendente' OR v_conv.expira_em <= now() THEN RAISE EXCEPTION 'convite_expirado'; END IF;
  SELECT * INTO v_cli FROM public.clinicas WHERE id = v_conv.clinica_id;
  IF v_cli.id IS NULL OR NOT v_cli.ativa THEN RAISE EXCEPTION 'clinica_indisponivel'; END IF;

  IF EXISTS (SELECT 1 FROM public.clinica_membros WHERE clinica_id = v_cli.id AND user_id = v_uid AND status = 'ativo') THEN
    UPDATE public.clinica_convites SET status = 'aceito', updated_at = now() WHERE id = v_conv.id;
    RETURN jsonb_build_object('clinica_id', v_cli.id, 'nome', v_cli.nome, 'ja_membro', true);
  END IF;

  SELECT count(*) INTO v_ativos FROM public.clinica_membros WHERE clinica_id = v_cli.id AND status = 'ativo';
  IF v_ativos >= v_cli.limite_profissionais THEN RAISE EXCEPTION 'limite_atingido'; END IF;

  SELECT perfil_profissional INTO v_perfil FROM public.profiles WHERE user_id = v_uid;
  INSERT INTO public.clinica_membros (clinica_id, user_id, papel, status, perfil_profissional, aceito_em)
    VALUES (v_cli.id, v_uid, v_conv.papel, 'ativo', v_perfil, now())
    ON CONFLICT (clinica_id, user_id)
    DO UPDATE SET status = 'ativo', papel = EXCLUDED.papel, perfil_profissional = EXCLUDED.perfil_profissional, aceito_em = now(), updated_at = now();
  UPDATE public.clinica_convites SET status = 'aceito', updated_at = now() WHERE id = v_conv.id;
  RETURN jsonb_build_object('clinica_id', v_cli.id, 'nome', v_cli.nome, 'ja_membro', false);
END; $$;

-- Equipe da minha clínica (como dono ou membro ativo): clínica + membros +
-- convites pendentes (convites só aparecem para o dono).
CREATE OR REPLACE FUNCTION public.minha_clinica_equipe()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_cli public.clinicas%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT c.* INTO v_cli FROM public.clinicas c
   WHERE c.dono_user_id = v_uid
      OR EXISTS (SELECT 1 FROM public.clinica_membros m WHERE m.clinica_id = c.id AND m.user_id = v_uid AND m.status = 'ativo')
   ORDER BY (c.dono_user_id = v_uid) DESC, c.created_at LIMIT 1;
  IF v_cli.id IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'clinica', jsonb_build_object('id', v_cli.id, 'nome', v_cli.nome, 'ativa', v_cli.ativa,
      'limite', v_cli.limite_profissionais, 'sou_dono', v_cli.dono_user_id = v_uid),
    'membros', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'user_id', m.user_id, 'papel', m.papel, 'status', m.status,
        'perfil', m.perfil_profissional,
        'nome', NULLIF(btrim(coalesce(p.nome,'') || ' ' || coalesce(p.sobrenome,'')), ''),
        'email', p.email
      ) ORDER BY (m.papel = 'dono') DESC, m.created_at)
      FROM public.clinica_membros m LEFT JOIN public.profiles p ON p.user_id = m.user_id
      WHERE m.clinica_id = v_cli.id AND m.status = 'ativo'), '[]'::jsonb),
    'convites', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', cv.id, 'email', cv.email, 'papel', cv.papel, 'token', cv.token, 'expira_em', cv.expira_em) ORDER BY cv.created_at DESC)
      FROM public.clinica_convites cv
      WHERE cv.clinica_id = v_cli.id AND cv.status = 'pendente' AND cv.expira_em > now()
        AND v_cli.dono_user_id = v_uid), '[]'::jsonb)
  );
END; $$;

-- Remove um membro (dono remove qualquer um menos ele; o próprio pode sair).
CREATE OR REPLACE FUNCTION public.remover_membro_clinica(p_membro_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_m public.clinica_membros%ROWTYPE; v_dono uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'nao_autenticado'; END IF;
  SELECT * INTO v_m FROM public.clinica_membros WHERE id = p_membro_id;
  IF v_m.id IS NULL THEN RAISE EXCEPTION 'membro_invalido'; END IF;
  SELECT dono_user_id INTO v_dono FROM public.clinicas WHERE id = v_m.clinica_id;
  IF v_m.user_id = v_dono THEN RAISE EXCEPTION 'nao_remove_dono'; END IF;
  IF v_uid <> v_dono AND v_uid <> v_m.user_id THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  UPDATE public.clinica_membros SET status = 'removido', updated_at = now() WHERE id = p_membro_id;
END; $$;

-- Dono cancela um convite pendente.
CREATE OR REPLACE FUNCTION public.cancelar_convite_clinica(p_convite_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_clinica uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'nao_autenticado'; END IF;
  SELECT clinica_id INTO v_clinica FROM public.clinica_convites WHERE id = p_convite_id;
  IF v_clinica IS NULL THEN RETURN; END IF;
  IF NOT public.is_clinica_dono(v_uid, v_clinica) THEN RAISE EXCEPTION 'sem_permissao'; END IF;
  UPDATE public.clinica_convites SET status = 'cancelado', updated_at = now() WHERE id = p_convite_id;
END; $$;

REVOKE ALL ON FUNCTION public.criar_minha_clinica(text) FROM public;
REVOKE ALL ON FUNCTION public.convidar_clinica(text, text) FROM public;
REVOKE ALL ON FUNCTION public.aceitar_convite_clinica(text) FROM public;
REVOKE ALL ON FUNCTION public.minha_clinica_equipe() FROM public;
REVOKE ALL ON FUNCTION public.remover_membro_clinica(uuid) FROM public;
REVOKE ALL ON FUNCTION public.cancelar_convite_clinica(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.criar_minha_clinica(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convidar_clinica(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aceitar_convite_clinica(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.minha_clinica_equipe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.remover_membro_clinica(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_convite_clinica(uuid) TO authenticated;
