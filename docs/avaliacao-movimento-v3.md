# Avaliação biomecânica do movimento — Etapa 3 (especificação)

Decisão do Rafael (18/10/2026): a análise de vídeo serve para **auxiliar a avaliação
biomecânica do movimento pelo profissional de saúde**. Não é um personal trainer
virtual e não treina o cliente.

Referência funcional estudada: o app Bodypark (vídeos de demonstração do canal
Insider Physical Therapy). Usado apenas como referência de fluxo e de organização
da informação, sem cópia de código, texto ou marca.

## O que a Etapa 3 é

- Mede ângulos, deslocamentos e simetria durante um movimento, por fase e por repetição.
- Mostra como a medida varia entre repetições, entre os lados e entre avaliações.
- Gera um laudo para o profissional com os achados medidos, as possíveis causas
  (hipóteses com referência) e o que conferir na avaliação presencial.

## O que a Etapa 3 NÃO é

- Treino guiado, contagem de repetições como meta, notas "perfeito/bom", pontuação
  de desempenho, ranking, gamificação.
- Avisos em tempo real ou por voz ao cliente durante o exercício.
- Montagem de treino, registro de carga/volume, "mapa de calor" de ativação muscular
  (estimativa sem validação por câmera).
- Diagnóstico. O laudo apresenta hipóteses para o profissional confirmar.

## Vocabulário

Usar "dentro do critério", "no limite", "fora do critério" e "sem referência".
Nunca "certo/errado", "perfeito/bom", "falha". O veredito só existe quando houver
limite com fonte confirmada ou critério definido pelo profissional; sem isso, a
medida aparece como observação.

## Estrutura de um protocolo de movimento

Cada movimento avaliado é um perfil com:

1. **Fases** (por exemplo: em pé, descida, ponto mais baixo, subida), usadas para
   segmentar as repetições e extrair as medidas em instantes comparáveis.
2. **Medidas** por fase (ângulos, deslocamentos, índice de assimetria entre os lados,
   variação entre repetições), cada uma com o plano de câmera necessário.
3. **Achados nomeados**, cada um com: regra de detecção, texto curto para o
   profissional, **possíveis fatores contribuintes** (cada um com referência
   verificada ou marcado "a confirmar"), e o que conferir na avaliação presencial.
4. **Limitações** que entram no laudo: medida 2D só vale no plano filmado; erro de
   um quadro; diferença menor que a incerteza não é achado; pontos que o modelo de
   pose não mede (por exemplo, curvatura lombar).

Primeiros movimentos: agachamento (de lado e de frente) e marcha, que já têm modelo
de gesto. Os demais (avanço, descida de degrau, aterrissagem, sentar e levantar,
ombro) entram depois, cada um só com critérios que tenham fonte ou que o
profissional defina.

## Laudo

- Para o profissional: achados por repetição e por lado, gráfico ângulo × tempo,
  hipóteses com referência, o que conferir, limitações da medida, identificação do
  vídeo, data e responsável pela revisão.
- Para o cliente (se o Rafael decidir): versão em linguagem simples, liberada pelo
  profissional.
- Cruzamento com o histórico clínico e o MyID só com consentimento.
- Todo texto gerado por IA é montado sobre medidas e referências já existentes; a IA
  não acrescenta causa que não esteja na biblioteca curada.

## Salvaguardas

- Rosto desfocado por padrão; vídeo só guardado com consentimento (LGPD).
- Alegações de precisão só com validação própria (medida automática contra medida
  manual), nunca copiadas de terceiros.
- Critérios debatidos na literatura (por exemplo, limite de avanço do joelho no
  agachamento e no avanço) ficam desligados por padrão e só viram veredito quando o
  profissional ou o time científico ativar.

## Decisões em aberto (do Rafael)

1. Quem vê o laudo: só o profissional, ou o cliente também?
2. O laudo é Premium ou vale para todos?
3. Quem define os critérios de cada movimento: o Rafael, o time científico, ou só
   os que tiverem fonte?

Enquanto não houver decisão, o protótipo é visível só para o profissional.

## Implementação (Etapa 3, primeira fatia)

Primeira fatia: agachamento (vista lateral e vista frontal) e marcha (vista lateral). Tudo roda no dispositivo: nenhuma chamada
de rede nova, nenhum envio de vídeo e **nenhum modelo de linguagem** (o texto do laudo vem de modelos de frase, para ser
testável). A interface fica em Aplicações > Análise angular > Análise em vídeo, rotulada "beta", e reaproveita o motor de
`src/lib/angular/video/*` (rastreio, ângulos, suavização, eventos, correção manual).

