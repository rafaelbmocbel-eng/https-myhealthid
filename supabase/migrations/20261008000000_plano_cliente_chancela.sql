-- PLANO DO CLIENTE PREMIUM COM CHANCELA DA EQUIPE CIENTÍFICA MYHEALTHID
-- (decisão do Rafael, 08/10/2026; ver docs/fluxo-cliente-e-tiers.md).
--
-- O cliente PREMIUM volta a poder gerar treino e plano nutricional, mas o conteúdo
-- só chega a ele depois de CHANCELADO pela equipe científica da marca:
--   cliente gera (edge, service_role) -> plano_cliente_chancela 'aguardando'
--   equipe revisa/edita/chancela ou recusa (RPCs abaixo) -> o cliente lê só pelas RPCs.
-- O plano do PROFISSIONAL do paciente (planos_treino/planos_alimentares + liberar_plano)
-- não muda e, se estiver liberado, tem precedência em meu_plano_liberado.
--
-- Segurança: o cliente e o profissional comum NÃO têm policy na tabela. A equipe lê tudo
-- e só edita título/conteúdo/nota interna direto (e só na área do seu perfil); status,
-- revisor e carimbo mudam apenas pelas RPCs. A flag profiles.equipe_cientifica não pode ser
-- ligada pelo próprio usuário, e pacientes.tipo_conta só vira 'wellness_premium' pelo
-- servidor (service_role: pagamento) ou pelo super-admin: nenhum usuário logado promove uma
-- conta a Premium, nem por UPDATE nem por INSERT (as policies de pacientes não limitam colunas).

-- ── Equipe científica ────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS equipe_cientifica boolean NOT NULL DEFAULT false;

-- Conta do dono do produto (mesmo e-mail do SUPER_ADMINS do front e da policy de ai_usage_log).
CREATE OR REPLACE FUNCTION public.eh_super_admin()
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'rafaelbmocbel@gmail.com';
$$;

-- Equipe científica = profiles.equipe_cientifica. O super-admin conta como equipe mesmo que
-- o perfil dele ainda não tenha a flag (ele chancela qualquer área).
CREATE OR REPLACE FUNCTION public.eh_equipe_cientifica()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.eh_super_admin()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND equipe_cientifica)
  );
$$;

