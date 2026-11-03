# Check-in semanal de bem-estar

Questionário curto que o cliente responde **uma vez por semana**, para o profissional acompanhar a evolução entre um MyID
e o seguinte. Decisões do Rafael: ver `docs/fluxo-cliente-e-tiers.md` (seção "Check-in semanal").

## O que o cliente responde
| Pergunta | Escala | Obrigatória |
|---|---|---|
| Fadiga | 1 a 5 (5 = muito descansado) | sim |
| Qualidade do sono | 1 a 5 (5 = muito tranquilo) | sim |
| Dor muscular | 1 a 5 (5 = sem dor) | sim |
| Nível de estresse | 1 a 5 (5 = muito relaxado) | sim |
| Humor | 1 a 5 (5 = muito bom humor) | sim |
| Cor da urina | 1 (quase incolor) a 8 (marrom) | não |
| Recuperação do treino | 0 a 10 | não (só quem treina) |

Em todos os itens de 1 a 5, **quanto maior, melhor**. A soma dos 5 itens é o "índice de bem-estar" (5 a 25).
Os textos são do próprio app, inspirados no questionário de bem-estar de Hooper e Mackinnon (1995), na escala de
recuperação percebida de Laurent e colaboradores (2011) e na escala de cor da urina de Armstrong. Fonte única dos rótulos e
das regras: `supabase/functions/_shared/checkin-semanal.ts`.

## Como o cliente responde
- **Portal** (`/paciente/checkin`): formulário com opções para tocar; pode corrigir a resposta da semana; vê a própria evolução.
- **WhatsApp (Z-API)**: o app manda uma mensagem pedindo 6 números (7 para quem treina), por exemplo `4 3 5 4 4 2`.
  Aceita espaços, vírgulas, ponto e vírgula, traço, barra e "e" entre os números, ou os dígitos colados (`435442`), e ignora emoji.
  Vírgula ou ponto colado nos números (`4,5 3 5 4 4 2`) é recusado, porque pode ser meio ponto: o app pede para mandar de novo só
  com espaços. Texto misturado que começa com cinco números de 1 a 5 (`Oi! 4 3 5 4 4 2`) também recebe a ajuda em vez de ser gravado.
  O app confirma o que entendeu e, se o cliente mandar os números de novo, **corrige** (vale a última resposta da semana).
  `PARAR` (também `pare`, `sair`, `stop`, `descadastrar` e "não quero mais receber", com "por favor" ou emoji) desliga só o lembrete
  do check-in; `VOLTAR` religa. Sem um pedido de check-in em aberto (ou, no caso do PARAR, sem pedido nos últimos 30 dias), nada
  disso é tratado: a mensagem segue para o bot de IA como qualquer conversa.
- Uma resposta por **semana** (segunda a domingo, horário de Brasília). O pedido enviado no domingo à noite vale por 48 horas,
  então a resposta de segunda de manhã conta para a semana que acabou. Quem já respondeu a semana anterior **depois da virada**
  (por exemplo, na segunda de manhã pelo pedido de domingo) e responde de novo pelo portal **corrige essa mesma resposta**, em vez
  de criar uma segunda linha poucas horas depois; o portal usa a mesma regra para saber se o cliente "já respondeu esta semana"
  (linha da semana atual **ou** gravada desde a meia-noite de segunda).

## Onde o profissional vê
- Perfil do cliente > aba **Avaliação**, logo abaixo do bloco do Resumo Clínico: valor atual, comparação com a semana
  anterior, média inicial do próprio cliente, gráfico e faixa de atenção.
- Perfil do cliente > aba **Evolução e Prontuários**: o mesmo card com o gráfico maior.
- **Prontuário**: nota viva "Check-in semanal (autorrelato do cliente)" (uma por cliente, atualizada a cada resposta; só mostra
  os números, a variação e o total de respostas, sem aviso de queda) e nota "Atenção no check-in" quando há queda. As duas são
  registros automáticos e não podem ser editadas.
- **O cliente não vê o alerta.** A nota de atenção só é lida pelo profissional dono: o banco bloqueia a leitura para o cliente (política
  restritiva em `notas_prontuario`), a função `checkin_alertas` só roda no servidor (o cliente não a chama pela API) e a tela do portal
  também filtra. O cliente vê a nota viva, que é o autorrelato dele.
