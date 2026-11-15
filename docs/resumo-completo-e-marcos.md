# Resumo Completo e Linha do tempo clínica (etapa 1)

Pedido do Rafael: no perfil do paciente, aba **Avaliação > Clínico**, o cartão "Resumo Clínico" ganha uma **versão mais
completa**, e ao lado entra uma **linha do tempo** com os marcos históricos do paciente, feitos a partir das respostas do
cliente no MyID, da avaliação presencial e dos outros formulários.

Decisões do Rafael para esta etapa: **regra fixa, sem IA** (nenhuma chamada a IA, nenhuma edge function nova, nenhum dado de
saúde enviado a provedor externo); **só o profissional vê**, no perfil do paciente; o cliente **não** vê nada disto.

## O que é

| Peça | Onde aparece | Pode editar? |
| --- | --- | --- |
| **Resumo** (o de sempre) | cartão "Resumo Clínico", seletor **Resumo \| Completo** | sim, pelo lápis, como antes (e continua indo ao prontuário, "Sincronizado") |
| **Completo** | mesmo cartão, seletor em "Completo" | **não**: só leitura, botão "Copiar" |
| **Linha do tempo clínica** | cartão logo abaixo, na aba Clínico; sem avaliação por voz ela aparece sozinha | não |

Tudo é **calculado na hora**. **Nada novo é gravado**: nem nota de prontuário, nem `historia_vida_paciente`, nem
`avaliacoes_voz`, nem coluna nova; nenhuma migração. O Completo e a linha do tempo **não passam** por
`sincronizarProntuario`, `toggleConfirmacao`, `salvarEdicao` nem pela pré-confirmação, e **não são uma seção** de `SECOES`
(`AvaliacaoSecoesEditaveis.tsx`): essas seções são pré-confirmadas e vão sozinhas ao prontuário, que o cliente pode ler.

Avisos fixos no Completo (na tela):

- "Montado pelo app a partir das respostas; não vai para o prontuário." (também vai no fim do texto copiado)
- "Os selos Prontuário e Sincronizado do cabeçalho valem só para o Resumo." Só na tela: com o Completo aberto os selos do
  cabeçalho do cartão continuam à vista e poderiam sugerir que a versão longa foi ao prontuário. O texto copiado sai do app e os
  selos não saem junto, por isso o aviso não vai nele.

## De onde vem cada coisa

Cada fonte é lida em separado (`src/hooks/useFontesClinicas.ts`, só `select`). Se uma falha, aparece "Não consegui ler ..." e as
outras continuam. A leitura das datas de conclusão do MyID (`avaliacoes_identidade`) também é uma fonte à parte: se falhar, o aviso
diz "as datas de conclusão do MyID" e os MyIDs aparecem como "último registro".

| Fonte | Vira | Origem / selo |
| --- | --- | --- |
| `pacientes.historico_clinico.cirurgias` (ano válido) | marco **fato**, só o ano | cliente: "Relatado pelo cliente, não revisado" |
| `pacientes.historico_clinico.ultimo_envio` | marco **registro** ("Último envio do histórico clínico (pelo cliente)") | cliente |
| `myid_avaliacoes` (status `concluido`) + `avaliacoes_identidade.created_at` ligada a ele | marco **registro** "MyID concluído" (data do histórico); sem a ligação, "MyID (último registro)" com `updated_at` e aviso | cliente |
| `avaliacoes_voz` (só as do profissional, mesmo filtro da avaliação atual) | marco **registro** | profissional: "Registrado pelo profissional" |
| `historia_vida_paciente.data_evento` | marco **fato** | profissional |
| `diagnosticos_paciente` **ativos** e do tipo **principal** ou **secundário**, com `data_diagnostico` válida **e diferente do dia do cadastro** | marco **fato** | profissional |
| `exames_presenciais.data_exame` | marco **registro** | profissional |
| `exames_importados` com `status = 'processado'` e `data_exame` válida | marco **registro**, com o aviso "Data lida automaticamente do documento; confira no arquivo." | profissional |
| `testes_funcionais_paciente.data_teste`, `escalas_psicologia.data_aplicacao` | marco **registro** | profissional |

