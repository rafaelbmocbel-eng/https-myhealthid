CREATE OR REPLACE FUNCTION public.link_patient_user_by_token(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.pacientes
  SET user_id = auth.uid(),
      updated_at = now()
  WHERE portal_token = p_token
    AND (user_id IS NULL OR user_id = auth.uid())
  RETURNING id INTO v_patient_id;

  IF v_patient_id IS NULL THEN
    SELECT id
    INTO v_patient_id
    FROM public.pacientes
    WHERE portal_token = p_token
      AND user_id = auth.uid()
    LIMIT 1;
  END IF;

  RETURN v_patient_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_patient_user_by_token(text) TO authenticated;