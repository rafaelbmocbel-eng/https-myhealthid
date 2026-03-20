
-- =============================================
-- 1. ÍNDICES FALTANTES para performance
-- =============================================

-- notas_prontuario: consultas frequentes por paciente e tipo
CREATE INDEX IF NOT EXISTS idx_notas_prontuario_paciente ON public.notas_prontuario (paciente_id);
CREATE INDEX IF NOT EXISTS idx_notas_prontuario_terapeuta ON public.notas_prontuario (terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_notas_prontuario_created ON public.notas_prontuario (created_at DESC);

-- notificacoes: filtro por terapeuta + lidas
CREATE INDEX IF NOT EXISTS idx_notificacoes_terapeuta ON public.notificacoes (terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_terapeuta_lida ON public.notificacoes (terapeuta_id, lida) WHERE lida = false;
CREATE INDEX IF NOT EXISTS idx_notificacoes_created ON public.notificacoes (created_at DESC);

-- avaliacoes_identidade: consultas por paciente e terapeuta
CREATE INDEX IF NOT EXISTS idx_avaliacoes_identidade_paciente ON public.avaliacoes_identidade (paciente_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_identidade_terapeuta ON public.avaliacoes_identidade (terapeuta_id);

-- myid_avaliacoes: consultas por paciente e terapeuta
CREATE INDEX IF NOT EXISTS idx_myid_avaliacoes_paciente ON public.myid_avaliacoes (paciente_id);
CREATE INDEX IF NOT EXISTS idx_myid_avaliacoes_terapeuta ON public.myid_avaliacoes (terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_myid_avaliacoes_token ON public.myid_avaliacoes (token_acesso);

-- avaliacoes_cob_zero: consultas por paciente
CREATE INDEX IF NOT EXISTS idx_avaliacoes_cob_zero_paciente ON public.avaliacoes_cob_zero (paciente_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_cob_zero_terapeuta ON public.avaliacoes_cob_zero (terapeuta_id);

-- avaliacoes_voz: consultas por paciente e terapeuta
CREATE INDEX IF NOT EXISTS idx_avaliacoes_voz_paciente ON public.avaliacoes_voz (paciente_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_voz_terapeuta ON public.avaliacoes_voz (terapeuta_id);

-- pagamentos_paciente: consultas por paciente e terapeuta
CREATE INDEX IF NOT EXISTS idx_pagamentos_paciente_paciente ON public.pagamentos_paciente (paciente_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_paciente_terapeuta ON public.pagamentos_paciente (terapeuta_id);

-- mensagens_whatsapp: consultas por paciente
CREATE INDEX IF NOT EXISTS idx_mensagens_whatsapp_paciente ON public.mensagens_whatsapp (paciente_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_whatsapp_terapeuta ON public.mensagens_whatsapp (terapeuta_id);

-- pesquisas_nps: consultas por paciente e terapeuta
CREATE INDEX IF NOT EXISTS idx_pesquisas_nps_paciente ON public.pesquisas_nps (paciente_id);
CREATE INDEX IF NOT EXISTS idx_pesquisas_nps_terapeuta ON public.pesquisas_nps (terapeuta_id);

-- protocolos: consultas por paciente e terapeuta
CREATE INDEX IF NOT EXISTS idx_protocolos_paciente ON public.protocolos (paciente_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_terapeuta ON public.protocolos (terapeuta_id);

-- links_avaliacao: consultas por paciente e token
CREATE INDEX IF NOT EXISTS idx_links_avaliacao_paciente ON public.links_avaliacao (paciente_id);
CREATE INDEX IF NOT EXISTS idx_links_avaliacao_terapeuta ON public.links_avaliacao (terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_links_avaliacao_token ON public.links_avaliacao (token);

-- links_agenda_paciente: consultas por token e status
CREATE INDEX IF NOT EXISTS idx_links_agenda_token ON public.links_agenda_paciente (token);
CREATE INDEX IF NOT EXISTS idx_links_agenda_terapeuta ON public.links_agenda_paciente (terapeuta_id);

-- studio tables
CREATE INDEX IF NOT EXISTS idx_studio_treinos_paciente ON public.studio_treinos (paciente_id);
CREATE INDEX IF NOT EXISTS idx_studio_treinos_terapeuta ON public.studio_treinos (terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_studio_execucoes_paciente ON public.studio_execucoes (paciente_id);
CREATE INDEX IF NOT EXISTS idx_studio_execucoes_terapeuta ON public.studio_execucoes (terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_studio_periodizacoes_paciente ON public.studio_periodizacoes (paciente_id);
CREATE INDEX IF NOT EXISTS idx_studio_periodizacoes_terapeuta ON public.studio_periodizacoes (terapeuta_id);

-- pacientes: consultas por terapeuta (muito frequente)
CREATE INDEX IF NOT EXISTS idx_pacientes_terapeuta ON public.pacientes (terapeuta_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_user_id ON public.pacientes (user_id) WHERE user_id IS NOT NULL;

-- agendamentos: status filter (usado no lembrete encerramento e relatórios)
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON public.agendamentos (terapeuta_id, status);

-- controle_sessoes: data_sessao para relatórios
CREATE INDEX IF NOT EXISTS idx_controle_sessoes_data ON public.controle_sessoes (data_sessao DESC);

-- =============================================
-- 2. TRIGGERS de updated_at automático
-- =============================================

-- Reuse existing function public.update_updated_at_column()

CREATE OR REPLACE TRIGGER trg_agendamentos_updated_at
  BEFORE UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_avaliacoes_updated_at
  BEFORE UPDATE ON public.avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_avaliacoes_cob_zero_updated_at
  BEFORE UPDATE ON public.avaliacoes_cob_zero
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_avaliacoes_identidade_updated_at
  BEFORE UPDATE ON public.avaliacoes_identidade
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_avaliacoes_voz_updated_at
  BEFORE UPDATE ON public.avaliacoes_voz
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_config_agenda_updated_at
  BEFORE UPDATE ON public.config_agenda
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_controle_sessoes_updated_at
  BEFORE UPDATE ON public.controle_sessoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_daily_logs_updated_at
  BEFORE UPDATE ON public.daily_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_evolucao_paciente_updated_at
  BEFORE UPDATE ON public.evolucao_paciente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_funil_config_updated_at
  BEFORE UPDATE ON public.funil_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_funil_leads_updated_at
  BEFORE UPDATE ON public.funil_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_myid_avaliacoes_updated_at
  BEFORE UPDATE ON public.myid_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_pacientes_updated_at
  BEFORE UPDATE ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_pagamentos_updated_at
  BEFORE UPDATE ON public.pagamentos_paciente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_preferencias_notificacao_updated_at
  BEFORE UPDATE ON public.preferencias_notificacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_protocolos_updated_at
  BEFORE UPDATE ON public.protocolos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_protocolos_cob_zero_updated_at
  BEFORE UPDATE ON public.protocolos_cob_zero
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_assinaturas_updated_at
  BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_termos_consentimento_updated_at
  BEFORE UPDATE ON public.termos_consentimento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_studio_treinos_updated_at
  BEFORE UPDATE ON public.studio_treinos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER trg_studio_periodizacoes_updated_at
  BEFORE UPDATE ON public.studio_periodizacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
