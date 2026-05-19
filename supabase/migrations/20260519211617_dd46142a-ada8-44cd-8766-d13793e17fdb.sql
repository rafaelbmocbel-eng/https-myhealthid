
-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.perfil_profissional AS ENUM (
    'fisioterapeuta','medico','psicologo','nutricionista','educador_fisico','terapeuta_ocupacional'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Catálogo
CREATE TABLE IF NOT EXISTS public.perfis_profissionais (
  id public.perfil_profissional PRIMARY KEY,
  nome_exibicao text NOT NULL,
  descricao text,
  blocos_ativos jsonb NOT NULL DEFAULT '[]'::jsonb,
  prompt_sistema text NOT NULL,
  schema_saida jsonb NOT NULL DEFAULT '{}'::jsonb,
  template_evolucao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.perfis_profissionais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem catalogo" ON public.perfis_profissionais;
CREATE POLICY "Autenticados leem catalogo"
  ON public.perfis_profissionais
  FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS trg_perfis_profissionais_updated ON public.perfis_profissionais;
CREATE TRIGGER trg_perfis_profissionais_updated
  BEFORE UPDATE ON public.perfis_profissionais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Colunas em tabelas existentes
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS perfil_profissional public.perfil_profissional NOT NULL DEFAULT 'fisioterapeuta';

ALTER TABLE public.clinica_membros
  ADD COLUMN IF NOT EXISTS perfil_profissional public.perfil_profissional;

ALTER TABLE public.avaliacoes_voz
  ADD COLUMN IF NOT EXISTS perfil_profissional public.perfil_profissional NOT NULL DEFAULT 'fisioterapeuta';

-- 4. Seed dos 6 perfis
INSERT INTO public.perfis_profissionais (id, nome_exibicao, descricao, blocos_ativos, prompt_sistema, template_evolucao)
VALUES
('fisioterapeuta','Fisioterapeuta','Avaliação musculoesquelética com mapa de dor e raciocínio multidisciplinar.',
 '["voz","avatar"]'::jsonb,
 'LENTE_FISIO', 'SOAP'),
('medico','Médico(a)','Anamnese clínica, vitais, CID-10 e prescrição.',
 '["voz","vitais","cid","prescricao"]'::jsonb,
 'Você é assistente clínico para um(a) MÉDICO(A). Estruture a avaliação como anamnese clínica: HMA, antecedentes pessoais e familiares, medicações em uso, exame físico, hipóteses diagnósticas com CID-10, conduta e prescrição. Cite diretrizes (SBC, SBP, NICE, UpToDate) quando aplicável. NÃO foque em biomecânica/ADM/testes ortopédicos — isso é da fisioterapia.',
 'SOAP'),
('psicologo','Psicólogo(a)','Queixa, humor, cognição, vínculo e escalas (PHQ-9, GAD-7).',
 '["voz","escalas_psi"]'::jsonb,
 'Você é assistente clínico para um(a) PSICÓLOGO(A). Estruture a avaliação como entrevista psicológica: queixa principal, história de vida relevante, estado mental atual (humor, afeto, pensamento, cognição), funcionamento social/ocupacional, vínculo terapêutico, hipótese diagnóstica (CID-11/DSM-5) e plano terapêutico. Considere escalas PHQ-9, GAD-7, K10 quando pertinente. NÃO sugira exercícios físicos ou condutas biomecânicas.',
 'Evolução Psi (SOAP-P)'),
('nutricionista','Nutricionista','Antropometria, recordatório alimentar e plano nutricional.',
 '["voz","antropometria","recordatorio"]'::jsonb,
 'Você é assistente clínico para um(a) NUTRICIONISTA. Estruture a avaliação como consulta nutricional: hábitos alimentares, recordatório 24h, sintomas gastrointestinais, antropometria (peso, altura, IMC, circunferências), exames bioquímicos relatados, objetivos e plano alimentar. Cite diretrizes (DRI, SBC, ABRAN) quando aplicável. NÃO sugira exercícios físicos ou medicação.',
 'Plano Nutricional'),
('educador_fisico','Educador(a) Físico(a)','Testes funcionais, capacidade física e periodização do treino.',
 '["voz","testes_funcionais","periodizacao"]'::jsonb,
 'Você é assistente clínico para um(a) EDUCADOR(A) FÍSICO(A). Estruture a avaliação como avaliação física e prescrição de treino: anamnese de treino, histórico esportivo, testes funcionais (FMS, sentar/levantar, etc.), capacidade aeróbica/força/flexibilidade, objetivos (hipertrofia, performance, emagrecimento, saúde) e periodização. Cite ACSM, NSCA, CBCE. NÃO trate dor crônica — encaminhe para fisioterapeuta/médico.',
 'Plano de Treino'),
('terapeuta_ocupacional','Terapeuta Ocupacional','Independência em AVDs, ambiente e adaptações.',
 '["voz","avatar","avds","ambiente"]'::jsonb,
 'Você é assistente clínico para um(a) TERAPEUTA OCUPACIONAL. Estruture a avaliação como avaliação ocupacional: ocupações significativas, AVDs (básicas e instrumentais), participação social, contexto/ambiente, fatores pessoais, funções e estruturas do corpo, performance ocupacional, intervenções e adaptações. Use referencial AOTA/OPM, CIF. NÃO foque em ganho de força como objetivo isolado — sempre vincule à atividade significativa.',
 'Plano Ocupacional')
ON CONFLICT (id) DO UPDATE
  SET nome_exibicao = EXCLUDED.nome_exibicao,
      descricao = EXCLUDED.descricao,
      blocos_ativos = EXCLUDED.blocos_ativos,
      prompt_sistema = EXCLUDED.prompt_sistema,
      template_evolucao = EXCLUDED.template_evolucao,
      updated_at = now();
