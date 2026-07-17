-- Plano personalizado gerado por IA para o CLIENTE (premium), a partir do MyID
-- + questionários clínicos + anamnese nutricional. É SUPORTE, não substitui o
-- profissional (planos elaborados pedem acompanhamento presencial). Fica numa
-- tabela própria para NÃO se misturar com os planos que o profissional cria e
-- aprova (planos_treino / planos_alimentares).
create table if not exists public.planos_ia_cliente (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  tipo text not null check (tipo in ('treino', 'nutricao')),
  titulo text,
  conteudo jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paciente_id, tipo)
);

create index if not exists idx_planos_ia_cliente_pac on public.planos_ia_cliente(paciente_id);

grant select, insert, update, delete on public.planos_ia_cliente to authenticated;
grant all on public.planos_ia_cliente to service_role;

alter table public.planos_ia_cliente enable row level security;

-- O próprio paciente gera, vê e atualiza o seu plano de IA.
drop policy if exists "pic_paciente_self" on public.planos_ia_cliente;
create policy "pic_paciente_self" on public.planos_ia_cliente
  for all to authenticated
  using (paciente_id in (select id from public.pacientes where user_id = auth.uid()))
  with check (paciente_id in (select id from public.pacientes where user_id = auth.uid()));

-- O profissional do paciente pode VER o que a IA sugeriu (para acompanhar).
drop policy if exists "pic_terapeuta_read" on public.planos_ia_cliente;
create policy "pic_terapeuta_read" on public.planos_ia_cliente
  for select to authenticated
  using (paciente_id in (select id from public.pacientes where terapeuta_id = auth.uid()));

create or replace trigger trg_pic_updated_at
  before update on public.planos_ia_cliente
  for each row execute function public.update_updated_at_column();
