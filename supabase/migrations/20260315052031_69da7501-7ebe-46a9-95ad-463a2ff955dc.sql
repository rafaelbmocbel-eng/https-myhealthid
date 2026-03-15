
-- Tabela de planos disponíveis
CREATE TABLE public.planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  modulos jsonb NOT NULL DEFAULT '[]'::jsonb,
  preco_mensal numeric NOT NULL DEFAULT 0,
  stripe_price_id text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela de assinaturas (link profissional <-> plano)
CREATE TABLE public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plano_id uuid NOT NULL REFERENCES public.planos(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ativa',
  origem text NOT NULL DEFAULT 'manual',
  stripe_subscription_id text,
  data_inicio timestamptz NOT NULL DEFAULT now(),
  data_fim timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, plano_id)
);

-- RLS
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

-- Todos leem planos ativos
CREATE POLICY "Todos leem planos ativos" ON public.planos
  FOR SELECT TO public
  USING (ativo = true);

-- Profissionais leem suas assinaturas
CREATE POLICY "Usuarios leem suas assinaturas" ON public.assinaturas
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Função security definer para checar módulo
CREATE OR REPLACE FUNCTION public.has_module_access(p_user_id uuid, p_module text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assinaturas a
    JOIN public.planos p ON p.id = a.plano_id
    WHERE a.user_id = p_user_id
      AND a.status = 'ativa'
      AND (a.data_fim IS NULL OR a.data_fim > now())
      AND p.modulos ? p_module
  );
$$;

-- Trigger updated_at
CREATE TRIGGER set_updated_at_planos BEFORE UPDATE ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_assinaturas BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: planos iniciais
INSERT INTO public.planos (nome, descricao, modulos, preco_mensal) VALUES
  ('Básico', 'Agenda + Pacientes', '["agenda", "pacientes"]'::jsonb, 0),
  ('Identidade', 'Método Identidade completo', '["agenda", "pacientes", "metodo_identidade"]'::jsonb, 97),
  ('COB° ZERO', 'Escoliose integrada', '["agenda", "pacientes", "cob_zero"]'::jsonb, 97),
  ('Studio', 'Studio Personal ID', '["agenda", "pacientes", "studio"]'::jsonb, 97),
  ('Completo', 'Todos os módulos', '["agenda", "pacientes", "metodo_identidade", "cob_zero", "studio", "crm", "relatorios"]'::jsonb, 197);
