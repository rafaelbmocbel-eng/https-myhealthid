# Análise angular em foto: catálogo de medidas e marcação automática

Aplicações › Análise angular, aba "Postura em foto". Este arquivo descreve **cada medida**: em que vistas existe,
quais pontos pede, se o app sugere os pontos sozinho, o que o modelo de pose **realmente** marca, o que a medida
devolve, a cautela de uso e o que a evidência sustenta. Código: `src/lib/angular/medidas.ts` (catálogo),
`pose.ts` (marcação automática), `analise.ts` (resultados e arquivo), `desenho.ts` (como é desenhada),
`src/components/angular/iconesMedida.ts` (ícones). Testes: `src/test/angularMedidasSessao.test.ts`.

> É **apoio à avaliação do profissional**. O app mostra o valor medido, o lado e, na comparação, a variação
> numérica. **Não diagnostica, não dá nota e não traz valor de referência**: nenhuma faixa "normal" entra sem
> fonte verificada. Quem interpreta é o profissional.

## 1. Princípios que valem para todas as medidas

- **Estimativa.** A pose por foto de celular erra alguns graus (RMSE de 4,95 a 7,81° no plano sagital da corrida
  com OpenPose, PMID 36680411; 15,49° no joelho parado com BlazePose Heavy, PMID 42976294). O texto de tela diz
  "estimativa" e "confirmar". Não prometer precisão clínica nem substituir goniômetro.
- **Quais medidas levam "estimativa: confirme" (tela e PDF).** Cotovelo, braço, carregamento, punho e escápula (o erro do
  modelo nesses pontos não foi medido); pelve e quadris de frente e de costas (PMID 33636458 e PMID 30005426); joelho de
  perfil (PMID 42976294); e a linha dos joelhos, que usa os mesmos centros articulares do modelo, sem validação em foto.
  O joelho de frente e de costas (`joelho-d`, `joelho-e`) e a pelve de perfil ficam sem a marca. A lista é
  `ehMedidaParaConfirmar`, em `src/lib/angular/sessao.ts`.
