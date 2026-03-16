
-- Function to link patient by email as fallback (when no token available)
CREATE OR REPLACE FUNCTION public.link_patient_user_by_email()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
  v_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Get user email
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  -- Try to link by matching email
  UPDATE public.pacientes
  SET user_id = auth.uid(), updated_at = now()
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_email))
    AND (user_id IS NULL OR user_id = auth.uid())
  RETURNING id INTO v_patient_id;

  -- If no update happened, check if already linked
  IF v_patient_id IS NULL THEN
    SELECT id INTO v_patient_id
    FROM public.pacientes
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  RETURN v_patient_id;
END;
$$;
