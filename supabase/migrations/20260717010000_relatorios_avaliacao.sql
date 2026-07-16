-- Relatório de Avaliação: pontos fortes e a melhorar do cliente, gerado
-- automaticamente quando ele conclui o MyID (e regenerável pelo profissional).
-- Junta MyID + avatar clínico + métricas físicas numa devolutiva acolhedora.
-- 1 relatório por paciente (regenerar substitui).
CREATE TABLE IF NOT EXISTS public.relatorios_avaliacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid,
  paciente_id uuid NOT NULL UNIQUE,
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  contexto jsonb,
  enviado_portal boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.relatorios_avaliacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Terapeuta gerencia relatorios" ON public.relatorios_avaliacao;
CREATE POLICY "Terapeuta gerencia relatorios" ON public.relatorios_avaliacao
  FOR ALL TO authenticated
  USING (paciente_id IN (SELECT id FROM public.pacientes WHERE terapeuta_id = auth.uid()))
  WITH CHECK (paciente_id IN (SELECT id FROM public.pacientes WHERE terapeuta_id = auth.uid()));

DROP POLICY IF EXISTS "Paciente ve relatorio enviado" ON public.relatorios_avaliacao;
CREATE POLICY "Paciente ve relatorio enviado" ON public.relatorios_avaliacao
  FOR SELECT TO authenticated
  USING (
    enviado_portal = true
    AND paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid())
  );
