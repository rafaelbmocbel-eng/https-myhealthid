-- Invariantes estruturais de RLS e de funções privilegiadas. Não precisam de dados: olham o catálogo do banco.
-- Rodar: `supabase test db` (banco LOCAL do Supabase CLI; nunca em produção).
-- Convenção: `todo_start`/`todo_end` marcam PROBLEMAS CONHECIDOS ainda não corrigidos (docs/seguranca-rls-achados.md).
-- Eles aparecem como "not ok ... # TODO" e não derrubam a suíte; ao corrigir, o teste passa a avisar "TODO passed" e
-- basta tirar o todo. Hoje não há nenhum aberto.
begin;
select plan(8);

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
        'funil_leads.Public can insert leads',
        'medicamentos_catalogo.medicamentos_select_auth',
        'perfis_profissionais.Autenticados leem catalogo',
        'plano_cliente_config.plano_cliente_config_select',
        'protocolo_templates.Todos leem templates',
        'tecnicas_tratamento.Todos leem técnicas'
      ])),
  '{}'::text[],
  'nenhuma política aberta (true) fora dos catálogos públicos conhecidos');

-- Catálogo compartilhado de exercícios: nenhuma política de escrita aberta (a escrita é só da equipe científica; ver
-- 06_catalogo_exercicios.test.sql).
select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'exercicios_biblioteca'
      and cmd in ('UPDATE', 'DELETE', 'ALL', 'INSERT')
      and (qual in ('true', '(true)') or with_check in ('true', '(true)'))),
  0,
  'o catálogo de exercícios não tem política de escrita aberta');

-- Superfície de LEITURA pública (sem login): as tabelas com política de SELECT para anon/public que não consulta quem
-- está chamando. Tripwire: uma tabela nova aqui precisa ser decisão consciente. Links e respostas de avaliação e links de
-- agenda NÃO estão na lista de propósito (03_links_publicos.test.sql garante que o visitante não os lê).
select is(
  (select coalesce(array_agg(distinct p.tablename::text order by p.tablename::text), '{}'::text[])
     from pg_policies p
    where p.schemaname = 'public'
      and p.cmd in ('SELECT', 'ALL')
      and p.roles && array['anon', 'public']::name[]
      and coalesce(p.qual, '') !~* '(auth\.uid|auth\.jwt|auth\.role|current_setting)'),
  array[
    'evento_perguntas', 'exercicios_biblioteca', 'funil_config', 'planos', 'protocolo_templates', 'tecnicas_tratamento'
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
    'has_clinica_role', 'has_module_access', 'incrementar_clique_link', 'is_clinica_dono',
    'link_agenda_ativo_para', 'link_agenda_valido_por_token', 'link_avaliacao_valido', 'link_patient_user_by_email',
    'link_patient_user_by_token', 'meu_plano_atual', 'minha_clinica_equipe', 'minhas_solicitacoes_conexao',
    'pode_chancelar', 'remover_membro_clinica',
    'salvar_cadastro_paciente_publico', 'salvar_fase_myid', 'track_agenda_link_access'
  ]::text[],
  'as funções privilegiadas executáveis sem login são exatamente as conhecidas');

-- Funções de uso interno (só as Edge Functions chamam, com a service role): nem visitante nem usuário logado executam.
select is(
  (select coalesce(array_agg(p.proname::text order by p.proname::text), '{}'::text[])
     from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('paciente_por_telefone_norm', 'paciente_por_sufixo_telefone', 'incrementar_uso_ia')
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  '{}'::text[],
  'busca de paciente por telefone e contador de uso de IA não são executáveis por visitante nem por usuário logado');
select ok(
  has_function_privilege('service_role', 'public.incrementar_uso_ia(uuid, text)', 'execute')
  and has_function_privilege('service_role', 'public.paciente_por_telefone_norm(uuid, text)', 'execute')
  and has_function_privilege('service_role', 'public.paciente_por_sufixo_telefone(uuid, text)', 'execute'),
  'a service role (Edge Functions) continua executando essas funções');

select * from finish();
rollback;
