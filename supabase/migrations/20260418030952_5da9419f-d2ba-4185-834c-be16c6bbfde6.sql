-- Tabela de vendas (independente, vinculada opcionalmente a paciente e membro da equipe)
CREATE TABLE public.vendas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  terapeuta_id UUID NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  vendedor_id UUID REFERENCES public.equipe_membros(id) ON DELETE SET NULL,
  vendedor_nome TEXT,
  servico TEXT NOT NULL,
  descricao TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  forma_pagamento TEXT NOT NULL DEFAULT 'pix',
  status TEXT NOT NULL DEFAULT 'pendente',
  data_venda TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas gerenciam suas vendas"
  ON public.vendas FOR ALL
  TO authenticated
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE INDEX idx_vendas_terapeuta ON public.vendas(terapeuta_id);
CREATE INDEX idx_vendas_paciente ON public.vendas(paciente_id);
CREATE INDEX idx_vendas_data ON public.vendas(data_venda DESC);

CREATE TRIGGER update_vendas_updated_at
  BEFORE UPDATE ON public.vendas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();