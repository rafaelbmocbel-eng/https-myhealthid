-- Dados de cabeçalho/rodapé do relatório de produção CASSI (o arquivo entregue à
-- clínica no fim do mês). O código oficial de cada procedimento fica no próprio
-- jsonb `codigos` (campo codigo_oficial), sem precisar de coluna nova.
alter table public.cassi_config
  add column if not exists nome_clinica      text not null default '',
  add column if not exists nome_profissional text not null default '',
  add column if not exists cidade            text not null default '';

notify pgrst, 'reload schema';
