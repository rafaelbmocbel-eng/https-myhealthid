
-- Allow therapists to UPDATE their own voice assessments (needed for editing AI-generated fields)
CREATE POLICY "Terapeutas atualizam avaliacoes voz"
ON public.avaliacoes_voz
FOR UPDATE
TO authenticated
USING (auth.uid() = terapeuta_id)
WITH CHECK (auth.uid() = terapeuta_id);
