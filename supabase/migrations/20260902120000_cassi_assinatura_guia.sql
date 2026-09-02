-- CASSI: rastreio da ASSINATURA FÍSICA da guia e do envio ao financeiro.
--
-- O profissional recolhe a guia assinada pelo paciente (inteira, ou pela metade
-- quando o cliente parou no meio / fim do mês) e a envia fisicamente ao
-- financeiro. Esse é um passo do ciclo de vida que faltava: depois de "pedir" e
-- "usar", a guia precisa ser assinada → recolhida → enviada → histórico, e NUNCA
-- volta a ser guia ativa.
alter table public.guias_cassi
  add column if not exists assinatura text not null default 'nao',
  add column if not exists recolhida_em date,
  add column if not exists enviada_financeiro_em date;

-- valores de assinatura: 'nao' (ainda não assinada) | 'inteira' | 'metade'
alter table public.guias_cassi
  drop constraint if exists guias_cassi_assinatura_chk;
alter table public.guias_cassi
  add constraint guias_cassi_assinatura_chk
  check (assinatura in ('nao', 'inteira', 'metade'));

comment on column public.guias_cassi.assinatura is
  'Assinatura física da guia pelo paciente: nao | inteira | metade';
comment on column public.guias_cassi.recolhida_em is
  'Data em que o profissional recolheu a guia física assinada.';
comment on column public.guias_cassi.enviada_financeiro_em is
  'Data em que a guia física foi enviada ao financeiro.';
