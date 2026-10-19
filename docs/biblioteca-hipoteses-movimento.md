# Biblioteca de hipóteses do movimento (Etapa 3)

Curadoria dos **possíveis fatores contribuintes** e dos **itens a conferir** que o laudo da análise de movimento (`montarLaudo`) pode repetir
para cada achado. É apoio à avaliação biomecânica feita pelo profissional de saúde: não é diagnóstico, não prescreve treino e não dá nota.
Especificação do produto: `docs/avaliacao-movimento-v3.md`. Avaliação metodológica de cada fonte: `docs/avaliacao-metodologica-fontes.md`.
Código: `src/lib/angular/movimento/biblioteca/` (os textos e as fontes ficam em TypeScript, para o laudo e o PDF usarem; este documento é a leitura
para quem revisa a curadoria). Teste: `src/test/movimentoBiblioteca.test.ts`.

Este documento é gerado a partir dos dados do código (fatores, ressalvas, fontes e avaliações) e foi atualizado na re-curadoria metodológica de 18/10/2026.
Informações de artigos recuperadas do PubMed (conferência em 18/10/2026). Cada fonte traz DOI para consulta.

## Como a curadoria foi feita

- **Busca e conferência no PubMed.** Cada fonte foi buscada e aberta pela ferramenta do PubMed; autores, periódico, volume, páginas, ano e DOI vêm
  do registro, não de memória. O ano é o da data de publicação registrada no PubMed, que pode ser a da versão eletrônica; quando é, e o volume impresso é de outro ano, a citação escreve "Epub AAAA" em vez de juntar o ano eletrônico ao volume e ao fascículo.
- **Avaliação metodológica (re-curadoria).** Antes só se conferia identificação e trecho. Agora cada PMID foi avaliado como um profissional da biomecânica
  avaliaria: desenho e hierarquia, itens no estilo AMSTAR-2 nas revisões, tamanho e justificativa da amostra, validade da medida (3D x vídeo 2D), confundidores,
  desfecho e comparações múltiplas nos estudos primários, aplicabilidade à hipótese em que a fonte é usada e consistência com as demais. Das 55 fontes avaliadas,
  37 ficaram e 18 saíram (critérios, itens e justificativas por PMID em `docs/avaliacao-metodologica-fontes.md`). O laudo mostra, para cada fonte,
  "Qualidade metodológica" e a limitação principal.
- **Trecho literal.** O campo `trecho` é cópia, em inglês, de passagem do **resumo** indexado. A cópia foi comparada por programa com o resumo
  recuperado (espaços normalizados): nenhum trecho foi parafraseado nem editado. Exceção de método: os trechos das quatro fontes incluídas na re-curadoria (Lima 2017, Haberkamp 2022, Cheatham 2018 e Strong 2023) foram conferidos por leitura, lado a lado, com o resumo recuperado, sem a comparação por programa. A avaliação metodológica leu também, quando o PubMed Central devolveu, os métodos e as limitações do texto completo; onde só havia resumo, os itens que o resumo não permite julgar ficaram "não avaliável", sem presumir que atendem.
- **Linguagem de associação.** Nenhum fator afirma causa. Os textos usam "foi associado a", "pode contribuir" ou atribuem a interpretação aos
  autores. Todo fator tem **ressalva** (população, método, tamanho da amostra, evidência mista ou contraditória, limitação metodológica da fonte). O teste barra verbos causais
  e o vocabulário de julgamento (certo, errado, normal, perfeito, falha).
- **Tipo de estudo** (o rótulo que a tela, o PDF e o laudo imprimem) segue o tipo do artigo no PubMed: revisão sistemática, metanálise, estudo observacional ou estudo experimental
  (manipulação controlada de uma condição). Quando o fator tem fontes de tipos diferentes, o rótulo é o da fonte de maior delineamento que o
  sustenta; fontes que o contradizem ou o deixam inconclusivo entram na ressalva, que diz quando a evidência é mista. Revisão narrativa não conta como revisão sistemática. Sem artigo que sustente, o fator é
  **a confirmar**, com fontes vazias, e a interface escreve "sem referência verificada".
- **População.** Cada fonte registra quem foi estudado (atletas, idosos, pacientes com dor, osteoartrite) para ninguém extrapolar.
- **Medida diferente do vídeo.** A maioria das fontes usa captura 3D, plataformas de força ou exame clínico (algumas usam vídeo 2D) e compara grupos ou condições. Duas fontes
  tratam da própria medida: uma revisão com metanálise (Lopes 2018) e um estudo de validação de estimativa de pose 2D (Haberkamp 2022) mostram concordância fraca do ângulo frontal do joelho com o 3D.
  As ressalvas dizem quando a ligação com o achado é uma inferência.
- **Nota do gatilho.** Nas entradas cujas fontes tratam do valor da medida em si (`inclinacao_tronco`, `avanco_joelho`, `valgo_dinamico`,
  `desvio_lateral_pelve` e `inclinacao_tronco_marcha`), o laudo fecha a ressalva de cada hipótese com uma nota quando o achado nasce da
  variação entre repetições ou de uma repetição discrepante (e, no valgo, da diferença entre os lados): nenhuma das fontes citadas estudou
  isso, e a ligação do fator com o achado é inferência. A nota é montada em `notaDoGatilhoSemEstudo` (`frases.ts`) e não vale para fator
  "a confirmar" nem para achado de critério do profissional.
- **Sem limites.** A biblioteca não define valor de referência, limite nem critério para nenhum achado. Os números que aparecem são da fonte
  (ressalvas e trechos) e não são limites do produto. O avanço do joelho segue como observação medida, com o debate registrado.

## Cobertura

| Chave | Fatores | Com fonte | A confirmar | Itens a conferir com fonte |
| --- | --- | --- | --- | --- |
| `assimetria_flexao_joelho` | 3 | 3 | 0 | 2 de 4 |
| `assimetria_flexao_quadril` | 2 | 2 | 0 | 1 de 3 |
| `assimetria_dorsiflexao` | 3 | 3 | 0 | 2 de 3 |
| `valgo_dinamico` | 4 | 4 | 0 | 4 de 4 |
| `desvio_lateral_pelve` | 3 | 3 | 0 | 2 de 3 |
| `inclinacao_tronco` | 2 | 1 | 1 | 2 de 4 |
| `avanco_joelho` | 2 | 2 | 0 | 2 de 4 |
| `variacao_profundidade` | 3 | 2 | 1 | 1 de 3 |
| `tendencia_na_serie` | 2 | 1 | 1 | 0 de 3 |
| `assimetria_tempo_apoio` | 3 | 2 | 1 | 2 de 4 |
| `assimetria_flexao_joelho_marcha` | 3 | 3 | 0 | 2 de 4 |
| `assimetria_amplitude_quadril` | 2 | 2 | 0 | 2 de 4 |
| `inclinacao_tronco_marcha` | 3 | 3 | 0 | 3 de 4 |

Total: 35 fatores (31 com fonte e 4 a confirmar) e 47 itens a conferir (25 com fonte e 22 marcados como sem referência verificada). Fontes distintas: 37. Todas as 13 chaves do catálogo têm entrada; nenhuma ficou sem fator com fonte.

Antes da re-curadoria: 39 fatores (36 com fonte e 3 a confirmar), 47 itens a conferir (25 com fonte) e 51 fontes.

## Fatores e itens a conferir por chave

### `assimetria_flexao_joelho`

Diferença entre os lados na flexão máxima do joelho (agachamento).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Menor mobilidade de dorsiflexão do tornozelo foi associada a menor flexão do joelho no agachamento; se a limitação for diferente entre os lados, pode contribuir para a diferença medida.
   - Tipo de estudo: estudo experimental.
   - Ressalva: Macrum (30 adultos saudáveis, agachamento bipodal, medida 3D) simulou a limitação com uma cunha sob o antepé, o que não reproduz uma rigidez real do tornozelo; Dill (40 adultos ativos, 3D) comparou grupos definidos pela dorsiflexão em carga, e a medida passiva sem carga não os diferenciou. O resumo de nenhum dos dois informa cálculo amostral, e nenhum testou uma diferença de dorsiflexão entre os lados. A associação não estabelece causalidade e não confirma o fator em uma pessoa.
   - Fontes: PMID 22100617 (Macrum 2011, qualidade moderada); PMID 25144599 (Dill 2014, qualidade moderada).
2. Déficit de força do quadríceps e antecedente de lesão ou reconstrução do ligamento cruzado anterior foram associados a assimetria de momentos articulares entre os membros no agachamento, mas não a diferença no ângulo de flexão do joelho, que ficou simétrico em um dos estudos; as fontes não sustentam este fator para a diferença de ângulo medida aqui.
   - Tipo de estudo: estudo observacional.
   - Ressalva: População específica: pessoas após lesão ou reconstrução do ligamento cruzado anterior. Ishida (26 pessoas, grupo de força baixa com 8) é transversal, padronizou a profundidade (coxas paralelas ao solo) e mede momentos articulares e razões de momento. Roos (62 pessoas, com cálculo amostral e grupos comparáveis, agachamento até a profundidade máxima) descreve assimetria de momentos e de distribuição de carga, mas a simetria do pico de flexão do joelho entre os lados foi 100 ± 3 nos controles, 100 ± 3 no ligamento reconstruído e 99 ± 3 no rompido, sem diferença dos controles (p = 1,000 no reconstruído e p = 0,057 no rompido); Roos excluiu ainda duas pessoas de uma análise de correlação depois do resultado. Portanto a assimetria descrita é de momentos e de carga, não de ângulo de flexão: o fator fica como lembrete de que o ângulo pode parecer simétrico mesmo com assimetria de carga. Não se aplica sem esse antecedente.
   - Fontes: PMID 37441507 (Ishida 2023, qualidade moderada); PMID 24581172 (Roos 2014, qualidade moderada).
3. Preferência do pé de chute ou dominância de um dos membros pode contribuir para diferenças entre os lados mesmo sem lesão.
   - Tipo de estudo: estudo observacional.
   - Ressalva: Estudo cruzado com 18 adultos saudáveis e ativos e duas plataformas de força; o membro preferido foi definido por qual perna chutaria uma bola. A diferença descrita é de força de reação do solo e de centro de pressão, e não de ângulo do joelho, e depende do ritmo e da variável: a força de pico foi maior no lado preferido só no ritmo livre (550 contra 518 N; no metrônomo ficou 499 contra 508 N), o impulso foi maior no lado não preferido no ritmo livre (315 contra 300 Ns) e a variabilidade do centro de pressão foi maior no lado preferido. É um único estudo: serve como lembrete de que alguma diferença entre os lados pode existir sem condição clínica, e a direção dela muda conforme a variável.
   - Fontes: PMID 36237648 (Hannan 2022, qualidade moderada).

**O que conferir na avaliação presencial**

- Medir a dorsiflexão do tornozelo em carga (teste de avanço em carga) nos dois lados: no estudo citado, a medida em carga, e não a passiva sem carga, se associou à flexão do joelho no agachamento. (fonte: PMID 25144599, Dill 2014)
- Perguntar sobre lesão ou cirurgia no joelho, em especial do ligamento cruzado anterior, e sobre dor ou instabilidade de cada lado. (fonte: PMID 37441507, Ishida 2023)
- Comparar a força de extensão do joelho entre os lados (por exemplo, com dinamometria) e confirmar no exame presencial. (sem referência verificada; sugestão ao profissional)
- Rever os quadros de maior flexão: de lado, o membro mais distante da câmera pode ter sido detectado com menos precisão. (sem referência verificada; sugestão ao profissional)

### `assimetria_flexao_quadril`

Diferença entre os lados na flexão máxima do quadril (agachamento).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Menor mobilidade de dorsiflexão do tornozelo (e, em homens, de flexão do quadril) foi associada a agachamentos menos profundos; diferenças dessas mobilidades entre os lados podem contribuir para a diferença medida.
   - Tipo de estudo: estudo observacional.
   - Ressalva: Kim (101 adultos jovens, fotografia sagital, regressão por etapas) e Gomes (20 adultos, vídeo 2D, agachamento com barra) relacionam a mobilidade com a profundidade, e não com o ângulo do quadril nem com a assimetria; a associação variou com o sexo em Kim e, em Gomes, só a dorsiflexão no teste de avanço se associou à profundidade. Os dois são transversais, e a ligação com a diferença entre os lados é uma inferência.
   - Fontes: PMID 25964810 (Kim 2015, qualidade moderada); PMID 32022631 (Gomes 2020, qualidade moderada).
2. Dor ou alteração estrutural do quadril, como o impacto femoroacetabular, pode estar relacionada a diferenças no agachamento (profundidade, joelho e tornozelo), mas a evidência de que mude o ângulo de flexão do quadril é inconclusiva.
   - Tipo de estudo: meta-análise.
   - Ressalva: Evidência mista e inconclusiva: a revisão com metanálise de pacientes operados por impacto femoroacetabular (6 estudos, qualidade moderada pela escala MINORS) não encontrou diferença significativa nos parâmetros cinemáticos, e os autores sugerem que deformidades ósseas isoladas não explicam as limitações no agachamento; a revisão sobre condições do quadril (15 estudos heterogêneos) relata que o impacto femoroacetabular e a artroscopia do quadril afetaram o agachamento, mas o tema é pouco investigado e o resumo não detalha a direção dos efeitos. Serve apenas como lembrete de investigar o quadril.
   - Fontes: PMID 40391865 (Generoso 2025, qualidade moderada); PMID 28290757 (Cheatham 2018, qualidade moderada).

**O que conferir na avaliação presencial**

- Medir a flexão passiva e as rotações do quadril de cada lado (goniometria), além da dorsiflexão em carga. (fonte: PMID 25964810, Kim 2015)
- Perguntar sobre dor na região da virilha ou do quadril e sobre cirurgia prévia no quadril. (sem referência verificada; sugestão ao profissional)
- Rever os quadros: a inclinação do tronco e a rotação da pelve mudam o ângulo do quadril projetado no plano da imagem. (sem referência verificada; sugestão ao profissional)

### `assimetria_dorsiflexao`

