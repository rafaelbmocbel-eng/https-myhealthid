-- História de vida completa do paciente
-- Eventos significativos que contam a jornada clínica/de vida do paciente

CREATE TABLE IF NOT EXISTS public.historia_vida_paciente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  data_evento date NOT NULL,
  tipo text NOT NULL DEFAULT 'outro',
  titulo text NOT NULL,
  descricao text,
  sistema_corporal text,
  severidade smallint DEFAULT 0 CHECK (severidade BETWEEN 0 AND 4),
  resolvido boolean DEFAULT false,
  visivel_paciente boolean DEFAULT true,
  profissional_registro text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT historia_vida_tipo_check CHECK (tipo IN (
    'nascimento','cirurgia','trauma','diagnostico','internacao',
    'medicamento','alergia','vacina','gestacao','parto',
    'acidente','fratura','procedimento','alta','remissao',
    'inicio_tratamento','marco_tratamento','outro'
  ))
);

ALTER TABLE public.historia_vida_paciente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terapeuta gerencia historia vida"
  ON public.historia_vida_paciente FOR ALL
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE INDEX IF NOT EXISTS idx_historia_vida_paciente
  ON public.historia_vida_paciente (paciente_id, data_evento DESC);

CREATE INDEX IF NOT EXISTS idx_historia_vida_terapeuta
  ON public.historia_vida_paciente (terapeuta_id, paciente_id);

CREATE TRIGGER trg_historia_vida_updated
  BEFORE UPDATE ON public.historia_vida_paciente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
