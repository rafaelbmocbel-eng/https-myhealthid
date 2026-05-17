# Checklist — Ritmo de Espaçamento Serene Premium

Este checklist garante que **Pacientes**, **Eventos**, **Configurações** e
componentes críticos de layout mantêm o mesmo ritmo em todas as larguras.

## Tokens oficiais (Serene Premium)

| Elemento                         | Classes obrigatórias                         |
|----------------------------------|----------------------------------------------|
| Wrapper de página (`container`)  | `container py-4 sm:py-6`                     |
| Hero / header                    | `mb-5 sm:mb-7` ou stack `space-y-4 sm:space-y-5` |
| Card padrão / `clinical-card`    | `p-4 sm:p-5` + `mb-4 sm:mb-5` entre cards    |
| Card via `<Card>` shadcn         | `p-4 sm:p-5` (já no componente)              |
| Subtítulo de seção               | `<SectionTitle>` ou `h-section` + `mb-3`     |

**Proibido em cards internos:** `mb-6`, `mb-8`, `p-6` no mobile.

## Larguras alvo (snapshot manual)

- [ ] **360 × 800** (Android compacto)
- [ ] **390 × 844** (iPhone 14/15)
- [ ] **414 × 896** retrato (iPhone XR/11 Plus)
- [ ] **414 × 896** paisagem → vira layout tablet/desktop (≥ 768 px),
      ativa o tier `sm:` em todos os tokens
- [ ] **768 × 1024** (tablet portrait — breakpoint exato)
- [ ] **1280 × 720** (desktop padrão)

Para cada largura em `/pacientes`, `/eventos`, `/configuracoes`:

1. [ ] Header / hero tem **um único** bloco de respiro inferior
2. [ ] Cards consecutivos têm gap visualmente **idêntico**
3. [ ] Nenhum card "cola" (gap < 12 px) ou "voa" (gap > 28 px)
4. [ ] Padding interno do card é igual em todos os cards da mesma página
5. [ ] Tipografia: eyebrow → `h-page` → `text-caption`
6. [ ] Em paisagem 414×896, a sidebar do desktop aparece
7. [ ] Inputs têm `font-size: 16px` (sem zoom iOS)
8. [ ] Nenhum `overflow-x` horizontal

## Guarda automatizada — `src/test/serene-spacing.test.tsx`

23 testes em 5 grupos:

| Grupo                                | Cobertura                                      |
|--------------------------------------|------------------------------------------------|
| **Wrapper de página**                | Pacientes, Eventos, Configurações usam `container py-4 sm:py-6` |
| **Hero — ritmo Serene**              | Hero usa `mb-5 sm:mb-7` OU `space-y-4 sm:space-y-5` |
| **Componentes críticos — sem mb-6/8** | 8 componentes-chave de layout sem `mb-6`/`mb-8` |
| **Configurações — mb-4 sm:mb-5**     | Componentes de `configuracoes/` + `equipe/` usam ritmo Serene |
| **Card shadcn — padding**            | Render real valida `p-4 sm:p-5`, `rounded-xl`, `border-border/40` |
| **🛡️ Guarda GLOBAL**                  | Varre **toda** `src/` em busca de `clinical-card + mb-6/8` ou `Card shadcn + mb-6/8` |

### Componentes monitorados (sem mb-6/8)

- `src/components/equipe/EquipeManager.tsx`
- `src/components/configuracoes/ConfigClinica.tsx`
- `src/components/configuracoes/ControleMensal.tsx`
- `src/components/configuracoes/TurnosEditor.tsx`
- `src/components/configuracoes/AusenciasManager.tsx`
- `src/components/AiCreditsBanner.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/section-title.tsx`

### Allowlist (excluídos do guarda global)

Adicionar à `LEGACY_ALLOWLIST` em `serene-spacing.test.tsx` exige
justificativa explícita em PR review.

**Serviços descontinuados** (CSS legado congelado como histórico):
- `src/components/cobzero/*`
- `src/components/identidade/*`
- `src/components/protocolo/*`
- `src/components/myid/*` (relatórios legados)
- `src/pages/MetodoIdentidade.tsx`, `src/pages/CobZero.tsx`
- `PacienteDashboardCobZero`, `PacienteDashboardIdentidade`
- `RelatorioCobZero`, `RelatorioIdentidade`

**Páginas pendentes de sweep Serene** (ritmo próprio aceitável):
- `src/pages/Index.tsx` (Dashboard)
- `src/pages/Relatorios.tsx`
- `src/pages/Protocolos.tsx`
- `src/pages/GestaoVendas.tsx`
- `src/pages/Agenda.tsx`
- `src/pages/PacientePerfil.tsx`
- `src/components/paciente/PatientIntegratedDashboard.tsx`

Quando uma dessas páginas passar pela passada Serene Premium, **remova-a**
da allowlist no mesmo PR.

## Rodando

```bash
bunx vitest run serene-spacing
```

## Como expandir o guarda

1. **Adicionar um componente ao monitoramento estrito** → inclua em
   `CRITICAL_LAYOUT_COMPONENTS` em `serene-spacing.test.tsx`.
2. **Liberar um arquivo legado** → adicione regex em `LEGACY_ALLOWLIST` com
   comentário explicando o motivo.
3. **Padronizar um arquivo da allowlist** → faça o sweep de espaçamento,
   remova-o da allowlist e confirme que `bunx vitest run serene-spacing` passa.

## Regressões conhecidas a evitar

- `EquipeManager`, `ConfigClinica`, `ControleMensal`, `TurnosEditor`,
  `AusenciasManager` já usaram `mb-6` — não regredir.
- `AiCreditsBanner` usa `mb-4` fixo (ok, é compacto).
- `card.tsx` (shadcn) é a fonte da verdade do padding interno —
  não duplicar `p-6` em wrappers.
