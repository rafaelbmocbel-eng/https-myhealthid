-- Habilita pg_net (necessário para chamar a edge function de e-mail via trigger)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Trigger function: notifica terapeuta quando rascunho de diretriz IA é criado/atualizado
CREATE OR REPLACE FUNCTION public.notify_diretriz_rascunho()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_nome text;
  v_origem_label text;
BEGIN
  -- Só dispara se virou rascunho de origem IA (insert ou update mudando para esse estado)
  IF NEW.status IS DISTINCT FROM 'rascunho' THEN
    RETURN NEW;
  END IF;
  IF NEW.origem IS NULL OR NEW.origem NOT LIKE 'ia_%' THEN
    RETURN NEW;
  END IF;
  -- Em UPDATE, só notifica se acabou de virar rascunho
  IF TG_OP = 'UPDATE' AND OLD.status = 'rascunho' AND OLD.origem = NEW.origem THEN
    RETURN NEW;
  END IF;

  IF NEW.paciente_id IS NOT NULL THEN
    SELECT TRIM(COALESCE(nome,'') || ' ' || COALESCE(sobrenome,''))
      INTO v_paciente_nome
      FROM public.pacientes WHERE id = NEW.paciente_id;
  END IF;
  v_paciente_nome := COALESCE(NULLIF(v_paciente_nome, ''), 'Paciente');

  v_origem_label := CASE NEW.origem
    WHEN 'ia_voz' THEN 'Voz'
    WHEN 'ia_escrita' THEN 'Escrita'
    WHEN 'ia_myid' THEN 'MyID'
    ELSE 'IA'
  END;

  INSERT INTO public.notificacoes (terapeuta_id, tipo, titulo, descricao, rota, metadata)
  VALUES (
    NEW.terapeuta_id,
    'diretriz_rascunho',
    '✨ Diretriz IA aguardando aprovação',
    v_paciente_nome || ' tem uma diretriz (' || v_origem_label || ') em rascunho. Revise e ative para enviá-la ao prontuário.',
    CASE WHEN NEW.paciente_id IS NOT NULL
      THEN '/pacientes/' || NEW.paciente_id || '?tab=diretrizes&protocolo=' || NEW.id
      ELSE '/pacientes' END,
    jsonb_build_object(
      'protocolo_id', NEW.id,
      'paciente_id', NEW.paciente_id,
      'origem', NEW.origem,
      'titulo', NEW.titulo
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_diretriz_rascunho ON public.protocolos;
CREATE TRIGGER trg_notify_diretriz_rascunho
AFTER INSERT OR UPDATE OF status, origem ON public.protocolos
FOR EACH ROW
EXECUTE FUNCTION public.notify_diretriz_rascunho();