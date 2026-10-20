-- EXCLUSÃO DA PRÓPRIA CONTA DE CLIENTE (pedido do Rafael, 19/10/2026).
--
-- Caso real: o profissional Nicolas criou por engano uma conta de CLIENTE com o e-mail dele e quer usar
-- o MESMO e-mail como PROFISSIONAL. O e-mail existe como usuário de cliente, então o cadastro profissional
-- não cria outra conta e o login devolve a de cliente. Antes não havia como o cliente se apagar.
--
-- O que esta função faz (a exclusão é definitiva e é feita pelo próprio cliente):
--   * apaga o login (auth.users), o acesso ao portal (portal_pacientes) e o que é só do cliente;
--   * cadastro com profissional (pacientes.terapeuta_id preenchido): o registro clínico PERMANECE com o
--     profissional (guarda de prontuário) e só perde o vínculo de login (user_id vira NULL);
--   * autocadastro SEM profissional (terapeuta_id NULL, criado pelo gatilho do portal): é só do cliente e
--     ninguém mais conseguiria ler essa linha, então ela é apagada junto com tudo que aponta para ela;
--   * conta de PROFISSIONAL nunca é excluída por este caminho.
--
-- Segurança: a função não recebe o id de ninguém, só age sobre auth.uid(). O usuário precisa digitar
-- EXCLUIR e provar que é ele (senha, ou login recente quando a conta entrou só pelo Google).
-- Todo usuário novo ganha um trial em public.assinaturas (gatilho on_auth_user_created_trial, origem
-- 'trial_signup'), então assinatura NÃO identifica profissional: só conta a que não é esse trial.
--
-- Mensagens de erro (estáveis, a interface mapeia por elas): nao_autenticado, confirmacao_invalida,
-- conta_de_profissional, conta_nao_e_de_cliente, senha_obrigatoria, senha_incorreta, reautenticar,
-- falha_ao_excluir. Em qualquer erro nada é alterado (uma única transação).
--
-- Fora do alcance do SQL: arquivos no Storage (ex.: paciente-avatars/<id do usuário>/avatar.jpg). A
-- interface remove a foto do próprio cliente antes de chamar a função.

-- ── 1. Prova de exclusão, sem dado pessoal ──────────────────────────────────

-- Não guarda e-mail, nome nem id do usuário: serve só para contar e provar que a exclusão aconteceu.
CREATE TABLE IF NOT EXISTS public.exclusoes_conta_cliente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  excluido_em timestamptz NOT NULL DEFAULT now(),
  tipo text NOT NULL DEFAULT 'cliente',
  pacientes_desvinculados integer NOT NULL DEFAULT 0,
  observacao text
);

ALTER TABLE public.exclusoes_conta_cliente ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exclusoes_conta_cliente FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.exclusoes_conta_cliente TO service_role;