- **Como os pontos foram marcados (nota do prontuário e PDF).** O texto conta, por posição, em quantas medidas o modelo
  sugeriu os pontos, quantas dessas o profissional ajustou à mão e quantas ele marcou só à mão desde o início ("Pontos
  sugeridos por detecção automática (confirmar na foto) em 3 medidas, 1 ajustada à mão; 2 medidas marcadas só à mão.").
  Conta medidas (o que se marca na foto), não números: o fio de prumo vale uma medida. Nunca diz que o profissional
  conferiu os pontos, porque o aplicativo não verifica isso.
- **O modelo marca centros articulares, não pontos ósseos.** Onde a clínica usa acrômio, epicôndilo, maléolo,
  trocânter, crista ilíaca, tragus, C7 ou escápula, o modelo dá o centro da articulação (ou a orelha). Por isso toda
  sugestão é só ponto de partida: o profissional confere e arrasta. (Premissa do repositório; o erro do modelo
  *lite* nesses pontos não foi medido.)
- **Só medida e lado.** Texto neutro, sem "normal", "alterado", "melhora" ou "piora". Pequenas assimetrias são
  frequentes em adultos jovens (PMID 21807260) e não devem ser tratadas como alteração por si só.
- **Para comparar avaliações:** mesma distância e altura da câmera, mesma roupa, mesma posição e, de preferência, o
  mesmo avaliador (a concordância entre avaliadores é menor que a do mesmo avaliador, PMID 29281461).
- **Sem valor de referência.** O ângulo de carregamento de 11,5° de um estudo vem de 16 quadros de tenistas de elite
  (PMID 38226669) e não é referência populacional.

## 2. Como a marcação automática funciona

### Arquitetura

Cada `Medida` pode ter:

| Campo | Para que serve |
|---|---|
| `sugerir(lm, { w, h, vista, lado })` | Devolve `{ pontos, origem? }` (os primeiros pontos da medida; o resto é à mão), `{ motivo }` se faltou algum ponto confiável, ou `null` se a medida não se aplica (ex.: o braço do lado de trás da câmera num perfil). |
| `origemSugestao` | Texto curto do que o modelo marca ("centro do ombro (modelo)"), mostrado junto da sugestão. |
| `semAuto` + `motivoSemAuto` | A medida só se marca à mão, de propósito, e por quê. |

Toda medida de postura tem `sugerir` **ou** `semAuto` (há teste que trava isso). O fio de prumo é a exceção: tem
função própria (`pontosDoPrumo`).

```ts
sugerirPontos(lm, vista, w, h, lado?, opcoes?: { inverterDE?: boolean }): {
  sugeridos: Record<string, Ponto[]>;                 // por id da medida, na ordem de marcação
  descartados: { medidaId: string; motivo: string }[]; // "não achei o cotovelo direito"
  avisos: string[];                                    // "confira o lado", "o modelo pode ter trocado direito e esquerdo"
  origens: Record<string, string>;                     // de onde veio cada sugestão
  ladoUsado?: 'D' | 'E';                               // só no perfil
}
pontosAutomaticos(lm, vista, w, h, lado?)  // só o dicionário `sugeridos` (compatível com o uso antigo)
pontosDoPrumo(lm, vista, w, h, lado?)      // { medidaId, pontos, olhaPara?, avisos } ou null
```

`sugerirPontos` percorre `medidasDaVista(vista)` na ordem do array `MEDIDAS`. Medida sem ponto confiável vai para
`descartados` com o motivo, em vez de sumir em silêncio. Os motivos vêm no formato "não achei o cotovelo direito",
"não achei o joelho direito e o tornozelo direito", "não achei as orelhas nem os olhos".

### Pontos do modelo que o app usa (33 pontos do MediaPipe; direito e esquerdo são os do paciente)

| Parte | Direito / esquerdo | Usada em |
|---|---|---|
| Nariz | 0 | só para saber para onde o paciente olha (aviso do perfil e fio de prumo) |
| Olhos | 5 / 2 | cabeça, quando a orelha não aparece |
| Orelhas | 8 / 7 | cabeça, ângulo craniovertebral (no lugar do tragus), fio de prumo |
| Ombros | 12 / 11 | ombros, braço, cotovelo, tronco |
| Cotovelos | 14 / 13 | cotovelos, braço, cotovelo de perfil |
| Punhos | 16 / 15 | cotovelo de perfil |
| Quadris | 24 / 23 | quadris, tronco, joelho |
| Joelhos | 26 / 25 | joelho, linha dos joelhos, perna |
| Tornozelos | 28 / 27 | joelho, linha dos tornozelos, perna, apoio do fio de prumo |

**Não usados:** mãos (17 a 22), calcanhares (29/30), pés (31/32), boca. As mãos não dão o eixo da mão (só mínimo,
indicador e polegar), por isso `punho-d/e` é à mão. Calcanhar e pé não entram em nenhuma medida automática: o
retropé tem 4 pontos e o calcanhar seria só o de baixo do calcâneo, o que não vale mudar a ordem dos pontos.

### Regras

- Um ponto com visibilidade **abaixo de 0,5** não é usado (com 0,5 exato é usado); sem visibilidade informada vale
  como visível.
- A sugestão pode ser **parcial**: os rótulos dos pontos da medida começam pelos pontos sugeríveis. Exemplo: no
  ângulo craniovertebral o tragus (orelha) vem primeiro e o C7 fica à mão; a medida só calcula depois do C7.
- `cabeca` usa as orelhas e, se alguma não aparecer, os dois olhos (nunca mistura orelha de um lado com olho do
  outro). O ângulo craniovertebral **não** usa o olho: ele não substitui o tragus.
- **Sanidade de direito e esquerdo** (frente e costas): de frente o ombro direito do paciente fica à ESQUERDA do
  ombro esquerdo na imagem; de costas, o contrário. Sem ombros, vale o quadril. Se não bater (e os pontos estiverem a
  pelo menos 2% da largura um do outro), vem o aviso "O modelo pode ter trocado direito e esquerdo..." e a opção
  `inverterDE: true` (usa `trocarDireitaEsquerda`) refaz a sugestão com os lados trocados. Não há teste com foto real
  de costas: a troca nas costas é risco **não confirmado**.

## 3. Perfil: lado, para onde o paciente olha e avisos

- `ContextoMedida.lado`, `AnaliseFoto.lado` e `AnaliseFotoJson.lado` (`'D' | 'E'`) existem **só no perfil**. É o
  lado do paciente **voltado para a câmera**: no perfil direito vê-se o lado direito.
- **Perfil sem lado** (nota antiga) é "lado não informado": mede como antes, usa o lado mais visível para sugerir (com
  aviso "Lado do perfil não informado: usei o lado ... Confira.") e nunca é tratado como D nem como E.
- **Para onde o paciente olha (padrão pelo lado) — suposição geométrica a validar com foto real:** o paciente de
  frente para o norte; a câmera no leste (lado direito dele) olha para o oeste; quem olha para o oeste tem o norte à
  sua direita. Logo, **perfil D: o paciente aparece olhando para a DIREITA da imagem; perfil E: para a ESQUERDA.**
  `olhaParaDoLado(lado)` e `opcoesPadraoDoLado(lado)` carregam essa regra num lugar só. O profissional pode corrigir em
  "para onde o paciente olha" e a escolha dele vale sempre (`olhaParaDoContexto`: o `olhaPara` do contexto manda; sem
  ele, decorre do lado).
- **Avisos "Confira o lado"** (o lado informado sempre vale, o app só avisa): (1) se a soma da visibilidade de ombro,
  quadril, joelho e tornozelo do outro lado for **pelo menos 1,0 maior** (quatro pontos); (2) se o nariz apontar para
  o lado oposto ao esperado para esse perfil (com pelo menos 2% da largura de diferença em relação à orelha).
- `nomeArquivoImagem(vista, data, extensao, lado)` inclui o lado no perfil: `analise-angular-perfil-direito-AAAA-MM-DD.png`.
- O sentido das medidas de perfil (flexão, à frente, atrás) depende desse "para onde olha". Sem lado e sem
  `olhaPara`, a medida mede e **não diz** o sentido.

## 4. Vocabulário fixo de "sentido"

O comparador (`comparar.ts`) pareia as avaliações por estas palavras: se o sentido mudou de uma avaliação para a
outra, a variação numérica não é calculada ("lado trocado"). **Nunca troque por sinônimo nem mude a grafia.**
Estão em `SENTIDO` (`medidas.ts`) e há teste que trava a lista.

| Palavra | Onde aparece | Regra |
|---|---|---|
| `valgo` / `varo` | retropé, joelho de frente e de costas, ângulo de carregamento do cotovelo | Joelho: valgo = joelho para dentro da linha quadril–tornozelo (a perna desvia para fora do prolongamento da coxa). Cotovelo: valgo = antebraço desviado para fora do prolongamento do braço. Retropé: valgo = parte de baixo do calcanhar para fora da reta da perna. Varo é o oposto. |
| `flexão` / `hiperextensão` | joelho de perfil, cotovelo de perfil | Joelho: à frente da linha quadril–tornozelo (olhando para a direita, à direita da linha) = flexão. Cotovelo: o antebraço desvia para a frente do prolongamento do braço = flexão. |
| `afastado do tronco` / `junto do tronco` | alinhamento do braço (frente e costas) | cotovelo para fora ou para dentro do ombro na imagem, pelo lado do paciente. |
| `cotovelo à frente` / `cotovelo atrás` | alinhamento do braço (perfil) | cotovelo à frente ou atrás do ombro, conforme para onde o paciente olha. |
| `joelho à frente` / `joelho atrás` | perna contra a vertical (perfil) | joelho à frente ou atrás do tornozelo. |
| `mão para fora` / `mão para dentro` | alinhamento antebraço-mão | mão desviada para fora ou para dentro do prolongamento do antebraço. |

Como o lado do corpo aparece na imagem (`ladoLateralNaImagem`): **de frente** o lado direito do paciente fica à
esquerda da imagem; **de costas**, à direita. O "para fora" de cada membro sai daí. O desvio de um segmento
(`ladoDoDesvio`, produto vetorial) só diz o lado quando o segmento de cima está a **menos de 45° da vertical**; com o
braço ou o antebraço deitado na foto, "esquerda" e "direita" da imagem deixam de querer dizer "fora" e "dentro" e o
app mede sem dizer o lado.

Os **desníveis** (ombros, cotovelos, quadris, joelhos, tornozelos, escápulas, cabeça) não usam `sentido`: o lado vem
no texto ("lado direito mais alto"), que o comparador lê. O **valor gravado** de `joelho-d/e` continua sendo o ângulo
interno (180° = reta), para as notas antigas continuarem comparáveis.

## 5. Catálogo

A ordem de exibição é a ordem do array `MEDIDAS`. "Auto" = o app sugere os pontos; "À mão" = só se marca à mão.
Cada resultado tem nome reconhecido por `nomeDoResultado` e ícone em `ICONE_MEDIDA`.

### Ombros e membros superiores

| id | Nome | Vistas | Pontos (ordem) | Sugestão | O que o modelo marca | Devolve |
|---|---|---|---|---|---|---|
| `ombros` | Desnível dos ombros | frente, costas | acrômio D, acrômio E | Auto (11/12) | centro do ombro, não o acrômio | ângulo com a horizontal e lado mais alto; **`ombros-cm`** (extra, em cm, só com escala) |
| `cotovelos` | Desnível dos cotovelos | frente, costas | cotovelo D, cotovelo E | Auto (13/14) | centro do cotovelo, não o epicôndilo | ângulo com a horizontal e lado mais alto |
| `braco-d`, `braco-e` | Alinhamento do braço direito / esquerdo | frente, costas, perfil | ombro, cotovelo | Auto (11/13 ou 12/14). No perfil, só o braço do lado da câmera; o outro fica atrás do corpo e não é sugerido nem listado em `descartados` | centro do ombro e do cotovelo | ângulo ombro→cotovelo com a vertical para baixo (0° para baixo, 90° horizontal, 180° para cima) + `afastado/junto do tronco` (frente, costas) ou `cotovelo à frente/atrás` (perfil) |
| `cotovelo-perfil` | Flexão/extensão do cotovelo | perfil | ombro, cotovelo, punho | Auto (11/13/15 ou 12/14/16, do lado do perfil) | centro do ombro, do cotovelo e do punho | desvio do antebraço em relação ao prolongamento do braço (0° = braço estendido) + `flexão` ou `hiperextensão` |
| `carregamento-d`, `carregamento-e` | Ângulo de carregamento do cotovelo (estimativa por foto) | frente | ombro, cotovelo (meio entre os epicôndilos), punho (meio entre as estiloides) | **À mão, de propósito** (o desvio é pequeno e o erro do modelo nesse ponto não foi medido) | — | desvio do antebraço em relação ao prolongamento do braço + `valgo`/`varo`, e "Confirmar com goniômetro" no texto |
| `punho-d`, `punho-e` | Alinhamento antebraço-mão | frente, costas | cotovelo, punho, eixo da mão (cabeça do 3º metacarpo) | À mão (o modelo não marca o eixo da mão) | — | ângulo entre o prolongamento do antebraço e o eixo da mão + `mão para fora/dentro` |
| `escapulas` | Desnível dos ângulos inferiores das escápulas | costas | ângulo inferior D, E | À mão (o modelo não marca a escápula) | — | ângulo com a horizontal e lado mais alto |

Cautelas desta região:

- **Braço:** vale para a posição parada, com o braço relaxado. No plano da imagem, o ângulo do cotovelo por
  BlazePose teve erro médio de 2,18° na faixa de 0 a 62°, em tarefa sentada e offline (PMID 42655364): é o suporte
  mais próximo, e não cobre ângulos maiores. A altura do ombro numa vista frontal única foi o sinal mais fraco do
  mesmo estudo: conferir os pontos dos ombros.
- **Carregamento:** a definição diz "estimativa por foto, com o cotovelo estendido e a palma para a frente: confirmar
  com goniômetro". A evidência é um único estudo em quadros de vídeo (16 quadros, tenistas de elite, ICC 0,703,
  PMID 38226669), sem validação contra goniômetro e **sem estudo por foto de celular**. Não há sugestão automática
  ligada, nem valor de referência.
