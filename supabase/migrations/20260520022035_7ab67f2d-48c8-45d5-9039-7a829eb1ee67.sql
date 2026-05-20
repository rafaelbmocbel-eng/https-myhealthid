
-- 1. Plano Starter (R$67) — identificado por nome, ordem=0
INSERT INTO public.planos (nome, descricao, preco_mensal, modulos, limite_ia_mensal, destaque, ordem, ativo)
SELECT
  'Starter',
  'Para autônomos começando — agenda, pacientes e MyID com IA',
  67,
  '["agenda","pacientes","myid","portal_paciente"]'::jsonb,
  15,
  false,
  0,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.planos WHERE nome = 'Starter');

-- 2. meu_plano_atual aceita trial
CREATE OR REPLACE FUNCTION public.meu_plano_atual()
RETURNS TABLE(
  plano_id uuid, plano_nome text, modulos jsonb, preco_mensal numeric,
  limite_ia_mensal integer, uso_ia_atual integer, status text, data_fim timestamp with time zone
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT p.id, p.nome, p.modulos, p.preco_mensal, p.limite_ia_mensal,
    COALESCE((SELECT SUM(quantidade)::integer FROM public.uso_ia_mensal
      WHERE user_id = auth.uid() AND ano_mes = to_char(now(), 'YYYY-MM')), 0),
    a.status, a.data_fim
  FROM public.assinaturas a
  JOIN public.planos p ON p.id = a.plano_id
  WHERE a.user_id = auth.uid()
    AND a.status IN ('ativa', 'trial')
    AND (a.data_fim IS NULL OR a.data_fim > now())
  ORDER BY CASE WHEN a.status = 'ativa' THEN 0 ELSE 1 END, p.preco_mensal DESC
  LIMIT 1;
$$;

-- 3. Trial automático de 14 dias no plano Profissional para novos cadastros
CREATE OR REPLACE FUNCTION public.criar_trial_novo_usuario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_plano_id uuid;
BEGIN
  SELECT id INTO v_plano_id FROM public.planos
  WHERE nome = 'Profissional' AND ativo = true LIMIT 1;

  IF v_plano_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.assinaturas (user_id, plano_id, status, origem, data_inicio, data_fim)
  VALUES (NEW.id, v_plano_id, 'trial', 'trial_signup', now(), now() + interval '14 days')
  ON CONFLICT (user_id, plano_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_trial ON auth.users;
CREATE TRIGGER on_auth_user_created_trial
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.criar_trial_novo_usuario();
