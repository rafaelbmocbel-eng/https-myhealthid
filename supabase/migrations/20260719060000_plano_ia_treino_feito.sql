-- Marcação de treino feito do plano de IA do CLIENTE (premium). Cada sessão do
-- plano que o cliente conclui vira uma linha (por dia), alimentando o progresso
-- semanal e a evolução. Tabela própria — o studio_execucoes é acoplado ao
-- sistema de treinos do profissional (exige treino_id/terapeuta_id).
create table if not exists public.plano_ia_treino_feito (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  sessao_key text not null,
  data date not null default current_date,
  created_at timestamptz not null default now(),
  unique (paciente_id, sessao_key, data)
);

create index if not exists idx_pitf_pac on public.plano_ia_treino_feito(paciente_id, data);

grant select, insert, update, delete on public.plano_ia_treino_feito to authenticated;
grant all on public.plano_ia_treino_feito to service_role;

alter table public.plano_ia_treino_feito enable row level security;

drop policy if exists "pitf_paciente_self" on public.plano_ia_treino_feito;
create policy "pitf_paciente_self" on public.plano_ia_treino_feito
  for all to authenticated
  using (paciente_id in (select id from public.pacientes where user_id = auth.uid()))
  with check (paciente_id in (select id from public.pacientes where user_id = auth.uid()));

drop policy if exists "pitf_terapeuta_read" on public.plano_ia_treino_feito;
create policy "pitf_terapeuta_read" on public.plano_ia_treino_feito
  for select to authenticated
  using (paciente_id in (select id from public.pacientes where terapeuta_id = auth.uid()));
