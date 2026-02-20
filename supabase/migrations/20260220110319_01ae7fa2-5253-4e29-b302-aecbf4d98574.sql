
-- Create a security definer function to validate agenda link tokens
CREATE OR REPLACE FUNCTION public.link_agenda_valido_por_token(p_token text)
RETURNS TABLE(terapeuta_id uuid, paciente_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lap.terapeuta_id, lap.paciente_id
  FROM public.links_agenda_paciente lap
  WHERE lap.token = p_token
    AND lap.status = 'ativo'
    AND lap.data_expiracao > now()
  LIMIT 1;
$$;

-- Allow anonymous INSERT into agendamentos when a valid agenda link token exists
-- The insert must match the terapeuta_id and paciente_id from the valid link
CREATE POLICY "pub_agendamentos_insert_via_token"
ON public.agendamentos
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.links_agenda_paciente lap
    WHERE lap.terapeuta_id = agendamentos.terapeuta_id
      AND lap.paciente_id = agendamentos.paciente_id
      AND lap.status = 'ativo'
      AND lap.data_expiracao > now()
  )
  AND status = 'pendente'
);

-- Also allow anonymous UPDATE on links_agenda_paciente to track access
CREATE POLICY "pub_links_agenda_update_access"
ON public.links_agenda_paciente
FOR UPDATE
USING (status = 'ativo' AND data_expiracao > now())
WITH CHECK (status = 'ativo');
