-- Adiciona coluna historico_clinico (JSONB) à tabela pacientes
-- Armazena o histórico clínico estruturado do paciente em 6 categorias:
-- doencas_cronicas, cirurgias, medicamentos, alergias, saude_mental, historico_familiar
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS historico_clinico JSONB DEFAULT NULL;