-- Perfis que atuam em cada tipo de plano do cliente: treino = Educador Físico ou Fisioterapeuta;
-- nutrição = Nutricionista. Fonte única para chancelar, recusar e editar.
CREATE OR REPLACE FUNCTION public.plano_cliente_perfil_ok(p_tipo text, p_perfil text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(CASE p_tipo
    WHEN 'treino' THEN p_perfil IN ('educador_fisico', 'fisioterapeuta')
    WHEN 'nutricao' THEN p_perfil = 'nutricionista'
  END, false);
$$;

-- Quem chama é da equipe e cobre a área do plano (perfil do tipo, ou super-admin).
CREATE OR REPLACE FUNCTION public.equipe_cobre_area(p_tipo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.eh_equipe_cientifica() AND (
    public.eh_super_admin()
    OR coalesce((SELECT public.plano_cliente_perfil_ok(p_tipo, perfil_profissional::text)
                   FROM public.profiles WHERE user_id = auth.uid() LIMIT 1), false)
  );
$$;

-- Só o super-admin (ou o service_role/SQL, sem sessão) muda a flag; qualquer outro UPDATE/INSERT
-- que tente ligá-la é revertido em silêncio, para não derrubar um salvamento de perfil inteiro.
CREATE OR REPLACE FUNCTION public.profiles_protege_equipe_cientifica()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.eh_super_admin() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.equipe_cientifica := false;
  ELSE
    NEW.equipe_cientifica := OLD.equipe_cientifica;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE TRIGGER trg_profiles_protege_equipe_cientifica
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_protege_equipe_cientifica();

UPDATE public.profiles SET equipe_cientifica = true
 WHERE NOT equipe_cientifica
   AND user_id IN (SELECT id FROM auth.users WHERE lower(email) = 'rafaelbmocbel@gmail.com');

-- Ninguém se promove a Premium pela API: o pagamento (wellness-pagamento, service_role, sem
-- sessão) e o super-admin são os únicos que gravam 'wellness_premium'. As policies de pacientes
-- deixam o cliente editar o próprio cadastro (sem limite de coluna) e qualquer usuário inserir
-- uma linha com terapeuta_id = ele mesmo, então a regra vale para QUALQUER usuário logado, em
-- INSERT e UPDATE, sem exceção para "terapeuta do próprio cadastro" (o cliente se tornava um em
-- dois passos). O cliente também não troca o tipo da própria conta nem se atribui como terapeuta.
-- Mudar para outro tipo (ex.: 'clinico') continua possível a quem edita o cadastro de OUTRA pessoa.
CREATE OR REPLACE FUNCTION public.pacientes_protege_tipo_conta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.eh_super_admin() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.tipo_conta = 'wellness_premium' THEN NEW.tipo_conta := 'wellness_free'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.tipo_conta IS DISTINCT FROM OLD.tipo_conta
     AND (NEW.tipo_conta = 'wellness_premium' OR OLD.user_id = auth.uid() OR NEW.user_id = auth.uid()) THEN
    NEW.tipo_conta := OLD.tipo_conta;
  END IF;
  IF OLD.user_id = auth.uid() AND NEW.terapeuta_id = auth.uid() AND OLD.terapeuta_id IS DISTINCT FROM auth.uid() THEN
    NEW.terapeuta_id := OLD.terapeuta_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE TRIGGER trg_pacientes_protege_tipo_conta
  BEFORE INSERT OR UPDATE OF tipo_conta, terapeuta_id ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.pacientes_protege_tipo_conta();

-- Designa (ou retira) alguém da equipe. Só super-admin; sem sessão (service_role/SQL) também vale.
CREATE OR REPLACE FUNCTION public.definir_equipe_cientifica(p_email text, p_valor boolean DEFAULT true)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.eh_super_admin() THEN
    RAISE EXCEPTION 'Só o administrador pode designar a equipe científica.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles SET equipe_cientifica = coalesce(p_valor, true)
   WHERE user_id IN (SELECT id FROM auth.users WHERE lower(email) = lower(btrim(p_email)));
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END; $$;

-- ── Tabela ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plano_cliente_chancela (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('treino', 'nutricao')),
  titulo text,
  objetivo text,
  conteudo jsonb NOT NULL,
  status text NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'chancelado', 'recusado', 'substituido')),
  gerado_em timestamptz NOT NULL DEFAULT now(),
  revisor_id uuid,
  revisor_nome text,
  revisor_perfil text,
  revisado_em timestamptz,
  nota_publica text,
  nota_interna text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No máximo um plano aguardando e um chancelado por paciente e tipo.
CREATE UNIQUE INDEX IF NOT EXISTS plano_cliente_chancela_um_aguardando
  ON public.plano_cliente_chancela (paciente_id, tipo) WHERE status = 'aguardando';
CREATE UNIQUE INDEX IF NOT EXISTS plano_cliente_chancela_um_chancelado
  ON public.plano_cliente_chancela (paciente_id, tipo) WHERE status = 'chancelado';
CREATE INDEX IF NOT EXISTS plano_cliente_chancela_paciente_idx
  ON public.plano_cliente_chancela (paciente_id, tipo, gerado_em DESC);
CREATE INDEX IF NOT EXISTS plano_cliente_chancela_fila_idx
  ON public.plano_cliente_chancela (status, gerado_em);

