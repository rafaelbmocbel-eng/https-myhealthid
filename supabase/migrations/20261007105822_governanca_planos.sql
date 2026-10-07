-- GOVERNANÇA DE PLANOS (treino e alimentar) — registro de liberação no banco.
--
-- Tudo vive dentro do jsonb que já existe (planos_treino.estrutura e
-- planos_alimentares.plano), na chave "_governanca"; nenhuma coluna nova.
--   _governanca.revisao_seguranca  → gravada SÓ pelo servidor (registrar_revisao_plano)
--   _governanca.aprovacao          → carimbada SÓ pelo trigger (quem, quando, versão, hash)
--   _governanca.versao_plano       → nº da versão do conteúdo (1 se ausente; +1 quando um
--                                    plano liberado é editado e volta a rascunho). Não
--                                    confundir com _governanca.versao, que é a versão do
--                                    formato do registro e o banco não toca.
-- O que o cliente (front) mandar em "aprovacao"/"revisao_seguranca" é descartado, exceto
-- aprovacao.justificativa, que o trigger lê e reembala no carimbo.
-- Com auth.uid() nulo (service_role, jobs) os triggers não carimbam nem recusam.

-- Hash do conteúdo clínico: ignora _governanca, que muda a cada revisão/liberação.
CREATE OR REPLACE FUNCTION public.gov_hash_conteudo(p_conteudo jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT md5((CASE WHEN jsonb_typeof(p_conteudo) = 'object'
                   THEN p_conteudo - '_governanca'
                   ELSE coalesce(p_conteudo, 'null'::jsonb) END)::text);
$$;

-- Define _governanca.<chave> = valor sem tocar no resto do conteúdo.
CREATE OR REPLACE FUNCTION public.gov_definir(p_conteudo jsonb, p_chave text, p_valor jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN jsonb_typeof(p_conteudo) = 'object'
    THEN p_conteudo || jsonb_build_object('_governanca',
           (CASE WHEN jsonb_typeof(p_conteudo -> '_governanca') = 'object'
                 THEN p_conteudo -> '_governanca' ELSE '{}'::jsonb END)
           || jsonb_build_object(p_chave, p_valor))
    ELSE p_conteudo END;
$$;

-- Hash do plano salvo (o revisor guarda este hash junto da revisão).
CREATE OR REPLACE FUNCTION public.plano_conteudo_hash(p_tabela text, p_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_conteudo jsonb; v_dono uuid;
BEGIN
  IF p_tabela = 'planos_treino' THEN
    SELECT estrutura, terapeuta_id INTO v_conteudo, v_dono FROM public.planos_treino WHERE id = p_id;
  ELSIF p_tabela = 'planos_alimentares' THEN
    SELECT plano, terapeuta_id INTO v_conteudo, v_dono FROM public.planos_alimentares WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'Tabela de plano inválida: %', p_tabela;
  END IF;
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- Usuário logado só enxerga o hash do próprio plano; service_role (uid nulo) vê todos.
  IF auth.uid() IS NOT NULL AND v_dono IS DISTINCT FROM auth.uid() THEN RETURN NULL; END IF;
  RETURN public.gov_hash_conteudo(v_conteudo);
END; $$;

-- Grava a revisão de segurança no plano de forma atômica (compare-and-set pelo
-- hash): se o plano mudou depois de revisado, não grava. Só o servidor chama —
-- se o front pudesse, forjaria "risco baixo" e escaparia da justificativa.
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
  ELSE
    RAISE EXCEPTION 'Tabela de plano inválida: %', p_tabela;
  END IF;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END; $$;

-- Núcleo dos triggers: devolve o conteúdo e o "aprovado" finais.
--  * entrada em "liberado": carimba aprovacao; risco alto revisado exige justificativa
--  * plano liberado cujo conteúdo mudou: volta a rascunho, versao_plano + 1, sem carimbo
--  * demais casos: aprovacao e revisao_seguranca ficam como estavam no banco
CREATE OR REPLACE FUNCTION public.gov_aplicar_plano(
  p_op text, p_old jsonb, p_new jsonb, p_old_aprovado boolean, p_new_aprovado boolean,
  OUT o_conteudo jsonb, OUT o_aprovado boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_gov jsonb; v_old_gov jsonb; v_rev jsonb; v_apr_old jsonb; v_apr jsonb;
  v_hash text; v_just text; v_nome text; v_txt text;
  v_versao integer; v_libera boolean; v_editou boolean; v_editou_oculto boolean;
BEGIN
  o_conteudo := p_new;
  o_aprovado := coalesce(p_new_aprovado, false);
  IF jsonb_typeof(p_new) IS DISTINCT FROM 'object' THEN RETURN; END IF;

  v_gov     := CASE WHEN jsonb_typeof(p_new -> '_governanca') = 'object' THEN p_new -> '_governanca' ELSE '{}'::jsonb END;
  v_old_gov := CASE WHEN jsonb_typeof(p_old -> '_governanca') = 'object' THEN p_old -> '_governanca' ELSE '{}'::jsonb END;

  v_just := nullif(btrim(coalesce(v_gov -> 'aprovacao' ->> 'justificativa', '')), '');
  v_rev := v_old_gov -> 'revisao_seguranca';
  v_apr_old := v_old_gov -> 'aprovacao';
  v_gov := v_gov - 'aprovacao' - 'revisao_seguranca';
  IF v_rev IS NOT NULL THEN
    v_gov := v_gov || jsonb_build_object('revisao_seguranca', v_rev);
  END IF;

  v_txt := (CASE WHEN p_op = 'UPDATE' THEN v_old_gov ELSE v_gov END) ->> 'versao_plano';
  v_versao := CASE WHEN v_txt ~ '^[1-9][0-9]{0,5}$' THEN v_txt::integer ELSE 1 END;
  IF p_op = 'UPDATE' THEN v_gov := v_gov - 'versao_plano'; END IF;

  v_hash := public.gov_hash_conteudo(p_new);
  v_libera := o_aprovado AND (p_op = 'INSERT' OR NOT coalesce(p_old_aprovado, false));
  v_editou := p_op = 'UPDATE' AND o_aprovado AND coalesce(p_old_aprovado, false)
              AND public.gov_hash_conteudo(p_old) IS DISTINCT FROM v_hash;
  -- Plano liberado editado e ocultado na MESMA instrução (o front manda aprovado=false):
  -- o conteúdo mudou, então a versão também avança.
  v_editou_oculto := p_op = 'UPDATE' AND NOT o_aprovado AND coalesce(p_old_aprovado, false)
                     AND public.gov_hash_conteudo(p_old) IS DISTINCT FROM v_hash;

  IF v_libera THEN
    SELECT nullif(btrim(concat_ws(' ', nome, sobrenome)), '') INTO v_nome
      FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
    v_apr := jsonb_build_object('por_user_id', auth.uid(), 'em', now(), 'versao', v_versao, 'hash', v_hash);
    IF v_nome IS NOT NULL THEN v_apr := v_apr || jsonb_build_object('por_nome', v_nome); END IF;
    IF v_just IS NOT NULL THEN v_apr := v_apr || jsonb_build_object('justificativa', v_just); END IF;
    IF v_rev IS NOT NULL AND v_rev ->> 'hash' = v_hash THEN
      IF v_rev ->> 'risco_geral' = 'alto' AND coalesce(length(v_just), 0) < 15 THEN
        RAISE EXCEPTION 'Justificativa obrigatória para liberar plano de risco alto'
          USING ERRCODE = 'P0001', HINT = 'justificativa_obrigatoria';
      END IF;
      v_apr := v_apr || jsonb_build_object('risco_geral', v_rev ->> 'risco_geral');
    ELSE
      -- Sem revisão do conteúdo atual (nunca revisado ou editado depois de revisar).
      v_apr := v_apr || jsonb_build_object('sem_revisao', true);
    END IF;
    v_gov := v_gov || jsonb_build_object('aprovacao', v_apr, 'versao_plano', v_versao);
  ELSIF o_aprovado THEN
    IF v_editou THEN
      o_aprovado := false;
      v_gov := v_gov || jsonb_build_object('versao_plano', v_versao + 1);
    ELSE
      IF v_apr_old IS NOT NULL THEN v_gov := v_gov || jsonb_build_object('aprovacao', v_apr_old); END IF;
      IF v_old_gov ? 'versao_plano' THEN v_gov := v_gov || jsonb_build_object('versao_plano', v_versao); END IF;
    END IF;
  ELSIF v_editou_oculto THEN
    v_gov := v_gov || jsonb_build_object('versao_plano', v_versao + 1);
  ELSIF v_old_gov ? 'versao_plano' THEN
    v_gov := v_gov || jsonb_build_object('versao_plano', v_versao);
  END IF;

  IF v_gov <> '{}'::jsonb OR p_new ? '_governanca' THEN
    o_conteudo := p_new || jsonb_build_object('_governanca', v_gov);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.gov_planos_treino()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT * INTO r FROM public.gov_aplicar_plano('UPDATE', OLD.estrutura, NEW.estrutura, OLD.aprovado, NEW.aprovado);
  ELSE
    SELECT * INTO r FROM public.gov_aplicar_plano('INSERT', NULL, NEW.estrutura, NULL, NEW.aprovado);
  END IF;
  NEW.estrutura := r.o_conteudo;
  NEW.aprovado := r.o_aprovado;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.gov_planos_alimentares()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT * INTO r FROM public.gov_aplicar_plano('UPDATE', OLD.plano, NEW.plano, OLD.aprovado, NEW.aprovado);
  ELSE
    SELECT * INTO r FROM public.gov_aplicar_plano('INSERT', NULL, NEW.plano, NULL, NEW.aprovado);
  END IF;
  NEW.plano := r.o_conteudo;
  NEW.aprovado := r.o_aprovado;
  RETURN NEW;
END; $$;

-- Nomes com "trg_gov_" rodam DEPOIS dos trg_chancela_* (ordem alfabética): quem não
-- tem a habilitação profissional é recusado antes de qualquer carimbo.
CREATE OR REPLACE TRIGGER trg_gov_planos_treino
  BEFORE INSERT OR UPDATE ON public.planos_treino
  FOR EACH ROW EXECUTE FUNCTION public.gov_planos_treino();

CREATE OR REPLACE TRIGGER trg_gov_planos_alimentares
  BEFORE INSERT OR UPDATE ON public.planos_alimentares
  FOR EACH ROW EXECUTE FUNCTION public.gov_planos_alimentares();

-- Libera o plano (RLS vale: SECURITY INVOKER). Grava a justificativa e o carimbo na
-- mesma instrução; devolve a _governanca final. Repetir a chamada num plano já
-- liberado não muda nada.
CREATE OR REPLACE FUNCTION public.liberar_plano(p_tabela text, p_id uuid, p_justificativa text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_just text := nullif(btrim(coalesce(p_justificativa, '')), '');
  v_just_json jsonb;
  v_gov jsonb;
  v_n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada: entre novamente para liberar o plano.';
  END IF;
  v_just_json := CASE WHEN v_just IS NULL THEN NULL ELSE jsonb_build_object('justificativa', v_just) END;

  IF p_tabela = 'planos_treino' THEN
    UPDATE public.planos_treino
       SET aprovado = true,
           estrutura = CASE WHEN v_just_json IS NULL THEN estrutura
                            ELSE public.gov_definir(estrutura, 'aprovacao', v_just_json) END
     WHERE id = p_id AND aprovado IS DISTINCT FROM true
    RETURNING estrutura -> '_governanca' INTO v_gov;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN
      SELECT estrutura -> '_governanca' INTO v_gov FROM public.planos_treino WHERE id = p_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Plano não encontrado ou sem permissão para liberá-lo.';
      END IF;
    END IF;
  ELSIF p_tabela = 'planos_alimentares' THEN
    UPDATE public.planos_alimentares
       SET aprovado = true,
           plano = CASE WHEN v_just_json IS NULL THEN plano
                        ELSE public.gov_definir(plano, 'aprovacao', v_just_json) END
     WHERE id = p_id AND aprovado IS DISTINCT FROM true
    RETURNING plano -> '_governanca' INTO v_gov;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN
      SELECT plano -> '_governanca' INTO v_gov FROM public.planos_alimentares WHERE id = p_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Plano não encontrado ou sem permissão para liberá-lo.';
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Tabela de plano inválida: %', p_tabela;
  END IF;

  RETURN coalesce(v_gov, '{}'::jsonb);
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'chancela_negada:%' THEN
    RAISE EXCEPTION '%', regexp_replace(SQLERRM, '^chancela_negada:\s*', 'Liberação negada: ')
      USING ERRCODE = 'P0001';
  END IF;
  RAISE;
END; $$;

REVOKE ALL ON FUNCTION public.gov_hash_conteudo(jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.gov_definir(jsonb, text, jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.plano_conteudo_hash(text, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.liberar_plano(text, uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.registrar_revisao_plano(text, uuid, jsonb, text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gov_aplicar_plano(text, jsonb, jsonb, boolean, boolean) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gov_planos_treino() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gov_planos_alimentares() FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gov_hash_conteudo(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gov_definir(jsonb, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.plano_conteudo_hash(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.liberar_plano(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_revisao_plano(text, uuid, jsonb, text) TO service_role;
