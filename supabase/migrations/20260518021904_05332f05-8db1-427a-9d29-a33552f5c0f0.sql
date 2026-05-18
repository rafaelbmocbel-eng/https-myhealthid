-- Audit table for pagamentos_paciente
CREATE TABLE IF NOT EXISTS public.pagamentos_paciente_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pagamento_id uuid NOT NULL,
  paciente_id uuid,
  terapeuta_id uuid,
  acao text NOT NULL CHECK (acao IN ('insert','update','delete')),
  origem text NOT NULL CHECK (origem IN ('paciente','terapeuta','sistema')),
  ator_user_id uuid,
  campos_alterados text[],
  dados_antigos jsonb,
  dados_novos jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pag_audit_pagamento ON public.pagamentos_paciente_auditoria(pagamento_id);
CREATE INDEX IF NOT EXISTS idx_pag_audit_terapeuta ON public.pagamentos_paciente_auditoria(terapeuta_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pag_audit_paciente ON public.pagamentos_paciente_auditoria(paciente_id, created_at DESC);

ALTER TABLE public.pagamentos_paciente_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Terapeuta vê auditoria dos próprios pagamentos" ON public.pagamentos_paciente_auditoria;
CREATE POLICY "Terapeuta vê auditoria dos próprios pagamentos"
ON public.pagamentos_paciente_auditoria
FOR SELECT TO authenticated
USING (auth.uid() = terapeuta_id);

-- No INSERT/UPDATE/DELETE policies => only SECURITY DEFINER trigger can write.

-- Trigger function
CREATE OR REPLACE FUNCTION public.log_pagamentos_paciente_auditoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_origem text;
  v_is_terapeuta boolean := false;
  v_is_paciente boolean := false;
  v_campos text[] := ARRAY[]::text[];
  v_pag_id uuid;
  v_pac_id uuid;
  v_ter_id uuid;
  v_old jsonb;
  v_new jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_pag_id := OLD.id; v_pac_id := OLD.paciente_id; v_ter_id := OLD.terapeuta_id;
    v_old := to_jsonb(OLD); v_new := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_pag_id := NEW.id; v_pac_id := NEW.paciente_id; v_ter_id := NEW.terapeuta_id;
    v_old := NULL; v_new := to_jsonb(NEW);
  ELSE
    v_pag_id := NEW.id; v_pac_id := NEW.paciente_id; v_ter_id := NEW.terapeuta_id;
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
    -- Compute changed fields
    SELECT COALESCE(array_agg(key), ARRAY[]::text[])
      INTO v_campos
    FROM jsonb_each(v_new) n
    WHERE n.value IS DISTINCT FROM (v_old -> n.key);
  END IF;

  -- Determine origem
  IF v_uid IS NULL THEN
    v_origem := 'sistema';
  ELSE
    v_is_terapeuta := (v_uid = v_ter_id);
    IF v_is_terapeuta THEN
      v_origem := 'terapeuta';
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id = v_pac_id AND p.user_id = v_uid
      ) INTO v_is_paciente;
      v_origem := CASE WHEN v_is_paciente THEN 'paciente' ELSE 'sistema' END;
    END IF;
  END IF;

  INSERT INTO public.pagamentos_paciente_auditoria (
    pagamento_id, paciente_id, terapeuta_id, acao, origem,
    ator_user_id, campos_alterados, dados_antigos, dados_novos
  ) VALUES (
    v_pag_id, v_pac_id, v_ter_id, lower(TG_OP), v_origem,
    v_uid, v_campos, v_old, v_new
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS pagamentos_paciente_auditoria_trg ON public.pagamentos_paciente;
CREATE TRIGGER pagamentos_paciente_auditoria_trg
AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos_paciente
FOR EACH ROW EXECUTE FUNCTION public.log_pagamentos_paciente_auditoria();