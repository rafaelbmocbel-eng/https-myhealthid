-- Responsáveis técnicos + % de repasse, para o cálculo do mês (fase 4).
alter table public.cassi_config
  add column if not exists responsaveis jsonb not null default '[]'::jsonb; -- [{nome, percentual}]

notify pgrst, 'reload schema';
