# Justificativas dos pedidos de guia CASSI (códigos 301 e 131)

Na aba **Pedir guias** do Controle CASSI, cada cliente da lista tem o bloco **Justificativa (301 e 131)**. Ele gera, por IA, o texto
de justificativa clínica que a CASSI pede no portal (limite de **500 caracteres**), para o profissional conferir, editar e copiar.

## Como usar
1. Marque o **301** (agulhamento seco, 2.01.03.301) e/ou o **131** (EMG biofeedback, 2.01.03.131) nos códigos do cliente. Só os
   códigos marcados recebem justificativa.
2. Preencha o **diagnóstico** (o mesmo campo do pedido): **ele basta**. Os **músculos são opcionais**:
   - **Sem músculos**, a IA propõe de 3 a 5 músculos da região que o próprio diagnóstico nomeia, escreve o 301 citando todos eles e
     **preenche o campo "Músculos"** com a lista, que continua editável. A tela avisa "Músculos sugeridos pela IA a partir do
     diagnóstico: confira e ajuste" enquanto o campo for igual à sugestão. Se o diagnóstico for genérico demais para saber a região
     (por exemplo, "dor"), a IA não inventa músculo: o texto fala só da região e a tela pede para informar os músculos.
   - **Com músculos digitados**, a IA usa exatamente os seus, na sua ordem, e nunca sugere outros.
   - O app lembra quantos músculos foram citados, porque o 301 é cobrado por músculo: **a lista sugerida é uma sugestão de alvo do
     tratamento, não um achado do exame. Confira se bate com o que você realmente tratou** antes de copiar e de lançar a quantidade.
   - Se o texto do 301 deixar de citar algum músculo do campo (a IA abreviou, ou você editou o texto), o quadro mostra "O texto do 301
     não cita: …". É um aviso, não trava o Copiar: ajuste o texto ou a lista. Ao encurtar um texto acima de 500, a função não troca o
     texto por uma versão curta que perca músculos da lista se o corte do original os mantém.
   - O 131 só cita músculos que **você digitou**; os sugeridos pela IA valem apenas para o 301.
   - Se você editar a lista depois de gerar, os textos ficam "desatualizados" e o Copiar trava até gerar de novo, que passa a usar a
     sua lista.
3. Se quiser, preencha **Achados do exame**. Sem achados, o texto fala em **indicação e finalidade** ("indicado para...", "visa...") e não
   afirma que o cliente apresenta pontos-gatilho, hipertonia ou déficit. Com achados, afirma só o que está neles.
4. **Gerar justificativas.** Cada código vira um quadro editável com contador `n/500`. **Copiar** limpa o texto (sem caractere invisível)
   e recusa copiar acima de 500.
5. Se mudar diagnóstico, músculos ou achados depois de gerar, o texto fica marcado como **desatualizado** e o Copiar trava até gerar de
   novo (ou até o profissional editar o texto à mão, assumindo o conteúdo).

## A mensagem do pedido (Copiar e WhatsApp)
Depois de gerar, as justificativas **já vão na mensagem** do pedido, logo depois do diagnóstico de cada cliente, sem precisar copiar uma
por uma:

```
1. *Ana Souza*
Carteirinha: 111
Códigos: 012, 185, 301, 131
Diagnóstico: Dorsalgia
Justificativa 301 (Agulhamento seco): …
Justificativa 131 (EMG Biofeedback): …
```

- Entram só os códigos **301/131 que continuam marcados** e que têm texto gerado (ou escrito por você). Código marcado sem texto
  gerado fica como antes, sem aviso: você pode não querer justificar.
- O critério é o mesmo do botão Copiar de cada quadro: o texto precisa estar **em dia** (diagnóstico, músculos e achados iguais aos de
  quando foi gerado, a menos que você tenha editado o texto à mão) e ter **até 500 caracteres**. O que ficar de fora aparece abaixo
  dos botões: "Justificativa fora da mensagem: Ana Souza (301, desatualizada)". Gerar de novo ou ajustar o texto o traz de volta.
