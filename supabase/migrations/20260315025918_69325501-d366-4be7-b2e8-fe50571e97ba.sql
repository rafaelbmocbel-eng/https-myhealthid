
-- Pacientes leem treinos publicados para eles
CREATE POLICY "Pacientes leem treinos publicados"
ON public.studio_treinos
FOR SELECT
TO authenticated
USING (
  publicado = true AND EXISTS (
    SELECT 1 FROM pacientes p
    WHERE p.id = studio_treinos.paciente_id AND p.user_id = auth.uid()
  )
);

-- Pacientes leem exercícios dos treinos publicados
CREATE POLICY "Pacientes leem exercicios dos treinos"
ON public.studio_treino_exercicios
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM studio_treinos t
    JOIN pacientes p ON p.id = t.paciente_id
    WHERE t.id = studio_treino_exercicios.treino_id
      AND t.publicado = true
      AND p.user_id = auth.uid()
  )
);

-- Pacientes leem próprias execuções
CREATE POLICY "Pacientes leem proprias execucoes"
ON public.studio_execucoes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pacientes p
    WHERE p.id = studio_execucoes.paciente_id AND p.user_id = auth.uid()
  )
);

-- Pacientes inserem próprias execuções
CREATE POLICY "Pacientes inserem proprias execucoes"
ON public.studio_execucoes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM pacientes p
    WHERE p.id = studio_execucoes.paciente_id AND p.user_id = auth.uid()
      AND p.terapeuta_id = studio_execucoes.terapeuta_id
  )
);

-- Pacientes atualizam próprias execuções
CREATE POLICY "Pacientes atualizam proprias execucoes"
ON public.studio_execucoes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM pacientes p
    WHERE p.id = studio_execucoes.paciente_id AND p.user_id = auth.uid()
  )
);

-- Pacientes leem exercícios das próprias execuções
CREATE POLICY "Pacientes leem exec exercicios"
ON public.studio_execucao_exercicios
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM studio_execucoes e
    JOIN pacientes p ON p.id = e.paciente_id
    WHERE e.id = studio_execucao_exercicios.execucao_id AND p.user_id = auth.uid()
  )
);

-- Pacientes inserem exercícios nas próprias execuções
CREATE POLICY "Pacientes inserem exec exercicios"
ON public.studio_execucao_exercicios
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM studio_execucoes e
    JOIN pacientes p ON p.id = e.paciente_id
    WHERE e.id = studio_execucao_exercicios.execucao_id AND p.user_id = auth.uid()
  )
);
