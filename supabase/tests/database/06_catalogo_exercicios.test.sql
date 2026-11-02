-- Catálogo de exercícios (`exercicios_biblioteca`): todos podem LER (a biblioteca aparece em planos e no portal), mas só a
-- equipe científica (e o super admin) edita ou apaga. Quem só está logado, e quem não está, não altera o catálogo.
begin;
select plan(13);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'terapeuta.a@teste.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'curadoria.b@teste.invalid');
insert into public.profiles (user_id, nome, equipe_cientifica) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Terapeuta A', false),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Curadoria B', true)
on conflict (user_id) do update set equipe_cientifica = excluded.equipe_cientifica;
insert into public.exercicios_biblioteca (id, nome, categoria) values
  ('e0000000-0000-4000-8000-000000000001', 'Exercício de teste 1', 'teste'),
  ('e0000000-0000-4000-8000-000000000002', 'Exercício de teste 2', 'teste'),
  ('e0000000-0000-4000-8000-000000000003', 'Exercício de teste 3', 'teste'),
  ('e0000000-0000-4000-8000-000000000004', 'Exercício de teste 4', 'teste-extra');

create function public._pgtap_afetadas(comando text) returns int language plpgsql as $$
declare n int;
begin
  execute 'with x as (' || comando || ' returning 1) select count(*) from x' into n;
  return n;
end $$;

-- ── Visitante sem login ──
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::int from public.exercicios_biblioteca where categoria = 'teste'), 3, 'visitante lê o catálogo (leitura continua pública)');
select is(public._pgtap_afetadas($$ update public.exercicios_biblioteca set nome = 'invadido' where categoria = 'teste' $$)
  + public._pgtap_afetadas($$ delete from public.exercicios_biblioteca where categoria = 'teste' $$), 0, 'visitante não altera nem apaga o catálogo');
select throws_ok($$ insert into public.exercicios_biblioteca (nome, categoria) values ('plantado por visitante', 'teste') $$, '42501', null,
  'visitante não cria exercício no catálogo');
reset role;

-- ── Terapeuta comum logada (A) ──
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.exercicios_biblioteca where categoria = 'teste'), 3, 'terapeuta comum lê o catálogo');
select is(public._pgtap_afetadas($$ update public.exercicios_biblioteca set nome = 'invadido' where categoria = 'teste' $$), 0, 'terapeuta comum não edita o catálogo');
select is(public._pgtap_afetadas($$ delete from public.exercicios_biblioteca where categoria = 'teste' $$), 0, 'terapeuta comum não apaga do catálogo');
select throws_ok($$ insert into public.exercicios_biblioteca (nome, categoria) values ('plantado', 'teste') $$, '42501', null,
  'terapeuta comum não cria exercício direto no catálogo');
reset role;
select is((select count(*)::int from public.exercicios_biblioteca where categoria = 'teste' and nome like 'Exercício de teste %'), 3,
  'o catálogo segue intacto depois das tentativas de quem não é da curadoria');

-- ── Equipe científica (B) ──
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select is(public._pgtap_afetadas($$ update public.exercicios_biblioteca set nome = 'Revisado pela curadoria' where id = 'e0000000-0000-4000-8000-000000000001' $$), 1,
  'a equipe científica edita o catálogo');
select is(public._pgtap_afetadas($$ delete from public.exercicios_biblioteca where id = 'e0000000-0000-4000-8000-000000000002' $$), 1,
  'a equipe científica apaga do catálogo');
reset role;

-- ── Super admin (e-mail do dono no token), mesmo sem o selo de equipe científica ──
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated","email":"rafaelbmocbel@gmail.com"}', true);
set local role authenticated;
select is(public._pgtap_afetadas($$ update public.exercicios_biblioteca set nome = 'Revisado pelo dono' where id = 'e0000000-0000-4000-8000-000000000003' $$), 1,
  'o super admin edita o catálogo');
select is(public._pgtap_afetadas($$ delete from public.exercicios_biblioteca where id = 'e0000000-0000-4000-8000-000000000004' $$), 1,
  'o super admin apaga do catálogo');
reset role;

select is((select count(*)::int from public.exercicios_biblioteca where categoria = 'teste'), 2, 'ao final restam os dois exercícios que a curadoria não apagou');

select * from finish();
rollback;
