-- EXAMES PRESENCIAIS (genérico e extensível): bioimpedância, teste de pisada e
-- futuros exames feitos pelo profissional na clínica. O resultado alimenta os
-- motores de IA (treino/nutrição/saúde) via _shared/motores-plano.ts.
--
-- Estrutura genérica: `tipo` é texto livre (novos exames não exigem migração) e
-- `dados` guarda as medidas em JSON. `resumo` é a frase pronta para leitura e
-- para a IA.

create table if not exists public.exames_presenciais (
  id               uuid        primary key default gen_random_uuid(),
  paciente_id      uuid        not null references public.pacientes(id) on delete cascade,
  terapeuta_id     uuid        not null default auth.uid(),
  tipo             text        not null,               -- 'bioimpedancia' | 'teste_pisada' | ...
  data_exame       date        not null default current_date,
  dados            jsonb       not null default '{}'::jsonb,
  resumo           text,
  visivel_paciente boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_exames_presenciais_pac
  on public.exames_presenciais (paciente_id, tipo, data_exame desc);

alter table public.exames_presenciais enable row level security;

-- O profissional gerencia os exames dos seus pacientes.
drop policy if exists exames_presenciais_terapeuta_all on public.exames_presenciais;
create policy exames_presenciais_terapeuta_all
  on public.exames_presenciais for all to authenticated
  using (terapeuta_id = auth.uid())
  with check (terapeuta_id = auth.uid());

-- O cliente vê os próprios exames marcados como visíveis.
drop policy if exists exames_presenciais_paciente_select on public.exames_presenciais;
create policy exames_presenciais_paciente_select
  on public.exames_presenciais for select to authenticated
  using (
    visivel_paciente
    and exists (
      select 1 from public.pacientes p
      where p.id = exames_presenciais.paciente_id and p.user_id = auth.uid()
    )
  );