Diferença entre os lados na dorsiflexão máxima do tornozelo (agachamento).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Instabilidade crônica do tornozelo e dor patelofemoral foram associadas a menor dorsiflexão do tornozelo nos dois lados, em comparação com controles; antecedente desse tipo pode estar relacionado à dorsiflexão menor medida, mas as fontes não mostram diferença relevante entre os lados na dor patelofemoral.
   - Tipo de estudo: estudo observacional.
   - Ressalva: Emamvirdi: estudo transversal com 60 atletas de basquete mulheres (instabilidade crônica do tornozelo, dor patelofemoral e controles), dorsiflexão em carga e valgo em vídeo 2D; a dorsiflexão foi menor nos dois lados, não só no lado afetado. O índice de assimetria foi calculado e testado dentro de cada grupo (o texto não descreve teste entre grupos): o resumo conclui que há assimetria de dorsiflexão, mas, nos resultados, nos grupos com dor patelofemoral e controle o índice ficou abaixo da variação individual (coeficiente de variação), e os autores dizem que não houve desequilíbrio relevante entre os lados na dorsiflexão; o texto não diz o mesmo do grupo com instabilidade. O cálculo amostral usou efeito de 0,30 e poder de 0,30, e os próprios autores citam isso como limitação. Hassan: caso-controle com 140 adultos, em que a dorsiflexão com o joelho flexionado foi menor no grupo com dor (30,20 contra 33,15), sem dado por lado. A associação não indica direção: a menor dorsiflexão pode acompanhar a condição em vez de antecedê-la.
   - Fontes: PMID 37524846 (Emamvirdi 2023, qualidade moderada); PMID 35989174 (Hassan 2022, qualidade moderada).
2. A rigidez do tendão do calcâneo foi associada ao ângulo de dorsiflexão no ponto mais baixo do agachamento e pode contribuir para a diferença entre os lados.
   - Tipo de estudo: estudo observacional.
   - Ressalva: Evidência mista: Miyasaka (31 homens jovens saudáveis, com cálculo amostral e elastografia) encontrou associação com a dorsiflexão no ponto mais baixo do agachamento, enquanto Gomes (20 adultos saudáveis) viu a dorsiflexão no teste de avanço se associar à rigidez do tendão, mas não viu influência evidente das propriedades mecânicas do tendão do calcâneo sobre a profundidade do agachamento. Ambos medem a rigidez por ultrassom, o que não é possível em vídeo, e nenhum compara os lados.
   - Fontes: PMID 37374309 (Miyasaka 2023, qualidade moderada); PMID 32022631 (Gomes 2020, qualidade moderada).
3. Elevar o calcanhar (calçado com salto, calço ou palmilha) reduziu a dorsiflexão máxima medida no agachamento; calçado ou apoio diferentes entre os lados no vídeo podem contribuir para a diferença.
   - Tipo de estudo: estudo experimental.
   - Ressalva: 30 homens saudáveis com dorsiflexão restrita, agachamento com carga e análise tridimensional; a elevação era igual nos dois pés e não houve comparação com quem tem dorsiflexão não restrita. O estudo não testou diferença de apoio entre os lados.
   - Fontes: PMID 42551866 (Cai 2026, qualidade moderada).

**O que conferir na avaliação presencial**

- Medir a dorsiflexão em carga (teste de avanço em carga) em cada lado: a medida passiva sem carga teve menos relação com a cinemática do agachamento. (fonte: PMID 25144599, Dill 2014)
- Perguntar sobre entorse prévia, instabilidade do tornozelo e dor patelofemoral. (fonte: PMID 37524846, Emamvirdi 2023)
- Conferir se o calçado, a posição e a abertura dos pés eram iguais nos dois lados. (sem referência verificada; sugestão ao profissional)

### `valgo_dinamico`

Valgo dinâmico do joelho na descida (agachamento de frente).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Menor dorsiflexão do tornozelo foi associada a maior valgo dinâmico do joelho em uma metanálise, e diferenças na mobilidade do pé (do médio-pé) foram associadas a maior valgo (deslocamento medial) do joelho no agachamento; podem contribuir para o valgo medido.
   - Tipo de estudo: meta-análise.
   - Ressalva: Resultados não unânimes. A metanálise de Lima (17 estudos) compara pessoas com e sem valgo dinâmico e encontrou menor dorsiflexão no grupo com valgo, com resultado na mesma direção para a dorsiflexão medida em carga e sem carga; é transversal, e o resumo não informa o registro do protocolo nem a heterogeneidade. Em adultos com e sem dor patelofemoral, a dorsiflexão medida com o joelho flexionado não se correlacionou com o ângulo de projeção frontal (Hassan: teste de descida de degrau em 70 pessoas com dor patelofemoral e 70 assintomáticas). Macrum (30 adultos, agachamento bipodal) simulou a limitação com uma cunha, com efeito pequeno sobre o ângulo de valgo; Wyndow (30 adultos assintomáticos, agachamento unipodal em vídeo 2D) relacionou a dorsiflexão e a mobilidade do médio-pé ao ângulo. Nenhum testou diferença entre os lados. A associação não estabelece causalidade.
   - Fontes: PMID 28974358 (Lima 2017, qualidade moderada); PMID 22100617 (Macrum 2011, qualidade moderada); PMID 26816531 (Wyndow 2016, qualidade moderada); PMID 35989174 (Hassan 2022, qualidade moderada).
2. A fraqueza dos abdutores e dos rotadores externos do quadril é uma hipótese frequente para o valgo, mas as revisões sistemáticas não a sustentam de forma consistente.
   - Tipo de estudo: revisão sistemática.
   - Ressalva: Evidência conflitante em adultos assintomáticos: a revisão de 2021 (7 estudos transversais com análise 2D, qualidade de 5 a 7 de 8 pela lista do JBI, só 3 com controle de confundidores) descreve a relação como conflitante; a de 2026, com metanálise parcial de 22 artigos, não obteve significância em nenhuma metanálise e conclui que a fraqueza pode não estar associada a maior valgo dinâmico (o resumo não informa registro de protocolo nem avaliação do risco de viés). Não use a força do quadril como explicação por padrão.
   - Fontes: PMID 34300118 (Alzahrani 2021, qualidade moderada); PMID 42476040 (Cashman 2026, qualidade moderada).
3. Instabilidade crônica do tornozelo e dor patelofemoral foram associadas a maior ângulo de valgo dinâmico; antecedente desse tipo pode contribuir para o valgo medido.
   - Tipo de estudo: estudo observacional.
   - Ressalva: 60 atletas de basquete mulheres; agachamento unipodal em vídeo 2D, medido nos dois lados, com cálculo amostral de efeito 0,30 e poder 0,30. Estudo transversal: não mostra se o valgo antecede a dor ou a acompanha. Não vale para quem não tem esse antecedente.
   - Fontes: PMID 37524846 (Emamvirdi 2023, qualidade moderada).
4. O ângulo 2D de projeção do joelho concordou mal com o ângulo 3D no agachamento unipodal em uma revisão com metanálise, e um estudo de validação de estimativa de pose 2D encontrou o mesmo para o ângulo frontal do joelho; a medida 2D deste vídeo pode estar distante do ângulo real e deve ser lida como observação.
   - Tipo de estudo: meta-análise.
   - Ressalva: Lopes (revisão com metanálise de 16 estudos): a confiabilidade da análise 2D variou de moderada a excelente, mas a concordância com a medida 3D foi fraca no agachamento unipodal (r = 0,127) e melhor na aterrissagem; os autores concluem que a evidência atual não sustenta o uso da análise 2D quando se exige medida exata (o resumo não informa registro de protocolo nem risco de viés). Haberkamp validou uma estimativa de pose 2D por inteligência artificial (o registro do PubMed lista OpenPose como palavra-chave; este app usa outro modelo, o MediaPipe, sem validação própria), em atletas adolescentes no agachamento unipodal: relações moderadas a fortes nos ângulos sagitais (r de 0,68 a 0,94), regulares no quadril e na pelve no plano frontal e fraca no ângulo frontal do joelho (r = 0,20); o número de participantes não consta no resumo. Os dois são do agachamento unipodal, não do bipodal medido neste app: use o valgo deste vídeo como observação e não como medida exata.
   - Fontes: PMID 29895235 (Lopes 2018, qualidade moderada); PMID 36198251 (Haberkamp 2022, qualidade moderada).

**O que conferir na avaliação presencial**

- Medir a dorsiflexão em carga e a mobilidade do pé (por exemplo, do médio-pé) de cada lado. (fonte: PMID 26816531, Wyndow 2016)
- Perguntar sobre dor anterior no joelho, entorse e instabilidade do tornozelo. (fonte: PMID 37524846, Emamvirdi 2023)
- Testar a força dos abdutores e dos rotadores externos do quadril, interpretando com cautela: a relação com o valgo é conflitante na literatura. (fonte: PMID 34300118, Alzahrani 2021)
- Observar o valgo no exame presencial, se possível também em outra tarefa, antes de concluir: a medida 2D em vídeo é uma projeção. (fonte: PMID 29895235, Lopes 2018)

### `desvio_lateral_pelve`

Deslocamento lateral da pelve em relação à base de apoio (agachamento de frente).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Em atletas após reconstrução do ligamento cruzado anterior, a posição lateral do quadril no agachamento se correlacionou com a assimetria de carga entre os membros; um deslocamento da pelve pode refletir apoio assimétrico.
   - Tipo de estudo: estudo observacional.
   - Ressalva: População específica: atletas de 0 a 12 meses após reconstrução do ligamento cruzado anterior (Song: 17 atletas, com cálculo amostral e correção de Benjamini-Hochberg, mas amostra heterogênea), adultos com lesão ou reconstrução (Roos: 62 pessoas) e 24 pessoas avaliadas três vezes após a reconstrução, com 29 controles (Strong), todos com plataformas de força e análise tridimensional. Correlação não indica que o deslocamento seja a origem da assimetria, e não há dado nestas fontes para pessoas sem esse antecedente. Strong encontrou assimetria de momentos do joelho nas fases inicial e intermediária e nenhuma diferença do grupo controle no retorno ao esporte, com padrões individuais diferentes (alguns descarregam o joelho operado e outros o sobrecarregam).
   - Fontes: PMID 34628200 (Song 2021, qualidade moderada); PMID 24581172 (Roos 2014, qualidade moderada); PMID 37853508 (Strong 2023, qualidade moderada).
2. Déficit de força do quadríceps de um dos lados foi associado, no agachamento, a menor momento extensor do joelho nesse lado e a maior contribuição do quadril do mesmo lado, sem diferença de força vertical entre os lados; a fonte descreve uma redistribuição dentro do membro e não um apoio mais carregado no lado oposto.
   - Tipo de estudo: estudo observacional.
   - Ressalva: 26 pessoas com mais de 1 ano após reconstrução do ligamento cruzado anterior, com cálculo amostral prévio e grupo de força baixa de 8. O estudo mediu momentos articulares com análise tridimensional e não o deslocamento da pelve. Não houve diferença de força de reação vertical entre os lados no grupo de força baixa (interação grupo × lado, p = 0,119); a compensação descrita foi entre as articulações do mesmo membro, e os autores dizem que a compensação pelo membro oposto pode ser mais evidente na fase inicial da reabilitação, o que não apareceu neste grupo. A ligação com o deslocamento lateral da pelve é uma inferência que o estudo não sustenta.
   - Fontes: PMID 37441507 (Ishida 2023, qualidade moderada).
3. Preferência do pé de chute ou dominância de um dos membros pode contribuir para um apoio desigual mesmo sem lesão.
   - Tipo de estudo: estudo observacional.
   - Ressalva: Estudo cruzado com 18 adultos saudáveis; o membro preferido foi definido por qual perna chutaria uma bola. A diferença descrita é de força de reação do solo e de centro de pressão e depende do ritmo e da variável: a força de pico foi maior no lado preferido só no ritmo livre (550 contra 518 N; no metrônomo ficou 499 contra 508 N), e o impulso foi maior no lado não preferido no ritmo livre (315 contra 300 Ns). É um único estudo e não mediu o deslocamento da pelve.
   - Fontes: PMID 36237648 (Hannan 2022, qualidade moderada).

**O que conferir na avaliação presencial**

- Perguntar sobre cirurgia ou lesão em joelho, quadril ou tornozelo e sobre dor unilateral. (fonte: PMID 37853508, Strong 2023)
- Quando houver duas balanças ou uma plataforma de força, comparar a descarga de peso entre os lados no ponto mais baixo. (fonte: PMID 34628200, Song 2021)
- Conferir se os pés estavam na mesma posição e se o peso estava distribuído por igual no início de cada repetição. (sem referência verificada; sugestão ao profissional)

### `inclinacao_tronco`

Inclinação do tronco no ponto mais baixo (agachamento).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Elevar o calcanhar de quem tem dorsiflexão restrita reduziu a inclinação do tronco para a frente no agachamento com carga; a limitação de dorsiflexão pode contribuir para a inclinação medida.
   - Tipo de estudo: estudo experimental.
   - Ressalva: Cai: 30 homens saudáveis com dorsiflexão restrita, agachamento com carga, seis alturas de calcanhar (0 a 5 cm) e análise tridimensional. O estudo não incluiu um grupo com dorsiflexão não restrita: não mostra quanto da inclinação existiria sem a restrição. Evidência contrária: da Costa (30 adultos sem lesão, amostra de conveniência, agachamento unipodal, análise 3D, estudo transversal) associou a dorsiflexão passiva à rotação interna da coxa (r = -0,38) e, no resumo, não a associou ao tronco; a flexão menor do tronco se associou à dorsiflexão dinâmica, medida durante o próprio agachamento (r = 0,59), que é parte do movimento e não uma mobilidade independente. Ou seja, o único estudo observacional encontrado não sustenta a ligação do tronco com a mobilidade passiva. Não é possível separar a dorsiflexão de outros fatores em uma pessoa.
   - Fontes: PMID 42551866 (Cai 2026, qualidade moderada); PMID 33713896 (da Costa 2021, qualidade moderada).
2. Manter os joelhos atrás da ponta dos pés, por instrução ou por estratégia, pode contribuir para a inclinação do tronco medida.
   - Tipo de estudo: a confirmar.
   - Ressalva: Sem referência verificada com qualidade metodológica suficiente: o único estudo encontrado que mediu a inclinação do tronco com o avanço dos joelhos restrito teve 7 participantes e foi retirado na avaliação metodológica das fontes. Confirme no exame presencial.
   - Fontes: nenhuma (sem referência verificada).

**O que conferir na avaliação presencial**

- Medir a dorsiflexão em carga (teste de avanço em carga) nos dois lados. (fonte: PMID 25144599, Dill 2014)
- No exame presencial, observar se a inclinação do tronco muda quando se eleva o calcanhar; se mudar, a dorsiflexão passa a ser um candidato. (fonte: PMID 42551866, Cai 2026)
- Comparar o comprimento do fêmur com o do tronco da pessoa. (sem referência verificada; sugestão ao profissional)
- Observar a curvatura da coluna no exame presencial: o vídeo mede a reta quadril–ombro e não a curvatura lombar. (sem referência verificada; sugestão ao profissional)

