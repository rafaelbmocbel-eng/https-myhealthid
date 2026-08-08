-- Cliente CASSI de 1 ou 2 guias por mês. Quem é 2/mês recebe o aviso de pedir a
-- próxima guia ~13 dias corridos (≈10 dias úteis) após a resposta da CASSI.
alter table public.pacientes
  add column if not exists guias_por_mes smallint not null default 1;

notify pgrst, 'reload schema';
