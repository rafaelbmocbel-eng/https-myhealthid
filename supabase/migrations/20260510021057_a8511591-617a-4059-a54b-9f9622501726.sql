ALTER TABLE public.protocolos
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_protocolos_origem ON public.protocolos(origem);

COMMENT ON COLUMN public.protocolos.origem IS 'Origem da diretriz: manual | ia_voz | ia_escrita | ia_myid | ia_cobzero | ia_editada';