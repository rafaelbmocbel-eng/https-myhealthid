-- O paciente logado nunca teve permissão de LER as próprias avaliações MyID:
-- as policies cobriam terapeuta (tudo), público via token e paciente só UPDATE.
-- Por isso o questionário criado pelo botão "Iniciar MyID" nascia invisível e
-- a lista ficava vazia. Concede SELECT das próprias avaliações.
DROP POLICY IF EXISTS "Paciente ve proprias avaliacoes MyID" ON public.myid_avaliacoes;
CREATE POLICY "Paciente ve proprias avaliacoes MyID"
ON public.myid_avaliacoes
FOR SELECT
TO authenticated
USING (
  paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid())
);