- **fato** = o acontecimento clínico com a data que o registro traz (cirurgia de 2022, diagnóstico em 03/2019): marcador **cheio**.
- **registro** = quando algo foi feito ou registrado no app: marcador **vazado** e rótulo "registro no app".
- Do MyID mais recente concluído (`respostas_brutas`) vêm o que o cliente escreveu (queixa, "quando começou", "o que fazia"), a
  faixa de duração e as mudanças das últimas 4 semanas, com os **rótulos exatos de `Bloco1.tsx`** (um teste confere).
- O **Resumo Completo** junta: queixa e história, dor, funcionalidade, aspectos psicossociais, exame e avaliação do profissional
  (da última avaliação, em `resultado`), e a parte **"Relatado pelo cliente (não revisado)"** com MyID, histórico clínico e
  história atual. Os textos passam como estão; só os rótulos de seção são fixos.

### Diagnósticos: só os ativos, principais ou secundários

Valores conferidos em `20260607211619`: `tipo` é `principal | secundario | suspeita` e `ativo boolean NOT NULL DEFAULT true`. No app,
**remover** um diagnóstico é `update ativo = false` (`DiagnosticosCID10Card.tsx`), e a lista dele usa `.eq('ativo', true)`.

- Só entra o diagnóstico **ativo** e do tipo **principal** ou **secundário**. A leitura já pede só esses (`.eq('ativo', true)`,
  `.in('tipo', ...)`), para removido e suspeita não gastarem as 50 vagas, e a camada de marcos confere de novo.
- **"suspeita" fica de fora**: é hipótese, não diagnóstico. A linha do tempo não pode mostrar uma hipótese como fato clínico.
  Tipo nulo ou desconhecido também fica de fora (na dúvida, não se afirma diagnóstico).
- **`ativo` vazio fica de fora**, como na lista do próprio app. A coluna é `NOT NULL DEFAULT true`, então vazio só aparece se a
  leitura não trouxe a coluna; nesse caso não se afirma nada.
- Diagnóstico removido ou suspeito não vai nem para "Sem data" nem para o aviso de registros ignorados: some por inteiro.

#### A data do diagnóstico que o banco preenche sozinho

`diagnosticos_paciente.data_diagnostico` é `date DEFAULT CURRENT_DATE` (migração `20260607211619`) e **nenhum código do app a grava**:
o `insert` de `DiagnosticosCID10Card.tsx` não envia a coluna, então o banco a preenche com o **dia do cadastro**. Sem tratamento, todo
diagnóstico ativo viraria um marco "fato" no dia em que foi cadastrado no app, e o Rafael pediu para evitar isso (data que o sistema
preenche sozinho não é data real).

Regra: `data_diagnostico` só vale como data do fato quando é **diferente do dia de `created_at`**, tanto no **dia em UTC** (o
`CURRENT_DATE` usa o fuso do banco) quanto no **dia do Brasil**. Igual a qualquer um dos dois: o diagnóstico vai para a faixa
**"Sem data"**, com "Registrado no app em dd/mm/aaaa" (o mesmo caminho do diagnóstico sem data) e a nota "A data do diagnóstico é a do
dia do cadastro no app e pode ter sido preenchida pelo sistema". Isso vale também quando a data seria "amanhã" para o Brasil (entre
21h e meia-noite o `CURRENT_DATE` em UTC já é o dia seguinte): a nota diz que veio do cadastro, não que é "inválida".

- Uma data bem diferente do dia do cadastro (2019-03-04 em registro de 2026) continua marco **fato**.
- **Limitação assumida:** um diagnóstico cuja data real coincida por acaso com o dia do cadastro (o profissional cadastra no mesmo dia em
  que diagnosticou) também vai para "Sem data". Não há como separar esse caso do preenchimento automático sem gravar algo novo.
- **`created_at` nulo ou inválido:** sem o dia do cadastro não há com o que comparar, então só a data válida decide (ela vira marco).
  `created_at` é `NOT NULL`, então vazio só aparece se a leitura não trouxe a coluna; descartar a data nesse caso perderia uma data que o
  profissional pode ter digitado, e a regra estrita de data (válida, não futura, de 1900 em diante) continua valendo.
