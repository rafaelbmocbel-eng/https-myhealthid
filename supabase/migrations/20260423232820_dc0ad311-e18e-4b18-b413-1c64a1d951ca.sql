
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS responsavel_id uuid NULL REFERENCES public.equipe_membros(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tipo_pagamento text NOT NULL DEFAULT 'particular',
  ADD COLUMN IF NOT EXISTS plano_saude text NULL;

ALTER TABLE public.pacientes
  DROP CONSTRAINT IF EXISTS pacientes_tipo_pagamento_check;

ALTER TABLE public.pacientes
  ADD CONSTRAINT pacientes_tipo_pagamento_check
  CHECK (tipo_pagamento IN ('particular','plano'));

ALTER TABLE public.pacientes
  DROP CONSTRAINT IF EXISTS pacientes_plano_saude_check;

ALTER TABLE public.pacientes
  ADD CONSTRAINT pacientes_plano_saude_check
  CHECK (plano_saude IS NULL OR plano_saude IN ('FUSEX','CASSI','TRT'));

CREATE INDEX IF NOT EXISTS idx_pacientes_responsavel_id ON public.pacientes(responsavel_id);
