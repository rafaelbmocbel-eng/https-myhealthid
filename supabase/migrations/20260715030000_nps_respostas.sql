-- NPS pós-atendimento (onda 4): a nota 0–10 que o cliente responde no Zap é
-- capturada automaticamente aqui. Escrita só pelo backend (service role);
-- o profissional lê as suas.
CREATE TABLE IF NOT EXISTS public.nps_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  nota integer NOT NULL CHECK (nota >= 0 AND nota <= 10),
  origem text NOT NULL DEFAULT 'whatsapp',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.nps_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Terapeuta le seus NPS" ON public.nps_respostas;
CREATE POLICY "Terapeuta le seus NPS" ON public.nps_respostas
  FOR SELECT TO authenticated USING (terapeuta_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_nps_respostas_terapeuta
  ON public.nps_respostas (terapeuta_id, created_at DESC);
