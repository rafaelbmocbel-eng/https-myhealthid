
-- ========================================================
-- REPARO CONSOLIDADO V2: PORTAL DO PACIENTE MYID (ENHANCED)
-- ========================================================

-- 1. Estrutura da Tabela Pacientes (Legada)
DO $$ 
BEGIN
    -- Adicionar user_id para vincular o Login à ficha clínica
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pacientes' AND column_name = 'user_id') THEN
        ALTER TABLE public.pacientes ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 2. Garantir que as colunas na tabela profiles tenham defaults seguros
DO $$ 
BEGIN
    ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'patient';
    ALTER TABLE public.profiles ALTER COLUMN nome SET DEFAULT '';
    ALTER TABLE public.profiles ALTER COLUMN sobrenome SET DEFAULT '';
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'patient' CHECK (role IN ('admin', 'professional', 'patient'));
    END IF;
END $$;

-- 3. Recriar a função de gatilho ultra-resiliente com Lógica de Vínculo
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_role TEXT;
  new_nome TEXT;
  new_professional_id UUID;
BEGIN
  -- Extrair metadados com segurança total
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

  -- A. Inserir ou atualizar perfil
  INSERT INTO public.profiles (user_id, email, nome, sobrenome, role)
  VALUES (NEW.id, NEW.email, new_nome, '', new_role)
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    nome = CASE WHEN profiles.nome = '' THEN EXCLUDED.nome ELSE profiles.nome END,
    role = CASE WHEN profiles.role = 'patient' THEN EXCLUDED.role ELSE profiles.role END;

  -- B. Vínculo Profissional (se houver professional_id nos metadados)
  IF new_professional_id IS NOT NULL THEN
    INSERT INTO public.professional_patient (professional_id, patient_id)
    VALUES (new_professional_id, NEW.id)
    ON CONFLICT (professional_id, patient_id) DO NOTHING;
  END IF;

  -- C. Vínculo com Tabela Legada de Pacientes (pelo e-mail)
  -- Se o e-mail do novo usuário já existir na tabela 'pacientes', vinculamos o user_id
  UPDATE public.pacientes 
  SET user_id = NEW.id 
  WHERE email = NEW.email AND user_id IS NULL;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Erro no gatilho handle_new_user: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Resetar o gatilho
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Permissões
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT UPDATE(user_id) ON public.pacientes TO service_role;
