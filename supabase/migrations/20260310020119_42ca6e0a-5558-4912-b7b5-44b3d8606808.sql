-- Allow therapists to delete their own MyID evaluations
CREATE POLICY "Terapeutas deletam suas avaliações MyID"
ON public.myid_avaliacoes
FOR DELETE
TO authenticated
USING (auth.uid() = terapeuta_id);

-- Allow therapists to delete evolution records
CREATE POLICY "service_role pode deletar evolucao"
ON public.evolucao_paciente
FOR DELETE
TO authenticated
USING (auth.uid() = terapeuta_id);