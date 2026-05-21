
-- Convênios cadastrados pelo terapeuta/clínica
CREATE TABLE public.convenios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  nome text NOT NULL,
  valor_padrao numeric(10,2),
  prazo_repasse_dias integer DEFAULT 30,
  codigo_tuss text,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_convenios_terapeuta ON public.convenios(terapeuta_id) WHERE ativo;
ALTER TABLE public.convenios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Terapeuta gerencia seus convênios" ON public.convenios
  FOR ALL TO authenticated USING (terapeuta_id = auth.uid()) WITH CHECK (terapeuta_id = auth.uid());
CREATE TRIGGER trg_convenios_updated BEFORE UPDATE ON public.convenios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Configuração de repasse por profissional × convênio (NULL convenio_id = particular)
CREATE TABLE public.repasse_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,           -- dono da configuração (clínica)
  profissional_user_id uuid NOT NULL,   -- quem recebe o repasse
  convenio_id uuid REFERENCES public.convenios(id) ON DELETE CASCADE, -- NULL = particular
  percentual numeric(5,2) NOT NULL DEFAULT 60.00 CHECK (percentual >= 0 AND percentual <= 100),
  valor_fixo numeric(10,2), -- alternativa ao percentual
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(terapeuta_id, profissional_user_id, convenio_id)
);
CREATE INDEX idx_repasse_lookup ON public.repasse_config(terapeuta_id, profissional_user_id) WHERE ativo;
ALTER TABLE public.repasse_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Terapeuta gerencia repasses" ON public.repasse_config
  FOR ALL TO authenticated USING (terapeuta_id = auth.uid()) WITH CHECK (terapeuta_id = auth.uid());
CREATE POLICY "Profissional vê seu próprio repasse" ON public.repasse_config
  FOR SELECT TO authenticated USING (profissional_user_id = auth.uid());
CREATE TRIGGER trg_repasse_updated BEFORE UPDATE ON public.repasse_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vincular sessão a um convênio cadastrado (mantém plano_nome como fallback histórico)
ALTER TABLE public.controle_sessoes
  ADD COLUMN convenio_id uuid REFERENCES public.convenios(id) ON DELETE SET NULL;
CREATE INDEX idx_controle_sessoes_convenio ON public.controle_sessoes(convenio_id) WHERE convenio_id IS NOT NULL;
