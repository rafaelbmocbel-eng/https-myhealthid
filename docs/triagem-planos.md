# Triagem de segurança dos planos gerados por IA

> **Status: regras PROVISÓRIAS.** Foram escritas como ponto de partida técnico e
> **precisam ser validadas pelo Rafael e por profissionais** (educação física,
> nutrição, medicina) antes de serem tratadas como definitivas. Nada aqui é
> orientação clínica.

Antes de gastar uma chamada de IA, as edge functions `gerar-plano-treino` e
`gerar-plano-alimentar` avaliam se aquele paciente pode receber um plano gerado
automaticamente. O resultado é sempre um destes níveis:

| Nível | Significado |
|---|---|
| `liberado` | Nada sinalizado e todos os dados necessários existem. O plano é gerado. |
| `confirmar` | Há um fator de atenção (ou dado ausente). Só um **profissional** pode prosseguir, marcando que está ciente. |
| `bloqueia` | Há um fator de bloqueio. Só um **profissional** pode prosseguir, e com **justificativa escrita**. |

**Princípio:** falso negativo é risco de saúde. Em caso de dúvida o resultado
sobe para `confirmar` — nunca fica `liberado`.

Código: `supabase/functions/_shared/triagem-bloqueio.ts` (lógica pura, sem Deno).
Testes: `npx vitest run src/test/triagemBloqueio.test.ts`.

Quem gera e para onde vai o plano (cliente Premium, insumos do cliente e chancela da
equipe científica MyHealthID, decisão de 08/10/2026): `supabase/functions/_shared/plano-cliente.ts`
e a seção "Cliente Premium e a chancela da equipe científica" mais abaixo.
Testes: `npx vitest run src/test/planoClienteChancela.test.ts src/test/avisoPlanoCliente.test.ts src/test/migracaoPacoteSegurancaChancela.test.ts`.

## Matriz de regras (padrão atual)

`B` = bloqueia, `C` = confirmar, `—` = não se aplica àquele foco.

| Fator | Treino | Nutrição |
|---|:-:|:-:|
| Menor de 18 anos | B | B |
| Gestação ou amamentação | B | B |
| Histórico de transtorno alimentar | — | B |
| Doença renal | C | B |
| Idoso (65 anos ou mais) | C | C |
| PAR-Q+ com classificação de atenção | C | — |
| Diabetes com insulina ou hipoglicemiante | C | — |
| Diabetes (qualquer tipo) | — | C |
| Problema de coração ou pressão alta | C | C |
| Cirurgia ou lesão recente | C | — |
| Cirurgia bariátrica | — | C |
| Sinais de alerta (red flags) no MyID | C | C |

Respostas **"não sei"** e **"prefiro não dizer"** na triagem autodeclarada contam
sempre como `confirmar` (mesmo quando a regra do fator é `bloqueia`), porque
não são uma confirmação do fator, mas também não descartam o risco.

### Dados ausentes

| Dado ausente | Código em `dadosAusentes` | Cliente | Profissional |
|---|---|---|---|
| Data de nascimento não cadastrada | `idade` | bloqueia | confirmar |
| Triagem autodeclarada não respondida (ou incompleta) | `triagem_autodeclarada` | bloqueia | confirmar |
| Falha ao ler dados do paciente no banco | `leitura_dados` | bloqueia | confirmar |

Cada dado ausente também aparece como um motivo legível em `motivos`, com
`origem: "dados_ausentes"`. Uma idade apenas digitada (sem data de nascimento) nunca
limpa o dado ausente — só pode **bloquear** (um menor poderia digitar 30).

## Quem pode o quê

| | Cliente (Premium gerando o próprio plano; o plano vai para a chancela) | Profissional |
|---|---|---|
| Direito de gerar | Só `wellness_premium`; senão HTTP 402 (o teste grátis de 7 dias não vale mais). **Nutrição** só com o plano nutricional Premium ligado; senão HTTP 403 `nutricao_em_breve`. Com um plano do mesmo tipo já aguardando a equipe **dentro do prazo**: HTTP 409 (estourado o prazo, o pedido novo substitui o parado) | Terapeuta do paciente ou perfil profissional (regra abaixo) **e perfil verificado pelo administrador**; senão HTTP 403 `profissional_nao_verificado` |
| Pedido (objetivo, nível, frequência, duração, refeições, textos) | Normalizado no servidor com tetos (`POLITICA_PLANO_CLIENTE.limitesPedido`) | Como veio da tela |
| Qualquer motivo, mesmo de nível `confirmar` | **Bloqueia.** Vê "fale com o seu profissional" e o atalho para responder a triagem. | Precisa marcar "ciente" |
| Fator de nível `bloqueia` | Bloqueia | Precisa de justificativa com **15 caracteres ou mais** |
| Dado ausente | Bloqueia ("complete a triagem / cadastro") | Precisa marcar "ciente" |
| Sobrepor a triagem | **Nunca** | Sim, via `override` no pedido |

Quem chama é definido pelo servidor (JWT + banco), nunca pelo body do pedido:

- é o próprio paciente (`pacientes.user_id`) → **cliente**; sem `paciente_id`, usa o
  próprio cadastro;
- é o terapeuta do paciente (`pacientes.terapeuta_id`) → **profissional**;
- tem perfil profissional (`profiles`) mas sem vínculo direto com o paciente →
  **profissional** (mantém a regra anterior, para não derrubar quem atende em clínica);
- em qualquer dos dois casos de **profissional**, a edge ainda exige o perfil **verificado** pelo
  administrador (`profiles.verificado`; o super-admin vale sempre, pelo e-mail da conta): HTTP 403
  `profissional_nao_verificado`, ou 503 se o banco não responder (fail-closed). `perfil_profissional_confirmado`
  (escolha da profissão, autoatendida) **não** conta como verificação;
- qualquer outro caso é recusado (403); paciente inexistente é 404; erro ao ler o
  banco é 503 (fail-closed: nunca "sem dados = liberado").

### Resposta da edge function

Quando não pode gerar, a resposta é HTTP 200:

```json
{
  "ok": false,
  "bloqueio": {
    "nivel": "bloqueia",
    "motivos": [{ "codigo": "gestante_lactante", "rotulo": "...", "detalhe": "...", "origem": "triagem_autodeclarada", "nivel": "bloqueia" }],
    "dadosAusentes": [],
    "pode_prosseguir_profissional": true
  }
}
```

Quando pode gerar, a resposta depende de quem chamou:

- **Profissional**: `{ "ok": true, "plano": { ... } }` (a de treino acrescenta `usou_banco`).
  Ele edita e libera pelo fluxo de sempre.
- **Cliente Premium**: o servidor grava o plano na fila de chancela e responde
  `{ "ok": true, "em_revisao": true, "plano_id": "<uuid>" }`, **sem o conteúdo do plano**.
  Se a gravação falhar a resposta é erro HTTP 500 (nunca finge sucesso nem entrega o
  plano sem chancela). Sem Premium: HTTP 402 `{ "error": "...", "codigo": "premium_necessario" }`.
  Com plano do mesmo tipo já aguardando a equipe: HTTP 409 `{ "error": "...", "codigo": "plano_em_revisao" }`
  (checado ANTES de gastar IA; se a fila não puder ser consultada, HTTP 503). O portal já desliga o
  botão nesse estado; o 409 cobre outra aba, estado velho e chamada direta à edge.

Erros novos do pacote de segurança (decisões de 08/10/2026), todos antes de gastar IA:

| HTTP | `codigo` | Quando |
|---|---|---|
| 403 | `nutricao_em_breve` | Cliente pede plano alimentar com `nutricao_premium_ativa` desligada (`{ "error": "O plano nutricional Premium estará disponível em breve.", "codigo": "nutricao_em_breve" }`). Vale antes de olhar Premium ou a fila; o profissional não é afetado |
| 403 | `profissional_nao_verificado` | Profissional que ainda não foi verificado pelo administrador (`{ "error": "Seu perfil profissional ainda não foi verificado pela equipe MyHealthID", "codigo": "profissional_nao_verificado" }`) |
| 409 | `plano_em_revisao` | Cliente com pedido do mesmo tipo aguardando **dentro do prazo** da equipe. Pedido que estourou o prazo não barra: o banco o marca `substituido` ao gravar o novo |
| 503 | — | Não deu para ler a configuração, o pedido ou a verificação (nunca "sem dados = liberado") |

Para prosseguir, o profissional reenvia o mesmo pedido com:

```json
{ "override": { "justificativa": "texto com 15 caracteres ou mais", "ciente": true } }
```

`bloqueia` exige a justificativa; `confirmar` exige `ciente: true`. Se o override
foi enviado mas não bastou, o `bloqueio` vem com `override_recusado`
(`justificativa_curta` ou `ciente_ausente`). O override usado fica registrado em
`plano._governanca.triagem.override` (com data e hora).

Cliente com texto livre que acionou uma regra **não** recebe o trecho do texto
(pode ser anotação de profissional): o `detalhe` é genérico. O profissional vê o
termo encontrado.

## Cliente Premium e a chancela da equipe científica

Decisão do Rafael (08/10/2026): o cliente **só gera se pagar** (Premium), **só com o que é
dele**, e o plano **só chega a ele depois de chancelado** pela equipe científica MyHealthID.
O profissional do paciente continua criando, editando e liberando planos pelo fluxo atual
(`planos_treino` / `planos_alimentares` + `liberar_plano`). Visão de produto em
`docs/fluxo-cliente-e-tiers.md`.

### Insumos do plano do cliente

O prompt do cliente usa **apenas**: MyID, questionários clínicos, histórico clínico
(`historico_clinico`), queixa e história atual, medicamentos/alergias/condições do cadastro,
triagem autodeclarada e anamnese nutricional (esta só no plano alimentar). **Não entram**:
achados e notas da avaliação presencial, exames do profissional (bioimpedância,
`exames_presenciais`), avaliação por voz, e do corpo do pedido a antropometria, os testes
funcionais e o recordatório (do cliente não se aceitam). Implementação:
`restringirAInsumosDoCliente`, `dadosDoPedido` e `insumosDoPlano` em `_shared/plano-cliente.ts`;
`carregarMotoresClinicos(admin, id, { apenasInsumosDoCliente: true })` faz o mesmo filtro no
carregamento. A lista permitida está em `POLITICA_PLANO_CLIENTE.insumosDoCliente`, e
`_governanca.fonte.insumos` registra só o que de fato entrou.

A triagem de segurança **continua lendo os motores completos** (inclusive as notas do
profissional): uma nota "gestante" do profissional ainda bloqueia o cliente, mesmo que o
texto não vá para o prompt. O `detalhe` mostrado ao cliente segue genérico.

### Fila de chancela

- Tabela `plano_cliente_chancela` (RLS ligado, policy só para a equipe científica). O servidor
  grava com `registrar_plano_cliente_chancela` (só `service_role`): o novo plano entra como
  `aguardando`. Enquanto já existe um `aguardando` do mesmo paciente e tipo **dentro do prazo** a gravação é
  recusada (`plano_em_revisao`): gerar de novo não tira da fila, nem de baixo das mãos do revisor, um plano que a
  equipe está lendo ou editando, e cada geração custa uma chamada de IA. Se o `aguardando` **estourou o prazo**,
  o novo pedido entra e o parado vira `substituido`. O `chancelado` atual segue visível ao cliente até o novo ser chancelado.
  **Teto de pedidos**: no máximo **3 pedidos por paciente e tipo em 24 horas**, contando todos (decididos, cancelados
  e substituídos); passou disso, a edge responde 429 `limite_pedidos` antes de gastar IA (`plano_cliente_estado_pedido`
  devolve `limite`) e o banco repete a checagem ao gravar (corrida entre duas gerações). O pedido aguardando no prazo
  continua tendo precedência (409). O número está em `plano_cliente_limite_pedidos_24h()` (valor provisório; mudar
  exige nova migration).
