
-- Create a security definer function that returns ONLY availability data (no patient info)
CREATE OR REPLACE FUNCTION public.get_agenda_disponibilidade(
  p_terapeuta_id uuid,
  p_data_inicio timestamptz,
  p_data_fim timestamptz
)
RETURNS TABLE(data_inicio timestamptz, data_fim timestamptz, status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.data_inicio, a.data_fim, a.status
  FROM public.agendamentos a
  WHERE a.terapeuta_id = p_terapeuta_id
    AND a.data_inicio >= p_data_inicio
    AND a.data_inicio <= p_data_fim
  ORDER BY a.data_inicio;
$$;

-- Grant execute to anon and authenticated
GRANT EXECUTE ON FUNCTION public.get_agenda_disponibilidade(uuid, timestamptz, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.get_agenda_disponibilidade(uuid, timestamptz, timestamptz) TO authenticated;

-- Drop the overly permissive public SELECT policies
DROP POLICY IF EXISTS "pub_agendamentos_read_via_funil" ON public.agendamentos;
DROP POLICY IF EXISTS "pub_agendamentos_read" ON public.agendamentos;
