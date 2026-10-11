# Fluxo do cliente e regras por tier (especificação do Rafael — 16/07/2026)

> Fonte da verdade do produto. Toda mudança no portal do cliente deve respeitar
> este fluxo. Não alterar sem decisão explícita do Rafael.

## O fluxo de entrada do cliente (ordem obrigatória)

1. **Responder o MyID** — sempre o primeiro passo.
2. **Histórico clínico** — as respostas geram *achados clínicos sugeridos*
   (via triagem por IA) que entram na **fila de revisão do profissional** e,
   aprovados, alimentam o **Avatar Clínico** do cliente (visível na área do
   cliente dentro do app do profissional).
3. **Contar o caso clínico (opcional)** — como começou, onde dói, o que piora
   etc., por voz (ditado) ou texto.
4. **Cliente sem terapeuta** — o app deve direcioná-lo (ex.: convite para o
   marketplace "Encontrar profissional").

## Regras por tier

### Cliente NÃO pago (free)
- Responde: MyID + histórico clínico + história atual de dor.
- Recebe: **somente dicas geradas pela IA** (nível gratuito, seguras e gerais)
  + o Relatório de Avaliação (devolutiva).
- NÃO recebe: avatar montado, planos de treino/nutrição personalizados.

### Cliente PREMIUM (paga a plataforma)
- Tudo do free, e:
- **Avatar Clínico montado por um profissional** — a conta é direcionada para
  um profissional revisar os achados e montar o avatar.
- **Questionários específicos baseados em evidência científica** (a criar) que
  norteiam: treino personalizado, dicas de tratamento fisioterapêutico e plano
  nutricional.
