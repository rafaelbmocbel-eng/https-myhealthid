-- EXCLUSÃO DA PRÓPRIA CONTA DE CLIENTE (pedido do Rafael, 19/10/2026).
--
-- Caso real: o profissional Nicolas criou por engano uma conta de CLIENTE com o e-mail dele e quer usar
-- o MESMO e-mail como PROFISSIONAL. O e-mail existe como usuário de cliente, então o cadastro profissional
-- não cria outra conta e o login devolve a de cliente. Antes não havia como o cliente se apagar.
--
-- O que esta função faz (a exclusão é definitiva e é feita pelo próprio cliente):
--   * apaga o login (auth.users), o acesso ao portal (portal_pacientes) e o que é só do cliente;
--   * cadastro com profissional (pacientes.terapeuta_id preenchido): o registro clínico PERMANECE com o
--     profissional (guarda de prontuário) e só perde o vínculo de login (user_id vira NULL). A ficha que
--     fica sem dono NÃO pode ser reivindicada por estranho: o link antigo morre (portal_token NULL) e a
--     ficha ganha vinculo_encerrado_em, que impede religar por e-mail até o profissional convidar de novo;
--   * autocadastro SEM profissional (terapeuta_id NULL, criado pelo gatilho do portal): é só do cliente e
--     ninguém mais conseguiria ler essa linha, então ela é apagada junto com tudo que aponta para ela;
--   * conta de PROFISSIONAL nunca é excluída por este caminho.
--
-- Segurança: a função não recebe o id de ninguém, só age sobre auth.uid(). O usuário precisa digitar
-- EXCLUIR e provar que é ele (senha, ou login recente quando a conta entrou só pelo Google).
-- Todo usuário novo ganha um trial em public.assinaturas (gatilho on_auth_user_created_trial, origem
-- 'trial_signup'), então assinatura NÃO identifica profissional: só conta a que não é esse trial.
-- A proteção de profissional olha os sinais conhecidos E qualquer tabela de public com chave estrangeira
-- para auth.users que não seja de cliente: dado ali dentro significa profissional (na dúvida, bloqueia).
--
-- Freio de senha sem segurar conexão do banco: a trava por usuário falha na hora (tente_novamente) em vez
-- de enfileirar, e 5 senhas erradas seguidas bloqueiam novas tentativas por 15 minutos (muitas_tentativas).
-- Senha errada devolve {ok:false, erro:'senha_incorreta'} em vez de levantar erro, porque um erro desfaria
-- a contagem de tentativas.
--
-- Mensagens de erro (estáveis, a interface mapeia por elas): nao_autenticado, confirmacao_invalida,
-- tente_novamente, conta_de_profissional, conta_nao_e_de_cliente, premium_requer_aceite, senha_obrigatoria,
-- muitas_tentativas, reautenticar, cadastro_precisa_correcao, falha_ao_excluir. Em qualquer erro nada é
-- alterado (uma única transação).
--
-- Fora do alcance do SQL: arquivos no Storage (ex.: paciente-avatars/<id do usuário>/avatar.jpg). A
-- interface remove a foto do próprio cliente logo depois que esta função confirma a exclusão.

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

-- ── 2. Freio de tentativas de senha ─────────────────────────────────────────

-- Sem chave estrangeira de propósito: a função apaga a linha junto com o usuário.
CREATE TABLE IF NOT EXISTS public.exclusoes_conta_cliente_tentativas (
  user_id uuid PRIMARY KEY,
  falhas integer NOT NULL DEFAULT 0,
  ultima_falha_em timestamptz NOT NULL DEFAULT now(),
  bloqueado_ate timestamptz
);

ALTER TABLE public.exclusoes_conta_cliente_tentativas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exclusoes_conta_cliente_tentativas FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.exclusoes_conta_cliente_tentativas TO service_role;

-- ── 3. Ficha que perdeu o cliente não pode ser reivindicada por estranho ────

ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS vinculo_encerrado_em timestamptz;

COMMENT ON COLUMN public.pacientes.vinculo_encerrado_em IS
  'Quando o cliente excluiu a própria conta e a ficha ficou só com o profissional. Enquanto preenchida, nenhum caminho automático (e-mail, cadastro no portal) religa a ficha a um login; o profissional libera gerando um novo link do portal.';

