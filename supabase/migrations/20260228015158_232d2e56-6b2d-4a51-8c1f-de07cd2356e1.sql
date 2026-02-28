
DROP POLICY "Atualização pública via token específico" ON public.myid_avaliacoes;

CREATE POLICY "Atualização anon via status pendente"
  ON public.myid_avaliacoes
  FOR UPDATE
  TO anon
  USING (status IN ('pendente', 'em_andamento'));
