-- 1) Restrict patient updates on pagamentos_paciente to comprovante_url only
CREATE OR REPLACE FUNCTION public.enforce_paciente_pagamento_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_paciente boolean;
  v_is_terapeuta boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  v_is_terapeuta := (auth.uid() = OLD.terapeuta_id);
  IF v_is_terapeuta THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = OLD.paciente_id AND p.user_id = auth.uid()
  ) INTO v_is_paciente;

  IF v_is_paciente THEN
    IF NEW.paciente_id     IS DISTINCT FROM OLD.paciente_id
    OR NEW.terapeuta_id    IS DISTINCT FROM OLD.terapeuta_id
    OR NEW.descricao       IS DISTINCT FROM OLD.descricao
    OR NEW.valor           IS DISTINCT FROM OLD.valor
    OR NEW.forma_pagamento IS DISTINCT FROM OLD.forma_pagamento
    OR NEW.status          IS DISTINCT FROM OLD.status
    OR NEW.observacoes     IS DISTINCT FROM OLD.observacoes THEN
      RAISE EXCEPTION 'Pacientes só podem atualizar o comprovante do pagamento.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_paciente_pagamento_update_trg ON public.pagamentos_paciente;
CREATE TRIGGER enforce_paciente_pagamento_update_trg
BEFORE UPDATE ON public.pagamentos_paciente
FOR EACH ROW EXECUTE FUNCTION public.enforce_paciente_pagamento_update();

-- 2) Lock down exercise-images bucket: only authenticated therapists (with a profile) can upload
DROP POLICY IF EXISTS "Terapeutas upload exercise images" ON storage.objects;
CREATE POLICY "Terapeutas upload exercise images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exercise-images'
  AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Terapeutas update exercise images" ON storage.objects;
CREATE POLICY "Terapeutas update exercise images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'exercise-images'
  AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Terapeutas delete exercise images" ON storage.objects;
CREATE POLICY "Terapeutas delete exercise images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'exercise-images'
  AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = auth.uid())
);