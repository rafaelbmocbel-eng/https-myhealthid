---
name: Integração Wearables (Sprint 4 MyID)
description: Sync log + alertas automáticos + monitor pro de smartwatch. Cron diário às 08h BRT detecta queda de passos, FC elevada, sono baixo e ausência de sync.
type: feature
---

## Tabelas

- **`wearable_sync_log`**: histórico de syncs (paciente_id, terapeuta_id, fonte, steps, heart_rate, calories, sleep_hours, raw_data jsonb). RLS: paciente insere/lê próprio, terapeuta gerencia tudo.
- **`wearable_alertas`**: alertas detectados (tipo: queda_passos|fc_elevada|sono_baixo|sem_sync, severidade: baixo|medio|alto, lido bool). RLS: terapeuta gerencia, paciente apenas lê.
- **View `wearable_metricas_semanais`** (`security_invoker = true`): agrega `health_metrics` em janelas de 7d e 7-14d para detectar variações.

## Edge Function `wearable-alert-monitor`

Cron `wearable-alert-monitor-daily` (`0 11 * * *` UTC = 08h BRT) executa:
1. Lê `wearable_metricas_semanais` de todos os pacientes.
2. Detecta:
   - **queda_passos** se média 7d caiu ≥50% vs semana anterior (alto se ≥70%).
   - **fc_elevada** se FC repouso 7d > 85 bpm (alto se >95).
   - **sem_sync** se último dia com dados há ≥3 dias.
   - **sono_baixo** consultando `sleep_logs` 7d (média <6h, alto se <5h).
3. Dedup: não cria alerta do mesmo tipo se já existir não-lido nas últimas 24h.

## Fluxo de sync (paciente)

`PacienteSaude.handleSyncComplete`:
1. `upsertMetrics` em `health_metrics` (já existia).
2. **Insert estruturado em `wearable_sync_log`** (novo) — alimenta o monitor pro e dedupe de alertas.

`useHealthSync` continua usando `capacitor-health` em iOS/Android.

## UI Pro

`WearableMonitorCard` (`src/components/perfil-paciente/WearableMonitorCard.tsx`):
- Embutido em `/pacientes/:id` → aba **Portal**.
- Mostra passos média 7d (+ % vs semana anterior), FC repouso, dias com dados, última sync.
- Lista alertas com ícone/cor por severidade + botão "Marcar lido".
