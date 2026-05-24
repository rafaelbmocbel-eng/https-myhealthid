CREATE TABLE IF NOT EXISTS public.despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  valor numeric(10,2) NOT NULL CHECK (valor >= 0),
  categoria text NOT NULL DEFAULT 'outro',
  data_despesa date NOT NULL DEFAULT CURRENT_DATE,
  recorrente boolean NOT NULL DEFAULT false,
  forma_pagamento text,
  observacao text,
  comprovante_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.despesas
  ADD CONSTRAINT despesas_categoria_check
  CHECK (categoria IN ('aluguel','marketing','equipamento','software','material','imposto','salario','servico','outro'));

CREATE INDEX IF NOT EXISTS idx_despesas_terapeuta_data
  ON public.despesas (terapeuta_id, data_despesa DESC);

ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas veem suas despesas"
  ON public.despesas FOR SELECT
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas criam suas despesas"
  ON public.despesas FOR INSERT
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas atualizam suas despesas"
  ON public.despesas FOR UPDATE
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas deletam suas despesas"
  ON public.despesas FOR DELETE
  USING (auth.uid() = terapeuta_id);

CREATE TRIGGER trg_despesas_updated_at
  BEFORE UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();