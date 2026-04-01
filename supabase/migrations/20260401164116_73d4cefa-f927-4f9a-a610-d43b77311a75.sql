
CREATE TABLE public.pacotes_sessoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id uuid NOT NULL,
  terapeuta_id uuid NOT NULL,
  nome text NOT NULL DEFAULT 'Pacote',
  total_sessoes integer NOT NULL DEFAULT 10,
  sessoes_utilizadas integer NOT NULL DEFAULT 0,
  valor_total numeric DEFAULT NULL,
  status text NOT NULL DEFAULT 'ativo',
  data_inicio date DEFAULT CURRENT_DATE,
  data_fim date DEFAULT NULL,
  observacoes text DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pacotes_sessoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas gerenciam pacotes"
  ON public.pacotes_sessoes FOR ALL
  TO authenticated
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Pacientes leem proprios pacotes"
  ON public.pacotes_sessoes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pacientes p
    WHERE p.id = pacotes_sessoes.paciente_id AND p.user_id = auth.uid()
  ));

CREATE INDEX idx_pacotes_sessoes_paciente ON public.pacotes_sessoes(paciente_id);
CREATE INDEX idx_pacotes_sessoes_terapeuta ON public.pacotes_sessoes(terapeuta_id);
CREATE INDEX idx_pacotes_sessoes_status ON public.pacotes_sessoes(status);

CREATE TRIGGER update_pacotes_sessoes_updated_at
  BEFORE UPDATE ON public.pacotes_sessoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