- **Só o servidor cria notas do check-in**: políticas restritivas em `notas_prontuario` impedem qualquer usuário logado de criar ou
  editar notas com tipo `checkin_%` (a política antiga de INSERT só exigia `auth.uid() = terapeuta_id`).
- Notificação no sino do profissional quando uma queda nova aparece.

## Regra do alerta de queda
O alerta compara as **duas últimas respostas (de semanas seguidas)** com a **média das 4 primeiras respostas do próprio
cliente**. Se as duas estão pelo menos 1 ponto abaixo, em algum dos 5 itens, há alerta naquele item. Exige 6 respostas no
total. Não é diagnóstico: é um convite para conversar com o cliente e rever o MyID. A mesma regra está no banco
(`checkin_alertas`) e no app (`calcularAlertas`), com os mesmos casos de teste. O card do profissional busca as 4 primeiras respostas
de toda a história e as 52 mais recentes, para a linha de base bater com a do banco mesmo depois de um ano de uso.
Se o cliente **corrige** o número errado na mesma semana e o alerta deixa de valer, a nota de atenção e a notificação ainda não lida
somem. O controle de repetição (21 dias) só considera notas de atenção gravadas pelo servidor para o profissional do cliente.
A gravação da nota viva e a do alerta falham separadamente: o retorno de `checkin_gravar` traz `nota_ok` e `alerta_ok`, e a resposta
do cliente nunca se perde por causa delas.

## O que o check-in NÃO faz
- Não muda a nota oficial do MyID (só o reteste muda). Conversa com as dimensões **R** (regulação: sono, fadiga, estresse),
  **D** (dor) e **HID** (hidratação).
- Não é monitorado em tempo real: toda mensagem avisa que, em caso de urgência, o cliente deve procurar atendimento.
- Não envia nada sozinho se o profissional não ligar o gatilho.

## WhatsApp: como funciona o envio
1. O profissional liga **Check-in semanal** em WhatsApp > Automações (desligado por padrão). Sem isso, nada é enviado.
2. Aos domingos, das **18h30 às 20h50** (Brasília), uma rotina roda a cada 10 minutos (**15 rodadas**) e envia para até **5 clientes
   por profissional por rodada**, com pausa de 4 a 9 segundos entre os envios (proteção contra bloqueio do número na API não
   oficial). A janela da função é de 18h30 (inclusive) a 21h00 (exclusive); fora dela ela não faz nada. O início é 30 minutos depois
   do progresso semanal (18h00) para as duas mensagens não saírem juntas pelo mesmo número.
3. Só recebem clientes **cadastrados e ativos**, com celular válido, que não pararam o lembrete, ainda não responderam a semana e
   **não excluíram a própria conta**. Telefone fixo (depois do DDD, 8 dígitos começando por 2 a 5) e celular de 9 dígitos que não
   começa com 9 não recebem.
4. **Conta excluída**: quando o cliente exclui a própria conta, a ficha continua ativa e com telefone, mas fica com
   `vinculo_encerrado_em` preenchido. Essas fichas nunca recebem o pedido.
5. **Telefone compartilhado** (mãe e filho, casal com o mesmo celular): o app olha as fichas ativas do profissional que têm
   telefone e agrupa pelos **últimos 10 dígitos**. Número que aparece em 2 ou mais fichas ativas (inclusive de conta excluída)
   **não recebe o pedido por WhatsApp**, porque a resposta seria gravada em uma ficha só. Esses clientes usam o portal. O retorno
   da função informa quantos foram pulados (`pulados_telefone_compartilhado`).
6. **Reserva antes do envio**: o app grava o pedido em `checkin_pedidos` (único por cliente e semana) e só então envia. Se a
   gravação conflitar, outra execução já reservou e o cliente é pulado (`ja_reservados`). Se o envio falhar, a reserva é removida
   (o cliente é tentado de novo na rodada seguinte, até 3 erros na semana) e o disparo fica como `erro`. Se o envio der certo, a
   reserva fica e o disparo é `enviado`. Assim uma queda no meio da rodada ou duas rodadas ao mesmo tempo não repetem a mensagem.
