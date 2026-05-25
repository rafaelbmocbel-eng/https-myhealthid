---
name: Notificações Inteligentes MyID
description: Sistema cron 30/30min envia dicas contextuais por Driver Primário do MyID (Dor, Sono, Hidratação etc), configurável por terapeuta
type: feature
---
- Tabelas: `notificacao_regras`, `notificacao_envios`, `notificacao_inteligente_config` (RLS por terapeuta_id)
- Função: `seed_notificacao_regras_default(terapeuta_id)` cria 11 templates desativados
- Edge fn: `notificacoes-inteligentes` (cron `*/30 * * * *`, internal-only) lê driver de `myid_avaliacoes.resultado_processado->myid_100->driver_primario->dimensao`
- Dedupe: respeita `intervalo_repeticao_horas` ou 6h default
- Canais: in_app (cria também em `notificacoes` para hub do terapeuta) e whatsapp (chama `send-whatsapp`)
- UI Pro: aba "MyID Auto" em `/configuracoes` (componente `NotificacoesInteligentes.tsx`)
- UI Paciente: `PacienteDicaInteligente` no dashboard mostra última dica recebida
- Feature desativada por default — terapeuta liga via toggle em config geral
