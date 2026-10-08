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

Quem gera e para onde vai o plano (cliente Premium, insumos do cliente e chancela da
equipe científica MyHealthID, decisão de 08/10/2026): `supabase/functions/_shared/plano-cliente.ts`
e a seção "Cliente Premium e a chancela da equipe científica" mais abaixo.
Testes: `npx vitest run src/test/planoClienteChancela.test.ts`.

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

| | Cliente (Premium gerando o próprio plano; o plano vai para a chancela) | Profissional |
|---|---|---|
| Direito de gerar | Só `wellness_premium`; senão HTTP 402 (o teste grátis de 7 dias não vale mais). Com um plano do mesmo tipo já aguardando a equipe: HTTP 409 | Terapeuta do paciente ou perfil profissional (regra abaixo) |
| Pedido (objetivo, nível, frequência, duração, refeições, textos) | Normalizado no servidor com tetos (`POLITICA_PLANO_CLIENTE.limitesPedido`) | Como veio da tela |
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

Quando pode gerar, a resposta depende de quem chamou:

- **Profissional**: `{ "ok": true, "plano": { ... } }` (a de treino acrescenta `usou_banco`).
  Ele edita e libera pelo fluxo de sempre.
- **Cliente Premium**: o servidor grava o plano na fila de chancela e responde
  `{ "ok": true, "em_revisao": true, "plano_id": "<uuid>" }`, **sem o conteúdo do plano**.
  Se a gravação falhar a resposta é erro HTTP 500 (nunca finge sucesso nem entrega o
  plano sem chancela). Sem Premium: HTTP 402 `{ "error": "...", "codigo": "premium_necessario" }`.
  Com plano do mesmo tipo já aguardando a equipe: HTTP 409 `{ "error": "...", "codigo": "plano_em_revisao" }`
  (checado ANTES de gastar IA; se a fila não puder ser consultada, HTTP 503). O portal já desliga o
  botão nesse estado; o 409 cobre outra aba, estado velho e chamada direta à edge.

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

## Cliente Premium e a chancela da equipe científica

Decisão do Rafael (08/10/2026): o cliente **só gera se pagar** (Premium), **só com o que é
dele**, e o plano **só chega a ele depois de chancelado** pela equipe científica MyHealthID.
O profissional do paciente continua criando, editando e liberando planos pelo fluxo atual
(`planos_treino` / `planos_alimentares` + `liberar_plano`). Visão de produto em
`docs/fluxo-cliente-e-tiers.md`.

### Insumos do plano do cliente

O prompt do cliente usa **apenas**: MyID, questionários clínicos, histórico clínico
(`historico_clinico`), queixa e história atual, medicamentos/alergias/condições do cadastro,
triagem autodeclarada e anamnese nutricional (esta só no plano alimentar). **Não entram**:
achados e notas da avaliação presencial, exames do profissional (bioimpedância,
`exames_presenciais`), avaliação por voz, e do corpo do pedido a antropometria, os testes
funcionais e o recordatório (do cliente não se aceitam). Implementação:
`restringirAInsumosDoCliente`, `dadosDoPedido` e `insumosDoPlano` em `_shared/plano-cliente.ts`;
`carregarMotoresClinicos(admin, id, { apenasInsumosDoCliente: true })` faz o mesmo filtro no
carregamento. A lista permitida está em `POLITICA_PLANO_CLIENTE.insumosDoCliente`, e
`_governanca.fonte.insumos` registra só o que de fato entrou.

A triagem de segurança **continua lendo os motores completos** (inclusive as notas do
profissional): uma nota "gestante" do profissional ainda bloqueia o cliente, mesmo que o
texto não vá para o prompt. O `detalhe` mostrado ao cliente segue genérico.

### Fila de chancela

- Tabela `plano_cliente_chancela` (RLS ligado, policy só para a equipe científica). O servidor
  grava com `registrar_plano_cliente_chancela` (só `service_role`): o novo plano entra como
  `aguardando`. Enquanto já existe um `aguardando` do mesmo paciente e tipo a gravação é recusada
  (`plano_em_revisao`): gerar de novo não tira da fila, nem de baixo das mãos do revisor, um plano que a
  equipe está lendo ou editando, e cada geração custa uma chamada de IA. O `chancelado` atual segue
  visível ao cliente até o novo ser chancelado.
