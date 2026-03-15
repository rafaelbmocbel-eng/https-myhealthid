
-- RLS: Pacientes leem próprias evolucoes
CREATE POLICY "Pacientes leem propria evolucao"
ON public.evolucao_paciente
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = evolucao_paciente.paciente_id
      AND p.user_id = auth.uid()
  )
);

-- RLS: Pacientes leem próprias avaliacoes_identidade
CREATE POLICY "Pacientes leem proprias avaliacoes identidade"
ON public.avaliacoes_identidade
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = avaliacoes_identidade.paciente_id
      AND p.user_id = auth.uid()
  )
);
