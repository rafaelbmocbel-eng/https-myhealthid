-- ========================================================
-- AGREGAR TOKENS DE PORTAL E CONTROLE DE ATIVAÇÃO
-- ========================================================

-- 1. Adicionar colunas na tabela 'pacientes'
ALTER TABLE public.pacientes 
ADD COLUMN IF NOT EXISTS portal_token UUID DEFAULT gen_random_uuid(),
ADD COLUMN IF NOT EXISTS portal_activated BOOLEAN DEFAULT false;

-- Garantir que tokens existentes sejam únicos
CREATE UNIQUE INDEX IF NOT EXISTS idx_pacientes_portal_token ON public.pacientes(portal_token);

-- 2. Atualizar função de gatilho handle_new_user para marcar portal como ativado
-- e garantir que o vínculo de e-mail seja respeitado
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
  IF new_role = 'patient' THEN
    -- Se temos um professional_id nos metadados, criamos o vínculo
    IF new_professional_id IS NOT NULL THEN
      INSERT INTO public.professional_patient (professional_id, patient_id)
      VALUES (new_professional_id, NEW.id)
      ON CONFLICT (professional_id, patient_id) DO NOTHING;
    END IF;
    
    -- 3. Vínculo/Criação na tabela clínica 'pacientes'
    -- Procurar por um paciente existente com este email
    SELECT id INTO existing_paciente_id FROM public.pacientes WHERE email = NEW.email LIMIT 1;

    IF existing_paciente_id IS NOT NULL THEN
      -- Se já existe, vinculamos o user_id e marcamos como ativado
      UPDATE public.pacientes 
      SET 
        user_id = NEW.id,
        terapeuta_id = COALESCE(terapeuta_id, new_professional_id),
        portal_activated = true,
        nome = CASE WHEN nome = '' OR nome IS NULL THEN new_nome ELSE nome END
      WHERE id = existing_paciente_id;
    ELSE
      -- Se NÃO existe (cadastro direto pelo portal sem convite prévio), 
      -- CRIAMOS a ficha clínica se tivermos o professional_id
      IF new_professional_id IS NOT NULL THEN
        INSERT INTO public.pacientes (nome, email, terapeuta_id, user_id, ativo, portal_activated)
        VALUES (new_nome, NEW.email, new_professional_id, NEW.id, true, true);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erro no gatilho handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Gerar tokens para pacientes que ainda não possuem (caso o default não tenha pegado em registros antigos)
UPDATE public.pacientes SET portal_token = gen_random_uuid() WHERE portal_token IS NULL;