-- Rede de segurança para qualquer caminho de religação, inclusive os que não conhecemos: ficha com o
-- vínculo encerrado não recebe user_id de novo, a não ser que o mesmo UPDATE reabra o vínculo.
CREATE OR REPLACE FUNCTION public.pacientes_protege_vinculo_encerrado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.user_id IS NULL
     AND NEW.user_id IS NOT NULL
     AND OLD.vinculo_encerrado_em IS NOT NULL
     AND NEW.vinculo_encerrado_em IS NOT DISTINCT FROM OLD.vinculo_encerrado_em
  THEN
    RAISE EXCEPTION 'vinculo_encerrado' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Convidar de novo = gerar um novo link do portal (o profissional é o único que altera a ficha sem dono).
CREATE OR REPLACE FUNCTION public.pacientes_reabre_vinculo_ao_convidar()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.vinculo_encerrado_em IS NOT NULL
     AND OLD.user_id IS NULL
     AND NEW.portal_token IS NOT NULL
     AND btrim(NEW.portal_token) <> ''
     AND NEW.portal_token IS DISTINCT FROM OLD.portal_token
  THEN
    NEW.vinculo_encerrado_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.pacientes_protege_vinculo_encerrado() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pacientes_reabre_vinculo_ao_convidar() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_pacientes_protege_vinculo_encerrado
  BEFORE UPDATE OF user_id ON public.pacientes
  FOR EACH ROW
  WHEN (OLD.user_id IS NULL AND NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION public.pacientes_protege_vinculo_encerrado();

CREATE OR REPLACE TRIGGER trg_pacientes_reabre_vinculo_ao_convidar
  BEFORE UPDATE OF portal_token ON public.pacientes
  FOR EACH ROW
  WHEN (OLD.vinculo_encerrado_em IS NOT NULL)
  EXECUTE FUNCTION public.pacientes_reabre_vinculo_ao_convidar();

-- As três funções que religam ficha sem dono passam a ignorar a ficha de vínculo encerrado. O resto de cada
-- função é idêntico à última versão (20260316140436, 20260704140000 e 20260719130000).
CREATE OR REPLACE FUNCTION public.link_patient_user_by_email()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  UPDATE public.pacientes
  SET user_id = auth.uid(), updated_at = now()
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email))
    AND (user_id IS NULL OR user_id = auth.uid())
    AND vinculo_encerrado_em IS NULL
  RETURNING id INTO v_patient_id;

  IF v_patient_id IS NULL THEN
    SELECT id INTO v_patient_id
    FROM public.pacientes
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  RETURN v_patient_id;
END;
$$;

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

  UPDATE public.pacientes
  SET user_id    = auth.uid(),
      updated_at = now()
  WHERE portal_token = p_token
    AND ativo = true
    AND (user_id IS NULL OR user_id = auth.uid())
    AND vinculo_encerrado_em IS NULL
  RETURNING id INTO v_paciente_id;

  IF v_paciente_id IS NULL THEN
    SELECT id INTO v_paciente_id
    FROM public.pacientes
    WHERE portal_token = p_token AND user_id = auth.uid()
    LIMIT 1;
  END IF;

  RETURN v_paciente_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_paciente_do_portal()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_existente uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.pacientes p WHERE p.user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  IF NEW.email IS NOT NULL AND btrim(NEW.email) <> '' THEN
    SELECT p.id INTO v_existente
    FROM public.pacientes p
    WHERE p.user_id IS NULL
      AND p.vinculo_encerrado_em IS NULL
      AND lower(btrim(p.email)) = lower(btrim(NEW.email))
    ORDER BY p.created_at DESC NULLS LAST
    LIMIT 1;

    IF v_existente IS NOT NULL THEN
      UPDATE public.pacientes
      SET user_id = NEW.user_id,
          nome = COALESCE(NULLIF(nome, ''), NULLIF(NEW.nome, ''), 'Cliente'),
          cadastro_status = 'completo',
          ativo = true
      WHERE id = v_existente;
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.pacientes (user_id, terapeuta_id, nome, sobrenome, email, ativo, cadastro_status, tipo_conta)
  VALUES (NEW.user_id, NULL, COALESCE(NULLIF(NEW.nome, ''), 'Cliente'), '', NEW.email, true, 'completo', 'wellness_free');

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- ── 4. A função ─────────────────────────────────────────────────────────────

-- A assinatura ganhou o aceite do premium: sem o DROP, a versão antiga ficaria como sobrecarga ambígua.
DROP FUNCTION IF EXISTS public.excluir_minha_conta_cliente(text, text);

