-- Links públicos de avaliação e de agenda (token enviado ao paciente). As páginas públicas não leem as tabelas direto:
-- a avaliação usa as Edge Functions `validar-token-avaliacao` e `salvar-bloco-avaliacao` (service role) e a agenda usa
-- RPCs por token. Por isso quem não está logado não lê nem escreve nas tabelas de link; a única escrita pública que sobra
-- é o pedido de horário (`agendamentos`, sempre "pendente"), e só dentro de um link de agenda ativo.
begin;
select plan(21);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'terapeuta.a@teste.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'terapeuta.b@teste.invalid');
insert into public.pacientes (id, terapeuta_id, nome) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Paciente da A'),
  ('55555555-5555-4555-8555-555555555555', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Paciente da A com link vencido'),
  ('77777777-7777-4777-8777-777777777777', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Paciente da A com link cancelado');
insert into public.links_avaliacao (id, paciente_id, terapeuta_id, token, status, data_expiracao) values
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'TOKEN-AVALIACAO-DA-A', 'ativo', now() + interval '7 days');
insert into public.respostas_avaliacao_paciente (link_id, paciente_id, bloco_numero, dados_respostas) values
  ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 1, '{"dor":"lombar intensa"}'::jsonb);
insert into public.links_agenda_paciente (id, paciente_id, terapeuta_id, token, status, data_expiracao) values
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'TOKEN-AGENDA-DA-A', 'ativo', now() + interval '1 day'),
  ('66666666-6666-4666-8666-666666666666', '55555555-5555-4555-8555-555555555555', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'TOKEN-AGENDA-VENCIDO', 'ativo', now() - interval '1 day'),
  ('88888888-8888-4888-8888-888888888888', '77777777-7777-4777-8777-777777777777', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'TOKEN-AGENDA-CANCELADO', 'cancelado', now() + interval '30 days');

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

-- ── Visitante sem login: não lê nem escreve nas tabelas de link e de respostas ──
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is((select count(*)::int from public.links_avaliacao), 0, 'visitante sem login não lista links de avaliação (nem os tokens)');
select is((select count(*)::int from public.respostas_avaliacao_paciente), 0, 'visitante sem login não lê respostas de pacientes');
select is((select count(*)::int from public.links_agenda_paciente), 0, 'visitante sem login não lista links de agenda (nem os tokens)');
select is(public._pgtap_afetadas($$ update public.links_agenda_paciente set data_expiracao = now() + interval '3650 days', terapeuta_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' $$), 0,
  'visitante sem login não consegue reescrever um link de agenda ativo');
select throws_ok($$ insert into public.respostas_avaliacao_paciente (link_id, paciente_id, bloco_numero, dados_respostas)
  values ('99999999-9999-4999-8999-999999999999', '11111111-1111-4111-8111-111111111111', 1, '{}'::jsonb) $$,
  '42501', null, 'visitante não consegue inserir resposta para um link que não existe');
select throws_ok($$ insert into public.respostas_avaliacao_paciente (link_id, paciente_id, bloco_numero, dados_respostas)
  values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 2, '{"dor":"plantada"}'::jsonb) $$,
  '42501', null, 'nem com um link válido o visitante grava resposta direto na tabela (a gravação passa pela Edge Function)');

-- ── Pedido de horário pelo link de agenda (única escrita pública que sobra) ──
select lives_ok($$ insert into public.agendamentos (terapeuta_id, paciente_id, data_inicio, data_fim, status)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', now() + interval '2 days', now() + interval '2 days 1 hour', 'pendente') $$,
  'visitante com link de agenda ativo consegue pedir horário (fica pendente)');
select throws_ok($$ insert into public.agendamentos (terapeuta_id, paciente_id, data_inicio, data_fim, status)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', now() + interval '3 days', now() + interval '3 days 1 hour', 'confirmado') $$,
  '42501', null, 'visitante não consegue criar o horário já confirmado');
select throws_ok($$ insert into public.agendamentos (terapeuta_id, paciente_id, data_inicio, data_fim, status)
  values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', now() + interval '3 days', now() + interval '3 days 1 hour', 'pendente') $$,
  '42501', null, 'o link de uma terapeuta não serve para marcar horário na agenda de outra');
select throws_ok($$ insert into public.agendamentos (terapeuta_id, paciente_id, data_inicio, data_fim, status)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '55555555-5555-4555-8555-555555555555', now() + interval '3 days', now() + interval '3 days 1 hour', 'pendente') $$,
  '42501', null, 'link de agenda vencido não permite pedir horário');
select throws_ok($$ insert into public.agendamentos (terapeuta_id, paciente_id, data_inicio, data_fim, status)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '77777777-7777-4777-8777-777777777777', now() + interval '3 days', now() + interval '3 days 1 hour', 'pendente') $$,
  '42501', null, 'link de agenda cancelado (ainda dentro do prazo) não permite pedir horário');
select throws_ok($$ insert into public.agendamentos (terapeuta_id, paciente_id, data_inicio, data_fim, status)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', null, now() + interval '3 days', now() + interval '3 days 1 hour', 'pendente') $$,
  '42501', null, 'pedido de horário sem paciente ligado a um link é recusado');

-- ── O mesmo pedido de horário, feito por um usuário logado (paciente no portal) ──
reset role;
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ insert into public.agendamentos (terapeuta_id, paciente_id, data_inicio, data_fim, status)
  values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', now() + interval '4 days', now() + interval '4 days 1 hour', 'pendente') $$,
  'usuário logado com link de agenda ativo também consegue pedir horário (a função de conferência está liberada para ele)');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;

-- ── As funções por token (usadas pelas páginas públicas) continuam funcionando sem login ──
select is((select count(*)::int from public.link_agenda_valido_por_token('TOKEN-AGENDA-DA-A')), 1, 'o token de agenda ativo é reconhecido pela função pública');
select is((select count(*)::int from public.link_agenda_valido_por_token('TOKEN-AGENDA-VENCIDO')) + (select count(*)::int from public.link_agenda_valido_por_token('TOKEN-QUE-NAO-EXISTE')), 0,
  'token de agenda vencido ou inexistente não é reconhecido');
select ok(public.link_avaliacao_valido('33333333-3333-4333-8333-333333333333') and not public.link_avaliacao_valido('99999999-9999-4999-8999-999999999999'),
  'a função pública diz que o link de avaliação ativo é válido e o inexistente não');
reset role;

-- ── Outro terapeuta logado (B) ──
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.respostas_avaliacao_paciente), 0, 'B não lê respostas dos pacientes da A');
select is((select count(*)::int from public.links_avaliacao) + (select count(*)::int from public.links_agenda_paciente), 0, 'B não vê links de avaliação nem de agenda da A');
reset role;

select * from finish();
rollback;
