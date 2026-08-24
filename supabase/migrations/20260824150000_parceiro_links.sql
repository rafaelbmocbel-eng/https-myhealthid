-- Links read-only para parceiros de vendas: cada token abre uma página pública
-- com o RESUMO de negócio (faturamento, nº de clínicas/profissionais/alunos) —
-- SEM acesso ao app e SEM nenhum dado de paciente. Gerenciados pelo super-admin
-- via admin-metrics (service role); a leitura pública passa pela edge function
-- resumo-parceiro (também service role, retornando só agregados curados).
CREATE TABLE IF NOT EXISTS public.parceiro_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  label text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS parceiro_links_token_idx ON public.parceiro_links (token) WHERE ativo;

ALTER TABLE public.parceiro_links ENABLE ROW LEVEL SECURITY;

-- service_role (edge functions) ignora RLS. Política explícita só para o
-- super-admin — e evita que o Guardião de Segurança acuse "RLS sem policy".
DROP POLICY IF EXISTS "parceiro_links super admin" ON public.parceiro_links;
CREATE POLICY "parceiro_links super admin" ON public.parceiro_links
  FOR ALL
  USING (auth.jwt() ->> 'email' = 'rafaelbmocbel@gmail.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'rafaelbmocbel@gmail.com');
