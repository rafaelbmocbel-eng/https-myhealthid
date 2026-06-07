
-- ===== Antropometria =====
CREATE TABLE IF NOT EXISTS public.antropometria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  data_medicao date NOT NULL DEFAULT CURRENT_DATE,
  peso_kg numeric(5,2),
  altura_cm numeric(5,2),
  imc numeric(5,2) GENERATED ALWAYS AS (
    CASE WHEN altura_cm > 0 AND peso_kg > 0 THEN ROUND((peso_kg / ((altura_cm/100.0) * (altura_cm/100.0)))::numeric, 2) ELSE NULL END
  ) STORED,
  cintura_cm numeric(5,2),
  quadril_cm numeric(5,2),
  braco_cm numeric(5,2),
  coxa_cm numeric(5,2),
  panturrilha_cm numeric(5,2),
  pescoco_cm numeric(5,2),
  gordura_pct numeric(4,1),
  massa_magra_kg numeric(5,2),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.antropometria TO authenticated;
GRANT ALL ON public.antropometria TO service_role;
ALTER TABLE public.antropometria ENABLE ROW LEVEL SECURITY;
CREATE POLICY antro_own ON public.antropometria FOR ALL TO authenticated
  USING (terapeuta_id = auth.uid()) WITH CHECK (terapeuta_id = auth.uid());
CREATE INDEX antro_pac_idx ON public.antropometria (paciente_id, data_medicao DESC);
CREATE TRIGGER trg_antro_updated BEFORE UPDATE ON public.antropometria FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Testes funcionais =====
CREATE TABLE IF NOT EXISTS public.testes_funcionais_paciente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  data_teste date NOT NULL DEFAULT CURRENT_DATE,
  tipo_teste text NOT NULL, -- sentar_levantar_30s, flexao_braco, cooper_12min, sit_and_reach, equilibrio_unipodal, fms_deep_squat, etc.
  resultado numeric(8,2),
  unidade text, -- reps, metros, segundos, cm, score
  classificacao text, -- excelente, bom, regular, fraco
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.testes_funcionais_paciente TO authenticated;
GRANT ALL ON public.testes_funcionais_paciente TO service_role;
ALTER TABLE public.testes_funcionais_paciente ENABLE ROW LEVEL SECURITY;
CREATE POLICY testes_own ON public.testes_funcionais_paciente FOR ALL TO authenticated
  USING (terapeuta_id = auth.uid()) WITH CHECK (terapeuta_id = auth.uid());
CREATE INDEX testes_pac_idx ON public.testes_funcionais_paciente (paciente_id, data_teste DESC);
CREATE TRIGGER trg_testes_updated BEFORE UPDATE ON public.testes_funcionais_paciente FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Planos de Treino =====
CREATE TABLE IF NOT EXISTS public.planos_treino (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  titulo text NOT NULL,
  objetivo text, -- hipertrofia, emagrecimento, performance, saude, reabilitacao
  nivel text, -- iniciante, intermediario, avancado
  frequencia_semanal int,
  duracao_semanas int,
  restricoes text,
  estrutura jsonb NOT NULL DEFAULT '{}'::jsonb, -- { fases: [{nome, semanas, sessoes:[{nome, exercicios:[{nome, series, reps, carga, descanso, obs}]}]}] }
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planos_treino TO authenticated;
GRANT ALL ON public.planos_treino TO service_role;
ALTER TABLE public.planos_treino ENABLE ROW LEVEL SECURITY;
CREATE POLICY planos_treino_own ON public.planos_treino FOR ALL TO authenticated
  USING (terapeuta_id = auth.uid()) WITH CHECK (terapeuta_id = auth.uid());
CREATE INDEX planos_treino_pac_idx ON public.planos_treino (paciente_id, created_at DESC);
CREATE TRIGGER trg_planos_treino_updated BEFORE UPDATE ON public.planos_treino FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Blocos: garantir presença em educador_fisico e nutricionista =====
UPDATE public.perfis_profissionais
SET blocos_ativos = blocos_ativos
  || (CASE WHEN blocos_ativos ? 'antropometria' THEN '[]'::jsonb ELSE '["antropometria"]'::jsonb END)
  || (CASE WHEN blocos_ativos ? 'plano_treino' THEN '[]'::jsonb ELSE '["plano_treino"]'::jsonb END)
WHERE id = 'educador_fisico';

UPDATE public.perfis_profissionais
SET blocos_ativos = blocos_ativos
  || (CASE WHEN blocos_ativos ? 'antropometria' THEN '[]'::jsonb ELSE '["antropometria"]'::jsonb END)
WHERE id = 'nutricionista';
