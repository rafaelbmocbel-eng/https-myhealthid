-- Fase 3: revisão do profissional antes do paciente ver os planos de IA.
-- O plano gerado nasce como NÃO aprovado (rascunho); só aparece no portal do
-- paciente depois que o profissional libera. Planos já existentes (ativos)
-- continuam visíveis (backfill = aprovado).

ALTER TABLE public.planos_alimentares
  ADD COLUMN IF NOT EXISTS aprovado boolean NOT NULL DEFAULT false;
UPDATE public.planos_alimentares SET aprovado = true WHERE ativo = true AND aprovado = false;

ALTER TABLE public.planos_treino
  ADD COLUMN IF NOT EXISTS aprovado boolean NOT NULL DEFAULT false;
UPDATE public.planos_treino SET aprovado = true WHERE ativo = true AND aprovado = false;