ALTER TABLE public.plano_cliente_chancela ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                  AND tablename = 'plano_cliente_chancela' AND policyname = 'plano_cliente_chancela_equipe_select') THEN
    CREATE POLICY plano_cliente_chancela_equipe_select ON public.plano_cliente_chancela
      FOR SELECT TO authenticated USING ((SELECT public.eh_equipe_cientifica()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                  AND tablename = 'plano_cliente_chancela' AND policyname = 'plano_cliente_chancela_equipe_update') THEN
    CREATE POLICY plano_cliente_chancela_equipe_update ON public.plano_cliente_chancela
      FOR UPDATE TO authenticated
      USING ((SELECT public.eh_equipe_cientifica())) WITH CHECK ((SELECT public.eh_equipe_cientifica()));
  END IF;
END $$;

REVOKE ALL ON public.plano_cliente_chancela FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.plano_cliente_chancela TO authenticated;
GRANT UPDATE (titulo, conteudo, nota_interna, updated_at) ON public.plano_cliente_chancela TO authenticated;
GRANT ALL ON public.plano_cliente_chancela TO service_role;

-- Edição direta (equipe, via API): só em plano aguardando, e _governanca (carimbo, revisão de
-- segurança, triagem) continua sendo do servidor. As RPCs rodam como dono e passam livres.
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
    -- Cada membro edita só a área do seu perfil (quem chancela é quem sabe o que mudou).
    IF NOT public.equipe_cobre_area(OLD.tipo) THEN
      RAISE EXCEPTION 'Você não tem o perfil para editar este plano de %.',
        CASE OLD.tipo WHEN 'treino' THEN 'treino' ELSE 'nutrição' END USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE TRIGGER trg_plano_cliente_chancela_guarda
  BEFORE UPDATE ON public.plano_cliente_chancela
  FOR EACH ROW EXECUTE FUNCTION public.plano_cliente_chancela_guarda();

-- ── Hash e revisão de segurança aceitam a tabela nova ────────────────────────

CREATE OR REPLACE FUNCTION public.plano_conteudo_hash(p_tabela text, p_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_conteudo jsonb; v_dono uuid;
BEGIN
  IF p_tabela = 'planos_treino' THEN
    SELECT estrutura, terapeuta_id INTO v_conteudo, v_dono FROM public.planos_treino WHERE id = p_id;
  ELSIF p_tabela = 'planos_alimentares' THEN
    SELECT plano, terapeuta_id INTO v_conteudo, v_dono FROM public.planos_alimentares WHERE id = p_id;
  ELSIF p_tabela = 'plano_cliente_chancela' THEN
    SELECT conteudo INTO v_conteudo FROM public.plano_cliente_chancela WHERE id = p_id;
    IF NOT FOUND THEN RETURN NULL; END IF;
    -- Só a equipe científica enxerga o hash do plano do cliente; service_role (uid nulo) vê todos.
    IF auth.uid() IS NOT NULL AND NOT public.eh_equipe_cientifica() THEN RETURN NULL; END IF;
    RETURN public.gov_hash_conteudo(v_conteudo);
  ELSE
    RAISE EXCEPTION 'Tabela de plano inválida: %', p_tabela;
  END IF;
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- Usuário logado só enxerga o hash do próprio plano; service_role (uid nulo) vê todos.
  IF auth.uid() IS NOT NULL AND v_dono IS DISTINCT FROM auth.uid() THEN RETURN NULL; END IF;
  RETURN public.gov_hash_conteudo(v_conteudo);
END; $$;

CREATE OR REPLACE FUNCTION public.registrar_revisao_plano(
  p_tabela text, p_id uuid, p_revisao jsonb, p_hash_esperado text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_n integer; v_rev jsonb;
BEGIN
  IF jsonb_typeof(p_revisao) IS DISTINCT FROM 'object' OR p_hash_esperado IS NULL THEN RETURN false; END IF;
  v_rev := p_revisao || jsonb_build_object('hash', p_hash_esperado);
  IF p_tabela = 'planos_treino' THEN
    UPDATE public.planos_treino
       SET estrutura = public.gov_definir(estrutura, 'revisao_seguranca', v_rev)
     WHERE id = p_id AND jsonb_typeof(estrutura) = 'object'
       AND public.gov_hash_conteudo(estrutura) = p_hash_esperado;
  ELSIF p_tabela = 'planos_alimentares' THEN
    UPDATE public.planos_alimentares
       SET plano = public.gov_definir(plano, 'revisao_seguranca', v_rev)
     WHERE id = p_id AND jsonb_typeof(plano) = 'object'
       AND public.gov_hash_conteudo(plano) = p_hash_esperado;
  ELSIF p_tabela = 'plano_cliente_chancela' THEN
    -- Plano já chancelado/recusado não recebe revisão nova.
    UPDATE public.plano_cliente_chancela
       SET conteudo = public.gov_definir(conteudo, 'revisao_seguranca', v_rev)
     WHERE id = p_id AND status = 'aguardando' AND jsonb_typeof(conteudo) = 'object'
       AND public.gov_hash_conteudo(conteudo) = p_hash_esperado;
  ELSE
    RAISE EXCEPTION 'Tabela de plano inválida: %', p_tabela;
  END IF;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END; $$;

-- ── Gravação do plano gerado (só o servidor) ─────────────────────────────────

-- Enquanto há um plano aguardando, outro do mesmo paciente e tipo NÃO entra: gerar de novo
-- não pode tirar da fila (nem de baixo das mãos do revisor) um plano que a equipe já está lendo
-- ou editando, e cada geração custa uma chamada de IA. A edge recusa antes de gastar IA (409);
-- aqui fica a garantia para a corrida entre duas gerações. O chancelado atual continua visível
-- ao cliente até o novo ser chancelado. Atômico: serializa por paciente e tipo.
CREATE OR REPLACE FUNCTION public.registrar_plano_cliente_chancela(
  p_paciente_id uuid, p_tipo text, p_titulo text, p_objetivo text, p_conteudo jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_tipo IS NULL OR p_tipo NOT IN ('treino', 'nutricao') THEN
    RAISE EXCEPTION 'Tipo de plano inválido: %', p_tipo;
  END IF;
  IF jsonb_typeof(p_conteudo) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Conteúdo do plano inválido.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_paciente_id::text || ':' || p_tipo, 0));
  IF EXISTS (SELECT 1 FROM public.plano_cliente_chancela
              WHERE paciente_id = p_paciente_id AND tipo = p_tipo AND status = 'aguardando') THEN
    RAISE EXCEPTION 'plano_em_revisao: já existe um plano deste tipo aguardando a equipe científica.'
      USING ERRCODE = 'P0001', HINT = 'plano_em_revisao';
  END IF;
  INSERT INTO public.plano_cliente_chancela (paciente_id, tipo, titulo, objetivo, conteudo)
  VALUES (p_paciente_id, p_tipo,
          coalesce(nullif(btrim(p_titulo), ''), nullif(btrim(p_conteudo ->> 'titulo'), '')),
          nullif(btrim(p_objetivo), ''), p_conteudo)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- ── Leitura do cliente (nunca a tabela, só estas RPCs) ───────────────────────

-- Parte do plano que o paciente pode ver: sem revisão de segurança, triagem nem justificativa.
CREATE OR REPLACE FUNCTION public.gov_publico(p_conteudo jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN jsonb_typeof(p_conteudo) = 'object' THEN
    (p_conteudo - '_governanca') || jsonb_build_object('_governanca', jsonb_strip_nulls(jsonb_build_object(
      'versao_plano', p_conteudo -> '_governanca' -> 'versao_plano',
      'aprovacao', jsonb_strip_nulls(jsonb_build_object(
        'por_perfil', p_conteudo -> '_governanca' -> 'aprovacao' -> 'por_perfil',
        'por_nome', p_conteudo -> '_governanca' -> 'aprovacao' -> 'por_nome',
        'em', p_conteudo -> '_governanca' -> 'aprovacao' -> 'em',
        'versao', p_conteudo -> '_governanca' -> 'aprovacao' -> 'versao')),
      'fonte', jsonb_strip_nulls(jsonb_build_object(
        'tipo', p_conteudo -> '_governanca' -> 'fonte' -> 'tipo',
        'modelo', p_conteudo -> '_governanca' -> 'fonte' -> 'modelo',
        'gerado_em', p_conteudo -> '_governanca' -> 'fonte' -> 'gerado_em')),
      'acompanhamento', p_conteudo -> '_governanca' -> 'acompanhamento')))
  ELSE p_conteudo END;
$$;

-- Plano liberado ao paciente: o do profissional, se houver um liberado; senão o chancelado
-- pela equipe científica (mais recente).
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

-- Situação do plano gerado pelo próprio cliente. Nunca devolve o conteúdo.
CREATE OR REPLACE FUNCTION public.meu_status_plano_cliente(p_tipo text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_out jsonb;
BEGIN
  IF p_tipo IS NULL OR p_tipo NOT IN ('treino', 'nutricao') THEN
    RAISE EXCEPTION 'Tipo de plano inválido: %', p_tipo;
  END IF;
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object('status', c.status, 'gerado_em', c.gerado_em, 'nota_publica', c.nota_publica)
    INTO v_out
    FROM public.plano_cliente_chancela c
   WHERE c.paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid())
     AND c.tipo = p_tipo AND c.status <> 'substituido'
   ORDER BY c.gerado_em DESC, c.id LIMIT 1;
  RETURN coalesce(v_out, jsonb_build_object('status', NULL, 'gerado_em', NULL, 'nota_publica', NULL));
END; $$;

-- ── Fila e decisão da equipe científica ──────────────────────────────────────

-- Conflito de interesse: ninguém chancela nem recusa o plano gerado para a própria conta. O
-- super-admin fica de fora de propósito (é o dono do produto e testa o fluxo de ponta a ponta
-- com a própria conta; enquanto ele for a única pessoa da equipe não haveria outro revisor).
CREATE OR REPLACE FUNCTION public.plano_cliente_checa_conflito(p_paciente_id uuid, p_acao text)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.eh_super_admin() THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.pacientes WHERE id = p_paciente_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Você não pode % o plano gerado para a sua própria conta: outro membro da equipe científica precisa revisá-lo.', p_acao
      USING ERRCODE = '42501';
  END IF;
END; $$;

-- Só PRIMEIRO nome e idade do paciente: nada de sobrenome, telefone ou e-mail. Cada item traz o
-- conteúdo inteiro (um treino chega a ~35 KB): o histórico (não aguardando) mostra só os 50 mais
-- recentes para a resposta não crescer sem limite.
CREATE OR REPLACE FUNCTION public.fila_chancela(p_status text DEFAULT 'aguardando')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_out jsonb;
BEGIN
  IF NOT public.eh_equipe_cientifica() THEN
    RAISE EXCEPTION 'Acesso restrito à equipe científica MyHealthID.' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('aguardando', 'chancelado', 'recusado', 'substituido') THEN
    RAISE EXCEPTION 'Status inválido: %', p_status;
  END IF;
  SELECT coalesce(jsonb_agg(q.item ORDER BY q.ord, q.id), '[]'::jsonb) INTO v_out FROM (
    SELECT c.id,
           CASE WHEN p_status = 'aguardando' THEN extract(epoch FROM c.gerado_em)
                ELSE -extract(epoch FROM coalesce(c.revisado_em, c.gerado_em)) END AS ord,
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
                      'revisado_em', c.conteudo #> '{_governanca,revisao_seguranca,revisado_em}')
               END,
             'hash_atual', public.gov_hash_conteudo(c.conteudo),
             'revisor_nome', c.revisor_nome, 'revisor_perfil', c.revisor_perfil, 'revisado_em', c.revisado_em,
             'nota_publica', c.nota_publica, 'nota_interna', c.nota_interna) AS item
      FROM public.plano_cliente_chancela c
      LEFT JOIN public.pacientes p ON p.id = c.paciente_id
     WHERE c.status = p_status
     ORDER BY 2, c.id
     LIMIT CASE WHEN p_status = 'aguardando' THEN 200 ELSE 50 END
  ) q;
  RETURN v_out;
END; $$;

-- Chancela o plano (equipe + perfil da área, ou super-admin). Mesma regra de gov_aplicar_plano:
-- revisão de segurança do conteúdo atual com risco alto exige justificativa de 15+ caracteres.
CREATE OR REPLACE FUNCTION public.chancelar_plano_cliente(
  p_id uuid, p_conteudo jsonb DEFAULT NULL, p_justificativa text DEFAULT NULL, p_nota_publica text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.plano_cliente_chancela%ROWTYPE;
  v_perfil text; v_nome text; v_perfil_final text; v_ok boolean;
  v_conteudo jsonb; v_gov jsonb; v_rev jsonb; v_apr jsonb;
  v_hash text; v_just text; v_versao integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada: entre novamente para chancelar o plano.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.eh_equipe_cientifica() THEN
    RAISE EXCEPTION 'Só a equipe científica MyHealthID pode chancelar planos.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO r FROM public.plano_cliente_chancela WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plano não encontrado.'; END IF;
  IF r.status <> 'aguardando' THEN
    RAISE EXCEPTION 'Este plano não está mais aguardando chancela (situação atual: %).', r.status;
  END IF;

  SELECT perfil_profissional::text, nullif(btrim(concat_ws(' ', nome, sobrenome)), '')
    INTO v_perfil, v_nome FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  v_ok := public.plano_cliente_perfil_ok(r.tipo, v_perfil);
  IF NOT v_ok AND NOT public.eh_super_admin() THEN
    RAISE EXCEPTION 'Você não tem o perfil para chancelar %: exige %.',
      CASE r.tipo WHEN 'treino' THEN 'treino' ELSE 'nutrição' END,
      CASE r.tipo WHEN 'treino' THEN 'Educador Físico ou Fisioterapeuta' ELSE 'Nutricionista' END
      USING ERRCODE = '42501';
  END IF;
  v_perfil_final := CASE WHEN v_ok THEN v_perfil ELSE 'super_admin' END;
  PERFORM public.plano_cliente_checa_conflito(r.paciente_id, 'chancelar');

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
  -- Versão = nº da chancela deste paciente e tipo (a 1ª é v1; cada plano novo chancelado soma 1).
  SELECT 1 + count(*) INTO v_versao FROM public.plano_cliente_chancela
   WHERE paciente_id = r.paciente_id AND tipo = r.tipo AND id <> r.id
     AND jsonb_typeof(conteudo #> '{_governanca,aprovacao}') = 'object';

  v_apr := jsonb_build_object('por_user_id', auth.uid(), 'por_nome', v_nome, 'por_perfil', v_perfil_final,
                              'em', now(), 'versao', v_versao, 'hash', v_hash);
  IF v_just IS NOT NULL THEN v_apr := v_apr || jsonb_build_object('justificativa', v_just); END IF;
  IF v_rev IS NOT NULL AND v_rev ->> 'hash' = v_hash THEN
    IF v_rev ->> 'risco_geral' = 'alto' AND coalesce(length(v_just), 0) < 15 THEN
      RAISE EXCEPTION 'Justificativa obrigatória para liberar plano de risco alto'
        USING ERRCODE = 'P0001', HINT = 'justificativa_obrigatoria';
    END IF;
    v_apr := v_apr || jsonb_build_object('risco_geral', v_rev ->> 'risco_geral');
  ELSE
    -- Editar o plano depois de uma revisão de risco alto não apaga o alerta: sem rodar a revisão
    -- de novo (hash atual), chancelar exige a mesma justificativa e o carimbo guarda o risco antigo.
    IF v_rev ->> 'risco_geral' = 'alto' THEN
      IF coalesce(length(v_just), 0) < 15 THEN
        RAISE EXCEPTION 'Justificativa obrigatória para liberar plano de risco alto: a última revisão de segurança apontou risco alto e o plano foi alterado depois dela. Rode a revisão de novo ou justifique.'
          USING ERRCODE = 'P0001', HINT = 'justificativa_obrigatoria';
      END IF;
      v_apr := v_apr || jsonb_build_object('risco_anterior_desatualizado', 'alto');
    END IF;
    v_apr := v_apr || jsonb_build_object('sem_revisao', true);
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

CREATE OR REPLACE FUNCTION public.recusar_plano_cliente(
  p_id uuid, p_nota_publica text, p_nota_interna text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.plano_cliente_chancela%ROWTYPE; v_perfil text; v_nome text; v_nota text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada: entre novamente para recusar o plano.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.eh_equipe_cientifica() THEN
    RAISE EXCEPTION 'Só a equipe científica MyHealthID pode recusar planos.' USING ERRCODE = '42501';
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
  SELECT perfil_profissional::text, nullif(btrim(concat_ws(' ', nome, sobrenome)), '')
    INTO v_perfil, v_nome FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
  UPDATE public.plano_cliente_chancela
     SET status = 'recusado', revisor_id = auth.uid(), revisor_nome = v_nome,
         revisor_perfil = coalesce(v_perfil, CASE WHEN public.eh_super_admin() THEN 'super_admin' END),
         revisado_em = now(), nota_publica = v_nota,
         nota_interna = left(nullif(btrim(coalesce(p_nota_interna, '')), ''), 2000)
   WHERE id = r.id;
END; $$;

-- ── Permissões ───────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.eh_super_admin() FROM public, anon;
REVOKE ALL ON FUNCTION public.eh_equipe_cientifica() FROM public, anon;
REVOKE ALL ON FUNCTION public.definir_equipe_cientifica(text, boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.plano_conteudo_hash(text, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.gov_publico(jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.meu_plano_liberado(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.meu_status_plano_cliente(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.fila_chancela(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.chancelar_plano_cliente(uuid, jsonb, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.recusar_plano_cliente(uuid, text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.registrar_revisao_plano(text, uuid, jsonb, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_plano_cliente_chancela(uuid, text, text, text, jsonb) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.plano_cliente_chancela_guarda() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.plano_cliente_perfil_ok(text, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.equipe_cobre_area(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.plano_cliente_checa_conflito(uuid, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.profiles_protege_equipe_cientifica() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.pacientes_protege_tipo_conta() FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.eh_super_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.eh_equipe_cientifica() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plano_cliente_perfil_ok(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.equipe_cobre_area(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.definir_equipe_cientifica(text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plano_conteudo_hash(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gov_publico(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.meu_plano_liberado(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.meu_status_plano_cliente(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fila_chancela(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chancelar_plano_cliente(uuid, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recusar_plano_cliente(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_revisao_plano(text, uuid, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_plano_cliente_chancela(uuid, text, text, text, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