- **Punho:** com a palma para a frente, o desvio é radial (fora) ou ulnar (dentro); com a palma voltada para a coxa, a
  foto de frente mostra flexão ou extensão do punho e **o app não sabe a rotação do antebraço**. Marcar de preferência
  com adesivo na pele.
- **Escápulas:** marcar por palpação, de preferência com marcador na pele. A posição parada não mostra o comportamento
  da escápula no movimento. Não há validação de escápula por foto de celular, e rotação e posição da escápula não
  devem ser prometidas.
- **Cotovelo de perfil:** é estimativa no plano da foto; o sentido depende de "para onde o paciente olha".

### Cabeça, coluna e tronco

| id | Nome | Vistas | Pontos (ordem) | Sugestão | O que o modelo marca | Devolve |
|---|---|---|---|---|---|---|
| `cabeca` | Inclinação da cabeça | frente, costas | orelha (ou olho) D, E | Auto (orelhas 7/8; olhos 2/5 se a orelha não aparecer) | orelha, não o tragus; olho como alternativa | ângulo com a horizontal e lado mais alto |
| `tronco` | Alinhamento do tronco | frente, costas | C7, ponto médio entre os pés ou da pelve | Auto, com troca: ponto médio dos ombros no lugar do C7 e ponto médio dos quadris | não marca o C7 | desvio da vertical e lado do pescoço (esquerda ou direita da imagem) |
| `prumo-frente` | Fio de prumo (frente e costas) | frente, costas | apoio, cabeça, C7, pelve | por `pontosDoPrumo` (tornozelos, orelhas, ombros, quadris) | centros articulares | desvio de cada ponto até o fio (graus, cm ou % da altura) |
| `cva` | Ângulo craniovertebral | perfil | **tragus**, C7 (ordem trocada: o tragus vem primeiro) | Parcial: só o tragus, pela orelha (7/8) do lado do perfil; o C7 é à mão | orelha no lugar do tragus | ângulo da reta C7–tragus com a horizontal |
| `protracao-ombro` | Protração do ombro (C7–acrômio) | perfil | C7, acrômio | À mão (pontos ósseos) | — | ângulo da reta C7–acrômio com a horizontal |
| `tronco-perfil` | Inclinação do tronco | perfil | ombro, quadril | Auto (lado do perfil) | centro do ombro e do quadril, não o acrômio nem o trocânter | desvio da vertical |
| `cifose` | Cifose torácica (estimativa de superfície, não é Cobb) | perfil | 4 pontos: 2 por reta, nas pontas da curva torácica | À mão (o modelo não marca a coluna) | — | ângulo agudo entre as duas retas (0 a 90°) |
| `lordose` | Lordose lombar (estimativa de superfície, não é Cobb) | perfil | 4 pontos: 2 por reta, nas pontas da curva lombar | À mão | — | ângulo agudo entre as duas retas (0 a 90°) |
| `pelve-perfil` | Inclinação pélvica (perfil) | perfil | EIPS, EIAS | À mão (o modelo não marca EIAS nem EIPS) | — | ângulo com a horizontal, `anterior` ou `posterior` |
| `prumo-perfil` | Fio de prumo (perfil) | perfil | apoio, orelha, ombro, quadril, joelho | por `pontosDoPrumo` (lado informado) | centros articulares | desvio de cada ponto, positivo à frente do fio |

