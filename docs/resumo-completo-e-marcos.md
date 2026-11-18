# Resumo Completo e Linha do tempo clínica (etapas 1 e 2)

Pedido do Rafael: no perfil do paciente, aba **Avaliação > Clínico**, o cartão "Resumo Clínico" ganha uma **versão mais
completa**, e ao lado entra uma **linha do tempo** com os marcos históricos do paciente, feitos a partir das respostas do
cliente no MyID, da avaliação presencial e dos outros formulários.

Decisões do Rafael para esta etapa: **regra fixa, sem IA** (nenhuma chamada a IA, nenhuma edge function nova, nenhum dado de
saúde enviado a provedor externo); **só o profissional vê**, no perfil do paciente; o cliente **não** vê nada disto.

**Etapa 2:** o profissional pode **confirmar, com a data real, uma cirurgia ou internação que o cliente relatou**. É a única escrita
ligada à linha do tempo, e tem uma seção própria: "Confirmar com a data real". O que a etapa 1 diz abaixo sobre "só leitura" vale para a
tela e para o Completo; a escrita da etapa 2 mora num hook à parte.

## O que é

| Peça | Onde aparece | Pode editar? |
| --- | --- | --- |
| **Resumo** (o de sempre) | cartão "Resumo Clínico", seletor **Resumo \| Completo** | sim, pelo lápis, como antes (e continua indo ao prontuário, "Sincronizado") |
| **Completo** | mesmo cartão, seletor em "Completo" | **não**: só leitura, botão "Copiar" |
| **Linha do tempo clínica** | cartão logo abaixo, na aba Clínico; sem avaliação por voz ela aparece sozinha | não |