-- ── 2. A função ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.excluir_minha_conta_cliente(p_confirmacao text, p_senha text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hash text;
  v_meta jsonb;
  v_ultimo_login timestamptz;
  v_esquema_crypto text;
  v_calculado text;
  v_dono oid;
  v_autonomos uuid[];
  v_alvo record;
  v_pendente boolean;
  v_linhas integer;
  v_desvinculados integer := 0;
  v_obs text[] := ARRAY[]::text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado';
  END IF;

  IF upper(btrim(coalesce(p_confirmacao, ''))) <> 'EXCLUIR' THEN
    RAISE EXCEPTION 'confirmacao_invalida';
  END IF;

  -- Serializa por usuário: clique duplo não roda duas vezes e tentativas de senha andam uma por vez
  -- (cada senha errada segura o cadeado por 1 segundo).
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('excluir_minha_conta_cliente:' || v_uid::text, 0));

  SELECT u.encrypted_password, coalesce(u.raw_user_meta_data, '{}'::jsonb), u.last_sign_in_at
    INTO v_hash, v_meta, v_ultimo_login
    FROM auth.users u
   WHERE u.id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'nao_autenticado';
  END IF;

  -- Proteção de profissional: vem antes de qualquer alteração. Na dúvida, bloqueia (o suporte resolve).
  -- Um profiles criado sozinho para um cliente (nome e e-mail apenas, sem registro, sem confirmação)
  -- NÃO conta: é apagado mais abaixo.
  IF public.eh_super_admin()
     OR coalesce(v_meta ->> 'account_type', '') = 'professional'
     OR EXISTS (SELECT 1 FROM public.pacientes pa WHERE pa.terapeuta_id = v_uid)
     OR EXISTS (SELECT 1 FROM public.assinaturas a WHERE a.user_id = v_uid AND a.origem IS DISTINCT FROM 'trial_signup')
     OR EXISTS (SELECT 1 FROM public.clinica_membros cm WHERE cm.user_id = v_uid)
     OR EXISTS (SELECT 1 FROM public.clinicas cl WHERE cl.dono_user_id = v_uid)
     OR EXISTS (SELECT 1 FROM public.config_clinica cc WHERE cc.terapeuta_id = v_uid)
     OR EXISTS (SELECT 1 FROM public.profissional_verificacao_log vl WHERE vl.user_id = v_uid)
     OR EXISTS (
       SELECT 1 FROM public.profiles pr
        WHERE pr.user_id = v_uid
          AND (
            pr.perfil_profissional_confirmado
            OR pr.verificado
            OR pr.equipe_cientifica
            OR cardinality(pr.equipe_areas) > 0
            OR btrim(coalesce(pr.crefito, '')) <> ''
            OR btrim(coalesce(pr.registro_profissional, '')) <> ''
            OR btrim(coalesce(pr.especialidade, '')) <> ''
            OR btrim(coalesce(pr.especialidade_medica, '')) <> ''
            OR btrim(coalesce(pr.bio, '')) <> ''
            OR btrim(coalesce(pr.avatar_url, '')) <> ''
          )
     )
  THEN
    RAISE EXCEPTION 'conta_de_profissional';
  END IF;

  IF NOT (
    coalesce(v_meta ->> 'is_patient', '') = 'true'
    OR EXISTS (SELECT 1 FROM public.portal_pacientes pp WHERE pp.user_id = v_uid)
    OR EXISTS (SELECT 1 FROM public.pacientes pc WHERE pc.user_id = v_uid)
  ) THEN
    RAISE EXCEPTION 'conta_nao_e_de_cliente';
  END IF;

  -- Reautenticação: quem tem senha confirma a senha; quem entrou só pelo Google precisa ter feito login agora.
  IF coalesce(v_hash, '') <> '' THEN
    IF coalesce(p_senha, '') = '' THEN
      RAISE EXCEPTION 'senha_obrigatoria';
    END IF;
    -- O pgcrypto mora em "extensions" no Supabase, mas aqui o esquema é descoberto no catálogo.
    SELECT n.nspname INTO v_esquema_crypto
      FROM pg_catalog.pg_extension e
      JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname = 'pgcrypto';
    IF v_esquema_crypto IS NULL THEN
      RAISE EXCEPTION 'falha_ao_excluir';
    END IF;
    EXECUTE format('SELECT %I.crypt($1, $2)', v_esquema_crypto) INTO v_calculado USING p_senha, v_hash;
    IF v_calculado IS DISTINCT FROM v_hash THEN
      PERFORM pg_catalog.pg_sleep(1);
      RAISE EXCEPTION 'senha_incorreta';
    END IF;
  ELSIF v_ultimo_login IS NULL OR v_ultimo_login < now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'reautenticar';
  END IF;

  BEGIN
    -- Cadastro com profissional: o registro clínico fica com ele, só perde o login do cliente.
    UPDATE public.pacientes
       SET user_id = NULL
     WHERE user_id = v_uid
       AND terapeuta_id IS NOT NULL;
    GET DIAGNOSTICS v_desvinculados = ROW_COUNT;

    DELETE FROM public.solicitacoes_conexao WHERE paciente_user_id = v_uid;
    DELETE FROM public.layout_config_usuario WHERE user_id = v_uid;

    DELETE FROM public.profiles WHERE user_id = v_uid;
    GET DIAGNOSTICS v_linhas = ROW_COUNT;
    IF v_linhas > 0 THEN
      v_obs := array_append(v_obs, 'perfil_falso');
    END IF;

    -- Autocadastro sem profissional: só do cliente. Apaga o que aponta para ele (com ou sem chave
    -- estrangeira) antes da própria linha, repetindo a rodada quando uma tabela depende de outra.
    SELECT coalesce(array_agg(pa.id), ARRAY[]::uuid[])
      INTO v_autonomos
      FROM public.pacientes pa
     WHERE pa.user_id = v_uid
       AND pa.terapeuta_id IS NULL;

    IF cardinality(v_autonomos) > 0 THEN
      v_obs := array_append(v_obs, 'cadastro_sem_profissional');
      IF EXISTS (
        SELECT 1 FROM public.wellness_assinaturas w
         WHERE w.paciente_id = ANY (v_autonomos) AND w.status = 'ativa'
      ) THEN
        v_obs := array_append(v_obs, 'premium_ativo');
      END IF;

      -- Só tabelas do mesmo dono de public.pacientes: uma tabela de outro dono nunca é tocada.
      SELECT c.relowner INTO v_dono FROM pg_catalog.pg_class c WHERE c.oid = 'public.pacientes'::regclass;

      DELETE FROM public.protocolo_tratamentos
       WHERE protocolo_id IN (SELECT pt.id FROM public.protocolos pt WHERE pt.paciente_id = ANY (v_autonomos));

      FOR v_passo IN 1..6 LOOP
        v_pendente := false;
        FOR v_alvo IN
          SELECT t.tbl, t.col
            FROM (
              SELECT c.oid::regclass::text AS tbl, a.attname::text AS col
                FROM pg_catalog.pg_attribute a
                JOIN pg_catalog.pg_class c ON c.oid = a.attrelid
                JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public'
                 AND c.relkind IN ('r', 'p')
                 AND c.relowner = v_dono
                 AND a.attname = 'paciente_id'
                 AND a.atttypid = 'uuid'::regtype
                 AND a.attnum > 0
                 AND NOT a.attisdropped
              UNION
              SELECT con.conrelid::regclass::text, att.attname::text
                FROM pg_catalog.pg_constraint con
                JOIN pg_catalog.pg_class cr ON cr.oid = con.conrelid
                JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
               WHERE con.contype = 'f'
                 AND con.confrelid = 'public.pacientes'::regclass
                 AND cardinality(con.conkey) = 1
                 AND cr.relowner = v_dono
                 AND con.confkey[1] = (
                   SELECT pa.attnum FROM pg_catalog.pg_attribute pa
                    WHERE pa.attrelid = 'public.pacientes'::regclass AND pa.attname = 'id'
                 )
            ) t
           ORDER BY t.tbl, t.col
        LOOP
          BEGIN
            EXECUTE format('DELETE FROM %s WHERE %I = ANY ($1)', v_alvo.tbl, v_alvo.col) USING v_autonomos;
          EXCEPTION WHEN foreign_key_violation THEN
            v_pendente := true;
          END;
        END LOOP;
        EXIT WHEN NOT v_pendente;
      END LOOP;

      IF v_pendente THEN
        RAISE EXCEPTION 'dependencia_nao_resolvida';
      END IF;

      DELETE FROM public.pacientes
       WHERE id = ANY (v_autonomos)
         AND user_id = v_uid
         AND terapeuta_id IS NULL;
    END IF;

    DELETE FROM public.portal_pacientes WHERE user_id = v_uid;

    INSERT INTO public.exclusoes_conta_cliente (tipo, pacientes_desvinculados, observacao)
    VALUES ('cliente', v_desvinculados, nullif(array_to_string(v_obs, ','), ''));

    -- Por último: o que ainda aponta para o usuário (trial, uso de IA, sessões, identidades) cai em cascata.
    DELETE FROM auth.users WHERE id = v_uid;
    GET DIAGNOSTICS v_linhas = ROW_COUNT;
    IF v_linhas <> 1 THEN
      RAISE EXCEPTION 'usuario_nao_removido';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Tudo ou nada: o erro vai para o log do servidor (sem dado do usuário) e a interface recebe uma
    -- mensagem estável. O bloco desfaz o que foi feito antes do erro.
    RAISE WARNING 'excluir_minha_conta_cliente: % (%)', SQLERRM, SQLSTATE;
    RAISE EXCEPTION 'falha_ao_excluir' USING DETAIL = SQLSTATE;
  END;

  RETURN jsonb_build_object('ok', true, 'pacientes_desvinculados', v_desvinculados);
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_minha_conta_cliente(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.excluir_minha_conta_cliente(text, text) TO authenticated;

COMMENT ON FUNCTION public.excluir_minha_conta_cliente(text, text) IS
  'Exclui a conta de CLIENTE de quem chama (auth.uid()). Confirmação EXCLUIR + senha (ou login Google recente). Profissional nunca. Erros: nao_autenticado, confirmacao_invalida, conta_de_profissional, conta_nao_e_de_cliente, senha_obrigatoria, senha_incorreta, reautenticar, falha_ao_excluir.';
