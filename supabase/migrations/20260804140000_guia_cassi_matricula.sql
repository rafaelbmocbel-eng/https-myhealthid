-- Controle CASSI: matrícula do paciente no plano (aparece na Planilha).
-- Fica na guia (pré-preenchida da última guia do paciente) para não exigir
-- mudança no cadastro do paciente.
alter table public.guias_cassi add column if not exists matricula text;
