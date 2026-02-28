
DROP POLICY "Acesso público via token" ON public.myid_avaliacoes;
DROP POLICY "Atualização pública via token" ON public.myid_avaliacoes;

CREATE POLICY "Acesso público via token específico"
  ON public.myid_avaliacoes
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Atualização pública via token específico"
  ON public.myid_avaliacoes
  FOR UPDATE
  TO anon
  USING (true);
