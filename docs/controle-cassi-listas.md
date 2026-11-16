# Controle CASSI — listas de "Pedir guias" e de "Faturamento"

Pedido do Rafael (25/10/2026): tirar a aba **Este mês** por enquanto; fazer **Pedir guias** funcionar com a lista que o
profissional monta (procura os clientes, adiciona, forma a mensagem); e o **Faturamento** do mesmo jeito (adiciona os
clientes do mês e a tela cria o cálculo financeiro). Mexer nas características do pedido à CASSI fica para depois.

## Abas

| Aba | Situação |
| --- | --- |
| Clientes | abre aqui; a Calculadora de dias úteis (que morava em "Este mês") fica no topo |
| Este mês | **desligada**: constante `MOSTRAR_ESTE_MES = false` em `src/pages/ControleCassi.tsx`. O código da aba continua; mudar para `true` traz de volta a aba, o botão "Colocar em Este mês", o selo "no mês ✓" e os textos que falam dela |
| Pedir guias | lista própria (abaixo) |
| Faturamento | lista própria por mês (abaixo) |
| Planilha | sem mudança |

Só existiam na aba "Este mês" (enquanto ela estiver desligada): os botões rápidos do passo físico da guia (assinar →
recolher → enviar ao financeiro) nos cards, o filtro "2 guias/mês" e a lista de encerrados com **Reativar**.

