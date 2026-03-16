
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip profile creation if user signed up via patient portal
  IF (NEW.raw_user_meta_data->>'is_patient')::boolean IS TRUE THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (user_id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', ''));
  RETURN NEW;
END;
$$;
