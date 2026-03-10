
-- ========================================================
-- ETAPA 1: SISTEMA DE ROLES E SEGURANÇA
-- ========================================================

-- 1. Adicionar colunas na tabela profiles (se não existirem)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'patient' CHECK (role IN ('admin', 'professional', 'patient')),
  ADD COLUMN IF NOT EXISTS session_credits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_level TEXT DEFAULT 'Iniciante',
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS fitbit_access_token TEXT,
  ADD COLUMN IF NOT EXISTS fitbit_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS wearable_device TEXT;

-- 2. Criar tabela professional_patient (vínculo entre profissional e paciente)
CREATE TABLE IF NOT EXISTS public.professional_patient (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  specialty TEXT,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(professional_id, patient_id)
);

-- Ativar RLS na nova tabela
ALTER TABLE public.professional_patient ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de RLS para professional_patient
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Profissionais veem seus vínculos') THEN
        CREATE POLICY "Profissionais veem seus vínculos" ON public.professional_patient
        FOR SELECT USING (auth.uid() = professional_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Pacientes veem seus vínculos') THEN
        CREATE POLICY "Pacientes veem seus vínculos" ON public.professional_patient
        FOR SELECT USING (auth.uid() = patient_id);
    END IF;
END $$;

-- 4. Atualizar Políticas de RLS Existentes para suportar Roles

--profiles: garantir que pacientes vejam apenas o seu, e profissionais vejam o dos seus pacientes
DROP POLICY IF EXISTS "Usuários veem próprio perfil" ON public.profiles;
CREATE POLICY "Profiles: acesso baseado em role" 
  ON public.profiles FOR SELECT 
  USING (
    auth.uid() = user_id -- Próprio perfil
    OR 
    EXISTS ( -- Profissional vendo seu paciente
      SELECT 1 FROM public.professional_patient 
      WHERE professional_id = auth.uid() AND patient_id = public.profiles.user_id
    )
    OR
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin' -- Admin vê tudo
  );

--pacientes (tabela legada): permitir que o paciente logado veja seus próprios dados se houver vínculo
DROP POLICY IF EXISTS "Terapeutas veem seus pacientes" ON public.pacientes;
CREATE POLICY "Pacientes: acesso baseado em role"
  ON public.pacientes FOR SELECT
  USING (
    terapeuta_id = auth.uid() -- Profissional original
    OR 
    email = (SELECT email FROM auth.users WHERE id = auth.uid()) -- Paciente pelo email (ponte temporária)
    OR
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
  );

--agendamentos: permitir que o paciente veja seus próprios agendamentos
DROP POLICY IF EXISTS "Terapeutas veem seus agendamentos" ON public.agendamentos;
CREATE POLICY "Agendamentos: acesso baseado em role"
  ON public.agendamentos FOR SELECT
  USING (
    terapeuta_id = auth.uid() 
    OR 
    paciente_id IN (
        SELECT id FROM public.pacientes WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'admin'
  );

-- 5. Função para garantir que novos usuários auth tenham o perfil correto
-- (Já existe handle_new_user, vamos garantir que ela defina o role padrão)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, nome, role)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'nome', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
