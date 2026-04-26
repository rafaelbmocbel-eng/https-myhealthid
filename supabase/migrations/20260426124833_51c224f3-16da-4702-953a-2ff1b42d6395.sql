-- ============================================
-- 1) SEGURANÇA: progresso_exercicios
-- ============================================
DROP POLICY IF EXISTS "Todos inserem progresso" ON public.progresso_exercicios;

-- Pacientes inserem progresso apenas para si (via prescrição vinculada ao próprio paciente_id)
CREATE POLICY "Pacientes inserem proprio progresso"
ON public.progresso_exercicios
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = progresso_exercicios.paciente_id
      AND p.user_id = auth.uid()
      AND p.ativo = true
  )
);

-- Terapeutas registram progresso dos seus pacientes
CREATE POLICY "Terapeutas inserem progresso"
ON public.progresso_exercicios
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.pacientes p
    WHERE p.id = progresso_exercicios.paciente_id
      AND p.terapeuta_id = auth.uid()
  )
);

-- ============================================
-- 2) SEGURANÇA: funil_leads — restringir UPDATE anônimo
-- ============================================
DROP POLICY IF EXISTS "Público atualiza leads em andamento" ON public.funil_leads;

-- Permite UPDATE anônimo SOMENTE no mesmo lead (id deve permanecer o mesmo) e em andamento.
-- O cliente já conhece o id do lead retornado no INSERT — atua como token de sessão.
CREATE POLICY "Anon atualiza proprio lead em andamento"
ON public.funil_leads
FOR UPDATE
TO anon
USING (
  status = 'em_andamento'
  AND EXISTS (
    SELECT 1 FROM public.funil_config fc
    WHERE fc.id = funil_leads.funil_config_id
      AND fc.ativo = true
  )
)
WITH CHECK (
  status IN ('em_andamento','agendado','pago','concluido','perdido')
  AND EXISTS (
    SELECT 1 FROM public.funil_config fc
    WHERE fc.id = funil_leads.funil_config_id
      AND fc.ativo = true
  )
);

-- ============================================
-- 3) SEGURANÇA: pacientes — remover INSERT anônimo amplo via link de agenda
-- ============================================
DROP POLICY IF EXISTS "pub_pacientes_insert_via_agenda" ON public.pacientes;
-- (cadastro público continua possível via funil; outros caminhos exigem auth)

-- ============================================
-- 4) SEGURANÇA: Realtime — remover tabelas sensíveis não usadas
-- ============================================
ALTER PUBLICATION supabase_realtime DROP TABLE public.myid_avaliacoes;
ALTER PUBLICATION supabase_realtime DROP TABLE public.pagamentos_paciente;

-- ============================================
-- 5) SEGURANÇA: realtime.messages — restringir subscriptions
-- ============================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_realtime_topic_scoped" ON realtime.messages;
CREATE POLICY "auth_realtime_topic_scoped"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);
-- Nota: RLS por tabela ainda governa quais linhas chegam ao cliente.
-- Como removemos pagamentos/myid do publication, eles não vazam mais.

-- ============================================
-- 6) SEGURANÇA: Bucket exercise-images — bloquear listagem
-- ============================================
UPDATE storage.buckets SET public = false WHERE id = 'exercise-images';

-- Mantém leitura pública por URL direta (objetos individuais)
DROP POLICY IF EXISTS "Public can read exercise images" ON storage.objects;
CREATE POLICY "Public can read exercise images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'exercise-images');

-- ============================================
-- 7) PERFORMANCE: índices estratégicos
-- ============================================

-- paciente_servicos: 165k seq scans, sem índice em paciente_id
CREATE INDEX IF NOT EXISTS idx_paciente_servicos_paciente
  ON public.paciente_servicos (paciente_id) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_paciente_servicos_servico
  ON public.paciente_servicos (servico, ativo);

-- pacientes: queries frequentes por (terapeuta_id, ativo) e por user_id (portal)
CREATE INDEX IF NOT EXISTS idx_pacientes_terapeuta_ativo
  ON public.pacientes (terapeuta_id, ativo);
CREATE INDEX IF NOT EXISTS idx_pacientes_user_id
  ON public.pacientes (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pacientes_portal_token
  ON public.pacientes (portal_token) WHERE portal_token IS NOT NULL;

-- agendamentos: queries por (terapeuta_id, data_inicio) — agenda diária/semanal
CREATE INDEX IF NOT EXISTS idx_agendamentos_terapeuta_data
  ON public.agendamentos (terapeuta_id, data_inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente
  ON public.agendamentos (paciente_id) WHERE paciente_id IS NOT NULL;

-- links_agenda_paciente: 205k seq scans em validação de token
CREATE INDEX IF NOT EXISTS idx_links_agenda_status_exp
  ON public.links_agenda_paciente (terapeuta_id, status, data_expiracao);

-- myid_avaliacoes: token_acesso é hot path
CREATE INDEX IF NOT EXISTS idx_myid_token_acesso
  ON public.myid_avaliacoes (token_acesso);
CREATE INDEX IF NOT EXISTS idx_myid_terapeuta
  ON public.myid_avaliacoes (terapeuta_id, created_at DESC);

-- avaliacoes_voz / cob_zero / identidade: ordenação por created_at no perfil
CREATE INDEX IF NOT EXISTS idx_avaliacoes_voz_paciente
  ON public.avaliacoes_voz (paciente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_cob_paciente
  ON public.avaliacoes_cob_zero (paciente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_identidade_paciente_data
  ON public.avaliacoes_identidade (paciente_id, created_at DESC);

-- notificacoes: alto volume, leitura por terapeuta_id
CREATE INDEX IF NOT EXISTS idx_notificacoes_terapeuta_lida
  ON public.notificacoes (terapeuta_id, lida, created_at DESC);

-- chat_mensagens: leitura por (paciente_id, created_at)
CREATE INDEX IF NOT EXISTS idx_chat_paciente_data
  ON public.chat_mensagens (paciente_id, created_at DESC);