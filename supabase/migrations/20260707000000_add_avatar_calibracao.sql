CREATE TABLE IF NOT EXISTS avatar_calibracao (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  offsets      jsonb       NOT NULL DEFAULT '{}',
  scales       jsonb       NOT NULL DEFAULT '{}',
  figura       jsonb       NOT NULL DEFAULT '{}',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE avatar_calibracao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profissional gerencia própria calibração"
  ON avatar_calibracao
  FOR ALL
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);
