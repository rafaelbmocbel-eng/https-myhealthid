-- Marca de tradução automática dos nomes da biblioteca de exercícios. O batch
-- (traduzir-biblioteca-batch) processa só as linhas com nome_traduzido_em NULL,
-- em lotes, avançando a cada rodada até traduzir tudo — e então vira no-op.
ALTER TABLE public.biblioteca_exercicios
  ADD COLUMN IF NOT EXISTS nome_traduzido_em timestamptz;

-- Índice parcial para o filtro "ainda não traduzido" ficar barato.
CREATE INDEX IF NOT EXISTS biblioteca_exercicios_sem_traducao_idx
  ON public.biblioteca_exercicios (id)
  WHERE nome_traduzido_em IS NULL AND ativo;
