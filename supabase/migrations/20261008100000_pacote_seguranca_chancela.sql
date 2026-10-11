-- PACOTE DE SEGURANÇA DA CHANCELA (decisões do Rafael, 08/10/2026; docs/fluxo-cliente-e-tiers.md).
--
-- Fecha as pendências da chancela do plano do cliente Premium (20261008000000):
--  1. VERIFICAÇÃO do profissional, concedida só pelo super-admin (profiles.verificado). A escolha
--     da profissão (perfil_profissional_confirmado) é autoatendida e NÃO prova nada.
--  2. ÁREAS por revisor (profiles.equipe_areas), também só do super-admin.
--  3. Nutrição Premium DESLIGADA por padrão (tabela plano_cliente_config).
--  4. Revisão de segurança OBRIGATÓRIA para chancelar; sem ela (IA fora do ar) só com justificativa.
--  5. PRAZO em dias úteis, status 'cancelado', pedido vencido pode ser substituído.
--  6. AUTOCHANCELA do super-admin só enquanto não houver outro revisor verificado.
--  7. Revisão parcial da IA (plano grande demais) não vale como revisão completa; teto de pedidos do cliente
--     por tipo em 24 horas (cancelar não vira geração ilimitada); aviso ao cliente sempre pela conta da marca,
--     com uma única reserva por plano; funções de data só executáveis pelo banco.
-- Idempotente: pode rodar várias vezes. Não apaga tabelas, colunas, funções nem dados; a única remoção é
-- a da regra de status antiga da tabela (constraint), que sai depois de a nova entrar (seção 4).

-- ── 1. Verificação e áreas no perfil ─────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS registro_profissional text,
  ADD COLUMN IF NOT EXISTS verificado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS verificado_por uuid,
  ADD COLUMN IF NOT EXISTS equipe_areas text[] NOT NULL DEFAULT '{}';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.profiles'::regclass AND conname = 'profiles_equipe_areas_validas') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_equipe_areas_validas
      CHECK (equipe_areas <@ ARRAY['treino', 'nutricao']::text[]);
  END IF;
END $$;

-- Histórico de verificações (quem, quando, qual registro, por quê). Só as funções abaixo escrevem.
CREATE TABLE IF NOT EXISTS public.profissional_verificacao_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  verificado boolean NOT NULL,
  registro text,
  nota text,
  por_user_id uuid,
  origem text NOT NULL DEFAULT 'admin',
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profissional_verificacao_log_user_idx
  ON public.profissional_verificacao_log (user_id, criado_em DESC);
ALTER TABLE public.profissional_verificacao_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profissional_verificacao_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.profissional_verificacao_log TO service_role;

-- Só o super-admin (ou o service_role/SQL, sem sessão) muda verificado, verificado_em, verificado_por
-- e equipe_areas; qualquer outro UPDATE/INSERT que tente mexer neles é revertido em silêncio (não
-- derruba o salvamento do perfil inteiro). O usuário edita o próprio registro, mas trocar o registro
-- ou a profissão de quem já estava verificado derruba a verificação (ela valia para aquele registro) e,
-- junto, a vaga na equipe científica: equipe_cientifica implica verificado.
CREATE OR REPLACE FUNCTION public.profiles_protege_verificacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_antigo text; v_novo text;
BEGIN
  IF auth.uid() IS NULL OR public.eh_super_admin() THEN RETURN NEW; END IF;
  v_novo := nullif(left(btrim(coalesce(NEW.registro_profissional, '')), 40), '');
  IF TG_OP = 'INSERT' THEN
    NEW.registro_profissional := v_novo;
    NEW.verificado := false;
    NEW.verificado_em := NULL;
    NEW.verificado_por := NULL;
    NEW.equipe_areas := '{}';
    RETURN NEW;
  END IF;
  v_antigo := nullif(left(btrim(coalesce(OLD.registro_profissional, '')), 40), '');
  IF NEW.registro_profissional IS DISTINCT FROM OLD.registro_profissional THEN
    NEW.registro_profissional := v_novo;
  END IF;
  NEW.verificado := OLD.verificado;
  NEW.verificado_em := OLD.verificado_em;
  NEW.verificado_por := OLD.verificado_por;
  NEW.equipe_areas := OLD.equipe_areas;
  IF OLD.verificado AND (v_novo IS DISTINCT FROM v_antigo
                         OR NEW.perfil_profissional IS DISTINCT FROM OLD.perfil_profissional) THEN
    NEW.verificado := false;
    NEW.verificado_em := NULL;
    NEW.verificado_por := NULL;
    NEW.equipe_cientifica := false;
    NEW.equipe_areas := '{}';
    INSERT INTO public.profissional_verificacao_log (user_id, verificado, registro, nota, por_user_id, origem)
    VALUES (NEW.user_id, false, OLD.registro_profissional,
            'Verificação revogada: registro ou profissão alterados pelo próprio usuário.', auth.uid(), 'automatico');
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE TRIGGER trg_profiles_protege_verificacao
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_protege_verificacao();

-- A conta do dono do produto entra verificada e com as duas áreas.
UPDATE public.profiles SET verificado = true, verificado_em = now(), verificado_por = user_id
 WHERE NOT verificado
   AND user_id IN (SELECT id FROM auth.users WHERE lower(email) = 'rafaelbmocbel@gmail.com');

INSERT INTO public.profissional_verificacao_log (user_id, verificado, registro, nota, por_user_id, origem)
SELECT p.user_id, true, p.registro_profissional, 'Conta do administrador verificada pela migração.', p.user_id, 'migracao'
  FROM public.profiles p
 WHERE p.verificado
   AND p.user_id IN (SELECT id FROM auth.users WHERE lower(email) = 'rafaelbmocbel@gmail.com')
   AND NOT EXISTS (SELECT 1 FROM public.profissional_verificacao_log l WHERE l.user_id = p.user_id AND l.origem = 'migracao');

-- Quem já estava na equipe antes desta migração (designado pelo atalho antigo, sem verificação) perde a vaga:
-- equipe_cientifica implica verificado, e a verificação só começa agora. Ninguém é verificado aqui (o
-- administrador confere o registro e verifica na tela de administração, depois designa de novo); fila,
-- leitura e edição da tabela do cliente deixam de valer para quem não foi verificado. Fica registrado no log.
WITH revogados AS (
  UPDATE public.profiles SET equipe_cientifica = false, equipe_areas = '{}'
   WHERE equipe_cientifica AND NOT verificado
  RETURNING user_id, registro_profissional
)
INSERT INTO public.profissional_verificacao_log (user_id, verificado, registro, nota, por_user_id, origem)
SELECT user_id, false, registro_profissional,
       'Equipe científica revogada pela migração: perfil ainda não verificado pela administração.', NULL, 'migracao'
  FROM revogados;

UPDATE public.profiles SET equipe_cientifica = true, equipe_areas = ARRAY['treino', 'nutricao']
 WHERE equipe_areas = '{}'
   AND user_id IN (SELECT id FROM auth.users WHERE lower(email) = 'rafaelbmocbel@gmail.com');

