-- Remove the dangerous anon SELECT policy that uses USING(true)
DROP POLICY IF EXISTS "Acesso público via token específico" ON public.myid_avaliacoes;

-- Remove the dangerous anon UPDATE policy without token validation
DROP POLICY IF EXISTS "Atualização anon via status pendente" ON public.myid_avaliacoes;