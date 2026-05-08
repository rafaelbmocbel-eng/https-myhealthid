# Padronização Visual — Mais Clean e Minimalista

Objetivo: criar **uma linguagem visual única** (cards, tipografia, espaçamento, ícones, headers) e aplicá-la em todas as páginas pro (Agenda, Pacientes, Eventos, Dashboard, Configurações, Relatórios, CRM, Perfil do Paciente). Estilo de referência: **Apple Health / Linear / Notion** — muito espaço em branco, tipografia clara, pouca decoração, foco no conteúdo.

---

## Fase 1 — Fundação do Design System (sem mudar nenhuma página)

Atualizar os tokens e componentes base para que toda mudança futura seja automática.

1. **Tokens de espaçamento e tipografia** em `src/index.css`
   - Escala tipográfica reduzida e mais consistente (display / h1 / h2 / body / caption / micro)
   - Pesos: `font-medium` para títulos pequenos, `font-bold` para H1/H2, eliminar `font-black` em excesso
   - Letter-spacing leve em títulos (-0.02em)
   - Espaçamentos verticais padronizados (`space-y-*` previsível por tipo de bloco)

2. **Card refinado** (`src/components/ui/card.tsx`)
   - Borda mais sutil (`border-border/40`), sombra menor, `rounded-xl` em vez de `2xl` em cards densos
   - Padding interno padronizado (p-4 mobile / p-5 desktop)

3. **PageHeader reutilizável** (novo componente `src/components/ui/PageHeader.tsx`)
   - Mesmo template em toda página: título + subtítulo + ações à direita
   - Substitui os 8+ headers diferentes que existem hoje

4. **SectionTitle reutilizável** — pequeno componente para títulos de seção dentro de uma página, com mesma escala em todo o app

5. **Ícones** — varredura final removendo `h-3.5`/`h-3`/`h-4` soltos e trocando por `<Icon size="sm|md">` (já existe o sistema)

---

## Fase 2 — Páginas pro (uma por vez, na ordem de prioridade)

Cada página recebe: novo PageHeader, espaçamento mais arejado, redução de cards densos, remoção de gradientes/cores fortes desnecessárias, hierarquia mais clara.

Ordem proposta:
1. **Dashboard** (entrada do app, define a primeira impressão)
2. **Agenda** (página mais usada — simplificar grid e cards de sessão)
3. **Pacientes / Perfil do Paciente** (já parcialmente padronizado)
4. **Eventos**
5. **Configurações**
6. **Relatórios / CRM / Gestão de Vendas**

---

## Fase 3 — Componentes recorrentes

Aplicar o mesmo refino em peças que aparecem em várias páginas:
- `LinkActionsBar` (usado em 3 lugares)
- `PacientesSubNav` e abas (`Tabs`) — visual mais leve, sem fundos sólidos
- Modais e dialogs — padding e tipografia consistentes
- Tabelas — densidade e divisores mais sutis

---

## Princípios de design (regras a seguir em tudo)

- **Menos é mais**: remover cards/badges/ícones que não comunicam algo essencial
- **Branco vence**: aumentar `padding` e `gap` em vez de criar bordas/fundos
- **Uma cor de destaque por tela**: o resto em neutros
- **Tipografia faz a hierarquia**, não cores ou caixas
- **Mobile primeiro** sempre (viewport 350px é o teste real)
- **Sem gradientes decorativos** em UI funcional (mantidos só em hero/marketing)

---

## Detalhes técnicos

- Mudanças em `index.css`, `tailwind.config.ts`, `card.tsx`, `button.tsx`, `tabs.tsx` — propagam automaticamente
- Novos componentes: `PageHeader`, `SectionTitle`, `EmptyState` (padronizado)
- Memória: salvar regra "Design system clean/minimal — espaçamento generoso, sem gradientes em UI funcional, uma cor de destaque por tela" em `mem://design/`
- Não mexer em rotas, lógica, banco ou edge functions — puramente camada de apresentação
- Cada fase pode ser revisada e ajustada antes de seguir

---

## Como vamos trabalhar

Sugiro fazer **Fase 1 inteira em uma rodada** (é a base e dá ganho visível em todas as páginas de uma vez), e depois ir uma página por vez na Fase 2 — assim você revisa cada uma e me dá feedback antes de prosseguir.

Quer começar pela Fase 1?
