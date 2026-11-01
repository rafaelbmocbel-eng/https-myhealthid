-- Isolamento dos dados clínicos entre terapeutas. Para cada tabela abaixo existe uma linha da terapeuta A (paciente 1) e uma
-- do terapeuta B (paciente 2). Conferimos, com RLS valendo:
--   • A enxerga a própria linha (evita teste vazio que passa só porque a tabela está vazia);
--   • B não enxerga, não altera e não apaga a linha da A;
--   • visitante sem login não enxerga nada;
--   • o paciente do portal (ligado à A) não enxerga linha do paciente da B.
begin;
select plan(72);

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'terapeuta.a@teste.invalid'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'terapeuta.b@teste.invalid'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'paciente.p@teste.invalid');
insert into public.pacientes (id, terapeuta_id, nome, user_id) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Paciente da A', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Paciente da B', null);

-- Uma linha por tabela e por terapeuta
insert into public.notas_prontuario (paciente_id, terapeuta_id, titulo, descricao)
  select p, t, 'nota', 'conteúdo clínico sigiloso' from (values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)) v(p, t);
insert into public.pagamentos_paciente (paciente_id, terapeuta_id, descricao, valor)
  select p, t, 'sessão', 150 from (values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)) v(p, t);
insert into public.documentos_emitidos (paciente_id, terapeuta_id, tipo, titulo)
  select p, t, 'laudo', 'documento' from (values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)) v(p, t);
insert into public.atestados_medicos (paciente_id, terapeuta_id)
  select p, t from (values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)) v(p, t);
insert into public.termos_consentimento (paciente_id, terapeuta_id, texto_termo)
  select p, t, 'termo' from (values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)) v(p, t);
insert into public.chat_mensagens (paciente_id, terapeuta_id, mensagem)
  select p, t, 'mensagem privada' from (values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)) v(p, t);
insert into public.prescricoes_paciente (paciente_id, terapeuta_id)
  select p, t from (values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)) v(p, t);
insert into public.historia_vida_paciente (paciente_id, terapeuta_id, data_evento, titulo)
  select p, t, current_date, 'evento' from (values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)) v(p, t);
insert into public.exames_importados (paciente_id, terapeuta_id)
  select p, t from (values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)) v(p, t);
insert into public.agendamentos (paciente_id, terapeuta_id, data_inicio, data_fim)
  select p, t, now() + interval '1 day', now() + interval '1 day 1 hour' from (values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)) v(p, t);
insert into public.avaliacoes_voz (paciente_id, terapeuta_id, servico, transcricao, resultado)
  select p, t, 'identidade', 'transcrição sigilosa', '{}'::json from (values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid)) v(p, t);
insert into public.whatsapp_conversas (paciente_id, terapeuta_id, telefone)
  select p, t, tel from (values
    ('11111111-1111-4111-8111-111111111111'::uuid, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, '5511999990001'),
    ('22222222-2222-4222-8222-222222222222'::uuid, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, '5511999990002')) v(p, t, tel);

create function public._pgtap_contar(tabela text, filtro text) returns int language plpgsql as $$
declare n int;
begin
  execute format('select count(*) from public.%I where %s', tabela, filtro) into n;
  return n;
end $$;
create function public._pgtap_afetadas(comando text) returns int language plpgsql as $$
declare n int;
begin
  execute 'with x as (' || comando || ' returning 1) select count(*) from x' into n;
  return n;
end $$;

-- ── A enxerga a própria linha ──
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
set local role authenticated;
select ok(public._pgtap_contar(t, $f$ terapeuta_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $f$) >= 1, 'A enxerga a própria linha em ' || t)
  from unnest(array['notas_prontuario', 'pagamentos_paciente', 'documentos_emitidos', 'atestados_medicos', 'termos_consentimento',
    'chat_mensagens', 'prescricoes_paciente', 'historia_vida_paciente', 'exames_importados', 'agendamentos', 'avaliacoes_voz',
    'whatsapp_conversas']) as t;
reset role;

-- ── B não enxerga, não altera e não apaga o que é da A ──
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
set local role authenticated;
select is(public._pgtap_contar(t, $f$ terapeuta_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $f$), 0, 'B não enxerga a linha da A em ' || t)
  from unnest(array['notas_prontuario', 'pagamentos_paciente', 'documentos_emitidos', 'atestados_medicos', 'termos_consentimento',
    'chat_mensagens', 'prescricoes_paciente', 'historia_vida_paciente', 'exames_importados', 'agendamentos', 'avaliacoes_voz',
    'whatsapp_conversas']) as t;
select is(public._pgtap_afetadas(format($f$ update public.%I set terapeuta_id = terapeuta_id where terapeuta_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $f$, t)), 0,
  'B não consegue alterar a linha da A em ' || t)
  from unnest(array['notas_prontuario', 'pagamentos_paciente', 'documentos_emitidos', 'atestados_medicos', 'termos_consentimento',
    'chat_mensagens', 'prescricoes_paciente', 'historia_vida_paciente', 'exames_importados', 'agendamentos', 'avaliacoes_voz',
    'whatsapp_conversas']) as t;
select is(public._pgtap_afetadas(format($f$ delete from public.%I where terapeuta_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' $f$, t)), 0,
  'B não consegue apagar a linha da A em ' || t)
  from unnest(array['notas_prontuario', 'pagamentos_paciente', 'documentos_emitidos', 'atestados_medicos', 'termos_consentimento',
    'chat_mensagens', 'prescricoes_paciente', 'historia_vida_paciente', 'exames_importados', 'agendamentos', 'avaliacoes_voz',
    'whatsapp_conversas']) as t;
reset role;

-- ── Visitante sem login ──
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select is(public._pgtap_contar(t, 'true'), 0, 'visitante sem login não enxerga nada em ' || t)
  from unnest(array['notas_prontuario', 'pagamentos_paciente', 'documentos_emitidos', 'atestados_medicos', 'termos_consentimento',
    'chat_mensagens', 'prescricoes_paciente', 'historia_vida_paciente', 'exames_importados', 'agendamentos', 'avaliacoes_voz',
    'whatsapp_conversas']) as t;
reset role;

-- ── Paciente do portal (ligado à A): não enxerga o que é do paciente da B ──
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
set local role authenticated;
select is(public._pgtap_contar(t, $f$ paciente_id = '22222222-2222-4222-8222-222222222222' $f$), 0, 'o paciente da A não enxerga dados do paciente da B em ' || t)
  from unnest(array['notas_prontuario', 'pagamentos_paciente', 'documentos_emitidos', 'atestados_medicos', 'termos_consentimento',
    'chat_mensagens', 'prescricoes_paciente', 'historia_vida_paciente', 'exames_importados', 'agendamentos', 'avaliacoes_voz',
    'whatsapp_conversas']) as t;
reset role;

select * from finish();
rollback;
