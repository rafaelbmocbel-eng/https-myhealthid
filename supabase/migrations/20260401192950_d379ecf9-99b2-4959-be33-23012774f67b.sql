
CREATE OR REPLACE FUNCTION public.incrementar_pacote_ao_concluir()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when status changes TO 'concluido'
  IF NEW.status = 'concluido' AND (OLD.status IS DISTINCT FROM 'concluido') AND NEW.paciente_id IS NOT NULL THEN
    UPDATE public.pacotes_sessoes
    SET sessoes_utilizadas = sessoes_utilizadas + 1,
        updated_at = now()
    WHERE paciente_id = NEW.paciente_id
      AND terapeuta_id = NEW.terapeuta_id
      AND status = 'ativo'
      AND sessoes_utilizadas < total_sessoes;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incrementar_pacote_concluido
AFTER UPDATE ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.incrementar_pacote_ao_concluir();