7. Cada envio fica registrado na conversa do Zap e em `agente_disparos`. As mensagens do check-in (pedido, confirmação, ajuda,
   PARAR e VOLTAR, falha de gravação) são gravadas com `metadata.bot = true`, para o bot de IA não ficar mudo por 30 minutos
   achando que um humano respondeu.
8. A resposta é lida no `whatsapp-webhook` **antes** do bot de IA: só números (e PARAR/VOLTAR) são tratados; conversa
   normal continua com o bot.

## Operação do envio semanal
- **Ordem de publicação**: publique as Edge Functions (`whatsapp-webhook` e `zap-checkin-semanal`) **ANTES** de ligar o
  gatilho Check-in semanal; confira com `supabase functions list` que as duas estão na versão nova. Com o webhook antigo a
  resposta do cliente (`4 3 5 4 4 2`) cairia no bot de IA; com o envio antigo valem as regras antigas (sem reserva, sem filtro de
  conta excluída nem de telefone compartilhado).
- **Teto por domingo**: 5 clientes por rodada × 15 rodadas (18h30, 18h40, 18h50 e depois a cada 10 minutos até 20h50) = cerca de
  **75 clientes por profissional por domingo**. A ordem da fila é fixa (por cadastro), então um profissional com mais de 75
  clientes elegíveis tem os últimos da fila sempre de fora; para esses casos, o caminho é o portal.
- **Agendamento**: a migração `20261102150100_cron_checkin_semanal.sql` cria dois jobs do pg_cron (um por expressão):
  `zap-checkin-semanal` (`30,40,50 21 * * 0`, em UTC) e `zap-checkin-semanal-noite` (`*/10 22-23 * * 0`, em UTC). A chamada usa
  `timeout_milliseconds := 120000`; o padrão do pg_net (5 s) estoura em rodadas com várias mensagens.
- **Retorno da função** (útil nos logs e no teste manual): `candidatos`, `elegiveis`, `enviados`, `falhas`, `adiados`, `pausados`,
  `com_erro_de_consulta`, `pulados_telefone_compartilhado`, `ja_reservados` e `erros_de_reserva`. Para testar fora do horário, chame
  a função com o corpo `{ "forcar": true }` usando a chave de serviço.
- **Telefone compartilhado e conta excluída**: não precisam de ação do profissional. Quem divide o número com outra ficha
  responde pelo portal; quem excluiu a conta não recebe mais nada e só volta a receber se o profissional convidar de novo.

## Objetos do banco
`checkins_semanais` (respostas), `checkin_pedidos` (pedidos do WhatsApp, só o servidor), `checkin_preferencias`
(lembrete ligado ou desligado). Escrita **somente por função**: `registrar_checkin_semanal` (portal),
`definir_checkin_whatsapp` e `checkin_gravar` (só service role). O profissional nunca vem do cliente: sai de `pacientes`.
Três políticas restritivas em `notas_prontuario` fecham a criação/edição das notas `checkin_%` e a leitura da nota de atenção pelo cliente.
Migrações: `20261102150000_checkin_semanal.sql` e `20261102150100_cron_checkin_semanal.sql`.

## Testes
`supabase/tests/database/07_checkin_semanal.test.sql` (privilégios, RLS, gravação, nota viva, alertas, dedupe),
`src/test/checkinSemanal.test.ts` (leitura das respostas, textos, comparação, alertas) e os testes de tela e de WhatsApp.

## Limitações conhecidas
- **Troca de profissional do cliente**: as notas do check-in já gravadas (nota viva e notas de atenção) ficam com o profissional que
  estava no momento; as próximas respostas geram notas para o novo profissional. As respostas em si (`checkins_semanais`) acompanham
  o cliente: o novo profissional vê o histórico no card.
- **Relógio do aparelho**: o portal decide "já respondeu esta semana" com a data do aparelho; um relógio errado pode mostrar o pedido na
  semana errada. O servidor sempre grava na semana certa (data do servidor, horário de Brasília).
- A nota viva sobe para o topo do prontuário a cada resposta (ela é o "último estado"); o dia em que foi escrita pela primeira vez fica
  no histórico da série, dentro da nota.