- Se um dia o app passar a gravar `data_diagnostico` de verdade (campo na tela), esta regra deve ser revista: ela deixaria de ser
  necessária para os cadastros novos e passaria só a esconder a data real igual ao dia do cadastro.

### Exames importados: só os que terminaram com sucesso

`exames_importados.status` tem `DEFAULT 'pendente'` (`20260607203748`) e a edge function `import-exame` grava `'processado'` ao
terminar. Só `status = 'processado'` entra. Pendente, erro e qualquer outro valor (ou coluna ausente) ficam de fora, sem aparecer
em "Sem data" nem no aviso de registros ignorados. A camada de marcos apara espaços nas pontas (`" processado "` conta), mas não aceita
outra caixa (`"Processado"` fica de fora); a leitura já pede o valor exato.

**A data do exame importado é lida por IA.** `exames_importados.data_exame` vem do JSON que o Gemini extrai do arquivo
(`supabase/functions/import-exame`, campo `data_exame` "YYYY-MM-DD ou null"); ninguém a digita. O marco continua **registro** com essa
data, e o detalhe traz "Data lida automaticamente do documento; confira no arquivo.", para o profissional conferir no arquivo. Sem data
(a IA devolveu `null`), vai para "Sem data" como antes.

### Relato do paciente no portal não é avaliação presencial

`avaliacoes_voz` guarda também o que o próprio paciente conta no portal (`resultado._meta.origem` em `portal_paciente_historia` ou
`autocadastro_paciente`). Duas barreiras: o filtro `.or(FILTRO_SO_PROFISSIONAL)` no servidor e, caso o filtro não seja aplicado, a
leitura traz a origem por **caminho JSON com apelido** (`origem_do_relato:resultado->_meta->>origem`, sem baixar o `resultado`
inteiro, que é pesado) e a camada de marcos descarta o relato do paciente. Um teste usa um banco que ignora o `.or` para provar a
segunda barreira.

## Regras de data (estritas)

- **Ano de cirurgia** (`cirurgias.items[].ano`): só vira data se for **exatamente 4 dígitos** entre **1900 e o ano de hoje**
  (número ou texto com espaços nas pontas). "2O22", "dois mil", "há 2 anos", "20", "2099", "1899", "2022-13", vazio, `null`,
  objeto: **"Sem data"**, com o texto original.
- **Datas de tabela** (`data_evento`, `data_diagnostico`, `data_exame`, `data_teste`, `data_aplicacao`, `created_at`): só valem
  se forem datas **válidas** (rejeita "0000-00-00", dia que não existe, ano antes de 1900 e **depois de hoje**). Instante com
  fuso (`created_at`) vira o **dia no Brasil**.
- **Texto livre do cliente nunca vira data**: MyID (`bloco_1_quando_data`, `bloco_1_quando_desc`, `bloco_1_queixa`) e
  `historia_atual.inicio` ficam na faixa recolhível **"Sem data"**, como o cliente escreveu. A faixa do MyID (`lt6w`, `6_12w`,
  `3_12m`, `gt1y`) aparece com o rótulo humano ("Mais de 1 ano").
- **Diagnóstico e exame importado do profissional sem data do fato** (sem `data_diagnostico` / `data_exame`, ou com data inválida
  ou no futuro, ou, no diagnóstico, igual ao dia do cadastro: ver "A data do diagnóstico que o banco preenche sozinho") **não viram marco com a data de `created_at`**: a data em que foi gravado no app não é a data do fato. Vão para a
  faixa **"Sem data"** com o próprio selo (**"Registrado pelo profissional"**) e o detalhe diz o que faltou e quando foi gravado,
  por exemplo: "Diagnóstico · A data do diagnóstico não foi informada · Registrado no app em 03/02/2026" (dia do Brasil). Se
  `created_at` também não for uma data, a frase "Registrado no app em ..." simplesmente não aparece.
- **Os outros registros sem data válida** (história de vida, exame presencial, teste, escala, avaliação do profissional e MyID concluído)
  **ficam de fora** e a tela avisa quantos ("N registros ficaram de fora porque a data não é válida"). Diagnóstico e exame
  importado sem data **não** entram nessa contagem: estão em "Sem data".
