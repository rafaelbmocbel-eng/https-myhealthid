-- Check-in semanal de bem-estar: o cliente grava só pelas funções (portal) e o servidor pela função interna; cada dono lê
-- só o que é seu; nota viva e alertas vão para o prontuário e para as notificações; o alerta segue os mesmos casos do teste
-- do app (src/test/checkinSemanal.test.ts).
begin;
select plan(69);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'terapeuta.a@teste.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'terapeuta.b@teste.invalid'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'paciente.p@teste.invalid'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'paciente.q@teste.invalid'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'paciente.w@teste.invalid'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'paciente.f@teste.invalid');
insert into public.pacientes (id, terapeuta_id, nome, user_id) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Paciente P', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Paciente Q', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  ('33333333-3333-4333-8333-333333333333', null, 'Cliente sem profissional', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'),
  ('44444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Paciente dos alertas', null),
  ('55555555-5555-4555-8555-555555555555', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Paciente do alerta repetido', null),
  ('66666666-6666-4666-8666-666666666666', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Paciente do alerta corrigido', null),
  ('77777777-7777-4777-8777-777777777777', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Paciente com nota forjada', null),
  ('88888888-8888-4888-8888-888888888888', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Paciente que responde depois da virada', 'ffffffff-ffff-4fff-8fff-ffffffffffff');

create function public._pgtap_afetadas(comando text) returns int language plpgsql as $$
declare n int;
begin
  execute 'with x as (' || comando || ' returning 1) select count(*) from x' into n;
  return n;
end $$;

-- ── Funções: quem pode executar o quê ──
select ok(not has_function_privilege('anon', 'public.checkin_gravar(uuid, date, text, int, int, int, int, int, int, int)', 'execute')
  and not has_function_privilege('authenticated', 'public.checkin_gravar(uuid, date, text, int, int, int, int, int, int, int)', 'execute')
  and has_function_privilege('service_role', 'public.checkin_gravar(uuid, date, text, int, int, int, int, int, int, int)', 'execute'),
  'a gravação interna só roda pela service role');
select ok(not has_function_privilege('anon', 'public.registrar_checkin_semanal(int, int, int, int, int, int, int)', 'execute')
  and has_function_privilege('authenticated', 'public.registrar_checkin_semanal(int, int, int, int, int, int, int)', 'execute'),
  'o visitante sem login não executa a gravação do portal; o usuário logado executa');
select is(extract(isodow from public.checkin_semana_atual())::int, 1, 'a semana atual começa numa segunda-feira');

-- ── Portal: o paciente P responde ──
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.registrar_checkin_semanal(4, 3, 5, 4, 4, 2, null) $$, 'o paciente grava o check-in pelo portal');
select is((select count(*)::int from public.checkins_semanais), 1, 'o paciente vê o próprio check-in');
select is((select semana from public.checkins_semanais), public.checkin_semana_atual(), 'a resposta cai na semana atual (segunda-feira de Brasília)');
select is((select origem from public.checkins_semanais), 'portal', 'a origem é o portal');
select lives_ok($$ select public.registrar_checkin_semanal(5, 5, 5, 5, 5, 1, 9) $$, 'responder de novo na mesma semana corrige a resposta');
select is((select count(*)::int from public.checkins_semanais where fadiga = 5 and psr = 9), 1, 'a correção substituiu a resposta (uma linha por semana)');
select is((select count(*)::int from public.checkins_semanais), 1, 'continua uma linha só');
select throws_ok($$ select public.registrar_checkin_semanal(6, 3, 5, 4, 4, 2, null) $$, 'P0001', 'checkin_valor_invalido', 'item fora de 1 a 5 é recusado');
select throws_ok($$ select public.registrar_checkin_semanal(4, 3, 5, 4, 4, 9, null) $$, 'P0001', 'checkin_valor_invalido', 'urina fora de 1 a 8 é recusada');
select throws_ok($$ select public.registrar_checkin_semanal(4, 3, 5, 4, 4, 2, 11) $$, 'P0001', 'checkin_valor_invalido', 'recuperação fora de 0 a 10 é recusada');
select throws_ok($$ insert into public.checkins_semanais (paciente_id, semana, fadiga, sono, dor_muscular, estresse, humor)
  values ('11111111-1111-4111-8111-111111111111', '2026-11-03', 3, 3, 3, 3, 3) $$, '42501', null, 'o paciente não grava direto na tabela');
select throws_ok($$ update public.checkins_semanais set fadiga = 1 $$, '42501', null, 'o paciente não altera direto a tabela');
select throws_ok($$ delete from public.checkins_semanais $$, '42501', null, 'o paciente não apaga direto da tabela');
select throws_ok($$ select count(*) from public.checkin_pedidos $$, '42501', null, 'o paciente não lê a tabela de pedidos (só o servidor)');
select lives_ok($$ select public.definir_checkin_whatsapp(false) $$, 'o paciente desliga o lembrete pelo WhatsApp');
select is((select whatsapp_ativo from public.checkin_preferencias), false, 'a preferência ficou gravada');
reset role;

-- ── A nota viva no prontuário da terapeuta A ──
select is((select count(*)::int from public.notas_prontuario where paciente_id = '11111111-1111-4111-8111-111111111111' and tipo = 'checkin_semanal'), 1,
  'o prontuário ganhou uma nota viva do check-in');
select ok((select descricao from public.notas_prontuario where tipo = 'checkin_semanal' and paciente_id = '11111111-1111-4111-8111-111111111111') like '%Autorrelato do cliente%',
  'a nota diz que é autorrelato do cliente, não evolução do profissional');

-- Segunda resposta, em outra semana: a nota continua uma só, com a variação
insert into public.checkins_semanais (paciente_id, semana, fadiga, sono, dor_muscular, estresse, humor)
  values ('11111111-1111-4111-8111-111111111111', public.checkin_semana_atual() - 14, 3, 3, 3, 3, 3);
select lives_ok($$ select public.checkin_gravar('11111111-1111-4111-8111-111111111111', public.checkin_semana_atual() - 7, 'whatsapp', 4, 2, 5, 4, 3, 2, null) $$,
  'o servidor grava uma resposta de outra semana (WhatsApp)');
select is((select count(*)::int from public.notas_prontuario where paciente_id = '11111111-1111-4111-8111-111111111111' and tipo = 'checkin_semanal'), 1,
  'a nota viva continua uma só, atualizada');
select ok((select descricao from public.notas_prontuario where tipo = 'checkin_semanal' and paciente_id = '11111111-1111-4111-8111-111111111111') like '%Variação em relação à resposta anterior%',
  'a nota mostra a variação em relação à resposta anterior');

-- ── Leitura por dono ──
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.checkins_semanais where paciente_id = '11111111-1111-4111-8111-111111111111'), 3, 'a terapeuta A lê os check-ins do paciente dela');
select throws_ok($$ update public.checkins_semanais set fadiga = 1 $$, '42501', null, 'nem a terapeuta altera direto a tabela');
reset role;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.checkins_semanais), 0, 'o terapeuta B não lê os check-ins de pacientes da A');
reset role;
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.checkins_semanais), 0, 'outro paciente não lê check-ins alheios');
reset role;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$ select count(*) from public.checkins_semanais $$, '42501', null, 'o visitante sem login não lê a tabela (sem privilégio)');
reset role;