### `avanco_joelho`

Avanço do joelho em relação à ponta do pé (observação medida).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Elevar o calcanhar aumentou o avanço da tíbia e a flexão do joelho no agachamento de homens com dorsiflexão restrita; a mobilidade de dorsiflexão e o apoio do calcanhar podem contribuir para o avanço medido.
   - Tipo de estudo: estudo experimental.
   - Ressalva: 30 homens saudáveis com dorsiflexão restrita, agachamento com carga e análise tridimensional, sem grupo com dorsiflexão não restrita. O estudo mediu a progressão da tíbia e não a posição do joelho em relação à ponta do pé, e não define limite nem critério.
   - Fontes: PMID 42551866 (Cai 2026, qualidade moderada).
2. A forma de executar o agachamento, em especial a instrução de manter os joelhos atrás da ponta dos pés, alterou o ângulo do joelho, o movimento do tronco e o estresse patelofemoral estimado; a técnica usada pode contribuir para o avanço observado.
   - Tipo de estudo: estudo experimental.
   - Ressalva: O efeito do avanço do joelho é debatido e não há limite definido. Kernozek (25 mulheres saudáveis, estimativa por modelo musculoesquelético e não medida) calculou maior estresse patelofemoral quando os joelhos passam dos pés; List (30 pessoas, agachamento com barra e carga de 0 a 50% do peso corporal, captura 3D) descreveu menor ângulo do joelho e maior movimento entre os segmentos lombar e torácico quando o avanço é restringido, e conclui de forma prescritiva além do que mediu. A restrição, portanto, muda o padrão do tronco e do joelho. Por isso o avanço é só observação medida, sem critério ativado.
   - Fontes: PMID 22990570 (List 2013, qualidade moderada); PMID 28422563 (Kernozek 2018, qualidade moderada).

**O que conferir na avaliação presencial**

- Medir a dorsiflexão em carga em cada lado e compará-la com o avanço observado. (fonte: PMID 25144599, Dill 2014)
- Perguntar sobre dor anterior no joelho (região da patela) ao interpretar o avanço medido. (fonte: PMID 28422563, Kernozek 2018)
- Conferir se a ponta do pé marcada pelo detector corresponde ao calçado usado e se os pés mudaram de posição entre as repetições. (sem referência verificada; sugestão ao profissional)
- Decidir se o avanço será usado como critério: o sistema não define limite, e só o profissional pode ativar um critério. (sem referência verificada; sugestão ao profissional)

### `variacao_profundidade`

Variação da profundidade entre as repetições (agachamento).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. A mobilidade de dorsiflexão do tornozelo (e, em homens, a de flexão do quadril) foi associada à profundidade alcançada no agachamento e pode contribuir para a profundidade medida.
   - Tipo de estudo: estudo observacional.
   - Ressalva: As fontes relacionam a profundidade com a mobilidade: Kim (101 adultos jovens, fotografia sagital, regressão por etapas), Gomes (20 adultos, vídeo 2D, agachamento com barra; só a dorsiflexão no teste de avanço se associou) e Walker (72 adultos, com cálculo amostral, agachamento unipodal por câmera única 3D, correlações baixas de 0,22 a 0,37 que explicam 5% e 14% da variância, testes unicaudais e associação maior só em análise post hoc de quem se exercita mais). Em Walker, o resultado do lado direito (r = 0,223; p = 0,030) é unicaudal e deixa de ser significativo em teste bicaudal (p cerca de 0,06, calculado a partir de r e de n = 72; não consta no artigo), enquanto o do lado esquerdo seguiria significativo. Nenhuma estudou a variação da profundidade entre repetições, então a ligação com a variação é uma inferência. Walker não encontrou associação da força dos abdutores do quadril com a profundidade.
   - Fontes: PMID 32022631 (Gomes 2020, qualidade moderada); PMID 25964810 (Kim 2015, qualidade moderada); PMID 42516619 (Walker 2026, qualidade moderada).
2. Elevar o calcanhar aumentou a flexão do joelho e do quadril no agachamento de homens com dorsiflexão restrita; mudanças de calçado ou de apoio entre as repetições podem contribuir para a variação da profundidade.
   - Tipo de estudo: estudo experimental.
   - Ressalva: Um estudo com 30 homens saudáveis com dorsiflexão restrita; o apoio era igual em cada condição, e a variação entre repetições não foi o desfecho.
   - Fontes: PMID 42551866 (Cai 2026, qualidade moderada).
3. A referência de profundidade usada (marca, banco ou instrução) e o ritmo da execução podem contribuir para variar a profundidade entre as repetições.
   - Tipo de estudo: a confirmar.
   - Ressalva: Sem referência verificada nesta biblioteca: decorre da forma de coletar o vídeo e deve ser confirmado com quem acompanhou a gravação.
   - Fontes: nenhuma (sem referência verificada).

**O que conferir na avaliação presencial**

- Medir a dorsiflexão em carga e a flexão passiva do quadril de cada lado. (fonte: PMID 25964810, Kim 2015)
- Confirmar se havia a mesma referência de profundidade (banco, marca ou instrução) em todas as repetições. (sem referência verificada; sugestão ao profissional)
- Conferir os marcos do ponto mais baixo de cada repetição antes de interpretar a variação. (sem referência verificada; sugestão ao profissional)

### `tendencia_na_serie`

Mudança de uma medida da primeira para a última repetição.

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Fadiga muscular ao longo das repetições pode contribuir para a mudança de uma medida da primeira para a última repetição, mas a evidência disponível é indireta.
   - Tipo de estudo: revisão sistemática.
   - Ressalva: Evidência indireta: a revisão (21 estudos, registrada, cinco bases, qualidade moderada a alta pela lista de Downs e Black) trata de aterrissagens de saltos em pessoas fisicamente ativas e descreve predomínio de mais flexão do tronco depois de fadiga dos membros inferiores; os autores relatam grande heterogeneidade de protocolos de fadiga e de tarefas e não fizeram metanálise. Os protocolos de fadiga são intensos e bem diferentes de poucas repetições de agachamento. Não há dado nesta fonte para uma série curta.
   - Fontes: PMID 37181257 (Vermeulen 2023, qualidade alta).
2. A adaptação ao movimento nas primeiras repetições e a mudança de ritmo ao longo da série podem contribuir para a mudança observada.
   - Tipo de estudo: a confirmar.
   - Ressalva: Sem referência verificada nesta biblioteca: confira a duração das repetições e se a mudança aparece em mais de uma medida antes de atribuí-la a um fator.
   - Fontes: nenhuma (sem referência verificada).

**O que conferir na avaliação presencial**

- Verificar se a duração da repetição mudou ao longo da série e se a mudança aparece em mais de uma medida. (sem referência verificada; sugestão ao profissional)
- Confirmar no vídeo se os pés, a câmera ou o enquadramento mudaram entre a primeira e a última repetição. (sem referência verificada; sugestão ao profissional)
- Perguntar sobre cansaço ou dor que apareceu durante a série e sobre aquecimento antes da gravação. (sem referência verificada; sugestão ao profissional)

### `assimetria_tempo_apoio`

Diferença entre os lados no tempo de apoio (marcha).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Osteoartrite de quadril foi associada a assimetria temporal na marcha, com apoio mais curto no membro afetado; uma condição articular unilateral desse tipo pode contribuir para a diferença no tempo de apoio.
   - Tipo de estudo: meta-análise.
   - Ressalva: A metanálise (30 artigos, 11 bases) trata de osteoartrite de quadril; o resumo não informa o registro do protocolo, o instrumento de qualidade nem a heterogeneidade. Evidência mista para a dor no joelho: em pessoas com dor unilateral leve a moderada no joelho de uma coorte (Corrigan: análise exploratória, com ajuste de confundidores e passarela de tempo, não vídeo), a gravidade da dor não se associou à assimetria temporal; só medidas específicas de apoio se relacionaram à dor depois de 2 anos. Não se aplica a quem não tem queixa articular.
   - Fontes: PMID 24450373 (Constantinou 2014, qualidade moderada); PMID 36305013 (Corrigan 2023, qualidade moderada).
2. Diferença de comprimento entre os membros inferiores foi associada a desvios e assimetrias da marcha e pode contribuir para a diferença entre os lados.
   - Tipo de estudo: revisão sistemática.
   - Ressalva: A revisão (12 estudos, avaliados pela escala MINORS) reúne 4 estudos com diferença anatômica e 8 com diferença simulada por elevações de 1 a 5 cm em pessoas saudáveis, que respondem perguntas diferentes; o resumo não detalha em quais desfechos (ângulos, tempos ou forças) aparecem os desvios, e não há desfecho específico para este achado. Os autores indicam que desvios podem ocorrer com diferenças acima de 1 cm, com compensações nos dois membros. O registro do protocolo e a seleção em duplicata não constam no resumo.
   - Fontes: PMID 28600975 (Khamis 2017, qualidade moderada).
3. A variação da velocidade entre as passadas e o erro na marcação dos eventos de contato e de saída do pé podem contribuir para uma diferença no tempo de apoio.
   - Tipo de estudo: a confirmar.
   - Ressalva: Sem referência verificada nesta biblioteca: decorre do método (cada evento tem erro de um quadro e as passadas de cada pé são de instantes diferentes) e deve ser conferido quadro a quadro.
   - Fontes: nenhuma (sem referência verificada).

**O que conferir na avaliação presencial**

- Perguntar sobre dor, rigidez ou cirurgia em quadril, joelho, tornozelo e coluna, e de qual lado. (fonte: PMID 24450373, Constantinou 2014)
- Medir o comprimento dos membros inferiores (real e aparente) nos dois lados. (fonte: PMID 28600975, Khamis 2017)
- Conferir quadro a quadro os eventos de contato e de saída do pé usados nas passadas de cada lado. (sem referência verificada; sugestão ao profissional)
- Se possível, repetir a gravação com mais passadas e velocidade mais constante. (sem referência verificada; sugestão ao profissional)

### `assimetria_flexao_joelho_marcha`

Diferença entre os lados no pico de flexão do joelho no balanço (marcha).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. A redução experimental da força dos flexores plantares (cerca de 33%) em adultos jovens saudáveis foi acompanhada de menor pico de flexão do joelho no balanço, e a menor velocidade da flexão plantar na saída do pé se correlacionou com essa redução; fraqueza desse grupo pode contribuir para a diferença entre os lados.
   - Tipo de estudo: estudo experimental.
   - Ressalva: Apti: 20 adultos jovens saudáveis avaliados antes e depois de um alongamento passivo que reduziu a força em cerca de 33%, mais 7 controles para separar o efeito da marcha lenta, com análise tridimensional; não há randomização nem cegamento descritos, e o título e o resumo usam linguagem causal (aqui lida como associação). A fraqueza induzida de forma aguda não equivale a uma fraqueza crônica. O estudo não compara os lados.
   - Fontes: PMID 27131202 (Apti 2016, qualidade moderada).
2. Osteoartrite de quadril e de joelho foi associada a menor amplitude de movimento do joelho e, no joelho mais doloroso, a menor flexão na marcha, em comparação com controles; condição desse tipo pode estar relacionada a alterações da marcha, mas as fontes não compararam um lado com o outro.
   - Tipo de estudo: estudo observacional.
   - Ressalva: A metanálise (35 estudos, registrada, com risco de viés pela lista de Downs e Black e grande heterogeneidade entre os estudos) é de osteoartrite de quadril: compara pessoas com a doença e controles saudáveis (excluiu estudos que usavam o membro contralateral como controle ou que analisavam medidas de assimetria) e descreve amplitudes reduzidas nos ângulos do quadril e sagital do joelho, também no lado contralateral. Os autores avisam que a maioria dos intervalos de predição dos resultados significativos cruza o zero e que só 10 de 68 análises da marcha reúnem 5 ou mais estudos. Creaby (91 pessoas com osteoartrite medial de joelho e 31 controles, com ajuste pela velocidade) descreve menor flexão no joelho mais doloroso em relação aos controles; as assimetrias entre os joelhos que descreve são de ângulo varo e de momento flexor externo, e não de ângulo de flexão. Os resumos não especificam que o pico seja o do balanço: a direção é a mesma, mas não é necessariamente a mesma medida. Nenhuma fonte testou a diferença entre os lados no pico de flexão do joelho; por isso o tipo de estudo é "observacional".
   - Fontes: PMID 38046934 (Steingrebe 2023, qualidade alta); PMID 22385873 (Creaby 2012, qualidade moderada).
3. Diferença de comprimento entre os membros inferiores foi associada a desvios e assimetrias da marcha e pode contribuir para a diferença entre os lados.
   - Tipo de estudo: revisão sistemática.
   - Ressalva: A revisão (12 estudos, avaliados pela escala MINORS) reúne 4 estudos com diferença anatômica e 8 com diferença simulada por elevações de 1 a 5 cm em pessoas saudáveis, que respondem perguntas diferentes; o resumo não detalha em quais desfechos (ângulos, tempos ou forças) aparecem os desvios, e não há desfecho específico para este achado. Os autores indicam que desvios podem ocorrer com diferenças acima de 1 cm, com compensações nos dois membros. O registro do protocolo e a seleção em duplicata não constam no resumo.
   - Fontes: PMID 28600975 (Khamis 2017, qualidade moderada).

**O que conferir na avaliação presencial**

- Testar a força dos flexores plantares de cada lado (por exemplo, com dinamometria) e a mobilidade do tornozelo. (fonte: PMID 27131202, Apti 2016)
- Perguntar sobre dor, derrame ou cirurgia no joelho e sobre entorses. (sem referência verificada; sugestão ao profissional)
- Medir o comprimento dos membros inferiores nos dois lados. (fonte: PMID 28600975, Khamis 2017)
- Conferir se o membro mais distante da câmera foi detectado corretamente na fase de balanço. (sem referência verificada; sugestão ao profissional)

### `assimetria_amplitude_quadril`

