# Triagem de segurança dos planos gerados por IA

> **Status: regras PROVISÓRIAS.** Foram escritas como ponto de partida técnico e
> **precisam ser validadas pelo Rafael e por profissionais** (educação física,
> nutrição, medicina) antes de serem tratadas como definitivas. Nada aqui é
> orientação clínica.

Antes de gastar uma chamada de IA, as edge functions `gerar-plano-treino` e
`gerar-plano-alimentar` avaliam se aquele paciente pode receber um plano gerado
automaticamente. O resultado é sempre um destes níveis:

| Nível | Significado |
|---|---|
| `liberado` | Nada sinalizado e todos os dados necessários existem. O plano é gerado. |
| `confirmar` | Há um fator de atenção (ou dado ausente). Só um **profissional** pode prosseguir, marcando que está ciente. |
| `bloqueia` | Há um fator de bloqueio. Só um **profissional** pode prosseguir, e com **justificativa escrita**. |

**Princípio:** falso negativo é risco de saúde. Em caso de dúvida o resultado
sobe para `confirmar` — nunca fica `liberado`.

Código: `supabase/functions/_shared/triagem-bloqueio.ts` (lógica pura, sem Deno).
Testes: `npx vitest run src/test/triagemBloqueio.test.ts`.

## Matriz de regras (padrão atual)

`B` = bloqueia, `C` = confirmar, `—` = não se aplica àquele foco.

| Fator | Treino | Nutrição |
|---|:-:|:-:|
| Menor de 18 anos | B | B |
| Gestação ou amamentação | B | B |
| Histórico de transtorno alimentar | — | B |
| Doença renal | C | B |
| Idoso (65 anos ou mais) | C | C |
| PAR-Q+ com classificação de atenção | C | — |
| Diabetes com insulina ou hipoglicemiante | C | — |
| Diabetes (qualquer tipo) | — | C |
| Problema de coração ou pressão alta | C | C |
| Cirurgia ou lesão recente | C | — |
| Cirurgia bariátrica | — | C |
| Sinais de alerta (red flags) no MyID | C | C |

Respostas **"não sei"** e **"prefiro não dizer"** na triagem autodeclarada contam
sempre como `confirmar` (mesmo quando a regra do fator é `bloqueia`), porque
não são uma confirmação do fator, mas também não descartam o risco.

### Dados ausentes

| Dado ausente | Código em `dadosAusentes` | Cliente | Profissional |
|---|---|---|---|
| Data de nascimento não cadastrada | `idade` | bloqueia | confirmar |
| Triagem autodeclarada não respondida (ou incompleta) | `triagem_autodeclarada` | bloqueia | confirmar |
| Falha ao ler dados do paciente no banco | `leitura_dados` | bloqueia | confirmar |

Cada dado ausente também aparece como um motivo legível em `motivos`, com
`origem: "dados_ausentes"`. Uma idade apenas digitada (sem data de nascimento) nunca
limpa o dado ausente — só pode **bloquear** (um menor poderia digitar 30).

## Quem pode o quê

| | Cliente (premium gerando o próprio plano) | Profissional |
|---|---|---|
| Qualquer motivo, mesmo de nível `confirmar` | **Bloqueia.** Vê "fale com o seu profissional" e o atalho para responder a triagem. | Precisa marcar "ciente" |
| Fator de nível `bloqueia` | Bloqueia | Precisa de justificativa com **15 caracteres ou mais** |
| Dado ausente | Bloqueia ("complete a triagem / cadastro") | Precisa marcar "ciente" |
| Sobrepor a triagem | **Nunca** | Sim, via `override` no pedido |

Quem chama é definido pelo servidor (JWT + banco), nunca pelo body do pedido:

- é o próprio paciente (`pacientes.user_id`) → **cliente**; sem `paciente_id`, usa o
  próprio cadastro;
- é o terapeuta do paciente (`pacientes.terapeuta_id`) → **profissional**;
- tem perfil profissional (`profiles`) mas sem vínculo direto com o paciente →
  **profissional** (mantém a regra anterior, para não derrubar quem atende em clínica);
- qualquer outro caso é recusado (403); paciente inexistente é 404; erro ao ler o
  banco é 503 (fail-closed: nunca "sem dados = liberado").

### Resposta da edge function

Quando não pode gerar, a resposta é HTTP 200:

```json
{
  "ok": false,
  "bloqueio": {
    "nivel": "bloqueia",
    "motivos": [{ "codigo": "gestante_lactante", "rotulo": "...", "detalhe": "...", "origem": "triagem_autodeclarada", "nivel": "bloqueia" }],
    "dadosAusentes": [],
    "pode_prosseguir_profissional": true
  }
}
```

