
CREATE TABLE IF NOT EXISTS public.escalas_psicologia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id uuid NOT NULL,
  tipo_escala text NOT NULL CHECK (tipo_escala IN ('phq9','gad7','pss10')),
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  pontuacao_total integer NOT NULL DEFAULT 0,
  classificacao text,
  severidade text CHECK (severidade IN ('minima','leve','moderada','moderadamente_grave','grave')),
  observacoes text,
  data_aplicacao timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.escalas_psicologia TO authenticated;
GRANT ALL ON public.escalas_psicologia TO service_role;

ALTER TABLE public.escalas_psicologia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta gerencia suas escalas"
  ON public.escalas_psicologia FOR ALL
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE INDEX IF NOT EXISTS idx_escalas_psi_paciente ON public.escalas_psicologia(paciente_id, data_aplicacao DESC);
CREATE INDEX IF NOT EXISTS idx_escalas_psi_terapeuta ON public.escalas_psicologia(terapeuta_id);

CREATE TRIGGER trg_escalas_psi_updated
  BEFORE UPDATE ON public.escalas_psicologia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ativa bloco na lente psicólogo
UPDATE public.perfis_profissionais
SET blocos_ativos = (
  CASE
    WHEN blocos_ativos ? 'escalas_psicologia' THEN blocos_ativos
    ELSE blocos_ativos || '["escalas_psicologia"]'::jsonb
  END
)
WHERE id = 'psicologo';
