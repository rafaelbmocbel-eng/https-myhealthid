
ALTER TABLE public.whatsapp_automacoes
  ADD COLUMN IF NOT EXISTS no_show_perdoar_primeira boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS no_show_so_com_pacote boolean NOT NULL DEFAULT true;
