CREATE POLICY "Pacientes leem config do seu terapeuta"
ON public.funil_config
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.terapeuta_id = funil_config.terapeuta_id
      AND p.user_id = auth.uid()
  )
);