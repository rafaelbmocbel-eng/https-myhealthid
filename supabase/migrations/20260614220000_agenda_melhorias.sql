-- Lista de espera e sala de espera virtual

-- Lista de espera para horários cancelados/lotados
CREATE TABLE IF NOT EXISTS public.agenda_lista_espera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  nome_contato text NOT NULL,
  telefone text NOT NULL,
  data_preferida date,
  horario_preferido_inicio time,
  horario_preferido_fim time,
  tipo_atendimento text NOT NULL DEFAULT 'retorno',
  observacoes text,
  prioridade smallint NOT NULL DEFAULT 1,
  notificado_em timestamptz,
  status text NOT NULL DEFAULT 'aguardando',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lista_espera_status_check CHECK (status IN ('aguardando','notificado','agendou','desistiu'))
);

ALTER TABLE public.agenda_lista_espera ENABLE ROW LEVEL SECURITY;

CREATE POLICY "terapeuta gerencia lista espera"
  ON public.agenda_lista_espera FOR ALL
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE INDEX IF NOT EXISTS idx_lista_espera_terapeuta
  ON public.agenda_lista_espera (terapeuta_id, status, created_at);

CREATE TRIGGER trg_lista_espera_updated
  BEFORE UPDATE ON public.agenda_lista_espera
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sala de espera virtual: check-in do paciente
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS checked_in_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_agendamentos_checkin
  ON public.agendamentos (terapeuta_id, checked_in_em)
  WHERE checked_in_em IS NOT NULL;
