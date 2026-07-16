-- Assinatura permanente do FUNDADOR: a vitrine só lista profissionais com
-- assinatura ativa/trial (gate de 20260705130000). O trial de 14 dias do dono
-- da plataforma venceu e ele sumiu do marketplace. Esta migração garante uma
-- assinatura 'ativa' sem vencimento para a conta fundadora — idempotente.
DO $$
DECLARE
  v_user uuid;
  v_plano uuid;
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE email = 'rafaelbmocbel@gmail.com' LIMIT 1;
  IF v_user IS NULL THEN RETURN; END IF;

  SELECT id INTO v_plano FROM public.planos WHERE nome = 'Profissional' AND ativo = true LIMIT 1;
  IF v_plano IS NULL THEN
    SELECT id INTO v_plano FROM public.planos ORDER BY created_at LIMIT 1;
  END IF;
  IF v_plano IS NULL THEN RETURN; END IF;

  INSERT INTO public.assinaturas (user_id, plano_id, status, origem, data_inicio, data_fim)
  VALUES (v_user, v_plano, 'ativa', 'fundador', now(), NULL)
  ON CONFLICT (user_id, plano_id) DO UPDATE
    SET status = 'ativa', origem = 'fundador', data_fim = NULL, updated_at = now();
END $$;
