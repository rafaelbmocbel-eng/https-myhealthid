
-- Expandir tecnicas_tratamento com novas colunas
ALTER TABLE public.tecnicas_tratamento 
ADD COLUMN IF NOT EXISTS nivel_evidencia VARCHAR(20),
ADD COLUMN IF NOT EXISTS fase_ideal INT,
ADD COLUMN IF NOT EXISTS complexidade VARCHAR(20),
ADD COLUMN IF NOT EXISTS prerequisitos TEXT[];

-- Tabela de templates de protocolo por região/diagnóstico
CREATE TABLE IF NOT EXISTS public.protocolo_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(150) NOT NULL,
  regiao_anatomica VARCHAR(50),
  diagnostico_principal VARCHAR(100),
  classificacao_severidade VARCHAR(20),
  duracao_estimada_semanas INT,
  frequencia_semanal INT,
  fases JSONB,
  criterios_progressao JSONB,
  evidencia_cientifica TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.protocolo_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos leem templates" ON public.protocolo_templates FOR SELECT USING (true);

-- Tabela de progressão do paciente
CREATE TABLE IF NOT EXISTS public.protocolo_progressao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  protocolo_id UUID NOT NULL REFERENCES public.protocolos(id) ON DELETE CASCADE,
  fase_atual INT DEFAULT 1,
  semana_atual INT DEFAULT 1,
  criterios_atingidos JSONB DEFAULT '{}'::jsonb,
  observacoes TEXT,
  proxima_avaliacao DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.protocolo_progressao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas veem progressao" ON public.protocolo_progressao FOR SELECT
USING (EXISTS (SELECT 1 FROM protocolos p WHERE p.id = protocolo_progressao.protocolo_id AND p.terapeuta_id = auth.uid()));

CREATE POLICY "Terapeutas inserem progressao" ON public.protocolo_progressao FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM protocolos p WHERE p.id = protocolo_progressao.protocolo_id AND p.terapeuta_id = auth.uid()));

CREATE POLICY "Terapeutas editam progressao" ON public.protocolo_progressao FOR UPDATE
USING (EXISTS (SELECT 1 FROM protocolos p WHERE p.id = protocolo_progressao.protocolo_id AND p.terapeuta_id = auth.uid()));

CREATE POLICY "Terapeutas deletam progressao" ON public.protocolo_progressao FOR DELETE
USING (EXISTS (SELECT 1 FROM protocolos p WHERE p.id = protocolo_progressao.protocolo_id AND p.terapeuta_id = auth.uid()));
