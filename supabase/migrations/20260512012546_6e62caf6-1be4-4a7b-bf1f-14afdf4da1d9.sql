
-- 1) Adicionar campo de limite mensal de IA em planos
ALTER TABLE public.planos 
  ADD COLUMN IF NOT EXISTS limite_ia_mensal integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS destaque boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

-- 2) Desativar planos antigos (mantém histórico, esconde da página de preços)
UPDATE public.planos SET ativo = false 
  WHERE nome IN ('Básico', 'Identidade', 'COB° ZERO', 'Studio', 'Completo');

-- 3) Inserir novos planos alinhados com MyID v2.0
INSERT INTO public.planos (nome, descricao, modulos, preco_mensal, limite_ia_mensal, destaque, ordem, ativo)
VALUES 
  ('Essencial', 'Para profissionais que querem o essencial para atender bem',
   '["agenda","pacientes","myid","portal_paciente","eventos","prontuario"]'::jsonb,
   147, 30, false, 1, true),
  ('Profissional', 'Tudo do Essencial + CRM completo para vender e reter mais',
   '["agenda","pacientes","myid","portal_paciente","eventos","prontuario","crm","funil_vendas","pacotes_sessoes","financeiro_avancado","relatorios"]'::jsonb,
   247, 100, true, 2, true),
  ('Clínica', 'Multi-profissional com painel do dono e gestão de comissões (preço por profissional, mín. 2)',
   '["agenda","pacientes","myid","portal_paciente","eventos","prontuario","crm","funil_vendas","pacotes_sessoes","financeiro_avancado","relatorios","multi_profissional","painel_dono","comissoes"]'::jsonb,
   197, 100, false, 3, true);

-- 4) Tabela de contagem mensal de uso de IA
CREATE TABLE IF NOT EXISTS public.uso_ia_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ano_mes text NOT NULL, -- formato 'YYYY-MM'
  tipo text NOT NULL DEFAULT 'myid_analise', -- myid_analise, relatorio_narrativo, voz, chat_ia
  quantidade integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, ano_mes, tipo)
);

ALTER TABLE public.uso_ia_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario le proprio uso IA"
  ON public.uso_ia_mensal FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_uso_ia_mensal
  BEFORE UPDATE ON public.uso_ia_mensal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Função para incrementar uso de IA (chamada pelas Edge Functions)
CREATE OR REPLACE FUNCTION public.incrementar_uso_ia(
  p_user_id uuid,
  p_tipo text DEFAULT 'myid_analise'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano_mes text := to_char(now(), 'YYYY-MM');
  v_total integer;
BEGIN
  INSERT INTO public.uso_ia_mensal (user_id, ano_mes, tipo, quantidade)
  VALUES (p_user_id, v_ano_mes, p_tipo, 1)
  ON CONFLICT (user_id, ano_mes, tipo)
  DO UPDATE SET quantidade = uso_ia_mensal.quantidade + 1, updated_at = now()
  RETURNING quantidade INTO v_total;
  RETURN v_total;
END;
$$;

-- 6) Função para retornar plano + uso atual do usuário (consumida pelo hook)
CREATE OR REPLACE FUNCTION public.meu_plano_atual()
RETURNS TABLE (
  plano_id uuid,
  plano_nome text,
  modulos jsonb,
  preco_mensal numeric,
  limite_ia_mensal integer,
  uso_ia_atual integer,
  status text,
  data_fim timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.nome,
    p.modulos,
    p.preco_mensal,
    p.limite_ia_mensal,
    COALESCE((
      SELECT SUM(quantidade)::integer FROM public.uso_ia_mensal
      WHERE user_id = auth.uid() AND ano_mes = to_char(now(), 'YYYY-MM')
    ), 0) AS uso_ia_atual,
    a.status,
    a.data_fim
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.user_id = auth.uid()
    AND a.status = 'ativa'
    AND (a.data_fim IS NULL OR a.data_fim > now())
  ORDER BY p.preco_mensal DESC
  LIMIT 1;
$$;
