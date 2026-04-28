ALTER TABLE public.pacientes 
  DROP COLUMN IF EXISTS tipo_cliente,
  DROP COLUMN IF EXISTS plano_nome;