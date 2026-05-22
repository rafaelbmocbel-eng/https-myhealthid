## Objetivo

Adicionar uma nova aba **"Tráfego"** dentro do CRM (`/crm?tab=trafego`) que centraliza: rastreamento de origem (UTM), conexão com Instagram (publicação/agendamento/insights/DMs), gerador de links rastreáveis e configuração de pixels (Meta + GA4). Sem novo item na sidebar.

## Entregas por fase

### Fase 1 — Estrutura + Rastreamento de Origem (UTM) — **base obrigatória**

1. **Nova aba no CrmHub**
   - Adicionar entrada `trafego` em `TABS` (ícone `Radio` ou `Megaphone`).
   - Criar `src/pages/CrmTrafego.tsx` com sub-abas internas: **Origem · Instagram · Links UTM · Pixels**.
   - Lazy load no `CrmHub`.

2. **Captura de UTMs nos links públicos** (zero UI nova)
   - Hook `useUtmCapture()` em `FunilPublico`, `CadastroCliente`, `AgendaPublica`, `EventoPublico`, `MyIDResponder`.
   - Lê `utm_source / utm_medium / utm_campaign / utm_content / utm_term` + `referrer` e persiste em `sessionStorage`.
   - Ao criar lead/paciente/inscrição, grava em coluna nova `origem_utm jsonb`.

3. **Migração de banco**
   ```sql
   ALTER TABLE pacientes        ADD COLUMN origem_utm jsonb;
   ALTER TABLE funil_leads      ADD COLUMN origem_utm jsonb;
   ALTER TABLE evento_inscricoes ADD COLUMN origem_utm jsonb;
   ALTER TABLE whatsapp_conversas ADD COLUMN origem_utm jsonb;
   ```
   Mais um índice GIN em `origem_utm` para agregação.

4. **Sub-aba "Origem"** (`CrmTrafegoOrigem.tsx`)
   - Cards KPI: leads por canal (Instagram, WhatsApp, Google, Direto, Outros).
   - Gráfico de barras (Recharts) últimos 30/60/90 dias.
   - Tabela: campanha → leads → pacientes convertidos → taxa.
   - Hook `useOrigemMetrics()` agregando `funil_leads + pacientes + evento_inscricoes` por `origem_utm->>'utm_source'`.

5. **Bloco "Origem dos leads" em Métricas (CrmMetricas)**
   - Resumo compacto reutilizando o mesmo hook.

### Fase 2 — Sub-aba "Links UTM"

1. **Gerador de links rastreáveis** (`CrmTrafegoLinks.tsx`)
   - Form: destino (select: Funil, Cadastro, Evento, MyID), origem (preset: instagram, whatsapp, google_ads, email), mídia, campanha.
   - Monta URL via `getBaseUrl() + path + ?utm_*`.
   - Botão copiar + QR code (já temos `pixQrCode.ts` para basear).
   - Histórico de links salvos em nova tabela `links_rastreaveis` (terapeuta_id, label, url_final, utms jsonb, cliques int, created_at). RLS por terapeuta_id.

2. **Botão "Link rastreável"** em `LinkActionsBar` (perfil paciente, eventos, funis) — abre o gerador pré-preenchido.

### Fase 3 — Sub-aba "Pixels"

1. **Configuração de pixels** (`CrmTrafegoPixels.tsx`)
   - Nova tabela `tracking_config (terapeuta_id pk, meta_pixel_id text, ga4_id text, ativos boolean)`.
   - Form simples: 2 inputs (Meta Pixel ID + GA4 Measurement ID) + toggle.
   - Hook `useTrackingConfig()`.

2. **Injeção condicional nos links públicos**
   - Componente `<PublicTrackingPixels terapeutaId>` em `FunilPublico`, `EventoPublico`, `CadastroCliente`, `MyIDResponder`.
   - Carrega scripts Meta Pixel + GA4 via `useEffect` se `tracking_config` ativo.
   - Dispara eventos: `PageView` (sempre), `Lead` (ao criar lead/inscrição), `Schedule` (ao agendar).

### Fase 4 — Sub-aba "Instagram" (mais complexa, isolada)

1. **Conexão via Lovable Connector**
   - Não existe connector oficial pronto para Instagram Graph API; vamos usar fluxo OAuth próprio Meta (Instagram Business + Página FB).
   - **Pré-requisito do usuário:** App no Meta for Developers + Instagram Profissional ligado a Página FB.
   - Secrets: `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`.
   - Tabela `instagram_contas (terapeuta_id pk, ig_user_id text, page_id text, access_token text encrypted, expires_at, username, profile_pic)`.

2. **Edge Functions**
   - `instagram-oauth-callback`: troca code por long-lived token, salva conta.
   - `instagram-publish`: publica feed/reel via Graph API (`/media` + `/media_publish`).
   - `instagram-insights`: alcance, impressões, salvamentos do perfil + posts.
   - `instagram-dm-webhook`: recebe DM (webhook Meta) → grava em `whatsapp_conversas` com `canal='instagram_dm'`.

3. **UI `CrmTrafegoInstagram.tsx`**
   - Estado desconectado: card "Conectar Instagram" → abre OAuth.
   - Estado conectado:
     - Header: avatar + @username + botão desconectar.
     - Tab interna: **Publicar** (form: imagem/vídeo + legenda + agendar pra data) · **Calendário** (posts agendados) · **Insights** (KPIs últimos 30d).
   - Posts agendados ficam em tabela `instagram_posts_agendados` + cron job `instagram-scheduler` (pg_cron a cada 5min).

4. **Inbox unificada**
   - Adicionar filtro de canal em `CrmInbox` (tabs: Todos · WhatsApp · Instagram DM).
   - Badge `📷 IG` nos cards.

5. **Pipeline**
   - Badge de canal de origem (WA/IG/Funil) no card do `CrmPipeline`.

## Considerações técnicas

- **Gating de plano:** envolver `CrmTrafego` em `<PlanoGate modulo="crm">`. Instagram exige plano Profissional+.
- **Espelhamento:** não aplicável (feature pro-only, sem contraparte paciente).
- **Segurança:** access_token IG em coluna criptografada via `pgsodium` ou armazenar em secret; RLS estrita em `instagram_contas`/`tracking_config`/`links_rastreaveis` (terapeuta_id = auth.uid()).
- **Mobile:** sub-abas com mesma faixa horizontal scroll do `CrmHub` atual; respeitar 100dvh.
- **Design:** seguir `<PageHeader>`, `<SectionTitle>`, `<EmptyState>`, cards `rounded-xl border-border/40 shadow-xs`, sem gradientes.
- **Ícones:** classes `.icon-*` oficiais.
- **Links públicos:** sempre via `getBaseUrl()` (já é regra).

## Ordem de implementação sugerida

Vou executar **Fase 1 completa** nesta primeira leva (estrutura + UTMs + dashboard Origem + bloco em Métricas). Em seguida pergunto se você quer ir para Fase 2 (Links), Fase 3 (Pixels) ou pular direto para Fase 4 (Instagram) — esta última precisa dos secrets do Meta App antes de começar.

## O que NÃO está no escopo

- Editor visual de criativos (use Canva externo).
- Comparativo entre múltiplas contas IG (1 conta por terapeuta nesta v1).
- TikTok/LinkedIn (avaliar depois).
- Atribuição multi-touch sofisticada (apenas last-click via UTM).
