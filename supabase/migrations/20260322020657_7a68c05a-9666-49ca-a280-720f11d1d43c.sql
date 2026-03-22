
CREATE POLICY "Pacientes atualizam status próprias sessões"
  ON public.controle_sessoes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = controle_sessoes.paciente_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pacientes p
      WHERE p.id = controle_sessoes.paciente_id
        AND p.user_id = auth.uid()
    )
    AND status IN ('pendente', 'cancelada')
  );
