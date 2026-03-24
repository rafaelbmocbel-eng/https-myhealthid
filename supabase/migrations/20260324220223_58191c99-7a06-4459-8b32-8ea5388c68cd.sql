
-- Create team members table
CREATE TABLE public.equipe_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#3B82F6',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipe_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas gerenciam equipe" ON public.equipe_membros
  FOR ALL TO authenticated
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);

-- Add membro_equipe_id to agendamentos
ALTER TABLE public.agendamentos ADD COLUMN membro_equipe_id uuid REFERENCES public.equipe_membros(id) ON DELETE SET NULL;
