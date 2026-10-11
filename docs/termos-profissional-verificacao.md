# Cláusula sugerida: verificação da habilitação profissional

> **Status: SUGESTÃO. Não foi aplicada em `Termos.tsx` nem em nenhuma tela.** O texto, a base legal e o canal de
> contato abaixo precisam ser revistos e aprovados pelo Rafael e pelo jurídico antes de irem ao ar. Nada aqui é
> parecer jurídico.

Contexto: a aba Administração ganhou o botão **Pesquisar** (decisão do Rafael, 11/10/2026), que faz uma pesquisa
automática na internet sobre informação **profissional pública** de cada profissional cadastrado, para ajudar na
verificação. Funcionamento, limites e riscos em `docs/triagem-planos.md`, seção "Pesquisa automática de profissionais".

## Texto sugerido para os Termos de Uso do profissional

> **Verificação da habilitação profissional**
>
> Para proteger os clientes e a plataforma, o MyHealthID confere se quem atua como profissional de saúde tem a
> habilitação que declara. Para isso, a equipe MyHealthID pode consultar informações profissionais públicas sobre
> você, como o seu registro no conselho da sua categoria (CREFITO, CREF, CRN, CRM, CRP ou CRO), a situação desse
> registro quando ela é pública, e a formação, a atuação e o perfil profissionais que você mantém publicados (por
> exemplo, currículo Lattes, perfil profissional em rede de contatos ou site da sua clínica).
>
> Parte dessa consulta é automática e usa ferramentas de busca e de inteligência artificial. Ela parte do seu nome,
> da sua profissão, do número do seu registro profissional e, se você a informou, da cidade da sua clínica. Não
> buscamos informações da sua vida pessoal, da sua família, do seu endereço, da sua saúde, de processos ou das suas
> opiniões, e descartamos qualquer informação desse tipo que apareça nos resultados antes de guardá-los. Não usamos o
> seu e-mail nem o seu telefone nessa consulta.
>
> O resultado é apenas um indício que ajuda a equipe, e pode estar incompleto ou errado. **Nenhum perfil é
> verificado ou recusado automaticamente:** a decisão é sempre de uma pessoa da equipe MyHealthID.
>
> Guardamos o resultado de cada consulta (data, quem a pediu, o que foi usado na busca e as fontes públicas
> encontradas) enquanto o seu cadastro existir, para fins de segurança e de auditoria. Só o administrador do
> MyHealthID tem acesso a esse histórico.
>
> Você pode, a qualquer momento, pedir acesso aos dados dessa consulta, pedir a correção de dados incompletos ou
> incorretos, contestar um resultado ou pedir a eliminação do histórico, escrevendo para
> **[CANAL DE PRIVACIDADE A DEFINIR]**. Se uma informação encontrada estiver errada, você pode nos enviar o
> comprovante do seu registro para a conferência ser refeita por uma pessoa.

## Onde o aviso deveria aparecer (a decidir)

- Nos Termos de Uso do profissional (`Termos.tsx`), com a versão e a data do texto.
- Junto ao campo em que o profissional informa o registro (hoje `solicitar_verificacao`), com uma frase curta e o link
  para os Termos, por exemplo: "Vamos conferir este registro em fontes públicas. Veja como."
- Na política de privacidade, na lista de finalidades e de operadores.

## Base legal sugerida (a confirmar pelo jurídico)

Sugestão de partida, com a referência aos artigos da LGPD a conferir:

1. **Legítimo interesse do controlador e de terceiros** (art. 7º, IX, e art. 10): conferir a habilitação de quem
   atende clientes na plataforma protege a saúde e a segurança dos clientes. Recomenda-se registrar o teste de
   balanceamento (finalidade legítima, necessidade, expectativa do profissional, salvaguardas). As salvaguardas
   existentes: escopo só profissional, consulta mínima (nome, profissão, registro, cidade/UF), nenhum e-mail ou
   telefone na busca, descarte de dados fora do escopo, resultado apenas como indício, decisão humana, acesso restrito
   ao administrador e registro de cada consulta.
2. **Dados tornados manifestamente públicos pelo titular ou de acesso público** (art. 7º, §§ 3º e 4º): o registro no
   conselho e os perfis profissionais publicados são públicos por natureza, desde que o uso respeite a finalidade, a
   boa-fé e o interesse público que justificaram a publicação, e os demais princípios e direitos da lei (art. 7º, § 6º).
3. **Procedimentos preliminares relacionados a contrato** (art. 7º, V), em parte: a verificação é condição para
   habilitar funções profissionais na conta.

O jurídico decide se uma dessas bases basta ou se outra deve ser usada (por exemplo, consentimento destacado no
cadastro do profissional). Pontos a confirmar:

- [ ] Base legal escolhida e registro do teste de balanceamento, se for legítimo interesse.
- [ ] Encarregado (DPO) e **canal de privacidade** (preencher o texto acima).
- [ ] Necessidade de relatório de impacto à proteção de dados pessoais (art. 38) para esse tratamento.
- [ ] Contrato ou termos de tratamento de dados com a Google (a consulta, com nome e registro, é enviada à API Gemini) e
      eventual transferência internacional (art. 33).
- [ ] Prazo máximo de retenção do histórico. Hoje **não há prazo nem rotina de expurgo**: as linhas ficam enquanto a conta
      existir (e somem com ela), e o repositório não tem fluxo de exclusão de conta. Decidir o prazo antes de ir para
      produção e informá-lo no texto acima.
- [ ] O descarte de informação fora do escopo é feito por regras de texto (lista de bloqueio e de permissão), que reduzem
      o risco mas **não o eliminam**: ajustar a redação ("descartamos...") ao que o jurídico aceitar prometer.
- [ ] Tratamento do nome de terceiros que apareça no trecho de uma fonte (por exemplo, outro inscrito com o mesmo
      número): a tela só mostra ao administrador; avaliar se basta.
- [ ] Prazo para responder aos pedidos do titular (art. 18).

## Como o profissional pede correção

Sugestão de fluxo (a ajustar ao canal definido):

1. O profissional escreve para o canal de privacidade informando o nome e o e-mail da conta e o que está errado ou
   incompleto.
2. A equipe confere a conta e, se for o caso, pede o comprovante do registro (por exemplo, o número e a situação no site
   do próprio conselho, ou o documento do conselho).
3. O administrador **refaz a conferência** (a pesquisa pode ser repetida; o limite é de uma por profissional a cada
   10 minutos) e decide a verificação. O resultado automático nunca é a decisão.
4. Se o profissional pedir eliminação do histórico, o administrador avalia o pedido e o atende no que a lei permitir
   (obrigações de segurança e de auditoria podem justificar guardar parte do registro). Hoje a exclusão dessas linhas
   é feita por quem administra o banco; não há tela para isso.
5. A resposta ao profissional segue o prazo definido pelo jurídico.

## O que esta cláusula não faz

- Não autoriza buscar vida pessoal, família, endereço, saúde, processos, opinião política ou religiosa.
- Não verifica, recusa nem remove ninguém automaticamente.
- Não substitui a conferência direta no site do conselho da categoria.
