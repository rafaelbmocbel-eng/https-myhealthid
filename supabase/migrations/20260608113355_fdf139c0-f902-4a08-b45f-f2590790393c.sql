
-- Sprint D: Nutrição
CREATE TABLE IF NOT EXISTS public.recordatorios_24h (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id UUID NOT NULL,
  data_referencia DATE NOT NULL DEFAULT CURRENT_DATE,
  refeicoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  totais JSONB,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rec24_paciente ON public.recordatorios_24h(paciente_id, data_referencia DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recordatorios_24h TO authenticated;
GRANT ALL ON public.recordatorios_24h TO service_role;
ALTER TABLE public.recordatorios_24h ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rec24_owner" ON public.recordatorios_24h FOR ALL USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

CREATE TABLE IF NOT EXISTS public.planos_alimentares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  objetivo TEXT,
  calorias_alvo INT,
  macros_alvo JSONB,
  plano JSONB NOT NULL,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_planoali_paciente ON public.planos_alimentares(paciente_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planos_alimentares TO authenticated;
GRANT ALL ON public.planos_alimentares TO service_role;
ALTER TABLE public.planos_alimentares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planoali_owner" ON public.planos_alimentares FOR ALL USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

-- Trigger updated_at (reusa função existente se houver)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $f$
    BEGIN NEW.updated_at = now(); RETURN NEW; END;
    $f$ LANGUAGE plpgsql SET search_path = public;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_rec24_upd ON public.recordatorios_24h;
CREATE TRIGGER trg_rec24_upd BEFORE UPDATE ON public.recordatorios_24h
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_planoali_upd ON public.planos_alimentares;
CREATE TRIGGER trg_planoali_upd BEFORE UPDATE ON public.planos_alimentares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ativar blocos nutrição na lente nutricionista
UPDATE public.perfis_profissionais
SET blocos_ativos = blocos_ativos
  || (CASE WHEN blocos_ativos ? 'recordatorio' THEN '[]'::jsonb ELSE '["recordatorio"]'::jsonb END)
  || (CASE WHEN blocos_ativos ? 'plano_alimentar' THEN '[]'::jsonb ELSE '["plano_alimentar"]'::jsonb END)
WHERE id = 'nutricionista';
