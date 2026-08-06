-- Cadastro dos 18 pacientes CASSI + (re)importação das guias deles.
-- Cria os pacientes como CASSI, ativos e prontos (o profissional completa email
-- etc. depois). Idempotente: não duplica paciente com o mesmo nome normalizado.
-- Depois re-roda a importação das guias do CSV (idempotente) para grudarem nos
-- pacientes recém-criados.

create extension if not exists pgcrypto;
create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

-- 1) PACIENTES ----------------------------------------------------------------
do $$
declare v_ter uuid;
begin
  select id into v_ter from auth.users where lower(email) = 'rafaelbmocbel@gmail.com'
    order by created_at asc nulls last limit 1;
  if v_ter is null then
    select terapeuta_id into v_ter from public.pacientes
    where terapeuta_id is not null group by terapeuta_id order by count(*) desc limit 1;
  end if;
  if v_ter is null then raise exception 'terapeuta não encontrado'; end if;

  insert into public.pacientes (
    terapeuta_id, nome, sobrenome, telefone, plano_saude, ativo,
    cadastro_status, portal_token, tipo_conta, observacoes)
  select v_ter, d.nome, d.sobrenome, d.telefone, 'CASSI', true,
    'completo', encode(gen_random_bytes(16), 'hex'), 'clinico', nullif(d.obs,'')
  from (values
    ('André', 'Luiz Barbosa Ferreira', '91984900676', 'Diagnóstico (CASSI): tendinite mais ciatalgia'),
    ('Beatriz', 'Silva Barros', '91991779067', 'Diagnóstico (CASSI): Tendinopatia calcária supra espinhal ombro E e D'),
    ('CARLOS', 'EDUARDO DA FONSECA DUARTE CAETANO', NULL, 'Diagnóstico (CASSI): Patologias osteomioarticular – escoliose'),
    ('Francisco', 'José Menezes', NULL, 'Diagnóstico (CASSI): Desvios posturais da coluna'),
    ('Gabriel', 'Foro Siqueira', '91980126507', 'Diagnóstico (CASSI): Discopatia Cervical'),
    ('Ismael', 'Nazareno Monteiro do Amaral', '91988795886', 'Diagnóstico (CASSI): Tendinite calcária supra espinhal ombro E'),
    ('José', 'Pantoja de Moraes Filho', NULL, 'Diagnóstico (CASSI): Discopatia Lombar'),
    ('Judith', 'Maria de Carvalho Francez', '91988064800', 'Diagnóstico (CASSI): Sinovite tornozelo D/E, DTM severa'),
    ('Katia', 'Maria de Alvarenga', '91993421666', 'Diagnóstico (CASSI): Cervicobraquialgia'),
    ('Leopoldina', 'Tarcila C. Pinage', '91982245943', 'Diagnóstico (CASSI): Cervicalgia e tontura'),
    ('Márcia', 'Martins de Vasconcelos', '91981604274', 'Diagnóstico (CASSI): ATM, sinovite fibulares E'),
    ('Maria', 'da Graça Cardoso Sales', '91981864553', 'Diagnóstico (CASSI): Lombociatalgia MMII E, estenose de canal'),
    ('Maria', 'do Socorro de Souza Silva', '980566295', 'Diagnóstico (CASSI): Tendinopatia calcária supra-espinhal ombro E'),
    ('Narayana', 'Borges de Oliveira', '91981073113', 'Diagnóstico (CASSI): ATM e escoliose lombar E'),
    ('Narlicelma', 'Sobral Santos Ramos', '91988986266', 'Diagnóstico (CASSI): Dor crônica em rombóides'),
    ('Pedro', 'Paulo dos Santos', '9191127952', 'Diagnóstico (CASSI): Hérnia de disco + lombalgia'),
    ('Pedro', 'Paulo Macedo Amorim', '91981667220', NULL),
    ('Sebastião', 'Almeida da Conceição', '9198502233', 'Diagnóstico (CASSI): Artrite Reumatóide')
  ) as d(nome, sobrenome, telefone, obs)
  where not exists (
    select 1 from public.pacientes p
    where p.terapeuta_id = v_ter
      and trim(regexp_replace(regexp_replace(lower(extensions.unaccent(p.nome || ' ' || coalesce(p.sobrenome,''))), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')) = trim(regexp_replace(regexp_replace(lower(extensions.unaccent(d.nome || ' ' || d.sobrenome)), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g'))
  );
end $$;

-- 2) GUIAS (re-import idempotente) -------------------------------------------
do $$
declare inseridas int; nao_encontrados text;
begin
  create temp table _cassi_imp (
    nome_csv text, matricula text, status text, codigos jsonb,
    data_resposta date, data_pedido date, sessoes_autorizadas int,
    sessoes_realizadas int, responsavel text, diagnostico text, obs text, chave text);
  insert into _cassi_imp
  select v.*, trim(regexp_replace(regexp_replace(lower(extensions.unaccent(v.nome_csv)), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g'))
  from (values
      ('Francisco José menezes', '030003434326000061', 'aguardando', '["185","012","144"]'::jsonb, NULL::date, DATE '2026-08-03', 10, 0, 'Rafael', NULL, 'Valor bruto: R$ 0,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Gabriel Foro Siqueira', '2302007037390082', 'ativa', '["144","185","012"]'::jsonb, DATE '2026-08-03', DATE '2026-08-03', 10, 2, 'Rafael', 'Discopatia Cervical', 'Valor bruto: R$ 2033,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Francisco José menezes', '030003434326000061', 'finalizada', '["185","012","144"]'::jsonb, DATE '2026-07-09', DATE '2026-07-31', 10, 0, 'Rafael', NULL, 'Valor bruto: R$ 2033,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Leopoldina tarcila C pinage', '0300061672200168', 'aguardando', '["012","185"]'::jsonb, NULL::date, DATE '2026-07-20', 10, 0, 'Rafael', 'cervicalgia e tontura', 'Valor bruto: R$ 0,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Pedro Paulo Macedo Amorim', '1001004630540010', 'ativa', '["144","012","185"]'::jsonb, DATE '2026-07-09', DATE '2026-07-10', 10, 10, 'Rafael', NULL, 'Valor bruto: R$ 2033,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Narlicelma Sobral Santos Ramos', '2302007010490065', 'ativa', '["012","185","144"]'::jsonb, DATE '2026-07-09', DATE '2026-07-10', 10, 10, 'Rafael', 'DOR CRÔNICA EM ROMBÓIDES', 'Valor bruto: R$ 2033,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Sebastião Almeida da Conceição', '0300089726300047', 'ativa', '["144","185","012"]'::jsonb, DATE '2026-06-26', DATE '2026-07-09', 10, 10, 'Deyvison Ferreira', 'Artrite Reumatóide', 'Valor bruto: R$ 1483,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Ismael nazareno Monteiro do Amaral', '3103001310680058', 'ativa', '["012","185","144"]'::jsonb, DATE '2026-07-02', DATE '2026-07-06', 10, 10, 'Rafael', 'TENDINITE CALCÁRIA DE SUPRA ESPINHAL  OMBRO ESQUERDO', 'Valor bruto: R$ 1483,00 · Negados: 1 · (importado CSV 05/08/2026)'),
      ('Beatriz Silva Barros', '1101704278280025', 'ativa', '["185","012"]'::jsonb, DATE '2026-07-02', DATE '2026-07-03', 10, 10, 'Rafael', 'Tendinopatia calcária e supra espinhal no ombro esquerdo e direito', 'Valor bruto: R$ 1483,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Katia Maria de Alvarenga', '0010060690850051', 'ativa', '["185","012"]'::jsonb, DATE '2026-07-02', DATE '2026-07-03', 10, 10, 'Rafael', 'CERVICOBRAQUIALGIA.', 'Valor bruto: R$ 1483,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Narayana Borges de Oliveira', '0010059509950220', 'ativa', '["012","185","144"]'::jsonb, DATE '2026-07-02', DATE '2026-07-03', 10, 10, 'Rafael', 'ATM E ESCOLIOSE LOMBAR ESQUERDA', 'Valor bruto: R$ 1483,00 · Negados: 1 · (importado CSV 05/08/2026)'),
      ('Márcia Martins de Vasconcelos', '1321320055180073', 'ativa', '["160","185","144"]'::jsonb, DATE '2026-07-02', DATE '2026-07-03', 10, 10, 'RAFAEL', 'ATM, SINIVITE DE FIBULARES ESQUERDO', 'Valor bruto: R$ 1253,00 · Negados: 1 · (importado CSV 05/08/2026)'),
      ('MARIA DA GRAÇA CARDOSO SALES', '0300068467790080', 'ativa', '["185","012"]'::jsonb, DATE '2026-07-02', DATE '2026-07-03', 10, 10, 'Rafael', 'LOMBOCIATALGIA MMII E, ESTENOSE DE CANAL DE RECESSO LATERAL E PROTRUSÃO DISCAL.', 'Valor bruto: R$ 1483,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('André Luiz Barbosa Ferreira', '0300007389760026', 'ativa', '["012","185","144"]'::jsonb, DATE '2026-06-25', DATE '2026-06-29', 10, 10, 'Rafael', 'tendinite mais ciatalgia', 'Valor bruto: R$ 2033,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Maria do Socorro de Souza Silva', '0300064181100236', 'ativa', '["185","012"]'::jsonb, DATE '2026-06-26', DATE '2026-06-26', 10, 10, 'Deyvison Ferreira', 'Tendinopatia Calcária do Supra-Espinhal do ombro esquerdo', 'Valor bruto: R$ 1483,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Leopoldina tarcila C pinage', '0300061672200168', 'finalizada', '["012","185"]'::jsonb, DATE '2026-06-22', DATE '2026-06-25', 10, 10, 'Rafael', 'cervicalgia e tontura', 'Valor bruto: R$ 1483,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('André Luiz Barbosa Ferreira', '0300007389760026', 'finalizada', '["185","144"]'::jsonb, DATE '2026-06-25', DATE '2026-06-25', 10, 2, NULL, NULL, 'Valor bruto: R$ 1523,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Pedro Paulo dos santos', '0300082798020090', 'finalizada', '["185","012","144"]'::jsonb, DATE '2026-06-23', DATE '2026-06-24', 10, 10, 'Rafael', 'HÉNIA DE DISCO MAIS LOMBALGIA', 'Valor bruto: R$ 1436,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Pedro Paulo dos santos', '0300082798020090', 'ativa', '["144","185","012"]'::jsonb, DATE '2026-06-23', DATE '2026-06-24', 10, 10, 'Rafael', 'HÉNIA DE DISCO MAIS LOMBALGIA', 'Valor bruto: R$ 1483,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('José Pantoja de Moraes Filho', '0300057600400025', 'ativa', '["144","185","012"]'::jsonb, DATE '2026-06-12', DATE '2026-06-18', 10, 10, NULL, 'Discopatia Lombar', 'Valor bruto: R$ 2033,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Beatriz Silva Barros', '1101704278280025', 'finalizada', '["185","160"]'::jsonb, DATE '2026-06-05', DATE '2026-06-08', 10, 10, 'Rafael mocbel', 'TENDINOPATIA CALCÁRIAEM SUPRA ESPINHAL, D , E.', 'Valor bruto: R$ 1253,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Katia Maria de Alvarenga', '0010060690850051', 'finalizada', '["144","185","012"]'::jsonb, DATE '2026-06-01', DATE '2026-06-02', 10, 21, 'Rafael', 'CERVICOBRAQUIALGIA.', 'Valor bruto: R$ 2033,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Narlicelma Sobral Santos Ramos', '2302007010490065', 'finalizada', '["144","012","185"]'::jsonb, DATE '2026-05-29', DATE '2026-06-01', 10, 13, 'Rafael', 'DOR CRÔNICA EM ROMBÓIDES', 'Valor bruto: R$ 2033,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Pedro Paulo Macedo Amorim', '1001004630540010', 'finalizada', '["144","012","185"]'::jsonb, DATE '2026-05-29', DATE '2026-05-29', 10, 13, NULL, NULL, 'Valor bruto: R$ 1502,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Judith Maria de Carvalho francez', '0300060000170073', 'finalizada', '["012","185"]'::jsonb, DATE '2026-05-20', DATE '2026-05-21', 10, 11, 'Rafael', 'SINOVITETORNOZELOD,E DTM SEVERA', 'Valor bruto: R$ 0,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('MARIA DA GRAÇA CARDOSO SALES', '0300068467790080', 'finalizada', '["144","012","185"]'::jsonb, DATE '2026-05-20', DATE '2026-05-21', 10, 10, 'RAFAEL', 'LOMBOCIATALGIA MMII E, ESTENOSE DE CANAL DE RECESSO LATERAL E PROTRUSÃO DISCAL.', 'Valor bruto: R$ 1538,00 · Negados: 0 · (importado CSV 05/08/2026)'),
      ('Narayana Borges de Oliveira', '0010059509950220', 'finalizada', '["185","012","144"]'::jsonb, DATE '2026-05-20', DATE '2026-05-20', 13, 13, NULL, NULL, 'Valor bruto: R$ 1927,90 · Negados: 1 · (importado CSV 05/08/2026)'),
      ('Ismael nazareno Monteiro do Amaral', '3103001310680058', 'finalizada', '["012","144","185"]'::jsonb, DATE '2026-05-04', DATE '2026-05-04', 11, 11, 'Rafael', 'TENDINITE CALCÁRIA DE SUPRA ESPINHAL  OMBRO ESQUERDO', 'Valor bruto: R$ 1631,30 · Negados: 1 · (importado CSV 05/08/2026)'),
      ('Márcia Martins de Vasconcelos', '1321320055180073', 'finalizada', '["185","144","160"]'::jsonb, DATE '2026-04-29', DATE '2026-04-29', 20, 20, NULL, NULL, 'Valor bruto: R$ 2506,00 · Negados: 1 · (importado CSV 05/08/2026)')
  ) as v(nome_csv, matricula, status, codigos, data_resposta, data_pedido,
         sessoes_autorizadas, sessoes_realizadas, responsavel, diagnostico, obs);

  with ins as (
    insert into public.guias_cassi (
      terapeuta_id, paciente_id, matricula, data_pedido, data_resposta,
      sessoes_autorizadas, sessoes_realizadas, codigos, status,
      responsavel_tecnico, diagnostico, observacoes)
    select mp.terapeuta_id, mp.id, n.matricula, n.data_pedido, n.data_resposta,
      n.sessoes_autorizadas, n.sessoes_realizadas,
      (select jsonb_agg(jsonb_build_object('codigo', c)) from jsonb_array_elements_text(n.codigos) c),
      n.status, n.responsavel, n.diagnostico, n.obs
    from _cassi_imp n
    cross join lateral (
      select p.id, p.terapeuta_id from public.pacientes p
      where trim(regexp_replace(regexp_replace(lower(extensions.unaccent(p.nome || ' ' || coalesce(p.sobrenome,''))), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')) = n.chave or trim(regexp_replace(regexp_replace(lower(extensions.unaccent(p.nome)), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')) = n.chave
      order by p.created_at asc nulls last limit 1) mp
    where not exists (
      select 1 from public.guias_cassi g
      where g.paciente_id = mp.id and g.observacoes = n.obs
        and g.data_pedido is not distinct from n.data_pedido)
    returning 1)
  select count(*) into inseridas from ins;
  select string_agg(distinct nome_csv, ', ') into nao_encontrados
  from _cassi_imp n where not exists (
    select 1 from public.pacientes p where trim(regexp_replace(regexp_replace(lower(extensions.unaccent(p.nome || ' ' || coalesce(p.sobrenome,''))), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')) = n.chave or trim(regexp_replace(regexp_replace(lower(extensions.unaccent(p.nome)), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g')) = n.chave);
  raise notice 'Guias CASSI importadas agora: %', inseridas;
  if nao_encontrados is not null then
    raise notice 'Ainda sem paciente: %', nao_encontrados;
  end if;
  drop table _cassi_imp;
end $$;
