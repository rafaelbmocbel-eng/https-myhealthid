-- 1) config_agenda: adicionar turnos por dia
ALTER TABLE public.config_agenda
  ADD COLUMN IF NOT EXISTS turnos jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.config_agenda.turnos IS
  'Múltiplos blocos por dia. Ex: {"seg":[{"inicio":"08:00","fim":"12:00"},{"inicio":"14:00","fim":"18:00"}]}. Vazio = usa horario_inicio/fim global.';

-- 2) config_clinica: logo
ALTER TABLE public.config_clinica
  ADD COLUMN IF NOT EXISTS logo_url text;

-- 3) Tabela de ausências (férias, feriados, folgas)
CREATE TABLE IF NOT EXISTS public.ausencias_terapeuta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  motivo text,
  dia_inteiro boolean NOT NULL DEFAULT true,
  hora_inicio time,
  hora_fim time,
  cor text DEFAULT '#94a3b8',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ausencias_data_valida CHECK (data_fim >= data_inicio),
  CONSTRAINT ausencias_horario_valido CHECK (
    dia_inteiro = true
    OR (hora_inicio IS NOT NULL AND hora_fim IS NOT NULL AND hora_fim > hora_inicio)
  )
);

CREATE INDEX IF NOT EXISTS idx_ausencias_terapeuta_periodo
  ON public.ausencias_terapeuta (terapeuta_id, data_inicio, data_fim);

ALTER TABLE public.ausencias_terapeuta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas gerenciam próprias ausências"
  ON public.ausencias_terapeuta
  FOR ALL
  TO authenticated
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Pacientes leem ausências do seu terapeuta"
  ON public.ausencias_terapeuta
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.terapeuta_id = ausencias_terapeuta.terapeuta_id
      AND p.user_id = auth.uid()
      AND p.ativo = true
  ));

CREATE TRIGGER trg_ausencias_updated_at
  BEFORE UPDATE ON public.ausencias_terapeuta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) RPCs públicas para agenda pública (via token)
CREATE OR REPLACE FUNCTION public.get_turnos_by_token(p_token text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT ca.turnos
  FROM public.config_agenda ca
  JOIN public.links_agenda_paciente lap ON lap.terapeuta_id = ca.terapeuta_id
  WHERE lap.token = p_token
    AND lap.status = 'ativo'
    AND lap.data_expiracao > now()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_ausencias_by_token(p_token text, p_data_inicio date, p_data_fim date)
RETURNS TABLE (
  data_inicio date,
  data_fim date,
  dia_inteiro boolean,
  hora_inicio time,
  hora_fim time,
  motivo text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT a.data_inicio, a.data_fim, a.dia_inteiro, a.hora_inicio, a.hora_fim, a.motivo
  FROM public.ausencias_terapeuta a
  JOIN public.links_agenda_paciente lap ON lap.terapeuta_id = a.terapeuta_id
  WHERE lap.token = p_token
    AND lap.status = 'ativo'
    AND lap.data_expiracao > now()
    AND a.data_fim >= p_data_inicio
    AND a.data_inicio <= p_data_fim;
$$;

-- 5) Bucket público para logo da clínica
INSERT INTO storage.buckets (id, name, public)
VALUES ('clinica-assets', 'clinica-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Logos da clínica são públicos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'clinica-assets');

CREATE POLICY "Terapeuta envia logo para sua pasta"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'clinica-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Terapeuta atualiza logo da sua pasta"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'clinica-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Terapeuta remove logo da sua pasta"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'clinica-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );