-- Segurança (D): só a equipe científica (inclui o super admin) edita ou apaga o catálogo compartilhado de exercícios.
--
-- Antes: qualquer usuário logado, inclusive paciente do plano gratuito, podia editar e apagar exercícios que todos usam
-- (migração 20260712160000 deixou o TODO de restringir a um papel de admin da plataforma). A leitura continua pública
-- ("Todos leem exercícios"). A tela /catalogo-evidencia passa a esconder aprovar/remover de quem não é da equipe.
drop policy if exists "Autenticados editam exercicios catalogo" on public.exercicios_biblioteca;
drop policy if exists "Autenticados apagam exercicios catalogo" on public.exercicios_biblioteca;
drop policy if exists "Equipe cientifica edita catalogo de exercicios" on public.exercicios_biblioteca;
drop policy if exists "Equipe cientifica apaga catalogo de exercicios" on public.exercicios_biblioteca;

create policy "Equipe cientifica edita catalogo de exercicios" on public.exercicios_biblioteca
  for update to authenticated
  using ((select public.eh_equipe_cientifica()))
  with check ((select public.eh_equipe_cientifica()));

create policy "Equipe cientifica apaga catalogo de exercicios" on public.exercicios_biblioteca
  for delete to authenticated
  using ((select public.eh_equipe_cientifica()));
