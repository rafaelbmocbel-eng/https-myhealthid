-- Proteção contra DUPLICATAS de paciente pelo mesmo user_id (uma das causas de
-- "profissional vê uma linha e os dados estão em outra"). Tenta criar um índice
-- único parcial em pacientes.user_id (só quando não nulo). Se já houver
-- duplicatas exatas, NÃO quebra o deploy — apenas registra um aviso para
-- deduplicação manual cuidadosa depois (mesclar linhas de paciente é sensível e
-- não deve ser feito às cegas).
do $$
begin
  begin
    create unique index if not exists uniq_pacientes_user_id
      on public.pacientes (user_id)
      where user_id is not null;
  exception when others then
    raise warning 'pacientes.user_id: nao foi possivel criar indice unico (provavel duplicata existente). Deduplicar manualmente antes. Erro: %', sqlerrm;
  end;
end $$;
