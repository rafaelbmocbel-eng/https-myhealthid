-- Migracao: Secretária IA e Agenda Premium

-- Tabela: scheduling_slots
CREATE TABLE IF NOT EXISTS public.scheduling_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL, -- references auth.users
  
  -- Data e hora
  slot_date DATE NOT NULL,
  slot_time_start TIME NOT NULL,
  slot_time_end TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  
  -- Status
  is_available BOOLEAN DEFAULT TRUE,
  booked_by_patient_id UUID, -- references pacientes
  
  -- Tipo de consulta
  consultation_type TEXT DEFAULT 'acompanhamento',
  
  -- Lembretes
  reminder_sent_24h BOOLEAN DEFAULT FALSE,
  reminder_sent_2h BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: appointments (Agendamentos confirmados)
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL, -- references pacientes
  therapist_id UUID NOT NULL, -- references auth.users
  scheduling_slot_id UUID NOT NULL REFERENCES public.scheduling_slots(id),
  
  -- Detalhes
  appointment_date DATE,
  appointment_time TIME,
  duration_minutes INTEGER DEFAULT 60,
  
  -- Status
  status TEXT DEFAULT 'agendado',
  confirmation_code TEXT UNIQUE,
  
  -- Notas
  paciente_observacoes TEXT,
  terapeuta_notas TEXT,
  
  -- Reminders
  reminder_24h_sent BOOLEAN DEFAULT FALSE,
  reminder_2h_sent BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: secretary_conversations
CREATE TABLE IF NOT EXISTS public.secretary_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL,
  therapist_id UUID,
  
  -- Conversa
  messages JSONB DEFAULT '[]'::jsonb,
  
  -- Contexto
  conversation_type TEXT DEFAULT 'general',
  
  -- Segurança
  user_agent TEXT,
  ip_address TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela: therapist_pricing
CREATE TABLE IF NOT EXISTS public.therapist_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id UUID NOT NULL,
  
  -- Planos
  plan_type TEXT DEFAULT 'free',
  
  -- Preços
  price_primeira_avaliacao NUMERIC(6,2),
  price_acompanhamento NUMERIC(6,2),
  price_reavaliacao NUMERIC(6,2),
  
  -- Limite de slots
  max_slots_per_week INTEGER DEFAULT 20,
  
  -- Configurações
  availability_json JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set RLS (Row Level Security)
ALTER TABLE public.scheduling_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secretary_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapist_pricing ENABLE ROW LEVEL SECURITY;

-- Allow authenticates users to read/write for now (simplificado para o MVP)
CREATE POLICY "Enable read for authenticated users" ON public.scheduling_slots FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.scheduling_slots FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read for authenticated users" ON public.appointments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.appointments FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read for authenticated users" ON public.secretary_conversations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.secretary_conversations FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Enable read for authenticated users" ON public.therapist_pricing FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable all for authenticated users" ON public.therapist_pricing FOR ALL USING (auth.role() = 'authenticated');