Cautelas: **cifose e lordose** dizem "estimativa de superfície, não é Cobb" no nome, na definição e no texto do
resultado; o Cobb de referência é o da radiografia; usar marcadores na pele. A inclinação lateral do tronco e da
cabeça foi bem detectada pelo BlazePose frontal (PMID 42655364), e a posição lateral do tronco em vídeo 2D teve
confiabilidade excelente (PMID 30005426); protração do ombro e inclinação do tronco têm os maiores erros padrão em
foto (PMID 22265387) e o ângulo do ombro no perfil teve ICC de 0,78 no mesmo avaliador (PMID 25467608).

### Pelve e quadril

| id | Nome | Vistas | Pontos | Sugestão | O que o modelo marca | Devolve |
|---|---|---|---|---|---|---|
| `pelve` | Desnível da pelve | frente, costas | crista ilíaca (ou espinha) D, E | **À mão** | não marca a crista ilíaca | ângulo com a horizontal e lado mais alto |
| `quadris` | Linha dos quadris (sugerida pelo modelo) | frente, costas | quadril D, E (centro da articulação) | Auto (23/24) | centro do quadril, não a crista nem o trocânter | ângulo com a horizontal e lado mais alto |

Antes, a sugestão automática preenchia `pelve` com os quadris, o que o nome não dizia. Agora são **duas medidas**:
`quadris` (automática) e `pelve` (cristas, à mão). Não misturar as duas na comparação. Plano frontal de pelve e
quadril tem confiabilidade ruim ou heterogênea em pose (ICC ruim com vieses em PMID 33636458; queda pélvica com ICC de
0,59 a 0,77 em PMID 30005426): mostrar com "confirmar".

