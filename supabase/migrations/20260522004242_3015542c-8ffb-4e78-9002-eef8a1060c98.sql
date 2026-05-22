
ALTER TABLE public.pacientes         ADD COLUMN IF NOT EXISTS origem_utm jsonb;
ALTER TABLE public.funil_leads       ADD COLUMN IF NOT EXISTS origem_utm jsonb;
ALTER TABLE public.evento_inscricoes ADD COLUMN IF NOT EXISTS origem_utm jsonb;
ALTER TABLE public.whatsapp_conversas ADD COLUMN IF NOT EXISTS origem_utm jsonb;

CREATE INDEX IF NOT EXISTS idx_pacientes_origem_utm    ON public.pacientes        USING gin (origem_utm);
CREATE INDEX IF NOT EXISTS idx_funil_leads_origem_utm  ON public.funil_leads      USING gin (origem_utm);
CREATE INDEX IF NOT EXISTS idx_evento_insc_origem_utm  ON public.evento_inscricoes USING gin (origem_utm);
CREATE INDEX IF NOT EXISTS idx_wa_conv_origem_utm      ON public.whatsapp_conversas USING gin (origem_utm);
