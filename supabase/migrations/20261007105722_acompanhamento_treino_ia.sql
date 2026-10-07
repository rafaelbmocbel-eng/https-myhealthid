-- Acompanhamento do treino do plano de IA do cliente: ao concluir uma sessão o
-- cliente pode registrar, de forma opcional, o esforço percebido (0-10), a dor
-- durante o treino (0-10) e uma observação curta. O profissional lê estes
-- registros pela política pitf_terapeuta_read já existente.
-- NULL = o cliente não informou (diferente de 0 = nenhuma dor / esforço mínimo).
alter table public.plano_ia_treino_feito
  add column if not exists rpe smallint check (rpe between 0 and 10),
  add column if not exists dor smallint check (dor between 0 and 10),
  add column if not exists observacao text check (char_length(observacao) <= 500);

comment on column public.plano_ia_treino_feito.rpe is 'Esforço percebido da sessão, 0 (muito leve) a 10 (esforço máximo). NULL = não informado.';
comment on column public.plano_ia_treino_feito.dor is 'Dor durante o treino, 0 (nenhuma) a 10 (pior dor possível). NULL = não informado.';
comment on column public.plano_ia_treino_feito.observacao is 'Observação livre e opcional do cliente sobre a sessão.';