### Mapa de arquivos e donos

Código novo em `src/lib/angular/movimento/` (módulos puros, sem React).

| Arquivo | Dono | Conteúdo |
| --- | --- | --- |
| `tipos.ts` | Arquiteto | Todos os tipos do contrato (protocolo, repetição, medida, achado, critério, fonte, fator, laudo). Só tipos. |
| `vocabulario.ts` | Arquiteto | Rótulos (situação, força da evidência, lado, plano) e `termoProibido` (certo, errado, normal, perfeito, falha...). |
| `protocolos.ts` | Arquiteto | Catálogo dos 13 achados, os 5 gatilhos (`GATILHOS`), os 3 protocolos (`PROTOCOLOS`), fórmulas da incerteza e auxiliares (`protocoloDo`, `protocolosDoGesto`, `achadosAvaliaveis`, `indisponiveisDoProtocolo`, `formulaDaIncerteza`). |
| `criterios.ts` | Arquiteto | Critério do profissional: `novoCriterio` (sempre desligado), `criterioAplicavel`, `criterioValidoNoProtocolo`, `avaliarCriterio` (dentro, no limite, fora). |
| `analisarMovimento.ts` | M | `analisarMovimento(protocolo, trilha, opcoes?)`: repetições, medidas por repetição e por lado, resumos, incerteza, achados. |
| `laudo.ts` | L | `montarLaudo(analise, contexto, biblioteca?)`: laudo estruturado, textos determinísticos. |
| `laudoPdf.ts` | L | `gerarPdfLaudo(laudo)`: PDF com jsPDF, no padrão de `relatorioVideo.ts`, rodapé fixo "Estimativa por vídeo · não é diagnóstico". |
| `biblioteca/` | R | `BIBLIOTECA` e `entradaDaBiblioteca(chave)`: fatores contribuintes e itens a conferir, cada um com fonte verificada ou marcado "a confirmar". |
| `index.ts` | Arquiteto | Reexporta tudo (importar `laudoPdf` sob demanda na tela, para o jsPDF não entrar no pacote principal). |
| `src/test/movimentoContrato.test.ts` | Arquiteto | Teste de contrato: protocolos, catálogo, gatilhos, critérios, vocabulário e regras da biblioteca. |
| Tela em `src/components/angular/video/` | Interface | Escolha do protocolo, tabela por repetição e por lado, achados, critério do profissional, laudo e PDF. |

### Fluxo de dados

```
vídeo → rastrearVideo → TrilhaPose (motor ../video; pontos corrigidos pelo profissional)
      → analisarMovimento(protocolo, trilha, { criterios, escalaCmPorPixel, eventos? })   → AnaliseMovimento
      → montarLaudo(analise, contexto, BIBLIOTECA)                                        → LaudoMovimento
      → tela (renderiza as seções do laudo)  |  gerarPdfLaudo(laudo) → Blob (PDF)
```

O plano de câmera é uma propriedade **declarada** pelo protocolo escolhido (`planoFilmado`); o rastreio é o mesmo para todos.
Achado que exige o outro plano não é calculado: vira `indisponiveis`, com o motivo e o que gravar para obtê-lo
(`indisponiveisDoProtocolo`), e a tela avisa.

### Regras do contrato que os construtores precisam respeitar

- **Repetições e marcos.** Toda repetição tem três marcos (`inicio`, `fundo`, `fim`). No agachamento, `fundo` é o ponto mais baixo;
  na marcha, uma repetição é uma passada (contato do pé até o contato seguinte do mesmo pé) e `fundo` é a saída do pé. As fases
  são janelas entre marcos; cada medida declara a fase e a extração (`valor_no_marco`, `maximo`, `amplitude`, `media`, `duracao`).
- **Alinhamento.** Cada array de `MedidaPorRepeticao.valores` tem o comprimento de `repeticoes`, com `null` onde não houve medida.
  Na marcha, numa medida por lado, `valores.D` só tem número nas passadas do pé D e `valores.E` nas do pé E. As posições (0-based)
  são o que `Achado.repeticoes` guarda; `Repeticao.numero` (1-based) é só para leitura.
