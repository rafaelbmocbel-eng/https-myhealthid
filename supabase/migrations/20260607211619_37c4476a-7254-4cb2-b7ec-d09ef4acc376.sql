
-- Tabela de diagnósticos CID-10 por paciente (lente Médico)
CREATE TABLE IF NOT EXISTS public.diagnosticos_paciente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL,
  terapeuta_id uuid NOT NULL,
  cid_codigo text NOT NULL,
  cid_descricao text NOT NULL,
  tipo text NOT NULL DEFAULT 'principal', -- principal | secundario | suspeita
  observacao text,
  ativo boolean NOT NULL DEFAULT true,
  data_diagnostico date DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnosticos_paciente TO authenticated;
GRANT ALL ON public.diagnosticos_paciente TO service_role;

ALTER TABLE public.diagnosticos_paciente ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diag_owner_all" ON public.diagnosticos_paciente
  FOR ALL TO authenticated
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE INDEX IF NOT EXISTS diagnosticos_paciente_pac_idx
  ON public.diagnosticos_paciente(paciente_id, ativo);

CREATE TRIGGER trg_diag_paciente_updated
  BEFORE UPDATE ON public.diagnosticos_paciente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed CID-10 com códigos mais comuns em ortopedia/reabilitação/clínica geral
INSERT INTO public.cid10_catalogo (codigo, descricao, categoria) VALUES
  ('M54.5', 'Dor lombar baixa', 'Ortopedia'),
  ('M54.2', 'Cervicalgia', 'Ortopedia'),
  ('M54.4', 'Lumbago com ciática', 'Ortopedia'),
  ('M54.1', 'Radiculopatia', 'Ortopedia'),
  ('M51.1', 'Transtornos de discos lombares e de outros discos intervertebrais com radiculopatia', 'Ortopedia'),
  ('M50.1', 'Transtornos de discos cervicais com radiculopatia', 'Ortopedia'),
  ('M75.0', 'Capsulite adesiva do ombro', 'Ortopedia'),
  ('M75.1', 'Síndrome do manguito rotador', 'Ortopedia'),
  ('M75.4', 'Síndrome de colisão do ombro', 'Ortopedia'),
  ('M77.0', 'Epicondilite medial', 'Ortopedia'),
  ('M77.1', 'Epicondilite lateral', 'Ortopedia'),
  ('M65.4', 'Tenossinovite estilóide radial [de Quervain]', 'Ortopedia'),
  ('M70.6', 'Bursite trocantérica', 'Ortopedia'),
  ('M76.6', 'Tendinite do calcâneo', 'Ortopedia'),
  ('M77.3', 'Esporão do calcâneo', 'Ortopedia'),
  ('M17.0', 'Gonartrose primária bilateral', 'Ortopedia'),
  ('M16.0', 'Coxartrose primária bilateral', 'Ortopedia'),
  ('M19.0', 'Artrose primária de outras articulações', 'Ortopedia'),
  ('M23.2', 'Transtorno do menisco devido à ruptura ou lesão antiga', 'Ortopedia'),
  ('M25.5', 'Dor articular', 'Ortopedia'),
  ('M62.8', 'Outros transtornos musculares especificados', 'Ortopedia'),
  ('M79.1', 'Mialgia', 'Ortopedia'),
  ('M79.7', 'Fibromialgia', 'Reumatologia'),
  ('M41.9', 'Escoliose não especificada', 'Ortopedia'),
  ('M40.0', 'Cifose postural', 'Ortopedia'),
  ('M42.0', 'Osteocondrose juvenil da coluna vertebral', 'Ortopedia'),
  ('M48.0', 'Estenose espinal', 'Ortopedia'),
  ('S83.5', 'Entorse e distensão envolvendo ligamento cruzado do joelho', 'Trauma'),
  ('S93.4', 'Entorse e distensão do tornozelo', 'Trauma'),
  ('S43.4', 'Entorse e distensão da articulação do ombro', 'Trauma'),
  ('S13.4', 'Entorse e distensão da coluna cervical', 'Trauma'),
  ('S33.5', 'Entorse e distensão da coluna lombar', 'Trauma'),
  ('G56.0', 'Síndrome do túnel do carpo', 'Neurologia'),
  ('G54.0', 'Transtornos do plexo braquial', 'Neurologia'),
  ('G43.0', 'Enxaqueca sem aura', 'Neurologia'),
  ('G47.0', 'Distúrbios do início e da manutenção do sono [insônias]', 'Neurologia'),
  ('G47.3', 'Apnéia do sono', 'Neurologia'),
  ('G20', 'Doença de Parkinson', 'Neurologia'),
  ('I10', 'Hipertensão essencial', 'Cardiologia'),
  ('I11.9', 'Doença cardíaca hipertensiva sem insuficiência cardíaca (congestiva)', 'Cardiologia'),
  ('I25.1', 'Doença aterosclerótica do coração', 'Cardiologia'),
  ('I48', 'Fibrilação e flutter atrial', 'Cardiologia'),
  ('I50.0', 'Insuficiência cardíaca congestiva', 'Cardiologia'),
  ('I63.9', 'Acidente vascular cerebral isquêmico não especificado', 'Cardiologia'),
  ('E10.9', 'Diabetes mellitus tipo 1 sem complicações', 'Endocrinologia'),
  ('E11.9', 'Diabetes mellitus tipo 2 sem complicações', 'Endocrinologia'),
  ('E66.0', 'Obesidade devida a excesso de calorias', 'Endocrinologia'),
  ('E66.9', 'Obesidade não especificada', 'Endocrinologia'),
  ('E78.0', 'Hipercolesterolemia pura', 'Endocrinologia'),
  ('E78.5', 'Hiperlipidemia não especificada', 'Endocrinologia'),
  ('E03.9', 'Hipotireoidismo não especificado', 'Endocrinologia'),
  ('E05.9', 'Tireotoxicose não especificada', 'Endocrinologia'),
  ('F32.0', 'Episódio depressivo leve', 'Psiquiatria'),
  ('F32.1', 'Episódio depressivo moderado', 'Psiquiatria'),
  ('F32.2', 'Episódio depressivo grave sem sintomas psicóticos', 'Psiquiatria'),
  ('F33.0', 'Transtorno depressivo recorrente, atualmente em episódio leve', 'Psiquiatria'),
  ('F41.0', 'Transtorno de pânico', 'Psiquiatria'),
  ('F41.1', 'Ansiedade generalizada', 'Psiquiatria'),
  ('F41.2', 'Transtorno misto ansioso e depressivo', 'Psiquiatria'),
  ('F43.0', 'Reação aguda ao "stress"', 'Psiquiatria'),
  ('F43.1', 'Estado de "stress" pós-traumático', 'Psiquiatria'),
  ('F43.2', 'Transtornos de adaptação', 'Psiquiatria'),
  ('F51.0', 'Insônia não-orgânica', 'Psiquiatria'),
  ('F90.0', 'Distúrbios da atividade e da atenção', 'Psiquiatria'),
  ('J00', 'Nasofaringite aguda [resfriado comum]', 'Clínica Geral'),
  ('J06.9', 'Infecção aguda das vias aéreas superiores não especificada', 'Clínica Geral'),
  ('J20.9', 'Bronquite aguda não especificada', 'Clínica Geral'),
  ('J45.9', 'Asma não especificada', 'Pneumologia'),
  ('J44.9', 'Doença pulmonar obstrutiva crônica não especificada', 'Pneumologia'),
  ('K21.0', 'Doença de refluxo gastroesofágico com esofagite', 'Gastroenterologia'),
  ('K29.7', 'Gastrite não especificada', 'Gastroenterologia'),
  ('K59.0', 'Constipação', 'Gastroenterologia'),
  ('N39.0', 'Infecção do trato urinário de localização não especificada', 'Urologia'),
  ('N40', 'Hiperplasia da próstata', 'Urologia'),
  ('N94.6', 'Dismenorréia não especificada', 'Ginecologia'),
  ('N95.1', 'Estados associados à menopausa e ao climatério', 'Ginecologia'),
  ('L20.9', 'Dermatite atópica não especificada', 'Dermatologia'),
  ('L40.0', 'Psoríase vulgar', 'Dermatologia'),
  ('L70.0', 'Acne vulgar', 'Dermatologia'),
  ('H10.9', 'Conjuntivite não especificada', 'Oftalmologia'),
  ('H66.9', 'Otite média não especificada', 'Otorrinolaringologia'),
  ('Z00.0', 'Exame médico geral', 'Preventivo'),
  ('Z01.7', 'Exame de laboratório', 'Preventivo'),
  ('Z71.3', 'Aconselhamento dietético e vigilância', 'Preventivo'),
  ('Z72.0', 'Uso de tabaco', 'Preventivo'),
  ('Z73.0', 'Esgotamento (fadiga)', 'Preventivo'),
  ('R51', 'Cefaléia', 'Sintomas'),
  ('R52.2', 'Outra dor crônica', 'Sintomas'),
  ('R53', 'Mal estar e fadiga', 'Sintomas'),
  ('R10.4', 'Outras dores abdominais e as não especificadas', 'Sintomas'),
  ('R42', 'Tontura e instabilidade', 'Sintomas')
ON CONFLICT (codigo) DO NOTHING;
