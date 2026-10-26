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
- A mensagem (Copiar / WhatsApp), os campos (carteirinha, diagnóstico, até 3 códigos) e o Dar baixa **não mudaram**; só foram
  para `src/lib/cassiPedidos.ts` (`montarTextoPedido`, `itemDoPedido`), com teste do texto exato.
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
  A tela lança no máximo 6 guias por cliente no mês.
- Adiciona-se o cliente por busca ou com **Adicionar quem teve sessão no mês**; isso só põe o cliente na lista, **não lança nada**. Para
  lançar, toque no cliente: cada código tem um campo de quantidade (− e +), e dá para abrir **Outra guia** (cliente com 2 guias no mês).
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

Código que não está na tabela (criado em Configurações) segue a guia da CASSI: 10 por guia. Os limites valem no campo (não deixa passar),
no que é salvo e na lista (cliente acima do limite aparece sinalizado). Os valores e descrições vêm de **Configurações**: quem já tinha o
código lá mantém o valor que configurou; o que falta da tabela entra com os dados acima (código novo: 020, 301, 131, 185). Ver
`src/lib/cassiFaturamento.ts`.

Lista de códigos e valores de 25/10/2026 (012, 020, 301, 131 e 185): a migração `20261025233000_cassi_config_codigos_tabela_cassi.sql`
atualiza os códigos **já salvos** na configuração do Rafael (valor, descrição e código oficial passam a ser os da lista; os que não
existiam entram no fim; 144, 160 e os que ele criou ficam como estão). Antes, guarda a configuração original em
`bkp_cassi_config_codigos_20261025` (fechada para a API; pode ser apagada depois de conferida). Não cria configuração, não mexe em
outro profissional e pode rodar de novo sem trocar o backup.

### O que entra na conta

- Só os clientes da lista (e que continuam no controle CASSI) entram em: valor do mês (bruto, imposto, líquido, sua parte, clínica,
  repasses), "sua parte" dos 6 meses (cada mês com o lançamento dele; mês sem lançamento aparece como —), CSV (com os códigos), Guias que
  fecham no mês e a seleção automática do Relatório de produção (dentro do relatório ainda dá para marcar/desmarcar qualquer guia).
- "Sessões" = soma das quantidades de todos os códigos, menos a consulta (144).
- Imposto e líquido são arredondados a centavos **em cada cliente**, e os totais são a soma das linhas que aparecem (nunca 1 centavo de diferença).
- Sem nenhum lançamento no mês os cartões de resumo não aparecem (em R$ 0,00 pareceriam um mês sem receita): fica a mensagem "Nenhum código
  lançado neste mês".
- **Configurações**: se a leitura falhar, a aba mostra "Não consegui carregar suas configurações" com **Tentar de novo**, em vez de calcular com
  valores inventados e imposto 0%. Quem nunca salvou Configurações vê o aviso de que valem os valores da tabela da CASSI (sem imposto, sua parte
  em 0%) e continua com os códigos 160 e 185 do Pedir guias. Os códigos da tabela voltam à lista sempre que faltarem (não dá para escondê-los
  em Configurações).
- **Editor de lançamento**: o que foi digitado e não salvo pede confirmação antes de ser descartado (Cancelar, trocar de cliente, fechar,
  "Usar 012 × N da agenda"); durante a gravação o botão mostra "Salvando…" e os campos ficam travados; trocar de mês fecha o editor.
  **Tirar da lista** e **Limpar lista** avisam que o lançamento também é apagado (e quantos clientes). **Preencher com a agenda** não roda com
  um editor aberto e, quando a agenda tem mais sessões do que cabem em 6 guias de 10, lança 60 e avisa quem passou.
- **Relatório de produção**: as colunas são só dos códigos que alguma guia (não cancelada) usou; os da tabela que nunca apareceram numa guia
  não viram coluna zerada no relatório da clínica.
- Imposto: percentual de Configurações sobre o bruto (se for o valor fixo antigo, vale por guia lançada). Repasse: pelo responsável
  técnico da guia mais recente do cliente.
- **Guias enviadas ao financeiro** é rastreio de entrega física, não conta: aparece sempre, com ou sem lista.
- **Juntar cadastros duplicados** leva as linhas da lista (e o que foi lançado) do duplicado para o cliente que fica, por uma função do banco
  (`cassi_juntar_financeiro_clientes`) numa transação só: no mês em que o cliente que fica não estava a linha é copiada; no mês em que os dois
  estavam, as guias do duplicado entram depois das dele. Se a soma passar de 6 guias num mês, a junção inteira é recusada com a mensagem do
  banco (nada muda: ajuste os lançamentos e tente de novo). Uma falha no meio desfaz tudo, então tentar de novo nunca soma duas vezes.
- O **Relatório de produção** e as **Guias que fecham** continuam saindo das guias (`guias_cassi`), não dos lançamentos: pode haver
  diferença entre o valor do Faturamento e o do Relatório. É uma decisão em aberto se o Relatório deve passar a usar os lançamentos.
- Mês sem lista não calcula nada; os relatórios já salvos não dependem da lista.

## Correção de passagem

A tela tinha duas consultas com a mesma chave `['cassi-pacientes', uid]` e colunas diferentes; a do Faturamento, mais
estreita, ao montar sobrescrevia o cache e fazia sumir `cassi_pedir_guia`, `guias_por_mes` etc. Agora há uma só
(`useCassiPacientes`), com teste que impede a volta da duplicata.

## Publicação

Duas etapas: 1) migrações na `main` (o GitHub Action "Deploy Supabase" roda `db push`: `20261025190000` lista, `20261025230000`
lançamentos + função de juntar, `20261025233000` códigos salvos) e conferir em produção (`list_migrations`); 2) só então o front. Se o front
chegasse antes, a lista do mês não carregaria ("Não consegui carregar a lista deste mês" com **Tentar de novo**), salvar um lançamento falharia
e juntar cadastros duplicados falharia sem mudar nada; por isso a ordem.

As migrações foram ensaiadas num PostgreSQL 16 descartável (esquema do Supabase simulado, papéis anon/authenticated, RLS, privilégios por
coluna, função de juntar com falha no meio, estouro de 6 guias e outro profissional): o banco falso das telas não emula CHECK, GRANT nem RLS.

A migração tira todos os privilégios do papel `authenticated` na tabela antes de conceder só SELECT, INSERT e DELETE (no Supabase
ele nasce com todos, inclusive TRUNCATE, que a segurança por linha não alcança).
