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
  profissional; a conferência (CREF, CREFITO, CRN) é do administrador, na tela de administração.
- **Atraso não escala sozinho**: `atrasado` aparece na fila e libera o cliente a pedir de novo, mas ninguém é
  avisado do atraso. O prazo conta só seg–sex; feriados não entram.
- **Aviso por WhatsApp depende da configuração do remetente**: o aviso sai sempre pela conta da marca
  (administrador). Se essa conta não tem WhatsApp configurado,
  em pausa de automações ou (Meta) fora da janela de 24h sem modelo aprovado, o aviso não sai; o cliente vê o
  status ao abrir o portal.

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
