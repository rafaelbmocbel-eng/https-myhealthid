## Plano de Revisão de Ícones e Organização Visual

### 1. Cabeçalhos dos serviços (Identidade, COB° ZERO, Studio)
- Verificar alinhamento de avatar, nome, badges e LinkActionsBar
- Garantir espaçamento consistente entre elementos
- Padronizar tamanhos de ícones (h-3.5 mobile, h-4 desktop)

### 2. Listas de pacientes
- **Pacientes.tsx** — reorganizar botões de ação em cada card/linha
- **MetodoIdentidade.tsx** — alinhar ícones de link na lista lateral
- **StudioPersonalID.tsx** — verificar consistência com os demais

### 3. Páginas gerais
- **Agenda.tsx** — ícones de status e ações nos agendamentos
- **Relatorios.tsx** — botões de exportação e compartilhamento
- **Eventos.tsx** — ícones de inscrição e status
- **Configuracoes.tsx** — ícones de menu/toggle
- **GestaoVendas.tsx** — ícones do funil

### 4. Navegação e header global
- Verificar QuickActions (já ajustado)
- Sidebar e NavLinks — consistência de ícones
- NotificationCenter — badge e ícone de sino

### Critérios de organização:
- Tamanhos padronizados por contexto (h-3 em listas compactas, h-4 em headers)
- Gap e padding consistentes (gap-1 a gap-2)
- Tooltips em ícones sem label visível
- Cores usando semantic tokens (não hardcoded)
- Responsividade mobile-first (362px viewport)
