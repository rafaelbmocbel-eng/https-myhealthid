-- Fix 1: Remove overly permissive anon SELECT on funil_leads
-- The "Terapeutas gerenciam leads" policy already covers authenticated therapist reads
DROP POLICY IF EXISTS "Público lê seus leads" ON public.funil_leads;

-- Fix 2: Remove the overly permissive "Service insere notas prontuario" WITH CHECK (true) policy
-- Therapists already have their own INSERT policy scoped by auth.uid()
DROP POLICY IF EXISTS "Service insere notas prontuario" ON public.notas_prontuario;