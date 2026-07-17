-- Conta de teste "movimed" (cliente do Rafael) como Wellness Premium, para
-- testar TODAS as funcionalidades. Premium no app deriva de
-- pacientes.tipo_conta = 'wellness_premium' (ver get_wellness_status); também
-- criamos uma assinatura 'ativa' sem vencimento para não aparecer "inativa".
-- Idempotente e restrito: só afeta a(s) conta(s) cujo e-mail OU nome contém
-- "movimed". Se nenhuma casar, não faz nada (e avisa no log).
DO $$
DECLARE
  v_pac record;
  v_n int := 0;
BEGIN
  FOR v_pac IN
    SELECT pac.id
    FROM public.pacientes pac
    LEFT JOIN auth.users u ON u.id = pac.user_id
    WHERE u.email ILIKE '%movimed%'
       OR pac.nome ILIKE '%movimed%'
       OR pac.sobrenome ILIKE '%movimed%'
  LOOP
    v_n := v_n + 1;

    UPDATE public.pacientes
      SET tipo_conta = 'wellness_premium'
      WHERE id = v_pac.id;

    -- Assinatura ativa sem vencimento (provider 'manual' = concessão interna)
    IF EXISTS (SELECT 1 FROM public.wellness_assinaturas WHERE paciente_id = v_pac.id) THEN
      UPDATE public.wellness_assinaturas
        SET status = 'ativa', provider = 'manual', data_fim = NULL,
            proxima_cobranca = now() + interval '100 years', updated_at = now()
        WHERE paciente_id = v_pac.id;
    ELSE
      INSERT INTO public.wellness_assinaturas
        (paciente_id, status, provider, valor_mensal, data_inicio, data_fim, proxima_cobranca)
      VALUES
        (v_pac.id, 'ativa', 'manual', 0, now(), NULL, now() + interval '100 years');
    END IF;
  END LOOP;

  RAISE NOTICE 'movimed premium: % conta(s) atualizada(s)', v_n;
END $$;
