
-- garantir extensão pg_trgm ANTES de qualquer índice trigram
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- CID-10 catálogo
-- ============================================
CREATE TABLE IF NOT EXISTS public.cid10_catalogo (
  codigo TEXT PRIMARY KEY,
  descricao TEXT NOT NULL,
  categoria TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cid10_catalogo TO authenticated;
GRANT ALL ON public.cid10_catalogo TO service_role;
ALTER TABLE public.cid10_catalogo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cid10_select_auth" ON public.cid10_catalogo;
CREATE POLICY "cid10_select_auth" ON public.cid10_catalogo
  FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS cid10_descricao_trgm_idx
  ON public.cid10_catalogo USING gin (descricao gin_trgm_ops);

-- ============================================
-- Medicamentos catálogo
-- ============================================
CREATE TABLE IF NOT EXISTS public.medicamentos_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  principio_ativo TEXT,
  apresentacao TEXT,
  posologia_sugerida TEXT,
  classe TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.medicamentos_catalogo TO authenticated;
GRANT ALL ON public.medicamentos_catalogo TO service_role;
ALTER TABLE public.medicamentos_catalogo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "medicamentos_select_auth" ON public.medicamentos_catalogo;
CREATE POLICY "medicamentos_select_auth" ON public.medicamentos_catalogo
  FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS medicamentos_nome_trgm_idx
  ON public.medicamentos_catalogo USING gin (nome gin_trgm_ops);

-- ============================================
-- Exames importados
-- ============================================
CREATE TABLE IF NOT EXISTS public.exames_importados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id UUID NOT NULL,
  paciente_id UUID NOT NULL,
  tipo TEXT,
  data_exame DATE,
  arquivo_url TEXT,
  dados_extraidos JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pendente',
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exames_importados TO authenticated;
GRANT ALL ON public.exames_importados TO service_role;
ALTER TABLE public.exames_importados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exames_select_own" ON public.exames_importados;
CREATE POLICY "exames_select_own" ON public.exames_importados
  FOR SELECT TO authenticated USING (terapeuta_id = auth.uid());
DROP POLICY IF EXISTS "exames_insert_own" ON public.exames_importados;
CREATE POLICY "exames_insert_own" ON public.exames_importados
  FOR INSERT TO authenticated WITH CHECK (terapeuta_id = auth.uid());
DROP POLICY IF EXISTS "exames_update_own" ON public.exames_importados;
CREATE POLICY "exames_update_own" ON public.exames_importados
  FOR UPDATE TO authenticated USING (terapeuta_id = auth.uid());
DROP POLICY IF EXISTS "exames_delete_own" ON public.exames_importados;
CREATE POLICY "exames_delete_own" ON public.exames_importados
  FOR DELETE TO authenticated USING (terapeuta_id = auth.uid());
CREATE INDEX IF NOT EXISTS exames_paciente_idx
  ON public.exames_importados (paciente_id, data_exame DESC);

-- ============================================
-- Sinais Vitais
-- ============================================
CREATE TABLE IF NOT EXISTS public.sinais_vitais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id UUID NOT NULL,
  paciente_id UUID NOT NULL,
  medido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  pa_sistolica INTEGER,
  pa_diastolica INTEGER,
  fc INTEGER,
  temperatura NUMERIC(4,1),
  spo2 INTEGER,
  peso_kg NUMERIC(5,2),
  altura_cm NUMERIC(5,1),
  glicemia INTEGER,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sinais_vitais TO authenticated;
GRANT ALL ON public.sinais_vitais TO service_role;
ALTER TABLE public.sinais_vitais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sv_select_own" ON public.sinais_vitais;
CREATE POLICY "sv_select_own" ON public.sinais_vitais
  FOR SELECT TO authenticated USING (terapeuta_id = auth.uid());
DROP POLICY IF EXISTS "sv_insert_own" ON public.sinais_vitais;
CREATE POLICY "sv_insert_own" ON public.sinais_vitais
  FOR INSERT TO authenticated WITH CHECK (terapeuta_id = auth.uid());
DROP POLICY IF EXISTS "sv_update_own" ON public.sinais_vitais;
CREATE POLICY "sv_update_own" ON public.sinais_vitais
  FOR UPDATE TO authenticated USING (terapeuta_id = auth.uid());
DROP POLICY IF EXISTS "sv_delete_own" ON public.sinais_vitais;
CREATE POLICY "sv_delete_own" ON public.sinais_vitais
  FOR DELETE TO authenticated USING (terapeuta_id = auth.uid());
CREATE INDEX IF NOT EXISTS sv_paciente_idx
  ON public.sinais_vitais (paciente_id, medido_em DESC);

-- ============================================
-- Trigger updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $f$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$f$;

DROP TRIGGER IF EXISTS trg_exames_updated ON public.exames_importados;
CREATE TRIGGER trg_exames_updated BEFORE UPDATE ON public.exames_importados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_sv_updated ON public.sinais_vitais;
CREATE TRIGGER trg_sv_updated BEFORE UPDATE ON public.sinais_vitais
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
