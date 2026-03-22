-- Allow patients to update their own appointments (reschedule/cancel)
CREATE POLICY "Pacientes editam próprios agendamentos"
  ON public.agendamentos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = agendamentos.paciente_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = agendamentos.paciente_id
        AND p.user_id = auth.uid()
    )
    AND status IN ('pendente', 'cancelado')
  );