- A tela mostra "A mensagem leva N justificativa(s)" e o texto completo em "ver a mensagem que vai no WhatsApp".
- A mensagem passa a ter bem mais texto: com muitos clientes e dois códigos cada, o link do WhatsApp fica longo. Se o WhatsApp não abrir
  a mensagem inteira, use Copiar.

## O que é guardado
Ao gerar (e ao dar baixa), o app guarda no cadastro do cliente o diagnóstico, os **músculos** (`pacientes.cassi_musculos`, até 400
caracteres), os **achados** (`pacientes.cassi_achados`, até 600) e os códigos escolhidos, para reaproveitar no próximo pedido. Apagar o
campo na tela e dar baixa (ou gerar) limpa o valor no cadastro. O **texto gerado** não é guardado no banco: vive na página até recarregar.
Os **músculos sugeridos pela IA não vão para o cadastro enquanto o campo for igual à sugestão**: só depois que você edita a lista (ou
digita a sua) ela é gravada, para uma sugestão da IA não voltar no pedido seguinte como se fosse sua. Sem gravar, a IA sugere de novo
pelo diagnóstico.
O paciente **não consegue alterar** esses dois campos pelo portal (a trava dos campos internos os inclui); ele consegue *ler* o próprio
cadastro, como já acontece com o diagnóstico CASSI.

## IA e privacidade
A função `gerar-justificativa-cassi` recebe **só** diagnóstico, músculos (se houver), achados e os códigos. Devolve os textos e, quando
o 301 foi pedido sem músculos, a lista sugerida em `musculos_sugeridos`. Nome, CPF e carteirinha nunca saem do app.
Só chama quem tem perfil de profissional. Usa o mesmo provedor (Gemini) das outras funções e registra o custo em `ai_usage_log`.

## Garantia dos 500 caracteres
A IA recebe o alvo de 450. Se passar de 500, a função pede **uma** versão mais curta; se ainda passar, **corta na última frase inteira**
(sem pendurar em número decimal ou abreviação como "Dr."). A contagem é conservadora (emoji vale 2), então o texto cabe seja qual for o
critério da CASSI. A limpeza tira espaço de largura zero e outros caracteres invisíveis que a IA e a colagem costumam trazer.

## Decisões que ficam com o dono
- **Limite de uso por usuário.** Hoje nenhuma função de IA do sistema (esta incluída) limita quantas chamadas um profissional pode fazer
  por hora/dia, e qualquer pessoa que crie conta de profissional passa na checagem. O custo por chamada é baixo, mas não há teto.
  Recomendado: contador por usuário (ex.: 30/hora e 200/dia) nas funções de IA, com `user_id` no `ai_usage_log`.
- **Paciente lê músculos e achados** do próprio cadastro. É coerente com o direito de acesso, mas são rascunhos clínicos do profissional.
  Se preferir reservá-los, o caminho é uma tabela lateral só com acesso do profissional (revogar a coluna quebraria `select *`).
- **Prompt.** O texto das instruções está em `supabase/functions/_shared/cassi-justificativa.ts` e é coberto por testes de contrato: ajustes
  de redação clínica são feitos ali.

## Limite de códigos por pedido
O pedido aceita até **5 códigos por cliente** (`MAXIMO_CODIGOS_PEDIDO` em `src/lib/cassiPedidos.ts`; decisão do Rafael, antes era 3). Não
há trava no banco: `pacientes.codigos_cassi` é uma lista livre. Vale também para a mensagem de WhatsApp/copiar, que lista todos os
códigos escolhidos.

## Publicação
Em duas etapas, porque a tela passa a pedir colunas novas: 1) migração `20261103140000_cassi_justificativas_dados.sql` e a função
`gerar-justificativa-cassi`; 2) depois de conferir em produção, a tela.

A mudança dos 5 códigos e da sugestão de músculos não cria coluna nem migração: função e tela vão no mesmo push. Se a tela chegar antes
da função, a função antiga recusa o 301 sem músculos por alguns minutos; a tela mostra a mensagem que a função devolveu (a tela lê o
corpo do erro HTTP, não só a mensagem genérica do client). Se a função chegar antes da tela, a tela antiga continua exigindo músculos
para habilitar o botão, sem erro.
