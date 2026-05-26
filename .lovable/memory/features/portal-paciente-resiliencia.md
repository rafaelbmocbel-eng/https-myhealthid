---
name: Resiliência do Portal do Paciente
description: PortalErrorBoundary + lazyWithRetry + PortalOfflineBanner para evitar tela branca, chunk-load errors e UX confusa quando o paciente perde rede.
type: feature
---

## Camadas

1. **`src/lib/lazyWithRetry.ts`** — wrapper do `lazy()` com 2 retries (700ms→1.4s) para chunk-load errors. Última falha → hard reload (guard 30s p/ evitar loop).
2. **`src/components/paciente/PortalErrorBoundary.tsx`** — class ErrorBoundary. Detecta chunk errors e auto-recarrega. Para outros erros, fallback amigável: Tentar de novo / Recarregar / Voltar para o início. Reseta por `resetKey={pathname}`.
3. **`src/components/paciente/PortalOfflineBanner.tsx`** — banner âmbar fixo (top) quando `navigator.onLine === false`. Some sozinho.

## Onde está aplicado

- **App.tsx**: todas as 18 lazy imports do portal usam `lazyWithRetry`. Rotas `/paciente/login`, `/portal/:token`, `/paciente/completar-cadastro` envolvidas em `<PortalErrorBoundary>` direto.
- **ProtectedPatientRoute**: envolve `{children}` em `<PortalErrorBoundary resetKey={pathname}>` — cobre todas as 14 rotas autenticadas do portal.
- **PacienteLayout**: `<PortalOfflineBanner />` no topo, dentro do safe-area.

## Por quê isso evita os bugs mais comuns

- Tela branca após deploy novo (chunk antigo 404) → retry + hard reload automático.
- Crash em uma página específica → não derruba o portal todo, só essa tela mostra fallback.
- Paciente em metrô / 3G ruim → banner avisa em vez de "tudo travado".
- Não substitui o retry do React Query (já configurado em App.tsx) — é complementar.
