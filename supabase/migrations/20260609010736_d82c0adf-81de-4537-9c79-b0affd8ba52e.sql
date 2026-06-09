-- TISS ANS module: configuration, guides, procedures, batches

CREATE TABLE public.tiss_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL UNIQUE,
  versao_tiss text NOT NULL DEFAULT '4.01.00',
  registro_ans text,
  cnes text,
  cnpj_prestador text,
  cpf_prestador text,
  nome_prestador text,
  codigo_prestador_operadora text,
  tipo_prestador text,
  endereco jsonb DEFAULT '{}'::jsonb,
  contato jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tiss_config TO authenticated;
GRANT ALL ON public.tiss_config TO service_role;
ALTER TABLE public.tiss_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tiss_config own" ON public.tiss_config FOR ALL TO authenticated
  USING (terapeuta_id = auth.uid()) WITH CHECK (terapeuta_id = auth.uid());

CREATE TABLE public.tiss_guias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  convenio_id uuid REFERENCES public.convenios(id) ON DELETE SET NULL,
  sessao_id uuid REFERENCES public.controle_sessoes(id) ON DELETE SET NULL,
  tipo_guia text NOT NULL DEFAULT 'consulta', -- consulta | sp_sadt | honorario | resumo
  numero_guia_prestador text,
  numero_guia_operadora text,
  senha_autorizacao text,
  data_autorizacao date,
  data_validade_senha date,
  numero_carteira text,
  nome_beneficiario text,
  data_atendimento date NOT NULL DEFAULT CURRENT_DATE,
  tipo_consulta text, -- 1 primeira | 2 retorno | 3 pre-natal | 4 por encaminhamento
  indicacao_acidente text DEFAULT '9', -- 0 trabalho | 1 transito | 2 outros | 9 nao acidente
  carater_atendimento text DEFAULT '1', -- 1 eletivo | 2 urgencia
  observacoes text,
  valor_total numeric(12,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'rascunho', -- rascunho | gerada | em_lote | enviada | paga | glosada | cancelada
  lote_id uuid,
  xml_gerado text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tiss_guias TO authenticated;
GRANT ALL ON public.tiss_guias TO service_role;
ALTER TABLE public.tiss_guias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tiss_guias own" ON public.tiss_guias FOR ALL TO authenticated
  USING (terapeuta_id = auth.uid()) WITH CHECK (terapeuta_id = auth.uid());
CREATE INDEX idx_tiss_guias_terapeuta ON public.tiss_guias(terapeuta_id, status);
CREATE INDEX idx_tiss_guias_lote ON public.tiss_guias(lote_id);

CREATE TABLE public.tiss_guia_procedimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guia_id uuid NOT NULL REFERENCES public.tiss_guias(id) ON DELETE CASCADE,
  sequencia int NOT NULL DEFAULT 1,
  data_execucao date NOT NULL DEFAULT CURRENT_DATE,
  hora_inicial text,
  hora_final text,
  codigo_tabela text NOT NULL DEFAULT '22', -- 22 TUSS procedimentos/eventos
  codigo_procedimento text NOT NULL,
  descricao text NOT NULL,
  quantidade numeric(8,2) NOT NULL DEFAULT 1,
  via_acesso text, -- U unica | M multipla
  tecnica_utilizada text, -- 1 convencional | 2 videolaparoscopia | 3 robotica
  reducao_acrescimo numeric(5,2) DEFAULT 1.00,
  valor_unitario numeric(12,2) NOT NULL DEFAULT 0,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tiss_guia_procedimentos TO authenticated;
GRANT ALL ON public.tiss_guia_procedimentos TO service_role;
ALTER TABLE public.tiss_guia_procedimentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tiss_proc via guia" ON public.tiss_guia_procedimentos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tiss_guias g WHERE g.id = guia_id AND g.terapeuta_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tiss_guias g WHERE g.id = guia_id AND g.terapeuta_id = auth.uid()));

CREATE TABLE public.tiss_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  convenio_id uuid REFERENCES public.convenios(id) ON DELETE SET NULL,
  numero_lote text NOT NULL,
  competencia text NOT NULL, -- YYYY-MM
  data_envio date,
  qtd_guias int NOT NULL DEFAULT 0,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'aberto', -- aberto | fechado | enviado | recebido | glosado
  xml_gerado text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tiss_lotes TO authenticated;
GRANT ALL ON public.tiss_lotes TO service_role;
ALTER TABLE public.tiss_lotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tiss_lotes own" ON public.tiss_lotes FOR ALL TO authenticated
  USING (terapeuta_id = auth.uid()) WITH CHECK (terapeuta_id = auth.uid());
CREATE INDEX idx_tiss_lotes_terapeuta ON public.tiss_lotes(terapeuta_id, competencia);

CREATE TABLE public.tiss_tuss_codigos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  convenio_id uuid REFERENCES public.convenios(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  descricao text NOT NULL,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (terapeuta_id, convenio_id, codigo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tiss_tuss_codigos TO authenticated;
GRANT ALL ON public.tiss_tuss_codigos TO service_role;
ALTER TABLE public.tiss_tuss_codigos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tiss_tuss own" ON public.tiss_tuss_codigos FOR ALL TO authenticated
  USING (terapeuta_id = auth.uid()) WITH CHECK (terapeuta_id = auth.uid());

CREATE TRIGGER tiss_config_updated BEFORE UPDATE ON public.tiss_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tiss_guias_updated BEFORE UPDATE ON public.tiss_guias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tiss_lotes_updated BEFORE UPDATE ON public.tiss_lotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tiss_tuss_updated BEFORE UPDATE ON public.tiss_tuss_codigos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();