- Status: `aguardando`, `chancelado`, `recusado`, `substituido` e `cancelado` (o cliente cancelou o próprio pedido
  aguardando, `cancelar_pedido_plano_cliente(tipo)`; só cancela o **seu** aguardando).
- **Prazo**: `plano_cliente_config.prazo_chancela_dias_uteis` (padrão 2, de 1 a 10), em dias úteis (seg–sex, sem
  feriados, calendário de Brasília). `dias_uteis_entre(a, b)` conta os dias úteis em (dia de `a`, dia de `b`]: sexta
  17h até segunda 09h = 1; sábado e domingo não contam. O prazo vence às 23:59:59 do N-ésimo dia útil depois do dia
  em que o pedido foi gerado (`plano_cliente_prazo_ate`); `atrasado` = passou desse instante. As duas funções são
  internas (só as RPCs do banco as chamam; usuário logado não tem EXECUTE) e limitadas: 10 anos de intervalo em
  `dias_uteis_entre`, prazo de 1 a 10 dias em `plano_cliente_prazo_ate`.
- Equipe: `profiles.equipe_cientifica` (flag mantida pelo super-admin) com `profiles.equipe_areas`
  (`treino`, `nutricao`); `definir_equipe_cientifica(email, ativo, areas)` — **ativar exige o profissional
  verificado**. `eh_equipe_cientifica()` diz se quem chama é da equipe. A assinatura antiga
  `definir_equipe_cientifica(email, valor)` ficou como atalho (delega à nova com as áreas do perfil do alvo); a
  chamada posicional de 2 argumentos é ambígua entre as duas, então use 3 argumentos ou nomeie `p_ativo`.
- Verificação: `solicitar_verificacao(registro)` (o próprio profissional, 3 a 40 caracteres, não verifica),
  `verificar_profissional(user_id, verificado, nota?, registro_visto?)` e `profissionais_admin()` (só o super-admin;
  exceção `Apenas o administrador MyHealthID` para os outros). A tela envia em `registro_visto` o registro que o
  administrador conferiu; se o profissional o trocou antes do clique, o banco recusa com HINT `registro_alterado`
  (a lista recarrega) em vez de verificar um registro que ninguém viu. Um gatilho em `profiles` impede qualquer outra pessoa de
  mudar `verificado`, `verificado_em`, `verificado_por` e `equipe_areas`; trocar o registro ou a profissão de
  quem estava verificado derruba a verificação e a vaga na equipe. Histórico em `profissional_verificacao_log`.
  **Equipe implica verificado**: quem já estava marcado como equipe antes desta migration (designado pelo atalho
  antigo) e não é verificado perde `equipe_cientifica` e as áreas na própria migration (fica no log, origem
  `migracao`); ninguém é verificado por ela, só a conta do administrador. O administrador verifica o registro na
  tela e designa de novo.
- `fila_chancela(status)` (só equipe; aceita `aguardando|chancelado|recusado|cancelado|substituido`) lista a fila
  com **primeiro nome e idade** do paciente, o conteúdo, um resumo da revisão de segurança, o `hash_atual` e, por
  item, `dias_uteis_na_fila` (até agora, ou até a decisão no histórico), `atrasado` (só pedido aguardando que
  estourou o prazo), `pode_chancelar` (o usuário atual tem verificação, área e perfil para o item; `false` no
  histórico) e `motivo_nao_pode` (texto curto em pt-BR quando `false`). Os atrasados vêm primeiro.
- `chancelar_plano_cliente(id, conteudo?, justificativa?, nota_publica?)` exige, nesta ordem: equipe científica;
  nutrição ligada, se o plano é de nutrição (vale para todos, inclusive o super-admin); perfil **verificado** (o
  super-admin dispensa); a área do plano em `equipe_areas` **e** o perfil da área — treino: `educador_fisico` ou
  `fisioterapeuta`; nutrição: `nutricionista` (o super-admin atua em qualquer área como exceção de teste, carimbo
  `por_perfil = 'super_admin'` fora do perfil dele); ausência de conflito de interesse; e a **revisão de segurança
  do conteúdo atual**. Erros com HINT: `sem_permissao_area`, `nutricao_desligada`, `nao_verificado`,
  `conflito_interesse`, `revisao_obrigatoria`, `justificativa_obrigatoria`. Carimba
  `conteudo._governanca.aprovacao = { por_user_id, por_nome, por_perfil, em, versao, hash, justificativa?,
  risco_geral | sem_revisao + motivo_sem_revisao, risco_anterior_desatualizado?, autochancela? }`; o chancelado
  anterior vira `substituido`. `versao` conta as chancelas do paciente e tipo (a primeira é v1).
- **Revisão obrigatória**: sem revisão válida para o conteúdo atual (hash igual) só chancela com
  `p_justificativa` de **15+ caracteres**; nesse caso o carimbo marca `sem_revisao: true` e
  `motivo_sem_revisao` (a justificativa). **Revisão parcial** (plano maior que o limite da IA, `plano_truncado`:
  só o início foi lido) não vale como completa: exige a mesma justificativa (HINT `revisao_obrigatoria`) e o
  carimbo registra `revisao_parcial: true` com o `risco_geral` da parte lida; a fila devolve `plano_truncado` em
  `revisao_seguranca` e a janela de chancela avisa o revisor. O cliente nunca vê isso (`gov_publico`). Risco `alto` continua exigindo justificativa de 15+, **inclusive quando o
  plano foi editado depois da revisão** (editar não apaga o alerta; o carimbo traz `risco_anterior_desatualizado: 'alto'`).
  Vale para os planos do **cliente**; os planos criados pelo profissional seguem com a revisão opcional.
- **Conflito de interesse e autochancela**: quem não é o super-admin não chancela nem recusa o plano gerado para
  a **própria conta**. O super-admin pode chancelar o plano da própria conta (exceção de teste, carimbo
  `autochancela: true`, que o selo do portal e do PDF mostram) **somente enquanto não existir outro membro da
  equipe científica verificado**; quando existir, a exceção some sozinha. Ele pode sempre recusar. A checagem de
  conflito é pela conta (`pacientes.user_id`): quem usa um segundo login para gerar o próprio plano não é
  detectado (identidade totalmente distinta não é detectável); o controle é a verificação manual do profissional
  e o carimbo, que guarda `por_user_id`.
- `recusar_plano_cliente(id, nota_publica, nota_interna?)`: a nota pública é obrigatória e é o que o cliente lê; a
  interna só a equipe. Exige equipe e perfil verificado (o super-admin dispensa), mas não área: recusar é o lado seguro.
- A equipe pode editar `titulo`, `conteudo` e `nota_interna` direto na tabela, só enquanto o plano
  está `aguardando`; `_governanca` (carimbo, revisão, triagem) é sempre preservada pelo banco. Editar
  `titulo`/`conteudo` exige o mesmo que chancelar a área (`equipe_cobre_area`: verificado, área habilitada e perfil
  da área; super-admin qualquer uma); qualquer membro continua podendo escrever a `nota_interna`. A fila
  (`fila_chancela`) devolve até 200 planos aguardando e, no histórico, os 50 mais recentes.
- Revisão de segurança: `revisar-plano-seguranca` aceita `{ "tabela": "plano_cliente_chancela",
  "plano_id": "<uuid>" }`. O banco confere com o JWT de quem chama (`eh_equipe_cientifica`), só
  revisa plano `aguardando`, usa só o contexto que o cliente informou e grava a revisão presa ao
  hash do conteúdo (`registrar_revisao_plano` aceita a tabela nova).
- **Configuração**: `plano_cliente_config(chave, valor jsonb)` com `nutricao_premium_ativa` (padrão `false`) e
  `prazo_chancela_dias_uteis` (padrão `2`). Lida por qualquer usuário logado em `plano_cliente_config()`
  (`{ nutricao_premium_ativa, prazo_chancela_dias_uteis }`; valor ausente ou torto cai no padrão seguro); escrita
  só por `definir_config_plano_cliente(chave, valor)` (super-admin; booleano ou inteiro de 1 a 10).
- **Aviso ao cliente**: a edge `notificar-plano-cliente` (`POST { plano_id }` → `{ ok, enviado, motivo? }`) é chamada
  pela fila depois de chancelar ou recusar. O chamador precisa ser da equipe (`eh_equipe_cientifica` com o JWT dele).
  Manda um WhatsApp curto e sem conteúdo clínico (nem o recado da recusa) só para cliente cadastrado (com conta) e
  ativo (`pacientes.ativo = true`, como as outras automações), com telefone, em até 48 horas da decisão, uma vez por plano (`agente_disparos`, gatilhos `plano_chancelado`
  e `plano_recusado`). A linha do disparo é **reservada antes do envio** (`status = 'reservado'`, índice único parcial
  `agente_disparos_aviso_plano_unico`), então chamadas paralelas não duplicam a mensagem; falha de envio vira
  `erro` e libera nova tentativa. Só o revisor que decidiu o plano ou o administrador pedem o aviso. Usa
  `enviarWhatsapp` (respeita a pausa geral das automações) e registra a saída na conversa do Zap
  (`registrarMensagemSaida`). Sai **sempre pela conta da marca** (administrador, `plano_cliente_remetente_aviso`),
  nunca pelo profissional gravado no cadastro: o cliente edita `terapeuta_id`, `telefone` e `nome` do próprio
  cadastro, e usar o profissional dali deixaria um cliente disparar mensagem pelo WhatsApp de outro profissional.
  O primeiro nome só entra no texto se parecer um nome (letras, apóstrofo e hífen, até 30); senão sai "Oi!".
  Limite que permanece: o telefone é o do cadastro, que o cliente edita; o texto é fixo, sem link, e sai uma única
  vez por plano decidido. Best-effort: sem WhatsApp configurado simplesmente não sai e o portal continua
  mostrando o status. Motivos de não envio: `plano_nao_decidido`, `fora_da_janela`, `cliente_inativo`,
  `cliente_sem_conta`, `sem_telefone`, `sem_remetente`, `ja_notificado`, `whatsapp_nao_enviado`,
  `verificacao_indisponivel`. Lógica pura em `supabase/functions/_shared/aviso-plano-cliente.ts`.

### O que o cliente enxerga

- `meu_status_plano_cliente(tipo)` → `{ status: aguardando | chancelado | recusado | cancelado | null,
  gerado_em, nota_publica, prazo_previsto, atrasado, pode_regenerar }` do registro mais recente. **Nunca** devolve o
  conteúdo. `prazo_previsto` e `atrasado` só valem para o pedido aguardando; `pode_regenerar` é `true` quando o status
  não é `aguardando` ou o pedido estourou o prazo.
- `meu_plano_liberado(tipo)` → o plano **liberado do profissional** (`origem: "profissional"`),
  se houver; senão o **chancelado** mais recente (`origem: "equipe_myhealthid"`). O conteúdo
  passa por `gov_publico`, que remove triagem, revisão de segurança e justificativa e deixa
  `aprovacao.por_nome`, `por_perfil`, `em`, `versao` e `autochancela` (o selo termina com "Autochancela (teste
  interno)"). Com `nutricao_premium_ativa = false`, **nenhum plano nutricional da equipe** chega ao cliente, nem os
  já chancelados antes de a chave ser desligada (voltam quando ela é religada); o plano alimentar liberado pelo
  profissional do paciente não é afetado.

### Limites conhecidos

