-- Adiciona coluna historia_atual (JSONB) à tabela pacientes
-- Guarda as 4 perguntas estruturadas da "História da Doença Atual"
-- (queixa, inicio, fatores melhora/piora, impacto na rotina)
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS historia_atual JSONB DEFAULT NULL;
