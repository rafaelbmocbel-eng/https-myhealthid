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
recolher → enviar ao financeiro) nos cards — o mesmo controle continua em **Ver guia › Assinatura e financeiro** —, o filtro
"2 guias/mês" e a lista de encerrados com **Reativar** (em Clientes o cliente encerrado aparece com **Ativar cliente**). A
cadência 1 / 2 / 3 em 2 meses continua em **Editar cadastro**.

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

## Faturamento

- Tabela nova `public.cassi_financeiro_clientes` (`terapeuta_id`, `mes` 'AAAA-MM', `paciente_id`; única por profissional+mês+
  cliente; RLS só do dono; INSERT só para paciente do próprio profissional; sem UPDATE). Migração
  `20261025190000_cassi_financeiro_clientes.sql`.
- Cada mês tem a sua lista. Adiciona-se por busca ou com **Adicionar quem teve sessão no mês** (quem tem sessão atendida na
  agenda no mês e ainda não está na lista).
- Só os clientes da lista entram em: cálculo do mês (sessões, bruto, imposto, líquido, sua parte, clínica, repasses), "sua
  parte" dos 6 meses, CSV, Guias enviadas ao financeiro, Guias que fecham no mês e a seleção automática do Relatório de produção
  (dentro do relatório ainda dá para marcar/desmarcar qualquer guia).
- **As fórmulas não mudaram.** Elas saíram da tela para `src/lib/cassiFinanceiro.ts` e `src/test/cassiFinanceiro.test.ts`
  compara a conta nova (com todos os clientes na lista) com a original (`src/test/cassiFinanceiroReferencia.ts`, cópia do
  código de antes) em 40 cenários sorteados.
- Cliente na lista sem sessão atendida na agenda aparece avisado ("sem sessão atendida") e não entra na conta; o número de
  sessões continua vindo só da agenda (não há digitação manual).
- Mês sem lista não calcula nada (o Relatório avisa e deixa marcar as guias à mão). Relatórios já salvos não dependem da lista.

## Correção de passagem

A tela tinha duas consultas com a mesma chave `['cassi-pacientes', uid]` e colunas diferentes; a do Faturamento, mais
estreita, ao montar sobrescrevia o cache e fazia sumir `cassi_pedir_guia`, `guias_por_mes` etc. Agora há uma só
(`useCassiPacientes`), com teste que impede a volta da duplicata.

## Publicação

Duas etapas: 1) migração na `main` (o GitHub Action "Deploy Supabase" roda `db push`) e conferir a tabela em produção;
2) só então o front.
