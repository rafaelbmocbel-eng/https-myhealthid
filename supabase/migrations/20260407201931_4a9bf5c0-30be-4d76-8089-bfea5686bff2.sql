-- Drop the overly permissive policy - portal uses SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "pub_pacientes_read_by_portal_token" ON public.pacientes;