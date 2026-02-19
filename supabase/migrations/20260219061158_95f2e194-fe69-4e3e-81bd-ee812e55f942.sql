
-- Links de avaliação (blocos 1-5, válidos por 30 dias)
CREATE TABLE IF NOT EXISTS public.links_avaliacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id UUID NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  blocos_inclusos JSONB DEFAULT '[1,2,3,4,5]'::jsonb,
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT now(),
  data_expiracao TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '30 days'),
  acessos_totais INTEGER DEFAULT 0,
  data_primeiro_acesso TIMESTAMP WITH TIME ZONE,
  data_ultimo_acesso TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.links_avaliacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas gerenciam seus links de avaliação"
  ON public.links_avaliacao FOR ALL
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Links ativos são acessíveis publicamente (leitura por token)"
  ON public.links_avaliacao FOR SELECT
  USING (status = 'ativo' AND data_expiracao > now());

-- Respostas do paciente nos blocos
CREATE TABLE IF NOT EXISTS public.respostas_avaliacao_paciente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id UUID NOT NULL REFERENCES public.links_avaliacao(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  bloco_numero INTEGER NOT NULL CHECK (bloco_numero BETWEEN 1 AND 5),
  dados_respostas JSONB,
  data_preenchimento TIMESTAMP WITH TIME ZONE DEFAULT now(),
  numero_tentativa INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.respostas_avaliacao_paciente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta vê respostas dos seus pacientes"
  ON public.respostas_avaliacao_paciente FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.links_avaliacao la
    WHERE la.id = respostas_avaliacao_paciente.link_id
      AND la.terapeuta_id = auth.uid()
  ));

CREATE POLICY "Inserção pública via link válido"
  ON public.respostas_avaliacao_paciente FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.links_avaliacao la
    WHERE la.id = respostas_avaliacao_paciente.link_id
      AND la.status = 'ativo'
      AND la.data_expiracao > now()
  ));

CREATE POLICY "Terapeuta deleta respostas dos seus pacientes"
  ON public.respostas_avaliacao_paciente FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.links_avaliacao la
    WHERE la.id = respostas_avaliacao_paciente.link_id
      AND la.terapeuta_id = auth.uid()
  ));

-- Links de agenda do paciente (válidos por 90 dias)
CREATE TABLE IF NOT EXISTS public.links_agenda_paciente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id UUID NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  data_criacao TIMESTAMP WITH TIME ZONE DEFAULT now(),
  data_expiracao TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '90 days'),
  acessos_totais INTEGER DEFAULT 0,
  data_primeiro_acesso TIMESTAMP WITH TIME ZONE,
  data_ultimo_acesso TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.links_agenda_paciente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas gerenciam links de agenda"
  ON public.links_agenda_paciente FOR ALL
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Links de agenda ativos acessíveis publicamente"
  ON public.links_agenda_paciente FOR SELECT
  USING (status = 'ativo' AND data_expiracao > now());

-- Trigger para updated_at
CREATE TRIGGER update_links_avaliacao_updated_at
  BEFORE UPDATE ON public.links_avaliacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_links_agenda_updated_at
  BEFORE UPDATE ON public.links_agenda_paciente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
