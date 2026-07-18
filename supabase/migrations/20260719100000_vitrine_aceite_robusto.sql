-- Correção: solicitações da Vitrine aceitas que NÃO viraram paciente de verdade.
-- O backfill anterior só fazia UPDATE — se o paciente não tinha linha em
-- pacientes (comum no fluxo Vitrine), ninguém era criado e ele não aparecia.
-- Agora: a RPC e o backfill CRIAM a linha (com nome/e-mail reais do auth) quando
-- não existe, e vinculam ao profissional.

create or replace function public.aceitar_solicitacao_conexao(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol record;
  v_nome text;
  v_email text;
begin
  select * into v_sol
    from public.solicitacoes_conexao
    where id = p_id and terapeuta_id = auth.uid();
  if v_sol is null then
    raise exception 'Solicitação não encontrada ou não pertence a você';
  end if;

  update public.solicitacoes_conexao
    set status = 'aceita', updated_at = now()
    where id = p_id;

  if exists (select 1 from public.pacientes where user_id = v_sol.paciente_user_id) then
    -- Já existe: vincula só se ainda não tiver dono (não "rouba" de outro).
    update public.pacientes
      set terapeuta_id = auth.uid(),
          origem = coalesce(origem, 'vitrine'),
          updated_at = now()
      where user_id = v_sol.paciente_user_id
        and (terapeuta_id is null or terapeuta_id = auth.uid());
  else
    -- Não existe: cria a linha com nome/e-mail reais do usuário.
    select coalesce(nullif(u.raw_user_meta_data->>'nome', ''), split_part(u.email, '@', 1), 'Cliente'),
           u.email
      into v_nome, v_email
      from auth.users u where u.id = v_sol.paciente_user_id;
    insert into public.pacientes (user_id, terapeuta_id, nome, sobrenome, email, ativo, cadastro_status, tipo_conta, origem)
    values (v_sol.paciente_user_id, auth.uid(), coalesce(v_nome, 'Cliente'), '', v_email, true, 'completo', 'wellness_free', 'vitrine');
  end if;
end;
$$;

grant execute on function public.aceitar_solicitacao_conexao(uuid) to authenticated;

-- Backfill robusto: para TODA solicitação aceita, garante um paciente vinculado
-- (cria se faltar). O profissional mais recente que aceitou vence; nunca rouba
-- paciente que já tem outro dono.
do $$
declare r record;
begin
  for r in
    select distinct on (s.paciente_user_id) s.paciente_user_id, s.terapeuta_id
    from public.solicitacoes_conexao s
    where s.status = 'aceita'
    order by s.paciente_user_id, s.updated_at desc
  loop
    if exists (select 1 from public.pacientes where user_id = r.paciente_user_id) then
      update public.pacientes
        set terapeuta_id = coalesce(terapeuta_id, r.terapeuta_id),
            origem = coalesce(origem, 'vitrine'),
            updated_at = now()
        where user_id = r.paciente_user_id and terapeuta_id is null;
    else
      insert into public.pacientes (user_id, terapeuta_id, nome, sobrenome, email, ativo, cadastro_status, tipo_conta, origem)
      select r.paciente_user_id, r.terapeuta_id,
             coalesce(nullif(u.raw_user_meta_data->>'nome', ''), split_part(u.email, '@', 1), 'Cliente'), '',
             u.email, true, 'completo', 'wellness_free', 'vitrine'
      from auth.users u where u.id = r.paciente_user_id;
    end if;
  end loop;
end $$;
