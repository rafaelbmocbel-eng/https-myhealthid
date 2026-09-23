-- Enviar/ativar a diretriz de tratamento (protocolos) vale para TODAS as
-- profissões, como já era para o fisioterapeuta (decisão do Rafael): cada
-- profissional ativa a diretriz da sua própria avaliação. Planos de treino e
-- nutricionais continuam com a chancela da profissão específica.
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
  IF v_libera AND NOT (
    EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = auth.uid() AND pr.perfil_profissional IS NOT NULL)
    OR public.pode_chancelar('fisioterapeuta')
  ) THEN
    RAISE EXCEPTION 'chancela_negada: defina sua profissão no perfil para ativar a diretriz de tratamento';
  END IF;
  RETURN NEW;
END; $$;

-- Diretrizes por área: alinha com o front (usePodeChancelar) — cada profissão
-- envia a sua área e educação física aceita Educador Físico OU Fisioterapeuta
-- (o app liberava o botão ao fisio, mas o banco recusava).
CREATE OR REPLACE FUNCTION public.chk_chancela_diretrizes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_libera boolean; v_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    v_libera := NEW.enviada_portal IS TRUE;
  ELSE
    v_libera := NEW.enviada_portal IS TRUE AND OLD.enviada_portal IS DISTINCT FROM TRUE;
  END IF;
  IF v_libera THEN
    v_ok := CASE NEW.area
      WHEN 'nutricao' THEN public.pode_chancelar('nutricionista')
      WHEN 'educacao_fisica' THEN public.pode_chancelar('educador_fisico') OR public.pode_chancelar('fisioterapeuta')
      WHEN 'medicina' THEN public.pode_chancelar('medico')
      WHEN 'psicologia' THEN public.pode_chancelar('psicologo')
      WHEN 'terapia_ocupacional' THEN public.pode_chancelar('terapeuta_ocupacional')
      WHEN 'odontologia' THEN public.pode_chancelar('dentista')
      ELSE public.pode_chancelar('fisioterapeuta')
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'chancela_negada: apenas o profissional da área (%) pode enviar esta diretriz ao portal', NEW.area;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
