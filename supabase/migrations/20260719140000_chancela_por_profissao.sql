-- CHANCELA POR PROFISSÃO — enforcamento no banco (não só no front).
--
-- Regra (Rafael): o app é para todos os profissionais. A LIBERAÇÃO de um plano
-- ao paciente é ato do profissional habilitado — ou de uma clínica que tenha
-- esse profissional cadastrado e ATIVO na equipe:
--   plano de treino/personal → Educador Físico
--   plano nutricional        → Nutricionista
--   diretriz de fisioterapia → Fisioterapeuta
-- Gerar rascunho é livre; só a TRANSIÇÃO para "liberado/ativo" é restrita.
-- Editar um plano já liberado continua livre (não re-checa).

-- Helper: o usuário logado pode chancelar como <perfil>? (próprio perfil OU
-- clínica ativa onde ele é dono/membro e que tenha o perfil exigido ativo).
-- SECURITY DEFINER para ler profiles/membros de outros da mesma clínica.
CREATE OR REPLACE FUNCTION public.pode_chancelar(p_perfil public.perfil_profissional)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    -- 1) O próprio profissional tem o perfil exigido.
    EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.user_id = auth.uid() AND pr.perfil_profissional = p_perfil
    )
    OR
    -- 2) Está numa clínica ativa (como dono ou membro ativo) que tem esse
    --    perfil ativo na equipe (o dono ou algum membro ativo).
    EXISTS (
      SELECT 1
      FROM public.clinicas c
      WHERE c.ativa = true
        AND (
          c.dono_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.clinica_membros mo
            WHERE mo.clinica_id = c.id AND mo.user_id = auth.uid() AND mo.status = 'ativo'
          )
        )
        AND (
          EXISTS (
            SELECT 1 FROM public.profiles pd
            WHERE pd.user_id = c.dono_user_id AND pd.perfil_profissional = p_perfil
          )
          OR EXISTS (
            SELECT 1 FROM public.clinica_membros m
            LEFT JOIN public.profiles pm ON pm.user_id = m.user_id
            WHERE m.clinica_id = c.id AND m.status = 'ativo'
              AND (pm.perfil_profissional = p_perfil OR m.perfil_profissional = p_perfil)
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.pode_chancelar(public.perfil_profissional) FROM public;
GRANT EXECUTE ON FUNCTION public.pode_chancelar(public.perfil_profissional) TO authenticated;

-- ── planos_treino → Educador Físico ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.chk_chancela_planos_treino()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_libera boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF; -- chamada interna/service_role
  -- Só checa quando a linha PASSA a estar liberada (evita re-checar edições).
  IF TG_OP = 'INSERT' THEN
    v_libera := NEW.aprovado IS TRUE;
  ELSE
    v_libera := NEW.aprovado IS TRUE AND OLD.aprovado IS DISTINCT FROM TRUE;
  END IF;
  IF v_libera AND NOT public.pode_chancelar('educador_fisico') THEN
    RAISE EXCEPTION 'chancela_negada: apenas Educador Físico (ou clínica com um ativo) pode liberar plano de treino';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_chancela_planos_treino ON public.planos_treino;
CREATE TRIGGER trg_chancela_planos_treino
  BEFORE INSERT OR UPDATE ON public.planos_treino
  FOR EACH ROW EXECUTE FUNCTION public.chk_chancela_planos_treino();

-- ── planos_alimentares → Nutricionista ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.chk_chancela_planos_alimentares()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_libera boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    v_libera := NEW.aprovado IS TRUE;
  ELSE
    v_libera := NEW.aprovado IS TRUE AND OLD.aprovado IS DISTINCT FROM TRUE;
  END IF;
  IF v_libera AND NOT public.pode_chancelar('nutricionista') THEN
    RAISE EXCEPTION 'chancela_negada: apenas Nutricionista (ou clínica com um ativo) pode liberar plano alimentar';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_chancela_planos_alimentares ON public.planos_alimentares;
CREATE TRIGGER trg_chancela_planos_alimentares
  BEFORE INSERT OR UPDATE ON public.planos_alimentares
  FOR EACH ROW EXECUTE FUNCTION public.chk_chancela_planos_alimentares();

-- ── diretrizes_profissionais → por área (educação física / nutrição) ─────────
CREATE OR REPLACE FUNCTION public.chk_chancela_diretrizes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_perfil public.perfil_profissional; v_libera boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    v_libera := NEW.enviada_portal IS TRUE;
  ELSE
    v_libera := NEW.enviada_portal IS TRUE AND OLD.enviada_portal IS DISTINCT FROM TRUE;
  END IF;
  IF v_libera THEN
    v_perfil := (CASE NEW.area
      WHEN 'nutricao' THEN 'nutricionista'
      WHEN 'educacao_fisica' THEN 'educador_fisico'
      ELSE 'fisioterapeuta'
    END)::public.perfil_profissional;
    IF NOT public.pode_chancelar(v_perfil) THEN
      RAISE EXCEPTION 'chancela_negada: apenas % (ou clínica com um ativo) pode enviar esta diretriz ao portal', v_perfil;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_chancela_diretrizes ON public.diretrizes_profissionais;
CREATE TRIGGER trg_chancela_diretrizes
  BEFORE INSERT OR UPDATE ON public.diretrizes_profissionais
  FOR EACH ROW EXECUTE FUNCTION public.chk_chancela_diretrizes();

-- ── protocolos (diretriz de tratamento) → Fisioterapeuta ─────────────────────
CREATE OR REPLACE FUNCTION public.chk_chancela_protocolos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_libera boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    v_libera := NEW.status = 'ativo';
  ELSE
    v_libera := NEW.status = 'ativo' AND OLD.status IS DISTINCT FROM 'ativo';
  END IF;
  IF v_libera AND NOT public.pode_chancelar('fisioterapeuta') THEN
    RAISE EXCEPTION 'chancela_negada: apenas Fisioterapeuta (ou clínica com um ativo) pode ativar a diretriz de tratamento';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_chancela_protocolos ON public.protocolos;
CREATE TRIGGER trg_chancela_protocolos
  BEFORE INSERT OR UPDATE ON public.protocolos
  FOR EACH ROW EXECUTE FUNCTION public.chk_chancela_protocolos();
