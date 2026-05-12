## Objetivo
Refinar o que vai da Avaliação Presencial (voz + MyID) para o prontuário do paciente, dando ao profissional controle granular sobre o que é compartilhado, o que fica só para ele, e tornando diretrizes e hipóteses editáveis e personalizáveis por cliente.

## Regras finais por seção

| Seção | Vai pro prontuário? | Editável? |
|---|---|---|
| Resumo clínico (voz) + Resumo MyID | **Sempre** (com data do momento) | Texto livre |
| Análise da dor | **Sempre** | Texto livre |
| Funcionalidade | **Sempre** | Texto livre |
| Fatores psicossociais | **Sempre** | Texto livre |
| Hipóteses diagnósticas | **Opcional**: profissional escolhe 1+ e pode editar/personalizar | Sim — nome, probabilidade, justificativa |
| Outras hipóteses + Raciocínio clínico | **Só visível ao profissional** (no histórico da avaliação, nunca na nota) | — |
| Raciocínio clínico (selecionado) | **Opcional**: trecho que o profissional marca vai pro prontuário | Sim |
| Mapeamento CIF | **Sempre** | — |
| Diretrizes de tratamento (3 fases) | **Sempre**, com fase de Manutenção adicionada | Cada fase editável: trocar exercícios/técnicas do catálogo + campos livres |
| Insights baseados em evidências | **Nunca** vai pro prontuário — só painel do profissional | — |
| Boneco/mapa de dor | **Vai**, e marcação persiste entre reaberturas | — |

## Fluxo proposto

```
[Avaliação salva] → [Modal "Revisar antes de enviar ao prontuário"]
   ├─ Pré-marcadas: Resumo, Dor, Funcionalidade, Psicossocial, CIF, Diretriz, Boneco
   ├─ Hipóteses: lista com checkbox por hipótese + edição inline
   ├─ Raciocínio: cada bloco com checkbox "incluir trecho"
   ├─ Insights: badge "uso interno — não vai ao prontuário"
   └─ Diretriz: editor por fase (Aguda / Subaguda / Avançada / **Manutenção novo**)
        ├─ Lista de exercícios da fase com [editar][remover][+ adicionar do catálogo]
        ├─ Lista de técnicas idem
        └─ Campos livres: objetivo, frequência, critérios de progressão
[Confirmar] → cria 1 nota única no prontuário com seções selecionadas + dados_extras (mapa dor, snapshot diretriz)
```

## Mudanças de código

### 1. `src/components/voice/VoiceAssessment.tsx`
- Após auto-save, abrir um novo `ProntuarioReviewDialog` antes de criar/atualizar a nota.
- Mover a criação da nota para dentro do dialog (substitui o bloco atual em ~L389-420).
- Garantir que `painMap` recebido via `clinicalContext` seja preservado em `assessment.dados_extras.mapa_dor` e re-aplicado ao reabrir a avaliação (corrige "marcação some na primeira avaliação").

### 2. Novo `src/components/voice/ProntuarioReviewDialog.tsx`
- Props: `assessment`, `transcricao`, `pacienteId`, `myidContext` (score + delta + dimensões críticas), `onConfirm`.
- Estado local com:
  - `seçõesIncluidas` (Set) — pré-marcadas conforme tabela acima.
  - `hipotesesSelecionadas` (Set de índices) + edição inline de cada hipótese.
  - `racicinioSelecionado` (Set de chaves) + edição.
  - `diretrizFases` editável (ver §3).
- Renderiza badge "uso interno" em Insights e Outras Hipóteses.
- Ao confirmar: monta descrição textual + `dados_extras` com `mapa_dor`, `diretriz_snapshot`, `myid_contexto`, `selecoes`.

### 3. Novo `src/components/voice/DiretrizFasesEditor.tsx`
- Renderiza 4 fases: Aguda, Subaguda, Avançada, **Manutenção** (nova).
- Por fase:
  - Lista editável de exercícios (nome, séries, reps, observação) + botão "Adicionar do catálogo" (lê `exercicios` do supabase do terapeuta) + "Adicionar livre".
  - Lista editável de técnicas + adição livre.
  - Campos: objetivo, frequência semanal, critérios de progressão.
- Fase Manutenção pré-preenchida com sugestões derivadas das avaliações disponíveis: continuidade de musculação/mobilidade, ajustes cinético-corporais (postura, padrões de marcha) baseados em achados do MyID e do bloco funcional, frequência reduzida 1-2x/semana, reavaliação trimestral.

### 4. Persistência do mapa de dor
- Em `VoiceAssessment` recuperar mapa de `assessment.dados_extras.mapa_dor` quando reabrir avaliação existente.
- Garantir que ao salvar (auto-save) o `painMap` atual seja sempre mesclado em `dados_extras` da `avaliacoes_voz` (não só na nota).
- Investigar componente do avatar 3D e propagar `initialPainMap` na primeira avaliação do paciente.

### 5. Hipóteses "outras" e Raciocínio fica só no profissional
- A nota do prontuário inclui apenas o que foi selecionado.
- O painel de avaliação (histórico) continua mostrando tudo (já é o comportamento atual).

### 6. Insights — sem alteração no painel do profissional, apenas garantir que **nunca** sejam concatenados em `descricao` da nota nem em `dados_extras` enviados ao paciente.

## Detalhes técnicos

- Catálogo de exercícios: usar tabela `exercicios` filtrada por `terapeuta_id`, igual ao que `Protocolos` usa.
- Snapshot da diretriz: reusar `createDiretrizSnapshot` / `createLegacyDiretrizSnapshot` em `src/lib/protocoloSnapshot.ts` para manter compatibilidade.
- `notas_prontuario.dados_extras` (jsonb existente) recebe: `{ mapa_dor, diretriz_snapshot, myid_contexto, selecoes: { hipoteses: [...], raciocinio: [...] }, versao_revisao: 2 }`.
- Edição posterior da nota: o usuário pode reabrir o dialog para a mesma avaliação (botão "Revisar envio ao prontuário" no card da avaliação) e a nota é atualizada (UPDATE) por `referencia_id`.
- Sem mudanças de schema. Sem novas migrações.

## Fora de escopo
- Refatorar geração da diretriz pela IA.
- Mudar comportamento da página de Protocolos.
- Alterar MyID em si (apenas leitura do score/delta para contexto).
