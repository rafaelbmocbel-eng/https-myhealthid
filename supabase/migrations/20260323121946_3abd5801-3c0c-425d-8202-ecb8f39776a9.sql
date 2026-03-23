-- Allow authenticated patients to read active events from their therapist
CREATE POLICY "Pacientes leem eventos do terapeuta"
ON public.eventos FOR SELECT
TO authenticated
USING (
  ativo = true AND EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.user_id = auth.uid()
      AND p.terapeuta_id = eventos.terapeuta_id
      AND p.ativo = true
  )
);

-- Allow authenticated patients to read their own inscriptions
CREATE POLICY "Pacientes leem proprias inscricoes"
ON public.evento_inscricoes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.user_id = auth.uid()
      AND p.id = evento_inscricoes.paciente_id
  )
);

-- Allow authenticated patients to read event questions
CREATE POLICY "Pacientes leem perguntas de eventos"
ON public.evento_perguntas FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.eventos e
    JOIN public.pacientes p ON p.terapeuta_id = e.terapeuta_id
    WHERE e.id = evento_perguntas.evento_id
      AND e.ativo = true
      AND p.user_id = auth.uid()
      AND p.ativo = true
  )
);