-- CONTROLE DE GUIAS CASSI (fase 1: guias + status + pedidos do mês).
-- Cada guia de autorização de um paciente CASSI: nº, data do pedido/resposta,
-- sessões autorizadas x realizadas, códigos (144/012/160/185) e status.
-- Os códigos ficam em JSON (`codigos`) para não exigir tabela-filha nesta fase.
-- Ferramenta do PROFISSIONAL — sem acesso do paciente.

create table if not exists public.guias_cassi (
  id                   uuid        primary key default gen_random_uuid(),
  terapeuta_id         uuid        not null default auth.uid(),
  paciente_id          uuid        not null references public.pacientes(id) on delete cascade,
  numero_guia          text,
  data_pedido          date        not null default current_date,
  data_resposta        date,                                    -- null = aguardando CASSI
  sessoes_autorizadas  integer     not null default 0,
  sessoes_realizadas   integer     not null default 0,          -- fase 1: contagem manual; fase 2 liga à agenda
  diagnostico          text,
  responsavel_tecnico  text,
  codigos              jsonb       not null default '[]'::jsonb, -- [{codigo, descricao, sessoes, status}]
  status               text        not null default 'aguardando',
  observacoes          text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint guias_cassi_status_check
    check (status in ('aguardando', 'ativa', 'finalizada', 'cancelada'))
);

create index if not exists idx_guias_cassi_terapeuta
  on public.guias_cassi (terapeuta_id, status, data_pedido desc);
create index if not exists idx_guias_cassi_paciente
  on public.guias_cassi (paciente_id, status, data_pedido desc);

alter table public.guias_cassi enable row level security;

-- O profissional gerencia as guias dos seus pacientes.
drop policy if exists guias_cassi_terapeuta_all on public.guias_cassi;
create policy guias_cassi_terapeuta_all
  on public.guias_cassi for all to authenticated
  using (terapeuta_id = auth.uid())
  with check (terapeuta_id = auth.uid());