-- ── Cliente sem profissional (autocadastro): grava, mas não há prontuário nem notificação ──
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.registrar_checkin_semanal(3, 3, 3, 3, 3) $$, 'cliente sem profissional também responde o check-in');
reset role;
select is((select count(*)::int from public.notas_prontuario where paciente_id = '33333333-3333-4333-8333-333333333333'), 0, 'sem profissional não há nota no prontuário');

-- ── Pedido do WhatsApp em aberto de semana anterior: a resposta do portal conta para a semana do pedido ──
insert into public.checkin_pedidos (paciente_id, semana, expira_em)
  values ('22222222-2222-4222-8222-222222222222', public.checkin_semana_atual() - 7, now() + interval '10 hours');
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.registrar_checkin_semanal(2, 2, 2, 2, 2) $$, 'o paciente Q responde com um pedido da semana passada em aberto');
reset role;
select is((select semana from public.checkins_semanais where paciente_id = '22222222-2222-4222-8222-222222222222'), public.checkin_semana_atual() - 7,
  'a resposta conta para a semana do pedido');
select ok((select respondido_em is not null from public.checkin_pedidos where paciente_id = '22222222-2222-4222-8222-222222222222'), 'o pedido ficou marcado como respondido');

-- ── Alertas: mesmos casos de calcularAlertas (src/test/checkinSemanal.test.ts) ──
create function public._semana_n(n int) returns date language sql as $$ select date '2026-09-07' + n * 7 $$;
create function public._serie(p uuid, fadigas int[], sonos int[] default null, humores int[] default null, pular int default null) returns void language plpgsql as $$
declare i int; j int := 0;
begin
  for i in 1 .. cardinality(fadigas) loop
    j := j + 1;
    if pular is not null and i = pular + 1 then j := j + 1; end if;
    insert into public.checkins_semanais (paciente_id, semana, fadiga, sono, dor_muscular, estresse, humor)
    values (p, public._semana_n(j), fadigas[i], coalesce(sonos[i], 4), 4, 4, coalesce(humores[i], 4));
  end loop;
