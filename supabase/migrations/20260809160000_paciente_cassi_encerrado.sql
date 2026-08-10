-- "Encerrar" um cliente CASSI (não continua: viagem, alta, desistência...). Sai
-- das listas ativas (pedidos, ativas, próximo relatório) mas o cadastro/histórico
-- fica preservado — dá pra reativar depois. Diferente de excluir (ativo=false).
alter table public.pacientes
  add column if not exists cassi_encerrado_em     timestamptz,
  add column if not exists cassi_encerrado_motivo text;

notify pgrst, 'reload schema';