Diferença entre os lados na amplitude do quadril (marcha).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Osteoartrite e restrição de mobilidade do quadril foram associadas a menor amplitude de movimento do quadril na marcha, em comparação com controles, e a extensão passiva do quadril se relacionou com a extensão alcançada na marcha em pessoas com osteoartrite; condição desse tipo pode estar relacionada a menor amplitude do quadril, mas as fontes não compararam um lado com o outro.
   - Tipo de estudo: estudo observacional.
   - Ressalva: A metanálise (35 estudos, com grande heterogeneidade) e Baker (osteoartrite de quadril moderada e grave e grupo assintomático; o número de participantes não consta no resumo) tratam de pessoas com osteoartrite de quadril; entre pessoas assintomáticas não houve correlação entre a extensão passiva e a extensão na marcha (r = 0,139 no estudo). A metanálise compara com controles saudáveis, excluiu estudos que usavam o membro contralateral como controle ou que analisavam medidas de assimetria, e descreve alterações também no lado contralateral (menor extensão do quadril contralateral); os autores avisam que a maioria dos intervalos de predição dos resultados significativos cruza o zero. Os estudos usam análise tridimensional; neste vídeo o ângulo do quadril (ombro–quadril–joelho) inclui o movimento do tronco e da pelve, então a amplitude medida não é a articular pura. Nenhuma fonte testou a diferença entre os lados; por isso o tipo de estudo é "observacional".
   - Fontes: PMID 38046934 (Steingrebe 2023, qualidade alta); PMID 26895694 (Baker 2016, qualidade moderada).
2. Diferença de comprimento entre os membros inferiores foi associada a desvios e assimetrias da marcha e pode contribuir para a diferença entre os lados.
   - Tipo de estudo: revisão sistemática.
   - Ressalva: A revisão (12 estudos, avaliados pela escala MINORS) reúne 4 estudos com diferença anatômica e 8 com diferença simulada por elevações de 1 a 5 cm em pessoas saudáveis, que respondem perguntas diferentes; o resumo não detalha em quais desfechos (ângulos, tempos ou forças) aparecem os desvios, e não há desfecho específico para este achado. Os autores indicam que desvios podem ocorrer com diferenças acima de 1 cm, com compensações nos dois membros. O registro do protocolo e a seleção em duplicata não constam no resumo.
   - Fontes: PMID 28600975 (Khamis 2017, qualidade moderada).

**O que conferir na avaliação presencial**

- Medir a extensão e a flexão passivas do quadril de cada lado (goniometria). (fonte: PMID 26895694, Baker 2016)
- Perguntar sobre dor na virilha, no quadril ou na região lombar de cada lado. (sem referência verificada; sugestão ao profissional)
- Medir o comprimento dos membros inferiores nos dois lados. (fonte: PMID 28600975, Khamis 2017)
- Lembrar que o ângulo medido inclui a inclinação do tronco: conferir se a amplitude muda junto com a inclinação do tronco. (sem referência verificada; sugestão ao profissional)

### `inclinacao_tronco_marcha`

Inclinação do tronco durante a passada (marcha).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Uma contratura de flexão do joelho simulada em mulheres saudáveis aumentou a inclinação anterior do tronco e da pelve na marcha; uma limitação de extensão do joelho pode contribuir para a inclinação medida.
   - Tipo de estudo: estudo experimental.
   - Ressalva: 10 mulheres saudáveis (média de 62 anos) com órtese que simulou a contratura, avaliadas nas duas condições, sem justificativa de amostra no resumo; a contratura menor não mudou o tronco e só a maior (30°) mudou. Contratura simulada não equivale a uma condição clínica real, e a conclusão do resumo sobre desequilíbrio da coluna passa do que foi medido.
   - Fontes: PMID 18585042 (Harato 2008, qualidade moderada).
2. Um estudo encontrou mais flexão do tronco na marcha de pessoas com osteoartrite de joelho, mas a metanálise não viu aumento claro no plano sagital (o aumento claro foi na inclinação lateral do tronco). Condição desse tipo pode contribuir para a inclinação medida.
   - Tipo de estudo: estudo observacional.
   - Ressalva: Evidência mista: a metanálise de 32 artigos (Iijima) viu aumento claro da inclinação lateral do tronco e aumento não significativo da flexão do tronco e da pelve, e classificou todas as medidas como de certeza muito baixa pelo método GRADE; Preece relata aumento médio de 2,6° na flexão do tronco em captura 3D (o resumo não informa o número de participantes). A diferença média é pequena e pode ficar dentro da incerteza do vídeo.
   - Fontes: PMID 31254772 (Preece 2019, qualidade moderada); PMID 30904334 (Iijima 2019, qualidade moderada).
3. Caminhar em subida aumentou a inclinação anterior do tronco e da pelve; piso ou esteira com inclinação durante a gravação pode contribuir para a inclinação medida.
   - Tipo de estudo: estudo experimental.
   - Ressalva: 8 adultos saudáveis em esteira com 0, 5 e 10% de inclinação, avaliados em todas as inclinações; na descida houve inclinação para trás. Mostra o efeito do terreno e vale como lembrete de conferir o nivelamento do local de gravação.
   - Fontes: PMID 11809582 (Leroux 2002, qualidade moderada).

**O que conferir na avaliação presencial**

- Conferir se o piso ou a esteira estavam nivelados durante a gravação. (fonte: PMID 11809582, Leroux 2002)
- Perguntar sobre dor ou rigidez no joelho, no quadril e na coluna lombar. (fonte: PMID 31254772, Preece 2019)
- Medir a extensão passiva do joelho e do quadril de cada lado. (fonte: PMID 18585042, Harato 2008)
- Observar a coluna no exame presencial: o vídeo mede a reta quadril–ombro e não a curvatura da coluna. (sem referência verificada; sugestão ao profissional)

## O que ficou sem referência verificada

Fatores marcados **a confirmar** e itens a conferir sem fonte. São sugestões de método ou de exame, não afirmações da literatura:

- `assimetria_flexao_joelho`, a conferir: Comparar a força de extensão do joelho entre os lados (por exemplo, com dinamometria) e confirmar no exame presencial.
- `assimetria_flexao_joelho`, a conferir: Rever os quadros de maior flexão: de lado, o membro mais distante da câmera pode ter sido detectado com menos precisão.
- `assimetria_flexao_quadril`, a conferir: Perguntar sobre dor na região da virilha ou do quadril e sobre cirurgia prévia no quadril.
- `assimetria_flexao_quadril`, a conferir: Rever os quadros: a inclinação do tronco e a rotação da pelve mudam o ângulo do quadril projetado no plano da imagem.
- `assimetria_dorsiflexao`, a conferir: Conferir se o calçado, a posição e a abertura dos pés eram iguais nos dois lados.
- `desvio_lateral_pelve`, a conferir: Conferir se os pés estavam na mesma posição e se o peso estava distribuído por igual no início de cada repetição.
- `inclinacao_tronco`, fator "restricao_do_avanco_do_joelho": Manter os joelhos atrás da ponta dos pés, por instrução ou por estratégia, pode contribuir para a inclinação do tronco medida.
- `inclinacao_tronco`, a conferir: Comparar o comprimento do fêmur com o do tronco da pessoa.
- `inclinacao_tronco`, a conferir: Observar a curvatura da coluna no exame presencial: o vídeo mede a reta quadril–ombro e não a curvatura lombar.
- `avanco_joelho`, a conferir: Conferir se a ponta do pé marcada pelo detector corresponde ao calçado usado e se os pés mudaram de posição entre as repetições.
- `avanco_joelho`, a conferir: Decidir se o avanço será usado como critério: o sistema não define limite, e só o profissional pode ativar um critério.
- `variacao_profundidade`, fator "referencia_de_profundidade_e_ritmo": A referência de profundidade usada (marca, banco ou instrução) e o ritmo da execução podem contribuir para variar a profundidade entre as repetições.
- `variacao_profundidade`, a conferir: Confirmar se havia a mesma referência de profundidade (banco, marca ou instrução) em todas as repetições.
- `variacao_profundidade`, a conferir: Conferir os marcos do ponto mais baixo de cada repetição antes de interpretar a variação.
- `tendencia_na_serie`, fator "familiarizacao_e_ritmo": A adaptação ao movimento nas primeiras repetições e a mudança de ritmo ao longo da série podem contribuir para a mudança observada.
- `tendencia_na_serie`, a conferir: Verificar se a duração da repetição mudou ao longo da série e se a mudança aparece em mais de uma medida.
- `tendencia_na_serie`, a conferir: Confirmar no vídeo se os pés, a câmera ou o enquadramento mudaram entre a primeira e a última repetição.
- `tendencia_na_serie`, a conferir: Perguntar sobre cansaço ou dor que apareceu durante a série e sobre aquecimento antes da gravação.
- `assimetria_tempo_apoio`, fator "velocidade_e_eventos": A variação da velocidade entre as passadas e o erro na marcação dos eventos de contato e de saída do pé podem contribuir para uma diferença no tempo de apoio.
- `assimetria_tempo_apoio`, a conferir: Conferir quadro a quadro os eventos de contato e de saída do pé usados nas passadas de cada lado.
- `assimetria_tempo_apoio`, a conferir: Se possível, repetir a gravação com mais passadas e velocidade mais constante.
- `assimetria_flexao_joelho_marcha`, a conferir: Perguntar sobre dor, derrame ou cirurgia no joelho e sobre entorses.
- `assimetria_flexao_joelho_marcha`, a conferir: Conferir se o membro mais distante da câmera foi detectado corretamente na fase de balanço.
- `assimetria_amplitude_quadril`, a conferir: Perguntar sobre dor na virilha, no quadril ou na região lombar de cada lado.
- `assimetria_amplitude_quadril`, a conferir: Lembrar que o ângulo medido inclui a inclinação do tronco: conferir se a amplitude muda junto com a inclinação do tronco.
- `inclinacao_tronco_marcha`, a conferir: Observar a coluna no exame presencial: o vídeo mede a reta quadril–ombro e não a curvatura da coluna.

Fatores a confirmar: **4** (`restricao_do_avanco_do_joelho`, `referencia_de_profundidade_e_ritmo`, `familiarizacao_e_ritmo` e `velocidade_e_eventos`).

Lacunas da busca e pontos de evidência fraca ou mista, para o time científico decidir:

- **Restrição do avanço do joelho e inclinação do tronco** (`inclinacao_tronco`): o único estudo encontrado que media a inclinação do tronco nessa condição (PMID 14636100) tem 7 participantes e foi removido na avaliação metodológica; o fator ficou "a confirmar". O estudo de List 2013 mostra mudança no movimento do tronco, mas não como reta quadril-ombro.
- **Proporção entre fêmur e tronco** (`inclinacao_tronco`): as buscas feitas no PubMed não encontraram artigo que a sustentasse com o que o resumo diz; ficou só como item a conferir.
- **Referência de profundidade e ritmo** (`variacao_profundidade`), **familiarização e ritmo** (`tendencia_na_serie`) e **velocidade e erro de eventos** (`assimetria_tempo_apoio`): decorrem da forma de coletar o vídeo e da incerteza do método. Sem artigo verificado.
- **Força do quadril e valgo** (`valgo_dinamico`): duas revisões sistemáticas (2021 e 2026) não sustentam a relação de forma consistente. A biblioteca registra o fator justamente para dizer que a evidência é conflitante. A revisão de 2012 saiu por estar superada.
- **Dorsiflexão e valgo** (`valgo_dinamico`): a metanálise de Lima 2017 (17 estudos) associa menor dorsiflexão ao valgo, mas um caso-controle de 140 pessoas não encontrou correlação com o ângulo frontal. Evidência mista, declarada na ressalva.
- **Impacto femoroacetabular e flexão do quadril** (`assimetria_flexao_quadril`): revisão com metanálise sem diferença significativa na cinemática e revisão que relata efeito sobre o desempenho no agachamento; o fator é inconclusivo.
- **Tempo de apoio e dor no joelho** (`assimetria_tempo_apoio`): em uma coorte, a gravidade da dor não se associou à assimetria temporal; a metanálise de apoio mais curto é de osteoartrite de quadril. O fator de AVC foi eliminado.
- **Tensão dos flexores do quadril** (`assimetria_amplitude_quadril`): o fator foi eliminado. O estudo de idosos (Kerrigan 2001) não mediu a tensão, e o de alongamento (Mettler 2019) não teve grupo controle e foi em corrida. A restrição de mobilidade do quadril segue no fator de osteoartrite e mobilidade passiva.
- **Tronco na marcha com osteoartrite de joelho** (`inclinacao_tronco_marcha`): a metanálise (certeza muito baixa pelo GRADE) não viu aumento claro da flexão do tronco no plano sagital; um estudo isolado viu 2,6°, que pode ficar dentro da incerteza do vídeo. Fator de condição do quadril (fratura de acetábulo) eliminado.
- **Fadiga** (`tendencia_na_serie`): a única revisão retida é de aterrissagens de salto (qualidade alta, aplicabilidade indireta); sem dado para séries curtas de agachamento.
- **Flexão do joelho no balanço** (`assimetria_flexao_joelho_marcha`): as fontes de AVC saíram; ficam um experimento de redução da força dos flexores plantares em adultos jovens saudáveis e as fontes de osteoartrite, que não especificam a fase do pico de flexão.
- **Populações com doença** (osteoartrite, reconstrução do ligamento cruzado anterior): várias fontes só valem para quem tem a condição, e as ressalvas dizem isso.
- **Ligamento cruzado anterior e ângulo de flexão do joelho** (`assimetria_flexao_joelho`): Ishida 2023 e Roos 2014 descrevem assimetria de momentos e de carga; em Roos a simetria do pico de flexão do joelho foi 100 ± 3, 100 ± 3 e 99 ± 3 (controles, reconstruído, rompido), sem diferença dos controles. O fator fica registrado justamente para dizer que as fontes não sustentam diferença de ângulo.
- **Quadríceps e apoio entre os lados** (`desvio_lateral_pelve`): em Ishida 2023 não houve diferença de força vertical entre os lados no grupo de quadríceps fraco; a compensação descrita foi entre as articulações do mesmo membro.
- **Dorsiflexão e inclinação do tronco** (`inclinacao_tronco`): da Costa 2021 (30 adultos, agachamento unipodal em 3D) não associou a dorsiflexão passiva ao tronco, só a dinâmica; fica como evidência contrária ao lado de Cai 2026, que é um experimento em homens com dorsiflexão restrita.
- **Dorsiflexão, dor patelofemoral e diferença entre os lados** (`assimetria_dorsiflexao`): em Emamvirdi 2023 a dorsiflexão foi menor nos dois lados, e na dor patelofemoral e nos controles o índice de assimetria ficou abaixo da variação individual; o cálculo amostral usou efeito 0,30 e poder 0,30.
- **Osteoartrite e diferença entre os lados na marcha** (`assimetria_flexao_joelho_marcha`, `assimetria_amplitude_quadril`): Steingrebe 2023 e Creaby 2012 comparam com controles, não entre os lados (Steingrebe exclui estudos de assimetria e mostra alterações também no lado contralateral); por isso o tipo de estudo desses dois fatores é "observacional".
- **Dorsiflexão e profundidade** (`variacao_profundidade`): em Walker 2026 os testes foram unicaudais (o lado direito deixa de ser significativo em teste bicaudal) e as correlações explicam 5% e 14% da variância.
- **Modelo de pose** (`valgo_dinamico`): Haberkamp 2022 valida um modelo de estimativa de pose 2D (OpenPose, palavra-chave do registro), e o app usa o MediaPipe, sem validação própria.
- **Diferença entre os lados**: a maior parte das fontes compara grupos ou condições; nenhuma testou diretamente quanto de diferença entre os lados, em graus, indica alguma condição. Por isso a biblioteca não propõe valores.
- **Ferramenta.** Dill 2014 e Seeley 2010 têm texto completo indexado no PubMed Central, mas a ferramenta o devolveu vazio: foram avaliados só pelo resumo.

