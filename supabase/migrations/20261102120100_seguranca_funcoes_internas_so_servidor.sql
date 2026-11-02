-- Segurança (B): funções de uso interno deixam de ser executáveis por visitantes e usuários logados.
--
-- paciente_por_telefone_norm / paciente_por_sufixo_telefone devolvem id, nome e sobrenome do paciente de um terapeuta a
-- partir do telefone: sem login, quem soubesse o UUID do terapeuta confirmava quem é paciente dele. incrementar_uso_ia
-- deixava qualquer pessoa inflar o contador de IA de outro usuário. Só as Edge Functions (service role) chamam: whatsapp-webhook,
-- whatsapp-bot-reply e voice-assessment.
--
-- match_evidence / increment_evidence_citation (biblioteca de evidência) só são chamadas por Edge Functions com a service role,
-- e a migração que as criou revogou apenas de anon e authenticated, sem tirar de PUBLIC: entram aqui, se existirem.
--
-- O laço percorre as funções pelo NOME (todas as assinaturas e sobrecargas) em vez de uma lista fixa, e as três primeiras
-- fazem a migração FALHAR se continuarem executáveis por visitante ou usuário logado: o deploy aborta em vez de passar em silêncio.
do $$
declare
  f record;
  restam text;
begin
  for f in
    select p.oid::regprocedure::text as assinatura
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('paciente_por_telefone_norm', 'paciente_por_sufixo_telefone', 'incrementar_uso_ia',
                        'match_evidence', 'increment_evidence_citation')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.assinatura);
    execute format('grant execute on function %s to service_role', f.assinatura);
  end loop;

  select string_agg(p.oid::regprocedure::text, ', ') into restam
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
    and p.proname in ('paciente_por_telefone_norm', 'paciente_por_sufixo_telefone', 'incrementar_uso_ia')
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
  if restam is not null then
    raise exception 'Funções internas ainda executáveis sem ser pela service role: %', restam;
  end if;
end $$;