Para prosseguir, o profissional reenvia o mesmo pedido com:

```json
{ "override": { "justificativa": "texto com 15 caracteres ou mais", "ciente": true } }
```

`bloqueia` exige a justificativa; `confirmar` exige `ciente: true`. Se o override
foi enviado mas não bastou, o `bloqueio` vem com `override_recusado`
(`justificativa_curta` ou `ciente_ausente`). O override usado fica registrado em
`plano._governanca.triagem.override` (com data e hora).

Cliente com texto livre que acionou uma regra **não** recebe o trecho do texto
(pode ser anotação de profissional): o `detalhe` é genérico. O profissional vê o
termo encontrado.

## De onde vêm os dados da triagem

Sempre lidos do banco pelo servidor (`carregarMotoresClinicos`), nunca só do body:

1. **Estruturados:** idade exata pela data de nascimento (`pacientes.data_nascimento`,
   fuso de Brasília); `pacientes.historico_clinico` (condições como "Diabetes tipo 1",
   "Insuficiência renal", "Hipertensão arterial"; cirurgias com ano; medicamentos).
   O histórico familiar é ignorado de propósito.
2. **Triagem autodeclarada:** `nutricao_anamnese.respostas.triagem` (formato abaixo).
3. **PAR-Q+:** última resposta em `questionarios_clinicos` (classificação de atenção,
   e as perguntas 1 e 2 sobre coração/pressão e dor no peito).
4. **MyID:** `red_flags_detected` do MyID concluído ou do MyID importado.
5. **Texto livre**, por palavra-chave sem acento e sem diferenciar maiúsculas:
   queixa, história atual, condições preexistentes, medicamentos, anamnese, achados e
   texto da avaliação do profissional, e as restrições do pedido.

Palavras-chave (resumo): gestante/grávida/gestação/lactante/amamentando; anorexia/
bulimia/compulsão alimentar/transtorno alimentar/TCA; renal/IRC/DRC/hemodiálise;
diabetes/insulina/hipoglicemiante/metformina; hipertensão/pressão alta/cardiopatia/
infarto; "cirurgia recente"/"pós-operatório"; bariátrica. A lista completa está em
`PADROES_TEXTO`.

