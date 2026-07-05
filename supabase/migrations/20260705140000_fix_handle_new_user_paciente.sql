-- Corrige o trigger handle_new_user para não criar perfil de profissional
-- quando o usuário for um paciente autônomo (cadastro pelo portal do paciente).
-- Pacientes são identificados pela flag is_patient=true nos metadados do cadastro.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Pacientes do portal não recebem perfil de profissional
  IF (NEW.raw_user_meta_data->>'is_patient')::boolean = true THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (user_id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
