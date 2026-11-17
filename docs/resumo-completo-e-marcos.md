# Resumo Completo e Linha do tempo clínica (etapa 1)

Pedido do Rafael: no perfil do paciente, aba **Avaliação > Clínico**, o cartão "Resumo Clínico" ganha uma **versão mais
completa**, e ao lado entra uma **linha do tempo** com os marcos históricos do paciente, feitos a partir das respostas do
cliente no MyID, da avaliação presencial e dos outros formulários.

Decisões do Rafael para esta etapa: **regra fixa, sem IA** (nenhuma chamada a IA, nenhuma edge function nova, nenhum dado de
saúde enviado a provedor externo); **só o profissional vê**, no perfil do paciente; o cliente **não** vê nada disto.

## O que é

| Peça | Onde aparece | Pode editar? |
| --- | --- | --- |
| **Resumo** (o de sempre) | cartão "Resumo Clínico", seletor **Resumo \| Completo** | sim, pelo lápis, como antes (e continua indo ao prontuário, "Sincronizado") |
| **Completo** | mesmo cartão, seletor em "Completo" | **não**: só leitura, botão "Copiar" |
| **Linha do tempo clínica** | cartão logo abaixo, na aba Clínico; sem avaliação por voz ela aparece sozinha | não |

Tudo é **calculado na hora**. **Nada novo é gravado** pelo Completo nem pela linha do tempo: nem nota de prontuário, nem
`historia_vida_paciente`, nem `avaliacoes_voz`, nem coluna nova; nenhuma migração. (A única gravação ligada a este assunto é o campo
opcional "Data do diagnóstico" do **cartão de CID**, que é do cartão e não da linha do tempo: ver "A data do diagnóstico que o banco
preenche sozinho".) O Completo e a linha do tempo **não passam** por
`sincronizarProntuario`, `toggleConfirmacao`, `salvarEdicao` nem pela pré-confirmação, e **não são uma seção** de `SECOES`
(`AvaliacaoSecoesEditaveis.tsx`): essas seções são pré-confirmadas e vão sozinhas ao prontuário, que o cliente pode ler.

Avisos fixos no Completo (na tela):

- "Montado pelo app a partir das respostas; não vai para o prontuário." (também vai no fim do texto copiado)
- "Os selos Prontuário e Sincronizado do cabeçalho valem só para o Resumo." Só na tela: com o Completo aberto os selos do
  cabeçalho do cartão continuam à vista e poderiam sugerir que a versão longa foi ao prontuário. O texto copiado sai do app e os
  selos não saem junto, por isso o aviso não vai nele.

## De onde vem cada coisa

Cada fonte é lida em separado (`src/hooks/useFontesClinicas.ts`, só `select`). Se uma falha, aparece "Não consegui ler ..." e as
outras continuam. A leitura das datas de conclusão do MyID (`avaliacoes_identidade`) também é uma fonte à parte: se falhar, o aviso
diz "as datas de conclusão do MyID" e os MyIDs aparecem como "último registro".

| Fonte | Vira | Origem / selo |
| --- | --- | --- |
| `pacientes.historico_clinico.cirurgias` (ano válido) | marco **fato**, só o ano | cliente: "Relatado pelo cliente, não revisado" |
| `pacientes.historico_clinico.ultimo_envio` | marco **registro** ("Último envio do histórico clínico (pelo cliente)") | cliente |
| `myid_avaliacoes` (status `concluido`) + `avaliacoes_identidade.created_at` ligada a ele | marco **registro** "MyID concluído" (data do histórico); sem a ligação, "MyID (último registro)" com `updated_at` e aviso | cliente |
| `avaliacoes_voz` (só as do profissional, mesmo filtro da avaliação atual) | marco **registro** | profissional: "Registrado pelo profissional" |
| `historia_vida_paciente.data_evento` | marco **fato** | profissional |
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
- `eventos_clinicos_anatomicos` **não é lido**: os achados do histórico relatado gravam a data do **envio** como data de início
  e não dá para separar, com certeza, o que o profissional datou de verdade.
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
corrigir isso exigiria gravar o id no histórico do cliente, o que esta etapa evita.

### Marcos que NÃO existem de propósito

- **"História atual atualizada pelo cliente" foi removido**: `historia_atual.atualizado_em` é regravado pelo autosave do cliente a
  cada pausa na digitação, então não marca nenhum momento histórico. (O texto de `historia_atual.inicio` aparece no cartão "Como começou",
  não em "Sem data".)
- O `historico_clinico.atualizado_em` também não vira marco, pelo mesmo motivo.
- **"Último envio do histórico clínico (pelo cliente)" fica**: `ultimo_envio` só é gravado no envio explícito
  (`HistoricoClinicoCard.tsx`, botão de enviar); o autosave grava `{ ...dados, atualizado_em }` e só devolve o `ultimo_envio` que já
  estava lá, sem mudar o valor.

## Selos de origem

- O que veio do **cliente** leva **"Relatado pelo cliente, não revisado"**; o que o **profissional** registrou leva **"Registrado
  pelo profissional"**. Nunca o contrário (um teste confere todos os marcos).
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

## Duplicidade: o mesmo fato do cliente e do profissional aparece duas vezes, de propósito

Se o cliente relata uma cirurgia no histórico clínico e o profissional registra a mesma cirurgia na história de vida, a linha do
tempo mostra **dois marcos**, cada um com o seu selo (e, em geral, com precisões diferentes: o ano que o cliente escreveu e o dia
que o profissional registrou). **Não há deduplicação.** Juntar os dois esconderia justamente a divergência, que é o que o
profissional precisa enxergar para conferir com o cliente. Um teste registra essa decisão.

## O que NÃO faz

- Não usa IA, não grava nada, não entra no prontuário nem no "Sincronizado".
- Não mostra hipóteses diagnósticas nem red flags no Completo (ficam na aba Quadro/Dx; um texto copiado poderia ser lido como
  diagnóstico). Não mostra o plano. Pelo mesmo motivo, diagnóstico do tipo "suspeita" não vira marco.
- Não classifica ("normal", "alterado", "bom", "ruim") nem interpreta; não reescreve o texto do cliente (aparece inteiro, sem
  corte, com quebra de linha).
- Não lê campos antigos do MyID (`bloco_1_date`, `bloco1.data_inicio_dor`), que a tela atual do cliente não grava.
- Não toca no portal do cliente (`src/pages/paciente/*`) e não muda a visibilidade das notas. Um teste estático confere que os
  arquivos novos não usam `console`, `localStorage`, `sessionStorage`, `document.cookie`, `indexedDB`, `fetch`, `XMLHttpRequest`,
  `WebSocket`, `sendBeacon`, `new Image(`, `window.open`, `.insert(`, `.update(`, `.upsert(`, `.delete(`, `.rpc(`, `functions.invoke`,
  nem importam `src/pages/paciente` ou apontam para rotas `/paciente` do portal; e que só o hook importa o client do Supabase (a camada
  pura e as telas não).
- Não religa `useTimelineCompleta`, `TimelineVidaCompleta`, `TimelineUnificada` nem `ResumoNarrativo` (outras abas).

## Tela

Fica em `LinhaDoTempoClinica.tsx` e nos componentes ao lado. Foi pensada para o celular (390 px): uma coluna, texto que quebra linha,
nada de rolagem para o lado.

**Ordem, de cima para baixo:** cabeçalho, aviso "Não consegui ler ..." (se alguma fonte falhou), cartão **"Como começou"**, avisos de
corte, aviso dos registros que ficaram de fora, chips de filtro (quando valem), marcos agrupados por ano, "Ver todos" e a faixa
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
| `historia_vida_paciente` | adicionar e remover | `hooks/useTimelineCompleta.ts` (`useHistoriaVidaMutation`) |
| `avaliacoes_voz` | gravar a avaliação (insert ou update) | `VoiceAssessment.tsx` |
| `avaliacoes_voz` | excluir pelo histórico | `AvaliacoesVozHistorico.tsx` |
| `avaliacoes_voz` | excluir a avaliação atual, reprocessar o complemento e as outras rotas que usam `invalidarCachesAvaliacaoVoz` | `utils/voiceAssessment/reprocessarComplemento.ts` |
| `myid_avaliacoes` e `avaliacoes_identidade` | excluir um MyID e o histórico ligado a ele | `PacienteDashboardIdentidade.tsx` |

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

## Limites conhecidos

- **Atestado (`DocumentosModal.tsx`)**: o CID que o modal sugere ao abrir passou a ser o último **cadastrado** (`created_at`), não o de
  data de diagnóstico mais recente. A data virou opcional e um CID novo sem data iria para o fim da fila. Um teste
  (`documentosModalCid.test.ts`) trava essa ordem.

- Se a avaliação por voz existe mas nenhuma seção tem texto ("Nenhuma seção disponível nesta avaliação"), a linha do tempo não
  aparece naquele cartão vazio.
- No Completo, o lápis do cabeçalho continua editando o **Resumo** (não o Completo). **O seletor volta para "Resumo" ao abrir o
  editor do lápis**: durante a edição o seletor some (o editor ocupa o lugar do cartão) e, ao salvar ou cancelar, o cartão volta em
  "Resumo", mesmo que o profissional estivesse no Completo. Um teste registra esse comportamento.
- Só entram no resumo e na linha do tempo o MyID **concluído** mais recente (respostas) e até 20 MyIDs (marcos); as avaliações
  presenciais até 20; história de vida, exames presenciais, testes funcionais, escalas e vínculos do MyID até 50 linhas.
- **Diagnósticos e exames importados leem até 200 linhas**, ordenados por data mais recente primeiro e **com os sem data por último**.
  Acima disso saem primeiro as linhas sem data (a faixa "Sem data" pode ficar incompleta) e depois as de data mais antiga. Subir mais
  o limite pesaria a leitura de todo perfil aberto.
- **Aviso de corte.** Cada lista é lida com **limite + 1** (51, 201, 21...): se a linha extra vier, a lista passou do limite, a linha
  extra é descartada e a fonte entra em `cortes`, no resultado do hook (`lerFontesClinicas` e `useFontesClinicas`). Cada corte é
  `{ fonte, nome, limite, texto }`, com `texto` pronto, por exemplo **"Diagnósticos: mostrando os 200 mais recentes."**: a tela só
  precisa mostrá-lo. Exatamente o limite não é corte. Fonte que falhou não aparece em `cortes` (ela já está em `falhas`). O MyID com as
  respostas (limite 1) não é lista cortada. A cirurgia do histórico clínico e a história atual não têm limite.
- O diagnóstico criado **antes de 18/11/2026** cuja data real coincide por acaso com o dia do cadastro vai para "Sem data" (ver "A data
  do diagnóstico que o banco preenche sozinho"). Depois do corte, a data (ou o vazio) é do profissional e vale.
- "MyID concluído" só aparece com a ligação ao histórico (`avaliacoes_identidade`); sem ela, "MyID (último registro)".

## Onde está no código

- Camada pura (sem React nem Supabase): `src/lib/resumoClinico/` (`tipos`, `leitura`, `datas`, `marcos`, `resumoCompleto`, `cortes`).
- Dados: `src/hooks/useFontesClinicas.ts` (leitura, `cortes`, `invalidarFontesClinicas`).
- Telas: `src/components/resumoClinico/` (`ResumoClinicoVisoes`, `ResumoCompleto`, `LinhaDoTempoClinica`, `ComoComecouCard`,
  `FiltroDeMarcos`, `RegistrosDeFora`, `SeloDeOrigem`, `AvisoDeFalhas`). Lógica de exibição sem React: `exibicao.ts` (título, rótulo do
  tipo, detalhe) e `filtros.ts` (categorias e chips).
- Escrita da data do diagnóstico (a única parte desta etapa que grava, e só pelo profissional): `src/components/medicina/DiagnosticosCID10Card.tsx`
  (a camada pura da linha do tempo continua sem escrever nada; o corte e as funções de data ficam em `tipos.ts` e `datas.ts`).
- Encaixe (poucas linhas): `AvaliacaoSecoesEditaveis.tsx` (o cartão do Resumo passa pelo seletor; a linha do tempo entra no fim
  da aba Clínico) e `AvaliacaoVozAtual.tsx` (sem avaliação por voz, ou com a gravação ainda aberta, a linha do tempo aparece).
- Banco falso dos testes: `src/test/helpers/bancoFalso.ts` ganhou projeção de coluna jsonb com apelido
  (`origem:resultado->_meta->>origem`), como o PostgREST; é aditivo e tem teste em `src/test/bancoFalso.test.ts`.
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

## Etapas futuras (não fazem parte desta)

1. **IA com revisão**: texto do Completo e marcos sugeridos por IA, sempre revisados pelo profissional antes de valer (e só com
   decisão sobre qual provedor pode receber dado de saúde).
2. **Liberar ao cliente Premium**: o profissional libera uma versão **revisada** (hoje o que veio do cliente está "não revisado").
   Vai exigir guardar a versão liberada e a revisão, o que esta etapa evita de propósito.
