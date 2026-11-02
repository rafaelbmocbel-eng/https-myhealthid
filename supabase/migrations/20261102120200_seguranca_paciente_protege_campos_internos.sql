-- Segurança (C): o paciente não altera, direto na tabela, os campos internos do próprio cadastro.
--
-- A política "Paciente atualiza o proprio cadastro" libera o UPDATE da linha inteira. Provado: o paciente conseguia mudar
-- xp_total (a função ganhar_xp limita e é idempotente, mas o UPDATE direto ignorava isso), terapeuta_id (transferir o
-- cadastro para outro terapeuta), ativo e os dados de convênio.
--
-- O gatilho restaura os campos internos SÓ quando quem altera é o próprio paciente, direto pelo navegador (papel
-- `authenticated`). Seguem livres: o terapeuta dono, o super admin, o service role e as funções SECURITY DEFINER (ganhar_xp,
-- salvar_cadastro_paciente_*, vínculo do portal), que rodam como dono do banco. A função é SECURITY INVOKER de propósito:
-- assim current_user distingue o navegador (authenticated) de uma função do servidor (dono do banco).
--
-- Campo novo em `pacientes` nasce editável pelo paciente: o teste supabase/tests/database/02_pacientes.test.sql obriga a
-- classificar cada coluna nova como editável ou interna.
-- Falha o deploy (em vez de quebrar toda gravação do paciente) se faltar alguma coluna citada pelo gatilho: o plpgsql só
-- descobre coluna inexistente na hora de executar.
do $$
declare faltam text;
begin
  select string_agg(c, ', ') into faltam
  from unnest(array[
    'id', 'terapeuta_id', 'clinica_id', 'convenio_id', 'responsavel_id', 'user_id', 'ativo', 'origem', 'origem_utm', 'observacoes',
    'portal_token', 'portal_link_enviado_em', 'vinculo_encerrado_em', 'tipo_pagamento', 'plano_saude', 'tipo_conta',
    'cadastro_status', 'nivel_atual', 'xp_total', 'carteirinha', 'codigos_cassi', 'guias_por_mes', 'guia_solicitada_em',
    'cassi_encerrado_em', 'cassi_encerrado_motivo', 'cassi_diagnostico', 'cassi_confirmado_mes', 'cassi_pedir_guia', 'created_at'
  ]) as c
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pacientes' and column_name = c);
  if faltam is not null then
    raise exception 'pacientes não tem as colunas que o gatilho de proteção cita: %', faltam;
  end if;
end $$;

create or replace function public.pacientes_protege_campos_internos()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user <> 'authenticated' or pg_trigger_depth() > 1 then return new; end if;
  if auth.uid() is null or old.user_id is distinct from auth.uid() then return new; end if;
  if old.terapeuta_id = auth.uid() or public.eh_super_admin() then return new; end if;

  new.id := old.id;
  new.terapeuta_id := old.terapeuta_id;
  new.clinica_id := old.clinica_id;
  new.convenio_id := old.convenio_id;
  new.responsavel_id := old.responsavel_id;
  new.user_id := old.user_id;
  new.ativo := old.ativo;
  new.origem := old.origem;
  new.origem_utm := old.origem_utm;
  new.observacoes := old.observacoes;
  new.portal_token := old.portal_token;
  new.portal_link_enviado_em := old.portal_link_enviado_em;
  new.vinculo_encerrado_em := old.vinculo_encerrado_em;
  new.tipo_pagamento := old.tipo_pagamento;
  new.plano_saude := old.plano_saude;
  new.tipo_conta := old.tipo_conta;
  new.cadastro_status := old.cadastro_status;
  new.nivel_atual := old.nivel_atual;
  new.xp_total := old.xp_total;
  new.carteirinha := old.carteirinha;
  new.codigos_cassi := old.codigos_cassi;
  new.guias_por_mes := old.guias_por_mes;
  new.guia_solicitada_em := old.guia_solicitada_em;
  new.cassi_encerrado_em := old.cassi_encerrado_em;
  new.cassi_encerrado_motivo := old.cassi_encerrado_motivo;
  new.cassi_diagnostico := old.cassi_diagnostico;
  new.cassi_confirmado_mes := old.cassi_confirmado_mes;
  new.cassi_pedir_guia := old.cassi_pedir_guia;
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists trg_pacientes_protege_campos_internos on public.pacientes;
create trigger trg_pacientes_protege_campos_internos
  before update on public.pacientes
  for each row execute function public.pacientes_protege_campos_internos();
