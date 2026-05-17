
ALTER TABLE public.agente_broadcasts
  ADD COLUMN IF NOT EXISTS agendado_para timestamptz,
  ADD COLUMN IF NOT EXISTS ab_variantes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resultado_variantes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS hsm_template_id uuid;

CREATE INDEX IF NOT EXISTS idx_broadcasts_agendados
  ON public.agente_broadcasts (agendado_para)
  WHERE status = 'agendado' AND agendado_para IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_hsm_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  nome text NOT NULL,
  idioma text NOT NULL DEFAULT 'pt_BR',
  categoria text NOT NULL DEFAULT 'MARKETING',
  conteudo text NOT NULL,
  variaveis jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'rascunho',
  meta_template_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (terapeuta_id, nome, idioma)
);

ALTER TABLE public.whatsapp_hsm_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terapeuta gerencia HSM" ON public.whatsapp_hsm_templates
  FOR ALL USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

CREATE TRIGGER trg_hsm_templates_updated
  BEFORE UPDATE ON public.whatsapp_hsm_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
