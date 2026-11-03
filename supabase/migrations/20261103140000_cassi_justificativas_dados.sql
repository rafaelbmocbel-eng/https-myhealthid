-- Justificativas dos pedidos de guia CASSI (códigos 301 e 131): os músculos tratados e, se o profissional quiser, os achados do
-- exame ficam no CADASTRO do cliente (igual cassi_diagnostico), para reaproveitar no próximo pedido. Servem de base para o
-- texto da justificativa; só o profissional escreve. Tamanho limitado no banco para a tela e a IA nunca receberem textão.
alter table public.pacientes
  add column if not exists cassi_musculos text,
  add column if not exists cassi_achados text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pacientes_cassi_musculos_tam') then
    alter table public.pacientes
      add constraint pacientes_cassi_musculos_tam check (cassi_musculos is null or char_length(cassi_musculos) <= 400);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pacientes_cassi_achados_tam') then
    alter table public.pacientes
      add constraint pacientes_cassi_achados_tam check (cassi_achados is null or char_length(cassi_achados) <= 600);
  end if;
end $$;

-- Campo novo em `pacientes` nasce editável pelo paciente (política "Paciente atualiza o proprio cadastro"). Estes dois são do
-- profissional: entram na lista dos campos internos que o gatilho devolve quando o próprio paciente tenta alterá-los. A função
-- é a mesma de 20261102120200 (SECURITY INVOKER, só age para o papel `authenticated` e fora de outro gatilho), com as duas
-- colunas a mais. O teste supabase/tests/database/02_pacientes.test.sql cobre a classificação.
do $$
declare faltam text;
begin
  select string_agg(c, ', ') into faltam
  from unnest(array[
    'id', 'terapeuta_id', 'clinica_id', 'convenio_id', 'responsavel_id', 'user_id', 'ativo', 'origem', 'origem_utm', 'observacoes',
    'portal_token', 'portal_link_enviado_em', 'vinculo_encerrado_em', 'tipo_pagamento', 'plano_saude', 'tipo_conta',
    'cadastro_status', 'nivel_atual', 'xp_total', 'carteirinha', 'codigos_cassi', 'guias_por_mes', 'guia_solicitada_em',
    'cassi_encerrado_em', 'cassi_encerrado_motivo', 'cassi_diagnostico', 'cassi_confirmado_mes', 'cassi_pedir_guia',
    'cassi_musculos', 'cassi_achados', 'created_at'
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
  new.cassi_musculos := old.cassi_musculos;
  new.cassi_achados := old.cassi_achados;
  new.created_at := old.created_at;
  return new;
end;
$$;

-- A função acima só protege se o gatilho que a chama existir (ele nasceu em 20261102120200): falha alto em vez de calar.
do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.pacientes'::regclass
                 and tgname = 'trg_pacientes_protege_campos_internos' and not tgisinternal) then
    raise exception 'o gatilho trg_pacientes_protege_campos_internos não existe: aplique antes a migração 20261102120200';
  end if;
end $$;

notify pgrst, 'reload schema';
