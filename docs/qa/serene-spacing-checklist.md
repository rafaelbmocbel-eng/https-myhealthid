# Checklist — Ritmo de Espaçamento Serene Premium

Este checklist garante que **Pacientes**, **Eventos** e **Configurações** mantêm
o mesmo ritmo de espaçamento em todas as larguras alvo.

## Tokens oficiais (Serene Premium)

| Elemento                         | Classes obrigatórias                         |
|----------------------------------|----------------------------------------------|
| Wrapper de página (`container`)  | `container py-4 sm:py-6`                     |
| Hero / header                    | `mb-5 sm:mb-7`                               |
| Card padrão / `clinical-card`    | `p-4 sm:p-5` + `mb-4 sm:mb-5` entre cards    |
| Card via `<Card>` shadcn         | `p-4 sm:p-5` (já no componente)              |
| Subtítulo de seção               | `<SectionTitle>` ou `h-section` + `mb-3`     |

**Proibido em cards internos:** `mb-6`, `mb-8`, `p-6` no mobile.

## Larguras alvo

- [ ] **360 × 800** (Android compacto)
- [ ] **390 × 844** (iPhone 14/15)
- [ ] **414 × 896** retrato (iPhone XR/11 Plus)
- [ ] **414 × 896** paisagem → vira layout tablet/desktop (≥ 768 px),
      ativa o tier `sm:` em todos os tokens
- [ ] **768 × 1024** (tablet portrait — breakpoint exato)
- [ ] **1280 × 720** (desktop padrão)

## Snapshot visual — passos manuais

Para cada largura acima, em `/pacientes`, `/eventos`, `/configuracoes`:

1. [ ] Header / hero tem **um único** bloco de respiro inferior (`mb-5 sm:mb-7`)
2. [ ] Cards consecutivos têm gap visualmente **idêntico**
3. [ ] Nenhum card "cola" no card seguinte (gap < 12 px) ou "voa" (gap > 28 px)
4. [ ] Padding interno do card é igual em todos os cards da mesma página
5. [ ] Tipografia: eyebrow (`uppercase tracking-wider`) → `h-page` → `text-caption`
6. [ ] Em paisagem 414×896, a sidebar do desktop aparece (não bottom nav)
7. [ ] Inputs têm `font-size: 16px` (sem zoom no iOS)
8. [ ] Nenhum `overflow-x` horizontal aparece (scroll lateral)

## Teste automatizado

`src/test/serene-spacing.test.tsx` valida estaticamente que:

- Páginas usam `container py-4 sm:py-6`
- Heros usam `mb-5 sm:mb-7`
- Cards de Configurações usam `mb-4 sm:mb-5` (não `mb-6`)
- Card shadcn renderiza com `p-4 sm:p-5`

Rodar com: `bunx vitest run serene-spacing`

## Regressões conhecidas a evitar

- `EquipeManager`, `ConfigClinica`, `ControleMensal`, `TurnosEditor`,
  `AusenciasManager` já usaram `mb-6` — não regredir.
- `AiCreditsBanner` usa `mb-4` fixo (ok, é compacto e fica antes de cards).
- `card.tsx` (shadcn) é a fonte da verdade do padding interno — não duplicar
  `p-6` em wrappers.
