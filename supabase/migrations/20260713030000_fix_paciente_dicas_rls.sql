-- A leitura do profissional dependia do terapeuta_id GRAVADO na linha de
-- paciente_dicas; se vier nulo/divergente, o registro existe mas o profissional
-- não vê ("criou mas não aparece"). Passa a valer o vínculo REAL: o profissional
-- lê as dicas de qualquer paciente que é dele (pacientes.terapeuta_id).
DROP POLICY IF EXISTS "Terapeuta ve dicas dos seus pacientes" ON public.paciente_dicas;
CREATE POLICY "Terapeuta ve dicas dos seus pacientes" ON public.paciente_dicas
  FOR SELECT USING (
    terapeuta_id = auth.uid()
    OR paciente_id IN (SELECT id FROM public.pacientes WHERE terapeuta_id = auth.uid())
  );

-- Backfill defensivo: corrige linhas com terapeuta_id nulo/errado.
UPDATE public.paciente_dicas d
SET terapeuta_id = p.terapeuta_id
FROM public.pacientes p
WHERE p.id = d.paciente_id
  AND (d.terapeuta_id IS NULL OR d.terapeuta_id <> p.terapeuta_id);
