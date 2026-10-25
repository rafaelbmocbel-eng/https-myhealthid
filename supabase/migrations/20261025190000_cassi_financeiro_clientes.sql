-- Controle CASSI > Faturamento: lista de clientes de cada mês.
-- O profissional adiciona à lista os clientes do mês e o cálculo financeiro (sessões, bruto, imposto, sua parte),
-- as guias que fecham e o relatório de produção passam a considerar só eles. Uma linha por mês e cliente;
-- só o profissional dono do cliente lê e grava. As fórmulas do cálculo não mudam.

CREATE TABLE IF NOT EXISTS public.cassi_financeiro_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL DEFAULT auth.uid(),
  mes text NOT NULL,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  -- 'AAAA-MM' com mês de 01 a 12: é a chave que a tela usa para escolher a lista.
  CONSTRAINT cassi_financeiro_clientes_mes_valido CHECK (mes ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  CONSTRAINT cassi_financeiro_clientes_unico UNIQUE (terapeuta_id, mes, paciente_id)
);

COMMENT ON TABLE public.cassi_financeiro_clientes IS
  'Controle CASSI > Faturamento: clientes que o profissional colocou na lista de um mês (mes = AAAA-MM). O cálculo financeiro do mês considera só eles.';

CREATE INDEX IF NOT EXISTS idx_cassi_financeiro_clientes_paciente
  ON public.cassi_financeiro_clientes (paciente_id);

ALTER TABLE public.cassi_financeiro_clientes ENABLE ROW LEVEL SECURITY;

-- No Supabase o papel authenticated já recebe todos os privilégios nas tabelas novas (inclusive TRUNCATE, que a
-- segurança por linha não alcança): tira tudo e concede só o que a tela usa.
REVOKE ALL ON public.cassi_financeiro_clientes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.cassi_financeiro_clientes TO authenticated;
GRANT ALL ON public.cassi_financeiro_clientes TO service_role;

DROP POLICY IF EXISTS "Profissional vê a lista do financeiro CASSI" ON public.cassi_financeiro_clientes;
CREATE POLICY "Profissional vê a lista do financeiro CASSI"
  ON public.cassi_financeiro_clientes FOR SELECT TO authenticated
  USING (auth.uid() = terapeuta_id);

-- Quem adiciona só pode apontar para cliente seu.
DROP POLICY IF EXISTS "Profissional adiciona cliente à lista do financeiro CASSI" ON public.cassi_financeiro_clientes;
CREATE POLICY "Profissional adiciona cliente à lista do financeiro CASSI"
  ON public.cassi_financeiro_clientes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = terapeuta_id
    AND EXISTS (SELECT 1 FROM public.pacientes p WHERE p.id = paciente_id AND p.terapeuta_id = auth.uid())
  );

DROP POLICY IF EXISTS "Profissional tira cliente da lista do financeiro CASSI" ON public.cassi_financeiro_clientes;
CREATE POLICY "Profissional tira cliente da lista do financeiro CASSI"
  ON public.cassi_financeiro_clientes FOR DELETE TO authenticated
  USING (auth.uid() = terapeuta_id);

NOTIFY pgrst, 'reload schema';
