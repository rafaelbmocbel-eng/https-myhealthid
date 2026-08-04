-- CONTROLE CASSI fase 2: liga cada sessão (agendamento) à sua guia.
-- Assim as sessões da guia são agendamentos REAIS (aparecem na Agenda) e dá para
-- contar quantas já foram realizadas (data no passado) por guia.

alter table public.agendamentos
  add column if not exists guia_cassi_id uuid references public.guias_cassi(id) on delete set null;

create index if not exists idx_agendamentos_guia_cassi
  on public.agendamentos (guia_cassi_id);
