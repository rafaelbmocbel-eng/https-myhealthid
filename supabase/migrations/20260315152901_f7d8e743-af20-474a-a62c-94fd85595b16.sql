CREATE POLICY "Pacientes atualizam próprias avaliacoes MyID"
ON public.myid_avaliacoes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pacientes p
    WHERE p.id = myid_avaliacoes.paciente_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pacientes p
    WHERE p.id = myid_avaliacoes.paciente_id
      AND p.user_id = auth.uid()
  )
);