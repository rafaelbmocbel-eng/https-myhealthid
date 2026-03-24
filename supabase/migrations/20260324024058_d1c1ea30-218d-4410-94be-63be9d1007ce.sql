-- Allow anon users to read evento_respostas for option counting on public form
CREATE POLICY "Anon lê respostas de eventos ativos"
ON public.evento_respostas
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1
    FROM evento_inscricoes ei
    JOIN eventos e ON e.id = ei.evento_id
    WHERE ei.id = evento_respostas.inscricao_id
      AND e.ativo = true
  )
);