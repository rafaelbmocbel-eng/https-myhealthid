-- Ao ACEITAR uma solicitação da Vitrine, o profissional passava a ver
-- "Aceita" mas o paciente NÃO era vinculado — não aparecia na lista de
-- Pacientes. Esta função faz o aceite vincular de verdade: seta
-- pacientes.terapeuta_id e marca origem='vitrine' (para o selo). SECURITY
-- DEFINER porque o profissional ainda não é dono da linha do paciente.
create or replace function public.aceitar_solicitacao_conexao(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol record;
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

  -- Vincula o paciente (só se ainda não tiver dono, para não "roubar" paciente
  -- de outro profissional) e marca a origem como vitrine (selo).
  update public.pacientes
    set terapeuta_id = auth.uid(),
        origem = coalesce(origem, 'vitrine'),
        updated_at = now()
    where user_id = v_sol.paciente_user_id
      and (terapeuta_id is null or terapeuta_id = auth.uid());

  -- Edge case: paciente sem linha em pacientes ainda — cria uma mínima.
  if not exists (select 1 from public.pacientes where user_id = v_sol.paciente_user_id) then
    insert into public.pacientes (user_id, terapeuta_id, nome, sobrenome, ativo, cadastro_status, tipo_conta, origem)
    values (v_sol.paciente_user_id, auth.uid(), 'Cliente', '', true, 'completo', 'wellness_free', 'vitrine');
  end if;
end;
$$;

grant execute on function public.aceitar_solicitacao_conexao(uuid) to authenticated;

-- Backfill: solicitações que já estavam "aceita" mas nunca vincularam o
-- paciente. Vincula ao profissional que aceitou (o mais recente vence) e marca
-- origem=vitrine. Só toca pacientes ainda sem profissional.
do $$
declare r record;
begin
  for r in
    select distinct on (s.paciente_user_id) s.paciente_user_id, s.terapeuta_id
    from public.solicitacoes_conexao s
    where s.status = 'aceita'
    order by s.paciente_user_id, s.updated_at desc
  loop
    update public.pacientes
      set terapeuta_id = r.terapeuta_id,
          origem = coalesce(origem, 'vitrine'),
          updated_at = now()
      where user_id = r.paciente_user_id
        and terapeuta_id is null;
  end loop;
end $$;