- **Nenhum marco recebe a data de hoje por falta de data.**
- A faixa **"Sem data"** mistura itens do cliente e do profissional; **cada item mantém o próprio selo de origem**. Fica recolhida
  por padrão, mas o bloco fica montado (só escondido) para o botão apontar para um id que existe.
- `eventos_clinicos_anatomicos` **não é lido**: os achados do histórico relatado gravam a data do **envio** como data de início
  e não dá para separar, com certeza, o que o profissional datou de verdade.
- Ordem: **mais recente primeiro** (a do resto do app), agrupada por ano; dentro do ano, o que tem dia vem antes do que só tem o
  ano. A tela mostra os 6 mais recentes e "Ver todos".

### Data do MyID: "concluído" só com a data do histórico

`myid_avaliacoes.updated_at` **não** é data de conclusão: o gatilho `trg_myid_avaliacoes_updated_at` o muda em **qualquer** update.
Exemplos reais: `backfill-myid-efi` regrava `resultado_processado` meses depois, e as migrações de recálculo
(`20260924150000_recalculo_myid_efi.sql` e as seguintes) fizeram `UPDATE` em muitos MyIDs. A tela diria "concluído" numa data errada.

O que foi investigado (conferido nas migrações e nas funções):

- `avaliacoes_identidade.concluido_em` **não serve**: o `complete-myid` não a grava (fica nula nas linhas que ele cria). Só o fluxo por
  fases (RPC de fase 4) a preenche com `now()`, e a migração `20260509234627` a preencheu nas linhas antigas com `COALESCE(updated_at,
  created_at)`, que tem o mesmo defeito.
- `avaliacoes_identidade.data_avaliacao` (texto) o `complete-myid` grava com `hojeBR()`, o dia do Brasil em que a linha é inserida.
- `avaliacoes_identidade.created_at` é gravado no **mesmo pedido** que conclui o MyID (o `complete-myid` insere a linha e só depois
  marca o MyID como `concluido`) e **nenhum update o muda** (o `backfill-myid-efi` e a migração só mexem em outras colunas). É a data
  confiável. A ligação é `avaliacoes_identidade.myid_avaliacao_id` (migração `20260925190000`, com índice único), gravada pelo
  `complete-myid` (e, nas linhas antigas, pelo vínculo retroativo da própria migração, por respostas iguais). A linha que o fluxo por
  fases cria já na primeira fase (com `created_at` do começo) não tem essa ligação, então não entra nesta data.
- A RLS de `avaliacoes_identidade` é `auth.uid() = terapeuta_id`: o profissional só lê as linhas dele. Por isso a leitura filtra por
  `terapeuta_id` e `myid_avaliacao_id` não nulo e pede só `id, myid_avaliacao_id, created_at` (nunca `dados_avaliacao`).

Decisão: **uma leitura a mais, só `select`, como fonte isolada** (`vinculosMyid`).

- Com a linha ligada ao MyID: marco **"MyID concluído"**, com o dia do Brasil de `avaliacoes_identidade.created_at` e o detalhe "Data em
  que a conclusão foi registrada no histórico do paciente."
- Sem a linha (MyID antigo sem ligação, MyID concluído sem profissional, linha de outro profissional pela RLS, leitura que falhou, data
  inválida): marco **"MyID (último registro)"** com `updated_at` e o aviso **"Data do último registro; pode ser posterior à conclusão."**
  A palavra "concluído" não aparece. O `created_at` do próprio MyID não é usado de reserva (é quando o MyID foi criado, antes de o cliente
  responder); sem `updated_at` válido o MyID é ignorado e contado no aviso de registros ignorados.
- **Resíduo conhecido:** o `complete-myid` também "repara" um MyID marcado concluído que nunca chegou ao histórico (reenvio depois de falha
  antiga). Nesse caso a linha do histórico nasce no dia do reparo, e esse dia aparece como a data. O detalhe é literal (data em que a
  conclusão foi **registrada no histórico**), e não existe, no banco, outra data melhor: o `updated_at` também é regravado no reparo.

### Marcos que NÃO existem de propósito

- **"História atual atualizada pelo cliente" foi removido**: `historia_atual.atualizado_em` é regravado pelo autosave do cliente a
  cada pausa na digitação, então não marca nenhum momento histórico. (O texto de `historia_atual.inicio` continua em "Sem data".)
