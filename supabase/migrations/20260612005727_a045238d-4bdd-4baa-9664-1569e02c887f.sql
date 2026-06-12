-- Restrict tracking_config SELECT to owner only; expose public read via SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Authenticated can read active tracking config" ON public.tracking_config;

CREATE OR REPLACE FUNCTION public.get_public_tracking_config(p_terapeuta_id uuid)
RETURNS TABLE(meta_pixel_id text, ga4_id text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tc.meta_pixel_id, tc.ga4_id
  FROM public.tracking_config tc
  WHERE tc.terapeuta_id = p_terapeuta_id
    AND tc.ativos = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_tracking_config(uuid) TO anon, authenticated;