### Joelhos, pernas e pés

| id | Nome | Vistas | Pontos | Sugestão | O que o modelo marca | Devolve |
|---|---|---|---|---|---|---|
| `joelho-d`, `joelho-e` | Joelho direito / esquerdo | frente, costas | quadril, joelho, tornozelo do lado | Auto (23/25/27 ou 24/26/28) | centros articulares, não o trocânter, a interlinha nem o maléolo | ângulo interno (180° = reta) + `valgo`/`varo` |
| `linha-joelhos` | Linha dos joelhos (desnível) | frente, costas | joelho D, E | Auto (25/26) | centro do joelho, não a interlinha | ângulo com a horizontal e lado mais alto |
| `angulo-q-d`, `angulo-q-e` | Ângulo Q | frente | EIAS, centro da patela, tuberosidade da tíbia | À mão | — | ângulo entre as retas EIAS–patela (prolongada) e patela–tuberosidade |
| `linha-tornozelos` | Linha dos tornozelos (desnível) | frente, costas | tornozelo D, E | Auto (27/28) | centro do tornozelo, não o maléolo | ângulo com a horizontal e lado mais alto |
| `retrope-d`, `retrope-e` | Retropé | costas | 2 pontos da perna, 2 do calcâneo | À mão | — | ângulo + `valgo`/`varo` |
| `joelho` | Ângulo do joelho | perfil | quadril, joelho, tornozelo | Auto (lado do perfil) | centros articulares | ângulo interno + `flexão`/`hiperextensão` |
| `perna-vertical` | Perna contra a vertical (joelho–tornozelo) | perfil | joelho, tornozelo | Auto (lado do perfil) | centro do joelho e do tornozelo | ângulo da reta joelho→tornozelo com a vertical para baixo + `joelho à frente/atrás` |

