-- Repasse padrão (%) aplicado a profissionais da equipe sem % próprio
-- configurado. Antes era 40% fixo no código, sem como editar.
alter table public.config_clinica
  add column if not exists repasse_padrao_pct numeric not null default 40;

alter table public.config_clinica
  drop constraint if exists config_clinica_repasse_padrao_pct_chk;
alter table public.config_clinica
  add constraint config_clinica_repasse_padrao_pct_chk
  check (repasse_padrao_pct >= 0 and repasse_padrao_pct <= 100);