- Os planos gerados **não substituem um profissional**. Planos mais elaborados
  exigem **acompanhamento presencial** — modelo misto ("tratamento
  acompanhado").

## Princípios permanentes
- Mensagens automáticas: SÓ para cliente cadastrado e ativo; toda automática
  registrada na conversa do Zap.
- Conteúdo clínico gerado por IA: o profissional revisa antes de chegar ao
  cliente (exceto o nível gratuito de dicas/devolutiva, que é geral e seguro).
  Para o plano que o cliente Premium gera sozinho, quem revisa e chancela é a
  equipe científica MyHealthID (ver a atualização de 08/10/2026 abaixo).
- Nomenclatura única: "Treinos" (prescritos), "Meu Plano (IA)" (premium),
  "Exercícios & dicas do MyID" (grátis); moeda única "XP".

## Atualização (decisão do Rafael) — Aba única "Plano de tratamento"

O portal do cliente passa a ter UMA aba **"Plano de tratamento"**
(`/paciente/exercicios`) que reúne TODAS as áreas num só lugar:
**Reabilitação, Personal (treino), Nutricional, Psicológico, Médico** — cada
uma mostra o plano/diretriz que o profissional **confirmou/liberou** (via o hub
"Diretrizes" na área do profissional). O treino interativo (marcar exercício
feito, XP, player de sessão — tabela `studio_treinos`) é uma **seção dentro**
dessa aba, não uma aba separada. As rotas antigas `/paciente/plano-ia` e
"Acesso rápido" apontam para essa aba única.

Onde o profissional cria: **Perfil do paciente → aba "Diretrizes"** (uma
sub-aba por área). Cada área tem "Liberar/enviar ao portal" (o "confirmar"). O
construtor manual de treino (exercício a exercício) fica na sub-aba **Personal**.

Regras por tier (reforço):
- **Free**: só o profissional cria o plano; o cliente apenas VÊ o que foi
  liberado. Sem botão de gerar por IA.
- **Premium**: além do que o profissional monta, o cliente pode GERAR o próprio
  plano por IA a partir de MyID + questionários + anamnese. *(Atualizado em
  08/10/2026: o plano gerado passa pela chancela da equipe científica antes de
  chegar ao cliente; ver a última seção.)*
- **Free que respondeu todos os questionários**: o profissional pode montar o
  plano completo com tudo que tem (avaliação presencial + MyID + formulários),
  editar e confirmar — e aí aparece para o cliente na aba "Plano de tratamento".
- Prescrever/liberar treino: Educador Físico **ou** Fisioterapeuta.

## Atualização (decisão do Rafael, 08/10/2026) — Plano do cliente Premium com chancela da equipe científica

> Esta seção atualiza a regra "Premium: o cliente pode GERAR o próprio plano por
> IA" (agora com chancela da equipe científica) e encerra o período, a partir de
> 07/10/2026, em que só o profissional criava planos. O histórico acima fica
> preservado de propósito.

Palavras do Rafael:

> Planos de exercícios e nutricionais podem ser gerados apenas se o cliente
> pagar, e só baseados no MyID, nos outros formulários que aparecem a partir das
> respostas do MyID e no histórico clínico que o próprio cliente preenche no
> portal. Depois disso esses planos são chancelados pelos profissionais
> científicos que trabalham com a marca myhealthid.com.br. Mesmo assim, para um
> treino e um plano nutricional melhores, o app indica a procura de um
> profissional que use o app myhealthid.com.br.

### O que vale

1. **Só quem paga gera.** O cliente só gera treino ou plano nutricional se a
   conta for Premium (`pacientes.tipo_conta = 'wellness_premium'`). O teste
   grátis de 7 dias **deixou de dar direito** a gerar plano. Sem Premium a edge
   responde HTTP 402 com mensagem acolhedora e o portal mostra o convite Premium.
   **Nutrição está desligada por padrão** (decisão de 08/10/2026): enquanto o Rafael não ligar o plano
   nutricional Premium, a edge responde HTTP 403 `nutricao_em_breve` ("O plano nutricional Premium estará
   disponível em breve.") e nenhum plano de nutrição é chancelado nem chega ao cliente. O treino não depende disso.
2. **Só com o que é do cliente.** O plano gerado pelo cliente usa apenas:
   MyID, questionários clínicos que nascem das respostas do MyID, histórico
   clínico (`historico_clinico`, queixa e história atual preenchidos pelo
   próprio cliente) e anamnese nutricional. **Não entram**: avaliação
   presencial, achados do avatar, notas do profissional, exames do profissional
   (bioimpedância etc.) nem a avaliação por voz. O registro
   `_governanca.fonte.insumos` do plano lista só o que de fato entrou. A triagem
   de segurança continua lendo os dados completos do banco: o que o profissional
   registrou ainda pode bloquear o cliente (falso negativo é risco de saúde).
3. **Chancela antes de chegar ao cliente.** O plano gerado vai para a fila da
   **equipe científica MyHealthID** (tabela `plano_cliente_chancela`, status
   `aguardando`). Até ser chancelado, o cliente **não vê o conteúdo**: vê só o
   status "Em revisão pela equipe científica MyHealthID". Quando chancelado, o
   plano aparece com o selo "Chancelado pela equipe científica MyHealthID ·
   nome, perfil · data · vN". A equipe também pode editar o plano antes de
   chancelar ou recusar com um recado curto ao cliente (o cliente vê o recado,
   nunca as notas internas).
4. **Novo plano não apaga o antigo.** Se o cliente gera de novo (por exemplo
   "Senti incômodo" no treino), o plano novo volta para a fila e o último
   chancelado continua visível até o novo ser chancelado. Só existe um plano
   aguardando por cliente e tipo: enquanto ele estiver dentro do prazo da equipe e
   não for chancelado, recusado ou cancelado, gerar outro do mesmo tipo é
   recusado (HTTP 409, antes de gastar IA), para não tirar da fila um plano que a
   equipe está lendo e não multiplicar o custo. Duas saídas para o cliente: o pedido
   **estourou o prazo** da equipe (então ele pode pedir de novo e o pedido parado vira
   `substituido`) ou ele **cancela** o próprio pedido aguardando
   (`cancelar_pedido_plano_cliente`, status `cancelado`).
5. **O profissional do paciente segue o fluxo atual, mas só verificado.** Ele continua criando, editando e
   liberando planos pelo fluxo atual (`planos_treino` / `planos_alimentares` +
   `liberar_plano`); para gerar o plano por IA ele precisa estar **verificado** pelo administrador (ver abaixo). Se o paciente tem um plano do profissional **liberado**, ele
   tem **precedência** na exibição sobre o plano chancelado pela equipe.
6. **Sempre indicar um profissional.** O portal mostra o convite "Para um treino
   e plano nutricional ainda melhores, procure um profissional que use o
   MyHealthID" (rota `/paciente/profissionais`). Se o paciente já tem terapeuta,
   o texto vira "Seu profissional no MyHealthID pode refinar e acompanhar este
   plano". Isso reforça a regra antiga: os planos **não substituem** um
   profissional; planos mais elaborados pedem acompanhamento presencial.

### Equipe científica e quem chancela o quê

Atualização do pacote de segurança (decisões do Rafael, 08/10/2026, migration
`20261008100000_pacote_seguranca_chancela.sql`):

- **Quem é da equipe**: flag `profiles.equipe_cientifica`, mantida só pelo super-admin com
  `definir_equipe_cientifica(email, ativo, areas)`. O próprio usuário não consegue ligá-la, nem mudar as
  áreas, no seu perfil (gatilho). **Ativar exige o profissional verificado.** A conta
  `rafaelbmocbel@gmail.com` entra marcada, verificada e com as duas áreas, e conta como equipe mesmo sem a flag.
- **Verificação do profissional** (nova): `profiles.perfil_profissional_confirmado` só significa "travou a
  escolha da profissão" (autoatendido) e **não prova nada**. A verificação é outra: o profissional informa o
  registro no conselho (`solicitar_verificacao`, 3 a 40 caracteres, grava `registro_profissional` e **não**
  verifica) e **só o super-admin** concede `verificado`, `verificado_em` e `verificado_por`
  (`verificar_profissional`, na tela de administração). Um gatilho reverte, em silêncio, qualquer outra
  tentativa de mexer nesses campos (inclusive o usuário se verificar, por UPDATE, INSERT ou upsert). Trocar o
  registro ou a profissão de quem estava verificado **derruba a verificação e a vaga na equipe** (a
  verificação valia para aquele registro); revogar pelo administrador faz o mesmo. Para verificar, o
  registro precisa ter sido informado. O histórico (quem, quando, registro, nota) fica em
  `profissional_verificacao_log`. As outras contas profissionais que já existiam **não** foram verificadas:
  ficam pendentes até o Rafael conferir o registro.
- **Áreas por revisor**: `profiles.equipe_areas` (`'treino'`, `'nutricao'`), alterável só pelo super-admin.
  Quem não tem a área do plano não chancela nem edita o plano daquela área.
- **`chancelar_plano_cliente` exige**, nesta ordem (cada erro vai com um HINT para o front):
  1. ser da equipe científica (`sem_permissao_area`);
  2. se o plano é de **nutrição**, o plano nutricional Premium estar ligado (`nutricao_desligada`). Vale
     para **todos, inclusive o super-admin**: com a nutrição desligada nada de nutrição chega ao cliente;
  3. perfil **verificado** (`nao_verificado`; o super-admin dispensa);
  4. a área do plano em `equipe_areas` **e** o perfil profissional da área, treino = `educador_fisico` ou
     `fisioterapeuta`, nutrição = `nutricionista` (`sem_permissao_area`). O super-admin atua em qualquer área
     só como exceção de teste, e o carimbo registra `por_perfil = 'super_admin'` quando o perfil dele não é o da área;
  5. não ser o plano da própria conta (`conflito_interesse`), salvo a autochancela abaixo;
  6. **revisão de segurança do conteúdo atual** (presa ao hash). Sem revisão válida (por exemplo, a IA fora
     do ar) só chancela com `p_justificativa` de **15 caracteres ou mais**, e o carimbo marca
     `sem_revisao: true` e `motivo_sem_revisao` (HINT `revisao_obrigatoria` se faltar). Risco `alto`
     continua exigindo justificativa de 15+ (`justificativa_obrigatoria`), **inclusive** quando o plano foi
     editado depois da revisão (editar não apaga o alerta: o carimbo guarda `risco_anterior_desatualizado`).
- **Recusar** exige equipe e perfil verificado (o super-admin dispensa); não exige área nem perfil da área,
  porque recusar é o lado seguro. **Editar** o plano na fila exige o mesmo que chancelar (equipe, verificado,
  área e perfil da área).
- **Autochancela**: o super-admin pode chancelar o plano da **própria** conta (exceção de teste) **só
  enquanto não existir outro membro da equipe científica verificado**. Quando existir, a exceção some
  sozinha (`conflito_interesse`). Quando usada, o carimbo traz `autochancela: true`, que o selo do portal e do
  PDF mostram. Ninguém além do super-admin chancela ou recusa o plano da própria conta, e o super-admin
  pode sempre recusar.
- **Prazo e atraso**: o prazo da equipe é `prazo_chancela_dias_uteis` (padrão **2 dias úteis**, de 1 a 10).
  Dias úteis são segunda a sexta, sem feriados, no calendário de Brasília. O prazo termina às 23:59:59 do
  N-ésimo dia útil depois do dia em que o pedido foi gerado (pedido de sexta com prazo 2: vence na terça); o
  pedido está `atrasado` depois desse instante. A fila (`fila_chancela`) devolve por item
  `dias_uteis_na_fila`, `atrasado`, `pode_chancelar` e `motivo_nao_pode`, e põe os atrasados primeiro.
- **Nutrição Premium desligada por padrão**: `plano_cliente_config` guarda `nutricao_premium_ativa` (padrão
  `false`) e o prazo. Leitura por `plano_cliente_config()` (qualquer usuário logado), escrita só por
  `definir_config_plano_cliente` (super-admin). Com a nutrição desligada, a edge `gerar-plano-alimentar`
  responde ao cliente HTTP 403 `nutricao_em_breve` ("O plano nutricional Premium estará disponível em
  breve."), antes de olhar Premium ou a fila. O caminho do profissional não é afetado.
- **Caminho profissional das edges de geração**: `gerar-plano-treino` e `gerar-plano-alimentar` com um
  paciente de quem é o terapeuta passam a exigir o perfil **verificado** (o super-admin vale sempre, pelo
  e-mail da conta): senão HTTP 403 `profissional_nao_verificado` ("Seu perfil profissional ainda não foi
  verificado pela equipe MyHealthID"). **Efeito imediato**: enquanto o Rafael não verificar os profissionais já
  cadastrados, eles não geram plano por IA para os pacientes.
- **Aviso ao cliente**: depois de chancelar ou recusar, a fila chama a edge `notificar-plano-cliente`
  (`{ plano_id }`), que manda um WhatsApp curto e sem conteúdo clínico (nem o recado da recusa), só para
  cliente cadastrado e ativo, com a pausa geral das automações e o registro na conversa do Zap. Sai **sempre pela
  conta da marca** (administrador), nunca pelo profissional do cadastro do cliente (o cliente edita o próprio
  cadastro); uma única vez por plano decidido. Best-effort: sem WhatsApp configurado o aviso não sai e o portal
  continua mostrando o status.
- **Teto de pedidos**: o cliente faz no máximo 3 pedidos por tipo de plano em 24 horas (decididos, cancelados e
  substituídos contam). Sem isso, cancelar o pedido (que libera o seguinte na hora) viraria geração de IA sem
  limite. Passou do teto, a edge responde 429 `limite_pedidos` antes de gastar IA. O número 3 é provisório e está
  em `plano_cliente_limite_pedidos_24h()`.
- **Revisão de segurança parcial**: plano maior que o limite da IA é revisado só no começo (`plano_truncado`); isso
  não vale como revisão completa. O revisor precisa da mesma justificativa de 15+ caracteres e o carimbo registra
  `revisao_parcial`. Com a nutrição desligada, nenhum plano nutricional da equipe chega ao cliente, nem os já
  chancelados (o plano alimentar do profissional do paciente segue valendo).
- A equipe vê só o **primeiro nome e a idade** do cliente na fila (nada de
  sobrenome, telefone ou e-mail). O cliente e o profissional comum não têm acesso
  à tabela; o cliente lê pelas RPCs `meu_status_plano_cliente` (nunca devolve o
  conteúdo; devolve também `prazo_previsto`, `atrasado` e `pode_regenerar`) e `meu_plano_liberado` (só o chancelado).

### Padrões adotados que o Rafael pode mudar

| Padrão | Onde mudar |
|---|---|
| "Pago" = só `wellness_premium` | `POLITICA_PLANO_CLIENTE.tiposContaQueGeram` em `supabase/functions/_shared/plano-cliente.ts` |
| Insumos permitidos ao cliente | `POLITICA_PLANO_CLIENTE.insumosDoCliente` (mesmo arquivo) |
| Nutrição Premium ligada/desligada | RPC `definir_config_plano_cliente('nutricao_premium_ativa', true)` (super-admin, tela de administração) |
| Prazo da equipe (dias úteis, 1 a 10) | RPC `definir_config_plano_cliente('prazo_chancela_dias_uteis', 2)` |
| Feriados não contam no prazo (hoje só seg–sex) | função SQL `dias_uteis_entre` e `plano_cliente_prazo_ate` |
| Quem verifica profissionais | só o super-admin: `verificar_profissional` (tela de administração) |
| Quem entra na equipe e em quais áreas | `definir_equipe_cientifica(email, ativo, areas)` (super-admin) |
| Perfis que chancelam treino / nutrição | função SQL `plano_cliente_perfil_ok` (e `PERFIL_EXIGIDO` em `usePodeChancelar`, só para o front) |
| Mínimo de 15 caracteres da justificativa e regra da revisão obrigatória | função SQL `chancelar_plano_cliente` + `exigeJustificativa`/`validarChancela` em `src/lib/chancela.ts` |
| Exceção de autochancela do super-admin | função SQL `plano_cliente_motivo_bloqueio` (e `plano_cliente_ha_outro_revisor`) |
| E-mail do super-admin | função SQL `eh_super_admin` (e `SUPER_ADMINS` no front); `profissional_verificado` e `plano_cliente_remetente_aviso` repetem o e-mail |
| Tetos do pedido do cliente (frequência, duração, refeições, tamanho dos textos) | `POLITICA_PLANO_CLIENTE.limitesPedido` (mesmo arquivo) |
| Janela e texto do aviso por WhatsApp | `supabase/functions/_shared/aviso-plano-cliente.ts` |
| Cliente não vê o conteúdo antes de chancelado | `meu_plano_liberado` só devolve `status = 'chancelado'` |
| Quem concede Premium | só `service_role` (pagamento) e super-admin, pelo gatilho `pacientes_protege_tipo_conta` |

### Onde está no código

- Migrations `supabase/migrations/20261008000000_plano_cliente_chancela.sql` (tabela
  `plano_cliente_chancela`, `profiles.equipe_cientifica`, `eh_equipe_cientifica`, `fila_chancela`,
  `chancelar_plano_cliente`, `recusar_plano_cliente`, `meu_status_plano_cliente`, `meu_plano_liberado` com
  `origem`, `registrar_plano_cliente_chancela`) e `20261008100000_pacote_seguranca_chancela.sql` (verificação,
  áreas, configuração, prazo em dias úteis, status `cancelado`, `cancelar_pedido_plano_cliente`, regras novas
  de chancela e fila). Esta última é idempotente e não apaga tabelas, colunas nem funções; a única remoção é a
  da regra antiga de status da tabela (uma constraint, que entra substituída por `plano_cliente_chancela_status_v2`).
  A assinatura antiga `definir_equipe_cientifica(email, valor)` continua existindo como atalho que delega à nova com
  as áreas do perfil do alvo; por isso **chame a nova com 3 argumentos** (`..., true, array['treino']`) ou nomeie
  `p_ativo`: a chamada posicional de só 2 argumentos fica ambígua entre as duas e o Postgres recusa. Quem estava
  na equipe sem ser verificado perde a vaga nessa migration (fica no log); ninguém além do administrador é
  verificado por ela.
- Edges `gerar-plano-treino` e `gerar-plano-alimentar` (Premium, insumos do cliente, gravação na fila,
  nutrição desligada, profissional verificado), `revisar-plano-seguranca` (aceita
  `tabela: 'plano_cliente_chancela'` para a equipe) e `notificar-plano-cliente` (aviso por WhatsApp). Lógica
  pura em `supabase/functions/_shared/plano-cliente.ts` e `_shared/aviso-plano-cliente.ts`; testes em
  `src/test/planoClienteChancela.test.ts`, `src/test/avisoPlanoCliente.test.ts`,
  `src/test/migracaoPacoteSegurancaChancela.test.ts` e `src/test/motoresPlano.test.ts`.
- Portal do cliente: `src/pages/paciente/PacientePlanoIA.tsx` (gerador Premium, status
  "em revisão"/"recusado", plano chancelado com selo da equipe, convite para procurar um
  profissional) e `src/pages/paciente/PacienteTreinoCompleto.tsx` (treino/nutrição completos,
  agora **somente leitura**, lidos de `meu_plano_liberado`: sem editar nem compartilhar, para
  não burlar a chancela). O portal não lê mais `planos_ia_cliente`. O que o cliente vê no pacote de
  segurança (chamadas em `src/lib/planoClienteApi.ts`, textos em `src/lib/geracaoPlano.ts`):
  - pedido aguardando mostra "Previsão: até dd/mm/aaaa" (o `prazo_previsto` do servidor, no fuso de Brasília);
    passado o prazo, em vez da previsão aparece um recado acolhedor ("Sentimos muito...") que oferece pedir
    de novo (o novo pedido substitui o parado) ou cancelar;
  - **Cancelar pedido** (com confirmação) só aparece com o pedido aguardando e chama
    `cancelar_pedido_plano_cliente`; se a equipe decidiu antes, o cliente é avisado e a tela mostra a decisão;
  - o botão de gerar de novo só fica habilitado quando o servidor diz `pode_regenerar` (o "Senti incômodo" do
    treino segue a mesma regra);
  - com `nutricao_premium_ativa = false` (padrão, inclusive quando a leitura da configuração falha) o card da
    nutrição mostra "Plano nutricional Premium: em breve" no lugar do botão e **não há "Gerar os dois"**: só o
    treino é oferecido; se o servidor responder 403 `nutricao_em_breve` com a tela desatualizada, o portal
    avisa com gentileza e passa a mostrar o "em breve". Um plano alimentar já chancelado continua visível;
  - o selo de uma autochancela termina com "Autochancela (teste interno)"; o cliente nunca vê revisão de
    segurança, justificativa nem "sem revisão" (a RPC `gov_publico` já remove isso);
  - o 403 `profissional_nao_verificado` (caminho do profissional nas edges) vira uma mensagem acolhedora nos
    cartões de geração do profissional (`mensagemErroGeracao`).
- Fila da equipe científica: `/chancela` (`src/pages/ChancelaEquipe.tsx`), visível só para quem
  `eh_equipe_cientifica()`; o hook compartilhado é `src/hooks/useEquipeCientifica.ts`; a configuração do
  plano do cliente vem de `src/hooks/usePlanoClienteConfig.ts`; as chamadas às RPCs ficam em
  `src/lib/chancelaApi.ts`.
- Detalhes da triagem e da resposta das edges: `docs/triagem-planos.md`.

### Ordem de publicação

1. Aplicar as migrations `20261008000000_plano_cliente_chancela.sql` e `20261008100000_pacote_seguranca_chancela.sql`
   (nessa ordem). **A versão registrada no banco precisa ser igual à do nome do arquivo.** O `apply_migration`
   do MCP grava a versão com o horário real da aplicação; se isso acontecer, rode `list_migrations` e
   renomeie o arquivo (`git mv`) para a versão devolvida antes do commit — senão o `supabase db push` do deploy
   automático aborta ("Remote migration versions not found in local migrations directory") e o passo de deploy
   das edges nem roda. Alternativa: aplicar o SQL (`execute_sql`) e inserir em
   `supabase_migrations.schema_migrations` a linha com a versão e o nome do arquivo. As migrations são
   idempotentes, então um `db push` residual não corrompe nada.
2. Publicar as edges `gerar-plano-treino`, `gerar-plano-alimentar`, `revisar-plano-seguranca` e
   `notificar-plano-cliente` (dependem da tabela e das RPCs das migrations) e conferir com
   `list_edge_functions` que as quatro estão na versão nova.
3. Só então publicar o front. Vercel e a GitHub Action de deploy correm em paralelo num mesmo push:
   com tudo no mesmo commit existe uma janela de minutos com o front novo e as edges antigas (a fila da equipe
   chamaria a `notificar-plano-cliente` ainda inexistente e as RPCs novas dependem das migrations). Para
   evitar, faça **dois pushes**: primeiro só `supabase/**` (migrations, edges, `_shared`, docs), espere a
   Action ficar verde, e depois o commit com `src/**`. Alternativa: publicar as edges pelo MCP
   (`deploy_edge_function`) antes do push do front. A migration antes do front não causa problema.
4. Depois de publicar: abrir a tela de administração, conferir o registro de cada profissional e verificá-lo
   (quem ainda não informou o registro precisa enviá-lo antes). Até lá, os profissionais já cadastrados
   (além do Rafael) recebem 403 `profissional_nao_verificado` ao gerar plano por IA. Depois, designar a equipe:
   `select public.definir_equipe_cientifica('email@...', true, array['treino']);` (como super-admin ou
   service_role; o profissional precisa estar verificado e as áreas são `treino` e/ou `nutricao`).
5. Para abrir a nutrição Premium ao cliente: pela tela de administração (interruptor "Plano nutricional Premium")
   ou `select public.definir_config_plano_cliente('nutricao_premium_ativa', 'true'::jsonb);` **logado como
   super-admin**: a RPC confere `eh_super_admin()` pelo e-mail do JWT, então no editor SQL (sem sessão) ela recusa
   com "Apenas o administrador MyHealthID". O mesmo vale para `verificar_profissional` e `profissionais_admin`.
   Antes de ligar, ter ao menos um nutricionista verificado na equipe com a área `nutricao`.
