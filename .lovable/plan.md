## Regra de negócio confirmada

| Estado clínico | Critério | Portal |
|---|---|---|
| **Ativo** | Pacote `ativo` com sessões restantes **OU** pagamento `pago` nos últimos 30 dias | Tudo aberto, profissional cria atividades normalmente |
| **Carência (até 30d após fim)** | Sem pacote ativo, último pagamento entre 30–60 dias | Portal aberto (MyID, evoluções, diário, chat, agenda) **mas profissional não pode criar exercícios/protocolos/missões novas** |
| **Bloqueado** | Sem ativo há mais de 60 dias | Histórico read-only + 2 CTAs: "Voltar ao tratamento" / "Assinar Wellness Premium R$49" |

Reativa automaticamente assim que o profissional confirmar novo pagamento ou criar novo pacote.

---

## Backend (1 migration)

Estender `public.get_wellness_status()` para incluir 3 campos novos:
- `acesso_clinico text` — `'ativo' | 'carencia' | 'bloqueado'`
- `acesso_clinico_expira_em timestamptz` — data limite (fim da carência)
- `dias_restantes_carencia int`

Lógica:
```text
ultimo_pagamento  = MAX(updated_at) de pagamentos_paciente WHERE status='pago'
pacote_ativo      = EXISTS pacotes_sessoes WHERE status='ativo' AND sessoes_utilizadas<total_sessoes
referencia        = GREATEST(ultimo_pagamento, data_fim do último pacote ativo)
ativo             = pacote_ativo OU (now - ultimo_pagamento) ≤ 30d
carencia          = !ativo AND (now - referencia) ≤ 60d
bloqueado         = caso contrário
```

Pacientes Wellness (não-clínicos) continuam usando o tipo_conta atual — esses campos só importam para `tipo_conta='clinico'`.

---

## Frontend

**1. `src/hooks/useWellnessAccess.ts`**
- Expõe `acessoClinico`, `emCarencia`, `bloqueado`, `diasCarencia`, `podeReceberAtividadesNovas`.

**2. Novo componente `BloqueioPortalCard.tsx`**
- Tela usada quando `bloqueado=true`: mostra histórico (MyID antigo, evoluções) read-only + 2 CTAs.

**3. `PacienteDashboard.tsx`**
- Se `emCarencia`: banner âmbar "Seu pacote terminou — você tem X dias para retomar o tratamento" + WhatsApp do profissional.
- Se `bloqueado`: substitui o conteúdo principal pelo `BloqueioPortalCard`.

**4. Painel do profissional — perfil do paciente**
- Badge de status no header (`Ativo` verde / `Carência Xd` âmbar / `Bloqueado` cinza).
- Em `carencia` ou `bloqueado`: desabilita botões "Adicionar exercício", "Criar protocolo", "Nova missão personalizada" com tooltip "Paciente fora de tratamento ativo — confirme um pagamento para liberar".

**5. Reativação automática**
- Já sai de graça: `useWellnessAccess` usa React Query com `staleTime: 60s`, então logo após o profissional marcar pagamento como `pago` o status recalcula.

---

## Detalhes técnicos (referência)

Arquivos modificados:
- `supabase/migrations/<nova>.sql` — recria `get_wellness_status`
- `src/hooks/useWellnessAccess.ts`
- `src/pages/paciente/PacienteDashboard.tsx`
- `src/components/paciente/BloqueioPortalCard.tsx` (novo)
- `src/components/paciente/StatusClinicoBadge.tsx` (novo, usado no perfil pro)
- `src/pages/PacientePerfil.tsx` — badge no header + props passadas para abas que criam atividades
- Componentes de criação de atividade (exercícios/protocolos/missões) — recebem `disabled` quando `acessoClinico !== 'ativo'`

Sem mudanças de RLS (lógica apenas de UI + RPC). Sem nova tabela.
