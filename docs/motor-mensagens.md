# Motor de mensagens

Troca a IA por **textos prontos, com variáveis**, nas mensagens automáticas do `agente-proativo` (4 gatilhos) e nas
campanhas do `agente-broadcast`. Estas funções **mandam WhatsApp para clientes de verdade**, por cron e por clique: por isso o
`agente-proativo` nasce **desligado** (sem os segredos, a IA continua escrevendo como antes, com poucas exceções, listadas em
"Os três modos e os 2 segredos") e passa por uma **simulação** antes de valer. O `agente-broadcast` não usa segredo: o que sai
depende da marca que a campanha traz (ver "Campanhas (broadcast)").

Fonte única dos textos e das regras: `supabase/functions/_shared/mensagem-modelos.ts` (a tela usa a mesma função na prévia, via
`src/lib/mensagemModelos.ts`). Decisões do Rafael: `docs/fluxo-cliente-e-tiers.md` não muda com esta etapa.

## O que o motor faz e o que não faz

**Faz**
- Manda, nos 4 gatilhos, **no modo real**, um texto fixo escolhido pelo **tom de voz** da clínica (Amigável, Formal ou Objetivo),
  com `{nome}` e `{dias}` trocados. Sem IA, sem MyID, sem dado de saúde no texto. Em legado e simulação a IA ainda escreve (ver
  "Os três modos e os 2 segredos").
- Nas campanhas, manda o texto que o profissional escreveu, com `{nome}` trocado. A IA virou opção, **desligada por padrão**.
- Pula o profissional com as automações pausadas antes de qualquer consulta ou IA, **já no modo legado** (efeito ao voltar de
  uma pausa em "Os três modos e os 2 segredos").
- Deixa de fora quem excluiu a conta (`vinculo_encerrado_em` preenchido) em **todos** os gatilhos da faixa das 9h, **já no modo
  legado**, e nas campanhas. (`exercicio_pendente` e `pagamento_pendente` também passam por esse filtro, mas hoje nunca
  disparam: o contexto clínico fixa `exercicios_pendentes = 0` e `pagamento_pendente = null`, como já era antes do motor.)
- Mede o uso de IA (`logUsoIA`) no proativo, no broadcast com IA e no `whatsapp-bot-reply`.
- No **modo real** do proativo e **nas campanhas**, nunca manda texto vazio, com `{chave}` crua, com variável sem valor ou acima
  de 1000 caracteres, e nunca corta texto: se não cabe ou falta o nome, **não envia**. No legado e na simulação o texto da IA do
  proativo sai como sempre saiu (só o vazio é descartado), sem essa conferência.

**Não faz (continua igual)**
- Os gatilhos, as condições de cada um, as janelas de repetição e a trava `jaDisparado` são os mesmos (a exceção é quem excluiu
  a conta, acima). Confirmação 24 h, lembrete 2 h, pós-sessão, NPS, progresso e check-in não mudam.
- O bot do WhatsApp continua mudo por 30 min depois de qualquer mensagem automática, nas contas com "Pausar bot quando profissional já respondeu" ligado, que é o padrão (ver "Limites conhecidos").
- Não há edição dos textos pela tela, lista de campanhas, botão Cancelar nem "Enviar teste para mim".
- Não há migração: os textos moram só no código.

## Os 12 textos (4 gatilhos x 3 tons)

O tom vem de `whatsapp_automacoes.tom_voz`. O valor interno do tom Objetivo continua `tecnico` (só o rótulo da tela mudou).
Tom desconhecido ou vazio vira Amigável.

**Aniversário** (variável: `{nome}`)
- Amigável: Parabéns, {nome}! 🎉 Que o seu dia seja leve e cheio de alegria. Um abraço de toda a equipe! 💙
- Formal: Olá, {nome}. Em nome de toda a equipe, desejamos um feliz aniversário, com muita alegria e realizações.
- Objetivo: {nome}, feliz aniversário! Desejamos a você um ótimo dia e um excelente novo ano.

**Diário parado** (`{nome}`, `{dias}`; só dispara com 3 dias ou mais)
- Amigável: Oi {nome}! 💙 Faz {dias} dias que o seu diário no app está sem registro. Quando puder, dá uma passadinha por lá e conta como foi o seu dia.
- Formal: Olá, {nome}. O seu diário no aplicativo está sem registro há {dias} dias. Sempre que desejar, você pode fazer um novo registro.
- Objetivo: {nome}, o seu diário está sem registro há {dias} dias. Acesse o aplicativo para fazer um novo registro.

**MyID vencido** (`{nome}`, `{dias}`; só dispara com 30 dias ou mais)
- Amigável: Oi {nome}! 💙 Já faz {dias} dias desde o seu último MyID. Que tal abrir o app e atualizar quando puder?
- Formal: Olá, {nome}. Já se passaram {dias} dias desde o seu último MyID. Quando for conveniente, acesse o aplicativo para atualizá-lo.
- Objetivo: {nome}, faz {dias} dias desde o seu último MyID. Acesse o aplicativo para atualizá-lo.