- **`pacientes.tipo_conta` só vira `wellness_premium` pelo servidor.** A RLS de `pacientes` deixa o
  cliente editar o próprio cadastro (sem limite de coluna) e qualquer usuário inserir uma linha com
  `terapeuta_id` = ele mesmo. O gatilho `pacientes_protege_tipo_conta` fecha isso para qualquer usuário
  logado, em INSERT e UPDATE: só o `service_role` (pagamento, `wellness-pagamento`) e o super-admin gravam
  `wellness_premium`; o cliente também não troca o tipo da própria conta nem se atribui como terapeuta.
  Consequência: **profissional não concede Premium ao paciente pela API** (não há esse fluxo no app; se
  virar necessário, deve passar por uma função própria). Validado em Postgres descartável com as policies
  reais (2 passos, 4 passos e INSERT). Defesa em profundidade que NÃO foi aplicada: exigir também uma linha
  ativa em `wellness_assinaturas`, porque contas Premium concedidas à mão podem não ter assinatura (decisão
  do Rafael).
- **Gerar tem um plano por vez na fila**, por tipo, e um teto de **3 pedidos por tipo em 24 horas**. Cancelar o
  pedido libera o seguinte na hora, então sem o teto o ciclo gerar-cancelar gastaria IA sem fim. Nova geração só
  depois de o anterior ser chancelado, recusado ou cancelado pelo cliente, ou de o pedido estourar o prazo da
  equipe (então o novo substitui o parado), sempre dentro do teto. O Guardião de custo `monitor-ia-uso`
  acompanha o total. Quem cancelou e quando: o cancelamento só existe pela conta do próprio cliente e o banco
  atualiza `updated_at` do pedido.
- **Caminho do profissional exige verificação** (era autodeclarado). Quem grava `profiles.perfil_profissional`
  no próprio perfil e insere um `pacientes` com `terapeuta_id` = ele mesmo e sem `user_id` ainda é
  classificado como `profissional`, mas agora recebe 403 `profissional_nao_verificado` enquanto o administrador
  não o verificar (`profiles.verificado`, que ninguém além do super-admin altera). O que permanece: um
  profissional **verificado** continua gerando direto, sem Premium e sem chancela, e com o `override` da
  triagem (é o fluxo dele). Mitigação ainda possível, dependente de decisão do Rafael: tratar como cliente
  quando o paciente alvo não tem nenhum atendimento registrado.
- **Verificação é manual**: o sistema guarda o registro informado e quem verificou, mas não consulta o conselho
  profissional; a conferência (CREF, CREFITO, CRN) é do administrador, na tela de administração. O botão
  "Pesquisar" (seção "Pesquisa automática de profissionais", abaixo) só traz um INDÍCIO para ajudar nessa
  conferência: ele nunca verifica ninguém.
- **Atraso não escala sozinho**: `atrasado` aparece na fila e libera o cliente a pedir de novo, mas ninguém é
  avisado do atraso. O prazo conta só seg–sex; feriados não entram.
- **Aviso por WhatsApp depende da configuração do remetente**: o aviso sai sempre pela conta da marca
  (administrador). Se essa conta não tem WhatsApp configurado,
  em pausa de automações ou (Meta) fora da janela de 24h sem modelo aprovado, o aviso não sai; o cliente vê o
  status ao abrir o portal.

## Pesquisa automática de profissionais

Decisão do Rafael (11/10/2026): na aba Administração, cada profissional cadastrado tem um botão **Pesquisar**, que
faz uma pesquisa na internet pelo nosso app para ajudar na verificação. Limites combinados com ele:

1. A pesquisa **nunca verifica ninguém sozinha**. É só INDÍCIO; verificar continua sendo um clique do administrador
   (`verificar_profissional`, que a pesquisa não chama nem altera).
2. Só informação **profissional pública**. Nada da vida pessoal, família, endereço, saúde, processos, opinião
   política ou religiosa, nem qualquer dado sensível.
3. Consulta de conselho muitas vezes tem captcha. Quando não for possível consultar, o app diz "Não consegui
   consultar automaticamente" e entrega o atalho para a consulta oficial.
4. Nenhuma URL de consulta de conselho é escrita no código. O app oferece atalhos de busca montados com o nome e o
   registro e o NOME do conselho esperado; as URLs de fontes são só as que vieram validadas da busca.
5. Tudo fica registrado: quem pesquisou, quando, o que a busca usou e o resultado.

Código: `supabase/functions/pesquisar-profissional/index.ts` (rede, banco, leitura de páginas) e
`supabase/functions/_shared/pesquisa-profissional.ts` (lógica pura). Migration:
`supabase/migrations/20261011000000_pesquisa_profissional.sql`. Tela: `src/components/chancela/PesquisaProfissionalPainel.tsx`
(dentro de `ProfissionalAdminCard`), `src/lib/pesquisaProfissional.ts` (leitura e rótulos) e
`src/lib/pesquisaProfissionalApi.ts` (chamadas). Testes: `npx vitest run src/test/pesquisaProfissional.test.ts
src/test/migracaoPesquisaProfissional.test.ts src/test/pesquisaProfissionalLib.test.ts
src/test/pesquisaProfissionalApi.test.ts src/test/pesquisaProfissionalPainel.test.tsx`.

### Escopo e consulta

A consulta usa **somente**: nome completo (`nome` + `sobrenome`), profissão (`perfil_profissional`), registro
(`registro_profissional`, ou o `crefito` do cadastro se estiver vazio) e, se houver, cidade/UF da clínica
(`config_clinica`, só como desempate de homônimos; entra apenas se cidade e UF forem válidas). **Nunca** e-mail nem
telefone: a função que monta a consulta nem recebe esses campos, e o banco rejeita qualquer chave fora de
`nome, registro, profissao, conselho_esperado, cidade, uf` em `consulta_usada`.

O nome e o registro são digitados pelo próprio profissional, então passam por filtros antes de entrar no prompt, na
tela e no Google. **Os filtros reduzem a superfície, não a eliminam:** a defesa que vale é o servidor recalcular o nível
e exigir trecho literal da página.

- Nome: só letras, espaço, apóstrofo, ponto e hífen (até 100 caracteres), no máximo 8 palavras de até 30 letras; um nome
  que casa com os padrões de "ordem para a IA" ("ignore as instruções...", "responda compatível...") não é pesquisado
  (a resposta é `sem_registro`). Uma frase curta em letras que não case com esses padrões ainda passa.
- Registro: só passa com **formato de registro**: dígitos (no máximo 10) mais siglas de conselho, UF, letras soltas de
  sufixo e palavras como "registro" ou "nº" (no máximo 4 palavras, 40 caracteres). Qualquer outra palavra, telefone, CPF
  ou e-mail faz o cadastro valer como "sem registro reconhecível": ele não vai à IA nem é gravado, e o resumo diz que o
  formato não é reconhecido.

Conselho esperado pela profissão (`CONSELHO_POR_PROFISSAO`):

| Profissão | Conselho |
|---|---|
| Fisioterapeuta, Terapeuta ocupacional | CREFITO |
| Educador físico | CREF |
| Nutricionista | CRN |
| Médico | CRM |
| Psicólogo | CRP |
| Dentista | CRO |

Categorias de achado aceitas (qualquer outra é descartada): `registro_conselho`, `situacao_registro`, `formacao`,
`atuacao_profissional`, `perfil_publico`.

### Como funciona

1. O front chama a edge com `{ user_id }`. A edge exige o JWT do chamador e confere `eh_super_admin()` no banco com
   esse JWT; **qualquer falha é 403** (fail-closed).
2. Lê o perfil pelo `service_role`, monta a consulta e confere os limites (`pesquisa_profissional_pode_pesquisar`). Sem
   nome e sobrenome não há o que pesquisar (`sem_registro`); sem número de registro a pesquisa acontece, mas o nível
   máximo é "inconclusivo".
3. Chama o Gemini com a ferramenta `google_search` (mesmo padrão de `buscar-ficha-aparelho`; chave `GEMINI_API_KEY`,
   modelo `GEMINI_MODEL_BUSCA`, padrão `gemini-2.5-flash`; opcional `PESQUISA_DOMINIOS_OFICIAIS`, ver "Limites conhecidos"). O prompt proíbe tudo fora do escopo profissional, exige
   trecho literal e URL para cada achado e manda tratar o conteúdo das páginas como **dado não confiável**
   (risco de prompt injection).
4. O Gemini só devolve, como fontes, links de redirecionamento e títulos, não o texto das páginas. Por isso a edge
   **lê as páginas aterradas** (até 6): segue o redirecionamento até a página real, só https, sem IP nem host interno
   (o host é normalizado sem o ponto final, então `localhost.` e `servico.internal.` também são barrados), limite de 600 KB
   por página, 20 s no total, identificando-se como `MyHealthID-ConferenciaProfissional`. O DNS é conferido a cada salto e
   **fecha em falha**: sem `Deno.resolveDns` no runtime, com erro de DNS ou sem nenhum endereço público, a página não é
   lida. Página que é captcha, login ou erro conta como "não lida".
