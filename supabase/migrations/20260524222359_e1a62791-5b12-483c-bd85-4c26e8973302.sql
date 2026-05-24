-- Sprint 2: status de pagamento + aging de inadimplência
-- Campos opcionais e backwards-compatible. Default 'pendente' para registros novos.
-- Registros antigos com valor_cobrado>0 ficam como 'pendente' (terapeuta decide se já estão pagos).

ALTER TABLE public.controle_sessoes
  ADD COLUMN IF NOT EXISTS status_pagamento text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS data_recebimento timestamptz,
  ADD COLUMN IF NOT EXISTS forma_recebimento text,
  ADD COLUMN IF NOT EXISTS observacao_pagamento text;

-- Constraint de valores válidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'controle_sessoes_status_pagamento_check'
  ) THEN
    ALTER TABLE public.controle_sessoes
      ADD CONSTRAINT controle_sessoes_status_pagamento_check
      CHECK (status_pagamento IN ('pendente','pago','isento','perdido'));
  END IF;
END $$;

-- Índice p/ aging e listas de inadimplência
CREATE INDEX IF NOT EXISTS idx_controle_sessoes_status_pgto
  ON public.controle_sessoes (terapeuta_id, status_pagamento, data_sessao DESC)
  WHERE status = 'realizada';

-- Trigger: ao marcar como 'pago' e não houver data_recebimento, preenche com now()
CREATE OR REPLACE FUNCTION public.set_data_recebimento_on_pago()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status_pagamento = 'pago' AND NEW.data_recebimento IS NULL THEN
    NEW.data_recebimento := now();
  END IF;
  IF NEW.status_pagamento <> 'pago' THEN
    NEW.data_recebimento := NULL;
    NEW.forma_recebimento := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_data_recebimento ON public.controle_sessoes;
CREATE TRIGGER trg_set_data_recebimento
  BEFORE INSERT OR UPDATE OF status_pagamento ON public.controle_sessoes
  FOR EACH ROW EXECUTE FUNCTION public.set_data_recebimento_on_pago();