- **Sem juízo.** Sem critério ativo, todo achado tem `situacao: 'sem_referencia'`. Veredito (dentro do critério, no limite, fora do
  critério) só existe com critério do profissional ativo, aplicável e válido para a medida do protocolo. Critério debatido
  (avanço do joelho além do pé) fica desligado por padrão e sem valor presumido.
- **Incerteza do próprio vídeo.** Estimada empiricamente (resíduo entre a série bruta e a suavizada para ângulos e deslocamentos, com piso
  e fator de coloração medidos nos trechos em pé quando há; um quadro para tempos, dois na duração da repetição do agachamento). A
  fórmula (`FORMULAS_INCERTEZA`, `formulaDaIncerteza`) entra no método do laudo. Nenhuma tolerância fixa em graus. É um piso, não um
  intervalo de confiança.
- **Gatilhos.** Um achado só existe se um gatilho disparar: (a) diferença entre lados maior que a incerteza e que a variação entre
  repetições; (b) variação entre repetições maior que a incerteza; (c) mudança da primeira para a última repetição maior que a
  incerteza; (d) repetição discrepante (escore z modificado de Iglewicz e Hoaglin, 1993: critério estatístico, não clínico; mínimo de 5 repetições);
  (c) e (d) exigem o dobro da incerteza (`FATOR_MULTIPLAS_COMPARACOES`), por causa das cerca de dez comparações por vídeo;
  (e) critério do profissional. As regras literais e o mínimo de repetições de cada uma estão em `GATILHOS` (`protocolos.ts`); M
  implementa o que está escrito ali e L imprime o mesmo texto. Sem gatilho, a medida continua na tabela como observação.
- **Biblioteca.** O laudo só repete causas e itens a conferir que estão em `BIBLIOTECA`; chave sem entrada = "sem hipóteses
  curadas". Fonte só com PMID conferido e trecho literal do resumo; sem isso, o fator entra como "a confirmar".
- **Texto.** Português do Brasil, sem as palavras de `VOCABULARIO_PROIBIDO`, e apenas caracteres que o gerador de PDF imprime
  (Latin-1 mais ≥ ≤ − – — · → e aspas); por isso as fórmulas escrevem `raiz(...)` em vez de símbolos fora dessa lista.
- **Laudo.** `responsavelRevisao` sai em branco quando o contexto não o traz. Rodapé fixo `AVISO_ESTIMATIVA_VIDEO`.

### Decisões de produto registradas nesta fatia

- O valgo dinâmico simétrico e alto, sem critério definido, aparece só na tabela de medidas (não vira achado), porque nenhum gatilho
  sem limite clínico o captura. Se o Rafael quiser destacá-lo, o caminho é um critério do profissional.
- A comparação D×E no agachamento de lado depende do membro mais distante da câmera, que é menos confiável; a limitação consta no
  protocolo e em cada achado de assimetria.
- A recomendação de gravação da marcha para esta etapa é de pelo menos 10 passos (5 de cada pé), para haver passadas suficientes por
  pé para as estatísticas dos gatilhos.

### Motor de análise: decisões de implementação (`analisarMovimento.ts` e módulos auxiliares)

- **Repetições do agachamento.** Os fundos são os picos da série de referência (flexão média do joelho, de lado; altura do ponto médio
  dos quadris, de frente), com amplitude mínima de 20° (de lado) ou de 6% da distância vertical quadril–tornozelo (de frente), proeminência
  de pelo menos 40% da amplitude do vídeo (medida contra o ponto mais baixo até um valor maior, e não numa janela fixa: repetição lenta ou
  com pausa no fundo conta) e pelo menos 0,8 s entre fundos; picos acima do mínimo absoluto mas abaixo dos 40% não são contados e entram
  num aviso da análise. Início e fim usam histerese (o movimento é confirmado a 15% da amplitude e o marco é posto onde a série
  deixou os 5%), e o ponto mais baixo é o centro da região a 5% do topo, que não oscila com o ruído como o quadro de máximo. Repetição
  que não parte do nível em pé na ponta do trecho fica como `incompleta`, sem valores.
- **Incerteza.** O resíduo bruto − suavizado é lido só nas janelas em que a medida é lida (fase inteira, ou ±0,3 s do marco), porque o
  ruído depende da postura, e é multiplicado pelo fator de cobertura 2 (`FATOR_COBERTURA`, `incerteza.ts`). Sem o fator, "maior que a
  incerteza" é 1 desvio-padrão do ruído, e um vídeo com repetições idênticas e só ruído disparava variação e tendência em cerca de um
  terço das medidas. Tempos: um quadro na marcha (eventos com instante refinado) e dois quadros na duração das repetições do
  agachamento (início e fim vêm do cruzamento de um nível numa série ruidosa).
