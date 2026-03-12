
-- ========================================================
-- REPARO CONSOLIDADO: PORTAL DO PACIENTE MYID
-- Execute este script no SQL Editor do Supabase se o 
-- cadastro de pacientes estiver falhando.
-- ========================================================

-- 1. Garantir que as colunas necessárias existam na tabela profiles
DO $$ 
BEGIN
    -- Coluna Role
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'patient' CHECK (role IN ('admin', 'professional', 'patient'));
    END IF;

    -- Colunas de Gamificação
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'total_points') THEN
        ALTER TABLE public.profiles ADD COLUMN total_points INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'current_level') THEN
        ALTER TABLE public.profiles ADD COLUMN current_level TEXT DEFAULT 'Iniciante';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'plan') THEN
        ALTER TABLE public.profiles ADD COLUMN plan TEXT DEFAULT 'free';
    END IF;
END $$;

-- 2. Recriar a função de gatilho com suporte a metadados e Role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_role TEXT;
  new_nome TEXT;
BEGIN
  -- Extrair role e nome dos metadados (se fornecidos no signUp)
  new_role := COALESCE(NEW.raw_user_meta_data->>'role', 'patient');
  new_nome := COALESCE(NEW.raw_user_meta_data->>'nome', '');

  -- Garantir que a role seja válida
  IF new_role NOT IN ('admin', 'professional', 'patient') THEN
    new_role := 'patient';
  END IF;

  INSERT INTO public.profiles (user_id, email, nome, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    new_nome,
    new_role
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    nome = CASE WHEN profiles.nome = '' THEN EXCLUDED.nome ELSE profiles.nome END,
    role = CASE WHEN profiles.role = 'patient' THEN EXCLUDED.role ELSE profiles.role END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Garantir que o gatilho existe e está ativo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Garantir permissões de acesso básicas
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
