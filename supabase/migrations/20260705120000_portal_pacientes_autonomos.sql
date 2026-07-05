-- Tabela para pacientes que se cadastram diretamente (sem convite de terapeuta)
CREATE TABLE IF NOT EXISTS public.portal_pacientes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome            text        NOT NULL DEFAULT '',
  email           text,
  cadastro_status text        NOT NULL DEFAULT 'completo',
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.portal_pacientes ENABLE ROW LEVEL SECURITY;

-- Paciente vê e edita apenas o seu próprio registro
CREATE POLICY "portal_paciente_own"
  ON public.portal_pacientes FOR ALL
  TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Terapeutas podem ver pacientes que solicitaram conexão com eles
-- (para exibir dados do solicitante)
CREATE POLICY "portal_paciente_terapeuta_view"
  ON public.portal_pacientes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.solicitacoes_conexao s
      WHERE s.paciente_user_id = portal_pacientes.user_id
        AND s.terapeuta_id = auth.uid()
    )
  );