- Equipe: `profiles.equipe_cientifica` (flag mantida pelo super-admin; função
  `definir_equipe_cientifica`). `eh_equipe_cientifica()` diz se quem chama é da equipe.
- `fila_chancela(status)` (só equipe) lista a fila com **primeiro nome e idade** do paciente,
  o conteúdo, um resumo da revisão de segurança e o `hash_atual`.
- `chancelar_plano_cliente(id, conteudo?, justificativa?, nota_publica?)`: perfil exigido —
  treino: `educador_fisico` ou `fisioterapeuta`; nutrição: `nutricionista`; o super-admin
  chancela qualquer área (carimbo `por_perfil = 'super_admin'` fora do perfil dele). Carimba
  `conteudo._governanca.aprovacao = { por_user_id, por_nome, por_perfil, em, versao, hash,
  justificativa?, risco_geral | sem_revisao: true }`; revisão de segurança com risco `alto` exige
  justificativa de 15+ caracteres (`Justificativa obrigatória para liberar plano de risco alto`),
  **inclusive quando o plano foi editado depois da revisão** (editar não apaga o alerta; nesse caso o
  carimbo traz `sem_revisao: true` e `risco_anterior_desatualizado: 'alto'`); o chancelado anterior vira
  `substituido`. `versao` conta as chancelas do paciente e tipo (a primeira é v1). Chancelar sem nenhuma
  revisão continua permitido (carimbo `sem_revisao: true`); exigir a revisão de segurança da versão
  atual é decisão pendente do Rafael.
- Conflito de interesse: quem não é o super-admin não chancela nem recusa o plano gerado para a **própria
  conta** (`plano_cliente_checa_conflito`). O super-admin fica de fora de propósito: é o dono do produto e
  testa o fluxo de ponta a ponta com a própria conta.
- `recusar_plano_cliente(id, nota_publica, nota_interna?)`: a nota pública é obrigatória e é o
  que o cliente lê; a interna só a equipe.
- A equipe pode editar `titulo`, `conteudo` e `nota_interna` direto na tabela, só enquanto o plano
  está `aguardando`; `_governanca` (carimbo, revisão, triagem) é sempre preservada pelo banco. Editar
  `titulo`/`conteudo` exige o perfil da área do plano (`equipe_cobre_area`: treino = Educador Físico ou
  Fisioterapeuta; nutrição = Nutricionista; super-admin qualquer uma), a mesma regra de chancelar; qualquer
  membro continua podendo escrever a `nota_interna`. A fila (`fila_chancela`) devolve até 200 planos
  aguardando e, no histórico (chancelados/recusados), os 50 mais recentes.
- Revisão de segurança: `revisar-plano-seguranca` aceita `{ "tabela": "plano_cliente_chancela",
  "plano_id": "<uuid>" }`. O banco confere com o JWT de quem chama (`eh_equipe_cientifica`), só
  revisa plano `aguardando`, usa só o contexto que o cliente informou e grava a revisão presa ao
  hash do conteúdo (`registrar_revisao_plano` aceita a tabela nova).

### O que o cliente enxerga

- `meu_status_plano_cliente(tipo)` → `{ status: aguardando | chancelado | recusado | null,
  gerado_em, nota_publica }` do registro mais recente. **Nunca** devolve o conteúdo.
- `meu_plano_liberado(tipo)` → o plano **liberado do profissional** (`origem: "profissional"`),
  se houver; senão o **chancelado** mais recente (`origem: "equipe_myhealthid"`). O conteúdo
  passa por `gov_publico`, que remove triagem, revisão de segurança e justificativa e deixa
  `aprovacao.por_nome`, `por_perfil`, `em` e `versao`.

### Limites conhecidos

