ALTER TABLE public.evidence_library
  ADD COLUMN IF NOT EXISTS resumo_clinico TEXT,
  ADD COLUMN IF NOT EXISTS aplicacao_pratica TEXT,
  ADD COLUMN IF NOT EXISTS resumo_gerado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resumo_modelo TEXT;

CREATE INDEX IF NOT EXISTS idx_evidence_library_sem_resumo
  ON public.evidence_library (id)
  WHERE resumo_clinico IS NULL;

-- Cache semântico de respostas de IA (Fase 2 — usado pelas funções leves)
CREATE TABLE IF NOT EXISTS public.ai_response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  query_embedding vector(1536),
  response_payload JSONB NOT NULL,
  model_used TEXT,
  hit_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_hit_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_response_cache_fn_hash
  ON public.ai_response_cache (function_name, prompt_hash);

CREATE INDEX IF NOT EXISTS idx_ai_response_cache_embedding
  ON public.ai_response_cache USING hnsw (query_embedding vector_cosine_ops);

GRANT SELECT ON public.ai_response_cache TO authenticated;
GRANT ALL ON public.ai_response_cache TO service_role;
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages ai cache"
  ON public.ai_response_cache FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated can read ai cache"
  ON public.ai_response_cache FOR SELECT
  TO authenticated
  USING (true);

-- Função para buscar cache por similaridade semântica
CREATE OR REPLACE FUNCTION public.match_ai_cache(
  p_function_name TEXT,
  p_query_embedding vector(1536),
  p_min_similarity FLOAT DEFAULT 0.92
)
RETURNS TABLE (
  id UUID,
  response_payload JSONB,
  similarity FLOAT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    c.id,
    c.response_payload,
    1 - (c.query_embedding <=> p_query_embedding) AS similarity
  FROM public.ai_response_cache c
  WHERE c.function_name = p_function_name
    AND c.query_embedding IS NOT NULL
    AND 1 - (c.query_embedding <=> p_query_embedding) >= p_min_similarity
  ORDER BY c.query_embedding <=> p_query_embedding
  LIMIT 1;
$$;