- **Piso e coloração da incerteza.** O resíduo só enxerga o ruído rápido; o jitter correlacionado de um detector de pose passa pela
  suavização. Nos agachamentos, depois de segmentar, a incerteza de cada série tem piso em 2 × o desvio-padrão da série suavizada nos
  trechos em pé (fora das repetições, com folga de 0,3 s; pelo menos 15 quadros), e o resíduo de cada janela é multiplicado pelo fator de
  coloração (quanto o ruído é mais lento que um ruído branco, medido em pé e nunca abaixo de 1; cada série usa o maior entre o dela e a
  mediana das séries angulares). Na marcha não há trecho em pé e a incerteza continua só com o resíduo, com a limitação escrita no achado
  e no método. A suavização usa pelo menos 5 amostras (com 3, o Savitzky–Golay de ordem 2 é a identidade e a incerteza saía 0 abaixo de
  29 quadros/s) e a incerteza nunca é informada abaixo do último dígito exibido (0,1° ou 0,1%, 0,01 s). Medido com ruído sintético,
  repetições idênticas e só ruído branco de 1 a 2 px dão achado em 0 a 2% dos vídeos (eram 33 a 50%); com jitter correlacionado forte
  (AR(1) de 0,9, 2 px), 10 a 11% nos agachamentos; na marcha continua alto (sem trecho em pé), então vale conferir com vídeo real antes
  de liberar a aba.
- **Medida no extremo.** Máximo, mínimo, amplitude e valor no marco só valem se a série bruta (sem interpolação) tem pontos em pelo menos
  70% dos quadros de ±0,15 s em torno do instante do extremo; senão a repetição daquele lado fica sem valor, com o sinalizador "pontos
  ausentes" e um aviso da análise (o membro mais distante perdendo pontos no fundo enviesava a flexão máxima para baixo). As medidas que
  percorrem uma fase (máximo, mínimo, amplitude e média) também pedem pelo menos 70% dos quadros da fase com valor. O que fica sem valor
  não é só um aviso genérico: `AnaliseMovimento.pontosPerdidos` diz onde faltou ponto (ver "Pontos perdidos", no fim deste documento).
- **Deslocamento lateral da pelve.** Lido em relação ao valor em pé do próprio vídeo (mediana dos quadros fora das repetições): a
  postura inicial e a inclinação fixa da câmera não viram deslocamento. A inclinação da câmera ainda soma cerca de 1,7% da base por grau
  (a pelve fica mais perto dos tornozelos no fundo), e na vista lateral ela soma à inclinação do tronco: o laudo pede a conferência do
  nivelamento.
- **Critério do profissional.** O veredito mora só no achado do gatilho (e); os achados dos gatilhos (a) a (d) ficam sempre "sem
  referência". Sem escala em cm, `equivalenteCm` não é preenchido; com ela, só as medidas de deslocamento têm o equivalente.
- **Comprimento do pé.** O avanço do joelho divide pela mediana do comprimento calcanhar–ponta no vídeo, não pelo valor de cada quadro,
  porque o pé é rígido e o ruído de um quadro não deve mudar a escala.
- **Eventos da marcha.** Intervalos entre contatos do mesmo pé fora de 0,6 a 2,5 s não são passadas (mesma regra do motor de métricas);
  passada sem a saída do pé fica `incompleta`.
- **Tolerância a dado ruim.** Trilha vazia, quadros nulos, coordenadas inválidas, taxa de quadros implausível e pontos de baixa
  confiança não lançam: a análise sai com a estrutura completa e os `avisos` dizem o que faltou.

### Interface: aba "Laudo (beta)" (`src/components/angular/video/laudo/`)

- **Onde fica.** Sexta aba do painel da análise em vídeo, ao lado de Métricas, Eventos, D × E, Medir e Exportar. O módulo é carregado sob
  demanda (`lazy`): o motor de movimento, o laudo, a biblioteca e o jsPDF só entram no pacote quando o profissional abre a aba ou baixa o PDF.
  `AnaliseVideo.tsx` só liga a aba: passa a trilha atual (com as correções do profissional), a escala, os eventos conferidos, a direção,
  o trecho e a contagem de medidas manuais fora do trecho (que não entram no laudo; a tela traz a nota).
