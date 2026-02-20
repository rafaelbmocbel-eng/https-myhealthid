
-- Tabela para armazenar as técnicas selecionadas do cardápio do protocolo (= Tratamento)
CREATE TABLE public.protocolo_tratamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  protocolo_id UUID NOT NULL REFERENCES public.protocolos(id) ON DELETE CASCADE,
  tecnica_id UUID NOT NULL REFERENCES public.tecnicas_tratamento(id) ON DELETE CASCADE,
  fase_numero INTEGER NOT NULL DEFAULT 1,
  parametros_customizados JSONB DEFAULT '{}',
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(protocolo_id, tecnica_id)
);

-- Enable RLS
ALTER TABLE public.protocolo_tratamentos ENABLE ROW LEVEL SECURITY;

-- Policies: apenas o terapeuta dono do protocolo
CREATE POLICY "Terapeutas veem tratamentos dos seus protocolos"
ON public.protocolo_tratamentos FOR SELECT
USING (EXISTS (
  SELECT 1 FROM protocolos p WHERE p.id = protocolo_tratamentos.protocolo_id AND p.terapeuta_id = auth.uid()
));

CREATE POLICY "Terapeutas inserem tratamentos nos seus protocolos"
ON public.protocolo_tratamentos FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM protocolos p WHERE p.id = protocolo_tratamentos.protocolo_id AND p.terapeuta_id = auth.uid()
));

CREATE POLICY "Terapeutas editam tratamentos dos seus protocolos"
ON public.protocolo_tratamentos FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM protocolos p WHERE p.id = protocolo_tratamentos.protocolo_id AND p.terapeuta_id = auth.uid()
));

CREATE POLICY "Terapeutas deletam tratamentos dos seus protocolos"
ON public.protocolo_tratamentos FOR DELETE
USING (EXISTS (
  SELECT 1 FROM protocolos p WHERE p.id = protocolo_tratamentos.protocolo_id AND p.terapeuta_id = auth.uid()
));
