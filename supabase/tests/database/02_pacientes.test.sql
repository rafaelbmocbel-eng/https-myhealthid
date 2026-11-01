-- Isolamento da tabela `pacientes`: cada terapeuta vê e altera só os próprios; o paciente do portal vê só o próprio
-- cadastro; visitante sem login não vê nada. Também prova as travas por coluna (tipo_conta, vínculo com terapeuta).
begin;
select plan(15);

-- Dados de teste (rodam como dono do banco; o rollback no fim desfaz tudo)
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'terapeuta.a@teste.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'terapeuta.b@teste.invalid'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'paciente.p@teste.invalid');
insert into public.pacientes (id, terapeuta_id, nome, user_id) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Paciente da A', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Paciente da B', null);

-- Conta quantas linhas um comando de escrita atinge SOB o papel atual (RLS valendo)
create function public._pgtap_afetadas(comando text) returns int language plpgsql as $$
declare n int;
begin
  execute 'with x as (' || comando || ' returning 1) select count(*) from x' into n;
  return n;
end $$;

-- ── Terapeuta A ──
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.pacientes), 1, 'A vê só 1 paciente (o dela)');
select is((select count(*)::int from public.pacientes where id = '22222222-2222-4222-8222-222222222222'), 0, 'A não vê o paciente da B');
reset role;

-- ── Terapeuta B ──
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.pacientes), 1, 'B vê só 1 paciente (o dele)');
select is((select count(*)::int from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), 0, 'B não vê o paciente da A');
select is(public._pgtap_afetadas($$ update public.pacientes set nome = 'invadido' where id = '11111111-1111-4111-8111-111111111111' $$), 0, 'B não consegue alterar paciente da A');
select is(public._pgtap_afetadas($$ delete from public.pacientes where id = '11111111-1111-4111-8111-111111111111' $$), 0, 'B não consegue apagar paciente da A');
select throws_ok($$ insert into public.pacientes (terapeuta_id, nome) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'plantado na A') $$,
  '42501', null, 'B não consegue criar paciente na lista da A');
reset role;

-- ── Visitante sem login ──
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::int from public.pacientes), 0, 'visitante sem login não vê paciente nenhum');
select throws_ok($$ insert into public.pacientes (terapeuta_id, nome) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'anonimo') $$,
  '42501', null, 'visitante sem login não consegue criar paciente');
reset role;

-- ── Paciente do portal (usuário P, cadastro ligado à terapeuta A) ──
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.pacientes), 1, 'o paciente vê só o próprio cadastro');
select is((select count(*)::int from public.pacientes where id = '22222222-2222-4222-8222-222222222222'), 0, 'o paciente não vê o cadastro de outro paciente');

update public.pacientes set tipo_conta = 'wellness_premium' where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
update public.pacientes set terapeuta_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
reset role;
select is((select tipo_conta from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), 'clinico',
  'o paciente não consegue se promover a conta premium sozinho (trava por coluna)');
select is((select terapeuta_id from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'o paciente não consegue virar o próprio terapeuta (trava por coluna)');

-- PROBLEMAS CONHECIDOS (provados no banco local; ver docs/seguranca-rls-achados.md)
set local role authenticated;
update public.pacientes set xp_total = 999999 where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
update public.pacientes set terapeuta_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
reset role;
select todo_start('paciente altera XP e vínculo com o terapeuta direto na tabela (ver docs/seguranca-rls-achados.md)');
select is((select xp_total from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), 0,
  'o paciente não consegue dar XP a si mesmo');
select is((select terapeuta_id from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'o paciente não consegue transferir o próprio cadastro para outro terapeuta');
select todo_end();

select * from finish();
rollback;