- O `historico_clinico.atualizado_em` também não vira marco, pelo mesmo motivo.
- **"Último envio do histórico clínico (pelo cliente)" fica**: `ultimo_envio` só é gravado no envio explícito
  (`HistoricoClinicoCard.tsx`, botão de enviar); o autosave grava `{ ...dados, atualizado_em }` e só devolve o `ultimo_envio` que já
  estava lá, sem mudar o valor.

## Selos de origem

- O que veio do **cliente** leva **"Relatado pelo cliente, não revisado"**; o que o **profissional** registrou leva **"Registrado
  pelo profissional"**. Nunca o contrário (um teste confere todos os marcos).
- No Completo, o **texto editado à mão pelo profissional** na tela da avaliação ganha a nota **"Editado pelo profissional"** (no
  texto copiado: "(editado pelo profissional)").

## O Completo respeita as edições do profissional

A tela da avaliação mostra `editadas[chave] ?? texto montado pelos campos` (`_secoes.editadas`). O Completo faz o mesmo para as
seções que ele usa **e que a tela deixa editar**: `dor` (chave `dor`), `funcionalidade` (chave `funcionalidade`) e `psicossociais`
(chave `psicossocial`). "Queixa e história" e "Exame e avaliação" vêm de campos que a tela não edita.

- **Editado com texto**: o Completo mostra o texto editado **no lugar** do montado pelos campos, com a nota "Editado pelo
  profissional", e o **Copiar leva o texto editado**. Sem isso o Completo mostraria (e copiaria) dado antigo, por exemplo EVA 7 em
  vez de 4, como se fosse o que o profissional confirmou.
- **Não editado**: monta pelos campos, como antes, sem a nota.
- **Editado e vazio** (o profissional apagou a seção): a seção **some**, como na tela (que esconde seção sem texto). O dado antigo
  dos campos **não volta** e não é copiado.
- Valem as edições feitas na própria sessão (o estado da tela), mesmo antes de a avaliação ser relida do banco.
- Só **lê** o mesmo dado: não reescreve a lógica da tela e não grava nada.

## Duplicidade: o mesmo fato do cliente e do profissional aparece duas vezes, de propósito

Se o cliente relata uma cirurgia no histórico clínico e o profissional registra a mesma cirurgia na história de vida, a linha do
tempo mostra **dois marcos**, cada um com o seu selo (e, em geral, com precisões diferentes: o ano que o cliente escreveu e o dia
que o profissional registrou). **Não há deduplicação.** Juntar os dois esconderia justamente a divergência, que é o que o
profissional precisa enxergar para conferir com o cliente. Um teste registra essa decisão.

## O que NÃO faz

- Não usa IA, não grava nada, não entra no prontuário nem no "Sincronizado".
- Não mostra hipóteses diagnósticas nem red flags no Completo (ficam na aba Quadro/Dx; um texto copiado poderia ser lido como
  diagnóstico). Não mostra o plano. Pelo mesmo motivo, diagnóstico do tipo "suspeita" não vira marco.
- Não classifica ("normal", "alterado", "bom", "ruim") nem interpreta; não reescreve o texto do cliente (aparece inteiro, sem
  corte, com quebra de linha).
- Não lê campos antigos do MyID (`bloco_1_date`, `bloco1.data_inicio_dor`), que a tela atual do cliente não grava.
- Não toca no portal do cliente (`src/pages/paciente/*`) e não muda a visibilidade das notas. Um teste estático confere que os
  arquivos novos não usam `console`, `localStorage`, `sessionStorage`, `document.cookie`, `indexedDB`, `fetch`, `XMLHttpRequest`,
  `WebSocket`, `sendBeacon`, `new Image(`, `window.open`, `.insert(`, `.update(`, `.upsert(`, `.delete(`, `.rpc(`, `functions.invoke`,
  nem importam `src/pages/paciente` ou apontam para rotas `/paciente` do portal; e que só o hook importa o client do Supabase (a camada
  pura e as telas não).
- Não religa `useTimelineCompleta`, `TimelineVidaCompleta`, `TimelineUnificada` nem `ResumoNarrativo` (outras abas).

## Tela

