## Visão geral

Transformar o inbox do WhatsApp em um **agente clínico inteligente** que (1) responde sozinho dentro de regras seguras, (2) dispara avisos proativos no momento certo e (3) personaliza cada mensagem com os dados reais do paciente (MyID, agenda, exercícios, pagamentos, evolução).

Hoje já existe `whatsapp-bot-reply` com detecção de intenção via Gemini, mas ele só envia 1 saudação. Vamos evoluir para um **agente com contexto clínico completo + ações + cadências orientadas a eventos**.

---

## 1. Agente IA conversacional (resposta automática inteligente)

Edge function `whatsapp-bot-reply` será reescrita usando **AI SDK + Lovable AI Gateway** (`google/gemini-3-flash-preview`) com:

- **System prompt clínico** carregado das configs da clínica (tom de voz, nome do profissional, especialidade).
- **Contexto do paciente** injetado a cada mensagem: nome, último MyID (score + red flags + 3 dimensões piores), próxima sessão agendada, missões/exercícios pendentes no portal, status de pagamento, última evolução clínica.
- **Tools (function calling)** que o modelo pode chamar:
  - `consultar_horarios_disponiveis(data_inicio, data_fim)` → lê `config_agenda` + `agendamentos`
  - `agendar_sessao(data, hora)` → cria agendamento em `agendamentos` com status `confirmacao_pendente`
  - `cancelar_sessao(agendamento_id, motivo)` → marca como `cancelado` + registra no CRM
  - `reagendar_sessao(agendamento_id, nova_data)`
  - `buscar_exercicios_pendentes()` → lê `progresso_exercicios`
  - `buscar_status_myid()` → último `myid_avaliacoes`
  - `escalar_para_humano(motivo)` → desliga o bot, marca conversa como `requer_atenção`, notifica o profissional
- **Guardrails**:
  - Red flags clínicos (dor aguda, dormência, queda) → escala imediatamente
  - Confiança da intenção < 0.6 → escala
  - Mais de 3 turnos sem resolver → escala
  - Nunca dá diagnóstico, nunca altera prescrição, nunca fala valores fora do que está cadastrado

## 2. Mensagens proativas (cron + triggers)

Nova edge function `agente-proativo` rodando a cada 15 min, e triggers em eventos do banco. Para cada disparo, o agente IA gera o texto personalizado (não template estático) usando os dados do paciente:

| Gatilho | Quando dispara | Conteúdo gerado pela IA |
|---|---|---|
| **Confirmação de sessão** | 24h antes do agendamento | "Oi {nome}, confirma sua sessão amanhã às {hora}? Responda SIM ou REAGENDAR." |
| **Lembrete do dia** | 2h antes | Curto, com endereço/link |
| **Pós-sessão** | 2h depois | Pergunta como está, registra resposta em evolução |
| **Exercício pendente** | Se missão do portal não foi feita em 48h | Personalizado pela dimensão MyID mais crítica |
| **MyID vencido** | Última avaliação > 30 dias | Convida a refazer com link mágico |
| **Reengajamento** | Sem sessão há 14/30/60 dias | Tom adaptado ao histórico (alta? abandono? pausa?) |
| **Pagamento pendente** | 3 dias após fatura | Educado, com link de pagamento |
| **Aniversário** | No dia | |
| **Aviso clínico importante** | Profissional dispara manualmente para 1 ou N pacientes | Ex: "Mudança de endereço", "Cancelamento de agenda" |

## 3. Conexão com Portal do Paciente / Avaliação

Tudo isso já existe no banco — vamos só **passar como contexto para a IA**:

- `myid_avaliacoes.resultado_processado` → IA sabe quais dimensões priorizar
- `evolucao_paciente` → IA conhece histórico
- `progresso_exercicios` + `missoes_paciente` → IA sabe o que cobrar
- `pagamentos_paciente` + `pacotes_sessoes` → IA sabe status financeiro
- `agendamentos` → IA agenda/confirma/remarca
- `notas_prontuario` → contexto clínico (só leitura)

Resultado: cada mensagem do bot referencia algo real ("vi que você ainda não fez os 3 exercícios da dimensão Sono que combinamos") — não é genérico.

## 4. Painel de controle (`/crm` → aba Automações)

A aba `WhatsappAutomacoes` (já existente) ganha:

- Toggle global: **Bot IA ativo / pausa**
- Toggle por gatilho (confirmação, pós-sessão, reengajamento, etc.)
- Janela de horário de atendimento do bot
- Tom de voz (formal/amigável/técnico)
- Lista de palavras de escalonamento customizadas
- **Broadcast manual com IA**: seleciona pacientes por filtro (estágio do funil, tag, última sessão), escreve a intenção ("avisar que vou viajar 15-20 dez"), IA personaliza cada mensagem e envia escalonado (1 a cada 5s)
- Métricas: respostas do bot, taxa de resolução, escalonamentos, conversões em agendamento

## 5. Detalhes técnicos

**Migrations necessárias** (1 migração):
- `whatsapp_automacoes`: adicionar colunas `tom_voz`, `gatilhos_ativos jsonb`, `palavras_escalonamento text[]`, `prompt_extra text`
- Nova tabela `agente_disparos`: log de cada mensagem proativa (paciente_id, gatilho, conteudo, enviado_em, status, resposta_em)
- Nova tabela `agente_broadcasts`: campanhas manuais com IA
- Cron `*/15 * * * *` para `agente-proativo`

**Edge functions**:
- Reescrever `whatsapp-bot-reply` com AI SDK + tools
- Nova `agente-proativo` (cron-driven)
- Nova `agente-broadcast` (dispara campanha manual)
- Helpers compartilhados em `_shared/agente-contexto.ts` para montar o contexto clínico

**Frontend**:
- Reformular `src/pages/WhatsappAutomacoes.tsx` com as novas opções
- Nova aba "Campanhas" no `CrmHub` para broadcasts
- Indicador visual no inbox quando bot respondeu (já existe metadata.bot)

**Custos**: cada interação ~500-1500 tokens. Com `gemini-3-flash-preview` é barato. Adicionar contador em `uso_ia_mensal`.

---

## Entregas em ordem

1. Migração de banco (schema + cron)
2. Helper `_shared/agente-contexto.ts`
3. Reescrita do `whatsapp-bot-reply` com tools + guardrails
4. Edge function `agente-proativo`
5. Edge function `agente-broadcast`
6. UI: WhatsappAutomacoes + aba Campanhas no CrmHub
7. Métricas no `/crm?tab=metricas`

Posso ir direto, ou prefere começar só pela **parte conversacional** (item 1-3) e depois adicionar as proativas/broadcast?
