
-- ========================================================
-- FIX: VÍNCULO AUTOMÁTICO DE PACIENTES REGISTRADOS PELO PORTAL
-- ========================================================

-- Recriar a função de gatilho para incluir a criação automática na tabela 'pacientes'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_role TEXT;
  new_nome TEXT;
  new_professional_id UUID;
  existing_paciente_id UUID;
BEGIN
  -- Extrair metadados
  new_role := COALESCE(NEW.raw_user_meta_data->>'role', 'patient');
  new_nome := COALESCE(NEW.raw_user_meta_data->>'nome', '');
  
  BEGIN
    new_professional_id := (NEW.raw_user_meta_data->>'professional_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    new_professional_id := NULL;
  END;

  -- Validar Role
  IF new_role NOT IN ('admin', 'professional', 'patient') THEN
    new_role := 'patient';
  END IF;

  -- 1. Inserir ou atualizar perfil
  INSERT INTO public.profiles (user_id, email, nome, sobrenome, role)
  VALUES (NEW.id, NEW.email, new_nome, '', new_role)
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    nome = CASE WHEN public.profiles.nome = '' THEN EXCLUDED.nome ELSE public.profiles.nome END,
    role = CASE WHEN public.profiles.role = 'patient' THEN EXCLUDED.role ELSE public.profiles.role END;

  -- 2. Vínculo na tabela de relação moderna professional_patient
  IF new_professional_id IS NOT NULL AND new_role = 'patient' THEN
    INSERT INTO public.professional_patient (professional_id, patient_id)
    VALUES (new_professional_id, NEW.id)
    ON CONFLICT (professional_id, patient_id) DO NOTHING;
    
    -- 3. Vínculo/Criação na tabela clínica 'pacientes'
    -- Procurar por um paciente existente com este email
    SELECT id INTO existing_paciente_id FROM public.pacientes WHERE email = NEW.email LIMIT 1;

    IF existing_paciente_id IS NOT NULL THEN
      -- Se já existe, apenas vinculamos o user_id e o terapeuta_id (se ainda for nulo)
      UPDATE public.pacientes 
      SET 
        user_id = NEW.id,
        terapeuta_id = COALESCE(terapeuta_id, new_professional_id),
        nome = CASE WHEN nome = '' OR nome IS NULL THEN new_nome ELSE nome END
      WHERE id = existing_paciente_id;
    ELSE
      -- Se NÃO existe, CRIAMOS a ficha clínica para que o profissional possa ver o cliente
      INSERT INTO public.pacientes (nome, email, terapeuta_id, user_id, ativo)
      VALUES (new_nome, NEW.email, new_professional_id, NEW.id, true);
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erro no gatilho handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1. Inserir registros na tabela 'pacientes' para usuários 'patient' que possuem vínculo pp mas não possuem ficha clínica
INSERT INTO public.pacientes (nome, email, terapeuta_id, user_id, ativo)
SELECT 
  pr.nome, 
  pr.email, 
  pp.professional_id, 
  pr.user_id, 
  true
FROM public.profiles pr
JOIN public.professional_patient pp ON pr.user_id = pp.patient_id
WHERE pr.role = 'patient'
AND NOT EXISTS (
  SELECT 1 FROM public.pacientes pac WHERE pac.user_id = pr.user_id
);

-- 2. Atualizar terapeuta_id para registros que existem mas estão sem o vínculo do terapeuta
UPDATE public.pacientes p
SET terapeuta_id = pp.professional_id
FROM public.professional_patient pp
WHERE p.user_id = pp.patient_id
AND p.terapeuta_id IS NULL;
