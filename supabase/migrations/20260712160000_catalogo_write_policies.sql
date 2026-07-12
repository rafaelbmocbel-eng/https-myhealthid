-- Permite ao profissional autenticado revisar o catálogo terapêutico (aprovar,
-- editar, remover os exercícios gerados por IA). A leitura já é pública ("Todos
-- leem exercícios"). Catálogo é COMPARTILHADO (sem terapeuta_id) — curadoria da
-- plataforma. TODO futuro: restringir escrita a um papel de admin da plataforma.
DROP POLICY IF EXISTS "Autenticados editam exercicios catalogo" ON public.exercicios_biblioteca;
CREATE POLICY "Autenticados editam exercicios catalogo" ON public.exercicios_biblioteca
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Autenticados apagam exercicios catalogo" ON public.exercicios_biblioteca;
CREATE POLICY "Autenticados apagam exercicios catalogo" ON public.exercicios_biblioteca
  FOR DELETE TO authenticated USING (true);
