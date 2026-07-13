-- Dicas/exercícios de evidência gerados AUTOMATICAMENTE por paciente, toda vez
-- que ele conclui um MyID (+ histórico). Personalizado (MyID + história + PubMed).
-- 1 registro por paciente (o mais recente).
CREATE TABLE IF NOT EXISTS public.paciente_dicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL,
  terapeuta_id uuid,
  dicas jsonb NOT NULL DEFAULT '[]'::jsonb,
  gerado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_paciente_dicas_paciente ON public.paciente_dicas (paciente_id);

ALTER TABLE public.paciente_dicas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Paciente ve suas dicas" ON public.paciente_dicas;
CREATE POLICY "Paciente ve suas dicas" ON public.paciente_dicas
  FOR SELECT USING (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Terapeuta ve dicas dos seus pacientes" ON public.paciente_dicas;
CREATE POLICY "Terapeuta ve dicas dos seus pacientes" ON public.paciente_dicas
  FOR SELECT USING (terapeuta_id = auth.uid());
-- Escrita apenas via service_role (função gerar-dicas-paciente).
