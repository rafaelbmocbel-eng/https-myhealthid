-- Modo férias: interruptor geral que pausa TODAS as mensagens automáticas do
-- WhatsApp (confirmação 24h, lembrete 2h, pós-sessão, no-show, NPS, progresso
-- semanal, agente proativo, bot e lembretes de eventos). O bloqueio é aplicado
-- no ponto único de envio (_shared/enviar-whatsapp.ts): mensagens manuais da
-- conversa e campanhas disparadas pelo próprio profissional continuam saindo.
alter table public.whatsapp_automacoes
  add column if not exists automacoes_pausadas boolean not null default false;

comment on column public.whatsapp_automacoes.automacoes_pausadas is
  'Interruptor geral (modo férias): true = nenhuma mensagem automática sai pelo WhatsApp; envios manuais continuam funcionando.';
