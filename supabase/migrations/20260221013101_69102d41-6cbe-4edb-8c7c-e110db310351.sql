ALTER TABLE config_agenda 
  ADD COLUMN IF NOT EXISTS vagas_por_horario integer NOT NULL DEFAULT 1;

ALTER TABLE config_agenda 
  ALTER COLUMN horario_inicio SET DEFAULT '06:00:00',
  ALTER COLUMN horario_fim SET DEFAULT '20:00:00';