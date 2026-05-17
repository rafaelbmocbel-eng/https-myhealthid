
ALTER TABLE public.whatsapp_automacoes
  ADD COLUMN IF NOT EXISTS mensagem_lembrete_2h text DEFAULT 'Oi {nome}! Lembrete: sua sessão é hoje às {horario}. Te espero! Se precisar reagendar, é só responder aqui. 💙',
  ADD COLUMN IF NOT EXISTS mensagem_pos_sessao text DEFAULT 'Oi {nome}! Como você está se sentindo após nossa sessão? Qualquer dúvida, é só me chamar por aqui. 💙';

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS lembrete_2h_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS pos_sessao_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS confirmado_pelo_paciente_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_agendamentos_data_status
  ON public.agendamentos (data_inicio, status);
