-- Perfis profissionais: cada pessoa vê e edita só o próprio perfil, e não consegue conceder a si mesma selo de
-- verificação, equipe científica nem áreas (campos que liberam chancela de planos e conteúdo clínico).
begin;
select plan(10);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'terapeuta.a@teste.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'terapeuta.b@teste.invalid');
insert into public.profiles (user_id, nome) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Terapeuta A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Terapeuta B')
on conflict do nothing;

create function public._pgtap_afetadas(comando text) returns int language plpgsql as $$
declare n int;
begin
  execute 'with x as (' || comando || ' returning 1) select count(*) from x' into n;
  return n;
end $$;

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.profiles where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1, 'A vê o próprio perfil');
select is((select count(*)::int from public.profiles where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 0, 'A não vê o perfil da B');
select is(public.eh_super_admin(), false, 'usuário comum não é super admin');
update public.profiles set verificado = true, equipe_cientifica = true, equipe_areas = array['treino']
  where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
reset role;
select is((select verificado from public.profiles where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), false, 'A não consegue se autoverificar');
select is((select equipe_cientifica from public.profiles where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), false, 'A não consegue se promover à equipe científica');
select is((select equipe_areas from public.profiles where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), '{}'::text[], 'A não consegue conceder áreas de chancela a si mesma');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select is(public._pgtap_afetadas($$ update public.profiles set nome = 'invadido' where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $$), 0, 'B não consegue alterar o perfil da A');
select throws_ok($$ insert into public.profiles (user_id, nome) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'duplicado em nome da A') $$,
  '42501', null, 'B não consegue criar perfil em nome da A');
reset role;

select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::int from public.profiles), 0, 'visitante sem login não vê perfil nenhum');
select throws_ok($$ insert into public.profiles (user_id, nome) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'anônimo') $$,
  '42501', null, 'visitante sem login não consegue criar perfil');
reset role;

select * from finish();
rollback;
