# `avaliacoes_voz`: avaliação do profissional x relato do paciente

A tabela `public.avaliacoes_voz` guarda a **avaliação presencial do profissional** (voz ou escrita) e **também o que o
próprio paciente conta no portal**. As duas coisas ficam no nome do profissional (`terapeuta_id`), e quem as separa é
`resultado->_meta->>origem`.

| `_meta.origem` | Quem grava | O que é |
|---|---|---|
| `voice_assessment`, `escrita` | o profissional, na tela de avaliação | avaliação presencial |
| (sem `origem`) | linhas antigas | avaliação do profissional |
| `portal_paciente_historia` | função `historia-paciente` ("contar o caso") | relato do paciente |
| `autocadastro_paciente` | função `patient-self-report` (relato de dor) | relato do paciente |

`_meta.mode` **não** separa as duas (o autorrelato do paciente também grava `mode: 'voice'`).

## O erro que isso evita

Por ser mais recente, a linha do paciente virava "a última avaliação por voz" e **escondia a avaliação presencial** nas
telas do profissional (nada era apagado). Também derrubava o botão "Iniciar Avaliação Presencial" e, no servidor, fazia
a geração de plano ler o relato no lugar da avaliação.

## Como ler a tabela

- **Telas do profissional** que precisam "da avaliação": `.or(FILTRO_SO_PROFISSIONAL)`
  (`src/utils/voiceAssessment/origemAvaliacao.ts`). O filtro mantém as linhas antigas sem `_meta.origem`.
  **Nunca** use `.not('resultado->_meta->>origem', 'in', ...)` sozinho: `NOT (NULL IN (...))` é NULL e as avaliações
  antigas somem. O filtro foi testado em PostgREST 12.2.3 e 14.1 (a do projeto).
- **Listas** que mostram tudo: marque a consulta com um comentário `// @origem-avaliacao: <motivo>` e rotule o relato
  (`ehRelatoDoPaciente`).
- **Quem quer só o relato**: `.filter(COLUNA_ORIGEM, 'in', VALOR_SO_PACIENTE)`.
- **Funções do servidor (Deno)** não importam de `src/`: usam o espelho `supabase/functions/_shared/origem-avaliacao.ts`
  (um teste garante que os dois não se separam).
- **Segurança**: um alerta que o paciente relata não pode sumir. O aviso na tela principal da avaliação
  (`AlertaRelatoDoPaciente`) e a triagem do servidor (`relatoRedFlags`) usam o último relato. A triagem é conservadora:
  qualquer lista de `red_flags` conta, sem filtrar frases de ausência de alerta.
- **Reprocessar/editar** um relato preserva a origem do registro (`origemEModoDaAvaliacao`).

## Teste de regressão

`src/test/origemAvaliacaoVoz.test.ts` analisa **cada consulta** de `avaliacoes_voz` e falha se ela não decidir o que
fazer com o relato do paciente (filtrar, gravar, ler por id, usar o filtro inverso ou ter o marcador
`@origem-avaliacao`). Arquivos que não precisam de filtro estão numa lista com o motivo.

## Fora deste conserto (a decidir)

- `PacienteInsightsDaAvaliacao` (portal do cliente): qual avaliação o cliente vê é decisão de produto.
- Eventos do avatar com `tipo_diagnostico = 'relato_paciente'` (ainda sem revisão do profissional) entram nos motores
  como "achados presenciais" na geração de plano.
- `historia-paciente` sobrescreve `pacientes.queixa_principal` e conta como "inicial/atualização" qualquer linha do
  paciente.
