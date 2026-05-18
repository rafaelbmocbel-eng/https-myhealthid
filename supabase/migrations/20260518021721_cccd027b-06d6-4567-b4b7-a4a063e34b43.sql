CREATE OR REPLACE FUNCTION public._security_test_pagamentos()
RETURNS TABLE(caso text, resultado text, detalhe text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_user uuid;
  v_terapeuta uuid;
  v_pac uuid;
  v_pag uuid;
BEGIN
  -- Pega um paciente real com user_id e um terapeuta real
  SELECT p.user_id, p.terapeuta_id, p.id
    INTO v_paciente_user, v_terapeuta, v_pac
  FROM public.pacientes p
  WHERE p.user_id IS NOT NULL AND p.terapeuta_id IS NOT NULL
  LIMIT 1;

  IF v_paciente_user IS NULL THEN
    RETURN QUERY SELECT 'setup'::text, 'SKIP'::text, 'sem paciente válido'::text;
    RETURN;
  END IF;

  -- Cria pagamento fictício como SECURITY DEFINER (bypass RLS)
  INSERT INTO public.pagamentos_paciente
    (paciente_id, terapeuta_id, descricao, valor, status, forma_pagamento)
  VALUES (v_pac, v_terapeuta, '__sec_test__', 100, 'pendente', 'pix')
  RETURNING id INTO v_pag;

  --------------------------------------------------------------------
  -- Simula paciente logado
  --------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_paciente_user::text, 'role','authenticated')::text, true);

  -- T1: comprovante_url (deve passar)
  BEGIN
    UPDATE public.pagamentos_paciente SET comprovante_url='https://x/y.png' WHERE id=v_pag;
    RETURN QUERY SELECT 'T1 paciente: comprovante_url'::text, 'PASS'::text, 'permitido (esperado)'::text;
  EXCEPTION WHEN others THEN
    RETURN QUERY SELECT 'T1 paciente: comprovante_url'::text, 'FAIL'::text, SQLERRM;
  END;

  -- T2: status (deve bloquear)
  BEGIN
    UPDATE public.pagamentos_paciente SET status='pago' WHERE id=v_pag;
    RETURN QUERY SELECT 'T2 paciente: status'::text, 'FAIL'::text, 'foi permitido!'::text;
  EXCEPTION WHEN others THEN
    RETURN QUERY SELECT 'T2 paciente: status'::text, 'PASS'::text, 'bloqueado: '||SQLERRM;
  END;

  -- T3: valor (deve bloquear)
  BEGIN
    UPDATE public.pagamentos_paciente SET valor=1 WHERE id=v_pag;
    RETURN QUERY SELECT 'T3 paciente: valor'::text, 'FAIL'::text, 'foi permitido!'::text;
  EXCEPTION WHEN others THEN
    RETURN QUERY SELECT 'T3 paciente: valor'::text, 'PASS'::text, 'bloqueado: '||SQLERRM;
  END;

  -- T4: terapeuta_id (deve bloquear)
  BEGIN
    UPDATE public.pagamentos_paciente SET terapeuta_id=gen_random_uuid() WHERE id=v_pag;
    RETURN QUERY SELECT 'T4 paciente: terapeuta_id'::text, 'FAIL'::text, 'foi permitido!'::text;
  EXCEPTION WHEN others THEN
    RETURN QUERY SELECT 'T4 paciente: terapeuta_id'::text, 'PASS'::text, 'bloqueado: '||SQLERRM;
  END;

  -- T5: forma_pagamento (deve bloquear)
  BEGIN
    UPDATE public.pagamentos_paciente SET forma_pagamento='cartao' WHERE id=v_pag;
    RETURN QUERY SELECT 'T5 paciente: forma_pagamento'::text, 'FAIL'::text, 'foi permitido!'::text;
  EXCEPTION WHEN others THEN
    RETURN QUERY SELECT 'T5 paciente: forma_pagamento'::text, 'PASS'::text, 'bloqueado: '||SQLERRM;
  END;

  -- T6: descricao+observacoes (deve bloquear)
  BEGIN
    UPDATE public.pagamentos_paciente SET descricao='hack', observacoes='x' WHERE id=v_pag;
    RETURN QUERY SELECT 'T6 paciente: descricao/observacoes'::text, 'FAIL'::text, 'foi permitido!'::text;
  EXCEPTION WHEN others THEN
    RETURN QUERY SELECT 'T6 paciente: descricao/observacoes'::text, 'PASS'::text, 'bloqueado: '||SQLERRM;
  END;

  --------------------------------------------------------------------
  -- Simula terapeuta logado
  --------------------------------------------------------------------
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_terapeuta::text, 'role','authenticated')::text, true);

  -- T7: terapeuta altera status+valor (deve passar)
  BEGIN
    UPDATE public.pagamentos_paciente SET status='pago', valor=200 WHERE id=v_pag;
    RETURN QUERY SELECT 'T7 terapeuta: status+valor'::text, 'PASS'::text, 'permitido (esperado)'::text;
  EXCEPTION WHEN others THEN
    RETURN QUERY SELECT 'T7 terapeuta: status+valor'::text, 'FAIL'::text, SQLERRM;
  END;

  -- Limpa o pagamento fictício
  DELETE FROM public.pagamentos_paciente WHERE id=v_pag;
END;
$$;