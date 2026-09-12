-- Marcador durável "vou pedir a guia" para o Controle CASSI.
-- Ao adicionar um cliente em "Este mês", o profissional escolhe "Já tenho a guia"
-- ou "Vou pedir a guia"; neste último caso o cliente vai automaticamente para a
-- aba "Pedir guia" (e some de lá quando o pedido recebe baixa em darBaixaPedidos).
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS cassi_pedir_guia boolean NOT NULL DEFAULT false;
