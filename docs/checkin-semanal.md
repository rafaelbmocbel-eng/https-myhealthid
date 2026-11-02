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
  Aceita espaços, vírgulas, ponto e vírgula, traço, barra e "e" entre os números, ou os dígitos colados (`435442`).
  O app confirma o que entendeu e, se o cliente mandar os números de novo, **corrige** (vale a última resposta da semana).
  `PARAR` desliga o lembrete; `VOLTAR` religa.
- Uma resposta por **semana** (segunda a domingo, horário de Brasília). O pedido enviado no domingo à noite vale por 48 horas,
  então a resposta de segunda de manhã conta para a semana que acabou.

## Onde o profissional vê
- Perfil do cliente > aba **Avaliação**, logo abaixo do bloco do Resumo Clínico: valor atual, comparação com a semana
  anterior, média inicial do próprio cliente, gráfico e faixa de atenção.
- Perfil do cliente > aba **Evolução e Prontuários**: o mesmo card com o gráfico maior.
- **Prontuário**: nota viva "Check-in semanal (autorrelato do cliente)" (uma por cliente, atualizada a cada resposta) e nota
  "Atenção no check-in" quando há queda. As duas são registros automáticos e não podem ser editadas.
- Notificação no sino do profissional quando uma queda nova aparece.

## Regra do alerta de queda
O alerta compara as **duas últimas respostas (de semanas seguidas)** com a **média das 4 primeiras respostas do próprio
cliente**. Se as duas estão pelo menos 1 ponto abaixo, em algum dos 5 itens, há alerta naquele item. Exige 6 respostas no
total. Não é diagnóstico: é um convite para conversar com o cliente e rever o MyID. A mesma regra está no banco
(`checkin_alertas`) e no app (`calcularAlertas`), com os mesmos casos de teste.

## O que o check-in NÃO faz
- Não muda a nota oficial do MyID (só o reteste muda). Conversa com as dimensões **R** (regulação: sono, fadiga, estresse),
  **D** (dor) e **HID** (hidratação).
- Não é monitorado em tempo real: toda mensagem avisa que, em caso de urgência, o cliente deve procurar atendimento.
- Não envia nada sozinho se o profissional não ligar o gatilho.

## WhatsApp: como funciona o envio
1. O profissional liga **Check-in semanal** em WhatsApp > Automações (desligado por padrão).
2. Aos domingos, das 18h às 20h50 (Brasília), uma rotina roda a cada 10 minutos e envia para até **5 clientes por
   profissional por rodada**, com pausa entre os envios (proteção contra bloqueio do número na API não oficial).
3. Só recebem clientes **cadastrados e ativos**, com telefone, que não pararam o lembrete e ainda não responderam a semana.
4. Cada envio fica registrado na conversa do Zap e em `agente_disparos`; o pedido fica em `checkin_pedidos`.
5. A resposta é lida no `whatsapp-webhook` **antes** do bot de IA: só números (e PARAR/VOLTAR) são tratados; conversa
   normal continua com o bot.

## Objetos do banco
`checkins_semanais` (respostas), `checkin_pedidos` (pedidos do WhatsApp, só o servidor), `checkin_preferencias`
(lembrete ligado ou desligado). Escrita **somente por função**: `registrar_checkin_semanal` (portal),
`definir_checkin_whatsapp` e `checkin_gravar` (só service role). O profissional nunca vem do cliente: sai de `pacientes`.
Migrações: `20261102150000_checkin_semanal.sql` e `20261102150100_cron_checkin_semanal.sql`.

## Testes
`supabase/tests/database/07_checkin_semanal.test.sql` (privilégios, RLS, gravação, nota viva, alertas, dedupe),
`src/test/checkinSemanal.test.ts` (leitura das respostas, textos, comparação, alertas) e os testes de tela e de WhatsApp.
