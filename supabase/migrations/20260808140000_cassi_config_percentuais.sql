-- Divisão financeira da CASSI em percentuais (fluxo real da clínica):
--  - imposto_percentual: cada guia desconta X% do bruto (ex.: 14%);
--  - minha_parte_percentual: do líquido (bruto − imposto), Y% é do profissional
--    (ex.: 45%); o restante fica com a clínica.
alter table public.cassi_config
  add column if not exists imposto_percentual    numeric not null default 0,
  add column if not exists minha_parte_percentual numeric not null default 0;

notify pgrst, 'reload schema';
