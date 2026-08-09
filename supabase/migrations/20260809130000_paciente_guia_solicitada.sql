-- "Dar baixa" nos pedidos de guia: registra quando uma nova guia foi SOLICITADA
-- para o cliente. Enquanto não chega a guia nova (guia com data_pedido >= esta
-- data), o cliente sai da lista "Pedir guia" e fica em "Guias pedidas (aguardando)".
alter table public.pacientes
  add column if not exists guia_solicitada_em timestamptz;

notify pgrst, 'reload schema';
