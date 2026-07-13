-- Biblioteca de exercícios: suporte a DUAS variantes de GIF por exercício
-- (avatar masculino e feminino — mesmo exercício) + nome original do arquivo
-- (em inglês) para deduplicação em uploads repetidos.
ALTER TABLE public.biblioteca_exercicios
  ADD COLUMN IF NOT EXISTS gif_url_fem text,
  ADD COLUMN IF NOT EXISTS nome_original text;

CREATE INDEX IF NOT EXISTS idx_biblioteca_exercicios_nome_original
  ON public.biblioteca_exercicios (terapeuta_id, nome_original);