- **Aviso fixo no topo:** "Protótipo (beta) · apoio à avaliação do profissional · não é diagnóstico".
- **Protocolo e plano de câmera.** O padrão é o protocolo da vista que o profissional declarou ao escolher o gesto (`useEstadoLaudo`).
  Escolher o protocolo de outro plano mostra o aviso "Confira o plano de câmera" e a lista dos achados que ficam indisponíveis, com o que
  gravar para obtê-los (a mesma lista de `indisponiveisDoProtocolo` que o laudo e o PDF usam).
- **Cálculo.** `useAnaliseMovimento` chama `analisarMovimento` e `montarLaudo` no dispositivo, sem rede e sem modelo de linguagem, e
  recalcula quando a trilha, o protocolo ou os critérios mudam (o valor adiado mantém a tela fluida enquanto o profissional arrasta um ponto).
- **Conteúdo, nesta ordem:** pontos a conferir (ou a frase de que não há; ver "Pontos perdidos"); resumo; achados em texto neutro (cada um expansível, com hipóteses, força da evidência, fontes ou "sem
  referência verificada" e itens a conferir); limitações (sempre abertas); medidas por repetição e por lado, com realce neutro (fundo
  cinza e negrito, sem cor de aprovação ou de alerta) nos valores citados em achado de repetição discrepante ou de primeira e última
  repetição; editor de critérios do profissional; achados indisponíveis; método (recolhido); botões "Baixar laudo (PDF)" e "Copiar resumo".
- **Critérios do profissional.** Nascem desligados e sem valor; o app nunca sugere limite. Só ligam com valor numérico e com o nome de
  quem os definiu (apagar um dos dois desliga o critério). Critério de medida de outro protocolo fica guardado, mas não se aplica. O
  avanço do joelho mostra a nota de critério debatido. Ficam no estado da análise e, de forma opcional, no `.json` salvo e no rascunho
  (`criterios` e `protocoloMovimento` em `persistencia.ts`, lidos por `criteriosSalvos.ts`): arquivos antigos, sem os campos, abrem
  normalmente, e o que vier malformado é descartado em vez de gerar veredito com um limite que ninguém definiu.
- **Celular (390 × 860).** Sem rolagem horizontal (as tabelas usam a classe `table` porque o CSS global põe `table { display: block }`
  no celular), alvos de toque de 44 px, foco visível, rótulos acessíveis, modo escuro pelos tokens do tema.
- **Testes:** `src/test/analiseLaudo*.test.ts(x)` (aba, editor de critérios, estado, persistência e integração com `AnaliseVideo`).

### Pontos perdidos: mostrar onde faltou ponto para o profissional corrigir à mão

Decisão do Rafael (18/10/2026): o rigor com os pontos que se perdem continua, mas deve ser **mostrado ao terapeuta**, para as correções serem
feitas manualmente. Antes, a repetição que ficava sem valor só deixava um aviso genérico. Agora a análise diz exatamente onde faltou ponto, e a
tela leva o profissional até o quadro com o ponto destacado, usando a lupa e os quadros-chave que já existiam. Nada é preenchido sozinho.

- **A regra não mudou.** Uma medida de máximo, mínimo, amplitude ou valor num marco só é calculada se a série bruta (sem interpolação) tem
  ponto confiável em pelo menos 70% dos quadros de ±0,15 s em torno do instante do extremo; as medidas que percorrem uma fase também pedem
  pelo menos 70% dos quadros da fase com valor. Ponto confiável é o que o motor já considera usável: corrigido à mão, ou detectado com a
  confiança mínima. Não há interpolação em silêncio: o único preenchimento possível é o do profissional, nos quadros-chave. Registrar a
  perda não altera nenhum número medido.
- **O que o motor devolve.** `AnaliseMovimento.pontosPerdidos` = `{ entradas, porPonto }` (tipos em `tipos.ts`, cálculo em `pontosPerdidos.ts`,
  frases em `frasesPontosPerdidos.ts`). Cada entrada é uma medida, uma repetição e um lado que ficaram sem valor por pontos perdidos:
  repetição (posição e número), lado, medida, os pontos que faltaram (nomes dos landmarks, como `joelho_e`, e o rótulo "Joelho esquerdo"), a
  janela de quadros olhada (início, fim e quadro do extremo, com os tempos em segundos), quantos quadros tinham valor e o mínimo exigido, a
  regra que falhou (`extremo` ou `fase`) e o motivo em português neutro. `medidasPorRepeticao.ts` registra a falha (`FalhaDePontos`) no mesmo
  lugar em que decide que a medida fica sem valor; `diagnosticarPontosPerdidos` a transforma na entrada.
