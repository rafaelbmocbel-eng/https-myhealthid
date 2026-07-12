-- Catálogo terapêutico (exercicios_biblioteca) passa a guardar a REFERÊNCIA
-- científica que fundamentou cada exercício e um status de APROVAÇÃO — os itens
-- gerados por IA a partir da evidência nascem como rascunho e só vão ao portal
-- do paciente depois que o profissional aprova (mesmo padrão das diretrizes).
ALTER TABLE public.exercicios_biblioteca
  ADD COLUMN IF NOT EXISTS evidencia jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gerado_por_ia boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aprovado boolean NOT NULL DEFAULT true;

-- Itens já existentes (curados à mão) seguem aprovados; novos gerados por IA
-- vêm com aprovado=false (definido na inserção pelo gerador).