-- ── 2. Configuração do plano do cliente (nutrição desligada, prazo) ──────────

CREATE TABLE IF NOT EXISTS public.plano_cliente_config (
  chave text PRIMARY KEY,
  valor jsonb NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);

ALTER TABLE public.plano_cliente_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                  AND tablename = 'plano_cliente_config' AND policyname = 'plano_cliente_config_select') THEN
    CREATE POLICY plano_cliente_config_select ON public.plano_cliente_config
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

REVOKE ALL ON public.plano_cliente_config FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.plano_cliente_config TO authenticated;
GRANT ALL ON public.plano_cliente_config TO service_role;

INSERT INTO public.plano_cliente_config (chave, valor) VALUES
  ('nutricao_premium_ativa', 'false'::jsonb),
  ('prazo_chancela_dias_uteis', '2'::jsonb)
ON CONFLICT (chave) DO NOTHING;

-- Leitura tolerante: linha ausente ou valor de tipo errado cai no padrão seguro.
CREATE OR REPLACE FUNCTION public.plano_cliente_cfg_bool(p_chave text, p_padrao boolean)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT CASE WHEN jsonb_typeof(valor) = 'boolean' THEN (valor #>> '{}')::boolean END
                     FROM public.plano_cliente_config WHERE chave = p_chave), p_padrao);
$$;

CREATE OR REPLACE FUNCTION public.plano_cliente_prazo_dias()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT CASE WHEN jsonb_typeof(valor) = 'number' THEN
                                 CASE WHEN (valor #>> '{}') ~ '^[0-9]{1,2}$' AND (valor #>> '{}')::integer BETWEEN 1 AND 10
                                      THEN (valor #>> '{}')::integer END
                          END
                     FROM public.plano_cliente_config WHERE chave = 'prazo_chancela_dias_uteis'), 2);
$$;

CREATE OR REPLACE FUNCTION public.plano_cliente_config()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'nutricao_premium_ativa', public.plano_cliente_cfg_bool('nutricao_premium_ativa', false),
    'prazo_chancela_dias_uteis', public.plano_cliente_prazo_dias());
$$;