- **`pacientes.tipo_conta` só vira `wellness_premium` pelo servidor.** A RLS de `pacientes` deixa o
  cliente editar o próprio cadastro (sem limite de coluna) e qualquer usuário inserir uma linha com
  `terapeuta_id` = ele mesmo. O gatilho `pacientes_protege_tipo_conta` fecha isso para qualquer usuário
  logado, em INSERT e UPDATE: só o `service_role` (pagamento, `wellness-pagamento`) e o super-admin gravam
  `wellness_premium`; o cliente também não troca o tipo da própria conta nem se atribui como terapeuta.
  Consequência: **profissional não concede Premium ao paciente pela API** (não há esse fluxo no app; se
  virar necessário, deve passar por uma função própria). Validado em Postgres descartável com as policies
  reais (2 passos, 4 passos e INSERT). Defesa em profundidade que NÃO foi aplicada: exigir também uma linha
  ativa em `wellness_assinaturas`, porque contas Premium concedidas à mão podem não ter assinatura (decisão
  do Rafael).
- **Gerar tem um plano por vez na fila**, por tipo; não há cota diária. O custo de IA fica limitado ao
  ritmo da equipe (nova geração só depois de o anterior ser chancelado ou recusado). Um plano `aguardando`
  não tem prazo nem como o cliente cancelar: a equipe resolve chancelando ou recusando (pergunta 11
  abaixo). O Guardião de custo `monitor-ia-uso` acompanha o total.
- **Caminho do profissional é autodeclarado** (já era assim; pesa mais agora). Quem grava
  `profiles.perfil_profissional` no próprio perfil e insere um `pacientes` com `terapeuta_id` = ele mesmo e
  sem `user_id` é classificado como `profissional` e recebe o plano direto, sem Premium, sem chancela e com
  o `override` da triagem. Mitigações possíveis, todas dependentes de decisão do Rafael: exigir
  `perfil_profissional_confirmado` validado por super-admin para o ramo `profissional` das edges; tratar
  como cliente quando o paciente alvo não tem nenhum atendimento registrado.
- **A área de cada membro vem de `profiles.perfil_profissional`**, que o próprio membro edita enquanto não
  está confirmado. A flag `equipe_cientifica` é do super-admin, mas o perfil que habilita treino ou nutrição
  não. Alternativa: áreas por membro mantidas só pelo super-admin (ex.: `equipe_areas text[]`).
- Não existe ainda aviso ao cliente quando o plano é chancelado ou recusado: ele vê o status ao abrir o
  portal.

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
  profissional e o caminho para a `TriagemSegurancaCard`; o cliente nunca sobrepõe. Depois
  de gerar, mostra o status por tipo (`meu_status_plano_cliente`) e só exibe o plano quando
  chancelado (`meu_plano_liberado`). O profissional da equipe científica trabalha na fila
  `/chancela` ("Fila de chancela MyHealthID").
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
8. ~~Free no período de teste (7 dias) pode gerar plano sozinho?~~ **Decidido em
   08/10/2026: não.** Só o Premium gera, e o plano passa pela chancela da equipe científica
   (`POLITICA_PLANO_CLIENTE.tiposContaQueGeram`).
9. Fora do escopo desta entrega, **sem triagem de bloqueio**: `gerar-dicas-paciente`
   (dicas gratuitas de Fortalecimento/Mobilidade), `gerar-diretriz-treino`,
   `gerar-diretriz-nutricional`, e os treinos publicados direto em `studio_treinos`.
10. O limite de dor do app está em dois valores: a escala da sessão
    (`PacienteExercicios.tsx:390`), o texto do plano e o acompanhamento usam "acima de 6"; os
    históricos (`PacienteExercicios.tsx:548` e `PacienteEngajamentoTab.tsx:265`) destacam
    "acima de 5". Falta decidir um valor único.
11. Quem integra a equipe científica e qual o prazo esperado para chancelar? Hoje a fila não
    tem prazo nem aviso ao cliente.
12. O carimbo do super-admin fora do perfil dele aparece como "Administrador(a)". É o texto
    desejado no selo, ou o Rafael prefere exigir um profissional da área?
13. A bioimpedância que o próprio cliente cadastra (`body_composition`) deveria entrar no plano
    alimentar do cliente? Hoje fica de fora (é tratada como exame).
