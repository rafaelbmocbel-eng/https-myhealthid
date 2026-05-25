# Plano: 4 Features MyID Completas

Escopo grande. Vou entregar em **4 sprints sequenciais**, validando cada um antes do próximo. Total estimado: ~6-8 etapas de implementação.

---

## Sprint 1 — Notificações Inteligentes Contextuais

**Objetivo:** Disparar notificações automáticas no canal certo (push/WhatsApp/in-app) baseadas no **Driver Primário** do MyID do paciente.

**Banco:**
- Tabela `notificacao_regras` (driver, horario_envio, canal, template, ativo)
- Tabela `notificacao_envios` (log: paciente_id, regra_id, enviada_em, status, lida_em)
- Seed de regras default (Sono→22h, Hidratação→3/3h, Estresse→manhã, Dor→tarde, etc.)

**Edge function:** `notificacoes-inteligentes` (cron 30/30min)
- Lê pacientes ativos, busca último MyID, identifica driver, checa janela horária, envia via push/WhatsApp/in-app, registra envio.

**UI:**
- Pro: `/configuracoes/notificacoes-inteligentes` — tabela editável de regras + log de envios.
- Paciente: badge no portal mostra próxima dica contextual.

---

## Sprint 2 — Relatório PDF MyID para o Paciente

**Objetivo:** PDF Serene-style compartilhável.

**Componentes:**
- `utils/pdfMyIDPaciente.ts` (lazy-loaded como os outros PDFs)
- Página 1: capa com Global Score + Gauge SVG
- Página 2: Fingerprint radar das 11 dimensões
- Página 3: Driver Primário em linguagem leiga + recomendação
- Página 4: Plano de 3 fases com metas
- Página 5: Missões ativas (XP por categoria)
- Página 6: Próximos passos + assinatura do profissional

**UI:** Botão "Baixar meu relatório" no `PacienteDashboard` + "Compartilhar via WhatsApp" (Web Share API).

**Mirror Pro:** Mesmo PDF disponível no perfil do paciente para o profissional baixar.

---

## Sprint 3 — Programa de Recompensas (XP → Prêmios)

**Objetivo:** Sistema de níveis + catálogo de recompensas configurável.

**Banco:**
- Coluna `nivel_atual` em `pacientes` (Bronze/Prata/Ouro/Platina/Diamante)
- Tabela `recompensas_catalogo` (terapeuta_id, titulo, descricao, xp_custo, ativa, estoque)
- Tabela `recompensas_resgates` (paciente_id, recompensa_id, xp_gasto, status, resgatado_em, entregue_em)
- Trigger: recalcula `nivel_atual` quando XP muda

**UI Paciente:**
- `/portal/recompensas` — catálogo, "Resgatar" debita XP, status do resgate
- Header do portal: nível atual + barra de progresso para próximo nível

**UI Pro:**
- `/configuracoes/recompensas` — CRUD do catálogo
- Notificação quando paciente resgata (precisa marcar como entregue)
- KPI em `/dashboard`: resgates do mês

---

## Sprint 4 — Integração Wearables (Apple Health / Google Fit)

**Objetivo:** Sincronizar passos, sono, HRV e alimentar o MyID automaticamente.

**Base:** Já existe `useHealthData` + `useHealthSync` com Capacitor Health. Vou estender:

**Banco:**
- Tabela `wearable_sync_log` (paciente_id, fonte, dados_jsonb, sincronizado_em)
- View `wearable_metricas_semanais` (média passos/sono/HRV últimos 7d)

**Lógica:**
- Função `recalcular_af_hid_r1_from_wearable(paciente_id)` — atualiza scores AF (atividade física), R1 (sono) automaticamente entre MyIDs manuais
- Edge function `wearable-alert-monitor` (cron diário): detecta piora (ex: passos ↓50% em 7d) e notifica profissional
- Banner no portal: "Última sincronização: X horas atrás"

**UI Pro:**
- Aba "Wearable" no perfil do paciente: gráficos passos/sono/HRV + alertas
- Indicador no card do paciente quando wearable mostra piora

---

## Ordem e validação

Implemento Sprint 1 completo (banco + edge + UI Pro + UI Paciente), você testa, valido com você, e só então parto pro Sprint 2. Isso evita rework caso algo precise ajustar de rota no meio.

## Risco e compatibilidade

- Nenhuma mudança quebra fluxo existente. Tudo é aditivo.
- Wearables só ativam se o paciente autorizar Capacitor Health (já é o comportamento atual).
- PDF é lazy-loaded — não afeta performance inicial.
- Notificações inteligentes começam **desativadas por default** — profissional liga regra por regra.

---

**Posso começar pelo Sprint 1 agora?** Se quiser ajustar algo (ex: pular alguma sprint, mudar canais, etc.), me avisa antes.
