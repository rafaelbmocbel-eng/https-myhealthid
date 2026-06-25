-- Token usado pelo paciente para acessar o portal sem senha (link mágico).
-- Faltava nas migrations originais: criado direto no Studio do Lovable,
-- nunca versionado. Usado por policies de RLS a partir daqui no histórico.
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS portal_token text;
