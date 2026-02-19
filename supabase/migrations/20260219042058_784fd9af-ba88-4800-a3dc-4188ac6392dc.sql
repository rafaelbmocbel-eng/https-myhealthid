
-- ========================================================
-- CORE AXIS PRO – AGENDA INTELIGENTE PREMIUM
-- Schema completo: perfis, pacientes, agendamentos, config
-- ========================================================

-- 1. Perfis de usuários (terapeutas e admins)
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  nome TEXT NOT NULL DEFAULT '',
  sobrenome TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  telefone TEXT,
  crefito TEXT,
  especialidade TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem próprio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários editam próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários inserem próprio perfil"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 2. Pacientes (vinculados ao terapeuta)
CREATE TABLE public.pacientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  terapeuta_id UUID NOT NULL,
  nome TEXT NOT NULL,
  sobrenome TEXT NOT NULL DEFAULT '',
  email TEXT,
  telefone TEXT,
  data_nascimento DATE,
  sexo TEXT CHECK (sexo IN ('M', 'F', 'O')),
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas veem seus pacientes"
  ON public.pacientes FOR SELECT
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas inserem pacientes"
  ON public.pacientes FOR INSERT
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas editam seus pacientes"
  ON public.pacientes FOR UPDATE
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas deletam seus pacientes"
  ON public.pacientes FOR DELETE
  USING (auth.uid() = terapeuta_id);

-- 3. Configuração da agenda por terapeuta
CREATE TABLE public.config_agenda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  terapeuta_id UUID NOT NULL UNIQUE,
  horario_inicio TIME NOT NULL DEFAULT '08:00:00',
  horario_fim TIME NOT NULL DEFAULT '18:00:00',
  duracao_padrao INTEGER NOT NULL DEFAULT 45,
  dias_semana JSONB NOT NULL DEFAULT '{"seg":true,"ter":true,"qua":true,"qui":true,"sex":true,"sab":false,"dom":false}',
  intervalo_entre_sessoes INTEGER NOT NULL DEFAULT 0,
  slug TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.config_agenda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas veem própria config"
  ON public.config_agenda FOR SELECT
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas inserem config"
  ON public.config_agenda FOR INSERT
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas editam config"
  ON public.config_agenda FOR UPDATE
  USING (auth.uid() = terapeuta_id);

-- 4. Agendamentos
CREATE TABLE public.agendamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  terapeuta_id UUID NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  titulo TEXT,
  data_inicio TIMESTAMP WITH TIME ZONE NOT NULL,
  data_fim TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'pendente', 'bloqueado', 'concluido', 'cancelado', 'faltou')),
  tipo_atendimento TEXT DEFAULT 'retorno' CHECK (tipo_atendimento IN ('primeira_consulta', 'retorno', 'reavaliacao', 'bloqueio', 'outro')),
  observacoes TEXT,
  cor TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas veem seus agendamentos"
  ON public.agendamentos FOR SELECT
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas inserem agendamentos"
  ON public.agendamentos FOR INSERT
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas editam seus agendamentos"
  ON public.agendamentos FOR UPDATE
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeutas deletam seus agendamentos"
  ON public.agendamentos FOR DELETE
  USING (auth.uid() = terapeuta_id);

-- 5. Função de atualização de timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_pacientes_updated_at
  BEFORE UPDATE ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_config_agenda_updated_at
  BEFORE UPDATE ON public.config_agenda
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_agendamentos_updated_at
  BEFORE UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6. Trigger para auto-criar perfil no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Índices para performance
CREATE INDEX idx_agendamentos_terapeuta ON public.agendamentos(terapeuta_id);
CREATE INDEX idx_agendamentos_data ON public.agendamentos(data_inicio, data_fim);
CREATE INDEX idx_pacientes_terapeuta ON public.pacientes(terapeuta_id);
