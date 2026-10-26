-- Faturamento CASSI: o valor do mês passa a sair do que o profissional lança em cada cliente da lista do mês
-- (códigos usados e quantidade de cada um), e não mais da contagem da agenda.
-- Formato: lista de guias; cada guia é um objeto { "código": quantidade }. Ex.: [{"012":10,"144":1},{"012":4,"301":2}].
-- Só o profissional dono grava, e só esta coluna: mês e cliente da linha não mudam.

-- Valida o formato no banco para qualquer cliente (tela, SQL): até 12 guias; cada guia é um objeto de até 30 códigos
-- cujos valores são números inteiros de 0 a 999 e cujas chaves têm até 12 caracteres. Devolve false (e não NULL) para entrada nula,
-- porque um CHECK trata NULL como aprovado. Os limites por código (10 por guia etc.) ficam na tela: a tabela de
-- códigos é do profissional e pode mudar.
CREATE OR REPLACE FUNCTION public.cassi_lancamentos_validos(p jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p IS NULL OR jsonb_typeof(p) <> 'array' OR jsonb_array_length(p) > 12 THEN false
    ELSE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p) AS g(v)
      WHERE CASE
        WHEN jsonb_typeof(g.v) <> 'object' THEN true
        ELSE (SELECT count(*) FROM jsonb_each(g.v)) > 30
          OR EXISTS (
            SELECT 1 FROM jsonb_each(g.v) AS kv(chave, valor)
            WHERE jsonb_typeof(kv.valor) <> 'number'
               OR kv.valor::text !~ '^[0-9]{1,3}$'
               OR length(kv.chave) NOT BETWEEN 1 AND 12
          )
      END
    )
  END;
$$;

ALTER TABLE public.cassi_financeiro_clientes
  ADD COLUMN IF NOT EXISTS lancamentos jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.cassi_financeiro_clientes.lancamentos IS
  'Faturamento CASSI: guias lançadas no mês para este cliente, [{"código": quantidade}]. O valor do mês = quantidade × valor do código.';

ALTER TABLE public.cassi_financeiro_clientes
  DROP CONSTRAINT IF EXISTS cassi_financeiro_clientes_lancamentos_validos;
ALTER TABLE public.cassi_financeiro_clientes
  ADD CONSTRAINT cassi_financeiro_clientes_lancamentos_validos CHECK (public.cassi_lancamentos_validos(lancamentos));

-- Atualizar é só o lançamento (privilégio por coluna): mês, cliente e profissional da linha não se alteram.
GRANT UPDATE (lancamentos) ON public.cassi_financeiro_clientes TO authenticated;

DROP POLICY IF EXISTS "Profissional lança no cliente da lista do financeiro CASSI" ON public.cassi_financeiro_clientes;
CREATE POLICY "Profissional lança no cliente da lista do financeiro CASSI"
  ON public.cassi_financeiro_clientes FOR UPDATE TO authenticated
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);

-- Juntar dois cadastros do mesmo cliente: leva as linhas do Faturamento do duplicado para o cliente que fica, numa
-- única transação. No mês em que o cliente que fica ainda não estava, a linha é copiada; no mês em que os dois estavam,
-- as guias do duplicado entram depois das dele. Se a soma passar de 6 guias (o que a tela mostra) nada é feito, e uma
-- falha no meio desfaz tudo: tentar de novo nunca soma duas vezes. Roda com os direitos de quem chama (a segurança por
-- linha vale), então só mexe nas linhas do próprio profissional.
CREATE OR REPLACE FUNCTION public.cassi_juntar_financeiro_clientes(p_origem uuid, p_destino uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  c_max_guias CONSTANT integer := 6;
  v_uid uuid := auth.uid();
  r record;
  v_alvo jsonb;
  v_novo jsonb;
  v_meses integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sem sessão';
  END IF;
  IF p_origem IS NULL OR p_destino IS NULL OR p_origem = p_destino THEN
    RAISE EXCEPTION 'Escolha dois cadastros diferentes para juntar';
  END IF;

  FOR r IN
    SELECT mes, lancamentos
    FROM public.cassi_financeiro_clientes
    WHERE terapeuta_id = v_uid AND paciente_id = p_origem
    ORDER BY mes
    FOR UPDATE
  LOOP
    v_alvo := NULL;
    SELECT lancamentos INTO v_alvo
    FROM public.cassi_financeiro_clientes
    WHERE terapeuta_id = v_uid AND paciente_id = p_destino AND mes = r.mes
    FOR UPDATE;

    -- Guias vazias não contam (a tela também as descarta).
    SELECT coalesce(jsonb_agg(g.v ORDER BY g.ord), '[]'::jsonb) INTO v_novo
    FROM jsonb_array_elements(coalesce(v_alvo, '[]'::jsonb) || r.lancamentos) WITH ORDINALITY AS g(v, ord)
    WHERE g.v <> '{}'::jsonb;

    IF jsonb_array_length(v_novo) > c_max_guias THEN
      RAISE EXCEPTION 'O cliente ficaria com % guias em % (o máximo é %). Ajuste os lançamentos antes de juntar.',
        jsonb_array_length(v_novo), r.mes, c_max_guias;
    END IF;

    IF v_alvo IS NULL THEN
      INSERT INTO public.cassi_financeiro_clientes (terapeuta_id, mes, paciente_id, lancamentos)
      VALUES (v_uid, r.mes, p_destino, v_novo);
    ELSE
      UPDATE public.cassi_financeiro_clientes SET lancamentos = v_novo
      WHERE terapeuta_id = v_uid AND paciente_id = p_destino AND mes = r.mes;
    END IF;
    v_meses := v_meses + 1;
  END LOOP;

  DELETE FROM public.cassi_financeiro_clientes WHERE terapeuta_id = v_uid AND paciente_id = p_origem;
  RETURN v_meses;
END;
$$;

REVOKE ALL ON FUNCTION public.cassi_juntar_financeiro_clientes(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cassi_juntar_financeiro_clientes(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