**Reengajamento** (`{nome}`, `{dias}`; `{dias}` é sempre 14, 30 ou 60)
- Amigável: Oi {nome}! 💙 Faz {dias} dias que a gente não se vê por aqui e passamos para dar um oi. Se ainda não tiver um horário marcado, é só responder esta mensagem.
- Formal: Olá, {nome}. Já se passaram {dias} dias desde o seu último atendimento. Se ainda não houver um horário marcado, estamos à disposição para agendar.
- Objetivo: {nome}, faz {dias} dias desde o seu último atendimento. Para agendar um novo horário, responda esta mensagem.

## Variáveis

A lista é **fechada**. Qualquer outra chave (`{horario}`, `{data}`, `{dimensao}`...) é recusada.

| Onde | Variáveis |
|---|---|
| Aniversário | `{nome}` |
| Diário parado, MyID vencido, Reengajamento | `{nome}`, `{dias}` |
| Campanha (broadcast) | só `{nome}` |

- `{nome}` é o **primeiro nome** do cadastro, com inicial maiúscula por pedaço (`JOÃO PEDRO` vira `João`, `ana-clara` vira
  `Ana-Clara`). Se o cadastro não tiver algo que pareça nome (vazio, número, link), a mensagem **não sai** para essa pessoa.
- `{dias}` vem do cálculo do próprio gatilho e tem de ser um número inteiro de 1 a 3650.
- Vale `{ Nome }` e `{NOME}`: espaços, caixa e acento não importam. `{{nome}}` ou uma chave sem par é recusado.
- A tela de campanha avisa na hora e trava o botão de enviar se houver variável fora de `{nome}`, chave solta, texto acima de
  1000 caracteres ou texto que passaria de 1000 quando `{nome}` vira um primeiro nome de 30 letras (o maior que o motor aceita).

## Os três modos e os 2 segredos

