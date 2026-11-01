-- Links públicos de avaliação e de agenda (token enviado ao paciente). A página pública de avaliação usa as Edge Functions
-- `validar-token-avaliacao` e `salvar-bloco-avaliacao` (service role) e a de agenda usa RPCs por token; mesmo assim as
-- tabelas têm políticas de leitura/escrita abertas a quem não está logado. Os testes marcados com todo provam o problema.
begin;
select plan(10);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'terapeuta.a@teste.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'terapeuta.b@teste.invalid');
insert into public.pacientes (id, terapeuta_id, nome) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Paciente da A');
insert into public.links_avaliacao (id, paciente_id, terapeuta_id, token, status, data_expiracao) values
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'TOKEN-AVALIACAO-DA-A', 'ativo', now() + interval '7 days');
insert into public.respostas_avaliacao_paciente (link_id, paciente_id, bloco_numero, dados_respostas) values
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 1, '{"dor":"lombar intensa"}'::jsonb);
insert into public.links_agenda_paciente (id, paciente_id, terapeuta_id, token, status, data_expiracao) values
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'TOKEN-AGENDA-DA-A', 'ativo', now() + interval '1 day');

create function public._pgtap_afetadas(comando text) returns int language plpgsql as $$
declare n int;
begin
  execute 'with x as (' || comando || ' returning 1) select count(*) from x' into n;
  return n;
end $$;

-- ── Dona dos links (terapeuta A) ──
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.links_avaliacao where id = '33333333-3333-4333-8333-333333333333'), 1, 'A vê o próprio link de avaliação');
select is((select count(*)::int from public.respostas_avaliacao_paciente), 1, 'A vê as respostas do próprio paciente');
select is((select count(*)::int from public.links_agenda_paciente where id = '44444444-4444-4444-8444-444444444444'), 1, 'A vê o próprio link de agenda');
reset role;

-- ── Visitante sem login: só pode inserir resposta para link válido, e nada mais ──
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$ insert into public.respostas_avaliacao_paciente (link_id, paciente_id, bloco_numero, dados_respostas)
  values ('99999999-9999-4999-8999-999999999999', '11111111-1111-4111-8111-111111111111', 1, '{}'::jsonb) $$,
  '42501', null, 'visitante não consegue inserir resposta para um link que não existe');

select todo_start('leitura e escrita públicas nas tabelas de link (ver docs/seguranca-rls-achados.md)');
select is((select count(*)::int from public.links_avaliacao), 0, 'visitante sem login não lista links de avaliação (nem os tokens)');
select is((select count(*)::int from public.respostas_avaliacao_paciente), 0, 'visitante sem login não lê respostas de pacientes');
select is((select count(*)::int from public.links_agenda_paciente), 0, 'visitante sem login não lista links de agenda (nem os tokens)');
select is(public._pgtap_afetadas($$ update public.links_agenda_paciente set data_expiracao = now() + interval '3650 days', terapeuta_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$), 0,
  'visitante sem login não consegue reescrever um link de agenda ativo');
select todo_end();
reset role;

-- ── Outro terapeuta logado (B) ──
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select todo_start('qualquer terapeuta logado lê links e respostas de outro (ver docs/seguranca-rls-achados.md)');
select is((select count(*)::int from public.respostas_avaliacao_paciente), 0, 'B não lê respostas dos pacientes da A');
select is((select count(*)::int from public.links_avaliacao where terapeuta_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 0, 'B não vê links de avaliação da A');
select todo_end();
reset role;

select * from finish();
rollback;
