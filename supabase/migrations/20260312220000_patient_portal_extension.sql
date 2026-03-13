-- 1. Tabela de DiÃ¡rio DiÃ¡rio (Humor, Dor, Sono, Energia)
CREATE TABLE IF NOT EXISTS public.daily_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    mood SMALLINT CHECK (mood >= 1 AND mood <= 5),
    pain SMALLINT CHECK (pain >= 0 AND pain <= 10),
    energy SMALLINT CHECK (energy >= 1 AND energy <= 5),
    sleep_hours NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS e criar polÃ­ticas para daily_logs
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pacientes podem ver seus prÃ³prios logs"
ON public.daily_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Pacientes podem inserir seus prÃ³prios logs"
ON public.daily_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 2. Tabela de MissÃµes/Atividades do Paciente
CREATE TABLE IF NOT EXISTS public.patient_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    paciente_id UUID REFERENCES public.pacientes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category TEXT,
    points INTEGER DEFAULT 10,
    time_estimate TEXT,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- Habilitar RLS e criar polÃ­ticas para patient_tasks
ALTER TABLE public.patient_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pacientes podem ver suas missÃµes"
ON public.patient_tasks FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id = patient_tasks.paciente_id
        AND p.user_id = auth.uid()
    )
);

CREATE POLICY "Pacientes podem completar suas missÃµes"
ON public.patient_tasks FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id = patient_tasks.paciente_id
        AND p.user_id = auth.uid()
    )
);

-- 3. Atualizar tabela profiles com GamificaÃ§Ã£o
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='profiles' AND COLUMN_NAME='total_points') THEN
        ALTER TABLE public.profiles ADD COLUMN total_points INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='profiles' AND COLUMN_NAME='current_level') THEN
        ALTER TABLE public.profiles ADD COLUMN current_level TEXT DEFAULT '1';
    END IF;
END $$;

-- 4. Inserir tarefas iniciais para teste (opcional, mas ajuda a ver o portal funcionando)
-- Nota: Isso requer que existam pacientes, entÃ£o deixamos comentado ou disparado por funÃ§Ã£o.