## Fontes removidas e fatores que mudaram

Fontes removidas na avaliação metodológica (motivo resumido; ficha completa em `docs/avaliacao-metodologica-fontes.md`):

- **Barber-Westin 2017** (PMID 28298066): Busca em uma base só e sem risco de viés no resumo. A revisão de Vermeulen 2023 (registrada, cinco bases, risco de viés) cobre a fadiga em aterrissagens.
- **Borrelli 2002** (PMID 11818800): Série de casos com muitas comparações e uma única diferença, em população específica; não sustenta um fator.
- **Cashman 2012** (PMID 22894982): Revisão cautelosa, mas de 2011, com um autor e sem risco de viés no resumo; as revisões de 2021 e de 2026 cobrem a mesma pergunta com mais estudos.
- **Endo 2020** (PMID 32581431): Nove participantes com regressão de vários preditores e conclusão (um lado afeta o outro) além dos dados; Kim 2015 (101 participantes) cobre a mesma pergunta.
- **Fry 2003** (PMID 14636100): Amostra de 7 e método antigo; List 2013 estuda a mesma pergunta com 30 pessoas e captura 3D. A inclinação do tronco com os joelhos restritos fica sem referência (a confirmar).
- **Fujita 2022** (PMID 36166956): Subgrupos exploratórios e correlações transversais em AVC, chamadas de causa no resumo; Apti 2016 cobre a ligação com os flexores plantares em adultos saudáveis.
- **Honda 2022** (PMID 35193063): A menor dorsiflexão e a maior flexão do tronco aparecem juntas no grupo mais velho, sem que o estudo isole a dorsiflexão. Cai 2026 manipula a dorsiflexão.
- **Kerrigan 2001** (PMID 11239282): Mostra menor extensão do quadril em idosos, mas não mede a tensão dos flexores nem compara os lados; a restrição é interpretação dos autores.
- **Krajewski 2025** (PMID 39815400): Revisão narrativa em AVC: está no nível mais baixo da hierarquia e não serve de fonte para um fator.
- **Lamontagne 2011** (PMID 21543687): Série pré e pós-operatória sem controle, de 10 pacientes; a revisão com metanálise de 2025 cobre a mesma pergunta com mais estudos.
- **Lugade 2010** (PMID 20542608): Grupos pequenos e comparação pré-operatória secundária; Constantinou 2014 (30 artigos) já mostra a assimetria do apoio na osteoartrite de quadril.
- **Mauntel 2013** (PMID 23096063): Classificação visual dos grupos, muitas variáveis com p próximo de 0,05 e conclusão causal e prescritiva no resumo. A dorsiflexão e o valgo têm fontes melhores; a coativação deixa de ser citada.
- **Mettler 2019** (PMID 29927892): Sem grupo controle, em corrida e com resultado nulo; não sustenta nem refuta a hipótese para a marcha.
- **Murray 1985** (PMID 4042479): Série de casos antiga, só de homens e sem controle no resumo; Constantinou 2014 e Corrigan 2023 cobrem a assimetria temporal com desenhos melhores.
- **Seeley 2010** (PMID 24149783): Valores de p no resumo incompatíveis com a conclusão, desfecho (momentos e potências) diferente dos achados do app e subgrupo de 7. Khamis 2017 cobre a pergunta.
- **Staines 2026** (PMID 42107174): Variável e população diferentes do achado (balanço em AVC, não apoio); a interpretação é dos autores e o rótulo de ensaio randomizado no registro não bate com o resumo.
- **Tsutsumi 2026** (PMID 42804966): Antes e depois sem controle em 24 pacientes; a inclinação do tronco muda com a cirurgia, a dor e o tempo ao mesmo tempo.
- **Webster 2014** (PMID 24934927): Amostra de 10 por grupo entre pessoas, só homens, e conclusão prática além do medido. Strong 2023 traz amostra maior, três momentos e controles.

Fatores:

- **Eliminados** (sem fonte retida e sem fator irmão a perder): `equilibrio_apos_avc` e `alteracoes_neuromotoras_apos_avc` (fontes de AVC com desfecho ou população diferentes do achado, revisão narrativa e subgrupos exploratórios), `tensao_dos_flexores_do_quadril` (a restrição de mobilidade do quadril segue em `restricao_de_mobilidade_do_quadril`) e `condicao_do_quadril` da marcha (série de casos de fratura de acetábulo).
- **Passou a "a confirmar":** `restricao_do_avanco_do_joelho` (`inclinacao_tronco`).
- **Renomeado:** `forca_e_coativacao_do_quadril` virou `forca_do_quadril`; a coativação saiu com a fonte removida.
- **Fonte reincluída para limitar:** da Costa 2021 (PMID 33713896) voltou como fonte que limita `dorsiflexao_e_tronco` (`inclinacao_tronco`): o resumo não associa a dorsiflexão passiva ao tronco. Decisão "manter com ressalva", aplicabilidade indireta (critério e: fonte que contradiz o fator não é omitida).
- **Rótulo de força trocado para "observacional":** `dor_ou_osteoartrite_joelho_quadril` (`assimetria_flexao_joelho_marcha`) e `restricao_de_mobilidade_do_quadril` (`assimetria_amplitude_quadril`), porque nenhuma fonte comparou um lado com o outro.
- **Reescritos com a fonte nova:** `mobilidade_tornozelo_pe` (metanálise de Lima 2017), `projecao_2d` (validação de estimativa de pose 2D de Haberkamp 2022), `condicao_do_quadril` da flexão do quadril (revisão de Cheatham 2018) e `apoio_assimetrico_pos_lca` (Strong 2023 no lugar de Webster 2014).

## Quadro final das fontes retidas

Quadro das 37 fontes que o laudo pode citar (a ficha completa e as 18 removidas estão em `docs/avaliacao-metodologica-fontes.md`).

| Fonte | Desenho | Qualidade | Decisão | Onde é usada |
| --- | --- | --- | --- | --- |
| **Alzahrani 2021** (PMID 34300118) | Revisão sistemática qualitativa de 7 estudos observacionais com análise de movimento 2D em adultos saudáveis | moderada | manter com ressalva | `valgo_dinamico` (fator forca_do_quadril, a conferir) |
| **Apti 2016** (PMID 27131202) | Antes e depois com controle externo: fraqueza experimental dos flexores plantares por alongamento passivo, 3D, 20 adultos e 7 controles | moderada | manter com ressalva | `assimetria_flexao_joelho_marcha` (fator flexores_plantares, a conferir) |
| **Baker 2016** (PMID 26895694) | Estudo transversal de três grupos (osteoartrite de quadril moderada, grave e assintomáticos): extensão passiva por goniometria e dinâmica na esteira | moderada | manter com ressalva | `assimetria_amplitude_quadril` (fator restricao_de_mobilidade_do_quadril, a conferir) |
| **Cai 2026** (PMID 42551866) | Experimento intrassujeito de laboratório: agachamento com carga em seis alturas de calcanhar (0 a 5 cm), em homens com dorsiflexão restrita | moderada | manter com ressalva | `assimetria_dorsiflexao` (fator elevacao_do_calcanhar); `inclinacao_tronco` (fator dorsiflexao_e_tronco, a conferir); `avanco_joelho` (fator dorsiflexao_e_elevacao_do_calcanhar); `variacao_profundidade` (fator elevacao_do_calcanhar) |
| **Cashman 2026** (PMID 42476040) | Revisão sistemática com metanálise parcial de 22 artigos sobre força do quadril e valgo em assintomáticos (busca em maio de 2026) | moderada | manter com ressalva | `valgo_dinamico` (fator forca_do_quadril) |
| **Cheatham 2018** (PMID 28290757) | Revisão sistemática (PRISMA) de 15 estudos sobre condições do quadril e desempenho no agachamento, graduados pela escala PEDro | moderada | manter com ressalva | `assimetria_flexao_quadril` (fator condicao_do_quadril) |
| **Constantinou 2014** (PMID 24450373) | Revisão sistemática com metanálise de 30 artigos sobre parâmetros espaço-temporais da marcha na osteoartrite de quadril | moderada | manter com ressalva | `assimetria_tempo_apoio` (fator dor_ou_doenca_articular_unilateral, a conferir) |
| **Corrigan 2023** (PMID 36305013) | Coorte prospectiva (Multicenter Osteoarthritis Study), análise exploratória de pessoas com dor unilateral leve a moderada no joelho, passarela GAITRite | moderada | manter com ressalva | `assimetria_tempo_apoio` (fator dor_ou_doenca_articular_unilateral) |
| **Creaby 2012** (PMID 22385873) | Coorte de laboratório com comparação entre grupos: osteoartrite medial do joelho unilateral ou bilateral e controles, marcha em 3D | moderada | manter com ressalva | `assimetria_flexao_joelho_marcha` (fator dor_ou_osteoartrite_joelho_quadril) |
| **da Costa 2021** (PMID 33713896) | Estudo transversal de laboratório com amostra de conveniência: agachamento unipodal em 3D, dorsiflexão passiva em carga e dorsiflexão dinâmica | moderada | manter com ressalva | `inclinacao_tronco` (fator dorsiflexao_e_tronco) |
| **Dill 2014** (PMID 25144599) | Estudo transversal de laboratório: dois grupos por dorsiflexão, em agachamento com braços elevados, agachamento unipodal e aterrissagem | moderada | manter com ressalva | `assimetria_flexao_joelho` (fator dorsiflexao_limitada, a conferir); `assimetria_dorsiflexao` (a conferir); `inclinacao_tronco` (a conferir); `avanco_joelho` (a conferir) |
| **Emamvirdi 2023** (PMID 37524846) | Estudo observacional transversal entre grupos (instabilidade crônica do tornozelo, dor patelofemoral e controles); agachamento unipodal em vídeo 2D | moderada | manter com ressalva | `assimetria_dorsiflexao` (fator dor_ou_instabilidade_tornozelo, a conferir); `valgo_dinamico` (fator dor_ou_lesao_previa, a conferir) |
| **Generoso 2025** (PMID 40391865) | Revisão sistemática com metanálise (6 estudos, 5 na metanálise) de agachamento em 3D antes e depois da cirurgia de impacto femoroacetabular | moderada | manter com ressalva | `assimetria_flexao_quadril` (fator condicao_do_quadril) |
| **Gomes 2020** (PMID 32022631) | Estudo correlacional transversal: profundidade do agachamento com barra (cinemática 2D), dorsiflexão (smartphone e dinamometria) e rigidez do tendão (elastografia) | moderada | manter com ressalva | `assimetria_flexao_quadril` (fator mobilidade_quadril_tornozelo); `assimetria_dorsiflexao` (fator tendao_calcaneo); `variacao_profundidade` (fator mobilidade_dorsiflexao_e_quadril) |
| **Haberkamp 2022** (PMID 36198251) | Estudo de validação: estimativa de pose 2D (OpenPose) frente a 3D e a análise 2D tradicional, em agachamento unipodal de adolescentes atletas | moderada | manter com ressalva | `valgo_dinamico` (fator projecao_2d) |
| **Hannan 2022** (PMID 36237648) | Estudo cruzado de laboratório: 20 agachamentos com peso do corpo em dois ritmos, sobre duas plataformas de força | moderada | manter com ressalva | `assimetria_flexao_joelho` (fator dominancia_do_membro); `desvio_lateral_pelve` (fator dominancia_do_membro) |
| **Harato 2008** (PMID 18585042) | Experimento intrassujeito: contratura de flexão do joelho simulada por órtese (15° e 30°) em 10 mulheres saudáveis, marcha em 3D | moderada | manter com ressalva | `inclinacao_tronco_marcha` (fator limitacao_de_extensao_do_joelho, a conferir) |
| **Hassan 2022** (PMID 35989174) | Caso-controle: teste de descida de degrau filmado, ângulo de projeção frontal por software (Kinovea) | moderada | manter com ressalva | `assimetria_dorsiflexao` (fator dor_ou_instabilidade_tornozelo); `valgo_dinamico` (fator mobilidade_tornozelo_pe) |
| **Iijima 2019** (PMID 30904334) | Revisão sistemática com metanálise de efeitos aleatórios: 32 artigos (2037 participantes) de tronco e quadril na marcha com osteoartrite de joelho | moderada | manter com ressalva | `inclinacao_tronco_marcha` (fator osteoartrite_de_joelho) |
| **Ishida 2023** (PMID 37441507) | Estudo transversal de laboratório (dois grupos pela simetria de força do quadríceps) em agachamento bipodal, mais de 1 ano após reconstrução do LCA | moderada | manter com ressalva | `assimetria_flexao_joelho` (fator quadriceps_pos_lca, a conferir); `desvio_lateral_pelve` (fator quadriceps_de_um_lado) |
| **Kernozek 2018** (PMID 28422563) | Experimento intrassujeito de laboratório com modelo musculoesquelético: agachamento com joelhos atrás ou além da ponta dos pés | moderada | manter com ressalva | `avanco_joelho` (fator instrucao_de_execucao, a conferir) |
| **Khamis 2017** (PMID 28600975) | Revisão sistemática (PRISMA) de 12 estudos: 4 de diferença anatômica de comprimento e 8 de diferença simulada com elevações de 1 a 5 cm | moderada | manter com ressalva | `assimetria_tempo_apoio` (fator comprimento_dos_membros, a conferir); `assimetria_flexao_joelho_marcha` (fator comprimento_dos_membros, a conferir); `assimetria_amplitude_quadril` (fator comprimento_dos_membros, a conferir) |
| **Kim 2015** (PMID 25964810) | Estudo transversal: amplitude de movimento e força relacionadas à profundidade do agachamento fotografada de lado, regressão por etapas | moderada | manter com ressalva | `assimetria_flexao_quadril` (fator mobilidade_quadril_tornozelo, a conferir); `variacao_profundidade` (fator mobilidade_dorsiflexao_e_quadril, a conferir) |
| **Leroux 2002** (PMID 11809582) | Experimento intrassujeito: esteira com inclinação de 0, 5 e 10% (subida e descida) em 8 adultos saudáveis, marcha em 3D | moderada | manter com ressalva | `inclinacao_tronco_marcha` (fator piso_inclinado, a conferir) |
| **Lima 2017** (PMID 28974358) | Revisão sistemática com metanálise de 17 estudos que comparam a dorsiflexão de pessoas com e sem valgo dinâmico do joelho | moderada | manter | `valgo_dinamico` (fator mobilidade_tornozelo_pe) |
| **List 2013** (PMID 22990570) | Experimento intrassujeito: agachamento com barra, restrito e livre, com cargas de 0, 25 e 50% do peso corporal, captura 3D com 12 câmeras | moderada | manter com ressalva | `avanco_joelho` (fator instrucao_de_execucao) |
| **Lopes 2018** (PMID 29895235) | Revisão sistemática com metanálise de 16 estudos de confiabilidade e validade da análise 2D do plano frontal (agachamento, aterrissagem, corte) | moderada | manter | `valgo_dinamico` (fator projecao_2d, a conferir) |
| **Macrum 2011** (PMID 22100617) | Experimento intrassujeito de laboratório: agachamento bipodal com e sem cunha de 12° sob o antepé (o resumo o rotula como transversal) | moderada | manter com ressalva | `assimetria_flexao_joelho` (fator dorsiflexao_limitada); `valgo_dinamico` (fator mobilidade_tornozelo_pe) |
| **Miyasaka 2023** (PMID 37374309) | Estudo transversal: módulo de Young do tendão do calcâneo (elastografia) e dorsiflexão na profundidade máxima do agachamento, regressão múltipla | moderada | manter com ressalva | `assimetria_dorsiflexao` (fator tendao_calcaneo) |
| **Preece 2019** (PMID 31254772) | Caso-controle de laboratório: pessoas com osteoartrite de joelho e controles saudáveis, curvas inteiras por mapeamento paramétrico estatístico | moderada | manter com ressalva | `inclinacao_tronco_marcha` (fator osteoartrite_de_joelho, a conferir) |
| **Roos 2014** (PMID 24581172) | Estudo observacional transversal: ruptura do LCA, reconstrução e controles em agachamento bipodal até a profundidade máxima | moderada | manter com ressalva | `assimetria_flexao_joelho` (fator quadriceps_pos_lca); `desvio_lateral_pelve` (fator apoio_assimetrico_pos_lca) |
| **Song 2021** (PMID 34628200) | Estudo correlacional longitudinal curto: agachamento bipodal em atletas universitários em dois momentos (0 a 6 e 6 a 12 meses) após reconstrução do LCA | moderada | manter com ressalva | `desvio_lateral_pelve` (fator apoio_assimetrico_pos_lca, a conferir) |
| **Steingrebe 2023** (PMID 38046934) | Revisão sistemática com metanálise de efeitos aleatórios: 35 estudos de cinemática de pessoas com osteoartrite de quadril em tarefas de locomoção | alta | manter com ressalva | `assimetria_flexao_joelho_marcha` (fator dor_ou_osteoartrite_joelho_quadril); `assimetria_amplitude_quadril` (fator restricao_de_mobilidade_do_quadril) |
| **Strong 2023** (PMID 37853508) | Coorte longitudinal com controles: agachamento bipodal em três momentos após reconstrução do LCA (24 pessoas) e 29 controles, análise funcional de curvas | moderada | manter com ressalva | `desvio_lateral_pelve` (fator apoio_assimetrico_pos_lca, a conferir) |
| **Vermeulen 2023** (PMID 37181257) | Revisão sistemática (PRISMA 2020) de 21 estudos do efeito da fadiga sobre tronco e pelve na aterrissagem de saltos | alta | manter com ressalva | `tendencia_na_serie` (fator fadiga_muscular) |
| **Walker 2026** (PMID 42516619) | Estudo correlacional transversal: profundidade do agachamento unipodal (câmera única 3D), força do quadril (dinamômetro manual fixo) e dorsiflexão em carga | moderada | manter com ressalva | `variacao_profundidade` (fator mobilidade_dorsiflexao_e_quadril) |
| **Wyndow 2016** (PMID 26816531) | Estudo correlacional transversal: agachamento unipodal filmado em vídeo 2D, regressão com equações de estimativa generalizadas | moderada | manter com ressalva | `valgo_dinamico` (fator mobilidade_tornozelo_pe, a conferir) |