5. O **servidor valida e descarta**. Um achado só passa se: tem categoria do escopo; tem trecho (20 a 300 caracteres);
   a `fonte_url` é https, tem até 2000 caracteres (URL maior é descartada, nunca cortada) e é uma das páginas aterradas;
   o trecho consta, literalmente (sem diferenciar caixa, acento ou espaços), no texto dessa página; o trecho não casa
   com a **lista de bloqueio** (e-mail, CPF, telefone com ou sem espaços, endereço, processo, sanção disciplinar,
   prisão ou acusação, saúde, religião, política, nascimento, morte, família) nem parece ordem ao modelo ("ignore as
   instruções anteriores", "marque como verificado"); e passa pela **lista de permissão**: fala de assunto profissional
   da categoria (sigla de conselho, formação, atuação, Lattes...) e, em `formacao`, `atuacao_profissional` e
   `perfil_publico`, traz o nome da pessoa (para um homônimo não entrar). Um `registro_conselho` ainda precisa citar um
   conselho ou o número do cadastro. As duas listas são camadas de redução de risco, **não uma garantia**: uma
   formulação que nenhum padrão reconheça pode passar. O que passa grava a URL da página aterrada.
   **Nenhum texto escrito pelo modelo é gravado nem exibido:** a descrição (`texto`) de cada achado é sempre escrita pelo
   servidor (frase padrão da categoria; no `registro_conselho`, a frase sobre nome, número e conselho). O título da
   fonte só entra se não trouxer e-mail, telefone, dado fora do escopo nem ordem ao modelo; senão vale o endereço do site.
6. O **nível e o resumo são calculados pelo servidor** a partir dos achados validados (regras em "Níveis do indício").
   O que o modelo disser sobre nível ou resumo é ignorado, e o `nome_na_fonte` que ele aponta só vale depois de o
   servidor conferir que tem forma de nome de pessoa e está, no trecho, ao lado do registro.
7. Grava em `profissional_pesquisas` (`registrar_pesquisa_profissional`), inclusive as falhas, com `erro`. Sem
   conseguir gravar, não há resposta (a trilha de auditoria não é opcional).

### Na tela (aba Administração)

- Cada profissional (exceto a conta do administrador) tem o painel "Pesquisa na internet". Sem pesquisa anterior, o
  botão é **Pesquisar na internet**; com pesquisa, o cartão mostra o selo do último nível (vem de
  `pesquisas_profissionais_resumo`, uma chamada para a lista toda) e **Ver pesquisa**; **Pesquisar de novo** fica dentro
  do painel aberto, para não gastar uma busca por clique acidental.
- O painel mostra o selo (ícone e texto, nunca só cor), o resumo escrito pelo servidor, cada achado com categoria,
  trecho entre aspas e link da fonte (abre em nova aba, `noopener noreferrer`; o texto do link é **sempre o endereço do
  site**, nunca o título que a busca ou a página deram), data e hora de Brasília e o aviso fixo:
  "Isto é um indício encontrado na internet. Pode estar incompleto ou errado. A verificação é decisão sua."
- "Conferir no conselho": nome do conselho esperado pela profissão e um link de busca no Google montado com nome,
  profissão, registro e a palavra "conselho" (nada de URL de conselho no código; o e-mail nunca entra). Quando o nível é
  `nao_consultavel`, a tela mostra "Não consegui consultar automaticamente" e destaca esse atalho.
- A tela repete as checagens baratas do servidor: achado sem trecho, sem fonte https ou de categoria fora da lista não
  aparece, e um "compatível" sem nenhum achado de registro exibível é mostrado como "inconclusivo".
- O rótulo da aba vira "Administração (N)", com N = profissionais com registro informado e ainda não verificados,
  **sem contar a conta do administrador** (para ela não há botão Verificar).
- A pesquisa **não chama `verificar_profissional`** e não muda o botão Verificar.

### Níveis do indício e como interpretar

O registro só conta quando o **número do cadastro está colado a uma sigla de conselho** (até 50 caracteres, ligados só
por região, UF e palavras de registro, de campo ou de profissão, como "inscrição", "nº" ou "fisioterapeuta": "atende na
Sala 12345" ao lado de "CREFITO" não é registro) e o **nome do
cadastro está ao lado desse registro** (as palavras logo antes e logo depois, até o fim da frase, de uma linha de lista
ou de outro número ou sigla): numa lista de várias pessoas, o nome de uma não se junta ao número de outra. O nome
compatível é o primeiro nome do cadastro mais outro nome, como palavras inteiras.

| Nível | Calculado quando | Como ler |
|---|---|---|
| `compativel` | Há achado `registro_conselho` com o **número informado** (4 dígitos ou mais, grupo inteiro) colado ao **conselho esperado**, o **nome ao lado**, a **mesma região** (CREFITO-3 x CREFITO-4, UF; quando a fonte não mostra a região, não bloqueia) e **nenhuma situação de atenção**: nem no trecho, nem em outro achado de situação do registro, nem na página, até 300 caracteres em torno do número. Com `PESQUISA_DOMINIOS_OFICIAIS` configurada, a fonte também precisa ser de um desses sites | Uma página pública diz o mesmo que o cadastro. **Não é uma verificação:** a página pode ser de terceiros ou até falsa, e o resumo cita o endereço do site e avisa isso. Confira a fonte. |
| `divergente` | Uma fonte aterrada mostra o número do cadastro, no conselho esperado e na mesma região, para **outro nome** (conferido no trecho, ao lado do registro, com forma de nome de pessoa); ou o mesmo nome e número em **outro conselho** (outra profissão). Vale mais que `compativel` | Merece olhar com atenção, mas pode ser homônimo ou erro da fonte. |
| `inconclusivo` | Há achados, mas nenhum fecha nome + número + conselho + região; ou a fonte cita o registro com **situação de atenção**; ou a fonte é de um site que não está na lista de oficiais; ou o cadastro não pode ser comparado (sem registro, registro em formato não reconhecido, número com menos de 4 dígitos, profissão sem conselho conhecido: **o máximo possível**) | Há informação profissional pública, mas não confirma o registro. Mesmo nome e número em **outra região** do conselho também cai aqui (pode ser outro registro da mesma pessoa ou homônimo). |
| `nao_encontrado` | Nenhum achado validado (e há páginas lidas, ou nenhuma fonte) | Não achei nada. **Não** significa que o registro não existe: use o atalho da consulta oficial. |
| `nao_consultavel` | A busca falhou ou foi bloqueada, ou só havia páginas que não foi possível ler (captcha, login), ou a pesquisa foi interrompida no meio | "Não consegui consultar automaticamente": use o atalho para a consulta oficial. |

**Situação de atenção** é qualquer termo como cancelado, suspenso, inativo, irregular, baixado, cassado, vencido,
expirado, impedido, licenciado, provisório, afastado, falecido, em dívida ou "não regular", ou um "Situação: X" em que X
não seja claramente positivo (ativo, regular, regularizado, habilitado, vigente, em dia). Basta uma dessas palavras
perto do número para o `compativel` virar `inconclusivo`.

### Resposta da edge function

Quando não pode gerar, a resposta é HTTP 200:

```json
{
  "ok": false,
  "bloqueio": {
    "nivel": "bloqueia",
    "motivos": [{ "codigo": "gestante_lactante", "rotulo": "...", "detalhe": "...", "origem": "triagem_autodeclarada", "nivel": "bloqueia" }],
    "dadosAusentes": [],
    "pode_prosseguir_profissional": true
  }
}
```

Quando pode gerar, a resposta depende de quem chamou:

- **Profissional**: `{ "ok": true, "plano": { ... } }` (a de treino acrescenta `usou_banco`).
  Ele edita e libera pelo fluxo de sempre.
- **Cliente Premium**: o servidor grava o plano na fila de chancela e responde
  `{ "ok": true, "em_revisao": true, "plano_id": "<uuid>" }`, **sem o conteúdo do plano**.
  Se a gravação falhar a resposta é erro HTTP 500 (nunca finge sucesso nem entrega o
  plano sem chancela). Sem Premium: HTTP 402 `{ "error": "...", "codigo": "premium_necessario" }`.
  Com plano do mesmo tipo já aguardando a equipe: HTTP 409 `{ "error": "...", "codigo": "plano_em_revisao" }`
  (checado ANTES de gastar IA; se a fila não puder ser consultada, HTTP 503). O portal já desliga o
  botão nesse estado; o 409 cobre outra aba, estado velho e chamada direta à edge.

Erros novos do pacote de segurança (decisões de 08/10/2026), todos antes de gastar IA:

| HTTP | `codigo` | Quando |
|---|---|---|
| 403 | `nutricao_em_breve` | Cliente pede plano alimentar com `nutricao_premium_ativa` desligada (`{ "error": "O plano nutricional Premium estará disponível em breve.", "codigo": "nutricao_em_breve" }`). Vale antes de olhar Premium ou a fila; o profissional não é afetado |
| 403 | `profissional_nao_verificado` | Profissional que ainda não foi verificado pelo administrador (`{ "error": "Seu perfil profissional ainda não foi verificado pela equipe MyHealthID", "codigo": "profissional_nao_verificado" }`) |
| 409 | `plano_em_revisao` | Cliente com pedido do mesmo tipo aguardando **dentro do prazo** da equipe. Pedido que estourou o prazo não barra: o banco o marca `substituido` ao gravar o novo |
| 503 | — | Não deu para ler a configuração, o pedido ou a verificação (nunca "sem dados = liberado") |

Para prosseguir, o profissional reenvia o mesmo pedido com:

```json
{ "override": { "justificativa": "texto com 15 caracteres ou mais", "ciente": true } }
```

`bloqueia` exige a justificativa; `confirmar` exige `ciente: true`. Se o override
foi enviado mas não bastou, o `bloqueio` vem com `override_recusado`
(`justificativa_curta` ou `ciente_ausente`). O override usado fica registrado em
`plano._governanca.triagem.override` (com data e hora).

Cliente com texto livre que acionou uma regra **não** recebe o trecho do texto
(pode ser anotação de profissional): o `detalhe` é genérico. O profissional vê o
termo encontrado.

## Cliente Premium e a chancela da equipe científica

Decisão do Rafael (08/10/2026): o cliente **só gera se pagar** (Premium), **só com o que é
dele**, e o plano **só chega a ele depois de chancelado** pela equipe científica MyHealthID.
O profissional do paciente continua criando, editando e liberando planos pelo fluxo atual
(`planos_treino` / `planos_alimentares` + `liberar_plano`). Visão de produto em
`docs/fluxo-cliente-e-tiers.md`.

### Insumos do plano do cliente

O prompt do cliente usa **apenas**: MyID, questionários clínicos, histórico clínico
(`historico_clinico`), queixa e história atual, medicamentos/alergias/condições do cadastro,
triagem autodeclarada e anamnese nutricional (esta só no plano alimentar). **Não entram**:
achados e notas da avaliação presencial, exames do profissional (bioimpedância,
`exames_presenciais`), avaliação por voz, e do corpo do pedido a antropometria, os testes
funcionais e o recordatório (do cliente não se aceitam). Implementação:
`restringirAInsumosDoCliente`, `dadosDoPedido` e `insumosDoPlano` em `_shared/plano-cliente.ts`;
`carregarMotoresClinicos(admin, id, { apenasInsumosDoCliente: true })` faz o mesmo filtro no
carregamento. A lista permitida está em `POLITICA_PLANO_CLIENTE.insumosDoCliente`, e
`_governanca.fonte.insumos` registra só o que de fato entrou.

A triagem de segurança **continua lendo os motores completos** (inclusive as notas do
profissional): uma nota "gestante" do profissional ainda bloqueia o cliente, mesmo que o
texto não vá para o prompt. O `detalhe` mostrado ao cliente segue genérico.

### Fila de chancela

- Tabela `plano_cliente_chancela` (RLS ligado, policy só para a equipe científica). O servidor
  grava com `registrar_plano_cliente_chancela` (só `service_role`): o novo plano entra como
  `aguardando`. Enquanto já existe um `aguardando` do mesmo paciente e tipo **dentro do prazo** a gravação é
  recusada (`plano_em_revisao`): gerar de novo não tira da fila, nem de baixo das mãos do revisor, um plano que a
  equipe está lendo ou editando, e cada geração custa uma chamada de IA. Se o `aguardando` **estourou o prazo**,
  o novo pedido entra e o parado vira `substituido`. O `chancelado` atual segue visível ao cliente até o novo ser chancelado.
  **Teto de pedidos**: no máximo **3 pedidos por paciente e tipo em 24 horas**, contando todos (decididos, cancelados
  e substituídos); passou disso, a edge responde 429 `limite_pedidos` antes de gastar IA (`plano_cliente_estado_pedido`
  devolve `limite`) e o banco repete a checagem ao gravar (corrida entre duas gerações). O pedido aguardando no prazo
  continua tendo precedência (409). O número está em `plano_cliente_limite_pedidos_24h()` (valor provisório; mudar
  exige nova migration).
- Status: `aguardando`, `chancelado`, `recusado`, `substituido` e `cancelado` (o cliente cancelou o próprio pedido
  aguardando, `cancelar_pedido_plano_cliente(tipo)`; só cancela o **seu** aguardando).
- **Prazo**: `plano_cliente_config.prazo_chancela_dias_uteis` (padrão 2, de 1 a 10), em dias úteis (seg–sex, sem
  feriados, calendário de Brasília). `dias_uteis_entre(a, b)` conta os dias úteis em (dia de `a`, dia de `b`]: sexta
  17h até segunda 09h = 1; sábado e domingo não contam. O prazo vence às 23:59:59 do N-ésimo dia útil depois do dia
  em que o pedido foi gerado (`plano_cliente_prazo_ate`); `atrasado` = passou desse instante. As duas funções são
  internas (só as RPCs do banco as chamam; usuário logado não tem EXECUTE) e limitadas: 10 anos de intervalo em
  `dias_uteis_entre`, prazo de 1 a 10 dias em `plano_cliente_prazo_ate`.
- Equipe: `profiles.equipe_cientifica` (flag mantida pelo super-admin) com `profiles.equipe_areas`
  (`treino`, `nutricao`); `definir_equipe_cientifica(email, ativo, areas)` — **ativar exige o profissional
  verificado**. `eh_equipe_cientifica()` diz se quem chama é da equipe. A assinatura antiga
  `definir_equipe_cientifica(email, valor)` ficou como atalho (delega à nova com as áreas do perfil do alvo); a
  chamada posicional de 2 argumentos é ambígua entre as duas, então use 3 argumentos ou nomeie `p_ativo`.
- Verificação: `solicitar_verificacao(registro)` (o próprio profissional, 3 a 40 caracteres, não verifica),
  `verificar_profissional(user_id, verificado, nota?, registro_visto?)` e `profissionais_admin()` (só o super-admin;
  exceção `Apenas o administrador MyHealthID` para os outros). A tela envia em `registro_visto` o registro que o
  administrador conferiu; se o profissional o trocou antes do clique, o banco recusa com HINT `registro_alterado`
  (a lista recarrega) em vez de verificar um registro que ninguém viu. Um gatilho em `profiles` impede qualquer outra pessoa de
  mudar `verificado`, `verificado_em`, `verificado_por` e `equipe_areas`; trocar o registro ou a profissão de
  quem estava verificado derruba a verificação e a vaga na equipe. Histórico em `profissional_verificacao_log`.
  **Equipe implica verificado**: quem já estava marcado como equipe antes desta migration (designado pelo atalho
  antigo) e não é verificado perde `equipe_cientifica` e as áreas na própria migration (fica no log, origem
  `migracao`); ninguém é verificado por ela, só a conta do administrador. O administrador verifica o registro na
  tela e designa de novo.
- `fila_chancela(status)` (só equipe; aceita `aguardando|chancelado|recusado|cancelado|substituido`) lista a fila
  com **primeiro nome e idade** do paciente, o conteúdo, um resumo da revisão de segurança, o `hash_atual` e, por
  item, `dias_uteis_na_fila` (até agora, ou até a decisão no histórico), `atrasado` (só pedido aguardando que
  estourou o prazo), `pode_chancelar` (o usuário atual tem verificação, área e perfil para o item; `false` no
  histórico) e `motivo_nao_pode` (texto curto em pt-BR quando `false`). Os atrasados vêm primeiro.
- `chancelar_plano_cliente(id, conteudo?, justificativa?, nota_publica?)` exige, nesta ordem: equipe científica;
  nutrição ligada, se o plano é de nutrição (vale para todos, inclusive o super-admin); perfil **verificado** (o
  super-admin dispensa); a área do plano em `equipe_areas` **e** o perfil da área — treino: `educador_fisico` ou
  `fisioterapeuta`; nutrição: `nutricionista` (o super-admin atua em qualquer área como exceção de teste, carimbo
  `por_perfil = 'super_admin'` fora do perfil dele); ausência de conflito de interesse; e a **revisão de segurança
  do conteúdo atual**. Erros com HINT: `sem_permissao_area`, `nutricao_desligada`, `nao_verificado`,
  `conflito_interesse`, `revisao_obrigatoria`, `justificativa_obrigatoria`. Carimba
  `conteudo._governanca.aprovacao = { por_user_id, por_nome, por_perfil, em, versao, hash, justificativa?,
  risco_geral | sem_revisao + motivo_sem_revisao, risco_anterior_desatualizado?, autochancela? }`; o chancelado
  anterior vira `substituido`. `versao` conta as chancelas do paciente e tipo (a primeira é v1).
- **Revisão obrigatória**: sem revisão válida para o conteúdo atual (hash igual) só chancela com
  `p_justificativa` de **15+ caracteres**; nesse caso o carimbo marca `sem_revisao: true` e
  `motivo_sem_revisao` (a justificativa). **Revisão parcial** (plano maior que o limite da IA, `plano_truncado`:
  só o início foi lido) não vale como completa: exige a mesma justificativa (HINT `revisao_obrigatoria`) e o
  carimbo registra `revisao_parcial: true` com o `risco_geral` da parte lida; a fila devolve `plano_truncado` em
  `revisao_seguranca` e a janela de chancela avisa o revisor. O cliente nunca vê isso (`gov_publico`). Risco `alto` continua exigindo justificativa de 15+, **inclusive quando o
  plano foi editado depois da revisão** (editar não apaga o alerta; o carimbo traz `risco_anterior_desatualizado: 'alto'`).
  Vale para os planos do **cliente**; os planos criados pelo profissional seguem com a revisão opcional.
- **Conflito de interesse e autochancela**: quem não é o super-admin não chancela nem recusa o plano gerado para
  a **própria conta**. O super-admin pode chancelar o plano da própria conta (exceção de teste, carimbo
  `autochancela: true`, que o selo do portal e do PDF mostram) **somente enquanto não existir outro membro da
  equipe científica verificado**; quando existir, a exceção some sozinha. Ele pode sempre recusar. A checagem de
  conflito é pela conta (`pacientes.user_id`): quem usa um segundo login para gerar o próprio plano não é
  detectado (identidade totalmente distinta não é detectável); o controle é a verificação manual do profissional
  e o carimbo, que guarda `por_user_id`.
- `recusar_plano_cliente(id, nota_publica, nota_interna?)`: a nota pública é obrigatória e é o que o cliente lê; a
  interna só a equipe. Exige equipe e perfil verificado (o super-admin dispensa), mas não área: recusar é o lado seguro.
- A equipe pode editar `titulo`, `conteudo` e `nota_interna` direto na tabela, só enquanto o plano
  está `aguardando`; `_governanca` (carimbo, revisão, triagem) é sempre preservada pelo banco. Editar
  `titulo`/`conteudo` exige o mesmo que chancelar a área (`equipe_cobre_area`: verificado, área habilitada e perfil
  da área; super-admin qualquer uma); qualquer membro continua podendo escrever a `nota_interna`. A fila
  (`fila_chancela`) devolve até 200 planos aguardando e, no histórico, os 50 mais recentes.
- Revisão de segurança: `revisar-plano-seguranca` aceita `{ "tabela": "plano_cliente_chancela",
  "plano_id": "<uuid>" }`. O banco confere com o JWT de quem chama (`eh_equipe_cientifica`), só
  revisa plano `aguardando`, usa só o contexto que o cliente informou e grava a revisão presa ao
  hash do conteúdo (`registrar_revisao_plano` aceita a tabela nova).
- **Configuração**: `plano_cliente_config(chave, valor jsonb)` com `nutricao_premium_ativa` (padrão `false`) e
  `prazo_chancela_dias_uteis` (padrão `2`). Lida por qualquer usuário logado em `plano_cliente_config()`
  (`{ nutricao_premium_ativa, prazo_chancela_dias_uteis }`; valor ausente ou torto cai no padrão seguro); escrita
  só por `definir_config_plano_cliente(chave, valor)` (super-admin; booleano ou inteiro de 1 a 10).
- **Aviso ao cliente**: a edge `notificar-plano-cliente` (`POST { plano_id }` → `{ ok, enviado, motivo? }`) é chamada
  pela fila depois de chancelar ou recusar. O chamador precisa ser da equipe (`eh_equipe_cientifica` com o JWT dele).
  Manda um WhatsApp curto e sem conteúdo clínico (nem o recado da recusa) só para cliente cadastrado (com conta) e
  ativo (`pacientes.ativo = true`, como as outras automações), com telefone, em até 48 horas da decisão, uma vez por plano (`agente_disparos`, gatilhos `plano_chancelado`
  e `plano_recusado`). A linha do disparo é **reservada antes do envio** (`status = 'reservado'`, índice único parcial
  `agente_disparos_aviso_plano_unico`), então chamadas paralelas não duplicam a mensagem; falha de envio vira
  `erro` e libera nova tentativa. Só o revisor que decidiu o plano ou o administrador pedem o aviso. Usa
  `enviarWhatsapp` (respeita a pausa geral das automações) e registra a saída na conversa do Zap
  (`registrarMensagemSaida`). Sai **sempre pela conta da marca** (administrador, `plano_cliente_remetente_aviso`),
  nunca pelo profissional gravado no cadastro: o cliente edita `terapeuta_id`, `telefone` e `nome` do próprio
  cadastro, e usar o profissional dali deixaria um cliente disparar mensagem pelo WhatsApp de outro profissional.
  O primeiro nome só entra no texto se parecer um nome (letras, apóstrofo e hífen, até 30); senão sai "Oi!".
  Limite que permanece: o telefone é o do cadastro, que o cliente edita; o texto é fixo, sem link, e sai uma única
  vez por plano decidido. Best-effort: sem WhatsApp configurado simplesmente não sai e o portal continua
  mostrando o status. Motivos de não envio: `plano_nao_decidido`, `fora_da_janela`, `cliente_inativo`,
  `cliente_sem_conta`, `sem_telefone`, `sem_remetente`, `ja_notificado`, `whatsapp_nao_enviado`,
  `verificacao_indisponivel`. Lógica pura em `supabase/functions/_shared/aviso-plano-cliente.ts`.

### O que o cliente enxerga

- `meu_status_plano_cliente(tipo)` → `{ status: aguardando | chancelado | recusado | cancelado | null,
  gerado_em, nota_publica, prazo_previsto, atrasado, pode_regenerar }` do registro mais recente. **Nunca** devolve o
  conteúdo. `prazo_previsto` e `atrasado` só valem para o pedido aguardando; `pode_regenerar` é `true` quando o status
  não é `aguardando` ou o pedido estourou o prazo.
- `meu_plano_liberado(tipo)` → o plano **liberado do profissional** (`origem: "profissional"`),
  se houver; senão o **chancelado** mais recente (`origem: "equipe_myhealthid"`). O conteúdo
  passa por `gov_publico`, que remove triagem, revisão de segurança e justificativa e deixa
  `aprovacao.por_nome`, `por_perfil`, `em`, `versao` e `autochancela` (o selo termina com "Autochancela (teste
  interno)"). Com `nutricao_premium_ativa = false`, **nenhum plano nutricional da equipe** chega ao cliente, nem os
  já chancelados antes de a chave ser desligada (voltam quando ela é religada); o plano alimentar liberado pelo
  profissional do paciente não é afetado.

### Limites conhecidos

- **`pacientes.tipo_conta` só vira `wellness_premium` pelo servidor.** A RLS de `pacientes` deixa o
  cliente editar o próprio cadastro (sem limite de coluna) e qualquer usuário inserir uma linha com
  `terapeuta_id` = ele mesmo. O gatilho `pacientes_protege_tipo_conta` fecha isso para qualquer usuário
  logado, em INSERT e UPDATE: só o `service_role` (pagamento, `wellness-pagamento`) e o super-admin gravam
  `wellness_premium`; o cliente também não troca o tipo da própria conta nem se atribui como terapeuta.
  Consequência: **profissional não concede Premium ao paciente pela API** (não há esse fluxo no app; se
  virar necessário, deve passar por uma função própria). Validado em Postgres descartável com as policies
  reais (2 passos, 4 passos e INSERT). Defesa em profundidade que NÃO foi aplicada: exigir também uma linha
  ativa em `wellness_assinaturas`, porque contas Premium concedidas à mão podem não ter assinatura (decisão
  do Rafael).
- **Gerar tem um plano por vez na fila**, por tipo, e um teto de **3 pedidos por tipo em 24 horas**. Cancelar o
  pedido libera o seguinte na hora, então sem o teto o ciclo gerar-cancelar gastaria IA sem fim. Nova geração só
  depois de o anterior ser chancelado, recusado ou cancelado pelo cliente, ou de o pedido estourar o prazo da
  equipe (então o novo substitui o parado), sempre dentro do teto. O Guardião de custo `monitor-ia-uso`
  acompanha o total. Quem cancelou e quando: o cancelamento só existe pela conta do próprio cliente e o banco
  atualiza `updated_at` do pedido.
- **Caminho do profissional exige verificação** (era autodeclarado). Quem grava `profiles.perfil_profissional`
  no próprio perfil e insere um `pacientes` com `terapeuta_id` = ele mesmo e sem `user_id` ainda é
  classificado como `profissional`, mas agora recebe 403 `profissional_nao_verificado` enquanto o administrador
  não o verificar (`profiles.verificado`, que ninguém além do super-admin altera). O que permanece: um
  profissional **verificado** continua gerando direto, sem Premium e sem chancela, e com o `override` da
  triagem (é o fluxo dele). Mitigação ainda possível, dependente de decisão do Rafael: tratar como cliente
  quando o paciente alvo não tem nenhum atendimento registrado.
- **Verificação é manual**: o sistema guarda o registro informado e quem verificou, mas não consulta o conselho
  profissional; a conferência (CREF, CREFITO, CRN) é do administrador, na tela de administração. O botão
  "Pesquisar" (seção "Pesquisa automática de profissionais", abaixo) só traz um INDÍCIO para ajudar nessa
  conferência: ele nunca verifica ninguém.
- **Atraso não escala sozinho**: `atrasado` aparece na fila e libera o cliente a pedir de novo, mas ninguém é
  avisado do atraso. O prazo conta só seg–sex; feriados não entram.
- **Aviso por WhatsApp depende da configuração do remetente**: o aviso sai sempre pela conta da marca
  (administrador). Se essa conta não tem WhatsApp configurado,
  em pausa de automações ou (Meta) fora da janela de 24h sem modelo aprovado, o aviso não sai; o cliente vê o
  status ao abrir o portal.

## Pesquisa automática de profissionais

Decisão do Rafael (11/10/2026): na aba Administração, cada profissional cadastrado tem um botão **Pesquisar**, que
faz uma pesquisa na internet pelo nosso app para ajudar na verificação. Limites combinados com ele:

1. A pesquisa **nunca verifica ninguém sozinha**. É só INDÍCIO; verificar continua sendo um clique do administrador
   (`verificar_profissional`, que a pesquisa não chama nem altera).
2. Só informação **profissional pública**. Nada da vida pessoal, família, endereço, saúde, processos, opinião
   política ou religiosa, nem qualquer dado sensível.
3. Consulta de conselho muitas vezes tem captcha. Quando não for possível consultar, o app diz "Não consegui
   consultar automaticamente" e entrega o atalho para a consulta oficial.
4. Nenhuma URL de consulta de conselho é escrita no código. O app oferece atalhos de busca montados com o nome e o
   registro e o NOME do conselho esperado; as URLs de fontes são só as que vieram validadas da busca.
5. Tudo fica registrado: quem pesquisou, quando, o que a busca usou e o resultado.

Código: `supabase/functions/pesquisar-profissional/index.ts` (rede, banco, leitura de páginas) e
`supabase/functions/_shared/pesquisa-profissional.ts` (lógica pura). Migration:
`supabase/migrations/20261011000000_pesquisa_profissional.sql`. Tela: `src/components/chancela/PesquisaProfissionalPainel.tsx`
(dentro de `ProfissionalAdminCard`), `src/lib/pesquisaProfissional.ts` (leitura e rótulos) e
`src/lib/pesquisaProfissionalApi.ts` (chamadas). Testes: `npx vitest run src/test/pesquisaProfissional.test.ts
src/test/migracaoPesquisaProfissional.test.ts src/test/pesquisaProfissionalLib.test.ts
src/test/pesquisaProfissionalApi.test.ts src/test/pesquisaProfissionalPainel.test.tsx`.

### Escopo e consulta

A consulta usa **somente**: nome completo (`nome` + `sobrenome`), profissão (`perfil_profissional`), registro
(`registro_profissional`, ou o `crefito` do cadastro se estiver vazio) e, se houver, cidade/UF da clínica
(`config_clinica`, só como desempate de homônimos; entra apenas se cidade e UF forem válidas). **Nunca** e-mail nem
telefone: a função que monta a consulta nem recebe esses campos, e o banco rejeita qualquer chave fora de
`nome, registro, profissao, conselho_esperado, cidade, uf` em `consulta_usada`.

O nome e o registro são digitados pelo próprio profissional, então passam por filtros antes de entrar no prompt, na
tela e no Google. **Os filtros reduzem a superfície, não a eliminam:** a defesa que vale é o servidor recalcular o nível
e exigir trecho literal da página.

- Nome: só letras, espaço, apóstrofo, ponto e hífen (até 100 caracteres), no máximo 8 palavras de até 30 letras; um nome
  que casa com os padrões de "ordem para a IA" ("ignore as instruções...", "responda compatível...") não é pesquisado
  (a resposta é `sem_registro`). Uma frase curta em letras que não case com esses padrões ainda passa.
- Registro: só passa com **formato de registro**: dígitos (no máximo 10) mais siglas de conselho, UF, letras soltas de
  sufixo e palavras como "registro" ou "nº" (no máximo 4 palavras, 40 caracteres). Qualquer outra palavra, telefone, CPF
  ou e-mail faz o cadastro valer como "sem registro reconhecível": ele não vai à IA nem é gravado, e o resumo diz que o
  formato não é reconhecido.

Conselho esperado pela profissão (`CONSELHO_POR_PROFISSAO`):

| Profissão | Conselho |
|---|---|
| Fisioterapeuta, Terapeuta ocupacional | CREFITO |
| Educador físico | CREF |
| Nutricionista | CRN |
| Médico | CRM |
| Psicólogo | CRP |
| Dentista | CRO |

Categorias de achado aceitas (qualquer outra é descartada): `registro_conselho`, `situacao_registro`, `formacao`,
`atuacao_profissional`, `perfil_publico`.

### Como funciona

1. O front chama a edge com `{ user_id }`. A edge exige o JWT do chamador e confere `eh_super_admin()` no banco com
   esse JWT; **qualquer falha é 403** (fail-closed).
2. Lê o perfil pelo `service_role`, monta a consulta e confere os limites (`pesquisa_profissional_pode_pesquisar`). Sem
   nome e sobrenome não há o que pesquisar (`sem_registro`); sem número de registro a pesquisa acontece, mas o nível
   máximo é "inconclusivo".
3. Chama o Gemini com a ferramenta `google_search` (mesmo padrão de `buscar-ficha-aparelho`; chave `GEMINI_API_KEY`,
   modelo `GEMINI_MODEL_BUSCA`, padrão `gemini-2.5-flash`). O prompt proíbe tudo fora do escopo profissional, exige
   trecho literal e URL para cada achado e manda tratar o conteúdo das páginas como **dado não confiável**
   (risco de prompt injection).
4. O Gemini só devolve, como fontes, links de redirecionamento e títulos, não o texto das páginas. Por isso a edge
   **lê as páginas aterradas** (até 6): segue o redirecionamento até a página real, só https, sem IP nem host interno
   (o host é normalizado sem o ponto final, então `localhost.` e `servico.internal.` também são barrados), limite de 600 KB
   por página, 20 s no total, identificando-se como `MyHealthID-ConferenciaProfissional`. O DNS é conferido a cada salto e
   **fecha em falha**: sem `Deno.resolveDns` no runtime, com erro de DNS ou sem nenhum endereço público, a página não é
   lida. Página que é captcha, login ou erro conta como "não lida".
5. O **servidor valida e descarta**. Um achado só passa se: tem categoria do escopo; tem trecho (20 a 300 caracteres);
   a `fonte_url` é https, tem até 2000 caracteres (URL maior é descartada, nunca cortada) e é uma das páginas aterradas;
   o trecho consta, literalmente (sem diferenciar caixa, acento ou espaços), no texto dessa página; o trecho não casa
   com a **lista de bloqueio** (e-mail, CPF, telefone com ou sem espaços, endereço, processo, sanção disciplinar,
   prisão ou acusação, saúde, religião, política, nascimento, morte, família) nem parece ordem ao modelo ("ignore as
   instruções anteriores", "marque como verificado"); e passa pela **lista de permissão**: fala de assunto profissional
   da categoria (sigla de conselho, formação, atuação, Lattes...) e, em `formacao`, `atuacao_profissional` e
   `perfil_publico`, traz o nome da pessoa (para um homônimo não entrar). Um `registro_conselho` ainda precisa citar um
   conselho ou o número do cadastro. As duas listas são camadas de redução de risco, **não uma garantia**: uma
   formulação que nenhum padrão reconheça pode passar. O que passa grava a URL da página aterrada.
   **Nenhum texto escrito pelo modelo é gravado nem exibido:** a descrição (`texto`) de cada achado é sempre escrita pelo
   servidor (frase padrão da categoria; no `registro_conselho`, a frase sobre nome, número e conselho). O título da
   fonte só entra se não trouxer e-mail, telefone, dado fora do escopo nem ordem ao modelo; senão vale o endereço do site.
6. O **nível e o resumo são calculados pelo servidor** a partir dos achados validados (regras em "Níveis do indício").
   O que o modelo disser sobre nível ou resumo é ignorado, e o `nome_na_fonte` que ele aponta só vale depois de o
   servidor conferir que tem forma de nome de pessoa e está, no trecho, ao lado do registro.
7. Grava em `profissional_pesquisas` (`registrar_pesquisa_profissional`), inclusive as falhas, com `erro`. Sem
   conseguir gravar, não há resposta (a trilha de auditoria não é opcional).

### Na tela (aba Administração)

- Cada profissional (exceto a conta do administrador) tem o painel "Pesquisa na internet". Sem pesquisa anterior, o
  botão é **Pesquisar na internet**; com pesquisa, o cartão mostra o selo do último nível (vem de
  `pesquisas_profissionais_resumo`, uma chamada para a lista toda) e **Ver pesquisa**; **Pesquisar de novo** fica dentro
  do painel aberto, para não gastar uma busca por clique acidental.
- O painel mostra o selo (ícone e texto, nunca só cor), o resumo escrito pelo servidor, cada achado com categoria,
  trecho entre aspas e link da fonte (abre em nova aba, `noopener noreferrer`; o texto do link é **sempre o endereço do
  site**, nunca o título que a busca ou a página deram), data e hora de Brasília e o aviso fixo:
  "Isto é um indício encontrado na internet. Pode estar incompleto ou errado. A verificação é decisão sua."
- "Conferir no conselho": nome do conselho esperado pela profissão e um link de busca no Google montado com nome,
  profissão, registro e a palavra "conselho" (nada de URL de conselho no código; o e-mail nunca entra). Quando o nível é
  `nao_consultavel`, a tela mostra "Não consegui consultar automaticamente" e destaca esse atalho.
- A tela repete as checagens baratas do servidor: achado sem trecho, sem fonte https ou de categoria fora da lista não
  aparece, e um "compatível" sem nenhum achado de registro exibível é mostrado como "inconclusivo".
- O rótulo da aba vira "Administração (N)", com N = profissionais com registro informado e ainda não verificados,
  **sem contar a conta do administrador** (para ela não há botão Verificar).
- A pesquisa **não chama `verificar_profissional`** e não muda o botão Verificar.

### Níveis do indício e como interpretar

| Nível | Calculado quando | Como ler |
|---|---|---|
| `compativel` | Há achado `registro_conselho` cujo trecho traz **o número de registro informado** (grupo de dígitos inteiro, com 3 dígitos ou mais), **o conselho esperado** e **um nome compatível** (primeiro nome e mais um, como palavras inteiras), sem situação de atenção (inativo, suspenso, cancelado...) | Uma página pública diz o mesmo que o cadastro. **Não é uma verificação:** a página pode ser de terceiros ou até falsa. Confira a fonte. |
| `divergente` | Uma fonte aterrada mostra o número do cadastro, no conselho esperado, para **outro nome**; ou o mesmo nome e número em **outro conselho** (outra profissão). Vale mais que `compativel` | Merece olhar com atenção, mas pode ser homônimo ou erro da fonte. |
| `inconclusivo` | Há achados, mas nenhum fecha nome + número + conselho; ou o cadastro não pode ser comparado (sem registro, número com menos de 3 dígitos, profissão sem conselho conhecido: **o máximo possível**); ou a fonte cita o registro com situação de atenção | Há informação profissional pública, mas não confirma o registro. |
| `nao_encontrado` | Nenhum achado validado (e há páginas lidas, ou nenhuma fonte) | Não achei nada. **Não** significa que o registro não existe: use o atalho da consulta oficial. |
| `nao_consultavel` | A busca falhou ou foi bloqueada, ou só havia páginas que não foi possível ler (captcha, login) | "Não consegui consultar automaticamente": use o atalho para a consulta oficial. |

O servidor compara o **número e o conselho**, não a região do conselho (CREFITO-3 vs CREFITO-4) nem a letra final.

### Resposta da edge

`POST { user_id }` devolve sempre JSON. `mensagem` está em português, pronta para exibir.

| HTTP | Corpo | Quando |
|---|---|---|
| 200 | `{ ok: true, pesquisa }` | Pesquisa feita e registrada (qualquer nível). `pesquisa` tem o formato de `pesquisa_profissional_ultima`. |
| 200 | `{ ok: false, codigo: "falha_busca", mensagem, pesquisa? }` | A busca falhou, foi bloqueada, deu erro interno depois da reserva (`erro_interno`) ou a IA não está configurada. Quando a falha foi registrada, `pesquisa` vem com `nivel_indicio: "nao_consultavel"`. |
| 200 | `{ ok: false, codigo: "limite_profissional" \| "limite_diario", mensagem }` | Limites abaixo (também com pesquisa já em andamento para o mesmo profissional). |
| 200 | `{ ok: false, codigo: "sem_registro", mensagem }` | Perfil inexistente, sem nome e sobrenome ou com um "nome" que não é pesquisável (ver "Escopo e consulta"). |
| 400 | `{ ok: false, codigo: "pedido_invalido", mensagem }` | `user_id` ausente ou inválido. |
| 403 | `{ ok: false, codigo: "sem_permissao", mensagem }` | Não é o super-admin, ou a checagem falhou. |
| 503 / 500 | `{ ok: false, codigo: "indisponivel", mensagem }` | Banco indisponível ao ler o perfil, conferir limite ou gravar. |

Leitura pelo front (só super-admin, sempre pelas RPCs): `pesquisa_profissional_ultima(user_id)` (a mais recente ou
`null`) e `pesquisas_profissionais_resumo()` (a última de cada profissional, para o selo da lista). A tabela não tem
policy: nem o super-admin lê direto.

### Limites e custo

- No máximo **1 pesquisa por profissional a cada 10 minutos** e **60 pesquisas nas últimas 24 horas no total**
  (`pesquisa_profissional_pode_pesquisar(profissional, administrador)`, só `service_role`). Contam todas as linhas,
  inclusive as falhas (a falha também gastou uma chamada). Com os dois limites estourados vale o diário. Valores
  provisórios; mudar exige nova migration.
- **A vaga é reservada antes da busca, na mesma transação da conferência** (lock `pg_advisory_xact_lock`): a função grava
  na hora uma linha provisória (`nao_consultavel`, `erro = 'em_andamento'`) que já conta nos dois limites, e a edge a
  conclui com `registrar_pesquisa_profissional(..., p_id)`. Cliques simultâneos, abas ou instâncias diferentes não passam
  juntos pelo teto (testado no Postgres com 8 chamadas para o mesmo profissional: 1 passa; com 55 já gravadas e 12
  profissionais ao mesmo tempo: exatamente 5 passam). Se a edge cair no meio, a linha fica como falha registrada
  ("a pesquisa não terminou") e continua contando; nesse caso o novo clique só vale depois dos 10 minutos.
- Cada pesquisa é **uma chamada ao Gemini com busca do Google** mais a leitura de até 6 páginas. O preço vem da tabela
  vigente da Google para a chave `GEMINI_API_KEY` e **não está fixado aqui**: confira a cobrança por consulta com busca
  no painel da Google. Os tokens entram em `ai_usage_log` (`function_name = pesquisar-profissional`) e aparecem no
  Guardião de custo, mas essa estimativa **não inclui** a cobrança pela busca.
- Tudo que acontece depois da reserva (resposta da IA em formato inesperado, falha ao ler páginas, erro na validação) é
  capturado e gravado como falha (`erro_interno`), então nenhuma chamada paga fica sem registro. Se o banco falhar na
  gravação final, a edge responde 503 e a linha provisória continua como `em_andamento`.

### LGPD

- **Finalidade:** conferir a habilitação de quem atua como profissional de saúde na plataforma, para proteger os
  clientes. **Minimização:** a consulta tem só nome, profissão, registro e cidade/UF; e-mail e telefone nunca saem do
  banco para a busca; achados que casem com a lista de bloqueio ou que fujam do vocabulário profissional são descartados
  antes de gravar (redução de risco, não garantia: ver "Limites conhecidos").
- **Base legal:** a definir pelo jurídico. Sugestão em `docs/termos-profissional-verificacao.md` (legítimo interesse,
  com dados tornados públicos pelo próprio titular/registro público do conselho). O aviso ao profissional também está lá,
  como cláusula SUGERIDA (não aplicada em `Termos.tsx`).
- **Operador e transferência:** o nome e o registro viram parte da consulta enviada ao Google (Gemini API). O jurídico
  deve confirmar o contrato/termos de tratamento de dados da chave usada e a transferência internacional.
- **Dados de terceiros:** o trecho de um achado `divergente` pode conter o nome de outra pessoa que aparece em fonte
  pública (por exemplo, outro inscrito no mesmo número). Só o super-admin lê.
- **Acesso e retenção:** só o super-admin lê (RPCs); a tabela não tem policy. O histórico fica enquanto a conta do
  profissional existir e é apagado junto com ela (`ON DELETE CASCADE`). **Não há prazo de retenção nem rotina de
  expurgo** (o repositório também não tem fluxo de exclusão de conta): na prática o histórico fica indefinidamente.
  Decisão pendente antes de ir para produção (ver "Perguntas em aberto", item 20).
- **Direitos do titular:** o profissional pode pedir acesso, correção ou eliminação e contestar o resultado; nada é
  negado automaticamente (a decisão é sempre do administrador). Canal e prazo: a definir (ver o documento acima).

### Limites conhecidos

- **Fonte falsa ou de terceiros:** o servidor garante que o trecho consta na página, não que a página diga a verdade. Um
  site criado para parecer um registro pode produzir `compativel`. Por isso o nível é só indício; a tela mostra o trecho
  e o link com o **endereço real do site** (nunca o título), e o resumo do `compativel` cita o endereço e avisa que
  qualquer pessoa pode publicar uma página assim. Para o servidor distinguir site oficial, configure
  `PESQUISA_DOMINIOS_OFICIAIS` (lista de domínios separados por vírgula, por exemplo os dos conselhos regionais; **nenhum
  endereço de conselho está escrito no código**): com ela, o `compativel` só sai de fonte desses domínios (o domínio ou um
  subdomínio dele). Sem ela, vale o aviso. A decisão exige abrir a consulta oficial.
- **Captcha e páginas dinâmicas:** consultas de conselho costumam exigir captcha ou carregar por JavaScript. Nesses casos
  o resultado esperado é `nao_consultavel` ou `nao_encontrado`; o app não tenta contornar captcha.
- **Homônimos e formatos:** o nome compatível usa o primeiro nome e mais um, ao lado do registro; o número exige 4 dígitos
  ou mais colados à sigla; a região é comparada quando o cadastro e a fonte a mostram (se um dos dois não mostra, não
  bloqueia). Páginas com o nome numa linha e o registro em outra, ou com formatos fora do comum, caem em `inconclusivo`
  (o lado seguro). Ainda são possíveis falsos `compativel` (homônimo com o mesmo número e região) e `divergente`; ambos
  são indícios.
- **Listas de bloqueio e permissão:** são regras de texto, não entendem contexto. Um conteúdo sensível escrito de um jeito
  que nenhum padrão cubra, junto de vocabulário profissional e do nome da pessoa, pode ser gravado e exibido ao
  administrador. Trechos de até 300 caracteres limitam o alcance.
- **Prompt injection:** o risco é reduzido, não eliminado. A IA nunca decide nível nem resumo, nada é aceito sem trecho
  literal da página e o texto que parece ordem é descartado, mas uma página hostil ainda pode influenciar o que a IA
  escolhe citar.
- **Leitura de páginas (SSRF):** só https público, com checagem do nome do host (sem ponto final) e do DNS a cada salto,
  fechando em falha. Uma troca de DNS entre a checagem e a conexão (rebinding) não é coberta: o `fetch` do runtime não
  permite fixar o IP já validado. **Confirmar em produção que `Deno.resolveDns` existe no runtime das edges:** se não
  existir, nenhuma página é lida e toda pesquisa volta `nao_consultavel`.
- **Cidade da clínica:** vem de `config_clinica.cidade` e `uf`, digitadas pelo profissional (não é confiável). Serve só
  para desempatar homônimos e nunca prova nada.
- **Não testado com a API real:** o caminho do Gemini e da leitura das páginas foi validado com respostas simuladas
  (`deno check` e vitest). Faça um teste manual em produção com um profissional conhecido antes de confiar nos
  resultados, e confira se a leitura dos redirecionamentos de `vertexaisearch.cloud.google.com` está funcionando.

### Operação

- Segredos: `GEMINI_API_KEY` (obrigatório; sem ela a edge responde `falha_busca` sem gastar nada nem gravar linha) e,
  opcionalmente, `GEMINI_MODEL_BUSCA`. Nunca em código nem em log: a edge não registra nome, registro nem trecho.
- Deploy: a edge sobe com as demais pelo workflow `supabase-deploy.yml` (`verify_jwt = true` em `config.toml`).
- Mudar o escopo, as categorias ou os limites: `_shared/pesquisa-profissional.ts` e a migration. Os testes
  `migracaoPesquisaProfissional.test.ts` comparam as listas do banco com as do módulo.

## De onde vêm os dados da triagem

Sempre lidos do banco pelo servidor (`carregarMotoresClinicos`), nunca só do body:

1. **Estruturados:** idade exata pela data de nascimento (`pacientes.data_nascimento`,
   fuso de Brasília); `pacientes.historico_clinico` (condições como "Diabetes tipo 1",
   "Insuficiência renal", "Hipertensão arterial"; cirurgias com ano; medicamentos).
   O histórico familiar é ignorado de propósito.
2. **Triagem autodeclarada:** `nutricao_anamnese.respostas.triagem` (formato abaixo).
3. **PAR-Q+:** última resposta em `questionarios_clinicos` (classificação de atenção,
   e as perguntas 1 e 2 sobre coração/pressão e dor no peito).
4. **MyID:** `red_flags_detected` do MyID concluído ou do MyID importado.
5. **Texto livre**, por palavra-chave sem acento e sem diferenciar maiúsculas:
   queixa, história atual, condições preexistentes, medicamentos, anamnese, achados e
   texto da avaliação do profissional, e as restrições do pedido.

Palavras-chave (resumo): gestante/grávida/gestação/lactante/amamentando; anorexia/
bulimia/compulsão alimentar/transtorno alimentar/TCA; renal/IRC/DRC/hemodiálise;
diabetes/insulina/hipoglicemiante/metformina; hipertensão/pressão alta/cardiopatia/
infarto; "cirurgia recente"/"pós-operatório"; bariátrica. A lista completa está em
`PADROES_TEXTO`.

Negação curta e explícita ("nega gestação", "não estou grávida", "sem uso de
insulina") não conta. "Não sei se estou grávida" **conta**. Termos ambíguos podem gerar
falso positivo (ex.: "TCA" como sigla de outra coisa); isso resulta em `confirmar`
para o profissional, não em erro.

### Formato da triagem autodeclarada

Chave `triagem` dentro de `nutricao_anamnese.respostas` (sempre com merge, sem
sobrescrever as demais respostas):

```json
{
  "versao": 1,
  "respondida_em": "2026-10-07T12:00:00.000Z",
  "gestante_lactante": "sim | nao | nao_sei",
  "transtorno_alimentar": "sim | nao | prefiro_nao_dizer",
  "doenca_renal": "sim | nao | nao_sei",
  "diabetes_insulina": "sim | nao | nao_sei",
  "cardio_pressao": "sim | nao | nao_sei",
  "cirurgia_lesao_recente": "sim | nao"
}
```

Uma triagem com qualquer pergunta sem resposta válida conta como **não respondida**.
Como o próprio cliente pode escrever nessa tabela, a autodeclaração serve para
**acender** alertas, nunca para aprovar nada.

## Como editar as regras

Tudo fica em `TRIAGEM_REGRAS`, no início de `triagem-bloqueio.ts`:

```ts
export const TRIAGEM_REGRAS = {
  idadeMenorDe: 18,                 // abaixo disto: criança/adolescente
  idadeIdosoMinima: 65,             // a partir disto: idoso
  cirurgiaRecenteJanelaAnos: 1,     // cirurgia com ano >= (ano atual - 1) conta como recente
  justificativaMinCaracteres: 15,
  niveis: {
    treino:   { menor_de_idade: "bloqueia", idoso: "confirmar", /* ... */ },
    nutricao: { menor_de_idade: "bloqueia", doenca_renal: "bloqueia", /* ... */ },
  },
};
```

- **Mudar o nível de um fator:** troque `"confirmar"` por `"bloqueia"` (ou o contrário).
- **Aplicar um fator a um foco que hoje não o usa:** adicione a linha. Exemplo: para
  o treino também reagir a transtorno alimentar, inclua
  `transtorno_alimentar: "confirmar"` em `niveis.treino`.
- **Desligar um fator num foco:** apague a linha.
- Códigos disponíveis: `menor_de_idade`, `idoso`, `gestante_lactante`,
  `transtorno_alimentar`, `doenca_renal`, `diabetes`, `diabetes_insulina`,
  `cardio_pressao`, `cirurgia_lesao_recente`, `cirurgia_bariatrica`, `parq_atencao`,
  `myid_red_flags`.
- Depois de editar, rode `npx vitest run src/test/triagemBloqueio.test.ts` e ajuste
  os testes que descrevem a regra antiga.

## Parâmetros dos prompts: tudo "a confirmar"

Os números fixos dos prompts não têm fonte confirmada e **não foi inventada
nenhuma referência**. Eles ficam em `_shared/parametros-nutricao.ts` (déficit,
superávit, pisos de kcal, proteína, gordura, hidratação, número de refeições,
fórmulas) e em `_shared/governanca-plano.ts` (faixas de treino por objetivo, número
de fases, semana de regeneração). Cada plano gerado traz esses parâmetros em
`_governanca.fonte.parametros`, com `fonte: null` e `status: "a_confirmar"`.

Os prompts são montados a partir dessas listas, então o registro e o que a IA
recebe não divergem. Quando um profissional validar um valor, troque a entrada por
`{ ..., fonte: "<referência que ele confirmou>", status: "confirmado" }`.

## Onde o front trata o bloqueio e a liberação

- `src/lib/geracaoPlano.ts`: `gerarPlanoComTriagem` chama a edge e devolve o plano **ou** o
  bloqueio (`{ ok:false, bloqueio }`); nunca trata o bloqueio como erro nem como plano vazio.
- `PlanoTreinoCard` e `PlanoAlimentarCard` (profissional): o bloqueio abre o
  `TriagemBloqueioDialog`; ao prosseguir, o **mesmo pedido** é reenviado com `override`.
  Na geração automática ("Montar todos os planos") o diálogo **não** abre sozinho: o card
  mostra "Geração pausada pela triagem de segurança" e o pai (`PortalControleTab`) mostra
  um aviso. Há uma única tentativa automática por card; "Dispensar" devolve o botão
  "Montar todos" para tentar de novo depois.
- `PacientePlanoIA` (cliente premium): o bloqueio mostra só a orientação de falar com o
  profissional e o caminho para a `TriagemSegurancaCard`; o cliente nunca sobrepõe. Depois
  de gerar, mostra o status por tipo (`meu_status_plano_cliente`) e só exibe o plano quando
  chancelado (`meu_plano_liberado`). O profissional da equipe científica trabalha na fila
  `/chancela` ("Fila de chancela MyHealthID").
- Liberar um plano passa sempre pelo `LiberarPlanoDialog` (revisão de segurança +
  RPC `liberar_plano`): o banco carimba quem liberou, quando e a versão. Ocultar continua
  sendo um UPDATE simples.
- Editar um plano liberado o devolve a rascunho no banco (trigger `trg_gov_*`); as telas
  de edição leem o `aprovado` que voltou do UPDATE e avisam o profissional.
- "Usar como base" (plano do cliente copiado para a tabela do profissional) **descarta** o
  `_governanca` e o `acompanhamento` vindos de `planos_ia_cliente` (o paciente escreve nessa
  tabela) e grava `fonte.tipo = "cliente_base"`.
- O selo (`SeloGovernanca`) nunca diz "liberado" para `planos_ia_cliente`.

## Perguntas em aberto para validar

1. Os cortes de idade (18 e 65) e a regra de bloquear menores estão corretos?
   Menores precisariam de responsável legal (hoje não existe esse cadastro).
2. Gestação/lactação deve bloquear **treino** também, ou só pedir confirmação?
3. Transtorno alimentar deve ao menos pedir confirmação no **treino**? (Hoje não aciona.)
4. Doença renal: bloquear na nutrição e só confirmar no treino é a decisão certa?
5. "Cirurgia recente" por ano de registro (janela de 1 ano) é suficiente? O campo
   guarda só o ano.
6. A triagem autodeclarada deve ter **validade** (refazer a cada N meses)? Hoje vale
   para sempre.
7. O PAR-Q+ implementado tem 7 perguntas curtas e não é obrigatório. Adotar o PAR-Q+
   oficial completo?
8. ~~Free no período de teste (7 dias) pode gerar plano sozinho?~~ **Decidido em
   08/10/2026: não.** Só o Premium gera, e o plano passa pela chancela da equipe científica
   (`POLITICA_PLANO_CLIENTE.tiposContaQueGeram`).
9. Fora do escopo desta entrega, **sem triagem de bloqueio**: `gerar-dicas-paciente`
   (dicas gratuitas de Fortalecimento/Mobilidade), `gerar-diretriz-treino`,
   `gerar-diretriz-nutricional`, e os treinos publicados direto em `studio_treinos`.
10. O limite de dor do app está em dois valores: a escala da sessão
    (`PacienteExercicios.tsx:390`), o texto do plano e o acompanhamento usam "acima de 6"; os
    históricos (`PacienteExercicios.tsx:548` e `PacienteEngajamentoTab.tsx:265`) destacam
    "acima de 5". Falta decidir um valor único.
11. ~~Quem integra a equipe científica e qual o prazo esperado para chancelar? Hoje a fila não tem prazo nem
    aviso ao cliente.~~ **Decidido em 08/10/2026:** a equipe é designada pelo super-admin (só verificados, com áreas
    `treino`/`nutricao`); o prazo é de 2 dias úteis (configurável, 1 a 10); estourado o prazo o cliente pode pedir de novo
    e a fila mostra o atraso; o cliente é avisado por WhatsApp (sem conteúdo clínico) e pode cancelar o pedido.
    Em aberto: contar feriados no prazo? e escalar o atraso para o administrador?
12. ~~O carimbo do super-admin fora do perfil dele aparece como "Administrador(a)".~~ **Decidido em 08/10/2026:**
    o super-admin atua em qualquer área só como exceção de teste (carimbo `por_perfil = 'super_admin'`) e a
    autochancela do plano da própria conta só vale enquanto não houver outro revisor verificado. O selo mostra
    "Autochancela (teste interno)" no portal e no PDF. Em aberto: o texto do selo para `super_admin` fora da autochancela.
13. A bioimpedância que o próprio cliente cadastra (`body_composition`) deveria entrar no plano
    alimentar do cliente? Hoje fica de fora (é tratada como exame).
14. Quando houver mais de um revisor, a autochancela deveria considerar só quem cobre a área do plano (hoje basta
    existir outro membro da equipe verificado, de qualquer área)?
15. O aviso por WhatsApp sai sempre pela conta do administrador (Rafael), nunca pelo profissional do cliente (o
    cadastro do cliente é editável por ele). É a conta da marca certa, ou existe um número institucional do
    MyHealthID para isso?
16. Recusar plano exige perfil verificado mas não a área (recusar é o lado seguro). Mantém assim, ou recusar também
    deve exigir a área do plano?
17. Teto de pedidos do cliente: hoje 3 por tipo em 24 horas (valor provisório; está em
    `plano_cliente_limite_pedidos_24h()`). Confirma esse número ou prefere outro, ou um intervalo mínimo depois de cancelar?
18. A leitura da fila deve ficar restrita às áreas do revisor (quem é só de treino não leria planos de nutrição, e
    vice-versa)? Hoje a fila mostra tudo à equipe verificada, com `pode_chancelar` e `motivo_nao_pode` por item.
19. O atalho antigo `definir_equipe_cientifica(email, valor)` deixa a chamada posicional de 2 argumentos ambígua
    (erro `is not unique`). Autoriza `DROP FUNCTION` desse atalho (nenhum código o chama) para a chamada de 2
    argumentos voltar a funcionar? Enquanto isso, use 3 argumentos.
20. Pesquisa automática de profissionais, base legal: confirmar com o jurídico a base (sugestão: legítimo interesse, com
    avaliação documentada), o canal de privacidade para o profissional pedir correção, o prazo de retenção do histórico
    (hoje não há: o histórico fica enquanto a conta existir, e não há fluxo de exclusão de conta no repositório; decidir o
    prazo e se será um job mensal que apaga o que passar de N meses mantendo a última de cada profissional, ou uma rotina
    de eliminação por profissional) e o contrato de tratamento de dados com a Google (transferência internacional).
    Texto sugerido em `docs/termos-profissional-verificacao.md`; falta decidir onde e como colocá-lo em `Termos.tsx`.
21. Pesquisa: usar a cidade/UF da clínica (`config_clinica`) como desempate de homônimos? É digitada pelo profissional e
    pode ser o endereço de casa de quem atende sozinho. Se preferir, basta não ler `config_clinica` na edge.
22. Pesquisa: "compatível" exige número (4 dígitos ou mais) colado à sigla do conselho esperado, nome ao lado, mesma região
    e nenhuma situação de atenção (critérios a mais que o combinado, para evitar coincidência e falso verde). Mantém assim?
    Registros de 3 dígitos ou menos nunca passam de "inconclusivo".
23. Pesquisa: os limites de 1 pesquisa por profissional a cada 10 minutos e 60 por 24 horas no total estão bons?
24. Pesquisa: validar manualmente com a API real (Gemini e leitura de páginas) antes de confiar nos resultados.
25. Pesquisa: quais são os domínios dos sites oficiais dos conselhos (CREFITO regionais, CREF, CRN, CRM, CRP, CRO) para
    configurar `PESQUISA_DOMINIOS_OFICIAIS` nas edges? Sem a lista, o "compatível" pode vir de qualquer site e o resumo só
    avisa. Com a lista, "compatível" passa a exigir fonte oficial (e sites de conselho com captcha tendem a dar
    "não consegui consultar"). Os domínios precisam ser informados por quem os conhece: o código não traz nenhum.
26. Pesquisa: confirmar em produção, antes de confiar nos resultados, que `Deno.resolveDns` funciona no runtime das edges
    (a leitura de páginas fecha em falha sem ele).