- **Janela e extremo.** Na regra `extremo`, a janela é a vizinhança do extremo e o quadro do extremo é o do máximo, do mínimo ou do marco. Na
  regra `fase` não há um extremo definido; o quadro escolhido é o sem ponto mais perto do ponto mais baixo da repetição (na marcha, da saída
  do pé). A lista de faixas de cada ponto traz o buraco **inteiro** na trilha, que continua além da janela enquanto o ponto segue sem detecção
  confiável, porque é do primeiro ao último quadro dele que o profissional precisa para corrigir.
- **Resumo por ponto.** `porPonto` diz, para cada ponto que apareceu, quantos quadros ficaram sem ponto confiável nas janelas analisadas
  (quadros distintos, sem contar duas vezes os que várias medidas compartilham), quantos quadros foram analisados e quantas medidas dependem dele.
- **Só entra o que se pode corrigir.** Se a série ficou sem valor por geometria (tornozelos alinhados, comprimento do pé desconhecido) e nenhum
  ponto do corpo estava ausente nos quadros sem medida, não há entrada: não existe ponto para arrastar, e o aviso geral da análise continua.
- **Tela: "Pontos a conferir" no topo da aba Laudo** (`PontosAConferir.tsx`). Cada item é um buraco de um ponto numa repetição: medidas da
  mesma repetição que dependem do mesmo ponto e perderam quadros que se tocam viram um item só, com a lista das medidas sem valor (uma
  correção resolve todas). Agrupado por repetição, mostra o ponto, os quadros sem ponto, o instante e o botão **"Ir ao quadro"**; atalhos para o
  primeiro e o último quadro sem ponto, porque a interpolação só acontece entre dois quadros-chave. "Ir ao quadro" pausa o vídeo, leva o
  player ao quadro do extremo, rola a página até ele (no celular o player fica acima das abas) e destaca o ponto: anel laranja na alça, ou na
  alça tracejada quando o quadro não detectou o ponto, e o aviso do player diz qual ponto arrastar. A correção é a de sempre (arrastar com a
  lupa, que vira quadro-chave); a trilha muda, a análise se refaz sozinha e o item some. Sem perda, a aba mostra só a frase discreta
  "Nenhuma medida ficou sem valor por pontos perdidos."
- **Contagem no rótulo da aba.** "Laudo (beta) · 3 pontos a conferir" (nome acessível; a aba mostra a bolinha com o número). Vem de
  `useContagemPontosAConferir`, que carrega o motor sob demanda depois do rastreio, para o número aparecer antes de abrir a aba sem trazer o
  motor para o pacote principal. O número é a quantidade de itens da lista e some quando os pontos são corrigidos.
- **Laudo e PDF.** `LaudoMovimento.pontosPerdidos` é a seção **"Medidas não calculadas por pontos perdidos"**: o que ficou de fora, por
  repetição, medida e lado, com os pontos, os quadros e a janela em segundos, e a regra dos 70%. O laudo nunca esconde isso: o resumo ganha
  a frase "N medidas não foram calculadas por pontos perdidos" e o resumo copiado leva a seção. Depois da correção feita à mão a seção é
  `null` e some do laudo e do PDF. O Método traz sempre o parágrafo da regra e do que o profissional pode fazer.
- **Limites conhecidos.** Uma correção só no extremo não basta (a interpolação precisa de dois quadros-chave, a até 1,5 s um do outro; em
  buracos mais longos é preciso corrigir também quadros no meio). Depois de corrigido, o valor da medida passa a depender da posição que o
  profissional deu aos pontos, e os quadros corrigidos continuam contados no cabeçalho do laudo ("quadros-chave corrigidos manualmente").
- **Testes:** `src/test/movimentoPontosPerdidos.test.ts` (motor, laudo, PDF e resumo copiado, com trilhas sintéticas que perdem pontos) e
  `src/test/analiseLaudoPontosPerdidos.test.tsx` (lista, contagem, callback com o quadro certo e integração com a tela de vídeo).
