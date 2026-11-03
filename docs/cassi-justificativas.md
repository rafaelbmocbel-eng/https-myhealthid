# Justificativas dos pedidos de guia CASSI (códigos 301 e 131)

Na aba **Pedir guias** do Controle CASSI, cada cliente da lista tem o bloco **Justificativa (301 e 131)**. Ele gera, por IA, o texto
de justificativa clínica que a CASSI pede no portal (limite de **500 caracteres**), para o profissional conferir, editar e copiar.

## Como usar
1. Marque o **301** (agulhamento seco, 2.01.03.301) e/ou o **131** (EMG biofeedback, 2.01.03.131) nos códigos do cliente. Só os
   códigos marcados recebem justificativa.
2. Preencha o **diagnóstico** (o mesmo campo do pedido) e os **músculos tratados**. Os músculos são obrigatórios para o 301; o 131 pode
   sair sem eles. O app lembra quantos músculos foram citados, porque o 301 é cobrado por músculo.
3. Se quiser, preencha **Achados do exame**. Sem achados, o texto fala em **indicação e finalidade** ("indicado para...", "visa...") e não
   afirma que o cliente apresenta pontos-gatilho, hipertonia ou déficit. Com achados, afirma só o que está neles.
4. **Gerar justificativas.** Cada código vira um quadro editável com contador `n/500`. **Copiar** limpa o texto (sem caractere invisível)
   e recusa copiar acima de 500.
5. Se mudar diagnóstico, músculos ou achados depois de gerar, o texto fica marcado como **desatualizado** e o Copiar trava até gerar de
   novo (ou até o profissional editar o texto à mão, assumindo o conteúdo).

A justificativa **não entra** na mensagem de WhatsApp/copiar do pedido: fica só para colar no portal da CASSI.

## O que é guardado
Ao gerar (e ao dar baixa), o app guarda no cadastro do cliente o diagnóstico, os **músculos** (`pacientes.cassi_musculos`, até 400
caracteres), os **achados** (`pacientes.cassi_achados`, até 600) e os códigos escolhidos, para reaproveitar no próximo pedido. Apagar o
campo na tela e dar baixa (ou gerar) limpa o valor no cadastro. O **texto gerado** não é guardado no banco: vive na página até recarregar.
O paciente **não consegue alterar** esses dois campos pelo portal (a trava dos campos internos os inclui); ele consegue *ler* o próprio
cadastro, como já acontece com o diagnóstico CASSI.

## IA e privacidade
A função `gerar-justificativa-cassi` recebe **só** diagnóstico, músculos, achados e os códigos. Nome, CPF e carteirinha nunca saem do app.
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

## Publicação
Em duas etapas, porque a tela passa a pedir colunas novas: 1) migração `20261103140000_cassi_justificativas_dados.sql` e a função
`gerar-justificativa-cassi`; 2) depois de conferir em produção, a tela.
