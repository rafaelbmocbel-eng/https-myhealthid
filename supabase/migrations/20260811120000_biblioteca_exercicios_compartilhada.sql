-- Biblioteca de Exercícios COMPARTILHADA entre os profissionais.
-- Cada exercício continua pertencendo a quem o cadastrou (só o dono edita/remove),
-- mas por padrão fica visível para todos os profissionais — assim quem entra com
-- outra conta já encontra o banco de exercícios que já existe, sem começar do zero.
alter table public.biblioteca_exercicios
  add column if not exists compartilhado boolean not null default true;

-- Garante que os exercícios já cadastrados apareçam para todo mundo.
update public.biblioteca_exercicios set compartilhado = true where compartilhado is null;

-- Leitura: o dono vê os seus (mesmo privados) e qualquer um marcado como compartilhado.
drop policy if exists "Terapeuta ve sua biblioteca" on public.biblioteca_exercicios;
create policy "Ve biblioteca propria ou compartilhada" on public.biblioteca_exercicios
  for select using (terapeuta_id = auth.uid() or compartilhado = true);

-- Escrita (insert/update/delete) continua só do dono — as policies existentes já
-- cuidam disso; nada muda aqui.

notify pgrst, 'reload schema';
