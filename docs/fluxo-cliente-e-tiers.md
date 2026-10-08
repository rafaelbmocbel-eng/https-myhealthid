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
   aguardando por cliente e tipo: enquanto ele não for chancelado ou recusado,
   gerar outro do mesmo tipo é recusado (HTTP 409, antes de gastar IA), para não
   tirar da fila um plano que a equipe está lendo e não multiplicar o custo.
5. **O profissional do paciente não muda.** Ele continua criando, editando e
   liberando planos pelo fluxo atual (`planos_treino` / `planos_alimentares` +
   `liberar_plano`). Se o paciente tem um plano do profissional **liberado**, ele
   tem **precedência** na exibição sobre o plano chancelado pela equipe.
6. **Sempre indicar um profissional.** O portal mostra o convite "Para um treino
   e plano nutricional ainda melhores, procure um profissional que use o
   MyHealthID" (rota `/paciente/profissionais`). Se o paciente já tem terapeuta,
   o texto vira "Seu profissional no MyHealthID pode refinar e acompanhar este
   plano". Isso reforça a regra antiga: os planos **não substituem** um
   profissional; planos mais elaborados pedem acompanhamento presencial.

### Equipe científica e quem chancela o quê

- A equipe é designada pela flag `profiles.equipe_cientifica`, mantida só pelo
  super-admin (função `definir_equipe_cientifica('email', true|false)`; o próprio
  usuário não consegue ligar a flag no seu perfil). A conta
  `rafaelbmocbel@gmail.com` já entra marcada e conta como equipe mesmo sem a flag.
- **Treino**: chancela quem tem perfil `educador_fisico` ou `fisioterapeuta`.
  **Nutrição**: `nutricionista`. O super-admin chancela qualquer área (se o perfil
  dele não é o da área, o carimbo registra `super_admin`). O banco confere; o
  front só guia.
- Se a revisão de segurança do plano deu risco `alto`, a chancela exige
  justificativa de 15 caracteres ou mais (mesma regra de liberar plano). Editar o
  plano depois de revisado invalida a revisão (ela fica presa ao hash do conteúdo),
  **mas não apaga o alerta**: com a última revisão em risco `alto` a justificativa
  continua obrigatória e o carimbo guarda `risco_anterior_desatualizado`. Chancelar
  sem revisão válida é permitido, mas o carimbo registra `sem_revisao: true`.
- Cada membro **edita** o plano só na área do seu perfil (a mesma regra de chancelar),
  e ninguém (exceto o super-admin) chancela ou recusa o plano gerado para a própria conta.
- A equipe vê só o **primeiro nome e a idade** do cliente na fila (nada de
  sobrenome, telefone ou e-mail). O cliente e o profissional comum não têm acesso
  à tabela; o cliente lê pelas RPCs `meu_status_plano_cliente` (nunca devolve o
  conteúdo) e `meu_plano_liberado` (só o chancelado).

### Padrões adotados que o Rafael pode mudar

| Padrão | Onde mudar |
|---|---|
| "Pago" = só `wellness_premium` | `POLITICA_PLANO_CLIENTE.tiposContaQueGeram` em `supabase/functions/_shared/plano-cliente.ts` |
| Insumos permitidos ao cliente | `POLITICA_PLANO_CLIENTE.insumosDoCliente` (mesmo arquivo) |
| Perfis que chancelam treino / nutrição | função SQL `chancelar_plano_cliente` (e `PERFIL_EXIGIDO` em `usePodeChancelar`, só para o front) |
| E-mail do super-admin | função SQL `eh_super_admin` (e `SUPER_ADMINS` no front) |
| Cliente não vê o conteúdo antes de chancelado | `meu_plano_liberado` só devolve `status = 'chancelado'` |
| Tetos do pedido do cliente (frequência, duração, refeições, tamanho dos textos) | `POLITICA_PLANO_CLIENTE.limitesPedido` (mesmo arquivo) |
| Exigir revisão de segurança da versão atual para chancelar (hoje só o risco alto exige justificativa) | função SQL `chancelar_plano_cliente` + `exigeJustificativa`/`validarChancela` em `src/lib/chancela.ts` |
| Super-admin pode chancelar o plano da própria conta (para testar sozinho) | função SQL `plano_cliente_checa_conflito` |
| Quem concede Premium | só `service_role` (pagamento) e super-admin, pelo gatilho `pacientes_protege_tipo_conta` |