- Todos os botões novos (seletor Resumo | Completo, "Ver todos"/"Ver menos", faixa "Sem data", "Copiar") têm alvo de toque de
  **44 px** (`min-h-11`) e foco visível.
- "Ver todos" e "Sem data" têm `aria-expanded` e `aria-controls` apontando para um id que sempre existe na página.
- O detalhe de cada marco e de cada item sem data mostra o **texto inteiro** (`whitespace-pre-wrap break-words`), sem
  `line-clamp`: o cliente não tem como "ler o resto" e o texto dele passa como foi escrito.
- Enquanto lê as fontes aparece "Montando a linha do tempo…".

## Limites conhecidos

- Se a avaliação por voz existe mas nenhuma seção tem texto ("Nenhuma seção disponível nesta avaliação"), a linha do tempo não
  aparece naquele cartão vazio.
- No Completo, o lápis do cabeçalho continua editando o **Resumo** (não o Completo). **O seletor volta para "Resumo" ao abrir o
  editor do lápis**: durante a edição o seletor some (o editor ocupa o lugar do cartão) e, ao salvar ou cancelar, o cartão volta em
  "Resumo", mesmo que o profissional estivesse no Completo. Um teste registra esse comportamento.
- Só entram no resumo e na linha do tempo o MyID **concluído** mais recente (respostas) e até 20 MyIDs (marcos); as avaliações
  presenciais até 20; história de vida, exames presenciais, testes funcionais, escalas e vínculos do MyID até 50 linhas.
- **Diagnósticos e exames importados leem até 200 linhas** (antes 50), ordenados por data mais recente primeiro e **com os sem data por
  último**. Acima de 200 o corte é feito no banco e **a tela não avisa**: saem primeiro as linhas sem data (a faixa "Sem data" pode ficar
  incompleta) e depois as de data mais antiga. É raro (200 diagnósticos ou exames de um só paciente), e subir mais o limite pesaria a
  leitura de todo perfil aberto.
- O diagnóstico cuja data real coincide por acaso com o dia do cadastro vai para "Sem data" (ver "A data do diagnóstico que o banco
  preenche sozinho").
- "MyID concluído" só aparece com a ligação ao histórico (`avaliacoes_identidade`); sem ela, "MyID (último registro)".

## Onde está no código

- Camada pura (sem React nem Supabase): `src/lib/resumoClinico/` (`tipos`, `leitura`, `datas`, `marcos`, `resumoCompleto`).
- Dados: `src/hooks/useFontesClinicas.ts`.
- Telas: `src/components/resumoClinico/` (`ResumoClinicoVisoes`, `ResumoCompleto`, `LinhaDoTempoClinica`, `SeloDeOrigem`,
  `AvisoDeFalhas`).
- Encaixe (poucas linhas): `AvaliacaoSecoesEditaveis.tsx` (o cartão do Resumo passa pelo seletor; a linha do tempo entra no fim
  da aba Clínico) e `AvaliacaoVozAtual.tsx` (sem avaliação por voz, ou com a gravação ainda aberta, a linha do tempo aparece).
- Banco falso dos testes: `src/test/helpers/bancoFalso.ts` ganhou projeção de coluna jsonb com apelido
  (`origem:resultado->_meta->>origem`), como o PostgREST; é aditivo e tem teste em `src/test/bancoFalso.test.ts`.
- Testes: `src/test/resumoClinico*.test.ts(x)` (marcos, datas, completo, leitura, tela, privacidade) e
  `src/test/useFontesClinicas.test.tsx`. As regras da data do diagnóstico, da data do exame importado e da data do MyID estão em
  `resumoClinicoMarcos.test.ts` e `resumoClinicoDatas.test.ts`; o limite de 200 e a leitura dos vínculos do MyID, em
  `useFontesClinicas.test.tsx`.

## Etapas futuras (não fazem parte desta)

1. **IA com revisão**: texto do Completo e marcos sugeridos por IA, sempre revisados pelo profissional antes de valer (e só com
   decisão sobre qual provedor pode receber dado de saúde).
2. **Liberar ao cliente Premium**: o profissional libera uma versão **revisada** (hoje o que veio do cliente está "não revisado").
   Vai exigir guardar a versão liberada e a revisão, o que esta etapa evita de propósito.