- O passo físico continua em **Ver guia › Assinatura e financeiro**, e o card em Clientes mostra o que falta ("Falta: assinar e
  recolher", "Falta: enviar ao financeiro") — clicar abre a guia. **Ver guia** fica sempre no menu ⋮ do card, mesmo quando o
  botão principal é "Pedir guia".
- Os cards de Clientes usam a mesma contagem de sessões das sugestões do pedido (a maior entre a salva na guia e a da agenda).
- Cliente encerrado aparece com **Ativar cliente**. A cadência 1 / 2 / 3 em 2 meses continua em **Editar cadastro**.

## Pedir guias

- A lista do pedido é o marcador durável `pacientes.cassi_pedir_guia = true` (coluna que já existia). Ele só sai ao **Dar
  baixa** (que também grava `guia_solicitada_em`) ou ao tirar o cliente da lista (X).
- Entra na lista: busca por nome ou carteirinha (inclui encerrado: adicionar reativa), "Pedir guia" no card do cliente, ou
  "Adicionar" nas sugestões.
- **Sugeridos pelo sistema** (recolhido): as regras de antes — faltam ≤ 2 sessões, guia usada, sem guia, ou 2 guias/mês com o
  prazo vencido (`src/lib/cassiPedidos.ts › sugestoesDoPedido`). Nada entra no pedido sozinho.
- Quem já teve o pedido feito (e a guia nova ainda não chegou) não volta para a lista: fica em **Guias pedidas — aguardando
  CASSI**.
- A mensagem (Copiar / WhatsApp), os campos (carteirinha, diagnóstico, **até 5 códigos**, `MAXIMO_CODIGOS_PEDIDO`; o limite era 3 até
  nov/2026) e o Dar baixa estão em `src/lib/cassiPedidos.ts` (`montarTextoPedido`, `itemDoPedido`), com teste do texto exato.
  Se o cliente tem justificativa gerada dos códigos 301/131 (ver `docs/cassi-justificativas.md`), ela vai na mensagem logo depois do
  diagnóstico (`justificativasParaMensagem`).
- Quem estava marcado "Vou pedir a guia" pelo fluxo antigo de "Este mês" (`cassi_pedir_guia` já verdadeiro) aparece na lista.
- **Desfazer** um pedido (em "Guias pedidas — aguardando CASSI") é o inverso da baixa: o cliente volta para a lista.
- Registrar a **guia nova** do cliente (Nova guia / registrar manual) tira o cliente da lista: a guia chegou.
- "Pedir guia" de cliente **encerrado** pede confirmação (reativa o cliente, limpando o motivo do encerramento).
- O que foi editado na tela (carteirinha, diagnóstico, códigos, marcação) some junto com o cliente ao retirar ou dar baixa.
- As gravações da lista mudam a tela na hora; se o banco recusar, só aquele cliente volta ao que era.

## Faturamento

O Faturamento é a lista de clientes de cada mês, e **em cada cliente o profissional lança os códigos usados e a quantidade de
cada um**. O valor do mês sai disso: quantidade × valor do código. A Agenda não entra mais na conta (aparece só como referência
em cada cliente: "agenda: 8 sessões").

- Tabela `public.cassi_financeiro_clientes` (`terapeuta_id`, `mes` AAAA-MM, `paciente_id`, `lancamentos`); única por profissional+mês+cliente; RLS só do dono; INSERT só para cliente
  seu. O profissional só pode atualizar a coluna `lancamentos` (privilégio por coluna). Migrações `20261025190000` (lista) e
  `20261025230000` (lançamentos e a função de juntar cadastros); `20261025233000` atualiza os códigos salvos (abaixo).
- `lancamentos` é uma lista de **guias**; cada guia é `{ "código": quantidade }`. Ex.: `[{"012":10,"144":1},{"012":4,"301":2}]`. O banco
  recusa o que não for esse formato (até 12 guias; até 30 códigos por guia; código de 1 a 12 caracteres; quantidades inteiras de 0 a 999).
  A tela lança no máximo 6 guias por cliente no mês (`MAXIMO_GUIAS_NO_MES`).
- Adiciona-se o cliente por busca ou com **Adicionar quem teve sessão no mês**; isso só põe o cliente na lista, **não lança nada**. Para
  lançar, toque no cliente: os códigos que já vêm marcados ficam no topo (abaixo, "Modelo da guia") e cada código tem um campo de
  quantidade (− e +). O mesmo cliente pode ter mais de uma guia no mês (abaixo, "O mesmo cliente de novo na fatura").
  **Preencher com a agenda** lança 012 × as sessões da agenda (de 10 em 10 por guia) em quem ainda não tem lançamento.

### Tabela de códigos

| Código | Oficial | Descrição | Valor | Limite |
| --- | --- | --- | --- | --- |
| 012 (padrão) | 5.00.00.012 | Sessão de psicomotricidade individual | R$ 57,70 | 10 por guia |
| 020 | 5.00.00.020 | Sessão de psicomotricidade em grupo | R$ 57,70 | 10 por guia |
| 144 | 5.00.00.144 | Consulta ambulatorial em fisioterapia | R$ 65,62 | 1 por guia |
| 301 | 2.01.03.301 | Infiltração de ponto gatilho (por músculo) ou agulhamento seco (por músculo) | R$ 35,55 | 10 por guia |
| 131 | 2.01.03.131 | Biofeedback com EMG | R$ 67,79 | 10 **no mês** |
| 185 | 3.16.02.185 | Estimulação elétrica transcutânea | R$ 108,44 | 10 por guia (limite não informado: vale o da guia) |
| 160 | 5.00.00.160 | Atendimento fisioterapêutico ambulatorial ao paciente com disfunção decorrente de alterações do sistema músculo-esquelético | R$ 31,97 | 10 por guia (entrou em 15/11/2026, pedido do Rafael; conta como sessão) |

Código que não está na tabela (criado em Configurações) segue a guia da CASSI: 10 por guia. Os limites valem no campo (não deixa passar),
no que é salvo e na lista (cliente acima do limite aparece sinalizado). Os valores e descrições vêm de **Configurações**: quem já tinha o
código lá com **valor positivo** mantém o valor que configurou (nunca é trocado pelo da tabela); o que falta da tabela entra com os dados
acima (código novo: 020, 301, 131, 185, 160). **Valor de reserva**: um código DA TABELA que esteja salvo sem valor positivo (vazio, 0,
negativo ou inválido) passa a usar o valor da tabela ao ler a configuração (`mesclarCodigosComPadrao`), sem migração e sem gravar nada;
código fora da tabela segue como está (com 0 continua avisando "sem valor (defina em Configurações)"). Ver `src/lib/cassiFaturamento.ts`.
Valor escrito com vírgula decimal ("40,00", "1.234,50") vale como o número escrito, não é trocado pelo da tabela.
**Conferir em Configurações:** quem já tinha o 160 salvo com **outro valor positivo** (por exemplo R$ 60,00) continua com esse valor, não
com R$ 31,97; o Rafael deve abrir Configurações e ver se o 160 está com R$ 31,97 (se estava sem valor, já aparece 31,97 e salvar grava).

### Modelo da guia e "Códigos pré-preenchidos"

Cada guia nova já abre com um **modelo**: os códigos marcados (e a quantidade de cada um) ficam **no topo**, destacados e na ordem do
modelo; os demais ficam sob **Outros códigos (N)**, recolhido (`aria-expanded`/`aria-controls`; o conteúdo está sempre na página, só
escondido). "Outros códigos" **abre sozinho** quando algum código dele já está marcado em alguma guia (por exemplo um lançamento salvo com
301), quando há código fora da lista (valor R$ 0,00, para dar para zerar) ou quando o modelo não tem nenhum código no topo; enquanto
houver código marcado ali a lista não recolhe (nada que está valendo some). A quantidade proposta ao marcar vem do modelo; fora do modelo,
é 10 ou o limite por guia do código (144: 1). A guia nova também **respeita o que ainda cabe no mês** nas guias que o cliente já tem
(131: 10 no mês): com o 131 × 10 no modelo, a segunda guia nasce sem o 131 (ou só com o que sobrou), para já abrir dentro do limite e deixar
salvar. Trocar o modelo com o editor aberto não conta como "algo digitado" (a referência é a guia de quando o editor abriu).

- **Modelo padrão** (enquanto o profissional não escolher): **144 × 1, 012 × 10 e 160 × 10 marcados**, nessa ordem; depois, desmarcados,
  185, 131, 301 e 020 (10 cada). Antes (03/11/2026) o **185 vinha marcado e o 160 não existia na tabela**: agora o **185 deixou de vir
  marcado por padrão** (continua em Outros códigos, é só marcar). Quem quiser o 185 de volta: botão abaixo.
- **Botão "Códigos pré-preenchidos"** (aba Faturamento, acima da lista de clientes, com a faixa "Já vem marcado na guia nova: 144 × 1 · 012 ×
  10 · 160 × 10"): abre uma lista com **todos** os códigos (código, descrição, oficial, valor e limite) com a caixa "já vem marcado", a
  quantidade (1 até o limite: 144 só 1; 131 até 10 no mês; os demais até 10), **subir/descer** a ordem entre os marcados e **Voltar ao
  padrão (144, 012 e 160)**. Vale para guia **nova**; o que já foi lançado e salvo **não muda**. Salvar só liga quando algo mudou.
- **Onde fica** (sem migração, nada em `supabase/`): dentro de `cassi_config.codigos`, em cada código, o campo opcional
  `pre_preenchido`: `{ "quantidade": n }` = já vem marcado com n; `null` = escolheu que não vem marcado; **sem a chave em nenhum código**
  = vale o modelo padrão. Com a chave em algum código vale a escolha: os marcados na ordem em que estão na lista, depois os demais. Código
  novo criado depois, sem a chave, não vem marcado. Quantidade inválida vira a do padrão do código e acima do limite vira o limite.
  "Voltar ao padrão" (ou uma escolha igual ao padrão) **tira a chave de todos**. Lógica pura em `src/lib/cassiModeloConfig.ts`
  (`modeloDaConfiguracao`, `codigosParaSalvar`); gravação em `src/hooks/useModeloDaGuiaCassi.ts`.
- **Como grava**: só a coluna `codigos` (e `updated_at`) da configuração do próprio profissional. Antes **relê** o `codigos` do banco (uma
  edição feita em outro aparelho não é sobrescrita), junta a escolha (valor, descrição e código oficial não mudam) e faz o `update` pedindo a
  linha de volta: se não atingiu **exatamente 1 linha** é erro visível, nunca "salvo" falso. Sem configuração salva o botão Salvar não grava
  (nunca se cria a configuração escondido): o diálogo diz "Salve primeiro as Configurações CASSI" e tem um atalho que abre as
  Configurações. Se a leitura da configuração falhou, o botão fica desligado com o aviso. Durante a gravação os campos travam; com erro o
  diálogo continua aberto com o que foi escolhido; com sucesso a configuração é relida e o diálogo fecha.
- **Configurações CASSI** continua salvando como antes e **preserva `pre_preenchido`** de cada código (o diálogo não mostra o campo, mas o
  leva junto). Apagar um código lá tira o código e a escolha dele; um código novo lá não traz a chave.
- **Ordem no resumo e no relatório**: a lista do mês ("012 × 10 · 301 × 2"), o CSV e as colunas do **Relatório de produção** seguem sempre a
  ordem **padrão** (144, 012, 160, 185, 131, 301, 020), sem depender do que o profissional pré-preenche: o arquivo entregue à clínica não
  muda de formato por preferência de tela. O modelo escolhido só mexe no editor de lançamento.

### O mesmo cliente de novo na fatura (outra guia)

O mesmo cliente pode ter mais de uma guia no mês: **cada guia vira uma linha no relatório**. Nada novo no banco: continua uma linha por
cliente e mês em `cassi_financeiro_clientes`, com mais de uma guia em `lancamentos` (até 6 pela tela, 12 no banco).

- Em cada cliente da lista do mês há o botão **Outra guia** (visível, alvo de 44 px): abre o lançamento desse cliente **já com uma guia nova a
  mais** (com o modelo). Cliente sem nenhuma guia lançada: só abre o lançamento (a guia do modelo já é a primeira). Com o lançamento do
  próprio cliente já aberto, o botão acrescenta uma guia ali mesmo, sem perder o digitado.
- Na busca **Adicionar cliente**, quem **já está na lista** também aparece, com a marca "já na lista · adicionar outra guia", e escolher faz o
  mesmo que o botão da linha (não adiciona de novo). (A busca de **Pedir guias** usa o mesmo componente e não mudou: lá quem já está no pedido
  continua fora.)
- No limite de 6 guias no mês o botão e a opção da busca ficam desligados, e a linha diz "limite de 6 guias no mês".
- Mesmas travas de sempre: durante uma gravação nada abre; com algo digitado e não salvo em **outro** cliente, pergunta antes de descartar.

**O que muda para quem já tem configuração salva**: nada é regravado. Se o `codigos` salvo não tem `pre_preenchido`, passa a valer o modelo
padrão novo (144, 012 e 160; o 185 deixa de vir marcado). O 160 aparece sozinho na lista de códigos (valor da tabela, se o salvo estava sem
valor). Dados já lançados e salvos não mudam.

**Catálogo de "Pedir guias" (decidido em 15/11/2026)**: o catálogo de "Pedir guias" (`CODIGOS_CASSI` em `src/lib/cassiGuias.ts`) é separado do
Faturamento. Ele tinha o 160 com a descrição "Sessão de psicomotricidade" (era o texto do 012, por engano); o Rafael confirmou que está errado
e a descrição do 160 lá passou a ser a oficial, a mesma da tabela do Faturamento ("Atendimento fisioterapêutico ambulatorial ao paciente com
disfunção decorrente de alterações do sistema músculo-esquelético"; teste `src/test/cassiCatalogoDescricao160.test.ts`). A mensagem do
pedido à CASSI continua levando só os números dos códigos. Quem **salvou** o 160 nas Configurações com aquele texto errado ("Sessão de
psicomotricidade", qualquer caixa, com ou sem acento) passa a ver a descrição oficial ao ler a configuração (só esse texto, só no 160; qualquer
outra descrição que o profissional escreveu fica como está). Nada é regravado: a troca vale na leitura e é gravada se ele salvar as Configurações.

Lista de códigos e valores de 25/10/2026 (012, 020, 301, 131 e 185): a migração `20261025233000_cassi_config_codigos_tabela_cassi.sql`
atualiza os códigos **já salvos** na configuração do Rafael (valor, descrição e código oficial passam a ser os da lista; os que não
existiam entram no fim; 144, 160 e os que ele criou ficam como estão; o 160 sem valor passa a usar o da tabela só na leitura, sem esta migração). Antes, guarda a configuração original em
`bkp_cassi_config_codigos_20261025` (fechada para a API; pode ser apagada depois de conferida). Não cria configuração, não mexe em
outro profissional e pode rodar de novo sem trocar o backup.

### O que entra na conta

- Só os clientes da lista (e que continuam no controle CASSI) entram em: valor do mês (bruto, imposto, líquido, sua parte, clínica,
  repasses), "sua parte" dos 6 meses (cada mês com o lançamento dele; mês sem lançamento aparece como —), CSV (com os códigos), Guias que
  fecham no mês e o Relatório de produção.
- "Sessões" = soma das quantidades de todos os códigos, menos a consulta (144).
- Imposto e líquido são arredondados a centavos **em cada cliente**, e os totais são a soma das linhas que aparecem (nunca 1 centavo de diferença);
  "Sua parte", "Clínica" e cada repasse também fecham em centavos (sua parte + clínica = líquido; fica com você = líquido − repasses).
- Sem nenhum lançamento no mês os cartões de resumo não aparecem (em R$ 0,00 pareceriam um mês sem receita): fica a mensagem "Nenhum código
  lançado neste mês".
- **Configurações**: se a leitura falhar, a aba (e o próprio diálogo de Configurações) mostra "Não consegui carregar suas configurações" com
  **Tentar de novo**, em vez de calcular com valores inventados e imposto 0% (e CSV, Relatório e "Guias que fecham" ficam fora). O diálogo só
  monta o formulário com o que acabou de vir do banco: com releitura em andamento, pausada (sem rede) ou que falhou, o cache antigo não vira formulário
  (salvar a partir dele desfaria uma atualização). Quem nunca salvou Configurações vê o aviso de que valem os valores da tabela da CASSI (sem imposto, sua parte
  em 0%) e continua com os códigos do Pedir guias (144, 012, 160 e 185; o 160 e o 185 já estão na tabela, com o valor dela). Os códigos da tabela voltam à lista sempre que faltarem (não dá para escondê-los
  em Configurações).
- **Editor de lançamento**: o que foi digitado e não salvo pede confirmação antes de ser descartado (Cancelar, trocar de cliente, fechar,
  "Usar 012 × N da agenda", trocar de mês, tirar da lista o cliente aberto, limpar a lista); durante a gravação o botão mostra "Salvando…", os
  campos, os botões de abrir outro cliente e as setas e o campo de mês ficam travados; sem rede a gravação falha na hora (não fica pausada);
  trocar de mês fecha o editor. Cliente cujo código lançado tem valor R$ 0,00 mostra "códigos sem valor" na própria linha.
  **Tirar da lista** e **Limpar lista** avisam que o lançamento também é apagado (e quantos clientes). **Preencher com a agenda** não roda com
  um editor aberto, só grava em quem continua **sem lançamento no banco** (o que outro aparelho lançou nesse meio-tempo não é apagado; o aviso
  diz quem foi pulado ou saiu da lista) e, quando a agenda tem mais sessões do que cabem em 6 guias de 10, lança 60 e avisa quem passou.
- **Relatório de produção** (o PDF entregue à clínica): sai **exatamente do que foi lançado** na lista do mês, sem guias para marcar
  (decisão do Rafael, nov/2026; antes partia das guias cadastradas e pedia para marcá-las). Lógica em `src/lib/cassiRelatorio.ts`.
  - **Uma linha por guia lançada**, com a quantidade de cada código e a soma; os clientes em ordem alfabética, e cliente com 2 guias no
    mês ocupa 2 linhas. Só entram clientes que estão na lista do mês, continuam no controle CASSI e têm código lançado.
  - **Colunas**: só os códigos lançados, na ordem do lançamento (144 "Avaliação" primeiro; 012, 160, 185, 131, 301, 020...). Código da
    tabela que ninguém usou não vira coluna zerada; código lançado que saiu de Configurações entra no fim, com valor zero.
  - **Totais**: bruto, imposto e sua parte pela mesma conta do fechamento do mês (arredondados por cliente), então o PDF bate com os
    cartões da aba Faturamento.
  - **Mês do relatório**: o campo do topo troca de mês; cada mês usa o que foi lançado nele.
  - O diálogo mostra "N clientes · M guias", quem está na lista **sem código lançado** (fica fora) e, sem nada lançado, "Nenhum código
    lançado em <mês>". Salvar, Imprimir e Baixar PDF ficam travados sem nada lançado e enquanto a lista carrega ou falha em carregar.
  - **Salvar** guarda o relatório do mês em `relatorios_cassi` com o mesmo formato de sempre (colunas, linhas, totais).
- Imposto: percentual de Configurações sobre o bruto (se for o valor fixo antigo, vale por guia lançada). Repasse: pelo responsável
  técnico da guia mais recente do cliente.
- **Guias enviadas ao financeiro** é rastreio de entrega física, não conta: aparece sempre, com ou sem lista.
- **Juntar cadastros duplicados** leva as linhas da lista (e o que foi lançado) do duplicado para o cliente que fica, por uma função do banco
  (`cassi_juntar_financeiro_clientes`) numa transação só: no mês em que o cliente que fica não estava a linha é copiada; no mês em que os dois
  estavam, as guias do duplicado entram depois das dele. Se a soma passar de 6 guias num mês, a junção inteira é recusada com a mensagem do
  banco (nada muda: ajuste os lançamentos e tente de novo). Uma falha no meio desfaz tudo, então tentar de novo nunca soma duas vezes, e uma
  junção por vez por profissional (lock da transação) evita travar duas junções em sentidos opostos. A função roda **antes** das outras
  escritas da junção; se algo falhar depois dela, a mensagem diz que as listas do Faturamento já foram passadas (e nenhum cadastro foi
  removido), e tentar de novo conclui.
- As **Guias que fecham** continuam saindo das guias (`guias_cassi`), não dos lançamentos. O **Relatório de produção** não: passou a sair
  dos lançamentos (acima), então o valor do Faturamento e o do Relatório são o mesmo.
- Mês sem lista não calcula nada; os relatórios já salvos não dependem da lista.

## Correção de passagem

A tela tinha duas consultas com a mesma chave `['cassi-pacientes', uid]` e colunas diferentes; a do Faturamento, mais
estreita, ao montar sobrescrevia o cache e fazia sumir `cassi_pedir_guia`, `guias_por_mes` etc. Agora há uma só
(`useCassiPacientes`), com teste que impede a volta da duplicata.

## Publicação

Dois passos, nesta ordem (o GitHub Action "Deploy Supabase" roda `db push` a cada push na `main` que toque `supabase/`; a `20261025190000`,
da lista, já está em produção):
1. as **duas** migrações juntas, sozinhas num push: `20261025230000` (coluna dos lançamentos, CHECK, política e função de juntar) e
   `20261025233000` (atualização dos códigos e valores salvos de Rafael). Conferir em produção (`list_migrations`: as duas versões) e no log do
   passo "Push database migrations". Os `RAISE NOTICE` da segunda **não aparecem** no log do `db push`: a conferência de que os valores foram
   atualizados é olhar **Configurações** no app (012 e 020 = 57,70; 301 = 35,55; 131 = 67,79; 185 = 108,44). O front antigo continua funcionando com elas;
2. logo em seguida, o front (sem arquivo de migração: não dispara o Action). Se ele chegasse antes, a lista do mês nem carregaria ("Não
   consegui carregar a lista deste mês") e salvar lançamento e juntar cadastros falhariam; por isso a ordem.

Por que as duas migrações vão no mesmo push: cada push que toca `supabase/` roda também o passo "Import data (psql)" do Action (ver abaixo), então
menos pushes é melhor. O custo é uma janela de minutos entre o passo 1 e o 2 em que o front antigo monta o Relatório de produção com **todos** os
códigos da configuração (020, 301 e 131 aparecem como colunas zeradas): não gerar o Relatório nesse intervalo.

**Reverter**: a de dados — `UPDATE public.cassi_config c SET codigos = b.codigos, updated_at = now() FROM public.bkp_cassi_config_codigos_20261025 b WHERE b.terapeuta_id = c.terapeuta_id;`
(apaga edições de códigos feitas depois em Configurações). A `20261025230000` não se reverte apagando o arquivo (o próximo `db push` quebraria) nem
depois que o front novo está no ar (ele usa a coluna e a função): se for preciso desfazer, uma migração nova com `DROP FUNCTION
public.cassi_juntar_financeiro_clientes(uuid, uuid)` e `ALTER TABLE public.cassi_financeiro_clientes DROP CONSTRAINT cassi_financeiro_clientes_lancamentos_validos,
DROP COLUMN lancamentos` (perde o que foi lançado).

**Atenção — passo "Import data (psql)" do Action** (decisão do Rafael; ver `docs/ci-ajustes-deploy-supabase.md`, item 4): a cada push em `supabase/` ele
reaplica `supabase/data/import_*.sql`, que desligam a segurança por linha (`DISABLE ROW LEVEL SECURITY`) de `pacientes`, `profiles` e `agendamentos` por
cerca de 15 segundos por arquivo e reinserem (`ON CONFLICT DO NOTHING`) os registros importados em março a maio: o que foi **apagado** depois da
importação pode voltar. Medido no deploy de 26/10/2026 (run #269): a segurança ficou desligada ~15 s em `agendamentos` e ~15 s em
`pacientes`/`profiles`, e todos os `INSERT` devolveram 0 linhas (nada foi recriado), com alguns erros de chave estrangeira (agendamentos de
clientes que já não existem). O `db push` não mostra os `RAISE NOTICE` no log do Action: confirme a atualização dos códigos em Configurações.
Recomendação: remover o passo.

As migrações foram ensaiadas num PostgreSQL 16 descartável (esquema do Supabase simulado, papéis anon/authenticated, RLS, privilégios por
coluna, função de juntar com falha no meio, estouro de 6 guias, outro profissional, concorrência com pgbench com 3 cadastros e pares sorteados,
UPDATE condicional do Preencher com a agenda, destino criado por outra aba no meio da junção): o banco falso das telas não emula CHECK, GRANT nem
RLS. Os roteiros estão em `supabase/ensaios/` (`lancamentos.sh`, `codigos.sh`) e rodam com um PostgreSQL 16 local; saem com código diferente de
zero se algo falhar.
