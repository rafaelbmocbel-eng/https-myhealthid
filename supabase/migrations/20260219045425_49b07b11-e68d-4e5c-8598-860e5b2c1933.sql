
-- Tabela paciente_servicos: controla qual serviço cada paciente usa
CREATE TABLE IF NOT EXISTS public.paciente_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  servico VARCHAR(50) NOT NULL, -- 'metodo_identidade', 'cob_zero', 'agenda_premium'
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.paciente_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas veem serviços dos seus pacientes"
ON public.paciente_servicos FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = paciente_id AND p.terapeuta_id = auth.uid())
);

CREATE POLICY "Terapeutas inserem serviços dos seus pacientes"
ON public.paciente_servicos FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = paciente_id AND p.terapeuta_id = auth.uid())
);

CREATE POLICY "Terapeutas editam serviços dos seus pacientes"
ON public.paciente_servicos FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = paciente_id AND p.terapeuta_id = auth.uid())
);

CREATE POLICY "Terapeutas deletam serviços dos seus pacientes"
ON public.paciente_servicos FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = paciente_id AND p.terapeuta_id = auth.uid())
);

-- Tabela avaliacoes: avaliações do Método Identidade
CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id UUID NOT NULL,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pendente',
  score_e DECIMAL(5,2),
  score_p DECIMAL(5,2),
  score_c DECIMAL(5,2),
  score_f DECIMAL(5,2),
  score_d DECIMAL(5,2),
  score_r DECIMAL(5,2),
  score_efi DECIMAL(5,2),
  dor_identidade DECIMAL(5,2),
  dados_bloco JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas veem suas avaliações"
ON public.avaliacoes FOR SELECT
USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas inserem avaliações"
ON public.avaliacoes FOR INSERT
WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas editam suas avaliações"
ON public.avaliacoes FOR UPDATE
USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas deletam suas avaliações"
ON public.avaliacoes FOR DELETE
USING (auth.uid() = terapeuta_id);

-- Tabela protocolos_cob_zero
CREATE TABLE IF NOT EXISTS public.protocolos_cob_zero (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id UUID NOT NULL,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL DEFAULT 'pendente',
  cobb_angle DECIMAL(5,2),
  risco_progressao DECIMAL(5,2),
  classificacao_lenke VARCHAR(50),
  dados_protocolo JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.protocolos_cob_zero ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas veem seus protocolos"
ON public.protocolos_cob_zero FOR SELECT
USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas inserem protocolos"
ON public.protocolos_cob_zero FOR INSERT
WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas editam seus protocolos"
ON public.protocolos_cob_zero FOR UPDATE
USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas deletam seus protocolos"
ON public.protocolos_cob_zero FOR DELETE
USING (auth.uid() = terapeuta_id);

-- Add cpf column to pacientes if it doesn't exist
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS cpf VARCHAR(14);
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS genero VARCHAR(20);

-- Triggers for updated_at
CREATE TRIGGER update_avaliacoes_updated_at
BEFORE UPDATE ON public.avaliacoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_protocolos_updated_at
BEFORE UPDATE ON public.protocolos_cob_zero
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