CREATE OR REPLACE FUNCTION public.excluir_minha_conta_cliente(
  p_confirmacao text,
  p_senha text DEFAULT NULL,
  p_aceita_perder_premium boolean DEFAULT false
)
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
  v_tem boolean;
  v_premium boolean;
  v_linhas integer;
  v_desvinculados integer := 0;
  v_obs text[] := ARRAY[]::text[];
  v_bloqueado_ate timestamptz;
  v_falhas integer;
  v_ultima_falha timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'nao_autenticado';
  END IF;

  IF upper(btrim(coalesce(p_confirmacao, ''))) <> 'EXCLUIR' THEN
    RAISE EXCEPTION 'confirmacao_invalida';
  END IF;

  -- Uma chamada por usuário de cada vez (clique duplo, tentativas em paralelo). Falha na hora em vez de
  -- esperar: esperar prenderia uma conexão do banco por chamada.
  IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('excluir_minha_conta_cliente:' || v_uid::text, 0)) THEN
    RAISE EXCEPTION 'tente_novamente';
  END IF;

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

  -- Qualquer outra tabela de public com chave estrangeira para auth.users que tenha linha deste usuário é
  -- dado de profissional (funil, despesas, agenda, pesquisa...) e seria apagado em cascata sem aviso. As
  -- tabelas de cliente ficam de fora. Tabela nova entra na proteção sozinha.
  FOR v_alvo IN
    SELECT con.conrelid::regclass::text AS tbl, att.attname::text AS col
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class cr ON cr.oid = con.conrelid
      JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
     WHERE con.contype = 'f'
       AND con.confrelid = 'auth.users'::regclass
       AND cardinality(con.conkey) = 1
       AND cr.relnamespace = 'public'::regnamespace
       AND cr.relname NOT IN ('portal_pacientes', 'pacientes', 'assinaturas', 'uso_ia_mensal')
     ORDER BY 1, 2
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE %I = $1)', v_alvo.tbl, v_alvo.col) INTO v_tem USING v_uid;
    IF v_tem THEN
      RAISE EXCEPTION 'conta_de_profissional';
    END IF;
  END LOOP;

  IF NOT (
    coalesce(v_meta ->> 'is_patient', '') = 'true'
    OR EXISTS (SELECT 1 FROM public.portal_pacientes pp WHERE pp.user_id = v_uid)
    OR EXISTS (SELECT 1 FROM public.pacientes pc WHERE pc.user_id = v_uid)
  ) THEN
    RAISE EXCEPTION 'conta_nao_e_de_cliente';
  END IF;

  -- Plano premium ativo some junto com a conta e os dias pagos não voltam: só segue com aceite explícito.
  v_premium := EXISTS (SELECT 1 FROM public.pacientes pa WHERE pa.user_id = v_uid AND pa.tipo_conta = 'wellness_premium')
    OR EXISTS (
      SELECT 1 FROM public.wellness_assinaturas w
        JOIN public.pacientes pa ON pa.id = w.paciente_id
       WHERE pa.user_id = v_uid AND w.status = 'ativa'
    );
  IF v_premium AND NOT coalesce(p_aceita_perder_premium, false) THEN
    RAISE EXCEPTION 'premium_requer_aceite';
  END IF;

  -- Reautenticação: quem tem senha confirma a senha; quem entrou só pelo Google precisa ter feito login agora.
  IF coalesce(v_hash, '') <> '' THEN
    IF coalesce(p_senha, '') = '' THEN
      RAISE EXCEPTION 'senha_obrigatoria';
    END IF;

    SELECT t.bloqueado_ate, t.falhas, t.ultima_falha_em
      INTO v_bloqueado_ate, v_falhas, v_ultima_falha
      FROM public.exclusoes_conta_cliente_tentativas t
     WHERE t.user_id = v_uid;
    IF v_bloqueado_ate IS NOT NULL AND v_bloqueado_ate > now() THEN
      RAISE EXCEPTION 'muitas_tentativas';
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
      IF v_ultima_falha IS NULL OR v_ultima_falha < now() - interval '15 minutes' THEN
        v_falhas := 1;
      ELSE
        v_falhas := v_falhas + 1;
      END IF;
      INSERT INTO public.exclusoes_conta_cliente_tentativas (user_id, falhas, ultima_falha_em, bloqueado_ate)
      VALUES (v_uid, v_falhas, now(), CASE WHEN v_falhas >= 5 THEN now() + interval '15 minutes' END)
      ON CONFLICT (user_id) DO UPDATE
        SET falhas = EXCLUDED.falhas,
            ultima_falha_em = EXCLUDED.ultima_falha_em,
            bloqueado_ate = EXCLUDED.bloqueado_ate;
      RETURN jsonb_build_object('ok', false, 'erro', 'senha_incorreta', 'tentativas_restantes', greatest(0, 5 - v_falhas));
    END IF;
  ELSIF v_ultimo_login IS NULL OR v_ultimo_login < now() - interval '10 minutes' THEN
    RAISE EXCEPTION 'reautenticar';
  END IF;

  BEGIN
    -- Trava as fichas do cliente antes de decidir o que fazer com cada uma. Se um profissional estiver
    -- vinculando o cliente neste instante, ele termina primeiro e a classificação abaixo já enxerga isso;
    -- sem a trava, o histórico do profissional seria apagado como se fosse autocadastro.
    PERFORM 1 FROM public.pacientes pa WHERE pa.user_id = v_uid ORDER BY pa.id FOR UPDATE;

    -- Cadastro com profissional: o registro clínico fica com ele, só perde o login do cliente. O link antigo
    -- do portal morre e a ficha não religa sozinha por e-mail (vinculo_encerrado_em). A foto do próprio
    -- cliente é apagada do Storage pela interface, então a referência a ela também sai.
    UPDATE public.pacientes
       SET user_id = NULL,
           portal_token = NULL,
           vinculo_encerrado_em = now(),
           avatar_url = CASE WHEN avatar_url LIKE '%/paciente-avatars/' || v_uid::text || '/%' THEN NULL ELSE avatar_url END
     WHERE user_id = v_uid
       AND terapeuta_id IS NOT NULL;
    GET DIAGNOSTICS v_desvinculados = ROW_COUNT;

    DELETE FROM public.solicitacoes_conexao WHERE paciente_user_id = v_uid;
    DELETE FROM public.layout_config_usuario WHERE user_id = v_uid;
    DELETE FROM public.exclusoes_conta_cliente_tentativas WHERE user_id = v_uid;

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
      GET DIAGNOSTICS v_linhas = ROW_COUNT;
      IF v_linhas <> cardinality(v_autonomos) THEN
        RAISE EXCEPTION 'cadastro_alterado_durante_exclusao';
      END IF;
    END IF;

    IF v_premium THEN
      v_obs := array_append(v_obs, 'premium_ativo');
    END IF;

    DELETE FROM public.portal_pacientes WHERE user_id = v_uid;

    -- storage.objects.owner pode ter chave estrangeira para auth.users: a foto enviada pelo próprio cliente
    -- travaria o DELETE abaixo. Soltar o dono não apaga o arquivo (a interface o remove logo depois, e a
    -- policy de remoção olha a pasta, não o dono).
    IF pg_catalog.to_regclass('storage.objects') IS NOT NULL THEN
      BEGIN
        EXECUTE 'UPDATE storage.objects SET owner = NULL WHERE owner = $1' USING v_uid;
      EXCEPTION WHEN OTHERS THEN
        -- Sem permissão ou sem a coluna (versões do Storage): segue; se a chave existir de fato, o DELETE
        -- de auth.users abaixo acusa e a exclusão inteira é desfeita.
        NULL;
      END;
    END IF;

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
    -- mensagem estável. O bloco desfaz o que foi feito antes do erro. CPF legado inválido na ficha
    -- (22023) é o único erro interno com saída para o cliente: o profissional corrige o CPF.
    RAISE WARNING 'excluir_minha_conta_cliente: % (%)', SQLERRM, SQLSTATE;
    IF SQLSTATE = '22023' AND SQLERRM ILIKE 'CPF%' THEN
      RAISE EXCEPTION 'cadastro_precisa_correcao' USING DETAIL = SQLSTATE;
    END IF;
    RAISE EXCEPTION 'falha_ao_excluir' USING DETAIL = SQLSTATE;
  END;

  RETURN jsonb_build_object('ok', true, 'pacientes_desvinculados', v_desvinculados);
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_minha_conta_cliente(text, text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.excluir_minha_conta_cliente(text, text, boolean) TO authenticated;

COMMENT ON FUNCTION public.excluir_minha_conta_cliente(text, text, boolean) IS
  'Exclui a conta de CLIENTE de quem chama (auth.uid()). Confirmação EXCLUIR + senha (ou login Google recente) + aceite se houver premium ativo. Profissional nunca. Senha errada devolve {ok:false, erro:senha_incorreta}; 5 erros bloqueiam 15 min. Erros: nao_autenticado, confirmacao_invalida, tente_novamente, conta_de_profissional, conta_nao_e_de_cliente, premium_requer_aceite, senha_obrigatoria, muitas_tentativas, reautenticar, cadastro_precisa_correcao, falha_ao_excluir.';
