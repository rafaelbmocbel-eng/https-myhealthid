
CREATE TABLE IF NOT EXISTS public.documentos_emitidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  terapeuta_id UUID NOT NULL,
  paciente_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  conteudo JSONB NOT NULL DEFAULT '{}'::jsonb,
  data_emissao TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documentos_emitidos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta gerencia seus documentos"
ON public.documentos_emitidos
FOR ALL
TO authenticated
USING (auth.uid() = terapeuta_id)
WITH CHECK (auth.uid() = terapeuta_id);

CREATE INDEX IF NOT EXISTS idx_documentos_emitidos_paciente ON public.documentos_emitidos(paciente_id, data_emissao DESC);

CREATE TRIGGER set_documentos_emitidos_updated_at
BEFORE UPDATE ON public.documentos_emitidos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
