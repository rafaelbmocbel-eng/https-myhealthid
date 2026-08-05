-- IMPORTAÇÃO das guias CASSI a partir do CSV (05/08/2026).
-- Casa cada linha ao paciente por NOME normalizado (unaccent + minúsculas +
-- espaços colapsados). Linhas sem paciente cadastrado são puladas (NOTICE lista
-- quais). Idempotente: não reinsere a mesma guia (observacoes + data do pedido).

create schema if not exists extensions;
create extension if not exists unaccent with schema extensions;

do $$
declare inseridas int; nao_encontrados text;
begin
  create temp table _cassi_imp (
    nome_csv text, matricula text, status text, codigos jsonb,
    data_resposta date, data_pedido date, sessoes_autorizadas int,
    sessoes_realizadas int, responsavel text, diagnostico text, obs text, chave text
  );
  insert into _cassi_imp
  select v.*, lower(extensions.unaccent(regexp_replace(trim(v.nome_csv), '\s+', ' ', 'g')))
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
      where lower(extensions.unaccent(regexp_replace(trim(p.nome || ' ' || coalesce(p.sobrenome,'')), '\s+', ' ', 'g'))) = n.chave or lower(extensions.unaccent(regexp_replace(trim(p.nome), '\s+', ' ', 'g'))) = n.chave
      order by p.created_at asc nulls last limit 1
    ) mp
    where not exists (
      select 1 from public.guias_cassi g
      where g.paciente_id = mp.id and g.observacoes = n.obs
        and g.data_pedido is not distinct from n.data_pedido)
    returning 1
  )
  select count(*) into inseridas from ins;
  select string_agg(distinct nome_csv, ', ') into nao_encontrados
  from _cassi_imp n
  where not exists (select 1 from public.pacientes p where lower(extensions.unaccent(regexp_replace(trim(p.nome || ' ' || coalesce(p.sobrenome,'')), '\s+', ' ', 'g'))) = n.chave or lower(extensions.unaccent(regexp_replace(trim(p.nome), '\s+', ' ', 'g'))) = n.chave);
  raise notice 'Controle CASSI: % guias importadas do CSV.', inseridas;
  if nao_encontrados is not null then
    raise notice 'Sem paciente cadastrado (guia NAO importada): %', nao_encontrados;
  end if;
  drop table _cassi_imp;
end $$;
