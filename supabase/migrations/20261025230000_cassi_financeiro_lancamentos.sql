-- Faturamento CASSI: o valor do mês passa a sair do que o profissional lança em cada cliente da lista do mês
-- (códigos usados e quantidade de cada um), e não mais da contagem da agenda.
-- Formato: lista de guias; cada guia é um objeto { "código": quantidade }. Ex.: [{"012":10,"144":1},{"012":4,"301":2}].
-- Só o profissional dono grava, e só esta coluna: mês e cliente da linha não mudam.

-- Valida o formato no banco para qualquer cliente (tela, SQL): até 12 guias; cada guia é um objeto cujos valores são
-- números inteiros de 0 a 999 e cujas chaves têm até 12 caracteres. Devolve false (e não NULL) para entrada nula,
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
        ELSE EXISTS (
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

NOTIFY pgrst, 'reload schema';