Os segredos ficam no painel do Supabase: **Edge Functions > Secrets**. Eles **nascem ausentes**: publicar o código não liga o
motor no `agente-proativo`, que é o único que lê estes segredos. O `agente-broadcast` não lê segredo (ver "Campanhas
(broadcast)").

| Segredo | Valor | O que faz |
|---|---|---|
| `MOTOR_MODELOS_MODO` | ausente, vazio ou qualquer outro valor | **legado**: a IA escreve e envia, como sempre foi. O texto e a regra de quem recebe são os de antes, com as exceções da lista "O que muda mesmo com os segredos ausentes", logo abaixo. |
| | `simulacao` | Para **todos** os profissionais: a IA ainda envia (como no legado) e, além disso, grava em `agente_disparos` uma linha `simulado:<gatilho>` com status `simulado` e o texto pronto que o modo real mandaria. A linha simulada **não queima** a janela do envio real. |
| | `real` | Só vale para quem está em `MOTOR_MODELOS_TERAPEUTAS`: esses recebem **só o texto pronto**, sem IA. Os demais ficam em simulação. |
| `MOTOR_MODELOS_TERAPEUTAS` | ids separados por vírgula | Quem está na lista entra no modo real (quando o modo é `real`). |
| | `*` | Todos entram no modo real. |
| | ausente ou vazio | Ninguém entra no real: com `real` e lista vazia o resultado é simulação, **nunca real**. |

Cuidados com os valores:
- Só valem `simulacao` e `real` **exatamente assim, em minúsculas**. `REAL`, `Real` ou ` real` (com espaço ou quebra de linha
  sobrando, comum ao colar no painel) caem em **legado**, em silêncio. É seguro, mas confunde: depois de salvar, confira o log
  (próximo item).
- Os ids da lista são comparados exatamente (maiúsculas importam). Espaço em volta de cada id é aceito.
- Para conferir o que valeu: Supabase > Edge Functions > `agente-proativo` > Logs, linha `resumo da rodada`. O campo
  `terapeutas_por_modo` mostra quantos profissionais ficaram em `legado`, `simulacao` e `real`.

No modo real, a linha de `agente_disparos` é gravada **antes** do envio com status `enviando` e depois vira `enviado` ou
`erro`. Se a função cair no meio, a mensagem se perde, mas não é repetida (como achar linhas `enviando` paradas: "Limites
conhecidos"). Há uma pausa de 2 s depois de cada envio real aceito. O orçamento de 140 s por rodada vale em **todos** os modos,
inclusive o legado (os dois valores foram escolhidos, **não medidos**); o que sobrar aparece em `terapeutas_restantes` no log,
e o que isso significa está na lista a seguir.

**O que muda mesmo com os segredos ausentes (legado)**

"Legado" quer dizer que a IA escreve e envia como antes. Mas o push das funções já traz estas mudanças, em **todos** os modos,
todas intencionais:
- **Profissional com as automações pausadas é pulado** antes de qualquer consulta ou IA. Antes, o proativo gerava a mensagem
  pela IA, o envio era barrado dentro de `enviarWhatsapp` (que confere a pausa) e o código gravava uma linha `erro`, que
  **queimava as janelas de repetição** (MyID vencido 30 dias, reengajamento 60, diário 72 h, aniversário 300). Agora o pausado
  não gera IA nem linha `erro`, então nenhuma janela queima. **Efeito ao voltar de uma pausa:** todos os clientes com MyID
  vencido ou diário parado podem receber a mensagem **de uma vez**, na primeira manhã (faixa das 9h) depois da volta, porque as
  janelas não foram usadas. Numa base grande, combine com o profissional antes de reativar.
- **Teto de 140 s por rodada.** O código antigo não tinha teto próprio (valia só o limite de tempo da plataforma, que também
  **não foi medido**). Numa base grande a rodada pode parar em 140 s.
  - Os profissionais que ficaram para trás aparecem em `terapeutas_restantes` no log `resumo da rodada` (a lista começa no
    profissional em que a rodada parou).
  - O tick seguinte, 30 min depois, **não lembra onde ela parou**: lê a lista de profissionais de novo e recomeça do mesmo
    ponto de partida (a consulta das automações não tem `ORDER BY`, então a ordem costuma se repetir, mas não é garantida).
    Como a trava `jaDisparado` só é conferida depois de ler o contexto clínico de cada cliente, a nova rodada gasta parte do
    orçamento relendo quem já foi atendido, e quem está no fim da lista pode ficar sem mensagem naquele dia.
  - Só há dois ticks na faixa das 9h (09:00 e 09:30 BRT): o que não saiu nos dois só tem nova chance no dia seguinte, e
    aniversário e reengajamento, que dependem do dia exato, não se recuperam.
  - **HIPÓTESE, não medida:** isso só acontece se a base for grande o bastante para estourar 140 s. **Antes de concluir que há
    problema, meça `terapeutas_restantes` no log**: vazio quer dizer que o teto nunca foi atingido.
  - No modo real, a pausa de 2 s sozinha já limita a rodada a cerca de 70 envios (140 s divididos por 2 s), antes de contar o
    tempo das consultas.
- **Quem excluiu a conta não recebe nenhum gatilho da faixa das 9h.** Antes recebia. (Exercício pendente e pagamento pendente
  também passam pelo filtro, mas esses dois gatilhos não disparam hoje: o contexto clínico não tem fonte para eles.)
- **Uma falha não derruba a rodada.** Falha de IA, de banco ou de envio em um gatilho ou em um cliente é contada
  (`erros_gatilho`) e a rodada segue; antes um erro lançado derrubava a execução e os clientes seguintes ficavam sem mensagem
  naquele tick. **Efeito:** a função agora responde 200 mesmo quando a IA ou o envio falham (antes respondia 500 e parava);
  qualquer alerta que olhe só o código HTTP 500 deixa de disparar, e a falha só aparece no log `resumo da rodada`, em
  `erros_gatilho`. Exemplo medido num teste: sem `GEMINI_API_KEY` ninguém recebe e `erros_gatilho` conta 4 por cliente. O erro do `insert` em `agente_disparos` também passa a ser conferido (`erros_gravacao`).
- **Nome no modelo aprovado da Meta (aniversário, fora das 24 h).** Antes ia a primeira palavra do cadastro como estava
  gravada (o cadastro costuma ter o nome em maiúsculas, como `MARINA`); agora vai com inicial maiúscula (`Marina`), e `você`
  quando o cadastro não tem nada que pareça nome (link, número).

## Campanhas (broadcast): a marca `filtro.personalizar_ia`

A tela nova grava a marca em **toda campanha nova** (desligado por padrão). A função lê a marca de cada campanha, sem segredo, e
vale já no push das funções:

| Marca | O que sai |
|---|---|
| `false` | O texto do profissional, com o primeiro nome. Sem IA, sem contexto clínico. |
| `true` | A IA reescreve vendo só o **tom da clínica e o primeiro nome** (sem MyID, red flag, telefone nem sobrenome). Se a IA falhar ou a saída for reprovada, vai o texto fixo. |
| **ausente** (campanha antiga, criada pela tela antiga ou por aba velha) | O texto é tratado como **briefing**, não como mensagem final. Passa pela mesma IA enxuta e, se ela falhar, **não envia**: a linha em `agente_disparos` fica com erro `ia_indisponivel`. |

Outras regras: variante inválida (só com `false`) recusa a campanha inteira antes de enviar (`status = recusado`, resposta
HTTP 422); só recebe cliente **do próprio profissional**, ativo, com telefone e vínculo vivo; ids repetidos recebem uma vez;
campanhas em `executando`, `concluido`, `interrompido`, `cancelado` ou `recusado` nunca recomeçam; 1 envio a cada 5 s.

A saída da IA é conferida (`validarSaidaIA`): sem `{ } [ ]`, até 1000 caracteres, **mantendo todos os números e links** do texto
original, sem link novo e sem termo clínico novo. Reescrita que troca `10/12` por `10 de dezembro` é reprovada de propósito.
O que ela **não** confere (número, horário, preço ou telefone **inventado**) está em "Limites conhecidos".

## Medição de uso de IA

`logUsoIA` grava uma linha por chamada de IA, com o nome da pasta da função: `agente-proativo` (legado e simulação),
`agente-broadcast` (só com IA: marca `true` ou campanha antiga) e `whatsapp-bot-reply` (sem esperar no caminho da resposta, via
`EdgeRuntime.waitUntil`). Nenhuma das três gravava antes. Depois que cada uma rodar, confira se ela aparece nesta consulta (só
agregado, sem dado de cliente; o ranking do Guardião só chega no e-mail de alerta). A primeira semana de dados é a medida: não
há estimativa de custo.

```sql
-- Chamadas e gasto estimado das últimas 24 h, por função (a mesma soma que o Guardião faz)
select function_name, count(*) as chamadas, round(sum(est_cost_usd), 4) as usd_estimado
from ai_usage_log
where created_at > now() - interval '24 hours'
group by 1
order by 3 desc;
```

**Cuidado com o alerta do Guardião (`monitor-ia-uso`).** Ele roda uma vez por dia (10:00 UTC, cerca de 07:00 BRT), soma o
`est_cost_usd` de **todas** as linhas de `ai_usage_log` das últimas 24 h, agrupando por `function_name` sem lista fixa, e manda
e-mail de alerta (se a chave de e-mail estiver configurada) quando a soma passa de `AI_COST_ALERT_USD` (padrão 2 USD) ou quando
o teste de créditos do Gemini não responde "ativo" (esgotado, limitado, chave inválida). O e-mail sai só na transição para o
alerta, uma vez por incidente. Como `agente-proativo`, `agente-broadcast` (com IA) e `whatsapp-bot-reply` passam a gravar em
`ai_usage_log`, **o primeiro alerta pode vir só porque o gasto passou a ser MEDIDO, e não porque aumentou**. **HIPÓTESE, não
medida:** não se sabe o volume nem o custo de nenhuma das três. Antes de reagir ao e-mail, veja a tabela de funções dentro dele.

## Ordem de publicação

O workflow **Deploy Supabase** (`.github/workflows/supabase-deploy.yml`) dispara em push na `main` que mexa em
`supabase/migrations/**`, `supabase/functions/**` ou `supabase/data/**` (e na mão, pelo botão "Run workflow"). Ele publica
**todas** as funções, sem teste no meio. Push que só mexe em `src/`, `docs/` e afins **não dispara** o workflow: só o site
publica. O workflow não tem `concurrency` (ver `docs/ci-ajustes-deploy-supabase.md`): **espere cada execução terminar** (GitHub >
Actions > Deploy Supabase, tudo verde) antes do próximo push, e **não deixe mais ninguém empurrar nada em paralelo**. **Não
dispare campanha entre um push e outro** (nem "Disparar agora"): avise quem usa a aba Broadcast.

**Antes de qualquer push**
1. GitHub > Actions > **Deploy Supabase**: o último run na `main` tem de estar **verde**, inclusive "Deploy edge functions" (já houve
   falha por token vencido: `docs/ci-ajustes-deploy-supabase.md`). Se estiver vermelho, renove o `SUPABASE_ACCESS_TOKEN` antes.
2. **Liste as campanhas agendadas**: Supabase > Table Editor > `agente_broadcasts`, filtro `status = agendado`. Ou, no SQL Editor:
   `select id, titulo, agendado_para, total, filtro, intencao, ab_variantes from agente_broadcasts where status = 'agendado' order by agendado_para;`
   (isso mostra textos de campanha, não clientes). O cron `broadcast-scheduler` roda **de hora em hora** (minuto 0) e dispara as
   agendadas que venceram, mas **no máximo 20 por vez e sem ordem definida** (`limit(20)` sem `order`): se houver mais de 20
   vencidas, as outras continuam `agendado` e saem nas horas seguintes, em ordem imprevisível. Depois do push 1 (funções), uma
   campanha antiga sai pelo código novo.
   - Campanha **sem** `personalizar_ia` é briefing: com a função nova ela vai pela IA enxuta e não sai se a IA falhar ou reprovar.
     Isso vale também para toda campanha criada pela tela antiga, até o push da tela.
   - Campanha com **número, data, horário, preço ou link** tende a ser reprovada pela conferência da saída e não sair. Decida uma
     a uma: deixar, **cancelar** (trocar o `status` para `cancelado`) ou reescrever e criar de novo pela tela.
3. Rode no repositório `npm run test`, `npm run typecheck` e `npm run lint`. Nada disso roda no CI, e **não há Deno aqui**: o
   código de `supabase/functions` não é checado por tipo antes de ir ao ar, só pelos testes que carregam o `index.ts` de verdade.
   **A base já tem vermelho antigo, que ninguém deve tomar por regressão do motor:** `npm run typecheck` termina com **71 erros**
   de tipo (nenhum nos arquivos do motor); `npm run test` tem **2 falhas** em `src/test/serene-spacing.test.tsx` (o teste do `Card`
   raiz com `rounded-xl` e o do título de `Configuracoes.tsx`); `npm run lint` mostra mais de 2 mil erros antigos em mais de 300
   arquivos, quase todos fora do motor (só `agente-proativo/index.ts`, `WhatsappAutomacoes.tsx` e `ExportarDados.tsx`, que o motor
   alterou, já tinham erro antes, e nenhum aumentou). Confira que esses números **não aumentaram** e que os arquivos novos do
   motor continuam sem erro nem aviso de lint.

**A ordem, passo a passo** (os pushes que mexem em funções, o 1 e o 4, em horário **fora da faixa 09:00 a 09:59 BRT**, a única em
que o proativo age, e **longe de xx:00 a xx:10**, quando o cron de campanhas roda):

1. **Funções primeiro, com os segredos ausentes (= legado).** `supabase/functions/_shared/mensagem-modelos.ts`,
   `agente-proativo/index.ts` e `agente-broadcast/index.ts`. Este push dispara o Deploy Supabase: espere terminar e confira no
   painel (Edge Functions) a data de atualização das duas funções e, no log do proativo (próximo tick, até 30 min), que
   `terapeutas_por_modo` mostra `simulacao` e `real` zerados. Efeitos que já valem aqui, todos intencionais: o proativo age como o legado,
   com as exceções de "O que muda mesmo com os segredos ausentes" (pausado pulado, teto de 140 s, vínculo encerrado, falha de um
   cliente não derruba a rodada); o broadcast, que não usa segredo, **trata toda campanha sem a marca `personalizar_ia` como
   antiga**: IA enxuta, sem dado clínico, e se a IA falhar **nada é enviado**. Como a tela ainda é a antiga (não grava a marca),
   isso vale para **toda** campanha criada agora e para as agendadas que já existem.
2. **Tela, logo depois.** `WhatsappAutomacoes.tsx`, `ExportarDados.tsx`, `BroadcastMensagemCampos.tsx` e os `src/lib/*` novos. É só
   frontend: **não dispara** o Deploy Supabase (o site publica pelo deploy automático da `main`). Os testes e este documento
   podem ir neste push ou no 1 (`src/test` e `docs` não disparam o workflow); mantenha cada teste no mesmo push do código que ele
   carrega. Efeito para o profissional: campanhas novas passam a gravar a marca `personalizar_ia: false`; o "gatilho mais usado"
   e o backup ignoram linhas simuladas; o rótulo do tom vira "Objetivo"; a legenda da aba Gatilhos diz que os textos prontos só
   valem quando a equipe ligar o recurso (até lá o aplicativo ainda escreve com IA); a aba Broadcast trava o botão enquanto
   confere a lista de clientes. Espere o site publicar e abra a tela para conferir.
3. **Só depois, o segredo `MOTOR_MODELOS_MODO = simulacao`** (a partir daí valem a simulação e o critério abaixo). Confira antes
   que a tela nova já está no ar.
4. **`whatsapp-bot-reply/index.ts`, em push próprio.** Só acrescenta a medição, mas o bot atende todas as clínicas em tempo real:
   publique sozinho e confira no dia seguinte se a latência das respostas continua a mesma. Ele não depende de segredo nem da
   tela. Este push também dispara o Deploy Supabase: valem as mesmas regras de esperar o run e de não disparar campanha.

**Por que as funções antes da tela.** A tela nova grava `personalizar_ia: false` e promete, na confirmação da campanha, "Sem IA:
cada cliente recebe exatamente este texto" (o interruptor "Personalizar com IA" diz o mesmo). Com a tela **antes** das funções, a
função antiga ainda ignora a marca e reescreve cada mensagem com IA e com dado clínico do cliente (como MyID e red flag): o
cliente receberia um texto diferente do que a tela prometeu. Com as funções **antes**, o pior caso é a tela **antiga** mandar uma
campanha para a função **nova**, que é mais restrita: sem a marca, a campanha vira briefing, passa pela IA enxuta (sem dado
clínico) e, se a IA falhar, não sai.

**Por que o segredo só depois da tela.** A tela antiga conta **todas** as linhas de `agente_disparos` dos últimos 7 dias no
"Gatilho mais usado", e o backup antigo exporta a tabela inteira. Com a simulação ligada, as linhas `simulado:<gatilho>` entrariam
nessas contas; a tela nova e o backup novo as ignoram.

## Simulação e critério de saída

Com `simulacao`, no dia seguinte, depois das 09:30 BRT, leia **só agregados** (nenhum nome nem texto de cliente de outras contas).
No SQL Editor do Supabase:

```sql
-- Quantas mensagens cada gatilho teria mandado por dia, e para quantos profissionais
select (created_at at time zone 'America/Sao_Paulo')::date as dia,
       regexp_replace(gatilho, '^simulado:', '') as gatilho,
       count(*) as linhas,
       count(distinct terapeuta_id) as profissionais
from agente_disparos
where status = 'simulado'
group by 1, 2
order by 1 desc, 2;

-- Quantos clientes receberiam 2 ou mais mensagens na mesma manhã (só a contagem, sem ids)
select dia, count(*) as clientes_com_2_ou_mais
from (
  select (created_at at time zone 'America/Sao_Paulo')::date as dia, paciente_id, count(*) as n
  from agente_disparos
  where status = 'simulado'
  group by 1, 2
) por_cliente
where n >= 2
group by dia
order by dia desc;

-- Cada gatilho tem pelo menos uma linha na conta que vai virar real? (troque pelo id da conta)
select regexp_replace(gatilho, '^simulado:', '') as gatilho, count(*) as linhas
from agente_disparos
where status = 'simulado' and terapeuta_id = '<id da conta que vai virar real>'
group by 1
order by 1;
```

No log `resumo da rodada` do `agente-proativo` (Edge Functions > Logs) veja também `recusariam_na_simulacao` (quantas mensagens o
modo real não mandaria, por motivo, como `sem_nome`, que também pega quem tem o primeiro nome com apóstrofo tipográfico ou acento
decomposto: ver "Limites conhecidos"), `erros_gravacao` e `terapeutas_restantes`; os dois últimos devem ficar em zero e vazio.
A contagem de 2 ou mais mensagens na mesma manhã só enxerga os 4 gatilhos do motor. `exercicio_pendente` e `pagamento_pendente`
continuam com IA e fora da simulação, mas hoje não disparam (o contexto clínico fixa `exercicios_pendentes = 0` e
`pagamento_pendente = null`), então não somam mensagens na manhã.

**Critério de saída (só então o Rafael liga o real)**
1. **Cada um dos 4 gatilhos** tem pelo menos uma linha simulada na conta que vai virar real. Gatilho sem linha (aniversário e
   reengajamento são raros) **não vira real** até aparecer uma: a decisão pode ser por gatilho, não só por profissional.
2. O Rafael recebeu os **12 textos no próprio WhatsApp**, enviados **à mão** pela caixa do Zap dele (sem código), para ver emoji e
   quebra de linha.
3. A contagem de clientes com 2 ou mais mensagens na mesma manhã e a de recusas (`recusariam_na_simulacao`, com `sem_nome`)
   foram vistas e aceitas.
4. Decididas as questões do reengajamento: o bot mudo e o texto Objetivo, que não fala em horário já marcado (ver "Limites
   conhecidos").

Então: `MOTOR_MODELOS_MODO = real` e `MOTOR_MODELOS_TERAPEUTAS = <id da conta do Rafael>`. Na manhã seguinte confira as linhas
`enviado` com o texto novo, a mensagem na conversa do Zap e a consulta de linhas `enviando` paradas ("Limites conhecidos"). Os
outros profissionais ficam em simulação (a IA ainda envia por eles). Depois de uma semana estável:
`MOTOR_MODELOS_TERAPEUTAS = *`, ou clínica a clínica. Antes de usar `*`, lembre que a pausa de 2 s limita cada rodada a cerca de
70 envios reais (conta de 140 s por 2 s, **não medida**; são duas rodadas na faixa das 9h) e olhe `terapeutas_restantes` no log.

## Como desligar

- **Segredo (o caminho normal):** apague `MOTOR_MODELOS_MODO` (ou troque para `legado`). Na execução seguinte do cron (até 30
  min) a IA volta a escrever e enviar. HIPÓTESE: o Supabase aplica o segredo na invocação seguinte; se não aplicar, é preciso
  republicar a função, o que vira outro push.
- **Só um profissional:** tire o id dele de `MOTOR_MODELOS_TERAPEUTAS` (ele volta à simulação, e a IA envia) ou pause as
  automações dele na tela ("Mensagens automáticas ativas"), que vale já no tick seguinte e para **todas** as mensagens
  automáticas.
- **Campanha:** não há botão Cancelar. Troque o `status` da campanha para `cancelado` na tabela antes de ela rodar.
- **Última opção:** reverter o commit, que é mais lento e está sujeito à corrida do workflow sem `concurrency`. Reverta na
  ordem **inversa** da publicação (a tela primeiro, depois as funções, em pushes separados e sem disparar campanha entre eles):
  reverter só as funções deixa a tela nova prometendo "Sem IA" sobre a função antiga, que reescreve com IA e dado clínico.

## Limites conhecidos

- **Reengajamento convida a responder** ("é só responder esta mensagem") e o bot fica **mudo por 30 min** depois de qualquer saída
  gravada sem `bot: true`, **desde que a conta tenha ligado "Pausar bot quando profissional já respondeu"** (ligado por padrão;
  `cfg.pausar_bot_apos_humano !== false`). Numa conta que desligou esse interruptor o bot atende a resposta mesmo dentro dos 30
  min. Com o interruptor ligado, a resposta nem chega à checagem de urgência nesse intervalo. **Decida antes de ligar o real desse
  gatilho**: ou o bot passa a atender (gravar a saída com `bot: true`, mudança de um parâmetro, etapa seguinte) ou o texto do convite muda.
- **O texto Objetivo do reengajamento é o único dos 12 sem o "se ainda não tiver horário marcado"** ("{nome}, faz {dias} dias
  desde o seu último atendimento. Para agendar um novo horário, responda esta mensagem."). O gatilho continua disparando para
  quem já tem horário futuro (condição igual à de antes), então, numa clínica no tom Objetivo, essa pessoa recebe o convite para
  "agendar um novo horário". Decida antes de ligar o real desse gatilho: manter ou trocar o texto (os 12 textos seguem como
  aprovados).
- **Condições dos gatilhos iguais às de antes**: o reengajamento sai para quem já tem horário marcado; o MyID vencido olha a
  última avaliação de qualquer status (inclusive não concluída); o diário parado não tem teto de dias; um cliente pode receber
  até 4 mensagens do motor seguidas na mesma manhã (`exercicio_pendente` e `pagamento_pendente` continuam com IA, mas hoje
  não disparam); esses gatilhos não têm "PARAR" (só o check-in tem). O texto é neutro por isso.
- **Falha de envio queima a janela**: a linha `erro` conta na trava, então o aniversário daquele ano se perde (janela de 300
  dias) e o MyID vencido (30 dias), o diário (72 h) e o reengajamento (60 dias) ficam de fora até a janela passar.
- **Linha `enviando` órfã trava a janela do cliente.** No modo real a linha `enviando` dura só o tempo do envio. Se ela ficar
  para trás (a função foi cortada no meio, ou o envio travou: o `fetch` ao Z-API em `enviar-whatsapp.ts` não tem timeout, hipótese
  não medida), a trava `jaDisparado` a conta como disparo feito e **a janela inteira daquele gatilho fica fechada para aquele
  cliente** (aniversário 300 dias, MyID vencido 30 dias, diário 72 h, reengajamento 60 dias). O cliente pode ou não ter recebido
  a mensagem, ninguém é avisado e a tela não a conta em "Mensagens enviadas" (que só soma `enviado`). É o comportamento
  decidido: **perde, não repete**. Para achar essas linhas, rode no SQL Editor (só leitura; sem texto nem nome de cliente):

  ```sql
  select id, terapeuta_id, paciente_id, gatilho, created_at
  from agente_disparos
  where status = 'enviando'
    and created_at < now() - interval '1 hour'
  order by created_at;
  ```

  Linha `enviando` com mais de 1 hora é órfã (a hora de folga é escolha, e quanto um envio normal demora não foi medido). O guia
  não traz comando para destravar de propósito: apagar a linha faz o próximo tick **mandar de novo**, e o cliente pode já ter
  recebido. A decisão é do Rafael, caso a caso.
- **Aniversário de profissional pausado se perde**: quem está pausado é pulado antes de tudo e o dia não é recuperado ao reativar
  (o reengajamento, que só dispara no dia exato de 14, 30 ou 60 dias, também não). O MyID vencido e o diário parado fazem o
  contrário: como a pausa não queima mais as janelas, **todos** os que estavam vencidos podem receber a mensagem de uma vez na
  primeira manhã depois da volta (ver "O que muda mesmo com os segredos ausentes").
- **Rodada que para em 140 s** (base grande): quem está no fim da lista pode ficar sem mensagem no dia, e o aniversário e o
  reengajamento de quem ficou para trás se perdem. **Hipótese, não medida:** meça `terapeutas_restantes` no log antes de
  concluir que há problema (ver "O que muda mesmo com os segredos ausentes").
- **Provedor Meta fora das 24 h**: o cliente **não** recebe o texto do motor. O aniversário sai pelo modelo aprovado da automação
  (só `{{1}}` = nome); os outros gatilhos e as campanhas só saem se existir o modelo genérico `contato_generico`, e então o texto
  fica na fila até o cliente responder. Z-API e Evolution não são afetados. Confira o provedor de cada clínica antes do real.
- **Sem nome aproveitável, não envia** (nas campanhas, só quando o texto usa `{nome}`, e então a campanha grava linha `erro`).
  O limite de 1000 caracteres vale **depois** de trocar o nome (até 30 letras): o contador da tela conta o texto antes da troca,
  mas o aviso e o botão já consideram um nome de 30 letras.
- **`primeiroNome` recusa apóstrofo tipográfico e acento decomposto.** O primeiro nome só passa se tiver letras, apóstrofo comum
  (`'`) e hífen. Quem tem o primeiro nome com apóstrofo tipográfico (`’`, U+2019), como `D’Ávila` digitado ou colado desse jeito,
  ou com a letra e o acento gravados separados (acento decomposto), cai em `sem_nome` e **não recebe nada no modo real** (no
  legado a IA cumprimentava). Nas campanhas vale o mesmo quando o texto usa `{nome}`. Aparece em `recusariam_na_simulacao`
  (`sem_nome`) no log da simulação, então dá para medir antes de ligar o real. Quantos cadastros são assim: não medido.
- **`validarSaidaIA` não barra número, horário, preço ou telefone inventado pela IA.** Ela só exige que os números e links do
  texto original **apareçam** na saída e barra link novo e termo clínico novo. Se a IA acrescentar "às 15h", "R$ 50" ou um
  telefone que ninguém escreveu, a saída passa. Vale para a campanha com "Personalizar com IA" ligado e para a campanha antiga
  (briefing). O pedido à IA proíbe inventar, mas nada confere. **Também não confere o nome:** se a IA cumprimentar "Carla" uma
  cliente chamada Marina, a saída passa (medido rodando o módulo). Só a campanha com IA ligada (ou antiga) corre esse risco.
- **Campanha agendada recusada** (variante inválida) não avisa ninguém: o status vira `recusado`, o detalhe só aparece no log.
- **Linhas de campanha em `agente_disparos`**: antes o `insert` podia estar falhando em silêncio; agora cada envio de campanha é
  gravado e entra na contagem da tela, então o "gatilho mais usado" pode passar a mostrar `broadcast`.
- **A legenda da aba Gatilhos** diz que os textos prontos só passam a valer quando a equipe do My Health ID ligar o recurso para
  a conta e que, até lá, o aplicativo ainda escreve com IA (modos legado e simulação). Ela não promete "sem IA" antes do real.
- **A tela de campanha ficou mais travada de propósito.** (a) Ao clicar em "Disparar agora" (ou "Agendar campanha"), o botão, o
  Segmento, o interruptor "Agendar envio" e a data ficam desabilitados enquanto a lista de clientes é conferida; o segmento
  fica guardado junto com a lista dentro da confirmação, e é esse que vai gravado em `filtro.segmento`. (b) Se a mensagem passa
  de 1000 caracteres quando `{nome}` vira um nome de 30 letras, aparece um aviso e o botão trava. (c) "Agendar envio" ligado
  sem data mostra "Escolha a data e a hora do agendamento" e não abre a confirmação nem grava (antes virava envio imediato).
  (d) "Mensagens enviadas" e "Gatilho mais usado" leem os últimos 7 dias de `agente_disparos` em páginas de 1000 linhas, com teto
  de segurança de 6000 linhas (`src/lib/supabasePaginado.ts`): acima disso o número ainda subconta, sem aviso.
- **Valores não medidos**: orçamento de 140 s, pausa de 2 s, timeout de 20 s da IA na campanha, e o limite real de tempo da função.
  Uma campanha grande com IA lenta pode ser cortada no meio e ficar em `executando`; a trava impede reiniciar.
- A trava `jaDisparado` ignora erro de leitura (igual a antes): se a consulta falhar, o código conclui "não disparou".
- Telefone só com espaços passa pelo filtro, mas o envio devolve falha: conta erro e espera 5 s, como antes.
- O segmento "MyID vencido" da campanha agora usa a **última** avaliação de cada cliente (antes incluía quem já tinha refeito) e só
  traz clientes ativos com telefone; quem nunca fez o MyID fica fora, como no gatilho automático.

## O que fica para as próximas etapas

- **Edição dos textos pela tela**: exige migração aditiva com 4 colunas de texto aceitando nulo em `whatsapp_automacoes`
  (`mensagem_aniversario`, `mensagem_diario_parado`, `mensagem_myid_vencido`, `mensagem_reengajamento`, sem DEFAULT; nulo = padrão
  do tom), `types.ts` e 4 editores com contador, prévia pela função pura e "Restaurar padrão" que gravam só os próprios campos
  (o `salvar()` atual regrava a configuração inteira, inclusive a pausa).
- **Filtros de elegibilidade** (PARAR, telefone repetido entre fichas, teto de 1 mensagem por cliente por manhã, pular quem já
  tem sessão marcada, MyID só concluído).
- **Lista de campanhas** com Cancelar, prazo de validade das agendadas e "Enviar teste para mim".
- **`bot: true`** nas mensagens automáticas, para o bot atender a resposta do cliente.
- Limpeza do caminho legado e das linhas `simulado:` (apagar com `delete from agente_disparos where status = 'simulado'`), em push
  próprio, depois de uma semana estável no real.

## Arquivos e testes

| Arquivo | Papel |
|---|---|
| `supabase/functions/_shared/mensagem-modelos.ts` | Textos, variáveis, troca, modo, conferência da saída da IA. Puro, sem rede. |
| `src/lib/mensagemModelos.ts` | Reexporta o de cima para a tela. |
| `supabase/functions/agente-proativo/index.ts`, `agente-broadcast/index.ts`, `whatsapp-bot-reply/index.ts` | Os três pontos de envio. |
| `src/pages/WhatsappAutomacoes.tsx`, `src/components/whatsapp/BroadcastMensagemCampos.tsx` | Tela: interruptor de IA, prévia, avisos, confirmação (com foco e anúncio para leitor de tela), bloqueio enquanto confere a lista. |
| `src/lib/broadcastMensagem.ts`, `broadcastSegmentos.ts`, `disparosResumo.ts`, `exportarLinhas.ts` | Regras puras da tela e do backup. |
| `src/pages/ExportarDados.tsx` | O backup ignora linhas `simulado` de `agente_disparos`. |
| `src/test/mensagemModelos.test.ts`, `agenteProativoMotor.test.ts`, `agenteProativoPessoaCerta.test.ts`, `agenteBroadcastMotor.test.ts`, `whatsappBotReplyMedicao.test.ts`, `whatsappAutomacoesTela.test.tsx`, `whatsappAutomacoesConferencia.test.tsx`, `whatsappAutomacoesLib.test.ts`, `exportarDadosSimulado.test.tsx` | Testes. Nenhum chama provedor real: nos testes das funções o `fetch` falso **lança** para `z-api.io`, `graph.facebook.com` e `generativelanguage.googleapis.com`, e um teste canário prova que isso dispara; nos da tela o `fetch` é bloqueado e o teste confere que ninguém o chamou. `agenteProativoPessoaCerta` prova que cada cliente e cada profissional recebem o tom, o nome, o telefone e os gatilhos **deles**. |
| `src/test/helpers/bancoProativoFalso.ts` | Banco falso em memória do teste do handler do `agente-proativo` (contagem sem linhas, id da linha inserida, falha sob demanda). |
