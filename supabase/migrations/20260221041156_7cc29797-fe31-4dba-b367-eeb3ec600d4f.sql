
-- ═══════════════════════════════════════════════════════════════
-- STUDIO PERSONAL ID — Full schema
-- ═══════════════════════════════════════════════════════════════

-- 1. Periodizações (Mesociclos)
CREATE TABLE public.studio_periodizacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id UUID NOT NULL,
  nome TEXT NOT NULL,
  objetivo TEXT,
  divisao TEXT DEFAULT 'ABCD',
  duracao_semanas INTEGER DEFAULT 8,
  data_inicio DATE DEFAULT CURRENT_DATE,
  data_fim DATE,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.studio_periodizacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta gerencia periodizacoes" ON public.studio_periodizacoes FOR ALL
  USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

-- 2. Treinos (templates: Treino A, B, C, D)
CREATE TABLE public.studio_treinos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id UUID NOT NULL,
  periodizacao_id UUID REFERENCES public.studio_periodizacoes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  objetivo TEXT DEFAULT 'Hipertrofia',
  duracao_estimada TEXT DEFAULT '50-60 min',
  intensidade TEXT DEFAULT 'Alta',
  frequencia TEXT DEFAULT '2x por semana',
  ordem INTEGER DEFAULT 1,
  ativo BOOLEAN DEFAULT true,
  publicado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.studio_treinos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta gerencia treinos" ON public.studio_treinos FOR ALL
  USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

-- 3. Exercícios do treino (prescrição)
CREATE TABLE public.studio_treino_exercicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treino_id UUID NOT NULL REFERENCES public.studio_treinos(id) ON DELETE CASCADE,
  exercicio_id UUID REFERENCES public.exercicios_biblioteca(id) ON DELETE SET NULL,
  nome_customizado TEXT,
  grupo_muscular TEXT,
  ordem INTEGER DEFAULT 1,
  series INTEGER DEFAULT 3,
  repeticoes INTEGER DEFAULT 12,
  carga_kg NUMERIC DEFAULT 0,
  descanso_segundos INTEGER DEFAULT 90,
  cadencia TEXT DEFAULT '2-0-2',
  metodo TEXT DEFAULT 'Normal',
  orientacoes TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.studio_treino_exercicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta gerencia exercicios treino" ON public.studio_treino_exercicios FOR ALL
  USING (EXISTS (SELECT 1 FROM public.studio_treinos t WHERE t.id = studio_treino_exercicios.treino_id AND t.terapeuta_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.studio_treinos t WHERE t.id = studio_treino_exercicios.treino_id AND t.terapeuta_id = auth.uid()));

-- 4. Execuções de treino (log de sessão)
CREATE TABLE public.studio_execucoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treino_id UUID NOT NULL REFERENCES public.studio_treinos(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id UUID NOT NULL,
  data_execucao TIMESTAMPTZ DEFAULT now(),
  completo BOOLEAN DEFAULT false,
  duracao_minutos INTEGER,
  feedback_aluno TEXT,
  feedback_educador TEXT,
  nota_dor INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.studio_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta gerencia execucoes" ON public.studio_execucoes FOR ALL
  USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

-- 5. Log de exercício individual por execução
CREATE TABLE public.studio_execucao_exercicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id UUID NOT NULL REFERENCES public.studio_execucoes(id) ON DELETE CASCADE,
  treino_exercicio_id UUID REFERENCES public.studio_treino_exercicios(id) ON DELETE SET NULL,
  nome_exercicio TEXT NOT NULL,
  series_realizadas INTEGER DEFAULT 0,
  repeticoes_por_serie JSONB DEFAULT '[]',
  carga_utilizada NUMERIC DEFAULT 0,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.studio_execucao_exercicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta gerencia exec exercicios" ON public.studio_execucao_exercicios FOR ALL
  USING (EXISTS (SELECT 1 FROM public.studio_execucoes e WHERE e.id = studio_execucao_exercicios.execucao_id AND e.terapeuta_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.studio_execucoes e WHERE e.id = studio_execucao_exercicios.execucao_id AND e.terapeuta_id = auth.uid()));

-- 6. Medidas antropométricas
CREATE TABLE public.studio_medidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id UUID NOT NULL,
  data_medida DATE DEFAULT CURRENT_DATE,
  peso NUMERIC,
  percentual_gordura NUMERIC,
  massa_magra NUMERIC,
  imc NUMERIC,
  cintura NUMERIC,
  quadril NUMERIC,
  braco_direito NUMERIC,
  braco_esquerdo NUMERIC,
  coxa_direita NUMERIC,
  coxa_esquerda NUMERIC,
  peitoral NUMERIC,
  panturrilha NUMERIC,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.studio_medidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta gerencia medidas" ON public.studio_medidas FOR ALL
  USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

-- 7. Notas do educador
CREATE TABLE public.studio_notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id UUID NOT NULL,
  conteudo TEXT NOT NULL,
  tipo TEXT DEFAULT 'observacao',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.studio_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta gerencia notas" ON public.studio_notas FOR ALL
  USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

-- Triggers for updated_at
CREATE TRIGGER update_studio_periodizacoes_updated_at BEFORE UPDATE ON public.studio_periodizacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_studio_treinos_updated_at BEFORE UPDATE ON public.studio_treinos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_studio_treino_exercicios_updated_at BEFORE UPDATE ON public.studio_treino_exercicios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes
CREATE INDEX idx_studio_treinos_paciente ON public.studio_treinos(paciente_id);
CREATE INDEX idx_studio_execucoes_paciente ON public.studio_execucoes(paciente_id);
CREATE INDEX idx_studio_execucoes_treino ON public.studio_execucoes(treino_id);
CREATE INDEX idx_studio_medidas_paciente ON public.studio_medidas(paciente_id);
CREATE INDEX idx_studio_notas_paciente ON public.studio_notas(paciente_id);
