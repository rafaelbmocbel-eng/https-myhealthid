ALTER TABLE public.pacientes 
  ADD COLUMN IF NOT EXISTS tipo_cliente text NOT NULL DEFAULT 'particular',
  ADD COLUMN IF NOT EXISTS plano_nome text;

ALTER TABLE public.controle_sessoes
  ADD COLUMN IF NOT EXISTS tipo_cliente text,
  ADD COLUMN IF NOT EXISTS plano_nome text,
  ADD COLUMN IF NOT EXISTS valor_guia numeric;

CREATE INDEX IF NOT EXISTS idx_pacientes_tipo_cliente ON public.pacientes(tipo_cliente);
CREATE INDEX IF NOT EXISTS idx_controle_sessoes_terapeuta_data ON public.controle_sessoes(terapeuta_id, data_sessao);
CREATE INDEX IF NOT EXISTS idx_controle_sessoes_membro ON public.controle_sessoes(agendamento_id);