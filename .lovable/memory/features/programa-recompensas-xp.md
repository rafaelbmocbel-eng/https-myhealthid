---
name: Programa de Recompensas (XP → Prêmios)
description: Sistema de níveis (bronze→diamante) e catálogo de prêmios resgatáveis com XP. Sprint 3 do plano MyID.
type: feature
---

## Arquitetura

- **`pacientes.xp_total`** + **`pacientes.nivel_atual`** (enum bronze/prata/ouro/platina/diamante).
- Trigger `atualizar_nivel_paciente` recalcula `nivel_atual` BEFORE INSERT/UPDATE quando `xp_total` muda.
- Limites: bronze 0 / prata 200 / ouro 500 / platina 1000 / diamante 2000.

## Tabelas

- **`recompensas_catalogo`**: terapeuta_id, titulo, descricao, xp_custo, estoque (NULL = ilimitado), nivel_minimo, ativa.
- **`recompensas_resgates`**: paciente_id, terapeuta_id, recompensa_id, xp_gasto, status (solicitado/aprovado/entregue/cancelado).

## Trigger crítica: `processar_resgate_recompensa`

BEFORE INSERT em `recompensas_resgates`:
1. Valida que recompensa está ativa.
2. Valida estoque > 0 (se finito).
3. Valida `xp_total >= xp_custo`.
4. Sobrescreve `xp_gasto` e `terapeuta_id` (cliente não precisa enviar).
5. Debita XP do paciente + decrementa estoque.

→ Cliente só envia `paciente_id` e `recompensa_id`. RLS permite paciente inserir se for dono.

## UI

- Pro: `/configuracoes` → tab "Recompensas" → `RecompensasManager` (CRUD catálogo + lista de resgates com status).
- Paciente: `/paciente/recompensas` → card de nível + trilha + catálogo + meus resgates.
- Atalho no dashboard do paciente (botão "Suas recompensas").

## Sincronização de XP

`PacienteDashboard` calcula XP localmente (`calcXP(stats)`) e faz `UPDATE pacientes.xp_total` ao montar, mantendo o banco como fonte única para o sistema de recompensas.

## Hooks

`src/hooks/useRecompensas.ts`:
- `useRecompensasCatalogoPro()` — CRUD do profissional
- `useResgatesPro()` — lista + atualizar status
- `useRecompensasPaciente(pacienteId)` — catálogo + meus resgates + resgatar
- `usePacienteXP(pacienteId)` — leitura do XP/nível
