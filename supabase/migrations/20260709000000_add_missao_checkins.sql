-- Check-ins diários de missões da Jornada.
-- Move o "cumpri a missão hoje" do localStorage para o banco, para que o
-- progresso seja COMPARTILHADO entre o app do paciente e o do profissional.
CREATE TABLE IF NOT EXISTS public.missao_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  missao_key text NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paciente_id, missao_key, data)
);

CREATE INDEX IF NOT EXISTS idx_missao_checkins_paciente_data
  ON public.missao_checkins(paciente_id, data);

ALTER TABLE public.missao_checkins ENABLE ROW LEVEL SECURITY;

-- O paciente marca/desmarca as próprias missões
CREATE POLICY "Pacientes gerenciam proprios checkins"
ON public.missao_checkins
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.pacientes p
  WHERE p.id = missao_checkins.paciente_id AND p.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.pacientes p
  WHERE p.id = missao_checkins.paciente_id AND p.user_id = auth.uid()
));

-- O terapeuta vê (e pode gerenciar) os check-ins dos seus pacientes
CREATE POLICY "Terapeutas veem checkins dos pacientes"
ON public.missao_checkins
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.pacientes p
  WHERE p.id = missao_checkins.paciente_id AND p.terapeuta_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.pacientes p
  WHERE p.id = missao_checkins.paciente_id AND p.terapeuta_id = auth.uid()
));

ALTER PUBLICATION supabase_realtime ADD TABLE public.missao_checkins;
