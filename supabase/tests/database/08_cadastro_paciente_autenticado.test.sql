-- Cadastro completado pelo próprio cliente logado no portal (salvar_cadastro_paciente_autenticado).
-- A versão antiga gravava colunas que não existem (termos_consentimento.aceito_em, notificacoes.mensagem/paciente_id) e
-- por isso falhava SEMPRE, desfazendo também a atualização do cadastro. Aqui o fluxo roda de ponta a ponta com o esquema real.
begin;
select plan(32);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'profissional@teste.invalid'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'cliente@teste.invalid'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'cliente.solto@teste.invalid'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'cliente.wellness@teste.invalid');
insert into public.pacientes (id, terapeuta_id, user_id, nome, cadastro_status) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Cliente do portal', 'pendente_paciente'),
  ('33333333-3333-4333-8333-333333333333', null, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Cliente sem profissional', 'pendente_paciente');

-- ── Quem pode chamar ──
select ok(not has_function_privilege('anon', 'public.salvar_cadastro_paciente_autenticado(jsonb)', 'execute'),
  'visitante sem login não tem permissão de executar a função');
select ok(has_function_privilege('authenticated', 'public.salvar_cadastro_paciente_autenticado(jsonb)', 'execute'),
  'cliente logado tem permissão de executar a função');
-- O banco local não concede EXECUTE a PUBLIC por padrão (a produção concede), então esta conferência não pega sozinha um
-- `revoke ... from anon` que esqueça o PUBLIC; em produção, o alerta anon_security_definer_function_executable do Supabase confirma.
select ok(not exists (
  select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
  where p.oid = 'public.salvar_cadastro_paciente_autenticado(jsonb)'::regprocedure and a.grantee = 0),
  'PUBLIC (todo mundo) não tem EXECUTE na função, só os papéis concedidos');

-- ── Cliente logado completa o cadastro pela primeira vez ──
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$ select public.salvar_cadastro_paciente_autenticado('{"telefone":"11999990000"}'::jsonb) $$,
  'P0001', 'lgpd_obrigatorio', 'sem aceite LGPD o cadastro não é salvo');

select throws_ok($$ select public.salvar_cadastro_paciente_autenticado('{"lgpd_aceite":false,"telefone":"11000000000"}'::jsonb) $$,
  'P0001', 'lgpd_obrigatorio', 'aceite LGPD falso também barra o salvamento');

select throws_ok($$ select public.salvar_cadastro_paciente_autenticado('{"lgpd_aceite":true,"cpf":"11111111111"}'::jsonb) $$,
  '22023', 'CPF inválido', 'CPF inválido chega com a mensagem que a tela reconhece (e nada é gravado)');

select is((select (public.salvar_cadastro_paciente_autenticado(
  '{"lgpd_aceite":true,"telefone":"11999990000","cidade":"São Paulo","queixa_principal":"dor lombar"}'::jsonb))->>'ok'), 'true',
  'cliente logado completa o cadastro sem erro');
reset role;

select is((select cadastro_status from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), 'completo',
  'o cadastro fica marcado como completo');
select is((select telefone from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), '11999990000',
  'os dados informados são gravados');
select ok((select lgpd_aceite_em is not null and lgpd_versao = '1.0' from public.pacientes where id = '11111111-1111-4111-8111-111111111111'),
  'o aceite LGPD fica registrado no cadastro');
select is((select count(*)::int from public.termos_consentimento where paciente_id = '11111111-1111-4111-8111-111111111111' and tipo = 'lgpd' and aceito), 1,
  'o termo LGPD é registrado uma vez');
select is((select count(*)::int from public.notificacoes where terapeuta_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and tipo = 'paciente_completou_cadastro'
  and rota = '/pacientes/11111111-1111-4111-8111-111111111111'), 1,
  'o profissional recebe o aviso, com o caminho para o perfil do cliente');

-- ── O mesmo cliente edita os dados depois: salva, mas não repete termo nem aviso ──
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.salvar_cadastro_paciente_autenticado('{"lgpd_aceite":true,"cidade":"Campinas"}'::jsonb) $$,
  'o cliente consegue editar o cadastro depois de concluído');