Valgo e varo do joelho saem do produto vetorial entre a coxa e a perna, com o cuidado do lado e da vista (o teste
cobre os quatro casos: direito e esquerdo, de frente e de costas). No perfil, o joelho parado com BlazePose Heavy teve
RMSE de 15,49° em câmera lateral de celular (PMID 42976294) e o modelo *lite* do produto não foi avaliado: confirmar
sempre.

### Ferramentas e referências (não são medidas de postura)

Ângulo livre, compasso, compasso com referência, ângulo de uma reta, ângulo entre retas (tipo Cobb), régua; e as
referências auxiliares nível, escala e altura. Não têm sugestão automática e não entram no resultado quando são
auxiliares.

## 6. O que a evidência sustenta e o que não prometer

**Pode afirmar** (com "estimativa" e "confirmar"): a fotogrametria estática tem boa confiabilidade quando o **mesmo
avaliador** repete, e uma foto bem posicionada por vista representa a postura em pé (PMIDs 31262579, 29281461,
25467608); o protocolo publicado usa três vistas com marcadores (PMID 21807260), o que respalda frente, perfis e costas;
a pose 2D é aproximada e a concordância depende do plano, da articulação, da tarefa e da pessoa (PMIDs 40526450,
36680411).

**Não prometer:** precisão clínica ou "alta precisão"; substituição de goniômetro, de foto com marcadores ou de análise
3D; decisão longitudinal precisa; diagnóstico, nota, escore ou valor de referência de postura ou de carregamento do
cotovelo; medida de rotação (plano transversal) ou de posição da escápula; que o mesmo resultado sai de avaliadores ou
de configurações de câmera diferentes. Sem marcadores físicos, os pontos automáticos do MediaPipe **não são um "SAPO
validado"**.

