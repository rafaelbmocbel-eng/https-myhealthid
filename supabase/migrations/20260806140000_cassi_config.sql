-- Configuração do Controle CASSI por profissional: códigos usados (com valor) e
-- imposto por guia. Base do cálculo financeiro do mês (fase 4).
create table if not exists public.cassi_config (
  terapeuta_id     uuid        primary key default auth.uid(),
  codigos          jsonb       not null default '[]'::jsonb, -- [{codigo, descricao, valor}]
  imposto_por_guia numeric     not null default 0,           -- R$ descontado por guia
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.cassi_config enable row level security;

drop policy if exists cassi_config_terapeuta_all on public.cassi_config;
create policy cassi_config_terapeuta_all
  on public.cassi_config for all to authenticated
  using (terapeuta_id = auth.uid())
  with check (terapeuta_id = auth.uid());