CREATE OR REPLACE FUNCTION public.definir_config_plano_cliente(p_chave text, p_valor jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.eh_super_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador MyHealthID' USING ERRCODE = '42501';
  END IF;
  IF p_chave = 'nutricao_premium_ativa' THEN
    IF jsonb_typeof(p_valor) IS DISTINCT FROM 'boolean' THEN
      RAISE EXCEPTION 'Valor inválido para nutricao_premium_ativa: use verdadeiro ou falso.' USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_chave = 'prazo_chancela_dias_uteis' THEN
    IF jsonb_typeof(p_valor) IS DISTINCT FROM 'number'
       OR (p_valor #>> '{}') !~ '^[0-9]{1,2}$' OR (p_valor #>> '{}')::integer NOT BETWEEN 1 AND 10 THEN
      RAISE EXCEPTION 'Valor inválido para prazo_chancela_dias_uteis: use um número inteiro de 1 a 10.' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    RAISE EXCEPTION 'Configuração desconhecida: %', p_chave USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.plano_cliente_config (chave, valor, atualizado_em, atualizado_por)
  VALUES (p_chave, p_valor, now(), auth.uid())
  ON CONFLICT (chave) DO UPDATE
    SET valor = EXCLUDED.valor, atualizado_em = now(), atualizado_por = auth.uid();
END; $$;

-- ── 3. Dias úteis e prazo da chancela ────────────────────────────────────────

-- Dias úteis (seg-sex, sem feriados, calendário de Brasília) no intervalo (dia de a, dia de b]:
-- o dia em que a fila começou não conta; o dia de b conta se for útil. Sexta -> segunda = 1.
-- Só as funções do banco a chamam (nenhum usuário tem EXECUTE); mesmo assim o intervalo é limitado a 10 anos
-- para uma data absurda nunca virar uma varredura de milhões de dias.
CREATE OR REPLACE FUNCTION public.dias_uteis_entre(a timestamptz, b timestamptz)
RETURNS integer LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN a IS NULL OR b IS NULL THEN NULL ELSE
    (SELECT count(*)::integer
       FROM generate_series(((timezone('America/Sao_Paulo', a))::date + 1)::timestamp,
                            LEAST((timezone('America/Sao_Paulo', b))::date,
                                  (timezone('America/Sao_Paulo', a))::date + 3650)::timestamp, interval '1 day') d
      WHERE extract(isodow FROM d) < 6)
  END;
$$;

-- Fim (23:59:59 de Brasília) do N-ésimo dia útil depois do dia em que o pedido foi gerado. O prazo
-- configurável vai de 1 a 10 dias úteis; fora disso não há prazo (NULL).
CREATE OR REPLACE FUNCTION public.plano_cliente_prazo_ate(p_gerado_em timestamptz, p_dias integer)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN p_gerado_em IS NULL OR p_dias IS NULL OR p_dias < 1 OR p_dias > 10 THEN NULL ELSE
    (SELECT (s.d + time '23:59:59') AT TIME ZONE 'America/Sao_Paulo'
       FROM (SELECT d, row_number() OVER (ORDER BY d) AS n
               FROM generate_series(((timezone('America/Sao_Paulo', p_gerado_em))::date + 1)::timestamp,
                                    ((timezone('America/Sao_Paulo', p_gerado_em))::date + (p_dias * 2 + 4))::timestamp,
                                    interval '1 day') d
              WHERE extract(isodow FROM d) < 6) s
      WHERE s.n = p_dias)
  END;
$$;

CREATE OR REPLACE FUNCTION public.plano_cliente_atrasado(p_gerado_em timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(now() > public.plano_cliente_prazo_ate(p_gerado_em, public.plano_cliente_prazo_dias()), false);
$$;

-- ── 4. Status 'cancelado' ────────────────────────────────────────────────────

-- Entra a regra nova antes de sair a antiga, para a tabela nunca ficar sem verificação de status.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.plano_cliente_chancela'::regclass AND conname = 'plano_cliente_chancela_status_v2') THEN
    ALTER TABLE public.plano_cliente_chancela ADD CONSTRAINT plano_cliente_chancela_status_v2
      CHECK (status IN ('aguardando', 'chancelado', 'recusado', 'substituido', 'cancelado'));
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conrelid = 'public.plano_cliente_chancela'::regclass AND conname = 'plano_cliente_chancela_status_check') THEN
    ALTER TABLE public.plano_cliente_chancela DROP CONSTRAINT plano_cliente_chancela_status_check;
  END IF;
END $$;

-- ── 5. Quem pode revisar (verificação + área + perfil + conflito) ────────────

-- Editar o plano na fila exige o mesmo que chancelar: equipe, verificado, área habilitada e perfil
-- da área (o super-admin cobre qualquer área).
CREATE OR REPLACE FUNCTION public.equipe_cobre_area(p_tipo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.eh_equipe_cientifica() AND (
    public.eh_super_admin()
    OR coalesce((SELECT p.verificado
                        AND p_tipo = ANY (p.equipe_areas)
                        AND public.plano_cliente_perfil_ok(p_tipo, p.perfil_profissional::text)
                   FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), false));
$$;

CREATE OR REPLACE FUNCTION public.plano_cliente_chancela_guarda()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF jsonb_typeof(NEW.conteudo) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'O conteúdo do plano precisa ser um objeto.' USING ERRCODE = 'P0001';
  END IF;
  NEW.conteudo := (NEW.conteudo - '_governanca')
    || CASE WHEN jsonb_typeof(OLD.conteudo -> '_governanca') = 'object'
            THEN jsonb_build_object('_governanca', OLD.conteudo -> '_governanca') ELSE '{}'::jsonb END;
  IF NEW.conteudo IS DISTINCT FROM OLD.conteudo OR NEW.titulo IS DISTINCT FROM OLD.titulo THEN
    IF OLD.status IS DISTINCT FROM 'aguardando' THEN
      RAISE EXCEPTION 'Só um plano aguardando chancela pode ser editado.' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.equipe_cobre_area(OLD.tipo) THEN
      RAISE EXCEPTION 'Você não está habilitado(a) (verificação, área e perfil) para editar este plano de %.',
        CASE OLD.tipo WHEN 'treino' THEN 'treino' ELSE 'nutrição' END USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.plano_cliente_eh_propria_conta(p_paciente_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.pacientes WHERE id = p_paciente_id AND user_id = auth.uid());
$$;

-- Existe outro membro da equipe científica verificado? Enquanto não existir, o super-admin pode
-- chancelar o plano da própria conta (exceção de teste); depois, a exceção some sozinha.
CREATE OR REPLACE FUNCTION public.plano_cliente_ha_outro_revisor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
                  WHERE user_id IS DISTINCT FROM auth.uid() AND equipe_cientifica AND verificado);
$$;

-- Conflito de interesse na RECUSA: ninguém recusa o plano gerado para a própria conta. O super-admin
-- pode (recusar é o lado seguro). A chancela passa por plano_cliente_motivo_bloqueio.
CREATE OR REPLACE FUNCTION public.plano_cliente_checa_conflito(p_paciente_id uuid, p_acao text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.plano_cliente_eh_propria_conta(p_paciente_id) THEN RETURN; END IF;
  IF public.eh_super_admin() THEN RETURN; END IF;
  RAISE EXCEPTION 'Você não pode % o plano gerado para a sua própria conta: outro membro da equipe científica precisa revisá-lo.', p_acao
    USING ERRCODE = '42501', HINT = 'conflito_interesse';
END; $$;

-- Por que o usuário atual NÃO pode chancelar este plano (NULL = pode). Fonte única da RPC de
-- chancela e da fila: {codigo, mensagem, curto}. A ordem é a que o usuário resolve primeiro.
CREATE OR REPLACE FUNCTION public.plano_cliente_motivo_bloqueio(p_tipo text, p_paciente_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prof public.profiles%ROWTYPE;
  v_super boolean;
  v_rotulo text;
  v_exigido text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.eh_equipe_cientifica() THEN
    RETURN jsonb_build_object('codigo', 'sem_permissao_area',
      'mensagem', 'Só a equipe científica MyHealthID pode chancelar planos.',
      'curto', 'Fora da equipe científica');
  END IF;
  v_super := public.eh_super_admin();
  v_rotulo := CASE p_tipo WHEN 'treino' THEN 'treino' ELSE 'nutrição' END;
  v_exigido := CASE p_tipo WHEN 'treino' THEN 'Educador Físico ou Fisioterapeuta' ELSE 'Nutricionista' END;

  IF p_tipo = 'nutricao' AND NOT public.plano_cliente_cfg_bool('nutricao_premium_ativa', false) THEN
    RETURN jsonb_build_object('codigo', 'nutricao_desligada',
      'mensagem', 'O plano nutricional Premium está desligado: enquanto isso nenhum plano de nutrição é chancelado.',
      'curto', 'Nutrição Premium desligada');
  END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF NOT v_super THEN
    IF NOT coalesce(v_prof.verificado, false) THEN
      RETURN jsonb_build_object('codigo', 'nao_verificado',
        'mensagem', 'Seu perfil profissional ainda não foi verificado pela equipe MyHealthID.',
        'curto', 'Perfil ainda não verificado');
    END IF;
    IF NOT (p_tipo = ANY (coalesce(v_prof.equipe_areas, '{}'))) THEN
      RETURN jsonb_build_object('codigo', 'sem_permissao_area',
        'mensagem', format('Você não foi habilitado(a) pela administração para chancelar planos de %s.', v_rotulo),
        'curto', format('Sem habilitação em %s', v_rotulo));
    END IF;
    IF NOT public.plano_cliente_perfil_ok(p_tipo, v_prof.perfil_profissional::text) THEN
      RETURN jsonb_build_object('codigo', 'sem_permissao_area',
        'mensagem', format('Você não tem o perfil para chancelar %s: exige %s.', v_rotulo, v_exigido),
        'curto', format('Exige %s', v_exigido));
    END IF;
  END IF;

  IF public.plano_cliente_eh_propria_conta(p_paciente_id)
     AND NOT (v_super AND NOT public.plano_cliente_ha_outro_revisor()) THEN
    RETURN jsonb_build_object('codigo', 'conflito_interesse',
      'mensagem', 'Você não pode chancelar o plano gerado para a sua própria conta: outro membro da equipe científica precisa revisá-lo.',
      'curto', 'Plano da sua própria conta');
  END IF;
  RETURN NULL;
END; $$;

-- ── 6. Verificação e equipe: RPCs ────────────────────────────────────────────

-- O profissional informa o registro no conselho (CREF, CREFITO, CRN...). NÃO verifica.
CREATE OR REPLACE FUNCTION public.solicitar_verificacao(p_registro text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text; v_n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada: entre novamente.' USING ERRCODE = '42501';
  END IF;
  v := btrim(coalesce(p_registro, ''));
  IF length(v) < 3 OR length(v) > 40 THEN
    RAISE EXCEPTION 'Informe o registro profissional (de 3 a 40 caracteres).' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.profiles SET registro_profissional = v WHERE user_id = auth.uid();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Perfil profissional não encontrado.' USING ERRCODE = 'P0001';
  END IF;
END; $$;

-- p_registro_visto: o registro que o administrador conferiu na tela. Enquanto o profissional ainda não está
-- verificado ele pode trocar o registro à vontade; se o registro gravado agora não for o que foi conferido,
-- a verificação não acontece (a tela recarrega e o administrador confere o registro novo). Nulo = sem a
-- conferência (chamada direta pelo SQL).
CREATE OR REPLACE FUNCTION public.verificar_profissional(
  p_user_id uuid, p_verificado boolean, p_nota text DEFAULT NULL, p_registro_visto text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_registro text; v_existe boolean; v_visto text;
BEGIN
  IF NOT public.eh_super_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador MyHealthID' USING ERRCODE = '42501';
  END IF;
  SELECT true, registro_profissional INTO v_existe, v_registro FROM public.profiles WHERE user_id = p_user_id FOR UPDATE;
  IF v_existe IS NOT TRUE THEN
    RAISE EXCEPTION 'Profissional não encontrado.' USING ERRCODE = 'P0001';
  END IF;
  IF coalesce(p_verificado, false) THEN
    IF v_registro IS NULL THEN
      RAISE EXCEPTION 'O profissional ainda não informou o registro profissional: peça para ele enviar o registro antes de verificar.'
        USING ERRCODE = 'P0001';
    END IF;
    v_visto := nullif(btrim(coalesce(p_registro_visto, '')), '');
    IF p_registro_visto IS NOT NULL AND v_visto IS DISTINCT FROM btrim(v_registro) THEN
      RAISE EXCEPTION 'O registro profissional mudou desde que você abriu o cartão: recarregue a lista e confira o registro novo antes de verificar.'
        USING ERRCODE = 'P0001', HINT = 'registro_alterado';
    END IF;
    UPDATE public.profiles SET verificado = true, verificado_em = now(), verificado_por = auth.uid()
     WHERE user_id = p_user_id;
  ELSE
    UPDATE public.profiles
       SET verificado = false, verificado_em = NULL, verificado_por = NULL,
           equipe_cientifica = false, equipe_areas = '{}'
     WHERE user_id = p_user_id;
  END IF;
  INSERT INTO public.profissional_verificacao_log (user_id, verificado, registro, nota, por_user_id, origem)
  VALUES (p_user_id, coalesce(p_verificado, false), v_registro,
          left(nullif(btrim(coalesce(p_nota, '')), ''), 500), auth.uid(), 'admin');
END; $$;

CREATE OR REPLACE FUNCTION public.profissionais_admin()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_out jsonb;
BEGIN
  IF NOT public.eh_super_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador MyHealthID' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(jsonb_agg(q.item ORDER BY q.verificado, q.sem_registro, q.criado DESC, q.uid), '[]'::jsonb) INTO v_out
  FROM (
    SELECT p.user_id AS uid, p.verificado, (p.registro_profissional IS NULL) AS sem_registro, p.created_at AS criado,
           jsonb_build_object(
             'user_id', p.user_id, 'nome', p.nome, 'sobrenome', p.sobrenome,
             'email', coalesce(u.email, nullif(btrim(p.email), '')),
             'perfil_profissional', p.perfil_profissional,
             'registro_profissional', p.registro_profissional,
             'verificado', p.verificado, 'verificado_em', p.verificado_em,
             'equipe_cientifica', p.equipe_cientifica, 'equipe_areas', to_jsonb(p.equipe_areas),
             'created_at', p.created_at) AS item
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.user_id
  ) q;
  RETURN v_out;
END; $$;

-- Designa (ou retira) alguém da equipe, com as áreas em que ele revisa. Ativar exige o alvo
-- verificado. Super-admin; sem sessão (service_role/SQL) também vale.
CREATE OR REPLACE FUNCTION public.definir_equipe_cientifica(p_email text, p_ativo boolean, p_areas text[] DEFAULT '{}')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid; v_areas text[]; v_verificado boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.eh_super_admin() THEN
    RAISE EXCEPTION 'Apenas o administrador MyHealthID' USING ERRCODE = '42501';
  END IF;
  IF p_ativo IS NULL THEN
    RAISE EXCEPTION 'Informe se o profissional entra (verdadeiro) ou sai (falso) da equipe científica.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(p_areas, '{}')) a WHERE a IS NULL OR a NOT IN ('treino', 'nutricao')) THEN
    RAISE EXCEPTION 'Áreas inválidas: use treino e/ou nutricao.' USING ERRCODE = 'P0001';
  END IF;
  v_areas := coalesce((SELECT array_agg(DISTINCT a ORDER BY a) FROM unnest(coalesce(p_areas, '{}')) a), '{}');

  SELECT p.user_id, p.verificado INTO v_uid, v_verificado
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
   WHERE lower(u.email) = lower(btrim(coalesce(p_email, '')))
   LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Profissional não encontrado para o e-mail informado.' USING ERRCODE = 'P0001';
  END IF;

  IF p_ativo THEN
    IF NOT v_verificado THEN
      RAISE EXCEPTION 'O profissional precisa estar verificado antes de entrar na equipe científica.'
        USING ERRCODE = 'P0001', HINT = 'nao_verificado';
    END IF;
    UPDATE public.profiles SET equipe_cientifica = true, equipe_areas = v_areas WHERE user_id = v_uid;
  ELSE
    UPDATE public.profiles SET equipe_cientifica = false, equipe_areas = '{}' WHERE user_id = v_uid;
  END IF;
END; $$;

-- A assinatura antiga (e-mail, booleano) devolvia boolean e não conhecia áreas. Em vez de apagá-la, ela
-- vira um atalho que delega para a nova com as áreas que o perfil do alvo cobre (treino: educador físico ou
-- fisioterapeuta; nutrição: nutricionista), então a permissão continua sendo a da função nova. Chamada
-- POSICIONAL de 2 argumentos fica ambígua entre as duas: passe as áreas (3 argumentos) ou nomeie p_ativo.
CREATE OR REPLACE FUNCTION public.definir_equipe_cientifica(p_email text, p_valor boolean DEFAULT true)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_areas text[];
BEGIN
  SELECT coalesce(array_agg(a.area ORDER BY a.area), '{}') INTO v_areas
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
   CROSS JOIN (VALUES ('treino'), ('nutricao')) AS a(area)
   WHERE lower(u.email) = lower(btrim(coalesce(p_email, '')))
     AND public.plano_cliente_perfil_ok(a.area, p.perfil_profissional::text);
  PERFORM public.definir_equipe_cientifica(p_email, coalesce(p_valor, true), v_areas);
  RETURN true;
END; $$;

-- ── 7. Gravação do pedido do cliente: pedido vencido pode ser substituído ────

-- Teto de pedidos do cliente por tipo de plano em 24 horas, contando TODOS (decididos, cancelados e
-- substituídos): cada pedido custa uma chamada de IA e entra na fila da equipe, e cancelar o pedido
-- libera o seguinte na hora. Valor operacional provisório (não é clínico); mudar exige nova migration.
CREATE OR REPLACE FUNCTION public.plano_cliente_limite_pedidos_24h()
RETURNS integer LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 3;
$$;

CREATE OR REPLACE FUNCTION public.plano_cliente_pedidos_24h(p_paciente_id uuid, p_tipo text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer FROM public.plano_cliente_chancela
   WHERE paciente_id = p_paciente_id AND tipo = p_tipo AND gerado_em > now() - interval '24 hours';
$$;

CREATE OR REPLACE FUNCTION public.registrar_plano_cliente_chancela(
  p_paciente_id uuid, p_tipo text, p_titulo text, p_objetivo text, p_conteudo jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_antigo public.plano_cliente_chancela%ROWTYPE;
BEGIN
  IF p_tipo IS NULL OR p_tipo NOT IN ('treino', 'nutricao') THEN
    RAISE EXCEPTION 'Tipo de plano inválido: %', p_tipo;
  END IF;
  IF jsonb_typeof(p_conteudo) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Conteúdo do plano inválido.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_paciente_id::text || ':' || p_tipo, 0));
  SELECT * INTO v_antigo FROM public.plano_cliente_chancela
   WHERE paciente_id = p_paciente_id AND tipo = p_tipo AND status = 'aguardando'
   FOR UPDATE;
  IF FOUND THEN
    -- Enquanto está no prazo, o pedido na fila não sai de baixo das mãos do revisor; estourado o prazo
    -- da equipe, o cliente pode pedir de novo e o pedido parado vira 'substituido'.
    IF NOT public.plano_cliente_atrasado(v_antigo.gerado_em) THEN
      RAISE EXCEPTION 'plano_em_revisao: já existe um plano deste tipo aguardando a equipe científica.'
        USING ERRCODE = 'P0001', HINT = 'plano_em_revisao';
    END IF;
  END IF;
  IF public.plano_cliente_pedidos_24h(p_paciente_id, p_tipo) >= public.plano_cliente_limite_pedidos_24h() THEN
    RAISE EXCEPTION 'limite_pedidos: o cliente já fez pedidos demais deste tipo de plano nas últimas 24 horas.'
      USING ERRCODE = 'P0001', HINT = 'limite_pedidos';
  END IF;
  IF v_antigo.id IS NOT NULL THEN
    UPDATE public.plano_cliente_chancela SET status = 'substituido' WHERE id = v_antigo.id;
  END IF;
  INSERT INTO public.plano_cliente_chancela (paciente_id, tipo, titulo, objetivo, conteudo)
  VALUES (p_paciente_id, p_tipo,
          coalesce(nullif(btrim(p_titulo), ''), nullif(btrim(p_conteudo ->> 'titulo'), '')),
          nullif(btrim(p_objetivo), ''), p_conteudo)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- Para as edges (service_role) decidirem ANTES de gastar IA: 'nenhum' | 'no_prazo' | 'atrasado' | 'limite'.
-- 'limite' = não há pedido no prazo, mas o teto de pedidos em 24 horas já foi atingido.
CREATE OR REPLACE FUNCTION public.plano_cliente_estado_pedido(p_paciente_id uuid, p_tipo text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gerado timestamptz; v_estado text := 'nenhum';
BEGIN
  SELECT gerado_em INTO v_gerado FROM public.plano_cliente_chancela
   WHERE paciente_id = p_paciente_id AND tipo = p_tipo AND status = 'aguardando' LIMIT 1;
  IF FOUND THEN
    IF NOT public.plano_cliente_atrasado(v_gerado) THEN RETURN 'no_prazo'; END IF;
    v_estado := 'atrasado';
  END IF;
  IF public.plano_cliente_pedidos_24h(p_paciente_id, p_tipo) >= public.plano_cliente_limite_pedidos_24h() THEN
    RETURN 'limite';
  END IF;
  RETURN v_estado;
END; $$;

-- Caminho PROFISSIONAL das edges de geração (gerar-plano-treino/alimentar): só gera quem foi verificado
-- pelo administrador; a conta do próprio administrador (pelo e-mail) sempre vale. Só o servidor chama.
CREATE OR REPLACE FUNCTION public.profissional_verificado(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT lower(u.email) = 'rafaelbmocbel@gmail.com' FROM auth.users u WHERE u.id = p_user_id), false)
      OR coalesce((SELECT p.verificado FROM public.profiles p WHERE p.user_id = p_user_id LIMIT 1), false);
$$;

-- Conta que envia o aviso ao cliente: SEMPRE a conta da marca (administrador), nunca o profissional gravado
-- no cadastro do cliente. O cliente edita o próprio cadastro (terapeuta_id, telefone e nome sem limite de
-- coluna); se o remetente viesse dali, um cliente faria o WhatsApp de OUTRO profissional enviar mensagem.
-- O plano vem da equipe científica da marca, então o aviso também vem dela. Só o servidor chama.
CREATE OR REPLACE FUNCTION public.plano_cliente_remetente_aviso(p_paciente_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (SELECT u.id FROM auth.users u WHERE lower(u.email) = 'rafaelbmocbel@gmail.com' LIMIT 1)
   WHERE EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = p_paciente_id);
$$;

-- Uma única linha de disparo 'reservado' ou 'enviado' por plano decidido: a edge de aviso reserva a linha
-- ANTES de enviar, então chamadas paralelas (clique duplo, nova tentativa) nunca mandam a mensagem duas
-- vezes. Linha em 'erro' não bloqueia: a nova tentativa é permitida.
CREATE UNIQUE INDEX IF NOT EXISTS agente_disparos_aviso_plano_unico
  ON public.agente_disparos (gatilho, ref_id)
  WHERE gatilho IN ('plano_chancelado', 'plano_recusado') AND status IN ('reservado', 'enviado');

-- ── 8. Leitura do cliente: status com prazo; cancelar o próprio pedido ───────

-- Parte do plano que o paciente pode ver; a autochancela aparece no selo.
CREATE OR REPLACE FUNCTION public.gov_publico(p_conteudo jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN jsonb_typeof(p_conteudo) = 'object' THEN
    (p_conteudo - '_governanca') || jsonb_build_object('_governanca', jsonb_strip_nulls(jsonb_build_object(
      'versao_plano', p_conteudo -> '_governanca' -> 'versao_plano',
      'aprovacao', jsonb_strip_nulls(jsonb_build_object(
        'por_perfil', p_conteudo -> '_governanca' -> 'aprovacao' -> 'por_perfil',
        'por_nome', p_conteudo -> '_governanca' -> 'aprovacao' -> 'por_nome',
        'em', p_conteudo -> '_governanca' -> 'aprovacao' -> 'em',
        'versao', p_conteudo -> '_governanca' -> 'aprovacao' -> 'versao',
        'autochancela', p_conteudo -> '_governanca' -> 'aprovacao' -> 'autochancela')),
      'fonte', jsonb_strip_nulls(jsonb_build_object(
        'tipo', p_conteudo -> '_governanca' -> 'fonte' -> 'tipo',
        'modelo', p_conteudo -> '_governanca' -> 'fonte' -> 'modelo',
        'gerado_em', p_conteudo -> '_governanca' -> 'fonte' -> 'gerado_em')),
      'acompanhamento', p_conteudo -> '_governanca' -> 'acompanhamento')))
  ELSE p_conteudo END;
$$;

-- Plano liberado ao paciente: o do profissional, se houver um liberado; senão o chancelado pela equipe
-- científica (mais recente). Com a nutrição Premium desligada (nutricao_premium_ativa) nenhum plano
-- nutricional da EQUIPE chega ao cliente, inclusive os chancelados antes de ela ser desligada; o plano
-- alimentar do profissional do paciente não é afetado.
CREATE OR REPLACE FUNCTION public.meu_plano_liberado(p_tipo text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pac uuid; v_out jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_pac FROM public.pacientes WHERE user_id = auth.uid() LIMIT 1;
  IF v_pac IS NULL THEN RETURN NULL; END IF;
  IF p_tipo = 'treino' THEN
    SELECT jsonb_build_object('id', id, 'titulo', titulo, 'objetivo', objetivo,
             'created_at', created_at, 'updated_at', updated_at,
             'conteudo', public.gov_publico(estrutura), 'origem', 'profissional')
      INTO v_out FROM public.planos_treino
     WHERE paciente_id = v_pac AND ativo AND aprovado
     ORDER BY created_at DESC LIMIT 1;
  ELSIF p_tipo = 'nutricao' THEN
    SELECT jsonb_build_object('id', id, 'titulo', titulo, 'objetivo', objetivo,
             'calorias_alvo', calorias_alvo, 'created_at', created_at, 'updated_at', updated_at,
             'conteudo', public.gov_publico(plano), 'origem', 'profissional')
      INTO v_out FROM public.planos_alimentares
     WHERE paciente_id = v_pac AND ativo AND aprovado
     ORDER BY created_at DESC LIMIT 1;
  ELSE
    RAISE EXCEPTION 'Tipo de plano inválido: %', p_tipo;
  END IF;
  IF v_out IS NOT NULL THEN RETURN v_out; END IF;
  IF p_tipo = 'nutricao' AND NOT public.plano_cliente_cfg_bool('nutricao_premium_ativa', false) THEN RETURN NULL; END IF;

  SELECT jsonb_build_object('id', c.id, 'titulo', c.titulo, 'objetivo', c.objetivo,
           'created_at', c.gerado_em, 'updated_at', coalesce(c.revisado_em, c.updated_at),
           'conteudo', public.gov_publico(c.conteudo), 'origem', 'equipe_myhealthid')
         || CASE WHEN p_tipo = 'nutricao' THEN jsonb_build_object('calorias_alvo',
              CASE WHEN c.conteudo ->> 'calorias_totais' ~ '^[0-9]{3,5}([.,][0-9]+)?$'
                   THEN round(replace(c.conteudo ->> 'calorias_totais', ',', '.')::numeric)::integer END)
            ELSE '{}'::jsonb END
    INTO v_out
    FROM public.plano_cliente_chancela c
   WHERE c.paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid())
     AND c.tipo = p_tipo AND c.status = 'chancelado'
   ORDER BY c.revisado_em DESC NULLS LAST, c.gerado_em DESC LIMIT 1;
  RETURN v_out;
END; $$;

-- Situação do plano gerado pelo próprio cliente. Nunca devolve o conteúdo. pode_regenerar: o cliente
-- pode pedir outro se nada está aguardando ou se o pedido aguardando estourou o prazo da equipe.
CREATE OR REPLACE FUNCTION public.meu_status_plano_cliente(p_tipo text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.plano_cliente_chancela%ROWTYPE; v_prazo timestamptz; v_atrasado boolean := false;
BEGIN
  IF p_tipo IS NULL OR p_tipo NOT IN ('treino', 'nutricao') THEN
    RAISE EXCEPTION 'Tipo de plano inválido: %', p_tipo;
  END IF;
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO c
    FROM public.plano_cliente_chancela x
   WHERE x.paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid())
     AND x.tipo = p_tipo AND x.status <> 'substituido'
   ORDER BY x.gerado_em DESC, x.id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', NULL, 'gerado_em', NULL, 'nota_publica', NULL,
                              'prazo_previsto', NULL, 'atrasado', false, 'pode_regenerar', true);
  END IF;
  IF c.status = 'aguardando' THEN
    v_prazo := public.plano_cliente_prazo_ate(c.gerado_em, public.plano_cliente_prazo_dias());
    v_atrasado := coalesce(now() > v_prazo, false);
  END IF;
  RETURN jsonb_build_object('status', c.status, 'gerado_em', c.gerado_em, 'nota_publica', c.nota_publica,
                            'prazo_previsto', v_prazo, 'atrasado', v_atrasado,
                            'pode_regenerar', c.status <> 'aguardando' OR v_atrasado);
END; $$;

CREATE OR REPLACE FUNCTION public.cancelar_pedido_plano_cliente(p_tipo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.plano_cliente_chancela%ROWTYPE; v_n integer;
BEGIN
  IF p_tipo IS NULL OR p_tipo NOT IN ('treino', 'nutricao') THEN
    RAISE EXCEPTION 'Tipo de plano inválido: %', p_tipo;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada: entre novamente.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.plano_cliente_chancela x
   WHERE x.paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid())
     AND x.tipo = p_tipo AND x.status = 'aguardando'
   ORDER BY x.gerado_em DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Você não tem um pedido aguardando revisão para cancelar.'
      USING ERRCODE = 'P0001', HINT = 'sem_pedido_aguardando';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(r.paciente_id::text || ':' || p_tipo, 0));
  UPDATE public.plano_cliente_chancela SET status = 'cancelado' WHERE id = r.id AND status = 'aguardando';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'Este pedido já foi decidido pela equipe e não pode mais ser cancelado.'
      USING ERRCODE = 'P0001', HINT = 'pedido_ja_decidido';
  END IF;
  RETURN public.meu_status_plano_cliente(p_tipo);
END; $$;

-- ── 9. Fila e decisão da equipe científica ───────────────────────────────────

-- Só PRIMEIRO nome e idade do paciente. Por item: dias úteis na fila (até agora, ou até a decisão),
-- se o pedido aguardando estourou o prazo, e se o usuário atual pode chancelá-lo (com o motivo curto).
-- Atrasados primeiro. O histórico (não aguardando) mostra só os 50 mais recentes.
CREATE OR REPLACE FUNCTION public.fila_chancela(p_status text DEFAULT 'aguardando')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_out jsonb; v_dias integer;
BEGIN
  IF NOT public.eh_equipe_cientifica() THEN
    RAISE EXCEPTION 'Acesso restrito à equipe científica MyHealthID.' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('aguardando', 'chancelado', 'recusado', 'cancelado', 'substituido') THEN
    RAISE EXCEPTION 'Status inválido: %', p_status;
  END IF;
  v_dias := public.plano_cliente_prazo_dias();
  SELECT coalesce(jsonb_agg(q.item ORDER BY q.atrasado DESC, q.ord, q.id), '[]'::jsonb) INTO v_out FROM (
    SELECT c.id, x.atrasado,
           CASE WHEN p_status = 'aguardando' THEN extract(epoch FROM c.gerado_em)
                ELSE -extract(epoch FROM coalesce(c.revisado_em, c.updated_at, c.gerado_em)) END AS ord,
           jsonb_build_object(
             'id', c.id, 'tipo', c.tipo, 'titulo', c.titulo, 'status', c.status, 'gerado_em', c.gerado_em,
             'paciente_primeiro_nome', initcap(split_part(btrim(coalesce(p.nome, '')), ' ', 1)),
             'idade', CASE WHEN p.data_nascimento IS NULL THEN NULL
                           ELSE date_part('year', age((now() AT TIME ZONE 'America/Sao_Paulo')::date, p.data_nascimento))::integer END,
             'objetivo', c.objetivo,
             'conteudo', c.conteudo,
             'revisao_seguranca', CASE WHEN jsonb_typeof(c.conteudo #> '{_governanca,revisao_seguranca}') = 'object'
               THEN jsonb_build_object(
                      'risco_geral', c.conteudo #> '{_governanca,revisao_seguranca,risco_geral}',
                      'n_flags_altas', c.conteudo #> '{_governanca,revisao_seguranca,n_flags_altas}',
                      'hash', c.conteudo #> '{_governanca,revisao_seguranca,hash}',
                      'revisado_em', c.conteudo #> '{_governanca,revisao_seguranca,revisado_em}',
                      'plano_truncado', coalesce(c.conteudo #> '{_governanca,revisao_seguranca,plano_truncado}', 'false'::jsonb))
               END,
             'hash_atual', public.gov_hash_conteudo(c.conteudo),
             'revisor_nome', c.revisor_nome, 'revisor_perfil', c.revisor_perfil, 'revisado_em', c.revisado_em,
             'nota_publica', c.nota_publica, 'nota_interna', c.nota_interna,
             'dias_uteis_na_fila', x.dias, 'atrasado', x.atrasado,
             'pode_chancelar', x.bloqueio IS NULL, 'motivo_nao_pode', x.bloqueio ->> 'curto') AS item
      FROM public.plano_cliente_chancela c
      LEFT JOIN public.pacientes p ON p.id = c.paciente_id
     CROSS JOIN LATERAL (
       SELECT (c.status = 'aguardando' AND coalesce(now() > public.plano_cliente_prazo_ate(c.gerado_em, v_dias), false)) AS atrasado,
              public.dias_uteis_entre(c.gerado_em,
                CASE WHEN c.status = 'aguardando' THEN now() ELSE coalesce(c.revisado_em, c.updated_at) END) AS dias,
              CASE WHEN c.status = 'aguardando' THEN public.plano_cliente_motivo_bloqueio(c.tipo, c.paciente_id)
                   ELSE jsonb_build_object('codigo', 'plano_decidido', 'curto', 'Este plano já foi decidido.') END AS bloqueio
     ) x
     WHERE c.status = p_status
     ORDER BY x.atrasado DESC, 3, c.id
     LIMIT CASE WHEN p_status = 'aguardando' THEN 200 ELSE 50 END
  ) q;
  RETURN v_out;
END; $$;

-- Chancela o plano. Exige: equipe científica, perfil verificado, área habilitada, perfil da área
-- (o super-admin vale para tudo, menos nutrição desligada), sem conflito de interesse e revisão de
-- segurança do conteúdo ATUAL. Sem revisão válida (ex.: IA fora do ar) só com justificativa de 15+
-- caracteres. Risco alto continua exigindo justificativa de 15+.
CREATE OR REPLACE FUNCTION public.chancelar_plano_cliente(
  p_id uuid, p_conteudo jsonb DEFAULT NULL, p_justificativa text DEFAULT NULL, p_nota_publica text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.plano_cliente_chancela%ROWTYPE;
  v_perfil text; v_nome text; v_perfil_final text; v_bloqueio jsonb; v_auto boolean;
  v_conteudo jsonb; v_gov jsonb; v_rev jsonb; v_apr jsonb;
  v_hash text; v_just text; v_versao integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada: entre novamente para chancelar o plano.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.eh_equipe_cientifica() THEN
    RAISE EXCEPTION 'Só a equipe científica MyHealthID pode chancelar planos.'
      USING ERRCODE = '42501', HINT = 'sem_permissao_area';
  END IF;

  SELECT * INTO r FROM public.plano_cliente_chancela WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano não encontrado.'; END IF;
  IF r.status <> 'aguardando' THEN
    RAISE EXCEPTION 'Este plano não está mais aguardando chancela (situação atual: %).', r.status;
  END IF;

  v_bloqueio := public.plano_cliente_motivo_bloqueio(r.tipo, r.paciente_id);
  IF v_bloqueio IS NOT NULL THEN
    RAISE EXCEPTION '%', v_bloqueio ->> 'mensagem' USING ERRCODE = '42501', HINT = v_bloqueio ->> 'codigo';
  END IF;

  SELECT perfil_profissional::text, nullif(btrim(concat_ws(' ', nome, sobrenome)), '')
    INTO v_perfil, v_nome FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  v_perfil_final := CASE WHEN public.plano_cliente_perfil_ok(r.tipo, v_perfil) THEN v_perfil ELSE 'super_admin' END;
  v_auto := public.plano_cliente_eh_propria_conta(r.paciente_id);

  v_conteudo := r.conteudo;
  IF p_conteudo IS NOT NULL THEN
    IF jsonb_typeof(p_conteudo) <> 'object' THEN RAISE EXCEPTION 'O conteúdo do plano precisa ser um objeto.'; END IF;
    v_conteudo := (p_conteudo - '_governanca')
      || CASE WHEN jsonb_typeof(r.conteudo -> '_governanca') = 'object'
              THEN jsonb_build_object('_governanca', r.conteudo -> '_governanca') ELSE '{}'::jsonb END;
  END IF;
  v_gov := CASE WHEN jsonb_typeof(v_conteudo -> '_governanca') = 'object' THEN v_conteudo -> '_governanca' ELSE '{}'::jsonb END;

  v_hash := public.gov_hash_conteudo(v_conteudo);
  v_just := nullif(btrim(coalesce(p_justificativa, '')), '');
  v_rev := v_gov -> 'revisao_seguranca';
  SELECT 1 + count(*) INTO v_versao FROM public.plano_cliente_chancela
   WHERE paciente_id = r.paciente_id AND tipo = r.tipo AND id <> r.id
     AND jsonb_typeof(conteudo #> '{_governanca,aprovacao}') = 'object';

  v_apr := jsonb_build_object('por_user_id', auth.uid(), 'por_nome', v_nome, 'por_perfil', v_perfil_final,
                              'em', now(), 'versao', v_versao, 'hash', v_hash);
  IF v_just IS NOT NULL THEN v_apr := v_apr || jsonb_build_object('justificativa', v_just); END IF;
  IF v_auto THEN v_apr := v_apr || jsonb_build_object('autochancela', true); END IF;

  IF v_rev IS NOT NULL AND v_rev ->> 'hash' = v_hash THEN
    IF v_rev ->> 'risco_geral' = 'alto' AND coalesce(length(v_just), 0) < 15 THEN
      RAISE EXCEPTION 'Justificativa obrigatória para liberar plano de risco alto'
        USING ERRCODE = 'P0001', HINT = 'justificativa_obrigatoria';
    END IF;
    v_apr := v_apr || jsonb_build_object('risco_geral', v_rev ->> 'risco_geral');
    -- Revisão parcial (plano maior que o limite da IA: só o início foi lido) não vale como revisão completa:
    -- chancelar exige o motivo escrito, e o carimbo registra que a revisão foi parcial.
    IF v_rev ->> 'plano_truncado' = 'true' THEN
      IF coalesce(length(v_just), 0) < 15 THEN
        RAISE EXCEPTION 'Revisão de segurança parcial: o plano é longo e a IA avaliou só o início. Confira o restante e registre uma justificativa de pelo menos 15 caracteres.'
          USING ERRCODE = 'P0001', HINT = 'revisao_obrigatoria';
      END IF;
      v_apr := v_apr || jsonb_build_object('revisao_parcial', true);
    END IF;
  ELSE
    -- Editar o plano depois de uma revisão de risco alto não apaga o alerta.
    IF v_rev ->> 'risco_geral' = 'alto' THEN
      IF coalesce(length(v_just), 0) < 15 THEN
        RAISE EXCEPTION 'Justificativa obrigatória para liberar plano de risco alto: a última revisão de segurança apontou risco alto e o plano foi alterado depois dela. Rode a revisão de novo ou justifique.'
          USING ERRCODE = 'P0001', HINT = 'justificativa_obrigatoria';
      END IF;
      v_apr := v_apr || jsonb_build_object('risco_anterior_desatualizado', 'alto');
    ELSIF coalesce(length(v_just), 0) < 15 THEN
      RAISE EXCEPTION 'Revisão de segurança obrigatória: rode a revisão do conteúdo atual do plano ou, se ela não estiver disponível, registre uma justificativa de pelo menos 15 caracteres.'
        USING ERRCODE = 'P0001', HINT = 'revisao_obrigatoria';
    END IF;
    v_apr := v_apr || jsonb_build_object('sem_revisao', true, 'motivo_sem_revisao', v_just);
  END IF;

  v_gov := v_gov || jsonb_build_object('aprovacao', v_apr, 'versao_plano', v_versao);
  v_conteudo := (v_conteudo - '_governanca') || jsonb_build_object('_governanca', v_gov);

  UPDATE public.plano_cliente_chancela SET status = 'substituido'
   WHERE paciente_id = r.paciente_id AND tipo = r.tipo AND status = 'chancelado' AND id <> r.id;
  UPDATE public.plano_cliente_chancela
     SET conteudo = v_conteudo, status = 'chancelado',
         titulo = CASE WHEN p_conteudo IS NOT NULL THEN coalesce(nullif(btrim(v_conteudo ->> 'titulo'), ''), titulo) ELSE titulo END,
         revisor_id = auth.uid(), revisor_nome = v_nome, revisor_perfil = v_perfil_final,
         revisado_em = now(), nota_publica = left(nullif(btrim(coalesce(p_nota_publica, '')), ''), 500)
   WHERE id = r.id;

  RETURN jsonb_build_object('id', r.id, 'status', 'chancelado', 'versao', v_versao, 'aprovacao', v_apr);
END; $$;

-- Recusar também exige perfil verificado (o super-admin vale sempre); não exige área nem perfil da
-- área: recusar é o lado seguro e quem não pode chancelar continua podendo ler e recusar.
CREATE OR REPLACE FUNCTION public.recusar_plano_cliente(
  p_id uuid, p_nota_publica text, p_nota_interna text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.plano_cliente_chancela%ROWTYPE; v_perfil text; v_nome text; v_nota text; v_verificado boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada: entre novamente para recusar o plano.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.eh_equipe_cientifica() THEN
    RAISE EXCEPTION 'Só a equipe científica MyHealthID pode recusar planos.'
      USING ERRCODE = '42501', HINT = 'sem_permissao_area';
  END IF;
  SELECT perfil_profissional::text, nullif(btrim(concat_ws(' ', nome, sobrenome)), ''), verificado
    INTO v_perfil, v_nome, v_verificado FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  IF NOT public.eh_super_admin() AND NOT coalesce(v_verificado, false) THEN
    RAISE EXCEPTION 'Seu perfil profissional ainda não foi verificado pela equipe MyHealthID.'
      USING ERRCODE = '42501', HINT = 'nao_verificado';
  END IF;
  v_nota := left(nullif(btrim(coalesce(p_nota_publica, '')), ''), 500);
  IF v_nota IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da recusa para o cliente.';
  END IF;
  SELECT * INTO r FROM public.plano_cliente_chancela WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano não encontrado.'; END IF;
  IF r.status <> 'aguardando' THEN
    RAISE EXCEPTION 'Este plano não está mais aguardando chancela (situação atual: %).', r.status;
  END IF;
  PERFORM public.plano_cliente_checa_conflito(r.paciente_id, 'recusar');
  UPDATE public.plano_cliente_chancela
     SET status = 'recusado', revisor_id = auth.uid(), revisor_nome = v_nome,
         revisor_perfil = coalesce(v_perfil, CASE WHEN public.eh_super_admin() THEN 'super_admin' END),
         revisado_em = now(), nota_publica = v_nota,
         nota_interna = left(nullif(btrim(coalesce(p_nota_interna, '')), ''), 2000)
   WHERE id = r.id;
END; $$;

-- ── 10. Permissões ───────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.profiles_protege_verificacao() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.plano_cliente_cfg_bool(text, boolean) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.plano_cliente_prazo_dias() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.plano_cliente_config() FROM public, anon;
REVOKE ALL ON FUNCTION public.definir_config_plano_cliente(text, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.dias_uteis_entre(timestamptz, timestamptz) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.plano_cliente_prazo_ate(timestamptz, integer) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.plano_cliente_atrasado(timestamptz) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.plano_cliente_limite_pedidos_24h() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.plano_cliente_pedidos_24h(uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.equipe_cobre_area(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.plano_cliente_chancela_guarda() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.plano_cliente_eh_propria_conta(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.plano_cliente_ha_outro_revisor() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.plano_cliente_checa_conflito(uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.plano_cliente_motivo_bloqueio(text, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.solicitar_verificacao(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.verificar_profissional(uuid, boolean, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.profissionais_admin() FROM public, anon;
REVOKE ALL ON FUNCTION public.definir_equipe_cientifica(text, boolean, text[]) FROM public, anon;
REVOKE ALL ON FUNCTION public.definir_equipe_cientifica(text, boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.registrar_plano_cliente_chancela(uuid, text, text, text, jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.plano_cliente_estado_pedido(uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.plano_cliente_remetente_aviso(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.profissional_verificado(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gov_publico(jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.meu_plano_liberado(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.meu_status_plano_cliente(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.cancelar_pedido_plano_cliente(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.fila_chancela(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.chancelar_plano_cliente(uuid, jsonb, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.recusar_plano_cliente(uuid, text, text) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.plano_cliente_config() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.definir_config_plano_cliente(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.equipe_cobre_area(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.solicitar_verificacao(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verificar_profissional(uuid, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profissionais_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.definir_equipe_cientifica(text, boolean, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.definir_equipe_cientifica(text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.registrar_plano_cliente_chancela(uuid, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.plano_cliente_estado_pedido(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.plano_cliente_remetente_aviso(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.profissional_verificado(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.gov_publico(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.meu_plano_liberado(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.meu_status_plano_cliente(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido_plano_cliente(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fila_chancela(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chancelar_plano_cliente(uuid, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recusar_plano_cliente(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
