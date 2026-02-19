
-- Biblioteca de exercícios (global, não vinculada a usuário)
CREATE TABLE IF NOT EXISTS public.exercicios_biblioteca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL, -- 'Respiração', 'Relaxamento', 'Mobilidade', 'Fortalecimento', 'Propriocepção', 'Funcional'
  regiao_corporal JSONB DEFAULT '[]',
  nivel_dificuldade TEXT NOT NULL DEFAULT 'Iniciante', -- 'Iniciante', 'Intermediário', 'Avançado'
  tipo TEXT DEFAULT 'Sem equipamento',
  descricao TEXT,
  instrucoes JSONB DEFAULT '[]',
  video_url TEXT,
  imagem_url TEXT,
  tempo_duracao TEXT DEFAULT '45 segundos',
  precaucoes JSONB DEFAULT '[]',
  modificacoes JSONB DEFAULT '[]',
  perfis_indicados JSONB DEFAULT '[]', -- ['REGULACAO_CRITICA', 'PSICO_COMPORTAMENTAL', ...]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Protocolos gerados
CREATE TABLE IF NOT EXISTS public.protocolos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id UUID NOT NULL,
  paciente_id UUID NOT NULL,
  avaliacao_id UUID,
  titulo TEXT NOT NULL,
  descricao TEXT,
  duracao_total TEXT DEFAULT '12 semanas',
  frequencia TEXT DEFAULT '2-3x por semana',
  objetivo_geral TEXT,
  perfil_dominante JSONB DEFAULT '[]',
  hierarquia_terapeutica JSONB DEFAULT '[]',
  data_inicio DATE,
  data_fim_prevista DATE,
  status TEXT NOT NULL DEFAULT 'ativo',
  enviado_para_paciente BOOLEAN DEFAULT false,
  data_envio TIMESTAMPTZ,
  scores_avaliacao JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fases dos protocolos
CREATE TABLE IF NOT EXISTS public.protocolo_fases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id UUID NOT NULL REFERENCES public.protocolos(id) ON DELETE CASCADE,
  numero_fase INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  semanas_inicio INTEGER,
  semanas_fim INTEGER,
  objetivos JSONB DEFAULT '[]',
  sessoes_por_semana INTEGER DEFAULT 2,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Prescrições de exercícios (exercício prescrito em uma fase)
CREATE TABLE IF NOT EXISTS public.prescricoes_exercicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id UUID NOT NULL REFERENCES public.protocolos(id) ON DELETE CASCADE,
  fase_id UUID NOT NULL REFERENCES public.protocolo_fases(id) ON DELETE CASCADE,
  exercicio_id UUID NOT NULL REFERENCES public.exercicios_biblioteca(id) ON DELETE CASCADE,
  series INTEGER DEFAULT 3,
  repeticoes INTEGER DEFAULT 12,
  tempo_descanso TEXT DEFAULT '60 segundos',
  frequencia TEXT DEFAULT '2x por semana',
  observacoes TEXT,
  progressao JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Progresso do paciente
CREATE TABLE IF NOT EXISTS public.progresso_exercicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescricao_id UUID NOT NULL REFERENCES public.prescricoes_exercicios(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL,
  data_execucao DATE DEFAULT CURRENT_DATE,
  concluido BOOLEAN DEFAULT false,
  series_realizadas INTEGER,
  repeticoes_realizadas INTEGER,
  nivel_dificuldade_reportado INTEGER CHECK (nivel_dificuldade_reportado BETWEEN 0 AND 10),
  dor_reportada INTEGER CHECK (dor_reportada BETWEEN 0 AND 10),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers de updated_at
CREATE TRIGGER update_protocolos_updated_at
  BEFORE UPDATE ON public.protocolos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS: exercicios_biblioteca (pública para leitura, só admin escreve – sem RLS restritiva)
ALTER TABLE public.exercicios_biblioteca ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos leem exercícios" ON public.exercicios_biblioteca FOR SELECT USING (true);

-- RLS: protocolos
ALTER TABLE public.protocolos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Terapeutas veem seus protocolos" ON public.protocolos FOR SELECT USING (auth.uid() = terapeuta_id);
CREATE POLICY "Terapeutas inserem protocolos" ON public.protocolos FOR INSERT WITH CHECK (auth.uid() = terapeuta_id);
CREATE POLICY "Terapeutas editam seus protocolos" ON public.protocolos FOR UPDATE USING (auth.uid() = terapeuta_id);
CREATE POLICY "Terapeutas deletam seus protocolos" ON public.protocolos FOR DELETE USING (auth.uid() = terapeuta_id);

-- RLS: protocolo_fases
ALTER TABLE public.protocolo_fases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Terapeutas veem fases dos seus protocolos" ON public.protocolo_fases FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.protocolos p WHERE p.id = protocolo_id AND p.terapeuta_id = auth.uid()));
CREATE POLICY "Terapeutas inserem fases" ON public.protocolo_fases FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.protocolos p WHERE p.id = protocolo_id AND p.terapeuta_id = auth.uid()));
CREATE POLICY "Terapeutas editam fases" ON public.protocolo_fases FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.protocolos p WHERE p.id = protocolo_id AND p.terapeuta_id = auth.uid()));
CREATE POLICY "Terapeutas deletam fases" ON public.protocolo_fases FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.protocolos p WHERE p.id = protocolo_id AND p.terapeuta_id = auth.uid()));

-- RLS: prescricoes_exercicios
ALTER TABLE public.prescricoes_exercicios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Terapeutas veem prescrições" ON public.prescricoes_exercicios FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.protocolos p WHERE p.id = protocolo_id AND p.terapeuta_id = auth.uid()));
CREATE POLICY "Terapeutas inserem prescrições" ON public.prescricoes_exercicios FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.protocolos p WHERE p.id = protocolo_id AND p.terapeuta_id = auth.uid()));
CREATE POLICY "Terapeutas editam prescrições" ON public.prescricoes_exercicios FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.protocolos p WHERE p.id = protocolo_id AND p.terapeuta_id = auth.uid()));
CREATE POLICY "Terapeutas deletam prescrições" ON public.prescricoes_exercicios FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.protocolos p WHERE p.id = protocolo_id AND p.terapeuta_id = auth.uid()));

-- RLS: progresso_exercicios
ALTER TABLE public.progresso_exercicios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Terapeutas veem progresso" ON public.progresso_exercicios FOR SELECT USING (auth.uid() = paciente_id OR EXISTS (
  SELECT 1 FROM public.prescricoes_exercicios pe
  JOIN public.protocolos p ON p.id = pe.protocolo_id
  WHERE pe.id = prescricao_id AND p.terapeuta_id = auth.uid()
));
CREATE POLICY "Todos inserem progresso" ON public.progresso_exercicios FOR INSERT WITH CHECK (true);
