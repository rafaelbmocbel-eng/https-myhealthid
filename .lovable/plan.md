
# Plano: MyID em Fases (4 etapas com gravação incremental)

## Objetivo
Transformar o questionário MyID (hoje monolítico) em **4 fases curtas e salváveis**, com Fingerprint que se preenche progressivamente, retomada de onde parou e notificação ao profissional a cada fase concluída.

## Divisão das fases

| Fase | Conteúdo | Tempo | Score parcial gerado |
|------|----------|-------|----------------------|
| 1 — Essencial | Bloco 1 (Identificação) + Bloco 2 (Dor + Red Flags) | ~3 min | D, I |
| 2 — Funcional | Bloco 3 (Funcionalidade) + Bloco 4 (Comportamento) | ~3 min | + EFI, P |
| 3 — Regulação | Bloco 5 completo (sono, energia, psicológico, contexto) | ~4 min | + R, C |
| 4 — Sistêmico | Bloco 6 (trauma, cicatrizes, autonômico, ginecológico) | ~2 min | + N → MyID 100 oficial |

Red flags da Fase 1 disparam alerta imediato ao pro independente das demais fases.

---

## 1. Banco de dados

### 1.1 Adicionar campos em `avaliacoes_identidade`
- `fase_atual` (smallint, default 1) — última fase salva (1-4)
- `fase_concluida` (smallint, default 0) — última fase 100% completa
- `myid_score_parcial` (numeric) — score recalculado a cada fase
- `dimensoes_preenchidas` (jsonb, default `[]`) — ex: `["D","I","EFI","P"]`
- `concluido_em` (timestamptz, null) — preenchido só quando Fase 4 fecha
- Índice em `(paciente_id, fase_concluida)` para retomada rápida

### 1.2 RPC pública `get_myid_em_andamento(p_token text)`
Retorna `{id, fase_atual, fase_concluida, dados_avaliacao, dimensoes_preenchidas}` para o link público continuar de onde parou (Security Definer, valida `links_avaliacao`).

### 1.3 RPC pública `salvar_fase_myid(p_token, p_fase, p_dados, p_score_parcial, p_dimensoes)`
- Faz upsert em `avaliacoes_identidade` (uma linha por link ativo)
- Atualiza `fase_concluida = greatest(antigo, p_fase)`
- Se `p_fase = 4`: chama `complete-myid` para gerar análise IA + grava em `evolucao_paciente`

### 1.4 Notificação ao pro
Trigger `AFTER UPDATE` em `avaliacoes_identidade` quando `fase_concluida` muda:
- Insere em `notificacoes` com tipo `myid_fase_concluida` (ou `myid_red_flag` se Fase 1 trouxer flag)

---

## 2. Frontend — fluxo do paciente

### 2.1 `MyIDResponder.tsx` (reescrita em 4 telas)
- Tela inicial: "Vamos fazer em 4 partes curtas. Você pode parar quando quiser e voltar depois."
- Indicador fixo no topo: `Fase 2 de 4 · ~3 min restantes` + barra de progresso
- Ao terminar cada fase:
  - Tela de transição com microvitória: *"Fase 1 concluída ✓ Score parcial: 78"* + Fingerprint mini animando o anel recém-preenchido
  - Botão "Continuar agora" / "Salvar e voltar depois"
- Ao reabrir o link: `get_myid_em_andamento` traz `fase_concluida`, pula para `fase_concluida + 1`

### 2.2 Componente novo `MyIDFaseTransicao.tsx`
Card com Fingerprint mini, badge de fase, score parcial e dois CTAs.

### 2.3 `MyIDFingerprint` — modo parcial
- Nova prop `dimensoesPreenchidas: string[]`
- Anéis ausentes renderizam com `opacity-20` + `stroke-dasharray="4 4"`
- Tooltip nos vazios: *"Disponível na Fase X"*
- Score central: se incompleto, mostra `"Parcial"` em vez do número final, com sub-label `"X/7 dimensões"`

