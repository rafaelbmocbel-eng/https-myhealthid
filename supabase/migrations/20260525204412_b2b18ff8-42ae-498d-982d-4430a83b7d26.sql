-- 1) pagamentos_paciente: restringir colunas que o paciente pode atualizar
CREATE OR REPLACE FUNCTION public.pagamentos_paciente_restrict_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_patient boolean;
BEGIN
  -- Verifica se o caller é o paciente (e não o terapeuta dono)
  SELECT EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = NEW.paciente_id AND p.user_id = auth.uid()
  ) INTO v_is_patient;

  IF v_is_patient AND NEW.terapeuta_id <> auth.uid() THEN
    -- Paciente só pode mudar comprovante_url
    IF NEW.valor IS DISTINCT FROM OLD.valor
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.status_pagamento IS DISTINCT FROM OLD.status_pagamento
       OR NEW.forma_pagamento IS DISTINCT FROM OLD.forma_pagamento
       OR NEW.forma_recebimento IS DISTINCT FROM OLD.forma_recebimento
       OR NEW.data_recebimento IS DISTINCT FROM OLD.data_recebimento
       OR NEW.terapeuta_id IS DISTINCT FROM OLD.terapeuta_id
       OR NEW.paciente_id IS DISTINCT FROM OLD.paciente_id
       OR NEW.descricao IS DISTINCT FROM OLD.descricao
    THEN
      RAISE EXCEPTION 'Paciente só pode atualizar o comprovante de pagamento'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pagamentos_paciente_restrict_update ON public.pagamentos_paciente;
CREATE TRIGGER trg_pagamentos_paciente_restrict_update
  BEFORE UPDATE ON public.pagamentos_paciente
  FOR EACH ROW EXECUTE FUNCTION public.pagamentos_paciente_restrict_update();

-- 2) agendamentos: exigir que paciente pertença ao terapeuta no INSERT via funil
DROP POLICY IF EXISTS pub_agendamentos_insert_via_funil ON public.agendamentos;
CREATE POLICY pub_agendamentos_insert_via_funil
  ON public.agendamentos
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    status = 'pendente'
    AND EXISTS (
      SELECT 1 FROM public.funil_config fc
      WHERE fc.terapeuta_id = agendamentos.terapeuta_id AND fc.ativo = true
    )
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = agendamentos.paciente_id
        AND p.terapeuta_id = agendamentos.terapeuta_id
    )
  );

-- 3) tracking_config: restringir SELECT a usuários autenticados
DROP POLICY IF EXISTS "Public can read active tracking config" ON public.tracking_config;
CREATE POLICY "Authenticated can read active tracking config"
  ON public.tracking_config
  FOR SELECT
  TO authenticated
  USING (ativos = true);

-- 4) Storage exercise-images: bloquear pacientes (apenas profiles puros / não-pacientes)
DROP POLICY IF EXISTS "Terapeutas upload exercise images" ON storage.objects;
DROP POLICY IF EXISTS "Terapeutas update exercise images" ON storage.objects;
DROP POLICY IF EXISTS "Terapeutas delete exercise images" ON storage.objects;

CREATE POLICY "Terapeutas upload exercise images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'exercise-images'
    AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.pacientes pa WHERE pa.user_id = auth.uid())
  );

CREATE POLICY "Terapeutas update exercise images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'exercise-images'
    AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.pacientes pa WHERE pa.user_id = auth.uid())
  );

CREATE POLICY "Terapeutas delete exercise images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'exercise-images'
    AND EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.user_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.pacientes pa WHERE pa.user_id = auth.uid())
  );