**Lacunas declaradas** (não encontradas na busca): nenhuma validação do MediaPipe *lite* em foto estática ou corrida;
nenhum estudo de ângulo de carregamento por foto de celular contra goniômetro; nenhuma validação de escápula por foto.

## 7. O que foi cortado ou não foi feito, e por quê

- **Retropé automático:** o calcanhar (29/30) é só 1 dos 4 pontos; fica à mão.
- **Ângulo de carregamento automático:** desligado de propósito (`semAuto`): o desvio é pequeno e o erro do modelo no
  cotovelo e no punho não foi medido. Só à mão, com "confirmar com goniômetro".
- **Punho e escápula automáticos:** o modelo não tem o eixo da mão nem a escápula.
- **Não incluídos:** arco plantar e ângulo de progressão do pé (pedem foto dedicada do pé; o modelo não tem o
  navicular); espaço entre o tronco e o braço em cm e distância entre joelhos ou maléolos em cm (baixa prioridade;
  a régua e a escala já medem distâncias); borda medial da escápula em cm; rotação do úmero e posição das mãos (rotação
  não é medida em foto 2D; use a observação livre).
- **Perfil sem lado:** não há sugestão do outro braço; o lado mais visível é usado com aviso.

## 8. Compatibilidade com dados antigos

- Os ids anteriores continuam (`ombros`, `pelve`, `joelho-d`, `cva`...). Notas antigas de joelho de frente não têm
  `sentido`: o comparador só deixa de subtrair quando **os dois** têm sentido e ele mudou.
- O título da nota é só "Análise angular — vista <posição>", sem "(n de total)": a ordem e as posições previstas ficam em
  `dados_extras.sessao`. Notas gravadas antes com "(n de total)" continuam válidas; nada lê o título.
- `pelve` deixou de receber sugestão do modelo; o resultado sugerido agora é `quadris`.
- `cva`: os pontos trocaram de ordem (tragus, depois C7). O valor só usa o ângulo com a horizontal e os pontos não são
  gravados, então as notas antigas não mudam.
- `ombros-cm` é um **resultado a mais** (`ResultadoAnalise.medidaId === 'ombros'`, `unidade: 'cm'`), depois do
  `ombros` em graus; o rótulo desenhado na foto continua sendo o dos graus.
- Contrato aditivo: nenhuma nota antiga deixa de ser lida.

## 9. A validar com foto real

1. Para onde o paciente olha em cada perfil (seção 3): a regra é geométrica e nunca foi conferida com foto real de cada lado.
2. O rótulo direito e esquerdo do modelo **nas costas** (o teste de sanidade avisa, mas não há foto real de costas nos testes).
3. Os sinais de valgo, varo, flexão e à frente/atrás com uma foto real de cada caso (os testes usam pontos sintéticos
   com geometria conhecida).
4. Os limiares: visibilidade 0,5, diferença clara entre os lados de 1,0 e folga de 2% da largura são heurísticas.
5. O erro do modelo *lite* em cotovelo, punho e quadril na foto parada.

## 10. Como acrescentar uma medida nova

1. Inclua a `Medida` em `MEDIDAS`, na posição em que deve aparecer (a ordem do array é a ordem da tela e do comparador).
2. Dê `sugerir` + `origemSugestao` **ou** `semAuto` + `motivoSemAuto`. Ponha os pontos sugeríveis primeiro.
3. Se disser um sentido, use só palavras de `SENTIDO`; se precisar de palavra nova, acrescente a `SENTIDO`, ao teste
   que trava a lista e a esta tabela, e avise quem cuida do comparador.
4. Definição neutra: o que o modelo marca, a cautela e "sem classificação". Sem valor de referência.
5. Ícone em `ICONE_MEDIDA` (e a letra em `LADO_MEDIDA` se o id terminar em `-d` ou `-e`).
6. Testes com pontos sintéticos de geometria conhecida, dos dois lados e das vistas em que a medida vale; depois
   desfaça a correção por um instante e confirme que o teste falha.
