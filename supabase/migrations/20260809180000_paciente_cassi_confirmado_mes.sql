-- "Confirmar" que o cliente tem guia ativa no mês (mesmo que a guia seja de um
-- mês anterior — a guia tem 3 meses pra ser debitada). Guarda o mês confirmado
-- (YYYY-MM). Assim o cliente do mês passado entra em "Este mês" com 1 clique.
alter table public.pacientes
  add column if not exists cassi_confirmado_mes text;

notify pgrst, 'reload schema';