end $$;

select public._serie('44444444-4444-4444-8444-444444444444', array[4, 4, 4, 4, 3, 3]);
select is(public.checkin_alertas('44444444-4444-4444-8444-444444444444'), array['fadiga'], 'A1: duas últimas semanas 1 ponto abaixo da média das 4 primeiras: alerta em fadiga');
delete from public.checkins_semanais where paciente_id = '44444444-4444-4444-8444-444444444444';

select public._serie('44444444-4444-4444-8444-444444444444', array[4, 4, 4, 4, 4, 3]);
select is(public.checkin_alertas('44444444-4444-4444-8444-444444444444'), '{}'::text[], 'A2: só a última cai: sem alerta');
delete from public.checkins_semanais where paciente_id = '44444444-4444-4444-8444-444444444444';

select public._serie('44444444-4444-4444-8444-444444444444', array[4, 4, 4, 3, 3], null, array[5, 5, 5, 1, 1]);
select is(public.checkin_alertas('44444444-4444-4444-8444-444444444444'), '{}'::text[], 'A3: menos de 6 respostas: sem alerta');
delete from public.checkins_semanais where paciente_id = '44444444-4444-4444-8444-444444444444';

select public._serie('44444444-4444-4444-8444-444444444444', array[4, 4, 4, 4, 2, 2], null, null, 5);
select is(public.checkin_alertas('44444444-4444-4444-8444-444444444444'), '{}'::text[], 'A4: as duas últimas respostas não são de semanas seguidas: sem alerta');
delete from public.checkins_semanais where paciente_id = '44444444-4444-4444-8444-444444444444';

select public._serie('44444444-4444-4444-8444-444444444444', array[5, 4, 4, 4, 4, 4]);
select is(public.checkin_alertas('44444444-4444-4444-8444-444444444444'), '{}'::text[], 'A5: queda de menos de 1 ponto sobre a média (4,25): sem alerta');
delete from public.checkins_semanais where paciente_id = '44444444-4444-4444-8444-444444444444';

select public._serie('44444444-4444-4444-8444-444444444444', array[4, 4, 4, 4, 2, 2], array[4, 4, 4, 4, 3, 3], array[4, 4, 4, 4, 1, 1]);
select is(public.checkin_alertas('44444444-4444-4444-8444-444444444444'), array['fadiga', 'sono', 'humor'], 'A6: vários itens caindo alertam juntos, na ordem dos itens');
delete from public.checkins_semanais where paciente_id = '44444444-4444-4444-8444-444444444444';

select public._serie('44444444-4444-4444-8444-444444444444', array[3, 3, 3, 3, 5, 5], null, array[3, 3, 3, 3, 5, 5]);
select is(public.checkin_alertas('44444444-4444-4444-8444-444444444444'), '{}'::text[], 'A7: melhora não alerta');
delete from public.checkins_semanais where paciente_id = '44444444-4444-4444-8444-444444444444';

select public._serie('44444444-4444-4444-8444-444444444444', array[4, 4, 4, 2, 3, 3]);
select is(public.checkin_alertas('44444444-4444-4444-8444-444444444444'), '{}'::text[], 'A8: a 4ª resposta entra na linha de base (média 3,25): sem alerta');
delete from public.checkins_semanais where paciente_id = '44444444-4444-4444-8444-444444444444';

-- ── Nota de alerta e notificação (sem repetir a cada semana) ──
select public._serie('55555555-5555-4555-8555-555555555555', array[4, 4, 4, 4, 3]);
select public.checkin_gravar('55555555-5555-4555-8555-555555555555', public._semana_n(6), 'whatsapp', 3, 4, 4, 4, 4);
select is((select count(*)::int from public.notas_prontuario where paciente_id = '55555555-5555-4555-8555-555555555555' and tipo = 'checkin_alerta'), 1,
  'a queda por 2 semanas gera uma nota de alerta no prontuário');