## Fontes

Lista por PMID das fontes retidas, com o trecho literal que o laudo exibe, a qualidade metodológica e a limitação principal. O mesmo PMID tem sempre os mesmos dados em todas as chaves. As fontes removidas estão em `docs/avaliacao-metodologica-fontes.md`.

- **PMID 34300118**: Alzahrani AM, Alzhrani M, Alshahrani SN, Alghamdi W, Alqahtani M, Alzahrani H. Is Hip Muscle Strength Associated with Dynamic Knee Valgus in a Healthy Adult Population? A Systematic Review. Int J Environ Res Public Health. 2021;18(14).
  - DOI: [10.3390/ijerph18147669](https://doi.org/10.3390/ijerph18147669). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática de 7 estudos com adultos saudáveis e análise de movimento bidimensional.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: Sete estudos transversais em adultos saudáveis, com pouco controle de confundidores; resultado conflitante entre os estudos.
  - Trecho literal do resumo: "The relationship between hip muscle strength, including abductors, extensors, and external rotators and DKV is conflicting."
  - Usada em: `valgo_dinamico`.
- **PMID 27131202**: Apti A, Akalan NE, Kuchimov S, Özdinçler AR, Temelli Y, Nene A. Plantar flexor muscle weakness may cause stiff-knee gait. Gait Posture. 2016;46:201-7.
  - DOI: [10.1016/j.gaitpost.2016.03.010](https://doi.org/10.1016/j.gaitpost.2016.03.010). Conferido no PubMed em 2026-10-18.
  - População: 20 adultos jovens saudáveis (e 7 controles); fraqueza experimental dos flexores plantares.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 20 adultos jovens saudáveis com fraqueza induzida por alongamento passivo e 7 controles; efeito agudo, não fraqueza crônica; não compara os lados.
  - Trecho literal do resumo: "After PS, the reduction of plantar flexor muscle strength (33.14%) caused knee flexion velocity drop at toe-off (p=0.008) and developed SKG pattern by decreasing peak knee flexion (p=0.0001), range of knee flexion in early swing (p=0.006), and total knee flexion range (p=0.002)."
  - Usada em: `assimetria_flexao_joelho_marcha`.
- **PMID 26895694**: Baker M, Moreside J, Wong I, Rutherford DJ. Passive hip movement measurements related to dynamic motion during gait in hip osteoarthritis. J Orthop Res. 2016;34(10):1790-1797.
  - DOI: [10.1002/jor.23198](https://doi.org/10.1002/jor.23198). Conferido no PubMed em 2026-10-18.
  - População: Pessoas com osteoartrite de quadril moderada e grave e grupo assintomático; marcha em esteira.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: Osteoartrite de quadril moderada e grave; sem relação no grupo assintomático; número de participantes não consta no resumo.
  - Trecho literal do resumo: "Significant correlations between dynamic and passive hip extension were found in the moderate (r = 0.596) and severe OA (r = 0.586) groups, and no correlation was found in the asymptomatic group (r = 0.139). Passive ROM explains variance in dynamic ROM measurements obtained during gait in individuals with moderate and severe hip OA which have implications for the design of treatment strategies targeting walking pathomechanics."
  - Usada em: `assimetria_amplitude_quadril`.
- **PMID 42551866**: Cai J, Sun D, Li F, Chen D, Zhu J, Song Y, et al. Dose-Dependent Effects of Heel Elevation on Kinetic Chain Reconstruction and Lumbar Stress During Loaded Squatting in Men With Restricted Ankle Dorsiflexion. J Strength Cond Res. 2026.
  - DOI: [10.1519/JSC.0000000000005639](https://doi.org/10.1519/JSC.0000000000005639). Conferido no PubMed em 2026-10-18.
  - População: 30 homens saudáveis com dorsiflexão do tornozelo restrita; agachamento com carga e elevação progressiva do calcanhar.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 30 homens saudáveis com dorsiflexão restrita, com carga e 3D; sem comparação com quem não tem restrição e sem teste de apoio diferente entre os lados.
  - Trecho literal do resumo: "Increasing heel elevation reduced peak ankle dorsiflexion and trunk forward inclination, while increasing peak knee flexion, hip flexion, and tibial progression angle (all p < 0.001)."
  - Usada em: `assimetria_dorsiflexao`, `inclinacao_tronco`, `avanco_joelho`, `variacao_profundidade`.
- **PMID 42476040**: Cashman G, White C, Stephens R, Hoggs-Johnson S, Kissel J. The effect of hip abductor or external rotator strength on dynamic knee valgus in healthy subjects-a systematic review with partial meta-analysis. Knee. 2026;62:104565.
  - DOI: [10.1016/j.knee.2026.104565](https://doi.org/10.1016/j.knee.2026.104565). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática com metanálise parcial de 22 artigos com indivíduos assintomáticos.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 22 estudos em assintomáticos sem metanálise significativa; o resumo não informa registro de protocolo nem risco de viés.
  - Trecho literal do resumo: "Weakness in hip abductors or external rotators may not result in increased dynamic knee valgus in healthy subjects."
  - Usada em: `valgo_dinamico`.
- **PMID 28290757**: Cheatham SW, Stull KR, Fantigrassi M, Montel I. Hip Musculoskeletal Conditions and Associated Factors That Influence Squat Performance: A Systematic Review. J Sport Rehabil. 2018;27(3):263-273.
  - DOI: [10.1123/jsr.2016-0246](https://doi.org/10.1123/jsr.2016-0246). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática de 15 estudos (542 participantes) sobre condições do quadril e desempenho no agachamento com barra, na descida de degrau e no agachamento bipodal ou unipodal.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 15 estudos heterogêneos sobre condições do quadril e desempenho no agachamento; o resumo não detalha a direção dos efeitos nem informa registro.
  - Trecho literal do resumo: "Femoroacetabular impingement and hip arthroscopy were the only hip conditions found that affected the squat. Associated factors, such as muscle pain, fatigue, and tightness, also influenced squat performance. This review found that common hip conditions and associated factors and their effects on squat performance to be underinvestigated."
  - Usada em: `assimetria_flexao_quadril`.
- **PMID 24450373**: Constantinou M, Barrett R, Brown M, Mills P. Spatial-temporal gait characteristics in individuals with hip osteoarthritis: a systematic literature review and meta-analysis. J Orthop Sports Phys Ther. 2014;44(4):291-B7.
  - DOI: [10.2519/jospt.2014.4634](https://doi.org/10.2519/jospt.2014.4634). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática com metanálise de 30 artigos sobre osteoartrite de quadril.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 30 artigos de osteoartrite de quadril; o resumo não informa registro, instrumento de qualidade nem heterogeneidade.
  - Trecho literal do resumo: "Consistent evidence was found for greater asymmetry in individuals with hip OA than controls, with shorter step length and stance duration in the affected compared to the contralateral limb."
  - Usada em: `assimetria_tempo_apoio`.
- **PMID 36305013**: Corrigan P, Felson DT, Lewis CL, Neogi T, LaValley MP, Gross KD, et al. Relation of Temporal Asymmetry During Walking to Two-Year Knee Pain Outcomes in Those With Mild-to-Moderate Unilateral Knee Pain: An Exploratory Analysis From the Multicenter Osteoarthritis Study. Arthritis Care Res (Hoboken). 2023;75(8):1735-1743.
  - DOI: [10.1002/acr.25050](https://doi.org/10.1002/acr.25050). Conferido no PubMed em 2026-10-18.
  - População: Participantes de uma coorte (Multicenter Osteoarthritis Study) com dor unilateral leve a moderada no joelho.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: Coorte exploratória de dor unilateral leve a moderada no joelho, com passarela de tempo e não vídeo; a gravidade da dor não se associou à assimetria.
  - Trecho literal do resumo: "For those with unilateral knee pain, temporal asymmetry during walking is not associated with pain severity. However, select measures of stance and single-limb support time during self-selected and fast walking relate to longitudinal knee pain outcomes."
  - Usada em: `assimetria_tempo_apoio`.
- **PMID 22385873**: Creaby MW, Bennell KL, Hunt MA. Gait differs between unilateral and bilateral knee osteoarthritis. Arch Phys Med Rehabil. 2012;93(5):822-7.
  - DOI: [10.1016/j.apmr.2011.11.029](https://doi.org/10.1016/j.apmr.2011.11.029). Conferido no PubMed em 2026-10-18.
  - População: 91 pessoas com osteoartrite medial de joelho uni ou bilateral e 31 controles assintomáticos.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 91 pessoas com osteoartrite medial do joelho e 31 controles; medida 3D; menor flexão em relação aos controles, não entre os joelhos, e o resumo não separa o pico de apoio do de balanço.
  - Trecho literal do resumo: "After controlling for walking speed, greater trunk lean toward the more painful knee and reduced flexion in the more painful knee were observed in all OA groups compared with the control group. Between-knee asymmetries indicating greater varus angle and a lower external flexion moment in the painful knee were present in those with unilateral pain and either unilateral or bilateral structural OA."
  - Usada em: `assimetria_flexao_joelho_marcha`.
- **PMID 33713896**: da Costa GV, de Castro MP, Sanchotene CG, Ribeiro DC, de Brito Fontana H, Ruschel C. Relationship between passive ankle dorsiflexion range, dynamic ankle dorsiflexion range and lower limb and trunk kinematics during the single-leg squat. Gait Posture. 86:106-111. Epub 2021.
  - DOI: [10.1016/j.gaitpost.2021.03.015](https://doi.org/10.1016/j.gaitpost.2021.03.015). Conferido no PubMed em 2026-10-18.
  - População: 30 adultos sem lesão (amostra de conveniência); agachamento unipodal com o membro dominante, análise cinemática 3D.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 30 adultos de conveniência; a dorsiflexão associada ao tronco é a dinâmica (parte do próprio movimento), não a mobilidade passiva.
  - Trecho literal do resumo: "Greater passive ankle dorsiflexion range was associated with smaller thigh internal rotation (r= -0.38). Greater dynamic ankle dorsiflexion range was associated with smaller trunk flexion (r = 0.59) and pelvis anteversion (r= -0.47). Passive ankle dorsiflexion range and dynamic ankle dorsiflexion range were not associated."
  - Usada em: `inclinacao_tronco`.
- **PMID 25144599**: Dill KE, Begalle RL, Frank BS, Zinder SM, Padua DA. Altered knee and ankle kinematics during squatting in those with limited weight-bearing-lunge ankle-dorsiflexion range of motion. J Athl Train. 2014;49(6):723-32.
  - DOI: [10.4085/1062-6050-49.3.29](https://doi.org/10.4085/1062-6050-49.3.29). Conferido no PubMed em 2026-10-18.
  - População: 40 adultos fisicamente ativos (20 com dorsiflexão limitada e 20 sem limitação).
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 40 adultos ativos comparados pela dorsiflexão em carga, com medida 3D; a dorsiflexão passiva sem carga não diferenciou os grupos.
  - Trecho literal do resumo: "Greater ankle DF-ROM assessed during the WBL was associated with greater knee-flexion and ankle-DF displacement during both squatting tasks as well as greater knee-varus displacement during the single-legged squat. Assessment of ankle DF-ROM using the WBL provided important insight into compensatory movement patterns during squatting, whereas nonweight-bearing passive ankle DF-ROM did not."
  - Usada em: `assimetria_flexao_joelho`, `assimetria_dorsiflexao`, `inclinacao_tronco`, `avanco_joelho`.
- **PMID 37524846**: Emamvirdi M, Hosseinzadeh M, Letafatkar A, Thomas AC, Dos'Santos T, Smania N, et al. Comparing kinematic asymmetry and lateral step-down test scores in healthy, chronic ankle instability, and patellofemoral pain syndrome female basketball players: a cross-sectional study. Sci Rep. 2023;13(1):12412.
  - DOI: [10.1038/s41598-023-39625-1](https://doi.org/10.1038/s41598-023-39625-1). Conferido no PubMed em 2026-10-18.
  - População: 60 atletas de basquete do sexo feminino (20 com instabilidade crônica do tornozelo, 20 com dor patelofemoral e 20 controles).
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 60 atletas de basquete (mulheres); estudo transversal, sem direção do efeito, com cálculo amostral de poder 0,30; a assimetria de dorsiflexão não foi relevante na dor patelofemoral.
  - Trecho literal do resumo: "Ankle dorsiflexion-ROM was less in the CAI and PFP than in the HC group regardless of limb (p < 0.001). DKV angle was greater in the CAI and PFP than in the HC group bilaterally (p < 0.001)."
  - Usada em: `assimetria_dorsiflexao`, `valgo_dinamico`.
- **PMID 40391865**: Generoso TO, Pelegrinelli ARM, Gonzalez FF, Pallone LV, Locks R, Guadagnin EC, et al. Squatting Biomechanics After Femoroacetabular Impingement Surgery: A Systematic Review and Meta-analysis. Clin J Sport Med. 36(3):296-307. Epub 2025.
  - DOI: [10.1097/JSM.0000000000001371](https://doi.org/10.1097/JSM.0000000000001371). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática com metanálise de 6 estudos (5 na metanálise) de pacientes com impacto femoroacetabular, antes e depois da cirurgia.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 6 estudos de pacientes operados por impacto femoroacetabular, com 3D e qualidade moderada pela MINORS; sem diferença cinemática significativa.
  - Trecho literal do resumo: "Although most studies reported no significant changes in kinematic or kinetic variables postsurgery, individual studies reported specific increases in squat depth, pelvic sagittal range of motion, anterior pelvic tilt, hip and knee flexion, and ankle dorsiflexion angles. Meta-analysis revealed no significant differences in the kinematic parameters analyzed."
  - Usada em: `assimetria_flexao_quadril`.
- **PMID 32022631**: Gomes J, Neto T, Vaz JR, Schoenfeld BJ, Freitas SR. Is there a relationship between back squat depth, ankle flexibility, and Achilles tendon stiffness? Sports Biomech. 21(7):782-795. Epub 2020.
  - DOI: [10.1080/14763141.2019.1690569](https://doi.org/10.1080/14763141.2019.1690569). Conferido no PubMed em 2026-10-18.
  - População: 20 adultos saudáveis; agachamento com barra analisado em vídeo bidimensional.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 20 adultos saudáveis; muitas correlações e só a dorsiflexão no teste de avanço se associou à profundidade; agachamento com barra.
  - Trecho literal do resumo: "In conclusion, back squat depth is associated with ankle dorsiflexion ROM when the knee is flexed, without evident influence of global joint and Achilles tendon mechanical properties."
  - Usada em: `assimetria_flexao_quadril`, `assimetria_dorsiflexao`, `variacao_profundidade`.
- **PMID 36198251**: Haberkamp LD, Garcia MC, Bazett-Jones DM. Validity of an artificial intelligence, human pose estimation model for measuring single-leg squat kinematics. J Biomech. 2022;144:111333.
  - DOI: [10.1016/j.jbiomech.2022.111333](https://doi.org/10.1016/j.jbiomech.2022.111333). Conferido no PubMed em 2026-10-18.
  - População: Atletas adolescentes (número não informado no resumo); agachamento unipodal com estimativa de pose 2D, vídeo 2D tradicional e captura 3D.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: Validação de um modelo de estimativa de pose 2D que não é o do app, em adolescentes no agachamento unipodal; o número de participantes não consta no resumo.
  - Trecho literal do resumo: "We observed moderate-to-strong relationships (r = 0.68-0.94) for sagittal plane joint angles between 2D pose estimation and 3D techniques. We observed fair correlations (r = 0.53-0.54) for frontal plane pelvic and hip joint angles between 2D pose estimation and 3D motion analysis. We observed poor relationships for the frontal plane knee angle between 3D motion analysis with 2D pose estimation (r = 0.20) and traditional 2D motion analysis (r = 0.05), respectively, but observed a strong relationship (r = 0.95) between the 2D techniques."
  - Usada em: `valgo_dinamico`.
- **PMID 36237648**: Hannan KB, King AC. Lower Limb Ground Reaction Force and Center of Pressure Asymmetry During Bodyweight Squats. Int J Sports Phys Ther. 2022;17(6):1075-1082.
  - DOI: [10.26603/001c.37861](https://doi.org/10.26603/001c.37861). Conferido no PubMed em 2026-10-18.
  - População: 18 adultos saudáveis e fisicamente ativos; agachamento bipodal sobre duas plataformas de força.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 18 adultos ativos; diferença entre as pernas em força de reação do solo e centro de pressão, e não em ângulo, com direção que muda conforme o ritmo e a variável.
  - Trecho literal do resumo: "with the preferred leg generating larger values than the non-preferred leg during the self-paced condition"
  - Usada em: `assimetria_flexao_joelho`, `desvio_lateral_pelve`.
- **PMID 18585042**: Harato K, Nagura T, Matsumoto H, Otani T, Toyama Y, Suda Y. A gait analysis of simulated knee flexion contracture to elucidate knee-spine syndrome. Gait Posture. 2008;28(4):687-92.
  - DOI: [10.1016/j.gaitpost.2008.05.008](https://doi.org/10.1016/j.gaitpost.2008.05.008). Conferido no PubMed em 2026-10-18.
  - População: 10 mulheres saudáveis (média de 62 anos) com contratura de flexão do joelho simulada por órtese.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 10 mulheres saudáveis com contratura de flexão do joelho simulada por órtese; só a contratura de 30° alterou o tronco.
  - Trecho literal do resumo: "The 15 degrees contracture did not significantly change trunk kinematics. However, the 30 degrees contracture significantly changed the kinematics in each of the following planes. In the coronal plane, the trunk tilted to the contracture side in standing and walking. In the sagittal plane, posterior inclination of the pelvis in standing significantly increased. In addition, anterior inclination of the trunk and pelvis during walking significantly increased."
  - Usada em: `inclinacao_tronco_marcha`.
- **PMID 35989174**: Hassan KA, Youssef RSE, Mahmoud NF, Eltagy H, El-Desouky MA. The relationship between ankle dorsiflexion range of motion, frontal plane projection angle, and patellofemoral pain syndrome. Foot Ankle Surg. 2022;28(8):1427-1432.
  - DOI: [10.1016/j.fas.2022.08.003](https://doi.org/10.1016/j.fas.2022.08.003). Conferido no PubMed em 2026-10-18.
  - População: 140 adultos (70 com síndrome da dor patelofemoral e 70 assintomáticos); teste de descida de degrau.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 70 pessoas com dor patelofemoral e 70 assintomáticas em descida de degrau; o ângulo frontal não se correlacionou com a dorsiflexão.
  - Trecho literal do resumo: "When the two groups were compared, ankle DF ROM measured with the knee flexed was higher in the control group (33.15 ± 4.96) than in the PFPS group (30.20 ± 6.93) (p = 0.03). In both the PFPS group and the control group, the correlation between FPPA and ankle DF ROM with the knee flexed was statistically insignificant (p = 0.075 and 0.323 respectively)."
  - Usada em: `assimetria_dorsiflexao`, `valgo_dinamico`.
- **PMID 30904334**: Iijima H, Shimoura K, Ono T, Aoyama T, Takahashi M. Proximal gait adaptations in individuals with knee osteoarthritis: A systematic review and meta-analysis. J Biomech. 2019;87:127-141.
  - DOI: [10.1016/j.jbiomech.2019.02.027](https://doi.org/10.1016/j.jbiomech.2019.02.027). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática com metanálise de 32 artigos (2037 participantes) com osteoartrite de joelho.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 32 artigos com certeza muito baixa pelo GRADE em todas as medidas; o aumento claro foi lateral, não sagital.
  - Trecho literal do resumo: "Individuals with knee OA had significantly increased lateral trunk lean toward the ipsilateral limb (pooled SMD: 1.18; 95% CI: 0.59, 1.77) along with significantly decreased EHAM. These subjects also displayed a non-significantly increased trunk/pelvic flexion angle and EHFM."
  - Usada em: `inclinacao_tronco_marcha`.
- **PMID 37441507**: Ishida T, Samukawa M, Koshino Y, Ino T, Kasahara S, Tohyama H. Interlimb Asymmetry in Knee Extension Moment During Double-Leg Squatting Is Associated With Persistent Quadriceps Weakness After ACL Reconstruction. Orthop J Sports Med. 2023;11(6):23259671231182105.
  - DOI: [10.1177/23259671231182105](https://doi.org/10.1177/23259671231182105). Conferido no PubMed em 2026-10-18.
  - População: 26 pessoas com mais de 1 ano após reconstrução do ligamento cruzado anterior; agachamento bipodal.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 26 pessoas com mais de 1 ano após reconstrução do ligamento cruzado anterior; desfecho em momento articular e não em ângulo, sem diferença de força vertical entre os lados; grupo de força baixa com 8 pessoas.
  - Trecho literal do resumo: "Asymmetrical biomechanics during double-leg squatting was associated with persistent quadriceps weakness after ACLR. The LQ group had reduced knee extensor moment on the involved side during squatting despite loading at approximately half the maximum strength."
  - Usada em: `assimetria_flexao_joelho`, `desvio_lateral_pelve`.
- **PMID 28422563**: Kernozek TW, Gheidi N, Zellmer M, Hove J, Heinert BL, Torry MR. Effects of Anterior Knee Displacement During Squatting on Patellofemoral Joint Stress. J Sport Rehabil. 2018;27(3):237-243.
  - DOI: [10.1123/jsr.2016-0197](https://doi.org/10.1123/jsr.2016-0197). Conferido no PubMed em 2026-10-18.
  - População: 25 mulheres saudáveis; agachamento com os joelhos atrás ou além da ponta dos pés (estimativa por modelo musculoesquelético).
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 25 mulheres saudáveis; estresse patelofemoral estimado por modelo e não medido.
  - Trecho literal do resumo: "The magnitudes of PFJS, reaction force, and quadriceps force were higher (P < .001) during SPT compared with the SBT technique. Knee flexion, hip flexion, and ankle dorsiflexion angles were reduced when using the SBT technique."
  - Usada em: `avanco_joelho`.
- **PMID 28600975**: Khamis S, Carmeli E. Relationship and significance of gait deviations associated with limb length discrepancy: A systematic review. Gait Posture. 2017;57:115-123.
  - DOI: [10.1016/j.gaitpost.2017.05.028](https://doi.org/10.1016/j.gaitpost.2017.05.028). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática de 12 estudos: diferença anatômica de comprimento dos membros e diferença simulada com elevações em pessoas saudáveis.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 12 estudos, 8 deles com diferença simulada por elevações em pessoas saudáveis; o resumo não detalha os desfechos.
  - Trecho literal do resumo: "A significant relationship was found between anatomic LLD and gait deviation."
  - Usada em: `assimetria_tempo_apoio`, `assimetria_flexao_joelho_marcha`, `assimetria_amplitude_quadril`.
- **PMID 25964810**: Kim SH, Kwon OY, Park KN, Jeon IC, Weon JH. Lower extremity strength and the range of motion in relation to squat depth. J Hum Kinet. 2015;45:59-69.
  - DOI: [10.1515/hukin-2015-0007](https://doi.org/10.1515/hukin-2015-0007). Conferido no PubMed em 2026-10-18.
  - População: 101 adultos saudáveis (64 homens e 37 mulheres).
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 101 adultos jovens saudáveis; associação com a profundidade (não com o ângulo do quadril nem a assimetria); regressão por etapas sem validação externa.
  - Trecho literal do resumo: "The multiple regression model indicated that ankle dorsiflexion with a flexed knee and the hip flexion ROM were significantly associated with squat depth in male subjects (R(2) = 0.435) and ankle dorsiflexion with an extended knee and dorsiflexor strength were significantly associated with squat depth in female subjects (R(2) = 0.324)."
  - Usada em: `assimetria_flexao_quadril`, `variacao_profundidade`.
- **PMID 11809582**: Leroux A, Fung J, Barbeau H. Postural adaptation to walking on inclined surfaces: I. Normal strategies. Gait Posture. 2002;15(1):64-74.
  - DOI: [10.1016/s0966-6362(01)00181-3](https://doi.org/10.1016/s0966-6362(01)00181-3). Conferido no PubMed em 2026-10-18.
  - População: 8 adultos saudáveis; esteira com inclinação de 0, 5 e 10% (subida e descida).
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 8 adultos saudáveis em esteira com 0, 5 e 10% de inclinação; mostra o efeito do piso, não de uma condição clínica.
  - Trecho literal do resumo: "Increasing the treadmill grade from 0 to 10% induced an increasingly flexed posture of the hip, knee and ankle at initial foot contact as well as a progressive forward tilt of pelvis and trunk."
  - Usada em: `inclinacao_tronco_marcha`.
- **PMID 28974358**: Lima YL, Ferreira VMLM, de Paula Lima PO, Bezerra MA, de Oliveira RR, Almeida GPL. The association of ankle dorsiflexion and dynamic knee valgus: A systematic review and meta-analysis. Phys Ther Sport. 29:61-69. Epub 2017.
  - DOI: [10.1016/j.ptsp.2017.07.003](https://doi.org/10.1016/j.ptsp.2017.07.003). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática com metanálise de 17 estudos que comparam a dorsiflexão do tornozelo de pessoas com e sem valgo dinâmico do joelho.
  - Qualidade metodológica: moderada (decisão: manter). Limitação principal: 17 estudos que comparam pessoas com e sem valgo dinâmico; transversal; o resumo não informa registro nem heterogeneidade.
  - Trecho literal do resumo: "Meta-analysis showed that reduced ADF is associated with participants presenting with DKV compared to controls (SMD -0.65, 95% CI -0.88 to -0.41)."
  - Usada em: `valgo_dinamico`.
- **PMID 22990570**: List R, Gülay T, Stoop M, Lorenzetti S. Kinematics of the trunk and the lower extremities during restricted and unrestricted squats. J Strength Cond Res. 2013;27(6):1529-38.
  - DOI: [10.1519/JSC.0b013e3182736034](https://doi.org/10.1519/JSC.0b013e3182736034). Conferido no PubMed em 2026-10-18.
  - População: 30 pessoas; agachamento com barra, com e sem restrição do avanço dos joelhos.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 30 pessoas com barra e captura 3D; mede ângulos e amplitudes do tronco e não cargas; a conclusão prescritiva do resumo não é usada.
  - Trecho literal do resumo: "In an unrestricted squat, the angle of the knee is larger and the range of motion (ROM) between the lumbar and the thoracic segments is significantly smaller compared with a restricted squat (p < 0.05)."
  - Usada em: `avanco_joelho`.
- **PMID 29895235**: Lopes TJA, Ferrari D, Ioannidis J, Simic M, Mícolis de Azevedo F, Pappas E. Reliability and Validity of Frontal Plane Kinematics of the Trunk and Lower Extremity Measured With 2-Dimensional Cameras During Athletic Tasks: A Systematic Review With Meta-analysis. J Orthop Sports Phys Ther. 2018;48(10):812-822.
  - DOI: [10.2519/jospt.2018.8006](https://doi.org/10.2519/jospt.2018.8006). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática com metanálise de 16 estudos sobre confiabilidade e validade da análise 2D do plano frontal em agachamento, aterrissagem e corte.
  - Qualidade metodológica: moderada (decisão: manter). Limitação principal: Revisão de 16 estudos sobre vídeo 2D e 3D; o resumo não informa registro de protocolo nem risco de viés.
  - Trecho literal do resumo: "In terms of validity, there was poor agreement between the 2-D and 3-D methods, with no correlation between 2-D knee frontal plane projection angle and 3-D knee frontal plane angles (r = 0.127, P = .094) for the single-leg squat, but a moderate to good relationship (r = 0.619, P<.001) for the landing task."
  - Usada em: `valgo_dinamico`.
- **PMID 22100617**: Macrum E, Bell DR, Boling M, Lewek M, Padua D. Effect of limiting ankle-dorsiflexion range of motion on lower extremity kinematics and muscle-activation patterns during a squat. J Sport Rehabil. 21(2):144-50. Epub 2011.
  - DOI: [10.1123/jsr.21.2.144](https://doi.org/10.1123/jsr.21.2.144). Conferido no PubMed em 2026-10-18.
  - População: 30 adultos saudáveis e fisicamente ativos, sem lesão prévia de membro inferior; agachamento com e sem cunha sob o antepé.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: Limitação de dorsiflexão simulada com cunha em 30 adultos saudáveis, com medida 3D; efeito pequeno sobre o ângulo de valgo.
  - Trecho literal do resumo: "Compared with the NW condition, the wedge produced decreased peak knee flexion (P < .001, effect size [ES] = 0.81) and knee-flexion excursion (P < .001, ES = 0.82) while producing increased peak ankle dorsiflexion (P = .006, ES = 0.31), ankle-dorsiflexion excursion (P < .001, ES = 0.31), peak knee-valgus angle (P = .02, ES = 0.21), and MKD (P < .001, ES = 2.92)."
  - Usada em: `assimetria_flexao_joelho`, `valgo_dinamico`.
- **PMID 37374309**: Miyasaka H, Ebihara B, Fukaya T, Mutsuzaki H. Relationship between the Young's Modulus of the Achilles Tendon and Ankle Dorsiflexion Angle at Maximum Squat Depth in Healthy Young Males. Medicina (Kaunas). 2023;59(6).
  - DOI: [10.3390/medicina59061105](https://doi.org/10.3390/medicina59061105). Conferido no PubMed em 2026-10-18.
  - População: 31 homens jovens saudáveis.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 31 homens jovens saudáveis; rigidez do tendão medida por elastografia, que o vídeo não mede; não compara os lados.
  - Trecho literal do resumo: "The Young's modulus of the AT may affect the ankle dorsiflexion angle at the maximum squat depth in healthy young males."
  - Usada em: `assimetria_dorsiflexao`.
- **PMID 31254772**: Preece SJ, Algarni AS, Jones RK. Trunk flexion during walking in people with knee osteoarthritis. Gait Posture. 2019;72:202-205.
  - DOI: [10.1016/j.gaitpost.2019.06.012](https://doi.org/10.1016/j.gaitpost.2019.06.012). Conferido no PubMed em 2026-10-18.
  - População: Pessoas com osteoartrite de joelho e controles saudáveis.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: Pessoas com osteoartrite de joelho e controles; diferença média pequena (2,6°) em 3D; número de participantes não consta no resumo.
  - Trecho literal do resumo: "Individuals with knee OA walked with a mean increase in trunk flexion of 2.6°. Although this difference was more pronounced during early stance, it was maintained across the whole of stance phase."
  - Usada em: `inclinacao_tronco_marcha`.
- **PMID 24581172**: Roos PE, Button K, van Deursen RW. Motor control strategies during double leg squat following anterior cruciate ligament rupture and reconstruction: an observational study. J Neuroeng Rehabil. 2014;11:19.
  - DOI: [10.1186/1743-0003-11-19](https://doi.org/10.1186/1743-0003-11-19). Conferido no PubMed em 2026-10-18.
  - População: 62 adultos (20 com ruptura do ligamento cruzado anterior sem reconstrução, 21 com ligamento reconstruído e 21 controles); agachamento bipodal.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 62 pessoas (ruptura, reconstrução e controles) com 3D e plataformas de força; assimetria de momentos e de carga, não de ângulo (a simetria do pico de flexão do joelho foi 100 ± 3); duas exclusões numa análise.
  - Trecho literal do resumo: "ACLR controlled knee moment magnitude using two strategies; 1) transfer of support moment to non-injured leg; 2) transfer of support moment from knee to ankle and/or hip of injured leg."
  - Usada em: `assimetria_flexao_joelho`, `desvio_lateral_pelve`.
- **PMID 34628200**: Song Y, Li L, Albrandt EE, Jensen MA, Dai B. Medial-lateral hip positions predicted kinetic asymmetries during double-leg squats in collegiate athletes following anterior cruciate ligament reconstruction. J Biomech. 2021;128:110787.
  - DOI: [10.1016/j.jbiomech.2021.110787](https://doi.org/10.1016/j.jbiomech.2021.110787). Conferido no PubMed em 2026-10-18.
  - População: 17 atletas universitários após reconstrução do ligamento cruzado anterior (0 a 12 meses); agachamento bipodal.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 17 atletas universitários até 12 meses após reconstrução do ligamento cruzado anterior; amostra heterogênea e medida 3D.
  - Trecho literal do resumo: "Medial-lateral hip positions strongly and significantly correlated with VGRF asymmetries and knee moment asymmetries at both assessments (p ≤ 0.018, r ≥ 0.62)."
  - Usada em: `desvio_lateral_pelve`.
- **PMID 38046934**: Steingrebe H, Spancken S, Sell S, Stein T. Effects of hip osteoarthritis on lower body joint kinematics during locomotion tasks: a systematic review and meta-analysis. Front Sports Act Living. 2023;5:1197883.
  - DOI: [10.3389/fspor.2023.1197883](https://doi.org/10.3389/fspor.2023.1197883). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática com metanálise de 35 estudos com osteoartrite de quadril.
  - Qualidade metodológica: alta (decisão: manter com ressalva). Limitação principal: 35 estudos de osteoartrite de quadril comparados com controles, em 3D, com grande heterogeneidade; a maioria dos intervalos de predição dos resultados significativos cruza o zero e só 10 de 68 análises reúnem 5 ou mais estudos.
  - Trecho literal do resumo: "Most group differences were found in ipsi- and contralateral three-dimensional hip and sagittal knee angles with reduced ranges of motion in HOA subjects."
  - Usada em: `assimetria_flexao_joelho_marcha`, `assimetria_amplitude_quadril`.
- **PMID 37853508**: Strong A, Markström JL, Schelin L, Häger CK. Asymmetric loading strategies during squats following anterior cruciate ligament reconstruction: A longitudinal investigation with curve analyses throughout and after rehabilitation. Scand J Med Sci Sports. 34(1):e14524. Epub 2023.
  - DOI: [10.1111/sms.14524](https://doi.org/10.1111/sms.14524). Conferido no PubMed em 2026-10-18.
  - População: 24 pessoas após reconstrução do ligamento cruzado anterior, avaliadas em três momentos, e 29 controles; agachamento bipodal.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 24 pessoas após reconstrução do ligamento cruzado anterior, avaliadas três vezes, e 29 controles; mede momentos e forças, não posição.
  - Trecho literal do resumo: "At Early, 11/24 underloaded their ACLR knee and 1 overloaded compared with controls. At RTS, 4 underloaded and 6 overloaded. No differences in PROMs were found based on loading asymmetry. Beyond the early phase of rehabilitation from ACLR, individual-level analyses are required to reveal differing loading strategies during bilateral squats."
  - Usada em: `desvio_lateral_pelve`.
- **PMID 37181257**: Vermeulen S, De Bleecker C, De Blaiser C, Kilinç ÖO, Willems T, Vanrenterghem J, et al. The Effect of Fatigue on Trunk and Pelvic Jump-Landing Biomechanics in View of Lower Extremity Loading: A Systematic Review. J Hum Kinet. 2023;86:73-95.
  - DOI: [10.5114/jhk/159460](https://doi.org/10.5114/jhk/159460). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática de 21 estudos com adultos fisicamente ativos; aterrissagem de salto.
  - Qualidade metodológica: alta (decisão: manter com ressalva). Limitação principal: 21 estudos de aterrissagem de salto em pessoas ativas, com protocolos de fadiga heterogêneos; nenhum de agachamento nem de séries curtas.
  - Trecho literal do resumo: "The results indicate prevailing evidence for more trunk flexion during standardized jump-landing tasks after lower extremity muscle fatigue."
  - Usada em: `tendencia_na_serie`.
- **PMID 42516619**: Walker ML, Bruce S, Gore CA, Cartwright KE, Tolbert MA. 3D Motion Analysis of Single-leg Squat with Association to Hip Strength and Ankle Dorsiflexion. Int J Exerc Sci. 2026;19(1):1007.
  - DOI: [10.70252/IJES2026107](https://doi.org/10.70252/IJES2026107). Conferido no PubMed em 2026-10-18.
  - População: 72 adultos saudáveis (59,7% mulheres); agachamento unipodal.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 72 adultos jovens saudáveis; correlações baixas entre dorsiflexão e profundidade (explicam 5% e 14% da variância), em testes unicaudais; associação maior só em análise post hoc de quem treina mais.
  - Trecho literal do resumo: "Findings are congruent with previous literature regarding the biomechanical influence from ankle mobility to SLS depth; however, hip strength does not appear to affect SLS depth."
  - Usada em: `variacao_profundidade`.
- **PMID 26816531**: Wyndow N, De Jong A, Rial K, Tucker K, Collins N, Vicenzino B, et al. The relationship of foot and ankle mobility to the frontal plane projection angle in asymptomatic adults. J Foot Ankle Res. 2016;9:3.
  - DOI: [10.1186/s13047-016-0134-9](https://doi.org/10.1186/s13047-016-0134-9). Conferido no PubMed em 2026-10-18.
  - População: 30 adultos assintomáticos de 18 a 50 anos; agachamento unipodal filmado em vídeo.
  - Qualidade metodológica: moderada (decisão: manter com ressalva). Limitação principal: 30 adultos assintomáticos de conveniência em agachamento unipodal controlado; resultado correlacional que os autores não estendem a populações clínicas.
  - Trecho literal do resumo: "Foot and ankle mobility was significantly related to the FPPA during the single leg squat in healthy individuals. Specifically, higher midfoot width mobility, or lower ankle joint dorsiflexion range and midfoot height mobility, were associated with a greater FPPA."
  - Usada em: `valgo_dinamico`.

## Como incluir ou alterar uma fonte

1. Abrir o resumo no PubMed e copiar o trecho exatamente (em inglês), sem reticências nem edição.
2. Registrar PMID, autores, periódico, ano e DOI como aparecem no registro; uma entrada por PMID em `fontes.ts`.
3. **Avaliar a fonte** pelos critérios de `docs/avaliacao-metodologica-fontes.md` e registrar a entrada do PMID em `avaliacaoMetodologica.ts` (desenho, itens, limitações, aplicabilidade, nível, decisão e a limitação principal que o laudo mostra). Fonte com decisão "remover" não entra em `fontes.ts`.
4. Escolher a força pelo tipo do artigo; evidência mista ou contraditória vira ressalva explícita, e população, método e limitação da fonte entram na ressalva.
5. Escrever o fator como hipótese, em linguagem de associação, e rodar `npx vitest run src/test/movimentoBiblioteca.test.ts`.
6. Atualizar este documento e o de avaliação (as tabelas saem dos dados do código).
