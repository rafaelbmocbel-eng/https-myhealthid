## Objetivo

Permitir que o profissional **edite, desative e adicione missões** de gamificação de cada paciente, mantendo as sugestões automáticas visíveis e atualizando a lista quando uma avaliação presencial (Unidades ID / COB ZERO / Studio) for feita.

## Comportamento

- **Geração automática continua igual** (MyID gera missões via `gerarMissoesSaude` + `clinicalInsights`).
- **Profissional vê a lista completa** dentro da avaliação MyID concluída, com botões para:
  - Editar título e descrição de qualquer missão (override).
  - Desativar/ocultar missões automáticas.
  - Adicionar missões manuais (texto livre + categoria/XP).
- **Paciente vê** a versão final mesclada (auto + overrides + manuais ativas), em tempo real.
- **Pós-presencial**: ao salvar uma avaliação presencial, o sistema regenera as missões combinando MyID + achados presenciais, mantendo overrides manuais do profissional intactos e marcando as novas como `origem='presencial'` para revisão.

## Arquitetura

### 1. Banco — nova tabela `paciente_missoes`

```text
paciente_missoes
  id, paciente_id, terapeuta_id
  source_key text       -- chave da missão auto (para override) ou null se manual
  origem text           -- 'myid' | 'presencial' | 'manual'
  titulo text
  descricao text
  acao_imediata text
  categoria text        -- urgente|importante|oportunidade|positivo
  xp_recompensa int
  ativo boolean default true
  ordem int
  created_at, updated_at
```

RLS: terapeuta gerencia (`auth.uid() = terapeuta_id`); paciente lê pelas suas próprias (via `pacientes.user_id = auth.uid()`).

### 2. Camada de merge — `src/hooks/useMissoesPaciente.ts`

- Busca `paciente_missoes` do paciente.
- Recebe lista auto-gerada (atual `gerarMissoesSaude` + `clinicalInsights.missoes`).
- Cada missão auto recebe um `source_key` estável (ex.: `myid:dor-alta`, `clinical:driver-D`).
- Merge: para cada auto, se houver registro com mesmo `source_key`, aplica override (título/descrição/ativo). Adiciona manuais ativas. Ordena por categoria + ordem.
- Expõe `{ missoes, upsertOverride, toggleAtivo, addManual, remove }`.

### 3. UI Profissional — `src/components/myid/MyIDMissoesEditor.tsx`

- Renderizado dentro do `MyIDDicasPessoais` (avaliação MyID concluída do pro), em seção "Missões sugeridas para o paciente".
- Cada item: linha editável (título, descrição), botão ✏️/👁/🗑, badge da origem.
- Botão "+ Adicionar missão manual" abre dialog.
- Salva via hook → invalida React Query → paciente vê em tempo real (já que `PacienteMetasDesafios` usa a mesma fonte).

### 4. UI Paciente — atualizar `PacienteMetasDesafios.tsx` e `MyIDDicasPessoais.tsx` (modo paciente)

- Trocam a lista local por `useMissoesPaciente(pacienteId).missoes`.
- Sem mudanças visuais no portal — só conteúdo passa pela mesclagem.

### 5. Regeneração pós-presencial

- Hook `useEvolucaoPaciente` (e/ou os formulários presenciais) já dispara após salvar uma avaliação estrutural. Em vez de regenerar de fora, o merge é feito on-the-fly: a função `gerarMissoesSaude`/`clinicalInsights` recebe também os scores estruturais mais recentes (`avaliacoes_cob_zero`/Unidades ID/Studio).
- Missões novas que não existiam ganham `source_key` `presencial:<código>` e aparecem como "Sugerida após avaliação presencial — clique para revisar". Nunca apagam manuais nem overrides.

## Arquivos afetados

- **Migração nova**: tabela + RLS + trigger `updated_at`.
- **Novo hook**: `src/hooks/useMissoesPaciente.ts`.
- **Novo componente**: `src/components/myid/MyIDMissoesEditor.tsx` + dialog `MissaoManualDialog.tsx`.
- **Editado**: `src/components/myid/MyIDDicasPessoais.tsx` (insere editor no modo pro; consome merge no modo paciente).
- **Editado**: `src/components/paciente/PacienteMetasDesafios.tsx` (consome merge).
- **Editado**: `src/utils/myid/clinicalInsights.ts` e função `gerarMissoesSaude` para retornar `source_key` estável e aceitar dados estruturais opcionais.
- **Memória**: atualizar `mem://features/portal-paciente/gamificacao-missoes` com a nova arquitetura editável.

## Fora de escopo

- Edição de XP / prioridade / categoria (você marcou só título+descrição e ativar/adicionar).
- Notificação push ao paciente quando o profissional edita (pode ser próxima iteração).
- Histórico de versões das missões.

Posso seguir com a migração e implementação?