select is((select count(*)::int from public.notificacoes where tipo = 'checkin_alerta' and terapeuta_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1,
  'e uma notificação para o profissional');
select public.checkin_gravar('55555555-5555-4555-8555-555555555555', public._semana_n(7), 'whatsapp', 3, 4, 4, 4, 4);
select is((select count(*)::int from public.notas_prontuario where paciente_id = '55555555-5555-4555-8555-555555555555' and tipo = 'checkin_alerta'), 1,
  'a semana seguinte, ainda em queda, não repete a nota de alerta');
select is((select count(*)::int from public.notificacoes where tipo = 'checkin_alerta' and terapeuta_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 1,
  'nem a notificação');

-- ── Prontuário: as notas do check-in só nascem pelas funções; o alerta só o profissional dono lê ──
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ insert into public.notas_prontuario (paciente_id, terapeuta_id, tipo, titulo, descricao)
  values ('11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'checkin_alerta', 'forjada', 'forjada') $$,
  '42501', null, 'o cliente não planta uma nota de alerta no prontuário');
select throws_ok($$ insert into public.notas_prontuario (paciente_id, terapeuta_id, tipo, titulo, descricao)
  values ('11111111-1111-4111-8111-111111111111', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'checkin_semanal', 'forjada', 'forjada') $$,
  '42501', null, 'nem a nota viva do check-in');
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select throws_ok($$ insert into public.notas_prontuario (paciente_id, terapeuta_id, tipo, titulo, descricao)
  values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'checkin_alerta', 'forjada', 'forjada') $$,
  '42501', null, 'nem a terapeuta cria nota do check-in à mão (só as funções do servidor)');
reset role;
insert into public.notas_prontuario (paciente_id, terapeuta_id, tipo, titulo, descricao, dados_extras)
  values ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'checkin_alerta', 'Check-in semanal: atenção', 'texto clínico para o profissional',
          '{"itens":["humor"],"semana":"2026-09-07"}');
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.notas_prontuario where tipo = 'checkin_alerta'), 0, 'o cliente não lê a nota de alerta (é para o profissional)');
select is((select count(*)::int from public.notas_prontuario where tipo = 'checkin_semanal'), 1, 'o cliente lê a nota viva: é o autorrelato dele');
reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.notas_prontuario where tipo = 'checkin_alerta' and paciente_id = '11111111-1111-4111-8111-111111111111'), 1, 'a terapeuta dona lê a nota de alerta');
reset role;

-- ── Texto da nota viva: sem lacunas nos opcionais e sem o aviso de queda (o aviso fica na nota de alerta) ──
select ok((select descricao from public.notas_prontuario where tipo = 'checkin_semanal' and paciente_id = '55555555-5555-4555-8555-555555555555') not like '%Atenção:%',
  'a nota viva não carrega o aviso de queda (só a nota de alerta, que o cliente não lê)');
select ok((select descricao from public.notas_prontuario where tipo = 'checkin_semanal' and paciente_id = '22222222-2222-4222-8222-222222222222') not like '%Urina%'
  and (select descricao from public.notas_prontuario where tipo = 'checkin_semanal' and paciente_id = '22222222-2222-4222-8222-222222222222') not like '%Recuperação%',
  'sem urina nem recuperação respondidas, a nota não mostra rótulos vazios');
select ok((select descricao from public.notas_prontuario where tipo = 'checkin_semanal' and paciente_id = '11111111-1111-4111-8111-111111111111') like '%Urina 2%',
  'com urina respondida, a nota mostra o valor');

-- ── Correção da mesma semana desfaz o alerta (nota e notificação ainda não lida) ──
select public._serie('66666666-6666-4666-8666-666666666666', array[4, 4, 4, 4, 3]);
select public.checkin_gravar('66666666-6666-4666-8666-666666666666', public._semana_n(6), 'whatsapp', 3, 4, 4, 4, 4);
select is((select count(*)::int from public.notas_prontuario where paciente_id = '66666666-6666-4666-8666-666666666666' and tipo = 'checkin_alerta'), 1,
  'a queda gera a nota de alerta');
select public.checkin_gravar('66666666-6666-4666-8666-666666666666', public._semana_n(6), 'whatsapp', 4, 4, 4, 4, 4);
select is((select count(*)::int from public.notas_prontuario where paciente_id = '66666666-6666-4666-8666-666666666666' and tipo = 'checkin_alerta'), 0,
  'o cliente corrige o número errado e a nota de alerta some');
select is((select count(*)::int from public.notificacoes where tipo = 'checkin_alerta' and metadata ->> 'paciente_id' = '66666666-6666-4666-8666-666666666666'), 0,
  'a notificação ainda não lida some junto');
