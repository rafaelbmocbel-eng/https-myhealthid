
-- Normalize empties before index
UPDATE public.pacientes SET email = NULL WHERE email IS NOT NULL AND trim(email) = '';
UPDATE public.pacientes SET email = lower(trim(email)) WHERE email IS NOT NULL;
UPDATE public.pacientes SET cpf = NULL WHERE cpf IS NOT NULL AND trim(cpf) = '';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pacientes_terapeuta_cpf
  ON public.pacientes (terapeuta_id, cpf)
  WHERE cpf IS NOT NULL AND ativo = true;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pacientes_terapeuta_email
  ON public.pacientes (terapeuta_id, email)
  WHERE email IS NOT NULL AND ativo = true;
