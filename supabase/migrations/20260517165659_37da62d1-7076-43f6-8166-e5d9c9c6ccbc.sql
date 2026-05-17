
CREATE OR REPLACE FUNCTION public.sync_paciente_whatsapp_conversa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
BEGIN
  v_phone := regexp_replace(COALESCE(NEW.telefone, ''), '\D', '', 'g');
  IF v_phone = '' OR length(v_phone) < 8 THEN RETURN NEW; END IF;
  IF NEW.ativo IS NOT TRUE THEN RETURN NEW; END IF;

  INSERT INTO public.whatsapp_conversas (
    terapeuta_id, paciente_id, telefone, nome_contato, pipeline_stage
  ) VALUES (
    NEW.terapeuta_id, NEW.id, v_phone,
    TRIM(COALESCE(NEW.nome,'') || ' ' || COALESCE(NEW.sobrenome,'')),
    'fechado'::crm_pipeline_stage
  )
  ON CONFLICT (terapeuta_id, telefone) DO UPDATE
    SET paciente_id = EXCLUDED.paciente_id,
        nome_contato = COALESCE(whatsapp_conversas.nome_contato, EXCLUDED.nome_contato);
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_conversas_terapeuta_telefone_key'
  ) THEN
    ALTER TABLE public.whatsapp_conversas
      ADD CONSTRAINT whatsapp_conversas_terapeuta_telefone_key UNIQUE (terapeuta_id, telefone);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_sync_paciente_whatsapp ON public.pacientes;
CREATE TRIGGER trg_sync_paciente_whatsapp
AFTER INSERT OR UPDATE OF telefone, nome, sobrenome, ativo ON public.pacientes
FOR EACH ROW EXECUTE FUNCTION public.sync_paciente_whatsapp_conversa();

WITH dedup AS (
  SELECT DISTINCT ON (p.terapeuta_id, regexp_replace(p.telefone, '\D', '', 'g'))
    p.terapeuta_id, p.id AS paciente_id,
    regexp_replace(p.telefone, '\D', '', 'g') AS phone,
    TRIM(COALESCE(p.nome,'') || ' ' || COALESCE(p.sobrenome,'')) AS nome
  FROM public.pacientes p
  WHERE p.ativo = true
    AND p.telefone IS NOT NULL
    AND length(regexp_replace(p.telefone, '\D', '', 'g')) >= 8
  ORDER BY p.terapeuta_id, regexp_replace(p.telefone, '\D', '', 'g'), p.created_at ASC
)
INSERT INTO public.whatsapp_conversas (terapeuta_id, paciente_id, telefone, nome_contato, pipeline_stage)
SELECT terapeuta_id, paciente_id, phone, nome, 'fechado'::crm_pipeline_stage FROM dedup
ON CONFLICT (terapeuta_id, telefone) DO UPDATE
  SET paciente_id = EXCLUDED.paciente_id,
      nome_contato = COALESCE(whatsapp_conversas.nome_contato, EXCLUDED.nome_contato);
