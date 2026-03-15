
CREATE TABLE public.pagamentos_paciente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id uuid NOT NULL,
  descricao text NOT NULL,
  valor numeric(10,2) NOT NULL,
  forma_pagamento text NOT NULL DEFAULT 'pix',
  status text NOT NULL DEFAULT 'pendente',
  comprovante_url text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pagamentos_paciente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pacientes veem seus pagamentos"
  ON public.pagamentos_paciente FOR SELECT
  TO authenticated
  USING (
    paciente_id IN (
      SELECT id FROM public.pacientes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Pacientes criam pagamentos"
  ON public.pagamentos_paciente FOR INSERT
  TO authenticated
  WITH CHECK (
    paciente_id IN (
      SELECT id FROM public.pacientes WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Terapeutas veem pagamentos"
  ON public.pagamentos_paciente FOR SELECT
  TO authenticated
  USING (terapeuta_id = auth.uid());

CREATE POLICY "Terapeutas atualizam pagamentos"
  ON public.pagamentos_paciente FOR UPDATE
  TO authenticated
  USING (terapeuta_id = auth.uid());

CREATE TRIGGER update_pagamentos_updated_at
  BEFORE UPDATE ON public.pagamentos_paciente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