select public.checkin_gravar('66666666-6666-4666-8666-666666666666', public._semana_n(6), 'whatsapp', 3, 4, 4, 4, 4);
select is((select count(*)::int from public.notas_prontuario where paciente_id = '66666666-6666-4666-8666-666666666666' and tipo = 'checkin_alerta'), 1,
  'uma queda verdadeira depois da correção volta a alertar (o dedupe não ficou preso)');

-- ── Nota forjada por outra pessoa (formato livre, outro profissional) não derruba a nota viva nem o alerta ──
insert into public.notas_prontuario (paciente_id, terapeuta_id, tipo, titulo, descricao, dados_extras)
  values ('77777777-7777-4777-8777-777777777777', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'checkin_alerta', 'forjada', 'forjada', '{"itens":5}'),
         ('77777777-7777-4777-8777-777777777777', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'checkin_alerta', 'forjada 2', 'forjada', '{"itens":["fadiga","sono","humor"],"semana":"2026-09-07"}'),
         ('77777777-7777-4777-8777-777777777777', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'checkin_alerta', 'malformada do próprio profissional', 'formato inesperado', '{"itens":5}');
select public._serie('77777777-7777-4777-8777-777777777777', array[4, 4, 4, 4, 3]);
select ok((public.checkin_gravar('77777777-7777-4777-8777-777777777777', public._semana_n(6), 'whatsapp', 3, 4, 4, 4, 4) ->> 'nota_ok')::boolean,
  'com uma nota forjada no caminho, a nota viva ainda é gravada (e o retorno diz que deu certo)');
select is((select count(*)::int from public.notas_prontuario where paciente_id = '77777777-7777-4777-8777-777777777777' and tipo = 'checkin_semanal'), 1,
  'a nota viva existe');
select is((select count(*)::int from public.notas_prontuario where paciente_id = '77777777-7777-4777-8777-777777777777' and tipo = 'checkin_alerta' and terapeuta_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and titulo = 'Check-in semanal: atenção'), 1,
  'o alerta verdadeiro sai para o profissional do cliente, sem ser silenciado pela nota forjada de outro usuário nem derrubado por nota de formato inesperado');

-- ── Portal depois da virada da semana: corrige a resposta da semana anterior em vez de criar outra ──
insert into public.checkins_semanais (paciente_id, semana, fadiga, sono, dor_muscular, estresse, humor, updated_at)
  values ('88888888-8888-4888-8888-888888888888', public.checkin_semana_atual() - 7, 4, 4, 4, 4, 4, now());
select set_config('request.jwt.claims', '{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.registrar_checkin_semanal(3, 3, 3, 3, 3) $$, 'o cliente responde de novo depois de já ter respondido a semana anterior desde a virada');
reset role;
select is((select count(*)::int from public.checkins_semanais where paciente_id = '88888888-8888-4888-8888-888888888888'), 1,
  'continua uma resposta só (a da semana anterior foi corrigida)');
select is((select fadiga::int from public.checkins_semanais where paciente_id = '88888888-8888-4888-8888-888888888888' and semana = public.checkin_semana_atual() - 7), 3,
  'o valor corrigido está na semana anterior');
update public.checkins_semanais set updated_at = (public.checkin_semana_atual()::timestamp at time zone 'America/Sao_Paulo') - interval '1 minute'
  where paciente_id = '88888888-8888-4888-8888-888888888888';
select set_config('request.jwt.claims', '{"sub":"ffffffff-ffff-4fff-8fff-ffffffffffff","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select public.registrar_checkin_semanal(5, 5, 5, 5, 5) $$, 'resposta da semana anterior feita ANTES da virada não conta como desta semana');
reset role;
select is((select count(*)::int from public.checkins_semanais where paciente_id = '88888888-8888-4888-8888-888888888888'), 2,
  'então a nova resposta vira a linha da semana atual');

-- ── A semana precisa ser uma segunda-feira e a origem, conhecida ──
select throws_ok($$ select public.checkin_gravar('11111111-1111-4111-8111-111111111111', date '2026-11-03', 'portal', 3, 3, 3, 3, 3) $$, 'P0001', 'semana_invalida',
  'terça-feira não é uma semana válida');
select throws_ok($$ select public.checkin_gravar('11111111-1111-4111-8111-111111111111', date '2026-11-02', 'sms', 3, 3, 3, 3, 3) $$, 'P0001', 'origem_invalida',
  'origem desconhecida é recusada');

select * from finish();
rollback;
