-- Coluna que liga o paciente ao seu próprio login (portal do paciente).
-- Faltava nas migrations originais: foi adicionada direto no Studio do
-- Lovable e nunca versionada, mas é usada por várias policies de RLS
-- a partir daqui no histórico.
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
