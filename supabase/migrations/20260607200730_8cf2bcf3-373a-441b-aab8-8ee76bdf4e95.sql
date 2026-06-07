-- Adiciona coluna nullable para sub-especialidade médica.
-- Aditiva, não afeta usuários existentes (default NULL).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS especialidade_medica TEXT;

COMMENT ON COLUMN public.profiles.especialidade_medica IS
  'Sub-especialidade quando perfil_profissional = medico. Ex.: clinico_geral, ortopedista, endocrinologista, cardiologista, psiquiatra, ginecologista, pediatra, dermatologista. NULL para outras lentes.';