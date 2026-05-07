-- Permite que pacientes criem seu próprio termo LGPD diretamente do portal
CREATE POLICY "Pacientes criam próprio termo"
ON public.termos_consentimento
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = termos_consentimento.paciente_id
      AND p.user_id = auth.uid()
      AND p.terapeuta_id = termos_consentimento.terapeuta_id
  )
);