Negação curta e explícita ("nega gestação", "não estou grávida", "sem uso de
insulina") não conta. "Não sei se estou grávida" **conta**. Termos ambíguos podem gerar
falso positivo (ex.: "TCA" como sigla de outra coisa); isso resulta em `confirmar`
para o profissional, não em erro.

### Formato da triagem autodeclarada

Chave `triagem` dentro de `nutricao_anamnese.respostas` (sempre com merge, sem
sobrescrever as demais respostas):

```json
{
  "versao": 1,
  "respondida_em": "2026-10-07T12:00:00.000Z",
  "gestante_lactante": "sim | nao | nao_sei",
  "transtorno_alimentar": "sim | nao | prefiro_nao_dizer",
  "doenca_renal": "sim | nao | nao_sei",
  "diabetes_insulina": "sim | nao | nao_sei",
  "cardio_pressao": "sim | nao | nao_sei",
  "cirurgia_lesao_recente": "sim | nao"
}
```

Uma triagem com qualquer pergunta sem resposta válida conta como **não respondida**.
Como o próprio cliente pode escrever nessa tabela, a autodeclaração serve para
**acender** alertas, nunca para aprovar nada.

## Como editar as regras

Tudo fica em `TRIAGEM_REGRAS`, no início de `triagem-bloqueio.ts`:

```ts
export const TRIAGEM_REGRAS = {
  idadeMenorDe: 18,                 // abaixo disto: criança/adolescente
  idadeIdosoMinima: 65,             // a partir disto: idoso
  cirurgiaRecenteJanelaAnos: 1,     // cirurgia com ano >= (ano atual - 1) conta como recente
  justificativaMinCaracteres: 15,
  niveis: {
    treino:   { menor_de_idade: "bloqueia", idoso: "confirmar", /* ... */ },
    nutricao: { menor_de_idade: "bloqueia", doenca_renal: "bloqueia", /* ... */ },
  },
};
```

- **Mudar o nível de um fator:** troque `"confirmar"` por `"bloqueia"` (ou o contrário).
- **Aplicar um fator a um foco que hoje não o usa:** adicione a linha. Exemplo: para
  o treino também reagir a transtorno alimentar, inclua
  `transtorno_alimentar: "confirmar"` em `niveis.treino`.
- **Desligar um fator num foco:** apague a linha.
- Códigos disponíveis: `menor_de_idade`, `idoso`, `gestante_lactante`,
  `transtorno_alimentar`, `doenca_renal`, `diabetes`, `diabetes_insulina`,
  `cardio_pressao`, `cirurgia_lesao_recente`, `cirurgia_bariatrica`, `parq_atencao`,
  `myid_red_flags`.
- Depois de editar, rode `npx vitest run src/test/triagemBloqueio.test.ts` e ajuste
  os testes que descrevem a regra antiga.

## Parâmetros dos prompts: tudo "a confirmar"

Os números fixos dos prompts não têm fonte confirmada e **não foi inventada
nenhuma referência**. Eles ficam em `_shared/parametros-nutricao.ts` (déficit,
superávit, pisos de kcal, proteína, gordura, hidratação, número de refeições,
fórmulas) e em `_shared/governanca-plano.ts` (faixas de treino por objetivo, número
de fases, semana de regeneração). Cada plano gerado traz esses parâmetros em
`_governanca.fonte.parametros`, com `fonte: null` e `status: "a_confirmar"`.

Os prompts são montados a partir dessas listas, então o registro e o que a IA
recebe não divergem. Quando um profissional validar um valor, troque a entrada por
`{ ..., fonte: "<referência que ele confirmou>", status: "confirmado" }`.

## Onde o front trata o bloqueio e a liberação

- `src/lib/geracaoPlano.ts`: `gerarPlanoComTriagem` chama a edge e devolve o plano **ou** o
  bloqueio (`{ ok:false, bloqueio }`); nunca trata o bloqueio como erro nem como plano vazio.
- `PlanoTreinoCard` e `PlanoAlimentarCard` (profissional): o bloqueio abre o
  `TriagemBloqueioDialog`; ao prosseguir, o **mesmo pedido** é reenviado com `override`.
  Na geração automática ("Montar todos os planos") o diálogo **não** abre sozinho: o card
  mostra "Geração pausada pela triagem de segurança" e o pai (`PortalControleTab`) mostra
  um aviso. Há uma única tentativa automática por card; "Dispensar" devolve o botão
  "Montar todos" para tentar de novo depois.
- `PacientePlanoIA` (cliente premium): o bloqueio mostra só a orientação de falar com o
  profissional e o caminho para a `TriagemSegurancaCard`; o cliente nunca sobrepõe.
- Liberar um plano passa sempre pelo `LiberarPlanoDialog` (revisão de segurança +
  RPC `liberar_plano`): o banco carimba quem liberou, quando e a versão. Ocultar continua
  sendo um UPDATE simples.
- Editar um plano liberado o devolve a rascunho no banco (trigger `trg_gov_*`); as telas
  de edição leem o `aprovado` que voltou do UPDATE e avisam o profissional.
- "Usar como base" (plano do cliente copiado para a tabela do profissional) **descarta** o
  `_governanca` e o `acompanhamento` vindos de `planos_ia_cliente` (o paciente escreve nessa
  tabela) e grava `fonte.tipo = "cliente_base"`.
- O selo (`SeloGovernanca`) nunca diz "liberado" para `planos_ia_cliente`.

## Perguntas em aberto para validar

1. Os cortes de idade (18 e 65) e a regra de bloquear menores estão corretos?
   Menores precisariam de responsável legal (hoje não existe esse cadastro).
2. Gestação/lactação deve bloquear **treino** também, ou só pedir confirmação?
3. Transtorno alimentar deve ao menos pedir confirmação no **treino**? (Hoje não aciona.)
4. Doença renal: bloquear na nutrição e só confirmar no treino é a decisão certa?
5. "Cirurgia recente" por ano de registro (janela de 1 ano) é suficiente? O campo
   guarda só o ano.
6. A triagem autodeclarada deve ter **validade** (refazer a cada N meses)? Hoje vale
   para sempre.
7. O PAR-Q+ implementado tem 7 perguntas curtas e não é obrigatório. Adotar o PAR-Q+
   oficial completo?
8. Free no período de teste (7 dias) pode gerar plano sozinho? O documento de
   produto diz que free não gera; hoje o teste de 7 dias permite.
9. Fora do escopo desta entrega, **sem triagem de bloqueio**: `gerar-dicas-paciente`
   (dicas gratuitas de Fortalecimento/Mobilidade), `gerar-diretriz-treino`,
   `gerar-diretriz-nutricional`, e os treinos publicados direto em `studio_treinos`.
10. O limite de dor do app está em dois valores: a escala da sessão
    (`PacienteExercicios.tsx:390`), o texto do plano e o acompanhamento usam "acima de 6"; os
    históricos (`PacienteExercicios.tsx:548` e `PacienteEngajamentoTab.tsx:265`) destacam
    "acima de 5". Falta decidir um valor único.