### Onde está no código

- Migration `supabase/migrations/20261008000000_plano_cliente_chancela.sql`:
  tabela `plano_cliente_chancela`, `profiles.equipe_cientifica`, `eh_equipe_cientifica`,
  `fila_chancela`, `chancelar_plano_cliente`, `recusar_plano_cliente`,
  `meu_status_plano_cliente`, `meu_plano_liberado` (agora com `origem`),
  `registrar_plano_cliente_chancela` (só o servidor).
- Edges `gerar-plano-treino` e `gerar-plano-alimentar` (Premium, insumos do cliente,
  gravação na fila) e `revisar-plano-seguranca` (aceita `tabela: 'plano_cliente_chancela'`
  para a equipe). Lógica pura em `supabase/functions/_shared/plano-cliente.ts`;
  testes em `src/test/planoClienteChancela.test.ts` e `src/test/motoresPlano.test.ts`.
- Portal do cliente: `src/pages/paciente/PacientePlanoIA.tsx` (gerador Premium, status
  "em revisão"/"recusado", plano chancelado com selo da equipe, convite para procurar um
  profissional) e `src/pages/paciente/PacienteTreinoCompleto.tsx` (treino/nutrição completos,
  agora **somente leitura**, lidos de `meu_plano_liberado`: sem editar nem compartilhar, para
  não burlar a chancela). O portal não lê mais `planos_ia_cliente`.
- Fila da equipe científica: `/chancela` (`src/pages/ChancelaEquipe.tsx`), visível só para quem
  `eh_equipe_cientifica()`; o hook compartilhado é `src/hooks/useEquipeCientifica.ts`.
- Detalhes da triagem e da resposta das edges: `docs/triagem-planos.md`.

### Ordem de publicação

1. Aplicar a migration `20261008000000_plano_cliente_chancela.sql`. **A versão registrada no banco
   precisa ser igual à do nome do arquivo.** O `apply_migration` do MCP grava a versão com o horário
   real da aplicação; se isso acontecer, rode `list_migrations` e renomeie o arquivo (`git mv`) para a
   versão devolvida antes do commit — senão o `supabase db push` do deploy automático aborta ("Remote
   migration versions not found in local migrations directory") e o passo de deploy das edges nem roda.
   Alternativa: aplicar o SQL (`execute_sql`) e inserir em `supabase_migrations.schema_migrations` a
   linha `version = '20261008000000'`, `name = 'plano_cliente_chancela'`. A migration é idempotente, então
   um `db push` residual não corrompe nada.
2. Publicar as edges `gerar-plano-treino`, `gerar-plano-alimentar` e `revisar-plano-seguranca`
   (dependem da tabela e das RPCs da migration) e conferir com `list_edge_functions` que as três
   estão na versão nova.
3. Só então publicar o front. Vercel e a GitHub Action de deploy correm em paralelo num mesmo push:
   com tudo no mesmo commit existe uma janela de minutos com o front novo e as edges antigas (o
   Premium veria o 403 antigo "Seu plano é montado e liberado pelo seu profissional" e a fila da equipe
   receberia 404 da `revisar-plano-seguranca` antiga). Para evitar, faça **dois pushes**: primeiro só
   `supabase/**` (migration, edges, `_shared`, docs), espere a Action ficar verde, e depois o commit
   com `src/**`. Alternativa: publicar as três edges pelo MCP (`deploy_edge_function`) antes do push do
   front. A migration antes do front não causa problema.
4. Marcar a equipe: `select public.definir_equipe_cientifica('email@...', true);` (como
   super-admin ou service_role).
