-- Invariantes estruturais de RLS e de funções privilegiadas. Não precisam de dados: olham o catálogo do banco.
-- Rodar: `supabase test db` (banco LOCAL do Supabase CLI; nunca em produção).
-- Convenção: `todo_start`/`todo_end` marcam PROBLEMAS CONHECIDOS (documentados em docs/seguranca-rls-achados.md).
-- Eles aparecem como "not ok ... # TODO" e não derrubam a suíte; ao corrigir o problema, o teste passa a avisar
-- "TODO passed" e basta tirar o todo.
begin;
select plan(7);

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0,
  'toda tabela em public tem RLS ligada');

-- Políticas "abertas" (using/with check = true) para anon, authenticated ou public só são aceitas nos catálogos de leitura
-- pública abaixo. Uma tabela nova com política aberta quebra este teste: decida de propósito e acrescente à lista.
select is(
  (select coalesce(array_agg(p.tablename || '.' || p.policyname order by p.tablename, p.policyname), '{}'::text[])
     from pg_policies p
    where p.schemaname = 'public'
      and (p.qual in ('true', '(true)') or p.with_check in ('true', '(true)'))
      and p.roles && array['anon', 'authenticated', 'public']::name[]
      and (p.tablename || '.' || p.policyname) <> all (array[
        'audio_health_checks.audio_health_select_autenticado',
        'cid10_catalogo.cid10_select_auth',
        'evidence_ingestion_log.Authenticated users can read ingestion log',
        'exercicios_biblioteca.Todos leem exercícios',
        'exercicios_biblioteca.Autenticados editam exercicios catalogo',
        'exercicios_biblioteca.Autenticados apagam exercicios catalogo',
        'funil_leads.Public can insert leads',
        'medicamentos_catalogo.medicamentos_select_auth',
        'perfis_profissionais.Autenticados leem catalogo',
        'plano_cliente_config.plano_cliente_config_select',
        'protocolo_templates.Todos leem templates',
        'tecnicas_tratamento.Todos leem técnicas'
      ])),
  '{}'::text[],
  'nenhuma política aberta (true) fora dos catálogos públicos conhecidos');

-- PROBLEMA CONHECIDO: qualquer usuário logado (inclusive paciente) pode editar e apagar o catálogo compartilhado de
-- exercícios. A própria migração 20260712160000 deixa um TODO para restringir a um papel de admin da plataforma.
select todo_start('catálogo de exercícios editável por qualquer usuário logado (ver docs/seguranca-rls-achados.md)');
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'exercicios_biblioteca'
      and cmd in ('UPDATE', 'DELETE', 'ALL')
      and roles && array['authenticated', 'anon', 'public']::name[]
      and (qual in ('true', '(true)') or with_check in ('true', '(true)'))),
  0,
  'só a curadoria edita ou apaga o catálogo de exercícios');
select todo_end();

-- Superfície de LEITURA pública (sem login): as tabelas com política de SELECT para anon/public que não consulta quem
-- está chamando. Tripwire: uma tabela nova aqui precisa ser decisão consciente. As 3 marcadas (links e respostas de
-- avaliação, links de agenda) são o problema conhecido coberto em 03_links_publicos.test.sql: ao corrigir, tire da lista.
select is(
  (select coalesce(array_agg(distinct p.tablename::text order by p.tablename::text), '{}'::text[])
     from pg_policies p
    where p.schemaname = 'public'
      and p.cmd in ('SELECT', 'ALL')
      and p.roles && array['anon', 'public']::name[]
      and coalesce(p.qual, '') !~* '(auth\.uid|auth\.jwt|auth\.role|current_setting)'),
  array[
    'evento_perguntas', 'exercicios_biblioteca', 'funil_config', 'links_agenda_paciente', 'links_avaliacao',
    'planos', 'protocolo_templates', 'respostas_avaliacao_paciente', 'tecnicas_tratamento'
  ]::text[],
  'a superfície de leitura pública (sem login) é exatamente a conhecida');

select is(
  (select count(*)::int from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%')),
  0,
  'toda função SECURITY DEFINER em public fixa o search_path');

-- Funções SECURITY DEFINER (rodam com privilégio do dono) que um visitante SEM LOGIN consegue executar. Cada uma precisa
-- validar sozinha quem chama ou aceitar só um token de capacidade. Tripwire: função nova nesta lista é decisão consciente.
select is(
  (select coalesce(array_agg(p.proname::text order by p.proname::text), '{}'::text[])
     from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prosecdef and p.prorettype <> 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'execute')),
  array[
    'aceitar_convite_clinica', 'aceitar_solicitacao_conexao', 'cancelar_convite_clinica', 'convidar_clinica', 'count_evento_inscricoes', 'criar_minha_clinica', 'criar_paciente_wellness',
    'excluir_paciente_completo', 'ganhar_xp', 'get_active_inscricao_ids', 'get_agenda_disponibilidade',
    'get_agenda_link_by_token', 'get_ausencias_by_token', 'get_config_agenda_by_funil_slug', 'get_config_agenda_by_token',
    'get_evento_pagamento', 'get_funil_pagamento', 'get_funil_publico', 'get_myid_concluido_publico',
    'get_myid_em_andamento', 'get_paciente_completar_publico', 'get_public_tracking_config',
    'get_terapeuta_by_agenda_token', 'get_treino_por_token', 'get_turnos_by_token', 'get_wellness_status',
    'has_clinica_role', 'has_module_access', 'incrementar_clique_link', 'incrementar_uso_ia', 'is_clinica_dono',
    'link_agenda_valido_por_token', 'link_avaliacao_valido', 'link_patient_user_by_email', 'link_patient_user_by_token',
    'meu_plano_atual', 'minha_clinica_equipe', 'minhas_solicitacoes_conexao', 'paciente_por_sufixo_telefone',
    'paciente_por_telefone_norm', 'pode_chancelar', 'remover_membro_clinica', 'salvar_cadastro_paciente_autenticado',
    'salvar_cadastro_paciente_publico', 'salvar_fase_myid', 'track_agenda_link_access'
  ]::text[],
  'as funções privilegiadas executáveis sem login são exatamente as conhecidas');

-- PROBLEMA CONHECIDO: funções que só as Edge Functions (service role) chamam, mas qualquer visitante executa.
select todo_start('funções de uso interno executáveis sem login (ver docs/seguranca-rls-achados.md)');
select is(
  (select coalesce(array_agg(p.proname::text order by p.proname::text), '{}'::text[])
     from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('paciente_por_telefone_norm', 'paciente_por_sufixo_telefone', 'incrementar_uso_ia')
      and has_function_privilege('anon', p.oid, 'execute')),
  '{}'::text[],
  'busca de paciente por telefone e contador de uso de IA não são executáveis sem login');
select todo_end();

select * from finish();
rollback;
