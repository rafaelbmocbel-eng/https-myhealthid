-- 1) historia_vida_paciente
CREATE TABLE IF NOT EXISTS public.historia_vida_paciente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id UUID NOT NULL,
  data_evento DATE NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  sistema_corporal TEXT,
  severidade INTEGER,
  resolvido BOOLEAN DEFAULT FALSE,
  profissional_registro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_historia_vida_paciente ON public.historia_vida_paciente(paciente_id);
CREATE INDEX IF NOT EXISTS idx_historia_vida_terapeuta ON public.historia_vida_paciente(terapeuta_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.historia_vida_paciente TO authenticated;
GRANT ALL ON public.historia_vida_paciente TO service_role;
ALTER TABLE public.historia_vida_paciente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta gerencia historia de seus pacientes"
  ON public.historia_vida_paciente FOR ALL
  TO authenticated
  USING (terapeuta_id = auth.uid())
  WITH CHECK (terapeuta_id = auth.uid());

CREATE TRIGGER trg_historia_vida_updated
  BEFORE UPDATE ON public.historia_vida_paciente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) agenda_lista_espera
CREATE TABLE IF NOT EXISTS public.agenda_lista_espera (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id UUID NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  nome_contato TEXT NOT NULL,
  telefone TEXT NOT NULL,
  data_preferida DATE,
  horario_preferido_inicio TIME,
  horario_preferido_fim TIME,
  tipo_atendimento TEXT NOT NULL DEFAULT 'consulta',
  observacoes TEXT,
  prioridade INTEGER NOT NULL DEFAULT 1,
  notificado_em TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'aguardando',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lista_espera_terapeuta ON public.agenda_lista_espera(terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_lista_espera_status ON public.agenda_lista_espera(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_lista_espera TO authenticated;
GRANT ALL ON public.agenda_lista_espera TO service_role;
ALTER TABLE public.agenda_lista_espera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta gerencia sua lista de espera"
  ON public.agenda_lista_espera FOR ALL
  TO authenticated
  USING (terapeuta_id = auth.uid())
  WITH CHECK (terapeuta_id = auth.uid());

CREATE TRIGGER trg_lista_espera_updated
  BEFORE UPDATE ON public.agenda_lista_espera
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Colunas faltantes
ALTER TABLE public.avaliacoes_identidade
  ADD COLUMN IF NOT EXISTS queixa_principal TEXT;

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS checked_in_em TIMESTAMPTZ;