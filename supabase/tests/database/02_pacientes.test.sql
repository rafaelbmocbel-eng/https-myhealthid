-- Isolamento da tabela `pacientes`: cada terapeuta vê e altera só os próprios; o paciente do portal vê só o próprio
-- cadastro; visitante sem login não vê nada. Também prova as travas por coluna: o paciente edita seus dados pessoais e de
-- saúde, mas não os campos internos (conta premium, XP, vínculo com o terapeuta, convênio, ativo...).
begin;
select plan(33);

-- Dados de teste (rodam como dono do banco; o rollback no fim desfaz tudo)
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'terapeuta.a@teste.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'terapeuta.b@teste.invalid'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'paciente.p@teste.invalid'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'terapeuta.d@teste.invalid');
insert into public.pacientes (id, terapeuta_id, nome, user_id, cadastro_status) values
  ('44444444-4444-4444-8444-444444444444', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Terapeuta D como paciente de si mesma', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'completo'),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Paciente da A', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'pendente_paciente'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Paciente da B', null, 'pendente_paciente');

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

-- ── Campos internos continuam travados mesmo mandando vários campos juntos ──
set local role authenticated;
update public.pacientes set xp_total = 999999, nivel_atual = 'diamante' where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
update public.pacientes set terapeuta_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
update public.pacientes set ativo = false, carteirinha = '123', codigos_cassi = '[]'::jsonb, guias_por_mes = 9, observacoes = 'mexi', origem = 'x',
  cadastro_status = 'completo', portal_token = 'TOKEN-ROUBADO', responsavel_id = '22222222-2222-4222-8222-222222222222'
  where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
update public.pacientes set origem_utm = '{"x":1}'::jsonb, plano_saude = 'Plano X', tipo_pagamento = 'plano', portal_link_enviado_em = now(),
  vinculo_encerrado_em = now(), guia_solicitada_em = now(), cassi_encerrado_em = now(), cassi_encerrado_motivo = 'x', cassi_diagnostico = 'x',
  cassi_confirmado_mes = '2026-11', cassi_pedir_guia = true, cassi_musculos = 'x', cassi_achados = 'x', created_at = '2099-01-01'
  where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
update public.pacientes set user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
reset role;
select is((select xp_total from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), 0,
  'o paciente não consegue dar XP a si mesmo');
select is((select nivel_atual::text from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), 'bronze',
  'o paciente não consegue mudar o próprio nível');
select is((select terapeuta_id from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  'o paciente não consegue transferir o próprio cadastro para outro terapeuta');
select is((select ativo from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), true,
  'o paciente não consegue desativar o próprio cadastro');
select is((select count(*)::int from public.pacientes where id = '11111111-1111-4111-8111-111111111111'
  and carteirinha is null and guias_por_mes is not distinct from 1 and observacoes is null and origem = 'manual'
  and cadastro_status = 'pendente_paciente' and portal_token is null and responsavel_id is null), 1,
  'o paciente não consegue mexer em convênio, anotações do terapeuta, origem, status do cadastro, token do portal nem vínculos');
select is((select count(*)::int from public.pacientes where id = '11111111-1111-4111-8111-111111111111'
  and origem_utm is null and plano_saude is null and tipo_pagamento = 'particular'
  and portal_link_enviado_em is null and vinculo_encerrado_em is null and guia_solicitada_em is null and cassi_encerrado_em is null
  and cassi_encerrado_motivo is null and cassi_diagnostico is null and cassi_confirmado_mes is null and cassi_pedir_guia = false
  and cassi_musculos is null and cassi_achados is null and created_at < '2099-01-01'), 1,
  'o paciente não consegue mexer em plano de saúde, datas de vínculo, campos de CASSI nem na data de criação');
select is((select user_id from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
  'o paciente não consegue ligar o próprio cadastro a outra conta (user_id)');

-- ── O que o paciente PODE editar segue funcionando, e mandar campo travado junto não derruba a gravação ──
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;
update public.pacientes set telefone = '11999990000', alergias = 'dipirona', queixa_principal = 'dor no ombro',
  historia_atual = '{"inicio":"ha 2 meses"}'::jsonb, historico_clinico = '{"cirurgias":"nenhuma"}'::jsonb, avatar_url = 'https://exemplo.invalid/foto.jpg',
  xp_total = 777
  where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
reset role;
select is((select count(*)::int from public.pacientes where id = '11111111-1111-4111-8111-111111111111'
  and telefone = '11999990000' and alergias = 'dipirona' and queixa_principal = 'dor no ombro' and avatar_url = 'https://exemplo.invalid/foto.jpg'
  and historia_atual->>'inicio' = 'ha 2 meses' and historico_clinico->>'cirurgias' = 'nenhuma'), 1,
  'o paciente edita dados pessoais, de saúde, histórico e foto (mesmo mandando um campo travado no mesmo comando)');
select is((select xp_total from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), 0,
  'o campo travado mandado junto é ignorado, sem derrubar a gravação');

set local role authenticated;
update public.pacientes set email = 'novo.paciente@teste.invalid', cpf = '52998224725', data_nascimento = '1990-05-17', sexo = 'F', genero = 'feminino',
  endereco = 'Rua das Flores', cep = '01310100', endereco_numero = '10', endereco_complemento = 'ap 2', bairro = 'Centro', cidade = 'Sao Paulo', uf = 'SP',
  lgpd_aceite_em = now(), lgpd_versao = 'v1', contato_emergencia_nome = 'Maria', contato_emergencia_telefone = '11988887777',
  contato_emergencia_parentesco = 'mae', condicoes_preexistentes = 'asma', medicamentos_uso = 'salbutamol'
  where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
reset role;
select is((select count(*)::int from public.pacientes where id = '11111111-1111-4111-8111-111111111111'
  and email = 'novo.paciente@teste.invalid' and data_nascimento = '1990-05-17' and sexo = 'F' and cep = '01310100' and endereco_numero = '10'
  and uf = 'SP' and lgpd_versao = 'v1' and lgpd_aceite_em is not null and contato_emergencia_telefone = '11988887777'
  and condicoes_preexistentes = 'asma' and medicamentos_uso = 'salbutamol' and cpf is not null and endereco is not null and bairro is not null
  and cidade is not null and genero is not null and endereco_complemento is not null and contato_emergencia_nome is not null
  and contato_emergencia_parentesco is not null), 1,
  'o paciente grava os demais dados pessoais, de endereço, de emergência e o aceite da LGPD (nada editável ficou travado)');

-- ── Funções do servidor (rodam como dono do banco) continuam podendo mexer nos campos internos ──
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;
select public.ganhar_xp('11111111-1111-4111-8111-111111111111', 'missao:teste:2026-11-02', 40);
select public.ganhar_xp('11111111-1111-4111-8111-111111111111', 'missao:teste:2026-11-02', 40);
reset role;
select is((select xp_total from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), 40,
  'ganhar_xp credita o XP uma única vez, pela função');

-- ── Resgate de recompensa: o gatilho do servidor debita o XP com o papel do paciente, e a trava não pode desfazer isso ──
insert into public.recompensas_catalogo (id, terapeuta_id, titulo, xp_custo, ativa)
  values ('99999999-9999-4999-8999-999999999999', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Brinde do teste', 40, true);
update public.pacientes set xp_total = 100 where id = '11111111-1111-4111-8111-111111111111';
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;
insert into public.recompensas_resgates (paciente_id, recompensa_id) values ('11111111-1111-4111-8111-111111111111', '99999999-9999-4999-8999-999999999999');
insert into public.recompensas_resgates (paciente_id, recompensa_id) values ('11111111-1111-4111-8111-111111111111', '99999999-9999-4999-8999-999999999999');
select throws_ok($$ insert into public.recompensas_resgates (paciente_id, recompensa_id)
  values ('11111111-1111-4111-8111-111111111111', '99999999-9999-4999-8999-999999999999') $$, 'P0001', 'XP insuficiente',
  'sem saldo o resgate é recusado (o débito de XP do resgate não é desfeito pela trava)');
reset role;
select is((select xp_total from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), 20,
  'resgatar recompensa debita o XP do paciente (duas vezes 40 de 100)');

-- ── Super admin (e-mail do dono no token) segue livre, mesmo usando a conta do paciente ──
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated","email":"rafaelbmocbel@gmail.com"}', true);
set local role authenticated;
update public.pacientes set xp_total = 777 where user_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
reset role;
select is((select xp_total from public.pacientes where id = '11111111-1111-4111-8111-111111111111'), 777, 'o super admin altera campos internos (a trava não vale para ele)');

-- ── Terapeuta dono mantém controle total do cadastro do próprio paciente ──
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
update public.pacientes set ativo = false, observacoes = 'anotação da terapeuta', tipo_pagamento = 'plano', guias_por_mes = 2
  where id = '11111111-1111-4111-8111-111111111111';
reset role;
select is((select count(*)::int from public.pacientes where id = '11111111-1111-4111-8111-111111111111'
  and ativo = false and observacoes = 'anotação da terapeuta' and tipo_pagamento = 'plano' and guias_por_mes = 2), 1,
  'a terapeuta dona altera os campos internos do próprio paciente');

-- ── Terapeuta que também é paciente de si mesma (cadastro com user_id = terapeuta_id) segue com controle total ──
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
set local role authenticated;
update public.pacientes set ativo = false, observacoes = 'anotação própria', guias_por_mes = 2 where id = '44444444-4444-4444-8444-444444444444';
reset role;
select is((select count(*)::int from public.pacientes where id = '44444444-4444-4444-8444-444444444444'
  and ativo = false and observacoes = 'anotação própria' and guias_por_mes = 2), 1,
  'a terapeuta que também é paciente de si mesma continua alterando os campos internos do próprio cadastro');

-- ── Alarme para coluna nova: cada coluna de `pacientes` precisa ser classificada como editável ou interna ──
-- Editáveis: o paciente altera pelo portal. Internas: o gatilho pacientes_protege_campos_internos devolve o valor antigo.
-- Coluna nova sem classificação faz este teste falhar: decida e atualize a lista E o gatilho (migração nova).
select is((select coalesce(string_agg(column_name, ', ' order by column_name), '') from information_schema.columns
  where table_schema = 'public' and table_name = 'pacientes' and column_name <> all (array[
    'nome','sobrenome','email','telefone','data_nascimento','sexo','genero','cpf','endereco','cep','endereco_numero','endereco_complemento',
    'bairro','cidade','uf','lgpd_aceite_em','lgpd_versao','contato_emergencia_nome','contato_emergencia_telefone',
    'contato_emergencia_parentesco','alergias','medicamentos_uso','condicoes_preexistentes','queixa_principal','avatar_url',
    'historia_atual','historico_clinico','updated_at',
    'id','terapeuta_id','clinica_id','convenio_id','responsavel_id','user_id','ativo','origem','origem_utm','observacoes','portal_token',
    'portal_link_enviado_em','vinculo_encerrado_em','tipo_pagamento','plano_saude','tipo_conta','cadastro_status','nivel_atual','xp_total',
    'carteirinha','codigos_cassi','guias_por_mes','guia_solicitada_em','cassi_encerrado_em','cassi_encerrado_motivo','cassi_diagnostico',
    'cassi_confirmado_mes','cassi_pedir_guia','cassi_musculos','cassi_achados','created_at'])), '',
  'toda coluna de pacientes está classificada como editável pelo paciente ou interna (alarme para coluna nova)');
select is((select count(*)::int from pg_trigger where tgrelid = 'public.pacientes'::regclass and tgname = 'trg_pacientes_protege_campos_internos' and not tgisinternal), 1,
  'o gatilho que protege os campos internos está instalado');

-- ── Músculos e achados da justificativa CASSI: do profissional dono, com tamanho limitado ──
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
update public.pacientes set cassi_musculos = 'trapézio superior, romboides', cassi_achados = 'bandas tensas palpáveis'
  where id = '11111111-1111-4111-8111-111111111111';
reset role;
select is((select cassi_musculos || ' | ' || cassi_achados from public.pacientes where id = '11111111-1111-4111-8111-111111111111'),
  'trapézio superior, romboides | bandas tensas palpáveis', 'o profissional dono grava os músculos e os achados da justificativa CASSI');
select throws_ok($$ update public.pacientes set cassi_musculos = repeat('x', 401) where id = '11111111-1111-4111-8111-111111111111' $$,
  '23514', null, 'músculos acima de 400 caracteres são recusados pelo banco');

select * from finish();
rollback;
