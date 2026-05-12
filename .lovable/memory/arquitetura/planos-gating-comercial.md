---
name: Estrutura de Planos e Gating Comercial
description: Planos pagos (Essencial R$147, Profissional R$247, Clínica R$197/prof) com módulos, gating via PlanoGate e quota mensal de IA
type: feature
---

# Estrutura comercial — MY HEALTH ID

## Planos ativos

| Plano | Preço | Módulos | IA/mês |
|---|---|---|---|
| **Essencial** | R$ 147 | agenda, pacientes, myid, portal_paciente, eventos, prontuario | 30 |
| **Profissional** (destaque) | R$ 247 | Essencial + crm, funil_vendas, pacotes_sessoes, financeiro_avancado, relatorios | 100 |
| **Clínica** | R$ 197/prof (mín 2) | Profissional + multi_profissional, painel_dono, comissoes | 100 |

**Excedente IA:** R$ 0,40/análise.

Planos antigos (Básico, Identidade, COB° ZERO, Studio, Completo) ficam `ativo=false` mas continuam no banco para preservar assinaturas legadas.

## Banco

- `planos` — adicionados campos `limite_ia_mensal`, `destaque`, `ordem`
- `assinaturas` — usa relação `user_id → plano_id` com `status='ativa'`
- `uso_ia_mensal` — contagem por `(user_id, ano_mes 'YYYY-MM', tipo)` com unique. Tipos: `myid_analise`, `relatorio_narrativo`, `voz`, `chat_ia`
- `incrementar_uso_ia(user_id, tipo)` — SECURITY DEFINER, chamada pelas Edge Functions de IA para contar consumo
- `meu_plano_atual()` — RPC retorna plano + uso atual do mês para o usuário logado
- `has_module_access(user_id, modulo)` — pré-existente, valida acesso a módulo

## Frontend

- `usePlanoAtivo()` — hook React Query, retorna `PlanoAtivo | null`
- `temAcessoModulo(plano, 'crm')` — helper síncrono. **Quando plano é null, libera tudo** (modo legado, sem cobrança ativa)
- `temCotaIA(plano)` — true se ainda tem quota mensal
- `<PlanoGate feature="crm">...</PlanoGate>` — bloqueia conteúdo com paywall elegante linkando para `/precos`
- `/precos` — página pública lista planos ativos por `ordem`, hero + grid + FAQ. SEO configurado

## Política de gating

**HOJE (sem cobrança ainda):** `usePlanoAtivo` retorna null para quem não tem assinatura → `temAcessoModulo` libera tudo. Sistema 100% pronto, mas transparente.

**QUANDO ATIVAR COBRANÇA:** mudar `temAcessoModulo` para retornar `false` quando plano é null, OU criar assinatura "trial" automática no signup. PlanoGate já cuidará do paywall.

## Edge Functions de IA

Sempre chamar `supabase.rpc('incrementar_uso_ia', { p_user_id, p_tipo })` antes/depois de cada chamada Gemini para contabilizar uso. Não bloquear ainda — apenas contar.

## Onde aplicar PlanoGate (futuro)

- `/pacientes?tab=crm` → `<PlanoGate feature="crm">`
- Funil chatbot público (rotas `/funil/...`) — gating no painel de config, não no público
- Pacotes de sessões → `feature="pacotes_sessoes"`
- Relatórios financeiros avançados → `feature="financeiro_avancado"`
- Gestão multi-profissional → `feature="multi_profissional"`
