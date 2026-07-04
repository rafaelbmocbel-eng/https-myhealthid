-- Vitrine pública de terapeutas para o app do paciente (modelo marketplace)
-- Pacientes encontram terapeutas sem precisar de convite prévio.

-- 1) Colunas de perfil público em config_clinica
ALTER TABLE public.config_clinica
  ADD COLUMN IF NOT EXISTS vitrine_ativo         boolean   DEFAULT false,
  ADD COLUMN IF NOT EXISTS vitrine_nome_exibicao text,
  ADD COLUMN IF NOT EXISTS vitrine_bio           text,
  ADD COLUMN IF NOT EXISTS vitrine_especialidades text[]   DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vitrine_convenios     text[]    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vitrine_cidade        text,
  ADD COLUMN IF NOT EXISTS vitrine_valor_sessao  numeric,
  ADD COLUMN IF NOT EXISTS vitrine_foto_url      text;

-- 2) View pública — sem autenticação (anon pode ler)
CREATE OR REPLACE VIEW public.vitrine_terapeutas AS
SELECT
  c.terapeuta_id,
  COALESCE(c.vitrine_nome_exibicao, c.responsavel) AS nome_exibicao,
  c.vitrine_bio                                     AS bio,
  c.vitrine_especialidades                          AS especialidades,
  c.vitrine_convenios                               AS convenios,
  COALESCE(c.vitrine_cidade, c.cidade)              AS cidade,
  c.uf,
  c.vitrine_valor_sessao                            AS valor_sessao,
  COALESCE(c.vitrine_foto_url, c.logo_url)          AS foto_url
FROM public.config_clinica c
WHERE c.vitrine_ativo = true;

GRANT SELECT ON public.vitrine_terapeutas TO anon, authenticated;

-- 3) Tabela de solicitações de conexão (paciente → terapeuta)
CREATE TABLE IF NOT EXISTS public.solicitacoes_conexao (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_user_id uuid       NOT NULL,
  terapeuta_id    uuid        NOT NULL,
  status          text        NOT NULL DEFAULT 'pendente'
                              CHECK (status IN ('pendente', 'aceita', 'recusada')),
  mensagem        text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.solicitacoes_conexao ENABLE ROW LEVEL SECURITY;

-- Paciente: cria e vê apenas as suas
CREATE POLICY "paciente_own_solicitacoes"
  ON public.solicitacoes_conexao
  FOR ALL
  TO authenticated
  USING  (paciente_user_id = auth.uid())
  WITH CHECK (paciente_user_id = auth.uid());

-- Terapeuta: vê e atualiza solicitações destinadas a si
CREATE POLICY "terapeuta_read_solicitacoes"
  ON public.solicitacoes_conexao
  FOR SELECT
  TO authenticated
  USING (terapeuta_id = auth.uid());

CREATE POLICY "terapeuta_update_solicitacoes"
  ON public.solicitacoes_conexao
  FOR UPDATE
  TO authenticated
  USING  (terapeuta_id = auth.uid())
  WITH CHECK (terapeuta_id = auth.uid());
