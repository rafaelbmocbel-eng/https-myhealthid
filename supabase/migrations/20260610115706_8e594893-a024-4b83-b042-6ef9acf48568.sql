
-- Enum sistema corporal
DO $$ BEGIN
  CREATE TYPE public.sistema_corporal AS ENUM (
    'musculoesqueletico','nervoso','cardiovascular','respiratorio',
    'digestorio','endocrino','urinario','reprodutor','tegumentar','linfatico','sensorial'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enum origem do achado
DO $$ BEGIN
  CREATE TYPE public.origem_achado_anatomico AS ENUM (
    'subjetivo_myid','exame_clinico','exame_imagem','voz_ia','autocadastro_paciente','outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enum status clínico
DO $$ BEGIN
  CREATE TYPE public.status_evento_anatomico AS ENUM (
    'ativo','em_tratamento','resolvido','cronico'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.eventos_clinicos_anatomicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id uuid NOT NULL,
  regiao_id text NOT NULL,
  sistema public.sistema_corporal NOT NULL DEFAULT 'musculoesqueletico',
  origem public.origem_achado_anatomico NOT NULL DEFAULT 'exame_clinico',
  tipo_achado text NOT NULL,
  estrutura text,
  diagnostico_cid text,
  severidade smallint NOT NULL DEFAULT 1 CHECK (severidade BETWEEN 0 AND 4),
  status public.status_evento_anatomico NOT NULL DEFAULT 'ativo',
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_resolucao date,
  notas_clinicas text,
  visivel_paciente boolean NOT NULL DEFAULT false,
  evento_origem_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos_clinicos_anatomicos TO authenticated;
GRANT ALL ON public.eventos_clinicos_anatomicos TO service_role;

ALTER TABLE public.eventos_clinicos_anatomicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta gerencia eventos anatomicos dos seus pacientes"
  ON public.eventos_clinicos_anatomicos FOR ALL
  TO authenticated
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Paciente ve seus eventos visiveis"
  ON public.eventos_clinicos_anatomicos FOR SELECT
  TO authenticated
  USING (
    visivel_paciente = true
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = eventos_clinicos_anatomicos.paciente_id
        AND p.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_eca_paciente ON public.eventos_clinicos_anatomicos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_eca_regiao ON public.eventos_clinicos_anatomicos(paciente_id, regiao_id);
CREATE INDEX IF NOT EXISTS idx_eca_status ON public.eventos_clinicos_anatomicos(paciente_id, status);
CREATE INDEX IF NOT EXISTS idx_eca_sistema ON public.eventos_clinicos_anatomicos(paciente_id, sistema);

CREATE TRIGGER trg_eca_updated_at
  BEFORE UPDATE ON public.eventos_clinicos_anatomicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
