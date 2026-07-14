-- Diretrizes profissionais: o MOLDE ÚNICO "profissional cria → cliente recebe"
-- para todas as áreas (nutrição, educação física, ...), no mesmo espírito da
-- diretriz de fisioterapia. A IA gera o rascunho a partir de exames +
-- bioimpedância + anamnese + MyID; o profissional revisa e envia ao portal.
CREATE TABLE IF NOT EXISTS public.diretrizes_profissionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  area text NOT NULL DEFAULT 'nutricao',
  titulo text NOT NULL,
  objetivo text,
  status text NOT NULL DEFAULT 'rascunho',
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  contexto jsonb,
  enviada_portal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (terapeuta_id, paciente_id, area)
);

ALTER TABLE public.diretrizes_profissionais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Terapeuta gerencia suas diretrizes" ON public.diretrizes_profissionais;
CREATE POLICY "Terapeuta gerencia suas diretrizes" ON public.diretrizes_profissionais
  FOR ALL USING (terapeuta_id = auth.uid()) WITH CHECK (terapeuta_id = auth.uid());

-- O paciente SÓ enxerga o que o profissional enviou ao portal.
DROP POLICY IF EXISTS "Paciente ve diretriz enviada ao portal" ON public.diretrizes_profissionais;
CREATE POLICY "Paciente ve diretriz enviada ao portal" ON public.diretrizes_profissionais
  FOR SELECT USING (
    enviada_portal = true
    AND paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_diretrizes_prof_paciente
  ON public.diretrizes_profissionais (paciente_id, area, enviada_portal);
