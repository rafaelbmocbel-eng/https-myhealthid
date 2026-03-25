CREATE POLICY "Terapeutas atualizam notas"
ON public.notas_prontuario
FOR UPDATE
TO authenticated
USING (auth.uid() = terapeuta_id)
WITH CHECK (auth.uid() = terapeuta_id);