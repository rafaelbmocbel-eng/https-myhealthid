
ALTER TABLE public.chat_mensagens DROP CONSTRAINT IF EXISTS chat_mensagens_tipo_check;
ALTER TABLE public.chat_mensagens ADD CONSTRAINT chat_mensagens_tipo_check 
  CHECK (tipo IN ('manual', 'lembrete_sessao', 'pos_atendimento', 'reengajamento', 'aniversario', 'boas_vindas', 'agendamento_chat'));
