-- Por padrão, o bot/automação do WhatsApp só responde a contatos cadastrados
-- (pacientes do app). Números de fora do ecossistema da clínica não recebem
-- resposta automática — evita poluir o atendimento com mensagens de quem não
-- faz parte do serviço. O profissional pode desligar essa trava se quiser um
-- bot aberto.
ALTER TABLE public.whatsapp_automacoes
  ADD COLUMN IF NOT EXISTS bot_apenas_cadastrados boolean NOT NULL DEFAULT true;
