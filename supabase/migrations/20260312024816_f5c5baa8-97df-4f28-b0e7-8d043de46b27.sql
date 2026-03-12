
-- Add portal_token column to pacientes for patient portal access
ALTER TABLE public.pacientes 
ADD COLUMN IF NOT EXISTS portal_token text UNIQUE DEFAULT encode(extensions.gen_random_bytes(16), 'hex');

-- Generate tokens for existing patients that don't have one
UPDATE public.pacientes 
SET portal_token = encode(extensions.gen_random_bytes(16), 'hex') 
WHERE portal_token IS NULL;

-- Add user_id column if not exists (for linking auth user to patient record)
ALTER TABLE public.pacientes 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