Tudo é **calculado na hora**. O Completo e a linha do tempo **só leem**: não gravam nota de prontuário, `avaliacoes_voz` nem coluna
nova, e nenhuma migração foi criada. **Há duas gravações ligadas a este assunto, e nenhuma delas é do Completo nem da tela da linha do
tempo em si**: (1) o campo opcional "Data do diagnóstico" do **cartão de CID** (ver "A data do diagnóstico que o banco preenche
sozinho"); (2) a **confirmação do profissional** (etapa 2, ver "Confirmar com a data real"): **uma linha nova** em
`historia_vida_paciente`, gravada por um hook próprio (`useConfirmarMarcoClinico`) que a página liga à linha do tempo por props de
função. A linha do tempo continua sem importar o cliente do banco e sem nenhuma palavra de escrita (um teste confere). O Completo e a linha do tempo **não passam** por
`sincronizarProntuario`, `toggleConfirmacao`, `salvarEdicao` nem pela pré-confirmação, e **não são uma seção** de `SECOES`
(`AvaliacaoSecoesEditaveis.tsx`): essas seções são pré-confirmadas e vão sozinhas ao prontuário, que o cliente pode ler.

Avisos fixos no Completo (na tela):

- "Montado pelo app a partir das respostas; não vai para o prontuário." (também vai no fim do texto copiado)
- "Os selos Prontuário e Sincronizado do cabeçalho valem só para o Resumo." Só na tela: com o Completo aberto os selos do
  cabeçalho do cartão continuam à vista e poderiam sugerir que a versão longa foi ao prontuário. O texto copiado sai do app e os
  selos não saem junto, por isso o aviso não vai nele.

## De onde vem cada coisa

Cada fonte é lida em separado (`src/hooks/useFontesClinicas.ts`, só `select`). Se uma falha, aparece "Não consegui ler ..." e as
outras continuam. (A história de vida é lida em **duas leituras**, por causa das confirmações: ver "Como a linha do tempo lê".) (Os achados do Avatar são uma leitura **à parte e só de contagem**, nunca uma fonte de marcos: ver "Aviso dos
achados do histórico".) A leitura das datas de conclusão do MyID (`avaliacoes_identidade`) também é uma fonte à parte: se falhar, o aviso
diz "as datas de conclusão do MyID" e os MyIDs aparecem como "último registro".

| Fonte | Vira | Origem / selo |
| --- | --- | --- |
| `pacientes.historico_clinico.cirurgias` (ano válido) | marco **fato**, só o ano; **some da lista quando o profissional confirma a data real** (ver "Confirmar com a data real") | cliente: "Relatado pelo cliente, não revisado" |
| `pacientes.historico_clinico.ultimo_envio` | marco **registro** ("Último envio do histórico clínico (pelo cliente)") | cliente |
| `myid_avaliacoes` (status `concluido`) + `avaliacoes_identidade.created_at` ligada a ele | marco **registro** "MyID concluído" (data do histórico); sem a ligação, "MyID (último registro)" com `updated_at` e aviso | cliente |
| `avaliacoes_voz` (só as do profissional, mesmo filtro da avaliação atual) | marco **registro** | profissional: "Registrado pelo profissional" |
| `historia_vida_paciente.data_evento` | marco **fato**. A linha que é uma **confirmação** (marca no `metadata`) lê a precisão do `metadata` e substitui o relato do cliente | profissional; a confirmação tem o selo próprio "Data confirmada pelo profissional · texto do cliente" |
| `diagnosticos_paciente` **ativos** e do tipo **principal** ou **secundário**, com `data_diagnostico` válida (e, nas linhas criadas **antes de 18/11/2026**, **diferente do dia do cadastro**) | marco **fato** | profissional |
| `exames_presenciais.data_exame` | marco **registro** | profissional |
| `exames_importados` com `status = 'processado'` e `data_exame` válida | marco **registro**, com o aviso "Data lida automaticamente do documento; confira no arquivo." | profissional |
| `testes_funcionais_paciente.data_teste`, `escalas_psicologia.data_aplicacao` | marco **registro** | profissional |

- **fato** = o acontecimento clínico com a data que o registro traz (cirurgia de 2022, diagnóstico em 03/2019): marcador **cheio**.
- **registro** = quando algo foi feito ou registrado no app: marcador **vazado** e rótulo "registro no app".
- Do MyID mais recente concluído (`respostas_brutas`) vêm o que o cliente escreveu (queixa, "quando começou", "o que fazia"), a
  faixa de duração e as mudanças das últimas 4 semanas, com os **rótulos exatos de `Bloco1.tsx`** (um teste confere). Na linha do
  tempo, a queixa e as respostas sobre o começo vão para o cartão **"Como começou"** (veja abaixo). **Qual MyID é o mais recente**:
  ver "Qual MyID é o último".
- O **Resumo Completo** junta: queixa e história, dor, funcionalidade, aspectos psicossociais, exame e avaliação do profissional
  (da última avaliação, em `resultado`), e a parte **"Relatado pelo cliente (não revisado)"** com MyID, histórico clínico e
  história atual. Os textos passam como estão; só os rótulos de seção são fixos.

### Diagnósticos: só os ativos, principais ou secundários

Valores conferidos em `20260607211619`: `tipo` é `principal | secundario | suspeita` e `ativo boolean NOT NULL DEFAULT true`. No app,
**remover** um diagnóstico é `update ativo = false` (`DiagnosticosCID10Card.tsx`), e a lista dele usa `.eq('ativo', true)`.

- Só entra o diagnóstico **ativo** e do tipo **principal** ou **secundário**. A leitura já pede só esses (`.eq('ativo', true)`,
  `.in('tipo', ...)`), para removido e suspeita não gastarem as 50 vagas, e a camada de marcos confere de novo.
- **"suspeita" fica de fora**: é hipótese, não diagnóstico. A linha do tempo não pode mostrar uma hipótese como fato clínico.
  Tipo nulo ou desconhecido também fica de fora (na dúvida, não se afirma diagnóstico).
- **`ativo` vazio fica de fora**, como na lista do próprio app. A coluna é `NOT NULL DEFAULT true`, então vazio só aparece se a
  leitura não trouxe a coluna; nesse caso não se afirma nada.
- Diagnóstico removido ou suspeito não vai nem para "Sem data" nem para o aviso de registros ignorados: some por inteiro.

#### A data do diagnóstico que o banco preenche sozinho (e o campo novo no cartão de CID)

`diagnosticos_paciente.data_diagnostico` é `date DEFAULT CURRENT_DATE` (migração `20260607211619`; **aceita `null`**: a coluna não é
`NOT NULL` e nenhuma migração posterior a mudou). **Até o corte, nenhum código do app a gravava**: o `insert` de
`DiagnosticosCID10Card.tsx` não enviava a coluna, então o banco a preenchia com o **dia do cadastro**. Sem tratamento, todo
diagnóstico ativo viraria um marco "fato" no dia em que foi cadastrado no app, e o Rafael pediu para evitar isso (data que o sistema
preenche sozinho não é data real).

**O campo "Data do diagnóstico" (decisão do Rafael).** O formulário de adicionar do cartão de CID ganhou um campo **opcional** de data,
**vazio por padrão**, com a ajuda "Opcional. Sem data, o diagnóstico fica em Sem data na linha do tempo." Vazio continua "sem data";
preenchido vira marco com a data real. O campo é um `input date` de 44 px, com `max` = hoje no fuso do Brasil (`hojeLocalISO`) e `min`
1900-01-01; data no futuro ou antes de 1900 é recusada (aviso na tela e toast, nada é gravado), pela mesma régua da linha do tempo
(`erroDaDataDigitada`), para o que se grava nunca cair em "data inválida" ali.

- **O `insert` manda SEMPRE a coluna**: a data escolhida ou `null` quando vazio. É isso que impede o `DEFAULT` do banco de preencher com
  o dia do cadastro.
- **Cada diagnóstico da lista mostra a data** ("Data do diagnóstico: 04/03/2019" ou "sem data") e um botão de 44 px, **"Informar data"**
  (sem data) ou **"Corrigir data"** (com data). Ele abre um editor com **Salvar data**, **Limpar data** (só onde há data; grava `null`) e
  **Cancelar**. A gravação é um `update` de `data_diagnostico` com `.eq('id', ...)` **e** `.eq('paciente_id', ...)`: só o diagnóstico
  certo. Erro do banco aparece em toast e **não** invalida nada; sucesso invalida a lista e a linha do tempo (`invalidarFontesClinicas`).
  "Salvar data" fica desligado com o campo vazio (tirar a data é o "Limpar data").
- **Aviso na lista:** "Pode ter sido preenchida pelo sistema" aparece ao lado da data **só** quando
  `dataDoDiagnosticoPodeSerDoSistema` vale para aquela linha: a mesma função que a linha do tempo usa (que por dentro reaproveita
  `coincideComODiaDoCadastro`). A lista mostra o valor que está no banco, sem esconder nem inventar nada.
- Nada de IA, nenhuma migração, nenhuma mudança do que o cliente vê.

**O corte: 18/11/2026 à meia-noite no Brasil (`2026-11-18T03:00:00Z`).** A constante `INSTANTE_DA_DATA_EXPLICITA_DO_DIAGNOSTICO`
(`src/lib/resumoClinico/tipos.ts`) é o instante a partir do qual toda linha foi gravada **com a coluna explícita** (o deploy do campo
acontece antes dele). A regra de `marcos.ts` passa a depender de `created_at`:

| `created_at` da linha | `data_diagnostico` igual ao dia do cadastro | `null` ou vazio |
| --- | --- | --- |
| **a partir do corte** (válido, com fuso, `>=` o instante) | **marco "fato"** com a data real (diagnosticou e registrou no mesmo dia) | "Sem data" com "A data do diagnóstico não foi informada" |
| **antes do corte**, inválido, ausente, sem fuso ou no futuro | regra antiga: "Sem data" com "A data do diagnóstico é a do dia do cadastro no app e pode ter sido preenchida pelo sistema" | "Sem data" com "não foi informada" |

- A virada é exata: `2026-11-18T03:00:00Z` (ou `2026-11-18T00:00:00-03:00`) já é depois do corte; um segundo antes
  (`02:59:59Z`, `23:59:59-03:00` do dia 17) ainda é a regra antiga.
- Depois do corte continuam valendo as regras de data: **no futuro, inexistente ou antes de 1900** vai para "Sem data" com "A data do
  diagnóstico registrada não é válida"; data antiga explícita (2019-03-04) é marco; removido e suspeita seguem fora de tudo.
- **`created_at` ilegível** (nulo, vazio, texto, só a data sem hora, hora **sem fuso** ou data no futuro) **não conta como depois do
  corte**: sem o instante exato, vale a regra antiga, o lado cauteloso (a data coincidente fica em "Sem data"). Sem o dia do cadastro
  (nulo, vazio, texto), a regra antiga não tem com o que comparar e só a data válida decide (ela vira marco), como sempre foi.
- Regra antiga, para as linhas de antes do corte: `data_diagnostico` só vale como data do fato quando é **diferente do dia de
  `created_at`**, tanto no **dia em UTC** (o `CURRENT_DATE` usa o fuso do banco) quanto no **dia do Brasil**. Igual a qualquer um dos
  dois: o diagnóstico vai para a faixa **"Sem data"**, com "Registrado no app em dd/mm/aaaa" (o mesmo caminho do diagnóstico sem data) e a
  nota acima. Isso vale também quando a data seria "amanhã" para o Brasil (entre 21h e meia-noite o `CURRENT_DATE` em UTC já é o dia
  seguinte): a nota diz que veio do cadastro, não que é "inválida". Uma data bem diferente do dia do cadastro continua marco **fato**.
- **Limitação assumida:** o diagnóstico criado **ANTES do corte** cuja data real coincidiu por acaso com o dia do cadastro (o
  profissional cadastrou no mesmo dia em que diagnosticou) **continua em "Sem data"**: não há como separar esse caso do preenchimento
  automático sem gravar algo novo. Informar ou corrigir a data de um CID antigo pelo campo novo **não muda isso** se a nova data for o
  próprio dia do cadastro dele: a linha segue em "Sem data" (com a nota), porque o app não tem como saber que foi o profissional.
  Uma data de outro dia vira marco normalmente.
- **Depende de o deploy do campo acontecer antes do corte.** Linha criada depois do corte por um app antigo (aba aberta com a versão
  anterior) teria a data preenchida pelo banco e seria lida como real. É o risco aceito pelo dono ao escolher a data do corte.

### Exames importados: só os que terminaram com sucesso

`exames_importados.status` tem `DEFAULT 'pendente'` (`20260607203748`) e a edge function `import-exame` grava `'processado'` ao
terminar. Só `status = 'processado'` entra. Pendente, erro e qualquer outro valor (ou coluna ausente) ficam de fora, sem aparecer
em "Sem data" nem no aviso de registros ignorados. A camada de marcos apara espaços nas pontas (`" processado "` conta), mas não aceita
outra caixa (`"Processado"` fica de fora); a leitura já pede o valor exato.

**A data do exame importado é lida por IA.** `exames_importados.data_exame` vem do JSON que o Gemini extrai do arquivo
(`supabase/functions/import-exame`, campo `data_exame` "YYYY-MM-DD ou null"); ninguém a digita. O marco continua **registro** com essa
data, e o detalhe traz "Data lida automaticamente do documento; confira no arquivo.", para o profissional conferir no arquivo. Sem data
(a IA devolveu `null`), vai para "Sem data" como antes.

### Relato do paciente no portal não é avaliação presencial

`avaliacoes_voz` guarda também o que o próprio paciente conta no portal (`resultado._meta.origem` em `portal_paciente_historia` ou
`autocadastro_paciente`). Duas barreiras: o filtro `.or(FILTRO_SO_PROFISSIONAL)` no servidor e, caso o filtro não seja aplicado, a
leitura traz a origem por **caminho JSON com apelido** (`origem_do_relato:resultado->_meta->>origem`, sem baixar o `resultado`
inteiro, que é pesado) e a camada de marcos descarta o relato do paciente. Um teste usa um banco que ignora o `.or` para provar a
segunda barreira.

## Regras de data (estritas)

- **Ano de cirurgia** (`cirurgias.items[].ano`): só vira data se for **exatamente 4 dígitos** entre **1900 e o ano de hoje**
  (número ou texto com espaços nas pontas). "2O22", "dois mil", "há 2 anos", "20", "2099", "1899", "2022-13", vazio, `null`,
  objeto: **"Sem data"**, com o texto original.
- **Datas de tabela** (`data_evento`, `data_diagnostico`, `data_exame`, `data_teste`, `data_aplicacao`, `created_at`): só valem
  se forem datas **válidas** (rejeita "0000-00-00", dia que não existe, ano antes de 1900 e **depois de hoje**). Instante com
  fuso (`created_at`) vira o **dia no Brasil**.
- **Texto livre do cliente nunca vira data**: o que o cliente escreveu sobre o começo do quadro (`historia_atual.inicio`,
  `bloco_1_quando_data`, `bloco_1_quando_desc` e a faixa `bloco_1_duracao` do MyID) **não é marco e já não fica em "Sem data"**: vai
  para o cartão **"Como começou"** (`LinhaDoTempo.comoComecou`), como o cliente escreveu. A faixa do MyID (`lt6w`, `6_12w`,
  `3_12m`, `gt1y`) aparece com o rótulo humano ("Mais de 1 ano"). As queixas (`historia_atual.queixa` e `bloco_1_queixa`) também
  vão para o cartão. (Uma versão anterior deste documento dizia que a queixa do MyID ia para "Sem data": o código nunca fez isso.
  Ela não aparecia na linha do tempo; só no Resumo Completo.) Em "Sem data" ficam só a cirurgia do cliente com o ano que não é
  ano de verdade e o diagnóstico e o exame importado do profissional sem a data do fato.
- **Diagnóstico e exame importado do profissional sem data do fato** (sem `data_diagnostico` / `data_exame`, ou com data inválida
  ou no futuro, ou, no diagnóstico de antes do corte de 18/11/2026, igual ao dia do cadastro: ver "A data do diagnóstico que o banco preenche sozinho") **não viram marco com a data de `created_at`**: a data em que foi gravado no app não é a data do fato. Vão para a
  faixa **"Sem data"** com o próprio selo (**"Registrado pelo profissional"**) e o detalhe diz o que faltou e quando foi gravado,
  por exemplo: "Diagnóstico · A data do diagnóstico não foi informada · Registrado no app em 03/02/2026" (dia do Brasil). Se
  `created_at` também não for uma data, a frase "Registrado no app em ..." simplesmente não aparece.
- **Os outros registros sem data válida** (história de vida, exame presencial, teste, escala, avaliação do profissional e MyID concluído)
  **ficam de fora** e a tela avisa quantos ("N registros ficaram de fora: data ausente, inválida ou no futuro."). Diagnóstico e exame
  importado sem data **não** entram nessa contagem: estão em "Sem data". Para o aviso dizer **quais** foram, `LinhaDoTempo` traz,
  além do contador `ignorados`, a lista `registrosIgnorados` (sempre com `ignorados` itens, na ordem em que foram lidos). Cada item
  tem `id` (o mesmo que o marco teria), `fonte`, `rotulo` (como o profissional reconhece o registro: o título da história de vida, o
  nome do exame, do teste ou da escala; "Avaliação presencial" e "MyID" nos outros) e `motivo`, sempre **"data ausente, inválida ou
  no futuro"**. O rótulo é o texto do próprio registro, sem corte.
- **Nenhum marco recebe a data de hoje por falta de data.**
- A faixa **"Sem data"** mistura itens do cliente e do profissional; **cada item mantém o próprio selo de origem**. Fica recolhida
  por padrão, mas o bloco fica montado (só escondido) para o botão apontar para um id que existe.
- `eventos_clinicos_anatomicos` (os achados do Avatar) **não é lido para marcos nem para datas**: os achados do histórico relatado
  gravam a data do **envio** como data de início e não dá para separar, com certeza, o que o profissional datou de verdade.
  **Há uma única exceção, só de CONTAGEM e sem nenhuma data**: o aviso "N achados do histórico aguardando a sua revisão" (ver
  "Aviso dos achados do histórico"). A tabela continua sem virar marco, sem entrar em "Sem data" e sem entrar em "Como começou".
- Ordem: **mais recente primeiro** (a do resto do app), agrupada por ano; dentro do ano, o que tem dia vem antes do que só tem o
  ano. Empate de data desempata pelo id **em ordem natural** (os números do id valem pelo valor: `cirurgia:2` antes de `cirurgia:10`,
  e não o contrário, como no texto puro); id igual é empate (o comparador devolve 0 e a ordem de chegada é mantida). A tela mostra
  os 6 mais recentes e "Ver todos".

### Data do MyID: "concluído" só com a data do histórico

`myid_avaliacoes.updated_at` **não** é data de conclusão: o gatilho `trg_myid_avaliacoes_updated_at` o muda em **qualquer** update.
Exemplos reais: `backfill-myid-efi` regrava `resultado_processado` meses depois, e as migrações de recálculo
(`20260924150000_recalculo_myid_efi.sql` e as seguintes) fizeram `UPDATE` em muitos MyIDs. A tela diria "concluído" numa data errada.

O que foi investigado (conferido nas migrações e nas funções):

- `avaliacoes_identidade.concluido_em` **não serve**: o `complete-myid` não a grava (fica nula nas linhas que ele cria). Só o fluxo por
  fases (RPC de fase 4) a preenche com `now()`, e a migração `20260509234627` a preencheu nas linhas antigas com `COALESCE(updated_at,
  created_at)`, que tem o mesmo defeito.
- `avaliacoes_identidade.data_avaliacao` (texto) o `complete-myid` grava com `hojeBR()`, o dia do Brasil em que a linha é inserida.
- `avaliacoes_identidade.created_at` é gravado no **mesmo pedido** que conclui o MyID (o `complete-myid` insere a linha e só depois
  marca o MyID como `concluido`) e **nenhum update o muda** (o `backfill-myid-efi` e a migração só mexem em outras colunas). É a data
  confiável. A ligação é `avaliacoes_identidade.myid_avaliacao_id` (migração `20260925190000`, com índice único), gravada pelo
  `complete-myid` (e, nas linhas antigas, pelo vínculo retroativo da própria migração, por respostas iguais). A linha que o fluxo por
  fases cria já na primeira fase (com `created_at` do começo) não tem essa ligação, então não entra nesta data.
- A RLS de `avaliacoes_identidade` é `auth.uid() = terapeuta_id`: o profissional só lê as linhas dele. Por isso a leitura filtra por
  `terapeuta_id` e `myid_avaliacao_id` não nulo e pede só `id, myid_avaliacao_id, created_at` (nunca `dados_avaliacao`).

Decisão: **uma leitura a mais, só `select`, como fonte isolada** (`vinculosMyid`).

- Com a linha ligada ao MyID: marco **"MyID concluído"**, com o dia do Brasil de `avaliacoes_identidade.created_at` e o detalhe
  "Concluído e registrado no histórico do paciente." (antes era "Data em que a conclusão foi registrada no histórico do paciente.",
  comprido e repetido a cada marco; a data já está na linha de cima).
- Sem a linha (MyID antigo sem ligação, MyID concluído sem profissional, linha de outro profissional pela RLS, leitura que falhou, data
  inválida): marco **"MyID (último registro)"** com `updated_at` e o aviso **"Data do último registro; pode ser posterior à conclusão."**
  A palavra "concluído" não aparece. O `created_at` do próprio MyID não é usado de reserva (é quando o MyID foi criado, antes de o cliente
  responder); sem `updated_at` válido o MyID é ignorado e contado no aviso de registros ignorados.
- **Resíduo conhecido:** o `complete-myid` também "repara" um MyID marcado concluído que nunca chegou ao histórico (reenvio depois de falha
  antiga). Nesse caso a linha do histórico nasce no dia do reparo, e esse dia aparece como a data. O detalhe é literal (data em que a
  conclusão foi **registrada no histórico**), e não existe, no banco, outra data melhor: o `updated_at` também é regravado no reparo.

### Como começou (o começo do quadro, sem data)

Antes, quatro itens do cliente iam para "Sem data": "Há quanto tempo começou (história atual)", a faixa de duração do MyID, o texto
"quando começou" do MyID e "o que estava fazendo quando notou". Misturados com os outros itens sem data, pareciam registros
perdidos e escondiam o que importa: o que o cliente disse sobre o começo. Agora `montarLinhaDoTempo` devolve
`comoComecou` (nulo se não há nada), com:

- `queixas`: a queixa da história atual ("Queixa principal (história atual)") e a do bloco 1 do MyID ("Queixa principal (MyID)");
- `inicio`: as respostas de início, cada uma com o **rótulo exato** de antes ("Há quanto tempo começou (história atual)", "Quando
  começou (faixa escolhida no MyID)", "Quando começou (texto escrito no MyID)", "O que estava fazendo quando notou (MyID)");
- cada item é `{ id, rotulo, texto, fonte, origem: 'cliente', revisado: false }`: o texto passa como o cliente escreveu (só sem
  espaços nas pontas) e continua com o selo "Relatado pelo cliente, não revisado";
- `diaDoMyid`: o dia do MyID de onde vieram as respostas da fonte `myid`, pela **mesma regra do marco "MyID concluído"**: o dia do
  Brasil de `avaliacoes_identidade.created_at` ligada a ele. Sem a ligação (ou com data inválida) fica **nulo**: nunca o `updated_at`
  do MyID. Também fica nulo se só há respostas da história atual (elas não têm data).

Regras: **nenhuma resposta vira data** e nada é somado, comparado ou escolhido. Se o cliente diz "mais de 3 anos" na história atual e
"mais de 1 ano" na faixa do MyID, as duas aparecem, lado a lado: a divergência é justamente o que o profissional precisa ver. A
mesma queixa dita nos dois lugares também aparece duas vezes (não há deduplicação). O cartão existe se há ao menos uma queixa ou
uma resposta de início. Os ids dos itens do MyID seguem `myid:<id>:<campo>` (`queixa`, `duracao`, `quando`, `o_que_fazia`) e os da
história atual são `historia_atual:queixa` e `historia_atual:inicio`.

### Título da cirurgia do cliente

A cirurgia que o cliente relata no histórico clínico traz só o texto dele ("Coluna"), que sozinho não diz do que se trata.
`tituloParaExibir(item)` (em `marcos.ts`) devolve o título para a tela: para a cirurgia do cliente (`fonte = historico_clinico`,
`origem = cliente`, `tipo = cirurgia`, no marco e no item de "Sem data"), **"Cirurgia ou internação: Coluna"**. Se o texto do cliente já
começa com "Cirurgia" ou "Internação" (sem acento e sem caixa; também no plural), o título fica como está, para não repetir
("Cirurgia no joelho" continua "Cirurgia no joelho"). "Cirurgião ..." não conta como começar com "Cirurgia". O texto do cliente
nunca é reescrito e **`marco.titulo` não muda**: quem mostra o marco usa a função. Qualquer outro marco ou item mostra o próprio
título. O item de "Sem data" da cirurgia ganhou `tipo: 'cirurgia'` só para a função reconhecê-lo sem adivinhar pela fonte.

### Qual MyID é o último

O MyID cujas respostas aparecem (queixa, início, Resumo Completo) e os até 20 MyIDs dos marcos são escolhidos por **`created_at` do
mais novo para o mais antigo, com desempate pelo maior `id`**, entre os concluídos. Antes era `updated_at`, que o gatilho muda em
qualquer update: um backfill ou recálculo meses depois faria um MyID antigo parecer o último, e a linha do tempo e o Resumo Completo
mostrariam respostas de um MyID e a data de outro. As duas leituras do MyID usam a mesma ordem, então a linha do tempo e o Resumo
Completo concordam sobre qual é o último (um teste confere, com `updated_at` reescrito). O corte de 20 também tira o mais antigo por
`created_at`.

Limite conhecido: `created_at` é de quando o MyID foi **criado** (o fluxo em fases cria a linha na primeira fase), não de quando foi
concluído. O "último criado" costuma ser o último concluído, mas um MyID antigo deixado pela metade e terminado depois de outro mais
novo faria as respostas virem do mais novo, embora a conclusão mais recente seja a do antigo. A data de conclusão confiável (o vínculo
com o histórico) fica só no marco; usá-la para escolher exigiria cruzar as duas leituras e, hoje, é um caso raro.

### Chave estável da cirurgia do cliente

O id do marco de cirurgia do cliente usava a **posição** do item na lista (`historico_clinico:cirurgia:0`): se o cliente apagasse uma
cirurgia mais acima, todas as chaves de baixo mudavam. O formulário do cliente (`HistoricoClinicoCard.tsx`) grava um `id` em cada item
(`{ id, tipo, ano, complicacoes }`). Agora a leitura lê esse `id` e a chave é `historico_clinico:cirurgia:id:<id>`. Itens antigos,
sem `id` (ou com `id` vazio ou que não é texto nem número; um número vira texto), e o segundo de dois itens com o **mesmo** `id` caem na posição
(`historico_clinico:cirurgia:<posição>`, a posição no array original, contando itens-lixo do meio). O prefixo `id:` impede que um id só
de números colida com a posição de outro item. Item sem `id` continua com a chave instável se o cliente apagar um item acima dele:
corrigir isso exigiria gravar o id no histórico do cliente, o que esta etapa evita. (A **chave da confirmação** do item sem `id` é outra, e
depende do conteúdo do item: ver "Confirmar com a data real". O id do marco não mudou.)

### Marcos que NÃO existem de propósito

- **"História atual atualizada pelo cliente" foi removido**: `historia_atual.atualizado_em` é regravado pelo autosave do cliente a
  cada pausa na digitação, então não marca nenhum momento histórico. (O texto de `historia_atual.inicio` aparece no cartão "Como começou",
  não em "Sem data".)
- O `historico_clinico.atualizado_em` também não vira marco, pelo mesmo motivo.
- **"Último envio do histórico clínico (pelo cliente)" fica**: `ultimo_envio` só é gravado no envio explícito
  (`HistoricoClinicoCard.tsx`, botão de enviar); o autosave grava `{ ...dados, atualizado_em }` e só devolve o `ultimo_envio` que já
  estava lá, sem mudar o valor.

### Aviso dos achados do histórico (a única exceção: só a contagem)

Decisão do Rafael: a linha do tempo mostra um aviso curto, **"3 achados do histórico aguardando a sua revisão"** (singular: "1 achado
do histórico aguardando a sua revisão"), com o botão **"Abrir o Avatar"**, que leva ao Avatar do mesmo paciente, onde já existe a fila
de revisão. Nada é gravado, não há IA e **nenhuma data de achado é lida ou mostrada nem vira marco**.

**Por que a contagem é segura (e as datas continuam proibidas).** O que viraria "fato falso" é a **data**: o achado do histórico
relatado grava a data do envio como data de início, e um marco com essa data diria que algo aconteceu naquele dia. Um número não diz
quando nada aconteceu, e o texto do aviso só diz que há itens **esperando a revisão do profissional** (nunca "confirmado", nunca
"diagnóstico"). Por isso só a contagem entra; as datas seguem fora:

- A leitura pede só `tipo_diagnostico`, `status` e três marcas do `metadata` por caminho JSON com apelido
  (`revisado_por_ids`, `descartado`, `rejeicoes`), sem baixar o `metadata` inteiro (texto do paciente, história estruturada...). **Nunca**
  `data_inicio`, `data_resolucao`, `created_at`, `updated_at` nem `descartado_em`; não filtra nem ordena por data (ordena por `id`).
  Limite conhecido e honesto: `rejeicoes` é uma lista e cada item traz o instante da rejeição (a data da **revisão**, não a do achado).
  Ele viaja na leitura, mas o código só conta quantos itens a lista tem, a função devolve **só números** e nada disso é guardado nem
  mostrado.
- Os marcos, a faixa "Sem data" e o cartão "Como começou" **não mudam**: um teste compara a linha do tempo inteira com e sem achados
  aguardando e confere que o texto e a data do achado não aparecem em lugar nenhum.

**Onde mora a regra da fila (uma só).** `src/lib/avatar/filaDeRevisao.ts`, função pura `filaDeRevisao(eventos, profissionalId)` (mais
`totalAguardandoRevisao`). O `AvatarClinicoCard` perdeu o código que estava escrito dentro dele e usa a função, e a leitura do aviso
usa a mesma: o número do aviso não tem como divergir do que o Avatar mostra. A regra:

| Parte | Entra quando |
| --- | --- |
| Relato do paciente | `tipo_diagnostico = relato_paciente` e `status` diferente de `resolvido` |
| Histórico relatado (a fila) | `tipo_diagnostico = historico_relatado`, **este** profissional ainda não revisou (`revisado_por_ids`), não foi descartado (`descartado`) e tem **menos de 3** rejeições |
| Descartados por consenso (só para consulta no Avatar) | `historico_relatado` com `descartado` ou **3 rejeições ou mais** |

O total do aviso é relato + histórico (os descartados não contam). O comportamento do Avatar é o mesmo de antes: um teste guarda uma
cópia literal do código antigo e compara com a função em dezenas de milhares de combinações (tipo, status, profissional, marcas do
`metadata`, inclusive com tipo errado); a única diferença é onde o código antigo quebrava com `TypeError` (`revisado_por_ids` que não é
lista nem texto): a função não lança e trata como "este profissional não revisou". O Avatar também foi montado de verdade, antes e
depois da troca, com o mesmo resultado (`avatarFilaDeRevisaoTela.test.tsx`).

**A leitura.** `lerAchadosParaRevisao` e o hook `useAchadosParaRevisao`, em `useFontesClinicas.ts`:

- **Só do paciente aberto e do profissional logado** (`paciente_id` e `terapeuta_id`; é o mesmo conjunto que o Avatar enxerga pela RLS) e só
  dos dois tipos da fila. Só `select`.
- **À parte de `lerFontesClinicas`**: o aviso não derruba nem atrasa a linha do tempo, que continua sem tocar a tabela dos achados.
- **Limite de 200, com limite + 1** como as outras fontes: se a linha extra vier, conta só as 200 e o aviso passa a "Pelo menos N achados
  ..." com a frase **"Achados do histórico: contei só os 200 primeiros; pode haver mais aguardando a sua revisão."** junto dos outros avisos de
  corte (não diz "mais recentes", porque nenhuma data é lida para ordenar). Exatamente 200 não é corte.
- **Falha isolada**: entra no aviso de falhas como **"os achados do histórico"** ("Não consegui ler os achados do histórico.", ou junto das
  outras fontes: "as escalas e os achados do histórico"); nesse caso não há aviso de achados nem botão, e o resto da linha do tempo segue.
- **Cache**: a chave é `['eventos-anatomicos', paciente, 'fila-de-revisao', profissional]`. Tudo que o Avatar já invalida depois de
  confirmar, ajustar ou rejeitar um achado (`['eventos-anatomicos', paciente]`) refaz esta contagem sem mexer nesses pontos; e a resposta não
  é guardada depois de sair da tela (`gcTime: 0`), para voltar do Avatar nunca mostrar o número de antes da revisão.

**A tela.** `AvisoDosAchadosDoHistorico.tsx`, logo abaixo do aviso "Não consegui ler ..." e acima de "Como começou", dos marcos e de "Sem data".
Celular (390 px): texto que quebra linha (sem `truncate` nem `line-clamp`), botão de 44 px (`min-h-11`) na largura toda, foco visível e
`aria-describedby` apontando para o texto do aviso. **O botão só existe** quando há a função `onAbrirAvatar` **e** a contagem é maior que
zero **e** a leitura terminou sem falha: sem a função aparece só o texto; com contagem 0, durante a leitura ou com falha não aparece nada
do aviso. A linha do tempo não navega: recebe a função por prop (o dono da aba é quem sabe trocar de aba), então os arquivos dela
continuam sem `window.open`, rota nem `/paciente`.

**Como chega ao Avatar.** O Avatar do profissional só existe na **Visão Geral** do perfil, na sub-aba **"Corpo"** (a aba Avaliação, onde fica
a linha do tempo, não o tem). `PacientePerfil` passa `onAbrirAvatar` (via `AvaliacaoVozAtual`, nas três formas da aba, e
`AvaliacaoSecoesEditaveis`) e, ao clicar, troca para a Visão Geral (`setActiveTab('')` e `/pacientes/<id>`), pede a sub-aba do Avatar
(`abrirNoAvatar`, que passa por `PacienteDashboardIdentidade` até `PatientIntegratedDashboard`) e rola até as abas. O pedido vale uma vez:
sair da Visão Geral o esquece. **O botão some quando o Avatar não está lá**: `visaoGeralMostraOAvatar` (`src/lib/avatar/irParaOAvatar.ts`)
confere se o layout do profissional deixa a sub-aba "Corpo" visível; sem ela, o aviso fica e o botão não. (A lente profissional,
`useLenteAtiva`, **não** esconde o Avatar na Visão Geral: quem decide é o layout.) Ele leva ao Avatar, **não** até a fila de revisão, que
fica no fim do cartão do Avatar.

### Abrir o registro de origem (botão "Abrir" nos marcos)

Decisão do Rafael: tocar num marco leva ao registro de origem, **começando só pelos dois que têm onde abrir**. Os outros marcos ficam
como estão, sem botão.

| Marco | Destino (`marco.destino`) | O que a página faz ao tocar |
| --- | --- | --- |
| "Avaliação presencial registrada" (`avaliacao_voz`) | fonte + id da avaliação | Se é a **última** avaliação (a do cartão "Última avaliação"), rola até esse cartão e o destaca. Avaliação mais antiga: **sem botão** (ver abaixo). |
| Diagnóstico (`diagnostico`) | fonte + id do diagnóstico | Rola até o cartão de CID (`DiagnosticosCID10Card`) e destaca a linha **daquele** diagnóstico. |

- **O destino é derivado, nunca inventado**: `{ fonte, id }` com o id da **própria linha do banco** (`destinoDoRegistro`, em `marcos.ts`),
  guardado no próprio `Marco` (`destino`, mais `rotuloDoDestino`, o texto que o leitor de tela lê). Linha **sem id de verdade** (a chave do
  marco cai na posição, `avaliacao_voz:i0`) não tem destino. Nenhuma outra fonte ganha destino (`FONTES_COM_DESTINO`), nem o item de
  "Sem data" (um diagnóstico sem a data do fato fica sem botão), nem o cartão "Como começou".
- **O botão**: "Abrir" (alvo de 44 px, foco visível, sem `truncate` nem `line-clamp`, só cores do tema, serve no escuro), com o nome
  acessível "Abrir a avaliação de 06/10/2026" ou "Abrir o diagnóstico M54.5" (o dia é o do Brasil; sem o código do CID, vale o nome do CID).
- **Quem decide se há botão** (a linha do tempo não navega nem sabe de abas): ela recebe duas funções por prop, pelos mesmos caminhos do
  `onAbrirAvatar` (`PacientePerfil` > `AvaliacaoVozAtual` > `AvaliacaoSecoesEditaveis` > `LinhaDoTempoClinica`): `onAbrirRegistro(destino)` e
  `registroAbrivel(destino)`. O botão só existe quando há `onAbrirRegistro` **e** o marco tem destino **e** `registroAbrivel` (se vier) diz que sim.
  `PacientePerfil` responde pela lente; `AvaliacaoVozAtual` responde pela avaliação, porque só ele sabe qual é a última.
- **Quando o botão não aparece, e por quê**:
  - **Lente sem o bloco `cid`** (`temBloco(lente, 'cid')`): o cartão de CID não existe na aba, então o diagnóstico fica na linha do tempo, sem botão.
  - **Avaliação antiga**: quem abre uma avaliação antiga é o `AvaliacoesVozHistorico` (`setOpened`), que só é montado na aba **Evolução**, dentro de um
    bloco recolhido; a linha do tempo mora na aba **Avaliação**, onde ele **não** existe. Abrir uma avaliação antiga exigiria trocar de aba, abrir o bloco e abrir a
    janela de edição (que **edita**). Isso não foi pedido, então o marco continua na linha do tempo, sem botão (nunca um botão que não leva a lugar nenhum).
  - Sem a função da página, todos os marcos ficam sem botão. Sem avaliação do profissional, só o diagnóstico tem botão.
- **Como abre** (`src/hooks/useAbrirRegistroClinico.ts`): acha o elemento por uma marca que o próprio cartão escreve (`data-diagnostico-id` na linha do
  cartão de CID; `data-avaliacao-id` no topo do cartão "Última avaliação"), rola até ele (suave; **direta** com `prefers-reduced-motion`) e põe
  `data-destacado="true"` por 3 s. O destaque é só CSS pelo atributo (anel e fundo leve; transição só com `motion-safe`), sem estado nem dado de cartão.
  Só um destaque por vez; abrir outro, ou sair da tela, apaga o anterior. Se a linha do diagnóstico ainda não está na lista, vai ao cartão sem destacar nada.
  O foco do teclado e do leitor de tela vai para o registro aberto (`tabindex="-1"` posto por código, só se o elemento ainda não tiver um, e `focus({ preventScroll: true })`, para não rolar de novo).
- **O que não faz**: não abre janela (`window.open`), não muda de rota nem de aba, não grava nada e não muda o que as telas mostram além do destaque temporário.
  O teste de privacidade continua valendo e **não foi mexido**: a navegação entra na linha do tempo só por função recebida por prop; o hook que mexe na tela fica fora da camada
  pura e dos componentes da linha do tempo.

## Confirmar com a data real (etapa 2: a única escrita da linha do tempo)

Decisão do Rafael: o profissional pode **confirmar, com a data real, uma cirurgia ou internação que o CLIENTE relatou** no histórico
clínico (`pacientes.historico_clinico`). A confirmação é **uma linha nova** em `historia_vida_paciente` (com `visivel_paciente = false`)
que **substitui o relato do cliente na lista** e mostra "ver relato original". O que o cliente escreveu **nunca é apagado nem mudado**.
O fluxo do cliente e as regras de free e premium (`docs/fluxo-cliente-e-tiers.md`) **não mudam**.

### O que o profissional vê

- **Botão "Confirmar com a data real"** (44 px) no relato de cirurgia do cliente, **no marco com ano válido e no item de "Sem data"**
  ("03/2019", "há 2 anos", "2O22"). O item do cliente **sem `id`** também pode ser confirmado. **Não ganham o botão**: envio do histórico,
  MyID, "Como começou", diagnóstico, exame, o registro do profissional e o relato cuja confirmação já existe (para refazer, desfaz e
  confirma de novo). **Sem a função da página, nenhum botão** (nunca um botão que não leva a lugar nenhum). A **recepção não vê** o botão
  (nem o "Desfazer"): `PacientePerfil` só passa as funções quando o papel na clínica já carregou e **não é `recepcao`** (modo solo,
  dono e profissional liberam). Enquanto o papel carrega o botão também não aparece: chegar um instante depois é melhor do que
  aparecer para quem não pode.
- **O diálogo** (o diálogo mora na **página**, não nas seções da avaliação, que remontam a cada `savedAt` novo e levariam o texto digitado):
  - o relato do cliente no topo, **inteiro** (sem `truncate` nem `line-clamp`), com o selo do cliente;
  - **"Cirurgia" ou "Internação"** em chips de 44 px, **sem nada marcado de início** (não há lista de seleção);
  - **"Sei o dia"** (campo de data, de 1900-01-01 até hoje) ou **"Só sei o ano"** (4 números, teclado numérico). O campo começa **vazio**:
    nunca vem preenchido com o ano do cliente;
  - **erro por texto** abaixo do campo (`role="alert"`, `aria-invalid`, `aria-describedby`) com as frases de `erroDaDataDigitada` e
    "Ano inválido: use 4 números, de 1900 até o ano atual."; o ano só vira erro depois dos 4 números, de sair do campo ou de tentar
    confirmar. Data no futuro, antes de 1900 e **antes do nascimento do cliente** são recusadas;
  - **"Confirmar" fica desligado** enquanto o formulário é inválido ou está salvando ("Salvando…");
  - **aviso suave** (não bloqueia) quando o ano informado difere de um ano válido que o cliente escreveu;
  - **aviso FIXO da triagem** (veja abaixo), sempre visível;
  - **Esc, X, "Cancelar" e toque fora** fecham direto só se nada foi escolhido ou digitado; senão perguntam "Descartar o que digitei?"
    ("Continuar editando" mantém tudo). Enquanto salva, nada fecha;
  - **erro do banco** aparece em texto (`role="alert"`) **e** em aviso (toast), com o diálogo aberto e o que foi digitado no lugar;
  - **foco**: com erro de data, o foco vai ao campo e o campo rola para o meio da tela (`scrollIntoView({ block: 'center' })`), para o teclado
    do celular não esconder o erro. O rodapé com os botões fica **dentro da área rolável** do diálogo (não fixo). Depois de salvar, o
    foco vai ao **título da seção** (o botão que abriu o diálogo deixou de existir); ao cancelar, volta ao botão que abriu. Em "Continuar editando"
    (a pergunta "Descartar o que digitei?" é um diálogo sem gatilho) o foco volta ao campo em que o profissional estava, ou ao primeiro campo se ele sumiu;
  - **na saída o diálogo não esvazia**: o item pedido fica guardado só para o desenho durante a animação de fechar (200 ms), nos dois diálogos. Ao abrir de novo
    vale o item novo, e a troca de paciente apaga o guardado;
  - **texto do cliente comprido** (uma palavra de 100 letras sem espaço) não alarga a tela: os diálogos e o relato original quebram em qualquer ponto
    (`overflow-wrap`) e cada filho da caixa, que é uma grade, tem `min-w-0`. Medido no celular de 390 px (a caixa e a página sem rolagem para o lado).
- **Trocar de cliente com um diálogo aberto** (Voltar do navegador, Voltar do Android, link de notificação: a rota `/pacientes/:id` reaproveita a mesma página):
  os dois diálogos (confirmar e desfazer) **somem e o estado e os erros são zerados**. Em duas camadas: o pedido guarda de qual paciente veio e só o do paciente
  atual aparece; e gravar e apagar **recusam, sem escrever nada**, um pedido que não é do paciente atual ("Você abriu outro cliente depois de pedir esta
  confirmação. Nada foi salvo. Peça a confirmação de novo no cliente certo."). Uma gravação que já estava em andamento termina no paciente em que começou.
- **O marco confirmado** substitui o relato na lista, no filtro e em "Sem data": título como gravado, data pela precisão ("2022" ou
  "10/06/2022"), o selo próprio **"Data confirmada pelo profissional · texto do cliente"** (a data é do profissional, o texto é do
  cliente; o selo "Registrado pelo profissional" assinaria o que o cliente escreveu), **"Confirmado por você em dd/mm/aaaa"** (o dia do
  Brasil de `created_at`; se `created_at` for ilegível a frase some, nunca uma data inventada), **"ver relato original"** (recolhível, 44 px,
  `aria-expanded`/`aria-controls`; mostra **o texto guardado na confirmação, nunca o dado vivo**, com o ano exatamente como veio, "2O22" inclusive)
  e **"Desfazer"**. O diálogo de desfazer abre com o foco em "Voltar".
- **Situação** (`marco.confirmacao.situacao`): **igual** (o texto de hoje é o confirmado: o relato some); **alterado** (a chave bate e o
  texto mudou: **os dois aparecem**, o relato do cliente continua na lista **sem** o botão de confirmar, e o marco confirmado ganha a nota
  "O cliente mudou este item depois da confirmação; o relato atual também aparece na lista."); **apagado** (nenhum item do cliente tem
  mais a chave: só o marco confirmado, com "O cliente apagou este item depois da confirmação.").

### O que é gravado: o contrato da linha

Um `insert` em `historia_vida_paciente`, montado por `montarLinhaDaConfirmacao` (`src/lib/resumoClinico/confirmacao.ts`, camada pura) e
gravado **só** por `src/hooks/useConfirmarMarcoClinico.ts`:

| Coluna | Valor |
| --- | --- |
| `id` | uuid **determinístico** (ver "Id determinístico") |
| `terapeuta_id` | o profissional logado (`useAuth`); a RLS exige `auth.uid() = terapeuta_id` |
| `paciente_id` | o paciente aberto |
| `data_evento` | **sempre o texto "AAAA-MM-DD"** (nunca `Date`, nunca `toISOString`); "AAAA-01-01" quando só o ano é conhecido |
| `tipo` | `cirurgia` ou `internacao`, o que o profissional escolheu (os dois passam no CHECK da tabela) |
| `titulo` | o texto do cliente, aparado, **sem** o prefixo "Cirurgia ou internação: " (esse só existe na exibição) |
| `descricao` | "Data aproximada: só o ano (AAAA)." quando a precisão é o ano; senão `null`. As complicações do cliente **não** vão para cá |
| `sistema_corporal` | `null` (com valor a linha apareceria no Avatar) |
| `severidade` | `0` |
| `resolvido` | `true`, **explícito** (o padrão da coluna é `false` e a triagem local lê as linhas não resolvidas: é um fato passado) |
| `visivel_paciente` | `false`, **explícito** (o padrão da coluna é `true`: é registro do profissional, o cliente não vê) |
| `profissional_registro` | "Nome Sobrenome · CREFITO 12345-F" montado pelo app a partir do perfil; `null` sem CREFITO; nunca digitado |
| `metadata` | o objeto abaixo |
| `created_at`, `updated_at` | **não são enviados**: o servidor preenche, e `created_at` é o "quando" |

**`metadata`** (todas as chaves escritas pelo hook): `versao` (número `1`; outra versão é lida como linha comum), `origem`
(`'confirmacao_de_marco'`, a marca que a leitura e o desfazer usam), `fonte` (`'historico_clinico'`), `chave_cliente` (a chave de
confirmação, ver abaixo; até 200 caracteres e sem caractere de controle), `relato_cliente` (`{ tipo, ano, complicacoes }`, os três
**texto** como a leitura os vê: aparado, número vira texto; é o "relato original" e a base da impressão digital), `precisao` (`'ano'` ou
`'dia'`) e `confirmado_por` (`{ nome, registro }`, uma foto de quem confirmou, porque o perfil muda depois). **Não** grava `confirmado_em`:
o relógio do navegador é falsificável e repetiria `created_at`.

Limites: tipo + complicações do cliente **até 2000 letras** e o campo "ano" do cliente **até 100 letras**. Acima disso o app **recusa
confirmar, com a frase explicando** (não corta: cortar mudaria a impressão digital e o relato nunca mais seria reconhecido).

### Chave de confirmação, impressão digital e substituição

- **Chave de confirmação** (`chaveDaConfirmacao`, vai só em `metadata.chave_cliente`, **nunca** vira o id do marco): item **com `id`** (e o `id`
  aparecendo pela primeira vez) usa `historico_clinico:cirurgia:id:<id>`, a mesma chave do marco. Item **sem `id`** (ou com `id` repetido)
  usa `historico_clinico:cirurgia:pos:<posição>:<16 letras do SHA-256 da impressão>`: **depende do conteúdo**, então, se o cliente apagar
  um item acima, a posição muda, a chave deixa de bater com a confirmação de outro item e **nenhuma confirmação esconde a cirurgia errada**.
  O custo: nesses itens, se o cliente editar o texto, a confirmação antiga vira "apagada" e o relato novo aparece com o botão.
  A chave só vale junto com `paciente_id` e `terapeuta_id`. Os ids e a ordem dos marcos que já existiam **não mudaram**.
- **Impressão digital** (`impressaoDoRelato`): o JSON de `[tipo, ano, complicações]`, os três aparados. O relato do cliente **só sai da lista
  se a chave E a impressão de hoje forem iguais às da confirmação**: o cliente edita o próprio histórico a qualquer hora (o formulário regrava os
  itens no autosave), e a chave sozinha não prova que o texto é o mesmo.
- **Só a confirmação VÁLIDA substitui**: se `data_evento` não passa pela mesma régua da linha do tempo (inexistente, antes de 1900 ou no
  futuro), a linha vai para "registros que ficaram de fora" e **o relato do cliente continua à vista**.
- **Duas linhas com a mesma chave** (não deveria existir: o id é fixo): vale a **mais antiga** (`created_at`, depois `id`); a outra aparece como marco comum.

### Precisão da data

Duas precisões na v1: **"ano"** e **"dia"** (mês ficou de fora). **Só `metadata.precisao` decide**, e só o texto exato `'ano'` vale: ausente,
"Ano", número ou objeto são "dia", como toda linha de história de vida sempre foi lida; **a precisão nunca é adivinhada pelo "-01-01"**
(um 1º de janeiro de verdade existe: `2022-01-01` sem marca continua "01/01/2022"). Com precisão "ano" a leitura corta para o ano mesmo que
`data_evento` traga o dia (`dataDaHistoriaDeVida`): a tela nunca mostra mais do que a precisão diz. Na ordem, "2022" fica **abaixo** de
"10/06/2022" no mesmo ano (comparação do texto ISO; `compararMarcos` não mudou) e o marco só com ano fica **na posição do relato que substituiu**.
**A frase "Data aproximada: só o ano (AAAA)." existe para quem lê só a coluna** (a exportação CSV, outra tela no futuro); na linha do tempo
ela é omitida do detalhe, porque a data já mostra só o ano. O Avatar não mostra a linha (`sistema_corporal` é `null`). O corte de 18/11/2026
do diagnóstico **não se aplica**: `data_evento` é `NOT NULL` sem padrão, o banco nunca a preenche sozinho. "Hoje" é o dia do Brasil
(`hojeLocalISO()`), **lido na hora de salvar** (o diálogo pode ficar aberto de um dia para o outro).

### Id determinístico (a chave primária é a trava contra duplicar)

`idDaConfirmacao(terapeuta, paciente, chave)` é um hash **SHA-256 escrito à mão** (sem `crypto.subtle`, que só existe em contexto seguro e muda entre
WebViews), com os **primeiros 128 bits** em 8-4-4-4-12, nibble de versão 4 e de variante 8 a b. Mudar o profissional, o paciente ou a chave **muda o id**
(o profissional entra na conta para a confirmação de um não travar a de outro). Efeito: duplo toque, duas abas e reenvio de rede tentam o **mesmo id**
e o banco recusa o segundo (**23505**), sem ler antes e sem índice único novo. Além disso o botão e o diálogo travam enquanto grava e há uma **trava
por `ref`** (o segundo toque no mesmo instante passa antes de a tela redesenhar o botão desligado). Testes: vetores do NIST ("abc", vazio, a mensagem
de 448 bits, um milhão de "a") e comparação com `node:crypto` em centenas de entradas (acentos, emoji).

**Como o hook trata o que o banco responde** (`useConfirmarMarcoClinico`):

- **23505** (já existe): invalida, relê e, se a confirmação **aparece na lista**, é sucesso ("Este item já estava confirmado..."). Se **continua fora da
  lista**, um `select` por id diz se ela existe: a frase é **"Já existe uma confirmação para este item, mas a tela não conseguiu carregá-la."**
  (e, se nem o `select` a acha, a falha comum). Nunca se finge sucesso.
- **PGRST204 e 42703** (coluna que o banco não conhece: o app subiu antes da tabela estar pronta): **"O banco ainda não está preparado para esta
  confirmação."**, sem mandar tentar de novo. **42501**: frase de falta de permissão. Qualquer outro erro, ou o client que lança por falta de rede:
  "Não deu para salvar a confirmação. Confira a conexão e tente de novo."
- **Só o sucesso invalida** `invalidarFontesClinicas` e `['historia-vida-avatar', paciente]`; com erro do banco, **nada** é invalidado.
- Sem usuário ou sem paciente: **nenhuma operação**, só a frase pedindo para sair e entrar de novo.

### Desfazer: apaga de vez, sem rastro

O "Desfazer" **apaga** a linha (decisão do Rafael): `delete` com **as quatro condições** (`id`, `paciente_id`, `terapeuta_id` e `metadata->>origem =
'confirmacao_de_marco'`) e `.select('id')`. Só essa linha; **nunca** por chave sem id, nunca em lote e **nunca um registro de história de vida feito à
mão** (a marca de origem protege). **Nenhuma linha apagada não é erro**, mas a frase é "A confirmação já não existe." (nunca "desfeito") e a tela relê
para mostrar a verdade; erro do banco aparece no aviso, que continua aberto, e **não invalida nada**. Depois de apagar, o relato do cliente volta como
"Relatado pelo cliente, não revisado" e confirmar de novo gera o mesmo id e funciona.

**Importante, com todas as letras:** **o registro apagado não pode ser recuperado nem provado.** Não fica rastro de quem desfez, de quando, nem de que
a confirmação existiu: a auditoria da confirmação (`created_at`, `confirmado_por`) some junto. **A guarda de prontuário por profissionais segue
pendente com o jurídico** (o prazo, a base legal e o que o cliente pode pedir de volta; ver "Decisões de produto" em
`docs/fluxo-cliente-e-tiers.md`, que **não foi alterado**). Se o jurídico entender que a confirmação é peça de prontuário, a saída **sem migração**
é marcar `metadata.desfeito = true` em vez de apagar (a leitura ignoraria a linha), mas isso muda o que o Rafael aprovou: só com decisão dele.

### Aviso fixo da triagem de segurança dos planos

Decisão do Rafael: o formulário mostra **sempre**, sem bloquear: **"A triagem de segurança dos planos continua usando o ano que o cliente escreveu.
Esta confirmação não a altera."** Motivo: a triagem roda **no servidor** (`supabase/functions/_shared/triagem-bloqueio.ts`), lê o histórico clínico do
cliente do jeito que ele escreveu: **o ano de cada cirurgia** (a cirurgia "recente" conta numa janela de 1 ano) **e também uma varredura por palavra-chave
no texto do tipo e das complicações** ("cirurgia recente", "pós-operatório"...). Ela **não lê `historia_vida_paciente`**. Confirmar a data real **não muda**
o que a triagem vê. O texto que o profissional lê na tela diz só que ela "continua usando o ano que o cliente escreveu" e está certo (a confirmação não altera nada
do que ela lê). Mudar isso é **etapa própria** (a edge function teria de ler a tabela com service role); esta etapa não mexe em
`supabase/functions`. Nenhum texto da tela diz que a triagem mudou.

### Como a linha do tempo lê (duas leituras da história de vida)

`useFontesClinicas` pede a história de vida **em duas leituras, só `select`**: os 50 mais recentes (limite + 1 = **51**) e, à parte, **só as confirmações**
(`metadata->>origem = 'confirmacao_de_marco'`, limite próprio **200**, pedido 201), juntadas **sem repetir o `id`**. Assim uma confirmação antiga nunca cai
fora do corte de 50. As colunas da marca vêm **por caminho JSON com apelido** (`confirmacao_origem:metadata->>origem`, `confirmacao_chave`,
`confirmacao_precisao`, `confirmacao_relato:metadata->relato_cliente`, `confirmacao_por:metadata->confirmado_por`...), sem `*` e sem baixar o `metadata`
inteiro, mais `created_at`. O aviso de corte é o da primeira leitura. **Se uma das duas leituras falhar, a fonte "história de vida" inteira cai em
"Não consegui ler ..."** (as outras fontes seguem): sem a confirmação o relato do cliente voltaria à lista como "não revisado" sem ninguém saber por quê.
Por isso os testes que fixavam "um único `select` com limite 51" (`useFontesClinicas.test.tsx`) agora esperam **`[51, 201]`** para `historia_vida_paciente`:
foi uma mudança consciente, e o resto da suíte seguiu verde sem outra alteração.

### Quem lê a tabela `historia_vida_paciente` (cuidado no futuro)

- **A RLS é `auth.uid() = terapeuta_id`**: só o próprio profissional lê e escreve; o paciente do portal **não** lê a linha.
- **Qualquer política futura de leitura do paciente (portal) nesta tabela DEVE filtrar `visivel_paciente = true`.** O padrão da coluna é `true`; a
  confirmação grava `false` explícito. Uma política que esquecesse o filtro mostraria ao cliente o registro do profissional.
- **`ExportarDados` leva o `metadata` inteiro** (é um `SELECT *` por tabela, do próprio profissional, protegido pela RLS e pela rota de
  profissional): o CSV traz o relato original, a precisão e quem confirmou. Quem usar esse arquivo precisa saber disso.
- O **Resumo Completo** não muda: continua listando a cirurgia como relato do cliente.

### Limites e decisões desta etapa (revisão dos conferentes)

- **A regra "recepção não confirma" é regra de TELA e falha aberta.** `PacientePerfil` só passa as funções quando `useClinicaContext` diz que o papel não é
  `recepcao`. Se esse hook não conseguir carregar o vínculo (consulta de `clinica_membros` falhou ou não achou), ele cai no **modo solo** (papel indefinido,
  carregamento terminado) e o botão **aparece**. A RLS do banco só confere `auth.uid() = terapeuta_id`: **não olha papel** nem se o paciente é do profissional.
  Uma recepcionista nessa situação consegue gravar uma linha com o próprio id; a linha **só fica visível para quem a criou** (a RLS de leitura é a mesma), então
  não há vazamento nem estrago no prontuário de outro profissional. É o comportamento herdado do `useClinicaContext` (a consulta que falha devolve o erro como
  `data` vazio, sem lançar, e o hook segue para o modo solo); fechar de verdade pede uma regra de papel no banco, que é decisão de outra etapa (esta não mexe em `supabase/`).
- **O erro de tipo ausente (`role="alert"`) e o foco no primeiro chip só existem para envio programático.** Num navegador o botão "Confirmar" fica **desligado**
  enquanto falta o tipo ou a data válida, e o Enter não envia formulário com o botão padrão desligado. O que o usuário vê é a frase fixa de ajuda ("Escolha cirurgia ou
  internação e informe uma data válida para confirmar."), sem `role`. Os testes que chamam `fireEvent.submit` exercitam o ramo; não o confunda com o que a pessoa vê.
- **Abrir o perfil dispara 2 consultas a mais** (`clinicas` e `clinica_membros`; o dono de clínica só faz a primeira), porque `useClinicaContext` guarda o resultado em
  `useState` e **não usa o cache do React Query**: cada abertura do perfil pergunta de novo. Custo aceito para saber o papel; uma etapa futura pode pôr esse hook em cache.
- **Se a segunda leitura da história de vida (as confirmações) falhar, a fonte inteira cai com aviso** ("Não consegui ler a história de vida"; as outras fontes
  seguem). **Decisão registrada (C1):** sem a confirmação o relato do cliente voltaria à lista como "não revisado" sem ninguém saber por quê. O custo é que os
  eventos de vida comuns (fratura, trauma) também somem da linha do tempo enquanto durar a falha. Dois testes de `useFontesClinicas.test.tsx` fixam essa escolha.
- **Um marco confirmado como "Internação" passa a aparecer em "Eventos de vida" no filtro, e não em "Cirurgias e diagnósticos" (C2).** O tipo `internacao` da
  história de vida entra como `evento_de_vida` (regra antiga); o relato do cliente que ele substitui era `cirurgia`. Em "Tudo" continua. Quem confirmar como "Cirurgia"
  não vê mudança de categoria. Está coberto por teste (`resumoClinicoConfirmacao.test.ts`).
- **Com rede muito lenta, trocar de paciente durante a gravação do anterior faz o primeiro toque em "Confirmar com a data real" do paciente novo ser ignorado, sem aviso,**
  até a gravação terminar. A trava contra duplo toque é uma só por hook, e não por paciente. Nada é gravado errado: é um toque perdido (o segundo funciona).
- **Ao fechar o diálogo de confirmação o formulário zera durante os 200 ms da animação de saída.** A caixa não encolhe (o que se vê é só o zoom do Radix), mas a altura
  de layout pode dar um salto de um quadro. Cosmético, aceito.
- **A troca de paciente zera os diálogos (F1):** ver "O que o profissional vê". Sem isso o Confirmar gravava a cirurgia do cliente A no prontuário do cliente B (provado
  com teste antes da correção).

### Roteiro manual de conferência (depois de publicar)

Os testes usam um banco falso: ele **não** emula coluna, CHECK nem RLS do Postgres, e o jsdom **não** mostra o teclado do celular. O teste estático
`marcoConfirmadoGravacao.test.ts` lê a migração `20260614230000_historia_vida_paciente.sql` (a tabela real tem `metadata` e `visivel_paciente`, conferidos
em leitura; **esta etapa não cria migração**) e confere que cada chave gravada existe como coluna e que o tipo está no CHECK. O resto fica para a mão:

1. **Confirmar.** No perfil de um paciente com uma cirurgia relatada pelo cliente, aba Avaliação > Linha do tempo: "Confirmar com a data real", escolher
   "Cirurgia", "Só sei o ano", digitar o ano e confirmar. Esperado: o relato do cliente some, o marco aparece com o selo "Data confirmada pelo profissional ·
   texto do cliente", "Confirmado por você em" com o dia de hoje, "ver relato original" mostra o texto do cliente. Repetir com "Sei o dia" e com um item de "Sem data".
2. **O paciente do portal não vê.** Entrar no portal com a conta do cliente desse paciente: **nenhum** sinal da confirmação em lugar nenhum. (Se for possível ao
   suporte, conferir no banco que a linha tem `visivel_paciente = false`, `resolvido = true`, `sistema_corporal` nulo.)
3. **Desfazer.** "Desfazer" no marco confirmado > "Desfazer confirmação": o relato do cliente volta como "Relatado pelo cliente, não revisado" e o botão de
   confirmar volta. Confirmar de novo deve funcionar (mesmo id).
4. **Duas abas.** Abrir o mesmo paciente em duas abas, confirmar na primeira e confirmar o mesmo item na segunda sem recarregar: a segunda diz que o item já
   estava confirmado (23505) e a lista atualiza.
5. **Recepção.** Entrar com uma conta de recepção de uma clínica: nenhum botão "Confirmar com a data real" nem "Desfazer" (é regra de tela e falha aberta: ver "Limites e
   decisões desta etapa").
6. **Trocar de cliente.** Abrir "Confirmar com a data real" no cliente A e usar o Voltar do navegador (ou do Android) para o cliente B: o diálogo some e nada é gravado.
7. **O teclado, em aparelho real (iPhone e Android).** Abrir o diálogo, tocar no campo de ano, digitar "2O22" (com a letra O): o erro deve ficar **visível
   acima do teclado**, o campo no meio da tela e os botões alcançáveis rolando o diálogo. Conferir os 44 px, a largura de 390 px **sem rolagem para o lado** e o
   modo escuro.

## Selos de origem

- O que veio do **cliente** leva **"Relatado pelo cliente, não revisado"**; o que o **profissional** registrou leva **"Registrado
  pelo profissional"**. Nunca o contrário (um teste confere todos os marcos).
- Um **terceiro visual**, só no marco que o profissional confirmou: **"Data confirmada pelo profissional · texto do cliente"** (`SeloDeOrigem` com
  `dataConfirmada`, `data-selo="data-confirmada"`). O tipo `OrigemDoDado` continua só com `cliente` e `profissional`; o marco confirmado tem origem
  `profissional` e `revisado = true`, e o selo diz de quem é a data e de quem é o texto.
- No Completo, o **texto editado à mão pelo profissional** na tela da avaliação ganha a nota **"Editado pelo profissional"** (no
  texto copiado: "(editado pelo profissional)").

## O Completo respeita as edições do profissional

A tela da avaliação mostra `editadas[chave] ?? texto montado pelos campos` (`_secoes.editadas`). O Completo faz o mesmo para as
seções que ele usa **e que a tela deixa editar**: `dor` (chave `dor`), `funcionalidade` (chave `funcionalidade`) e `psicossociais`
(chave `psicossocial`). "Queixa e história" e "Exame e avaliação" vêm de campos que a tela não edita.

- **Editado com texto**: o Completo mostra o texto editado **no lugar** do montado pelos campos, com a nota "Editado pelo
  profissional", e o **Copiar leva o texto editado**. Sem isso o Completo mostraria (e copiaria) dado antigo, por exemplo EVA 7 em
  vez de 4, como se fosse o que o profissional confirmou.
- **Não editado**: monta pelos campos, como antes, sem a nota.
- **Editado e vazio** (o profissional apagou a seção): a seção **some**, como na tela (que esconde seção sem texto). O dado antigo
  dos campos **não volta** e não é copiado.
- Valem as edições feitas na própria sessão (o estado da tela), mesmo antes de a avaliação ser relida do banco.
- Só **lê** o mesmo dado: não reescreve a lógica da tela e não grava nada.

## Duplicidade: o mesmo fato do cliente e do profissional aparece duas vezes, de propósito (sem vínculo)

Se o cliente relata uma cirurgia no histórico clínico e o profissional registra a mesma cirurgia na história de vida **por conta
própria**, a linha do tempo mostra **dois marcos**, cada um com o seu selo (e, em geral, com precisões diferentes: o ano que o
cliente escreveu e o dia que o profissional registrou). **Sem vínculo entre os dois, não há deduplicação.** Juntar os dois esconderia
justamente a divergência, que é o que o profissional precisa enxergar para conferir com o cliente. Um teste registra essa decisão.

**A única exceção é a confirmação** (etapa 2): a linha de história de vida com a **marca de confirmação** (`metadata.origem =
'confirmacao_de_marco'`), com a chave do item e com a **impressão digital do texto igual** à de hoje, **substitui** o relato do cliente
(no marco e em "Sem data"). Chave igual com impressão diferente mostra **os dois**, com aviso. Ver "Confirmar com a data real".

## O que NÃO faz

- Não usa IA, não entra no prontuário nem no "Sincronizado". **Não grava nada por conta própria**: a única escrita da linha do tempo
  é a confirmação do profissional (e o desfazer dela), feita só pelo hook `useConfirmarMarcoClinico`, depois de um toque dele, e nunca
  em `pacientes`, `notas_prontuario` nem `avaliacoes_voz`.
- Não mostra hipóteses diagnósticas nem red flags no Completo (ficam na aba Quadro/Dx; um texto copiado poderia ser lido como
  diagnóstico). Não mostra o plano. Pelo mesmo motivo, diagnóstico do tipo "suspeita" não vira marco.
- Não classifica ("normal", "alterado", "bom", "ruim") nem interpreta; não reescreve o texto do cliente (aparece inteiro, sem
  corte, com quebra de linha).
- Não lê campos antigos do MyID (`bloco_1_date`, `bloco1.data_inicio_dor`), que a tela atual do cliente não grava.
- Não toca no portal do cliente (`src/pages/paciente/*`) e não muda a visibilidade das notas. A linha da confirmação grava
  `visivel_paciente = false`. Um teste estático confere que os
  arquivos novos da linha do tempo não usam `console`, `localStorage`, `sessionStorage`, `document.cookie`, `indexedDB`, `fetch`, `XMLHttpRequest`,
  `WebSocket`, `sendBeacon`, `new Image(`, `window.open`, `.insert(`, `.update(`, `.upsert(`, `.delete(`, `.rpc(`, `functions.invoke`,
  nem importam `src/pages/paciente` ou apontam para rotas `/paciente` do portal; e que só `useFontesClinicas` importa o client do Supabase
  (a camada pura e as telas não). O hook que grava (`useConfirmarMarcoClinico`) fica **fora** das pastas vigiadas por esse teste, de
  propósito, e tem o próprio teste estático (`marcoConfirmadoGravacao.test.ts`).
- Não muda o **Resumo Completo**: ele lê `pacientes.historico_clinico` direto e **continua listando a cirurgia como relato do cliente**,
  mesmo depois de confirmada. A confirmação só vale na linha do tempo.
- Não muda a **triagem de segurança dos planos** (ver o aviso em "Confirmar com a data real").
- Não religa `useTimelineCompleta`, `TimelineVidaCompleta`, `TimelineUnificada` nem `ResumoNarrativo` (outras abas).

## Tela

Fica em `LinhaDoTempoClinica.tsx` e nos componentes ao lado. Foi pensada para o celular (390 px): uma coluna, texto que quebra linha,
nada de rolagem para o lado.

**Ordem, de cima para baixo:** cabeçalho, aviso "Não consegui ler ..." (se alguma fonte falhou), aviso **dos achados do histórico** (se houver
achados aguardando revisão), cartão **"Como começou"**, avisos de corte, aviso dos registros que ficaram de fora, chips de filtro (quando valem), marcos agrupados por ano, "Ver todos" e a faixa
"Sem data".

### Cartão "Como começou"

- Fica **no topo, antes dos marcos, sempre aberto** (não é recolhível) e só existe se o cliente escreveu alguma queixa ou resposta
  sobre o começo. Mostra, lado a lado no celular (um embaixo do outro; em tela larga, duas colunas), o grupo **"Queixa"** e o grupo
  **"Começo do quadro"**. Cada resposta traz o **rótulo exato da pergunta** e o texto do cliente como ele escreveu.
- **Um selo só**, "Relatado pelo cliente, não revisado" (o texto do selo não mudou), no cabeçalho do bloco, em vez de um por resposta.
  Para o leitor de tela, o bloco tem `aria-describedby` apontando para um texto só para ele: "Tudo o que está neste bloco é relato do
  cliente e não foi revisado pelo profissional."
- Quando há o vínculo com o histórico, aparece "Respostas do MyID de dd/mm/aaaa." (o dia da conclusão registrada, e não uma data do
  começo). **Nada ali vira data**: a divergência (por exemplo "Mais de 3 anos" na história atual e "Mais de 1 ano" no MyID) fica à vista.
- Os outros filtros **não escondem** o cartão. Os itens que saíram de "Sem data" não aparecem lá de novo.

### Título e linha da data

- O marco e o item de "Sem data" usam `tituloParaExibir`: a cirurgia que o cliente relatou aparece como **"Cirurgia ou internação:
  Coluna"**, e não só "Coluna".
- Se o título mostrado já começa com o rótulo do tipo, a linha de baixo **não repete o rótulo** ("2022", e não "2022 · Cirurgia ou
  internação"; "07/10/2026 · registro no app", e não "07/10/2026 · MyID · registro no app"). Vale também para o detalhe do item de
  "Sem data" (o "Cirurgia ou internação · " do começo sai). A comparação ignora acento e caixa e só vale se o rótulo termina ali
  (`exibicao.ts`). Título que não começa com o rótulo ("Bioimpedância") continua com o tipo na linha da data.
- O detalhe do marco "MyID concluído" agora é curto: "Concluído e registrado no histórico do paciente." A frase "Montada na hora;
  não vai para o prontuário." continua no cabeçalho.

### Filtro por tipo (chips)

- Chips de 44 px (`min-h-11`), cada um com a **contagem** e `aria-pressed`, dentro de um grupo com nome ("Filtrar os marcos por tipo"):
  **Tudo**, **Cirurgias e diagnósticos**, **Eventos de vida**, **Exames e testes**, **Avaliações**, **MyID**. Só aparece o chip da
  categoria que tem marco.
- Só aparecem quando há **mais marcos do que o corte inicial (6)** e **mais de uma categoria** com marcos: com poucos marcos os chips
  só poluem.
- As categorias saem de `marco.tipo` (`filtros.ts`): cirurgia e diagnóstico; evento de vida (fratura, trauma, internação, acidente,
  procedimento, alta... da história de vida); exame, teste e escala; avaliação; MyID. O `Record` cobre todos os tipos de `tipos.ts` (o
  compilador reclama de um tipo novo). **Um tipo sem categoria** (hoje só `historico`, o "último envio do histórico clínico")
  aparece em "Tudo" e em nenhuma outra, e nunca some da lista. Não existe "importante": o filtro só agrupa.
- O corte de 6 e o "Ver todos" valem **dentro** do filtro. "Tudo" mostra também "Sem data"; nos outros filtros a faixa dá lugar a
  "N itens sem data aparecem em Tudo." O estado do filtro é só da tela (não grava nada). Se os dados mudam e o filtro escolhido deixa
  de existir (ou os chips somem), a tela volta para "Tudo" **e esquece o filtro**: quando a categoria voltar, o filtro de antes não
  reaparece sozinho.

### Avisos

- **Corte por fonte**: "mostrando os N mais recentes" para cada lista que passou do limite (texto vindo do hook, `cortes[].texto`).
- **Registros que ficaram de fora**: o aviso diz "N registros ficaram de fora: data ausente, inválida ou no futuro." e é um botão (44 px,
  `aria-expanded`, `aria-controls` para um id que existe) que abre a lista de **qual** registro ficou de fora e o motivo (a fonte e o
  título do próprio registro). A lista fica sempre montada, só escondida. Antes o texto era "a data não é válida", que não cobria o
  registro sem data nem o do futuro.

### Letra e toque

- **Corpo 14 px** (`text-sm`) e **linha da data e selo 12 px** (`text-xs`), no cartão inteiro (antes 10 a 13 px). Um teste confere
  que nenhuma classe `text-[9px]` a `text-[13px]` sobra na linha do tempo. A aba **Completo** também saiu de 10 e 11 px: títulos,
  avisos e selo em 12 px, texto das seções em 14 px.
- Todos os botões (seletor Resumo | Completo, chips, "Ver todos"/"Ver menos", "Sem data", registros de fora, "Copiar") têm alvo de
  toque de **44 px** (`min-h-11`) e foco visível.
- "Ver todos", "Sem data", os chips e os registros de fora têm `aria-controls` apontando para um id que sempre existe na página.
- O texto do cliente e o detalhe mostram o **texto inteiro** (`whitespace-pre-wrap break-words`), sem `line-clamp` nem `truncate`: o
  cliente não tem como "ler o resto" e o texto dele passa como foi escrito.
- Enquanto lê as fontes aparece "Montando a linha do tempo…".

## Cache: releitura depois de gravar e ao voltar para a aba

A consulta do hook tem a chave `['fontes-clinicas', pacienteId, user?.id]` e `staleTime` de 30 s. Quem **grava** dado clínico do paciente
deve chamar `invalidarFontesClinicas(queryClient, pacienteId)` (exportada de `useFontesClinicas.ts`) depois de gravar: ela invalida o
prefixo `['fontes-clinicas', pacienteId]`, que pega a consulta com qualquer id de profissional no fim, **sem encostar na de outro
paciente** (nem em `pac-10` quando o paciente é `pac-1`). Sem id de paciente não invalida nada. É só cache de leitura: não grava
nada. Além disso, **só esta consulta** relê ao voltar para a aba (`refetchOnWindowFocus: true`; o padrão do app é `false`), e só
depois dos 30 s do `staleTime`, para o profissional que editou em outra aba ou tela ver a linha do tempo certa.

**Pontos de escrita que chamam a função** (no `onSuccess` ou logo depois de gravar com sucesso; se o banco recusar, não invalida):

| Fonte lida pela linha do tempo | Onde grava | Arquivo |
|---|---|---|
| `diagnosticos_paciente` | adicionar, remover (marca `ativo = false`) e informar, corrigir ou limpar a data | `DiagnosticosCID10Card.tsx` |
| `exames_presenciais` | registrar e remover | `ExamesPresenciaisCard.tsx` |
| `exames_presenciais` | salvar relato, atualizar laudo com as regras atuais, salvar e excluir a avaliação de dinamometria | `pages/Dinamometria.tsx` |
| `exames_presenciais` | excluir um exame no histórico (só quando o item excluído é um exame; treino é `notas_prontuario`) | `pages/DinamometriaInicio.tsx` |
| `exames_presenciais` | salvar e atualizar a eletromiografia | `pages/Eletromiografia.tsx` |
| `exames_importados` | importar (função `import-exame`) e apagar | `ImportarExameCard.tsx` |
| `testes_funcionais_paciente` | registrar e apagar | `TestesFuncionaisCard.tsx` |
| `escalas_psicologia` | salvar a escala | `EscalasPsicologiaCard.tsx` |
| `historia_vida_paciente` | confirmar com a data real e desfazer a confirmação (invalida também `['historia-vida-avatar', paciente]`) | `hooks/useConfirmarMarcoClinico.ts` (liga em `PacientePerfil.tsx`) |
| `historia_vida_paciente` | adicionar e remover (**código morto**: só o `TimelineVidaCompleta` usa `useHistoriaVidaMutation` e nenhuma tela importa esse componente; não há escritor vivo além do da confirmação) | `hooks/useTimelineCompleta.ts` |
| `avaliacoes_voz` | gravar a avaliação (insert ou update) | `VoiceAssessment.tsx` |
| `avaliacoes_voz` | excluir pelo histórico | `AvaliacoesVozHistorico.tsx` |
| `avaliacoes_voz` | excluir a avaliação atual, reprocessar o complemento e as outras rotas que usam `invalidarCachesAvaliacaoVoz` | `utils/voiceAssessment/reprocessarComplemento.ts` |
| `myid_avaliacoes` e `avaliacoes_identidade` | excluir um MyID e o histórico ligado a ele | `PacienteDashboardIdentidade.tsx` |

A contagem dos achados do Avatar tem a própria chave (`['eventos-anatomicos', paciente, 'fila-de-revisao', profissional]`) e fica fora
deste prefixo: ela refaz quando o Avatar invalida `['eventos-anatomicos', paciente]` e não é guardada depois de sair da tela.

**Sem chamada, de propósito:**

- `pacientes.historico_clinico` e `pacientes.historia_atual`: quem grava é o próprio cliente, no portal (fora do alcance desta etapa).
  O profissional vê a mudança pela releitura ao voltar para a aba.
- Gravações que só mudam `resultado` da avaliação (condutas, plano, protocolo): as colunas que a linha do tempo lê de
  `avaliacoes_voz` (`id`, `created_at`, `queixa_principal` e a origem do relato) não mudam. Por isso `AvaliacaoSecoesEditaveis`
  (editar uma seção) **não** chama a invalidação: o Resumo Completo relê a avaliação pela consulta `avaliacao-voz-latest`, que esse
  salvamento já invalida. O ajudante `invalidarCachesAvaliacaoVoz` também é usado pelas condutas e pelo plano e, por isso, relê a
  linha do tempo a mais nesses casos (leitura barata, sem dado errado).
- Criar um MyID pendente (`myid_avaliacoes` com status diferente de `concluido`): a linha do tempo só lê os concluídos.
- A conclusão do MyID pelo cliente e a criação do vínculo pelo servidor (`complete-myid`): acontecem fora do app do profissional; vale a
  releitura ao voltar para a aba.

Os testes: `resumoClinicoInvalidacao.test.tsx` monta cada cartão (e o hook) com uma consulta real de dois pacientes no cache e confere
que só a do paciente certo fica velha, e que uma gravação recusada pelo banco não invalida; a eletromiografia está em
`eletromiografiaPagina.test.tsx`. As telas que dependem de microfone ou Bluetooth (`VoiceAssessment`, `Dinamometria`,
`DinamometriaInicio`) e o `PacienteDashboardIdentidade` têm só uma **guarda estática** (o teste lê o arquivo e confere que a chamada
continua lá); elas não executam a tela.

## Reavaliação: dados epidemiológicos, aviso do tratamento e achados repetidos

Três ajustes na cadeia de uma reavaliação (os testes estão em `dadosEpidemiologicosInvalidacao.test.tsx`,
`atualizarTratamentoSobrevive.test.tsx` e `avatarAchadosDuplicidade.test.tsx`):

- **Dados epidemiológicos da Home** (`ResearchDashboard`, consulta `['research-data', usuário]`, 30 s de `staleTime`): criar, refazer e
  excluir uma avaliação por voz agora invalidam o **prefixo** `['research-data']` (quem grava não conhece a chave do usuário; num navegador
  só existe a consulta de quem está logado). Pontos: `VoiceAssessment.tsx` (ao gravar, junto das outras invalidações do paciente),
  `AvaliacoesVozHistorico.tsx` (excluir) e `invalidarCachesAvaliacaoVoz` (excluir a atual, refazer o plano, complemento, condutas).
  O `ResumoConsultaPresencial` (nova avaliação do perfil) não precisa de chamada própria: usa o mesmo `VoiceAssessment`. Banco ou IA
  recusando não invalida. Editar só o texto de uma seção não invalida (contagem e severidade não mudam).
- **Aviso "A avaliação mudou" (Atualizar abas / Atualizar tratamento)**: sumia quando o plano era refeito com sucesso, porque o
  `AvaliacaoVozAtual` remonta as seções a cada `_meta.savedAt` novo (a `key` é o que faz elas relerem o resultado refeito, por isso
  fica) e o estado do aviso morava dentro delas. A oferta agora fica no `AvaliacaoVozAtual` (`ofertaTratamentoDe`, o id da avaliação) e
  volta às seções por `ofertaTratamentoInicial` / `onOfertaTratamento`. Sai só quando o profissional aplica ao plano ou dispensa, ou
  quando outra avaliação aparece na tela. O aviso que volta depois de remontar não rola a tela de novo.
- **Achado repetido no Avatar**: na nova avaliação pelo `ResumoConsultaPresencial`, `handlePainExtracted` (regiões de dor da IA) e o
  auto-avatar do `VoiceAssessment` (palavras-chave) gravavam a mesma região (ex.: `joelho_d`) duas vezes, pois o auto-avatar lia as
  regiões ativas antes de a primeira gravação terminar (a tabela não tem `UNIQUE`). O `VoiceAssessment` agora espera o `onPainExtracted`
  terminar antes de ler. O que o Avatar mostra e a revisão pelo profissional não mudaram.

## Limites conhecidos

- **Aviso "Atualizar tratamento" ao trocar de sub-aba**: a oferta de atualizar a diretriz fica no `AvaliacaoVozAtual`, que sobrevive ao
  refazer do plano, mas desmonta quando o profissional troca de sub-aba do perfil (por exemplo vai para Diretrizes e volta). Aí ela
  some sem ele ter aplicado nem dispensado. Também se perdem a sugestão já gerada e o diálogo de revisão se o plano terminar de ser
  refeito com eles abertos (o banner mora dentro das seções, que remontam). Não é regressão: antes sumia em mais casos.
- **Achados do Avatar da mesma região**: depois de passar a esperar a gravação do mapa de dor (`await onPainExtracted`), a região que a
  IA da dor e a palavra-chave acham juntas entra **uma vez**, com o achado do mapa de dor (severidade 1, pendente de revisão). A cópia
  da palavra-chave (severidade da EVA e hipóteses na metadata) deixa de ser gravada nessa região; nada na tela lê esses campos.

- **Atestado (`DocumentosModal.tsx`)**: o CID que o modal sugere ao abrir passou a ser o último **cadastrado** (`created_at`), não o de
  data de diagnóstico mais recente. A data virou opcional e um CID novo sem data iria para o fim da fila. Um teste
  (`documentosModalCid.test.ts`) trava essa ordem.

- Se a avaliação por voz existe mas nenhuma seção tem texto ("Nenhuma seção disponível nesta avaliação"), a linha do tempo não
  aparece naquele cartão vazio.
- No Completo, o lápis do cabeçalho continua editando o **Resumo** (não o Completo). **O seletor volta para "Resumo" ao abrir o
  editor do lápis**: durante a edição o seletor some (o editor ocupa o lugar do cartão) e, ao salvar ou cancelar, o cartão volta em
  "Resumo", mesmo que o profissional estivesse no Completo. Um teste registra esse comportamento.
- Só entram no resumo e na linha do tempo o MyID **concluído** mais recente (respostas) e até 20 MyIDs (marcos); as avaliações
  presenciais até 20; história de vida, exames presenciais, testes funcionais, escalas e vínculos do MyID até 50 linhas (a história de vida
lê, **além disso**, as confirmações do profissional, até 200, para uma confirmação antiga nunca cair fora do corte).
- **Diagnósticos e exames importados leem até 200 linhas**, ordenados por data mais recente primeiro e **com os sem data por último**.
  Acima disso saem primeiro as linhas sem data (a faixa "Sem data" pode ficar incompleta) e depois as de data mais antiga. Subir mais
  o limite pesaria a leitura de todo perfil aberto.
- **Achados do Avatar (só a contagem)** leem até 200 linhas, em ordem de `id` (sem data). Acima disso a contagem pode ser menor que a real e o
  aviso diz "Pelo menos N", com a frase do corte (ver "Aviso dos achados do histórico").
- **Aviso de corte.** Cada lista é lida com **limite + 1** (51, 201, 21...): se a linha extra vier, a lista passou do limite, a linha
  extra é descartada e a fonte entra em `cortes`, no resultado do hook (`lerFontesClinicas` e `useFontesClinicas`). Cada corte é
  `{ fonte, nome, limite, texto }`, com `texto` pronto, por exemplo **"Diagnósticos: mostrando os 200 mais recentes."**: a tela só
  precisa mostrá-lo. Exatamente o limite não é corte. Fonte que falhou não aparece em `cortes` (ela já está em `falhas`). O MyID com as
  respostas (limite 1) não é lista cortada. A cirurgia do histórico clínico e a história atual não têm limite.
- O diagnóstico criado **antes de 18/11/2026** cuja data real coincide por acaso com o dia do cadastro vai para "Sem data" (ver "A data
  do diagnóstico que o banco preenche sozinho"). Depois do corte, a data (ou o vazio) é do profissional e vale.
- "MyID concluído" só aparece com a ligação ao histórico (`avaliacoes_identidade`); sem ela, "MyID (último registro)".
- **Confirmação do profissional**: só vale para a **cirurgia ou internação do histórico clínico do cliente**, com precisão de **dia ou ano** (mês ficou de fora);
  recusa relato de mais de 2000 letras (tipo + complicações) ou ano de mais de 100 letras; **desfazer apaga de vez** (não há rastro nem como provar que
  existiu: ver "Desfazer: apaga de vez, sem rastro"); a confirmação **não muda** o Resumo Completo nem a triagem de segurança dos planos.

## Onde está no código

- Camada pura (sem React nem Supabase): `src/lib/resumoClinico/` (`tipos`, `leitura`, `datas`, `marcos`, `resumoCompleto`, `cortes`).
- Dados: `src/hooks/useFontesClinicas.ts` (leitura, `cortes`, `invalidarFontesClinicas`, e a contagem dos achados:
  `lerAchadosParaRevisao` e `useAchadosParaRevisao`).
- Regra da fila de revisão do Avatar (única, pura): `src/lib/avatar/filaDeRevisao.ts`, usada por `AvatarClinicoCard.tsx` e pela leitura
  da contagem. Caminho até o Avatar: `src/lib/avatar/irParaOAvatar.ts` (`visaoGeralMostraOAvatar`, `subAbaInicialDaVisaoGeral`).
- Telas: `src/components/resumoClinico/` (`ResumoClinicoVisoes`, `ResumoCompleto`, `LinhaDoTempoClinica`, `ComoComecouCard`,
  `FiltroDeMarcos`, `RegistrosDeFora`, `SeloDeOrigem`, `AvisoDeFalhas`, `AvisoDosAchadosDoHistorico`, e da etapa 2 `ConfirmarMarcoDialog` e
  `DesfazerMarcoDialog`, que são **só apresentação**: sem Supabase e sem escrita). Lógica de exibição sem React: `exibicao.ts` (título, rótulo do
  tipo, detalhe) e `filtros.ts` (categorias e chips).
- **Confirmar com a data real (etapa 2)**: a camada pura é `src/lib/resumoClinico/confirmacao.ts` (SHA-256, `idDaConfirmacao`, `impressaoDoRelato`,
  `chaveDaConfirmacao`, `lerConfirmacao`, `validarDataConfirmada`, `montarLinhaDaConfirmacao`), com tipos e constantes em `tipos.ts` e `dataDaHistoriaDeVida`/
  `lerPrecisao` em `datas.ts`; a substituição do relato está em `marcos.ts`; a leitura em duas partes, em `useFontesClinicas.ts`; **o único escritor** é
  `src/hooks/useConfirmarMarcoClinico.ts` (usa `tabela()` de `src/lib/dosagem/db.ts`, porque `types.ts` não lista `metadata` nem `visivel_paciente`; sem
  `ts-ignore`), chamado em `PacientePerfil.tsx` antes de qualquer retorno condicional; as funções `onConfirmarMarco`/`onDesfazerMarco` descem pelo mesmo
  caminho do `onAbrirRegistro` (`AvaliacaoVozAtual` nos três pontos e `AvaliacaoSecoesEditaveis`); os dois diálogos ficam na página.
- Escrita da data do diagnóstico (a outra parte que grava, e só pelo profissional): `src/components/medicina/DiagnosticosCID10Card.tsx`
  (a camada pura da linha do tempo continua sem escrever nada; o corte e as funções de data ficam em `tipos.ts` e `datas.ts`).
- Botão "Abrir o Avatar" (só passa uma função e um pedido): `PacientePerfil.tsx`, `AvaliacaoVozAtual.tsx`, `AvaliacaoSecoesEditaveis.tsx`,
  `PacienteDashboardIdentidade.tsx` e `PatientIntegratedDashboard.tsx`.
- Botão "Abrir" dos marcos (avaliação e diagnóstico): destino em `src/lib/resumoClinico/marcos.ts` (`destinoDoRegistro`) e `tipos.ts`; texto do botão em `exibicao.ts`
  (`textoDoBotaoAbrir`); rolar e destacar em `src/hooks/useAbrirRegistroClinico.ts`; funções passadas por `PacientePerfil.tsx`, `AvaliacaoVozAtual.tsx` e
  `AvaliacaoSecoesEditaveis.tsx`; marcas `data-diagnostico-id` / `data-cartao-diagnosticos` em `DiagnosticosCID10Card.tsx` e `data-avaliacao-id` em `AvaliacaoVozAtual.tsx`.
- Encaixe (poucas linhas): `AvaliacaoSecoesEditaveis.tsx` (o cartão do Resumo passa pelo seletor; a linha do tempo entra no fim
  da aba Clínico) e `AvaliacaoVozAtual.tsx` (sem avaliação por voz, ou com a gravação ainda aberta, a linha do tempo aparece).
- Banco falso dos testes: `src/test/helpers/bancoFalso.ts` ganhou projeção de coluna jsonb com apelido
  (`origem:resultado->_meta->>origem`), como o PostgREST; é aditivo e tem teste em `src/test/bancoFalso.test.ts`. Na etapa 2 ganhou, também só
  aditivo: filtro `eq`/`not` por caminho jsonb (`metadata->>origem`), `delete` com `.select()` que devolve as linhas removidas, `insert` com id repetido
  que devolve o erro `23505`, código opcional na falha simulada (`PGRST204`, `42501`) e `padroesNoInsert` (o `created_at` que o servidor preencheria).
- Testes: `src/test/resumoClinico*.test.ts(x)` (marcos, datas, completo, leitura, tela, privacidade) e
  `src/test/useFontesClinicas.test.tsx`. As regras da data do diagnóstico, da data do exame importado e da data do MyID estão em
  `resumoClinicoMarcos.test.ts` e `resumoClinicoDatas.test.ts`; o limite de 200, o aviso de corte, a escolha do MyID por `created_at`,
  a invalidação do cache e a leitura dos vínculos do MyID, em `useFontesClinicas.test.tsx`. O cartão "Como começou", o título da
  cirurgia, a ordem natural, a lista de registros ignorados e a chave estável da cirurgia (camada pura) estão em
  `resumoClinicoComoComecou.test.ts`. A tela nova (cartão "Como começou", título da cirurgia, chips, avisos, letra) está em
  `resumoClinicoTelaCartao.test.tsx`; a lógica de exibição e a de filtro, em `resumoClinicoExibicao.test.ts` e
  `resumoClinicoFiltros.test.ts`; e cada ponto de escrita que invalida o cache, em `resumoClinicoInvalidacao.test.tsx`. O corte de
  18/11/2026 e as funções `criadaComADataExplicita`, `dataDoDiagnosticoPodeSerDoSistema` e `erroDaDataDigitada` estão em
  `resumoClinicoDataExplicitaDoDiagnostico.test.ts`; o campo "Data do diagnóstico" do cartão de CID (adicionar sem data envia `null`,
  com data envia a data, data no futuro recusada, informar/corrigir/limpar com `update` só no diagnóstico certo, erro do banco com toast
  e sem invalidar), em `diagnosticosCID10Card.test.tsx`.

Os testes da confirmação (etapa 2): a camada pura (SHA-256 contra `node:crypto`, id, chave, impressão, validação, linha gravada, leitura tolerante, contrato com a
migração) em `confirmacaoPuraDados.test.ts`, que roda também com `TZ=America/Sao_Paulo`, `UTC` e `Pacific/Kiritimati`; a substituição no marco e em "Sem data",
igual/alterado/apagado, duplicatas, data inválida e ordem, em `resumoClinicoConfirmacao.test.ts`; as duas leituras da história de vida, em `useFontesClinicas.test.tsx`;
o hook (payload exato, 23505, PGRST204 e 42703, delete com os quatro filtros, 0 linhas, duplo toque, sem usuário, só o sucesso invalida, o foco), em
`confirmarMarcoClinicoHook.test.tsx`; os dois diálogos (campos, validações, foco, descartar, aviso fixo, 2000 letras, 44 px, modo escuro), em
`confirmarMarcoDialog.test.tsx`; a linha do tempo (botão, selos, "ver relato original", alterado, apagado, Desfazer, as três formas da aba), em
`resumoClinicoConfirmarMarcoTela.test.tsx`; a página do perfil de verdade (clicar, preencher, ver o insert, desfazer, recepção, o texto digitado que sobrevive à remontagem
das seções, o diálogo que não esvazia na saída), em `perfilConfirmarMarco.test.tsx`; o foco depois de "Continuar editando", em `confirmarMarcoDialogFoco.test.tsx`; a troca de
paciente com o diálogo de confirmar ou de desfazer aberto (no hook e na página de verdade, com a segunda camada que recusa gravar e apagar), em
`confirmarMarcoTrocaDePacienteHook.test.tsx` e `confirmarMarcoTrocaDePacientePagina.test.tsx` (a animação de saída do Radix é simulada por
`src/test/helpers/animacaoDeSaida.ts`, porque o jsdom não anima); e o contrato estático (lê a migração e o texto do hook e da página), em `marcoConfirmadoGravacao.test.ts`.
O teste de privacidade (`resumoClinicoPrivacidade.test.ts`) **não foi alterado**: o hook novo fica fora das pastas que ele vigia, de propósito, e os dois diálogos e a
camada pura entram na conferência dele sozinhos.

Os testes do aviso dos achados: a regra da fila (matriz de casos, comparação com o código antigo do Avatar, uso único) em
`avatarFilaDeRevisao.test.ts`; o Avatar montado de verdade, igual antes e depois da troca, em `avatarFilaDeRevisaoTela.test.tsx`; a leitura
(colunas, paciente e profissional, nunca data, limite + 1, falha isolada, cache) em `achadosParaRevisaoLeitura.test.tsx`; a tela (singular e
plural, botão, sem a função, contagem 0, leitura em andamento, falha, marcos e "Sem data" iguais, 44 px) em `resumoClinicoAchadosTela.test.tsx`;
o caminho até o Avatar em `perfilAbrirOAvatar.test.tsx` (a página do perfil de verdade), `visaoGeralAbreNoAvatar.test.tsx` e
`avatarIrParaOAvatar.test.ts`.

Os testes do botão "Abrir": o destino de cada tipo de marco (só dois têm), em `resumoClinicoDestino.test.ts`; o botão na tela (só com a função e o destino, texto acessível,
44 px, nenhum botão nos outros marcos, em "Sem data" nem em "Como começou", e as três formas da aba Avaliação), em `resumoClinicoAbrirRegistroTela.test.tsx`; rolar, destacar e
apagar o destaque, em `abrirRegistroClinicoHook.test.tsx`; e a página do perfil de verdade (clicar abre e destaca o registro certo, o destaque some, a lente sem `cid` tira o
botão do diagnóstico, avaliação antiga sem botão), em `perfilAbrirRegistro.test.tsx`. O teste de privacidade (`resumoClinicoPrivacidade.test.ts`) não mudou e continua valendo para todos os arquivos
da linha do tempo, inclusive o aviso novo.

## Etapas futuras (não fazem parte desta)

1. **IA com revisão**: texto do Completo e marcos sugeridos por IA, sempre revisados pelo profissional antes de valer (e só com
   decisão sobre qual provedor pode receber dado de saúde).
2. **Liberar ao cliente Premium**: o profissional libera uma versão **revisada** (hoje o que veio do cliente está "não revisado").
   Vai exigir guardar a versão liberada e a revisão, o que esta etapa evita de propósito.