### 2.4 Persistência local de rascunho
Manter `useDraftState` (já existe, IndexedDB) para não perder respostas em curso dentro de uma fase, mesmo offline.

---

## 3. Frontend — visão do profissional

### 3.1 Card do paciente (lista e perfil)
- Badge novo: `MyID em andamento (2/4)` ou `MyID completo` ou `MyID pendente`
- Cor do badge segue semáforo (verde/âmbar/cinza)

### 3.2 Aba MyID dentro do perfil
- Se `fase_concluida < 4`: mostra Fingerprint parcial + lista das fases concluídas com timestamp + botão "Reenviar link"
- Se `fase_concluida = 4`: comportamento atual (análise IA, narrativa, etc)

### 3.3 Hub de Alertas
- Novo evento `myid_fase_concluida` rota para `/pacientes/:id?tab=myid`
- Evento `myid_red_flag` (existente) ganha prioridade visual quando vem da Fase 1

---

## 4. Edge Functions

### 4.1 `complete-myid` — adaptar
- Aceitar dois modos: `partial` (gera score parcial sem chamar IA) e `final` (atual)
- Modo `partial` é chamado pela RPC `salvar_fase_myid` para Fases 1, 2, 3
- Modo `final` só na Fase 4 → narrativa IA + grava em `evolucao_paciente`

### 4.2 `daily-reminders` — adaptar
- Se paciente tem `fase_concluida` entre 1 e 3 há mais de 3 dias → enviar lembrete WhatsApp
- Se 7 dias → segundo lembrete + notifica pro

---

## 5. Reavaliações mensais (otimização)
Quando `MyID mensal` for disparado:
- Pré-preenche Fases 3 e 4 com respostas anteriores (>30 dias)
- Pergunta no início de cada uma: *"Algo mudou desde a última vez?"* → se "não", pula a fase
- Reduz reavaliação a 1-2 fases na maioria dos casos

---

## 6. Migração de dados existentes
- Avaliações `concluidas` ganham `fase_concluida = 4`, `dimensoes_preenchidas = ["D","I","EFI","P","R","C","N"]`
- Avaliações em rascunho (se houver) recebem `fase_concluida = 0` e ficam disponíveis para retomada

---

## 7. Ordem de implementação sugerida (3 entregas)

**Entrega 1 — Banco + RPCs**
- Migration com colunas novas, índice, trigger de notificação
- RPCs `get_myid_em_andamento` e `salvar_fase_myid`
- Migração de dados existentes

**Entrega 2 — UX do paciente**
- Reescrita do `MyIDResponder` em 4 fases
- Componente `MyIDFaseTransicao`
- Fingerprint parcial
- Retomada via link

**Entrega 3 — UX do pro + automações**
- Badges de progresso na lista/perfil
- Eventos no hub de alertas
- `complete-myid` modo partial/final
- Lembretes para fases incompletas
- Otimização de reavaliação mensal

---

## Riscos e mitigação
- **Score parcial confundir o pro** → label "Parcial · X/7" sempre presente, cor neutra até Fase 4
- **Paciente abandonar na Fase 1** → mesmo assim já temos red flags + mapa de dor (valor clínico real)
- **Quebrar histórico de evolução** → `evolucao_paciente` só recebe registro quando Fase 4 fecha; parciais não poluem o gráfico longitudinal
- **Conflito com link já enviado** → RPC trata upsert, não duplica linha

---

## Confirmar antes de implementar
1. A divisão em 4 fases acima faz sentido clínico ou prefere outra agregação (ex: 3 fases: Dor / Funcional+Comportamento / Regulação+Sistêmico)?
2. Lembrete automático de fase incompleta começa em 3 dias ou outro intervalo?
3. Reavaliação mensal com pré-preenchimento ("algo mudou?") entra já na entrega 2 ou fica para depois?
