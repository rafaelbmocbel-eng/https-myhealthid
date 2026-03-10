-- Migration for Health Diary (Daily Logs)
CREATE TABLE public.daily_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood INTEGER CHECK (mood >= 1 AND mood <= 5),
  pain INTEGER CHECK (pain >= 0 AND pain <= 10),
  sleep_hours DECIMAL(4,1),
  energy INTEGER CHECK (energy >= 1 AND energy <= 5),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own daily logs"
  ON public.daily_logs FOR ALL
  USING (auth.uid() = user_id);

-- Professional view policy (linked professionals can see logs)
-- This assumes the professional_patient table exists and identifies the link.
CREATE POLICY "Professionals can view logs of their patients"
  ON public.daily_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.professional_patient pp
      JOIN public.profiles p ON p.user_id = auth.uid()
      WHERE pp.patient_id = (SELECT id FROM public.pacientes WHERE email = (SELECT email FROM auth.users WHERE id = daily_logs.user_id))
      AND pp.professional_id = auth.uid()
      AND pp.status = 'active'
    )
  );

-- Index for performance
CREATE INDEX idx_daily_logs_user_date ON public.daily_logs(user_id, created_at);
