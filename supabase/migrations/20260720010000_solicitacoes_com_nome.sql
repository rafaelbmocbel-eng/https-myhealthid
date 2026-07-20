-- Solicitações da vitrine mostravam "Paciente <uuid>…" porque a tabela não tem
-- o nome do cliente e a RLS impede o profissional de ler o perfil dele.
-- Esta RPC (SECURITY DEFINER) devolve as solicitações do profissional já com o
-- NOME e e-mail resolvidos (portal_pacientes → pacientes → auth.users).
create or replace function public.minhas_solicitacoes_conexao()
returns table (
  id uuid,
  paciente_user_id uuid,
  status text,
  mensagem text,
  created_at timestamptz,
  paciente_nome text,
  paciente_email text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id, s.paciente_user_id, s.status, s.mensagem, s.created_at,
    coalesce(
      (select nullif(btrim(pp.nome), '') from public.portal_pacientes pp where pp.user_id = s.paciente_user_id limit 1),
      (select nullif(btrim(coalesce(p.nome, '') || ' ' || coalesce(p.sobrenome, '')), '') from public.pacientes p where p.user_id = s.paciente_user_id limit 1),
      (select nullif(u.raw_user_meta_data->>'nome', '') from auth.users u where u.id = s.paciente_user_id),
      (select split_part(u.email, '@', 1) from auth.users u where u.id = s.paciente_user_id),
      'Cliente'
    ) as paciente_nome,
    coalesce(
      (select pp.email from public.portal_pacientes pp where pp.user_id = s.paciente_user_id limit 1),
      (select u.email from auth.users u where u.id = s.paciente_user_id)
    ) as paciente_email
  from public.solicitacoes_conexao s
  where s.terapeuta_id = auth.uid()
  order by s.created_at desc;
$$;

revoke all on function public.minhas_solicitacoes_conexao() from public;
grant execute on function public.minhas_solicitacoes_conexao() to authenticated;

-- Backfill do selo Vitrine: marca origem='vitrine' em TODO paciente com
-- solicitação aceita — inclusive os que já tinham terapeuta e escaparam do
-- backfill anterior (que só pegava terapeuta_id nulo). Assim o ícone "Vitrine"
-- aparece na lista de pacientes para todos que vieram do marketplace.
update public.pacientes p
set origem = 'vitrine', updated_at = now()
where (p.origem is null or btrim(p.origem) = '')
  and exists (
    select 1 from public.solicitacoes_conexao s
    where s.paciente_user_id = p.user_id and s.status = 'aceita'
  );