reset role;
select is((select cidade from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), 'Campinas', 'a edição é gravada');
select is((select telefone from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), '11999990000',
  'telefone em branco na edição não apaga o telefone que já existia');
select is((select cpf from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), null,
  'o CPF inválido recusado antes não deixou nada gravado');
select is((select count(*)::int from public.termos_consentimento where paciente_id = '11111111-1111-4111-8111-111111111111'), 1,
  'a edição não duplica o termo LGPD');
select is((select count(*)::int from public.notificacoes where terapeuta_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and tipo = 'paciente_completou_cadastro'), 1,
  'a edição não repete o aviso ao profissional');

-- ── Cliente sem profissional (conta wellness): salva sem termo nem aviso, sem erro ──
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.salvar_cadastro_paciente_autenticado('{"lgpd_aceite":true,"telefone":"11988887777"}'::jsonb) $$,
  'cliente sem profissional também completa o cadastro');
reset role;
select is((select cadastro_status from public.pacientes where id = '33333333-3333-4333-8333-333333333333'), 'completo',
  'o cadastro do cliente sem profissional fica completo');
select is((select count(*)::int from public.termos_consentimento where paciente_id = '33333333-3333-4333-8333-333333333333'), 0,
  'sem profissional não há termo a registrar (a coluna exige profissional)');
select is((select count(*)::int from public.notificacoes where metadata->>'paciente_id' = '33333333-3333-4333-8333-333333333333'), 0,
  'sem profissional não há para quem avisar');

-- ── Conta que ainda não tem cadastro vinculado ──
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.salvar_cadastro_paciente_autenticado('{"lgpd_aceite":true}'::jsonb) $$,
  'P0001', 'paciente_nao_vinculado', 'conta sem cadastro vinculado recebe o erro certo');
reset role;

-- ── Usuário logado, mas com sessão sem identificação ──
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ select public.salvar_cadastro_paciente_autenticado('{"lgpd_aceite":true}'::jsonb) $$,
  'P0001', 'nao_autenticado', 'sessão logada sem identificação é barrada dentro da função');
reset role;

-- ── Visitante sem login ──
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$ select public.salvar_cadastro_paciente_autenticado('{"lgpd_aceite":true}'::jsonb) $$,
  '42501', null, 'visitante sem login é barrado antes de entrar na função');
reset role;

-- ── Gatilho que espelha o cliente em whatsapp_conversas ──
select lives_ok($$ insert into public.pacientes (id, nome, telefone, ativo)
  values ('44444444-4444-4444-8444-444444444444', 'Cliente wellness com telefone', '11977776666', true) $$,
  'cliente sem profissional pode ser cadastrado já com telefone');
select is((select count(*)::int from public.whatsapp_conversas where telefone = '11977776666'), 0,
  'sem profissional não nasce conversa de WhatsApp');
select lives_ok($$ update public.pacientes set telefone = '11922223333' where id = '44444444-4444-4444-8444-444444444444' $$,
  'trocar o telefone de cliente sem profissional também não dá erro (era o caso do bug original)');
select lives_ok($$ insert into public.pacientes (id, terapeuta_id, nome, telefone, ativo) values
  ('77777777-7777-4777-8777-777777777777', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Cliente inativo', '11900001111', false),
  ('88888888-8888-4888-8888-888888888888', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Cliente telefone curto', '1234', true) $$,
  'cliente inativo e cliente com telefone curto são cadastrados sem erro');
select is((select count(*)::int from public.whatsapp_conversas where telefone in ('11900001111', '1234')), 0,
  'inativo e telefone curto não geram conversa de WhatsApp');
select lives_ok($$ insert into public.pacientes (id, terapeuta_id, nome, telefone, ativo) values
  ('55555555-5555-4555-8555-555555555555', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Cliente A', '11966665555', true),
  ('66666666-6666-4666-8666-666666666666', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Cliente B no mesmo telefone', '(11) 96666-5555', true) $$,
  'dois clientes do mesmo profissional com o mesmo telefone são cadastrados sem erro');
select is((select count(*)::int from public.whatsapp_conversas where terapeuta_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and telefone = '11966665555'), 1,
  'com profissional continua existindo uma conversa por telefone');

select * from finish();
rollback;
