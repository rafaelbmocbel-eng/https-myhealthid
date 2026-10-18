# Biblioteca de hipóteses do movimento (Etapa 3)

Curadoria dos **possíveis fatores contribuintes** e dos **itens a conferir** que o laudo da análise de movimento (`montarLaudo`) pode repetir
para cada achado. É apoio à avaliação biomecânica feita pelo profissional de saúde: não é diagnóstico, não prescreve treino e não dá nota.
Especificação do produto: `docs/avaliacao-movimento-v3.md`. Código: `src/lib/angular/movimento/biblioteca/` (os textos e as fontes ficam em
TypeScript, para o laudo e o PDF usarem; este documento é a leitura para quem revisa a curadoria). Teste: `src/test/movimentoBiblioteca.test.ts`.

Informações de artigos recuperadas do PubMed (conferência em 18/10/2026). Cada fonte traz DOI para consulta.

## Como a curadoria foi feita

- **Busca e conferência no PubMed.** Cada fonte foi buscada e aberta pela ferramenta do PubMed; autores, periódico, volume, páginas, ano e DOI vêm
  do registro, não de memória. O ano é o da data de publicação registrada no PubMed, que pode ser a da versão eletrônica; quando é, e o volume impresso é de outro ano, a citação escreve "Epub AAAA" em vez de juntar o ano eletrônico ao volume e ao fascículo.
- **Trecho literal.** O campo `trecho` é cópia, em inglês, de passagem do **resumo** indexado. A cópia foi comparada por programa com o resumo
  recuperado (espaços normalizados): nenhum trecho foi parafraseado nem editado. Nenhum texto completo foi lido; tudo o que está afirmado
  vem de resumos.
- **Linguagem de associação.** Nenhum fator afirma causa. Os textos usam "foi associado a", "pode contribuir" ou atribuem a interpretação aos
  autores. Todo fator tem **ressalva** (população, método, tamanho da amostra, evidência mista ou contraditória). O teste barra verbos causais
  e o vocabulário de julgamento (certo, errado, normal, perfeito, falha).
- **Tipo de estudo** (o rótulo que a tela, o PDF e o laudo imprimem; antes se chamava "Força da evidência", nome que sugeria apoio forte à hipótese) segue o tipo do artigo no PubMed: revisão sistemática, metanálise, estudo observacional ou estudo experimental
  (manipulação controlada de uma condição). Quando o fator tem fontes de tipos diferentes, o rótulo é o da fonte de maior delineamento que o
  sustenta; fontes que o contradizem ou o deixam inconclusivo entram na ressalva, que diz quando a evidência é mista. Revisão narrativa não conta como revisão sistemática. Sem artigo que sustente, o fator é
  **a confirmar**, com fontes vazias, e a interface escreve "sem referência verificada".
- **População.** Cada fonte registra quem foi estudado (atletas, idosos, pacientes com dor, AVC, osteoartrite) para ninguém extrapolar.
- **Medida diferente do vídeo.** A maioria das fontes usa captura 3D, plataformas de força ou exame clínico (algumas usam vídeo 2D) e compara grupos ou condições. Nenhuma
  validou a medida deste vídeo, e poucas estudaram a diferença entre os lados: as ressalvas dizem quando a ligação com o achado é uma inferência.
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
| `inclinacao_tronco` | 2 | 2 | 0 | 2 de 4 |
| `avanco_joelho` | 2 | 2 | 0 | 2 de 4 |
| `variacao_profundidade` | 3 | 2 | 1 | 1 de 3 |
| `tendencia_na_serie` | 2 | 1 | 1 | 0 de 3 |
| `assimetria_tempo_apoio` | 4 | 3 | 1 | 2 de 4 |
| `assimetria_flexao_joelho_marcha` | 4 | 4 | 0 | 2 de 4 |
| `assimetria_amplitude_quadril` | 3 | 3 | 0 | 2 de 4 |
| `inclinacao_tronco_marcha` | 4 | 4 | 0 | 3 de 4 |

Total: 39 fatores (36 com fonte e 3 a confirmar) e 47 itens a conferir (25 com fonte e 22 marcados como sem referência verificada). Fontes distintas: 51. Todas as 13 chaves do catálogo têm entrada; nenhuma ficou sem fator com fonte.

## Fatores e itens a conferir por chave

### `assimetria_flexao_joelho`

Diferença entre os lados na flexão máxima do joelho (agachamento).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Menor mobilidade de dorsiflexão do tornozelo foi associada a menor flexão do joelho no agachamento; se a limitação for diferente entre os lados, pode contribuir para a diferença medida.
   - Tipo de estudo: estudo experimental.
   - Ressalva: O estudo experimental (30 adultos saudáveis) simulou a limitação com uma cunha sob o antepé, e o estudo transversal comparou pessoas com e sem limitação; nenhum testou uma diferença de dorsiflexão entre os lados. A associação não estabelece causalidade e não confirma o fator em uma pessoa.
   - Fontes: PMID 22100617 (Macrum 2011); PMID 25144599 (Dill 2014).
2. Déficit de força do quadríceps e antecedente de lesão ou reconstrução do ligamento cruzado anterior foram associados a assimetria entre os membros no agachamento e podem contribuir para a diferença entre os lados.
   - Tipo de estudo: estudo observacional.
   - Ressalva: População específica: pessoas após lesão ou reconstrução do ligamento cruzado anterior. A assimetria descrita é de momentos articulares e de distribuição de carga, medidos em laboratório, e não necessariamente de ângulo de flexão; as amostras são pequenas e os estudos são observacionais. Não se aplica sem esse antecedente.
   - Fontes: PMID 37441507 (Ishida 2023); PMID 24581172 (Roos 2014).
3. Preferência de apoio ou dominância de um dos membros pode contribuir para diferenças entre os lados mesmo sem lesão.
   - Tipo de estudo: estudo observacional.
   - Ressalva: Estudo com 18 adultos saudáveis; a diferença descrita é de força de reação do solo e de centro de pressão, e não de ângulo do joelho. É um único estudo: serve como lembrete de que alguma diferença entre os lados pode existir sem condição clínica.
   - Fontes: PMID 36237648 (Hannan 2022).

**O que conferir na avaliação presencial**

- Medir a dorsiflexão do tornozelo em carga (teste de avanço em carga) nos dois lados: no estudo citado, a medida em carga, e não a passiva sem carga, se associou à flexão do joelho no agachamento. (fonte: PMID 25144599, Dill 2014)
- Perguntar sobre lesão ou cirurgia no joelho, em especial do ligamento cruzado anterior, e sobre dor ou instabilidade de cada lado. (fonte: PMID 37441507, Ishida 2023)
- Comparar a força de extensão do joelho entre os lados (por exemplo, com dinamometria) e confirmar no exame presencial. (sem referência verificada; sugestão ao profissional)
- Rever os quadros de maior flexão: de lado, o membro mais distante da câmera pode ter sido detectado com menos precisão. (sem referência verificada; sugestão ao profissional)

### `assimetria_flexao_quadril`

Diferença entre os lados na flexão máxima do quadril (agachamento).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Menor mobilidade de dorsiflexão do tornozelo (e, em homens, de flexão do quadril) foi associada a agachamentos menos profundos, e a dorsiflexão do lado direito predisse o ângulo de flexão do quadril direito, único lado citado no resumo; diferenças dessas mobilidades entre os lados podem contribuir para a diferença medida.
   - Tipo de estudo: estudo observacional.
   - Ressalva: Kim e colaboradores estudaram 101 adultos saudáveis e relacionaram mobilidade com profundidade, e não com assimetria; a associação variou com o sexo. O estudo de Endo e colaboradores tem 9 homens, usa vídeo bidimensional e também mostra que o movimento de um lado se associa ao do lado oposto, então a diferença medida pode refletir compensação e não restrição local.
   - Fontes: PMID 25964810 (Kim 2015); PMID 32581431 (Endo 2020).
2. Dor ou alteração estrutural do quadril, como o impacto femoroacetabular, pode estar relacionada a diferenças no agachamento (profundidade, joelho e tornozelo), mas a evidência de que mude o ângulo de flexão do quadril é inconclusiva.
   - Tipo de estudo: estudo observacional.
   - Ressalva: Evidência inconclusiva: na revisão com metanálise não houve diferença significativa nos parâmetros cinemáticos depois da cirurgia, e os autores sugerem que deformidades ósseas isoladas não explicam as limitações observadas no agachamento. No estudo de 10 pacientes, a cinemática do quadril afetado também não mudou após a cirurgia, embora o joelho e o tornozelo tenham flexionado mais. Serve apenas como lembrete de investigar o quadril.
   - Fontes: PMID 21543687 (Lamontagne 2011); PMID 40391865 (Generoso 2025).

**O que conferir na avaliação presencial**

- Medir a flexão passiva e as rotações do quadril de cada lado (goniometria), além da dorsiflexão em carga. (fonte: PMID 25964810, Kim 2015)
- Perguntar sobre dor na região da virilha ou do quadril e sobre cirurgia prévia no quadril. (sem referência verificada; sugestão ao profissional)
- Rever os quadros: a inclinação do tronco e a rotação da pelve mudam o ângulo do quadril projetado no plano da imagem. (sem referência verificada; sugestão ao profissional)

### `assimetria_dorsiflexao`

Diferença entre os lados na dorsiflexão máxima do tornozelo (agachamento).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Instabilidade crônica do tornozelo e dor patelofemoral foram associadas a menor dorsiflexão do tornozelo e a assimetria entre os membros; antecedente desse tipo pode contribuir para a diferença medida.
   - Tipo de estudo: estudo observacional.
   - Ressalva: Estudos transversais em atletas de basquete mulheres (instabilidade de tornozelo e dor patelofemoral) e em adultos com dor patelofemoral; a dorsiflexão foi medida em testes clínicos e não em vídeo. A associação não indica direção: a menor dorsiflexão pode acompanhar a condição em vez de antecedê-la. No estudo de Emamvirdi a dorsiflexão foi menor nos dois lados, não só no lado afetado.
   - Fontes: PMID 37524846 (Emamvirdi 2023); PMID 35989174 (Hassan 2022).
2. A rigidez do tendão do calcâneo foi associada ao ângulo de dorsiflexão no ponto mais baixo do agachamento e pode contribuir para a diferença entre os lados.
   - Tipo de estudo: estudo observacional.
   - Ressalva: Evidência mista: Miyasaka (31 homens jovens saudáveis) encontrou associação, enquanto Gomes (20 adultos saudáveis) viu a dorsiflexão no teste de avanço se associar à rigidez do tendão, mas não viu influência evidente das propriedades mecânicas do tendão do calcâneo sobre a profundidade do agachamento. Ambos medem a rigidez por ultrassom, o que não é possível em vídeo, e nenhum compara os lados.
   - Fontes: PMID 37374309 (Miyasaka 2023); PMID 32022631 (Gomes 2020).
3. Elevar o calcanhar (calçado com salto, calço ou palmilha) reduziu a dorsiflexão máxima medida no agachamento; calçado ou apoio diferentes entre os lados no vídeo podem contribuir para a diferença.
   - Tipo de estudo: estudo experimental.
   - Ressalva: 30 homens saudáveis com dorsiflexão restrita, agachamento com carga e análise tridimensional; a elevação era igual nos dois pés. O estudo não testou diferença de apoio entre os lados.
   - Fontes: PMID 42551866 (Cai 2026).

**O que conferir na avaliação presencial**

- Medir a dorsiflexão em carga (teste de avanço em carga) em cada lado: a medida passiva sem carga teve menos relação com a cinemática do agachamento. (fonte: PMID 25144599, Dill 2014)
- Perguntar sobre entorse prévia, instabilidade do tornozelo e dor patelofemoral. (fonte: PMID 37524846, Emamvirdi 2023)
- Conferir se o calçado, a posição e a abertura dos pés eram iguais nos dois lados. (sem referência verificada; sugestão ao profissional)

### `valgo_dinamico`

Valgo dinâmico do joelho na descida (agachamento de frente).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Menor dorsiflexão do tornozelo e diferenças na mobilidade do pé (do médio-pé e do tálus) foram associadas a maior valgo (deslocamento medial) do joelho no agachamento e podem contribuir para o valgo medido.
   - Tipo de estudo: estudo experimental.
   - Ressalva: Resultados não unânimes: em adultos com e sem dor patelofemoral, a dorsiflexão medida com o joelho flexionado não se correlacionou com o ângulo de projeção frontal (Hassan). Os estudos são de agachamento unipodal ou bipodal em adultos ativos ou assintomáticos (Macrum, Mauntel, Wyndow) e de teste de descida de degrau em 70 pessoas com dor patelofemoral e 70 assintomáticas (Hassan); o estudo experimental (Macrum) simulou a limitação com uma cunha sob o antepé. A associação não estabelece causalidade.
   - Fontes: PMID 22100617 (Macrum 2011); PMID 23096063 (Mauntel 2013); PMID 26816531 (Wyndow 2016); PMID 35989174 (Hassan 2022).
2. A fraqueza dos abdutores e dos rotadores externos do quadril é uma hipótese frequente para o valgo, mas as revisões sistemáticas não a sustentam de forma consistente.
   - Tipo de estudo: revisão sistemática.
   - Ressalva: Evidência conflitante em adultos assintomáticos: a revisão de 2012 encontrou pouca evidência a favor e nenhuma conclusão definitiva; a de 2021 descreve a relação como conflitante; a mais recente, com metanálise parcial de 22 artigos, não obteve significância em nenhuma metanálise e conclui que a fraqueza pode não estar associada a maior valgo dinâmico. Uma coativação menor entre glúteos e adutores apareceu em um estudo de 40 pessoas (Mauntel); a coativação não foi avaliada nas revisões, que trataram de força. Não use a força do quadril como explicação por padrão.
   - Fontes: PMID 22894982 (Cashman 2012); PMID 34300118 (Alzahrani 2021); PMID 42476040 (Cashman 2026); PMID 23096063 (Mauntel 2013).
3. Instabilidade crônica do tornozelo e dor patelofemoral foram associadas a maior ângulo de valgo dinâmico; antecedente desse tipo pode contribuir para o valgo medido.
   - Tipo de estudo: estudo observacional.
   - Ressalva: 60 atletas de basquete mulheres; agachamento unipodal, medido nos dois lados. Estudo transversal: não mostra se o valgo antecede a dor ou a acompanha. Não vale para quem não tem esse antecedente.
   - Fontes: PMID 37524846 (Emamvirdi 2023).
4. O ângulo 2D de projeção do joelho concordou mal com o ângulo 3D no agachamento unipodal em uma revisão com metanálise; a medida 2D deste vídeo deve ser lida como observação.
   - Tipo de estudo: meta-análise.
   - Ressalva: Revisão com metanálise de 16 estudos: a confiabilidade da análise 2D variou de moderada a excelente, mas a concordância com a medida 3D foi fraca no agachamento unipodal (r = 0,127) e melhor na aterrissagem. Os autores concluem que a evidência atual não sustenta o uso da análise 2D quando se exige medida exata. O resumo não indica a causa da divergência, e o resultado é do agachamento unipodal, não do bipodal medido neste app: use o valgo deste vídeo como observação e não como medida exata.
   - Fontes: PMID 29895235 (Lopes 2018).

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
   - Ressalva: População específica: atletas de 0 a 12 meses após reconstrução do ligamento cruzado anterior (Song), homens que voltaram ao esporte (Webster) e adultos com lesão ou reconstrução (Roos), com plataformas de força e análise tridimensional. Correlação não indica que o deslocamento seja a origem da assimetria, e não há dado nestas fontes para pessoas sem esse antecedente. Webster também observou que a carga ficou mais simétrica depois de fadiga.
   - Fontes: PMID 34628200 (Song 2021); PMID 24934927 (Webster 2014); PMID 24581172 (Roos 2014).
2. Déficit de força do quadríceps de um dos lados foi associado a menor momento extensor do joelho nesse lado no agachamento, o que pode contribuir para um apoio mais carregado no lado oposto.
   - Tipo de estudo: estudo observacional.
   - Ressalva: 26 pessoas com mais de 1 ano após reconstrução do ligamento cruzado anterior. O estudo mediu momentos articulares com análise tridimensional e não o deslocamento da pelve: a ligação com o deslocamento lateral é uma inferência.
   - Fontes: PMID 37441507 (Ishida 2023).
3. Preferência de apoio ou dominância de um dos membros pode contribuir para um apoio desigual mesmo sem lesão.
   - Tipo de estudo: estudo observacional.
   - Ressalva: Estudo com 18 adultos saudáveis; a diferença descrita é de força de reação do solo e de centro de pressão. É um único estudo e não mediu o deslocamento da pelve.
   - Fontes: PMID 36237648 (Hannan 2022).

**O que conferir na avaliação presencial**

- Perguntar sobre cirurgia ou lesão em joelho, quadril ou tornozelo e sobre dor unilateral. (fonte: PMID 24934927, Webster 2014)
- Quando houver duas balanças ou uma plataforma de força, comparar a descarga de peso entre os lados no ponto mais baixo. (fonte: PMID 34628200, Song 2021)
- Conferir se os pés estavam na mesma posição e se o peso estava distribuído por igual no início de cada repetição. (sem referência verificada; sugestão ao profissional)

### `inclinacao_tronco`

Inclinação do tronco no ponto mais baixo (agachamento).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Menor dorsiflexão do tornozelo foi associada a maior flexão do tronco no agachamento, e elevar o calcanhar de quem tem dorsiflexão restrita reduziu a inclinação do tronco para a frente; a limitação de dorsiflexão pode contribuir para a inclinação medida.
   - Tipo de estudo: estudo experimental.
   - Ressalva: Cai: 30 homens saudáveis com dorsiflexão restrita, agachamento com carga. Da Costa: 30 adultos, agachamento unipodal; a associação foi com a dorsiflexão dinâmica e não com a passiva. Honda: idosos agacharam com menor dorsiflexão e maior flexão do tronco do que adultos jovens, mas os grupos diferem também em idade. Não é possível separar a dorsiflexão de outros fatores em uma pessoa.
   - Fontes: PMID 42551866 (Cai 2026); PMID 33713896 (da 2021); PMID 35193063 (Honda 2022).
2. Quando o avanço dos joelhos foi restringido durante o agachamento, houve mais inclinação do tronco e da perna para a frente; manter os joelhos atrás dos pés, por instrução ou por estratégia, pode contribuir para a inclinação medida.
   - Tipo de estudo: estudo experimental.
   - Ressalva: 7 homens treinados, agachamento com barra com carga igual ao peso corporal, filmado em vídeo: amostra pequena e população de pessoas treinadas.
   - Fontes: PMID 14636100 (Fry 2003).

**O que conferir na avaliação presencial**

- Medir a dorsiflexão passiva em carga nos dois lados e compará-la com a dorsiflexão alcançada no agachamento. (fonte: PMID 33713896, da 2021)
- No exame presencial, observar se a inclinação do tronco muda quando se eleva o calcanhar; se mudar, a dorsiflexão passa a ser um candidato. (fonte: PMID 42551866, Cai 2026)
- Comparar o comprimento do fêmur com o do tronco da pessoa. (sem referência verificada; sugestão ao profissional)
- Observar a curvatura da coluna no exame presencial: o vídeo mede a reta quadril–ombro e não a curvatura lombar. (sem referência verificada; sugestão ao profissional)

### `avanco_joelho`

Avanço do joelho em relação à ponta do pé (observação medida). Critério debatido na literatura: desligado por padrão, sem valor presumido.

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Elevar o calcanhar aumentou o avanço da tíbia e a flexão do joelho no agachamento de homens com dorsiflexão restrita; a mobilidade de dorsiflexão e o apoio do calcanhar podem contribuir para o avanço medido.
   - Tipo de estudo: estudo experimental.
   - Ressalva: 30 homens saudáveis com dorsiflexão restrita, agachamento com carga e análise tridimensional. O estudo mediu a progressão da tíbia e não a posição do joelho em relação à ponta do pé, e não define limite nem critério.
   - Fontes: PMID 42551866 (Cai 2026).
2. A forma de executar o agachamento, em especial a instrução de manter os joelhos atrás da ponta dos pés, alterou o avanço e a distribuição do esforço entre joelho, quadril e tronco; a técnica usada pode contribuir para o avanço observado.
   - Tipo de estudo: estudo experimental.
   - Ressalva: O efeito do avanço do joelho é debatido e não há limite definido. Kernozek (25 mulheres saudáveis, estimativa por modelo) calculou maior estresse patelofemoral quando os joelhos passam dos pés; Fry (7 homens treinados) e List (30 pessoas) descreveram mais inclinação do tronco e mais movimento da coluna torácica quando o avanço é restringido. A restrição, portanto, redistribui o esforço. Por isso o avanço é só observação medida, sem critério ativado.
   - Fontes: PMID 14636100 (Fry 2003); PMID 22990570 (List 2013); PMID 28422563 (Kernozek 2018).

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
   - Ressalva: As fontes relacionam a profundidade com a mobilidade (101 adultos em Kim; 20 em Gomes, com vídeo bidimensional; 72 em Walker, com correlação baixa); nenhuma estudou a variação da profundidade entre repetições, então a ligação com a variação é uma inferência. Walker não encontrou associação da força dos abdutores do quadril com a profundidade.
   - Fontes: PMID 32022631 (Gomes 2020); PMID 25964810 (Kim 2015); PMID 42516619 (Walker 2026).
2. Elevar o calcanhar aumentou a flexão do joelho e do quadril no agachamento de homens com dorsiflexão restrita; mudanças de calçado ou de apoio entre as repetições podem contribuir para a variação da profundidade.
   - Tipo de estudo: estudo experimental.
   - Ressalva: Um estudo com 30 homens saudáveis; o apoio era igual em cada condição, e a variação entre repetições não foi o desfecho.
   - Fontes: PMID 42551866 (Cai 2026).
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

1. Fadiga muscular ao longo das repetições pode contribuir para a mudança de uma medida da primeira para a última repetição, mas a evidência é inconsistente.
   - Tipo de estudo: revisão sistemática.
   - Ressalva: Evidência inconsistente: a revisão de 37 estudos (806 atletas saudáveis) não encontrou consistência quanto aos efeitos da fadiga nos ângulos do quadril, do joelho e do tornozelo; a de 21 estudos descreve predomínio de mais flexão do tronco na aterrissagem depois de fadiga dos membros inferiores. A maior parte dos estudos usa saltos e protocolos de fadiga intensos, bem diferentes de poucas repetições de agachamento; no agachamento, Webster (10 homens após reconstrução do ligamento cruzado anterior) viu a carga ficar mais simétrica com a fadiga. Não há dado nestas fontes para uma série curta.
   - Fontes: PMID 28298066 (Barber-Westin 2017); PMID 37181257 (Vermeulen 2023); PMID 24934927 (Webster 2014).
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

1. Dor ou doença articular unilateral, como a osteoartrite de quadril ou a dor no joelho, foi associada a assimetria temporal na marcha (na osteoartrite de quadril, com apoio mais curto no membro afetado); condição desse tipo pode contribuir para a diferença no tempo de apoio.
   - Tipo de estudo: meta-análise.
   - Ressalva: A metanálise (30 artigos) trata de osteoartrite de quadril; Lugade (23 pacientes antes de artroplastia) e Murray (35 homens com dor unilateral no joelho, estudo de 1985) são observacionais. Evidência mista: em pessoas com dor unilateral no joelho de uma coorte, a gravidade da dor não se associou à assimetria temporal (Corrigan). Não se aplica a quem não tem queixa articular.
   - Fontes: PMID 24450373 (Constantinou 2014); PMID 20542608 (Lugade 2010); PMID 4042479 (Murray 1985); PMID 36305013 (Corrigan 2023).
2. Diferença de comprimento entre os membros inferiores foi associada a desvios e assimetrias da marcha e pode contribuir para a diferença entre os lados.
   - Tipo de estudo: revisão sistemática.
   - Ressalva: A revisão (12 estudos) inclui diferença anatômica e diferença simulada com elevações em pessoas saudáveis, sem desfecho específico para este achado. Seeley (26 adultos sem doença) relacionou a diferença leve de comprimento à simetria de momentos e potências do joelho e do tornozelo, e não de ângulos ou tempos. Os autores lembram que outros fatores também contribuem para assimetrias em pessoas sem doença.
   - Fontes: PMID 28600975 (Khamis 2017); PMID 24149783 (Seeley 2010).
3. Em pessoas com AVC, a assimetria temporal da marcha foi interpretada como possível estratégia de compensação do controle de equilíbrio do lado mais afetado.
   - Tipo de estudo: estudo observacional.
   - Ressalva: 31 pessoas com AVC subagudo; a assimetria foi medida no tempo de balanço e não no de apoio, e a interpretação é dos autores, que a descrevem como possível e apenas parcial. Não extrapole para pessoas sem doença neurológica.
   - Fontes: PMID 42107174 (Staines 2026).
4. A variação da velocidade entre as passadas e o erro na marcação dos eventos de contato e de saída do pé podem contribuir para uma diferença no tempo de apoio.
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

1. Menor força dos flexores plantares e menor velocidade da flexão plantar na saída do pé foram associadas a menor pico de flexão do joelho no balanço e podem contribuir para a diferença entre os lados.
   - Tipo de estudo: estudo experimental.
   - Ressalva: Apti: 20 adultos jovens saudáveis, com redução experimental da força dos flexores plantares por alongamento passivo e análise tridimensional (o título e o resumo usam linguagem causal; aqui é lido como associação). Fujita: 38 pessoas com AVC crônico, com associação entre a velocidade da flexão plantar na saída do pé e o ângulo de flexão do joelho no balanço. Nenhum compara os lados.
   - Fontes: PMID 27131202 (Apti 2016); PMID 36166956 (Fujita 2022).
2. Após AVC, alterações neuromotoras (atividade dos extensores do joelho, tônus, incoordenação e propulsão reduzida) são discutidas como mecanismos da menor flexão do joelho no balanço.
   - Tipo de estudo: estudo observacional.
   - Ressalva: População específica (AVC). Krajewski é uma revisão narrativa que discute esses mecanismos e conclui que ainda falta uma definição comum e mais estudos; Fujita é um estudo transversal. Não extrapole para pessoas sem doença neurológica.
   - Fontes: PMID 36166956 (Fujita 2022); PMID 39815400 (Krajewski 2025).
3. Osteoartrite de quadril e de joelho foi associada a menor amplitude de movimento do joelho e a menor flexão do joelho mais doloroso na marcha; condição desse tipo pode contribuir para a diferença entre os lados.
   - Tipo de estudo: meta-análise.
   - Ressalva: A metanálise (35 estudos) é de osteoartrite de quadril e descreve amplitudes reduzidas nos ângulos do quadril e sagital do joelho, com grande heterogeneidade entre os estudos; Creaby (91 pessoas com osteoartrite de joelho) descreve menor flexão no joelho mais doloroso. Os resumos não especificam que o pico seja o do balanço: a direção é a mesma, mas não é necessariamente a mesma medida.
   - Fontes: PMID 38046934 (Steingrebe 2023); PMID 22385873 (Creaby 2012).
4. Diferença de comprimento entre os membros inferiores foi associada a desvios e assimetrias da marcha e pode contribuir para a diferença entre os lados.
   - Tipo de estudo: revisão sistemática.
   - Ressalva: A revisão (12 estudos) inclui diferença anatômica e diferença simulada com elevações em pessoas saudáveis, sem desfecho específico para este achado. Seeley (26 adultos sem doença) relacionou a diferença leve de comprimento à simetria de momentos e potências do joelho e do tornozelo, e não de ângulos ou tempos. Os autores lembram que outros fatores também contribuem para assimetrias em pessoas sem doença.
   - Fontes: PMID 28600975 (Khamis 2017); PMID 24149783 (Seeley 2010).

**O que conferir na avaliação presencial**

- Testar a força dos flexores plantares de cada lado (por exemplo, com dinamometria) e a mobilidade do tornozelo. (fonte: PMID 27131202, Apti 2016)
- Perguntar sobre dor, derrame ou cirurgia no joelho e sobre entorses. (sem referência verificada; sugestão ao profissional)
- Medir o comprimento dos membros inferiores nos dois lados. (fonte: PMID 28600975, Khamis 2017)
- Conferir se o membro mais distante da câmera foi detectado corretamente na fase de balanço. (sem referência verificada; sugestão ao profissional)

### `assimetria_amplitude_quadril`

Diferença entre os lados na amplitude do quadril (marcha).

**Possíveis fatores contribuintes (hipóteses para o profissional confirmar)**

1. Osteoartrite e restrição de mobilidade do quadril foram associadas a menor amplitude de movimento do quadril na marcha, e a extensão passiva do quadril se relacionou com a extensão alcançada na marcha; condição desse tipo pode contribuir para a diferença entre os lados.
   - Tipo de estudo: meta-análise.
   - Ressalva: População com osteoartrite de quadril (moderada e grave em Baker); entre pessoas assintomáticas não houve correlação entre a extensão passiva e a extensão na marcha (r = 0,139 no estudo). Os estudos usam análise tridimensional; neste vídeo o ângulo do quadril (ombro–quadril–joelho) inclui o movimento do tronco e da pelve, então a amplitude medida não é a articular pura.
   - Fontes: PMID 38046934 (Steingrebe 2023); PMID 26895694 (Baker 2016).
2. A menor extensão do quadril na marcha de idosos foi interpretada pelos autores como possível restrição de mobilidade do quadril; no único estudo citado sobre alongamento dos flexores (20 pessoas, corrida submáxima) o alongamento não mudou a cinemática.
   - Tipo de estudo: estudo observacional.
   - Ressalva: Kerrigan: 23 idosos saudáveis e 16 idosos com quedas, comparados com 30 adultos jovens (diferença entre grupos e não entre lados); a interpretação de restrição é dos autores. Mettler: em 20 pessoas com extensão passiva limitada, 3 semanas de alongamento dos flexores do quadril aumentaram a extensão passiva sem mudar a cinemática da corrida submáxima. É uma hipótese a confirmar no exame.
   - Fontes: PMID 11239282 (Kerrigan 2001); PMID 29927892 (Mettler 2019).
3. Diferença de comprimento entre os membros inferiores foi associada a desvios e assimetrias da marcha e pode contribuir para a diferença entre os lados.
   - Tipo de estudo: revisão sistemática.
   - Ressalva: A revisão (12 estudos) inclui diferença anatômica e diferença simulada com elevações em pessoas saudáveis, sem desfecho específico para este achado. Seeley (26 adultos sem doença) relacionou a diferença leve de comprimento à simetria de momentos e potências do joelho e do tornozelo, e não de ângulos ou tempos. Os autores lembram que outros fatores também contribuem para assimetrias em pessoas sem doença.
   - Fontes: PMID 28600975 (Khamis 2017); PMID 24149783 (Seeley 2010).

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
   - Ressalva: 10 mulheres saudáveis (média de 62 anos) com órtese que simulou a contratura; a contratura menor não mudou o tronco e só a maior mudou. Contratura simulada não equivale a uma condição clínica real.
   - Fontes: PMID 18585042 (Harato 2008).
2. Um estudo encontrou mais flexão do tronco na marcha de pessoas com osteoartrite de joelho e outro, menos inclinação anterior do tronco depois da artroplastia total do joelho; a metanálise não viu aumento claro no plano sagital. Condição desse tipo pode contribuir para a inclinação medida.
   - Tipo de estudo: estudo observacional.
   - Ressalva: Evidência mista: a metanálise de 32 artigos (Iijima) viu aumento claro da inclinação lateral do tronco e aumento não significativo da flexão do tronco e da pelve; Preece relata aumento médio de 2,6° na flexão do tronco; Tsutsumi (24 pacientes) avaliou os mesmos pacientes antes e depois da cirurgia. A diferença média é pequena e pode ficar dentro da incerteza do vídeo.
   - Fontes: PMID 31254772 (Preece 2019); PMID 42804966 (Tsutsumi 2026); PMID 30904334 (Iijima 2019).
3. Após fratura de acetábulo, pacientes caminharam com maior inclinação anterior do tronco do que pessoas sem a lesão; condição do quadril pode contribuir para a inclinação medida.
   - Tipo de estudo: estudo observacional.
   - Ressalva: Série de 15 pacientes comparados com grupos sem lesão; foi a única diferença na posição dos segmentos. Amostra pequena e população específica.
   - Fontes: PMID 11818800 (Borrelli 2002).
4. Caminhar em subida aumentou a inclinação anterior do tronco e da pelve; piso ou esteira com inclinação durante a gravação pode contribuir para a inclinação medida.
   - Tipo de estudo: estudo experimental.
   - Ressalva: 8 adultos saudáveis em esteira com 0, 5 e 10% de inclinação; na descida houve inclinação para trás. Mostra o efeito do terreno e vale como lembrete de conferir o nivelamento do local de gravação.
   - Fontes: PMID 11809582 (Leroux 2002).

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

Lacunas da busca e pontos de evidência fraca ou mista, para o time científico decidir:

- **Proporção entre fêmur e tronco** (`inclinacao_tronco`): as buscas feitas no PubMed não encontraram artigo que a sustentasse com o que o resumo diz; ficou só como item a conferir.
- **Referência de profundidade e ritmo** (`variacao_profundidade`), **familiarização e ritmo** (`tendencia_na_serie`) e **velocidade e erro de eventos**
  (`assimetria_tempo_apoio`): decorrem da forma de coletar o vídeo e da incerteza do método. Sem artigo verificado.
- **Força do quadril e valgo** (`valgo_dinamico`): três revisões sistemáticas, de 2012, 2021 e 2026, não sustentam a relação de forma consistente.
  A biblioteca registra o fator justamente para dizer que a evidência é conflitante.
- **Impacto femoroacetabular e flexão do quadril** (`assimetria_flexao_quadril`): revisão com metanálise sem diferença significativa na cinemática; o fator
  é inconclusivo.
- **Tempo de apoio e dor no joelho** (`assimetria_tempo_apoio`): em uma coorte, a gravidade da dor não se associou à assimetria temporal.
- **Tronco na marcha com osteoartrite de joelho** (`inclinacao_tronco_marcha`): a metanálise não viu aumento claro da flexão do tronco no plano sagital;
  estudos isolados viram diferença pequena, que pode ficar dentro da incerteza do vídeo.
- **Fadiga** (`tendencia_na_serie`): revisões sistemáticas inconsistentes, quase só de saltos e aterrissagens; sem dado para séries curtas de agachamento.
- **Flexão do joelho no balanço** (`assimetria_flexao_joelho_marcha`): as melhores fontes são de AVC (população específica) e de redução experimental da força
  dos flexores plantares em adultos jovens; as de osteoartrite não especificam a fase do pico de flexão.
- **Populações com doença** (AVC, osteoartrite, reconstrução do ligamento cruzado anterior): várias fontes só valem para quem tem a condição, e as ressalvas dizem isso.
- **Diferença entre os lados**: a maior parte das fontes compara grupos ou condições; nenhuma testou diretamente quanto de diferença entre os lados, em graus,
  indica alguma condição. Por isso a biblioteca não propõe valores.
- **Ferramenta.** A ferramenta do PubMed respondeu com limite de taxa em alguns pedidos; todos foram repetidos e concluídos. Nenhuma chave ficou sem verificação
  por falha da ferramenta.

## Fontes

Lista por PMID, com o trecho literal que o laudo exibe. O mesmo PMID tem sempre os mesmos dados em todas as chaves.

- **PMID 34300118**: Alzahrani AM, Alzhrani M, Alshahrani SN, Alghamdi W, Alqahtani M, Alzahrani H. Is Hip Muscle Strength Associated with Dynamic Knee Valgus in a Healthy Adult Population? A Systematic Review. Int J Environ Res Public Health. 2021;18(14).
  - DOI: [10.3390/ijerph18147669](https://doi.org/10.3390/ijerph18147669). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática de 7 estudos com adultos saudáveis e análise de movimento bidimensional.
  - Trecho literal do resumo: "The relationship between hip muscle strength, including abductors, extensors, and external rotators and DKV is conflicting."
  - Usada em: `valgo_dinamico`.
- **PMID 27131202**: Apti A, Akalan NE, Kuchimov S, Özdinçler AR, Temelli Y, Nene A. Plantar flexor muscle weakness may cause stiff-knee gait. Gait Posture. 2016;46:201-7.
  - DOI: [10.1016/j.gaitpost.2016.03.010](https://doi.org/10.1016/j.gaitpost.2016.03.010). Conferido no PubMed em 2026-10-18.
  - População: 20 adultos jovens saudáveis (e 7 controles); fraqueza experimental dos flexores plantares.
  - Trecho literal do resumo: "After PS, the reduction of plantar flexor muscle strength (33.14%) caused knee flexion velocity drop at toe-off (p=0.008) and developed SKG pattern by decreasing peak knee flexion (p=0.0001), range of knee flexion in early swing (p=0.006), and total knee flexion range (p=0.002)."
  - Usada em: `assimetria_flexao_joelho_marcha`.
- **PMID 26895694**: Baker M, Moreside J, Wong I, Rutherford DJ. Passive hip movement measurements related to dynamic motion during gait in hip osteoarthritis. J Orthop Res. 2016;34(10):1790-1797.
  - DOI: [10.1002/jor.23198](https://doi.org/10.1002/jor.23198). Conferido no PubMed em 2026-10-18.
  - População: Pessoas com osteoartrite de quadril moderada e grave e grupo assintomático; marcha em esteira.
  - Trecho literal do resumo: "Significant correlations between dynamic and passive hip extension were found in the moderate (r = 0.596) and severe OA (r = 0.586) groups, and no correlation was found in the asymptomatic group (r = 0.139). Passive ROM explains variance in dynamic ROM measurements obtained during gait in individuals with moderate and severe hip OA which have implications for the design of treatment strategies targeting walking pathomechanics."
  - Usada em: `assimetria_amplitude_quadril`.
- **PMID 28298066**: Barber-Westin SD, Noyes FR. Effect of Fatigue Protocols on Lower Limb Neuromuscular Function and Implications for Anterior Cruciate Ligament Injury Prevention Training: A Systematic Review. Am J Sports Med. 2017;45(14):3388-3396.
  - DOI: [10.1177/0363546517693846](https://doi.org/10.1177/0363546517693846). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática de 37 estudos com 806 atletas saudáveis; tarefas de salto, aterrissagem e mudança de direção.
  - Trecho literal do resumo: "There was no consistency among investigations regarding the effects of fatigue on hip, knee, or ankle joint angles and moments or surface electromyography muscle activation patterns."
  - Usada em: `tendencia_na_serie`.
- **PMID 11818800**: Borrelli J, Goldfarb C, Ricci W, Wagner JM, Engsberg JR. Functional outcome after isolated acetabular fractures. J Orthop Trauma. 2002;16(2):73-81.
  - DOI: [10.1097/00005131-200202000-00001](https://doi.org/10.1097/00005131-200202000-00001). Conferido no PubMed em 2026-10-18.
  - População: 15 pacientes com fratura isolada de acetábulo tratada cirurgicamente.
  - Trecho literal do resumo: "When the study patients were compared with able-bodied cohorts, the patients tended to walk with greater forward inclination of their trunks; this was true for all phases of gait."
  - Usada em: `inclinacao_tronco_marcha`.
- **PMID 42551866**: Cai J, Sun D, Li F, Chen D, Zhu J, Song Y, et al. Dose-Dependent Effects of Heel Elevation on Kinetic Chain Reconstruction and Lumbar Stress During Loaded Squatting in Men With Restricted Ankle Dorsiflexion. J Strength Cond Res. 2026.
  - DOI: [10.1519/JSC.0000000000005639](https://doi.org/10.1519/JSC.0000000000005639). Conferido no PubMed em 2026-10-18.
  - População: 30 homens saudáveis com dorsiflexão do tornozelo restrita; agachamento com carga e elevação progressiva do calcanhar.
  - Trecho literal do resumo: "Increasing heel elevation reduced peak ankle dorsiflexion and trunk forward inclination, while increasing peak knee flexion, hip flexion, and tibial progression angle (all p < 0.001)."
  - Usada em: `assimetria_dorsiflexao`, `inclinacao_tronco`, `avanco_joelho`, `variacao_profundidade`.
- **PMID 42476040**: Cashman G, White C, Stephens R, Hoggs-Johnson S, Kissel J. The effect of hip abductor or external rotator strength on dynamic knee valgus in healthy subjects-a systematic review with partial meta-analysis. Knee. 2026;62:104565.
  - DOI: [10.1016/j.knee.2026.104565](https://doi.org/10.1016/j.knee.2026.104565). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática com metanálise parcial de 22 artigos com indivíduos assintomáticos.
  - Trecho literal do resumo: "Weakness in hip abductors or external rotators may not result in increased dynamic knee valgus in healthy subjects."
  - Usada em: `valgo_dinamico`.
- **PMID 22894982**: Cashman GE. The effect of weak hip abductors or external rotators on knee valgus kinematics in healthy subjects: a systematic review. J Sport Rehabil. 2012;21(3):273-84.
  - DOI: [10.1123/jsr.21.3.273](https://doi.org/10.1123/jsr.21.3.273). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática de 11 estudos com indivíduos assintomáticos.
  - Trecho literal do resumo: "There is a small amount of evidence that healthy subjects with weak hip abductors and perhaps weak external rotators demonstrate increased knee valgus. However, due to the variation in methodology and lack of agreement between studies, it is not possible to make any definitive conclusions or clinical recommendations based on the results of this review."
  - Usada em: `valgo_dinamico`.
- **PMID 24450373**: Constantinou M, Barrett R, Brown M, Mills P. Spatial-temporal gait characteristics in individuals with hip osteoarthritis: a systematic literature review and meta-analysis. J Orthop Sports Phys Ther. 2014;44(4):291-B7.
  - DOI: [10.2519/jospt.2014.4634](https://doi.org/10.2519/jospt.2014.4634). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática com metanálise de 30 artigos sobre osteoartrite de quadril.
  - Trecho literal do resumo: "Consistent evidence was found for greater asymmetry in individuals with hip OA than controls, with shorter step length and stance duration in the affected compared to the contralateral limb."
  - Usada em: `assimetria_tempo_apoio`.
- **PMID 36305013**: Corrigan P, Felson DT, Lewis CL, Neogi T, LaValley MP, Gross KD, et al. Relation of Temporal Asymmetry During Walking to Two-Year Knee Pain Outcomes in Those With Mild-to-Moderate Unilateral Knee Pain: An Exploratory Analysis From the Multicenter Osteoarthritis Study. Arthritis Care Res (Hoboken). 2023;75(8):1735-1743.
  - DOI: [10.1002/acr.25050](https://doi.org/10.1002/acr.25050). Conferido no PubMed em 2026-10-18.
  - População: Participantes de uma coorte (Multicenter Osteoarthritis Study) com dor unilateral leve a moderada no joelho.
  - Trecho literal do resumo: "For those with unilateral knee pain, temporal asymmetry during walking is not associated with pain severity. However, select measures of stance and single-limb support time during self-selected and fast walking relate to longitudinal knee pain outcomes."
  - Usada em: `assimetria_tempo_apoio`.
- **PMID 22385873**: Creaby MW, Bennell KL, Hunt MA. Gait differs between unilateral and bilateral knee osteoarthritis. Arch Phys Med Rehabil. 2012;93(5):822-7.
  - DOI: [10.1016/j.apmr.2011.11.029](https://doi.org/10.1016/j.apmr.2011.11.029). Conferido no PubMed em 2026-10-18.
  - População: 91 pessoas com osteoartrite medial de joelho uni ou bilateral e 31 controles assintomáticos.
  - Trecho literal do resumo: "After controlling for walking speed, greater trunk lean toward the more painful knee and reduced flexion in the more painful knee were observed in all OA groups compared with the control group. Between-knee asymmetries indicating greater varus angle and a lower external flexion moment in the painful knee were present in those with unilateral pain and either unilateral or bilateral structural OA."
  - Usada em: `assimetria_flexao_joelho_marcha`.
- **PMID 33713896**: da Costa GV, de Castro MP, Sanchotene CG, Ribeiro DC, de Brito Fontana H, Ruschel C. Relationship between passive ankle dorsiflexion range, dynamic ankle dorsiflexion range and lower limb and trunk kinematics during the single-leg squat. Gait Posture. 2021;86:106-111.
  - DOI: [10.1016/j.gaitpost.2021.03.015](https://doi.org/10.1016/j.gaitpost.2021.03.015). Conferido no PubMed em 2026-10-18.
  - População: 30 adultos sem lesão; agachamento unipodal com cinemática 3D.
  - Trecho literal do resumo: "Greater passive ankle dorsiflexion range was associated with smaller thigh internal rotation (r= -0.38). Greater dynamic ankle dorsiflexion range was associated with smaller trunk flexion (r = 0.59) and pelvis anteversion (r= -0.47)."
  - Usada em: `inclinacao_tronco`.
- **PMID 25144599**: Dill KE, Begalle RL, Frank BS, Zinder SM, Padua DA. Altered knee and ankle kinematics during squatting in those with limited weight-bearing-lunge ankle-dorsiflexion range of motion. J Athl Train. 2014;49(6):723-32.
  - DOI: [10.4085/1062-6050-49.3.29](https://doi.org/10.4085/1062-6050-49.3.29). Conferido no PubMed em 2026-10-18.
  - População: 40 adultos fisicamente ativos (20 com dorsiflexão limitada e 20 sem limitação).
  - Trecho literal do resumo: "Greater ankle DF-ROM assessed during the WBL was associated with greater knee-flexion and ankle-DF displacement during both squatting tasks as well as greater knee-varus displacement during the single-legged squat. Assessment of ankle DF-ROM using the WBL provided important insight into compensatory movement patterns during squatting, whereas nonweight-bearing passive ankle DF-ROM did not."
  - Usada em: `assimetria_flexao_joelho`, `assimetria_dorsiflexao`, `avanco_joelho`.
- **PMID 37524846**: Emamvirdi M, Hosseinzadeh M, Letafatkar A, Thomas AC, Dos'Santos T, Smania N, et al. Comparing kinematic asymmetry and lateral step-down test scores in healthy, chronic ankle instability, and patellofemoral pain syndrome female basketball players: a cross-sectional study. Sci Rep. 2023;13(1):12412.
  - DOI: [10.1038/s41598-023-39625-1](https://doi.org/10.1038/s41598-023-39625-1). Conferido no PubMed em 2026-10-18.
  - População: 60 atletas de basquete do sexo feminino (20 com instabilidade crônica do tornozelo, 20 com dor patelofemoral e 20 controles).
  - Trecho literal do resumo: "Ankle dorsiflexion-ROM was less in the CAI and PFP than in the HC group regardless of limb (p < 0.001). DKV angle was greater in the CAI and PFP than in the HC group bilaterally (p < 0.001)."
  - Usada em: `assimetria_dorsiflexao`, `valgo_dinamico`.
- **PMID 32581431**: Endo Y, Miura M, Sakamoto M. The relationship between the deep squat movement and the hip, knee and ankle range of motion and muscle strength. J Phys Ther Sci. 2020;32(6):391-394.
  - DOI: [10.1589/jpts.32.391](https://doi.org/10.1589/jpts.32.391). Conferido no PubMed em 2026-10-18.
  - População: 9 homens saudáveis; agachamento profundo analisado em vídeo bidimensional.
  - Trecho literal do resumo: "The right ankle dorsiflexion range of motion was a significant predictor of the right hip flexion angle and vice versa. [Conclusion] This study reveals that movement on one side affects contralateral movement, which is important when evaluating the deep squat motion as a functional test."
  - Usada em: `assimetria_flexao_quadril`.
- **PMID 14636100**: Fry AC, Smith JC, Schilling BK. Effect of knee position on hip and knee torques during the barbell squat. J Strength Cond Res. 2003;17(4):629-33.
  - DOI: [10.1519/1533-4287(2003)017<0629:eokpoh>2.0.co;2](https://doi.org/10.1519/1533-4287(2003)017<0629:eokpoh>2.0.co;2). Conferido no PubMed em 2026-10-18.
  - População: 7 homens treinados com pesos; agachamento com barra (carga igual ao peso corporal) filmado em vídeo.
  - Trecho literal do resumo: "Restricted squats also produced more anterior lean of the trunk and shank and a greater internal angle at the knees and ankles. The squat technique used can affect the distribution of forces between the knees and hips and on the kinematic properties of the exercise."
  - Usada em: `inclinacao_tronco`, `avanco_joelho`.
- **PMID 36166956**: Fujita K, Tsushima Y, Hayashi K, Kawabata K, Sato M, Kobayashi Y. Differences in causes of stiff knee gait in knee extensor activity or ankle kinematics: A cross-sectional study. Gait Posture. 2022;98:187-194.
  - DOI: [10.1016/j.gaitpost.2022.09.078](https://doi.org/10.1016/j.gaitpost.2022.09.078). Conferido no PubMed em 2026-10-18.
  - População: 38 pessoas com AVC crônico e joelho rígido na marcha.
  - Trecho literal do resumo: "In the high PC2 group, the timing of peak knee flexion during the swing phase was early, and vastus lateralis activity during the preswing phase negatively correlated with the knee-flexion angle during the swing phase. In the low PC2 group, the angular velocity of ankle plantar flexion at the toe-off was slow, which positively correlated with the knee-flexion angle during the swing phase."
  - Usada em: `assimetria_flexao_joelho_marcha`.
- **PMID 40391865**: Generoso TO, Pelegrinelli ARM, Gonzalez FF, Pallone LV, Locks R, Guadagnin EC, et al. Squatting Biomechanics After Femoroacetabular Impingement Surgery: A Systematic Review and Meta-analysis. Clin J Sport Med. 36(3):296-307. Epub 2025.
  - DOI: [10.1097/JSM.0000000000001371](https://doi.org/10.1097/JSM.0000000000001371). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática com metanálise de 6 estudos (5 na metanálise) de pacientes com impacto femoroacetabular, antes e depois da cirurgia.
  - Trecho literal do resumo: "Although most studies reported no significant changes in kinematic or kinetic variables postsurgery, individual studies reported specific increases in squat depth, pelvic sagittal range of motion, anterior pelvic tilt, hip and knee flexion, and ankle dorsiflexion angles. Meta-analysis revealed no significant differences in the kinematic parameters analyzed."
  - Usada em: `assimetria_flexao_quadril`.
- **PMID 32022631**: Gomes J, Neto T, Vaz JR, Schoenfeld BJ, Freitas SR. Is there a relationship between back squat depth, ankle flexibility, and Achilles tendon stiffness? Sports Biomech. 21(7):782-795. Epub 2020.
  - DOI: [10.1080/14763141.2019.1690569](https://doi.org/10.1080/14763141.2019.1690569). Conferido no PubMed em 2026-10-18.
  - População: 20 adultos saudáveis; agachamento com barra analisado em vídeo bidimensional.
  - Trecho literal do resumo: "In conclusion, back squat depth is associated with ankle dorsiflexion ROM when the knee is flexed, without evident influence of global joint and Achilles tendon mechanical properties."
  - Usada em: `assimetria_dorsiflexao`, `variacao_profundidade`.
- **PMID 36237648**: Hannan KB, King AC. Lower Limb Ground Reaction Force and Center of Pressure Asymmetry During Bodyweight Squats. Int J Sports Phys Ther. 2022;17(6):1075-1082.
  - DOI: [10.26603/001c.37861](https://doi.org/10.26603/001c.37861). Conferido no PubMed em 2026-10-18.
  - População: 18 adultos saudáveis e fisicamente ativos; agachamento bipodal sobre duas plataformas de força.
  - Trecho literal do resumo: "with the preferred leg generating larger values than the non-preferred leg during the self-paced condition"
  - Usada em: `assimetria_flexao_joelho`, `desvio_lateral_pelve`.
- **PMID 18585042**: Harato K, Nagura T, Matsumoto H, Otani T, Toyama Y, Suda Y. A gait analysis of simulated knee flexion contracture to elucidate knee-spine syndrome. Gait Posture. 2008;28(4):687-92.
  - DOI: [10.1016/j.gaitpost.2008.05.008](https://doi.org/10.1016/j.gaitpost.2008.05.008). Conferido no PubMed em 2026-10-18.
  - População: 10 mulheres saudáveis (média de 62 anos) com contratura de flexão do joelho simulada por órtese.
  - Trecho literal do resumo: "The 15 degrees contracture did not significantly change trunk kinematics. However, the 30 degrees contracture significantly changed the kinematics in each of the following planes. In the coronal plane, the trunk tilted to the contracture side in standing and walking. In the sagittal plane, posterior inclination of the pelvis in standing significantly increased. In addition, anterior inclination of the trunk and pelvis during walking significantly increased."
  - Usada em: `inclinacao_tronco_marcha`.
- **PMID 35989174**: Hassan KA, Youssef RSE, Mahmoud NF, Eltagy H, El-Desouky MA. The relationship between ankle dorsiflexion range of motion, frontal plane projection angle, and patellofemoral pain syndrome. Foot Ankle Surg. 2022;28(8):1427-1432.
  - DOI: [10.1016/j.fas.2022.08.003](https://doi.org/10.1016/j.fas.2022.08.003). Conferido no PubMed em 2026-10-18.
  - População: 140 adultos (70 com síndrome da dor patelofemoral e 70 assintomáticos); teste de descida de degrau.
  - Trecho literal do resumo: "When the two groups were compared, ankle DF ROM measured with the knee flexed was higher in the control group (33.15 ± 4.96) than in the PFPS group (30.20 ± 6.93) (p = 0.03). In both the PFPS group and the control group, the correlation between FPPA and ankle DF ROM with the knee flexed was statistically insignificant (p = 0.075 and 0.323 respectively)."
  - Usada em: `assimetria_dorsiflexao`, `valgo_dinamico`.
- **PMID 35193063**: Honda K, Sekiguchi Y, Shimazaki S, Suzuki R, Suzuki T, Kanetaka H, et al. Effects of aging on whole-body center of mass movement and lower limb joint kinematics and kinetics during deep-squat movement. J Biomech. 2022;134:110996.
  - DOI: [10.1016/j.jbiomech.2022.110996](https://doi.org/10.1016/j.jbiomech.2022.110996). Conferido no PubMed em 2026-10-18.
  - População: 12 idosos (mediana de 76,5 anos) e 19 adultos jovens (mediana de 30 anos); agachamento profundo.
  - Trecho literal do resumo: "Furthermore, older individuals exhibited smaller ankle dorsiflexion and knee flexion angles, larger trunk flexion angles, and greater forward displacement of the whole-body center of mass during deep-squat movement (P < 0.05)."
  - Usada em: `inclinacao_tronco`.
- **PMID 30904334**: Iijima H, Shimoura K, Ono T, Aoyama T, Takahashi M. Proximal gait adaptations in individuals with knee osteoarthritis: A systematic review and meta-analysis. J Biomech. 2019;87:127-141.
  - DOI: [10.1016/j.jbiomech.2019.02.027](https://doi.org/10.1016/j.jbiomech.2019.02.027). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática com metanálise de 32 artigos (2037 participantes) com osteoartrite de joelho.
  - Trecho literal do resumo: "Individuals with knee OA had significantly increased lateral trunk lean toward the ipsilateral limb (pooled SMD: 1.18; 95% CI: 0.59, 1.77) along with significantly decreased EHAM. These subjects also displayed a non-significantly increased trunk/pelvic flexion angle and EHFM."
  - Usada em: `inclinacao_tronco_marcha`.
- **PMID 37441507**: Ishida T, Samukawa M, Koshino Y, Ino T, Kasahara S, Tohyama H. Interlimb Asymmetry in Knee Extension Moment During Double-Leg Squatting Is Associated With Persistent Quadriceps Weakness After ACL Reconstruction. Orthop J Sports Med. 2023;11(6):23259671231182105.
  - DOI: [10.1177/23259671231182105](https://doi.org/10.1177/23259671231182105). Conferido no PubMed em 2026-10-18.
  - População: 26 pessoas com mais de 1 ano após reconstrução do ligamento cruzado anterior; agachamento bipodal.
  - Trecho literal do resumo: "Asymmetrical biomechanics during double-leg squatting was associated with persistent quadriceps weakness after ACLR. The LQ group had reduced knee extensor moment on the involved side during squatting despite loading at approximately half the maximum strength."
  - Usada em: `assimetria_flexao_joelho`, `desvio_lateral_pelve`.
- **PMID 28422563**: Kernozek TW, Gheidi N, Zellmer M, Hove J, Heinert BL, Torry MR. Effects of Anterior Knee Displacement During Squatting on Patellofemoral Joint Stress. J Sport Rehabil. 2018;27(3):237-243.
  - DOI: [10.1123/jsr.2016-0197](https://doi.org/10.1123/jsr.2016-0197). Conferido no PubMed em 2026-10-18.
  - População: 25 mulheres saudáveis; agachamento com os joelhos atrás ou além da ponta dos pés (estimativa por modelo musculoesquelético).
  - Trecho literal do resumo: "The magnitudes of PFJS, reaction force, and quadriceps force were higher (P < .001) during SPT compared with the SBT technique. Knee flexion, hip flexion, and ankle dorsiflexion angles were reduced when using the SBT technique."
  - Usada em: `avanco_joelho`.
- **PMID 11239282**: Kerrigan DC, Lee LW, Collins JJ, Riley PO, Lipsitz LA. Reduced hip extension during walking: healthy elderly and fallers versus young adults. Arch Phys Med Rehabil. 2001;82(1):26-30.
  - DOI: [10.1053/apmr.2001.18584](https://doi.org/10.1053/apmr.2001.18584). Conferido no PubMed em 2026-10-18.
  - População: 23 idosos saudáveis, 16 idosos com quedas recorrentes e 30 adultos jovens.
  - Trecho literal do resumo: "An isolated and consistent reduction in hip extension during walking in the elderly, which is exaggerated in fallers, implies the presence of functionally significant hip tightness, which may limit walking performance."
  - Usada em: `assimetria_amplitude_quadril`.
- **PMID 28600975**: Khamis S, Carmeli E. Relationship and significance of gait deviations associated with limb length discrepancy: A systematic review. Gait Posture. 2017;57:115-123.
  - DOI: [10.1016/j.gaitpost.2017.05.028](https://doi.org/10.1016/j.gaitpost.2017.05.028). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática de 12 estudos: diferença anatômica de comprimento dos membros e diferença simulada com elevações em pessoas saudáveis.
  - Trecho literal do resumo: "A significant relationship was found between anatomic LLD and gait deviation."
  - Usada em: `assimetria_tempo_apoio`, `assimetria_flexao_joelho_marcha`, `assimetria_amplitude_quadril`.
- **PMID 25964810**: Kim SH, Kwon OY, Park KN, Jeon IC, Weon JH. Lower extremity strength and the range of motion in relation to squat depth. J Hum Kinet. 2015;45:59-69.
  - DOI: [10.1515/hukin-2015-0007](https://doi.org/10.1515/hukin-2015-0007). Conferido no PubMed em 2026-10-18.
  - População: 101 adultos saudáveis (64 homens e 37 mulheres).
  - Trecho literal do resumo: "The multiple regression model indicated that ankle dorsiflexion with a flexed knee and the hip flexion ROM were significantly associated with squat depth in male subjects (R(2) = 0.435) and ankle dorsiflexion with an extended knee and dorsiflexor strength were significantly associated with squat depth in female subjects (R(2) = 0.324)."
  - Usada em: `assimetria_flexao_quadril`, `variacao_profundidade`.
- **PMID 39815400**: Krajewski KT, Correa JS, Siu R, Cunningham D, Sulzer JS. Mechanisms of Post-stroke Stiff-Knee Gait: A Narrative Review. Am J Phys Med Rehabil. 2025;104(7):e101-e108.
  - DOI: [10.1097/PHM.0000000000002678](https://doi.org/10.1097/PHM.0000000000002678). Conferido no PubMed em 2026-10-18.
  - População: Revisão narrativa sobre a marcha com joelho rígido após AVC.
  - Trecho literal do resumo: "We explore evidence for quadriceps hyperreflexia, abnormal tone, motor incoordination, and impaired propulsion."
  - Usada em: `assimetria_flexao_joelho_marcha`.
- **PMID 21543687**: Lamontagne M, Brisson N, Kennedy MJ, Beaulé PE. Preoperative and postoperative lower-extremity joint and pelvic kinematics during maximal squatting of patients with cam femoro-acetabular impingement. J Bone Joint Surg Am. 2011;93 Suppl 2:40-5.
  - DOI: [10.2106/JBJS.J.01809](https://doi.org/10.2106/JBJS.J.01809). Conferido no PubMed em 2026-10-18.
  - População: 10 pessoas com impacto femoroacetabular tipo came unilateral sintomático, avaliadas antes e depois da cirurgia.
  - Trecho literal do resumo: "Postoperative knee flexion and ankle dorsiflexion angles of the affected extremity at maximal depth were significantly greater than preoperative values. The postoperative sum of all joint angles of the affected limb at maximal squat depth was significantly larger than the preoperative sum. No significant differences were detected between the preoperative and postoperative measurements of the patients with cam impingement with respect to the kinematics of the affected hip at maximal squat depth, the pelvic angular displacements at maximal squat depth, or the overall pelvic range of motion during maximal deep squatting (p > 0.05)."
  - Usada em: `assimetria_flexao_quadril`.
- **PMID 11809582**: Leroux A, Fung J, Barbeau H. Postural adaptation to walking on inclined surfaces: I. Normal strategies. Gait Posture. 2002;15(1):64-74.
  - DOI: [10.1016/s0966-6362(01)00181-3](https://doi.org/10.1016/s0966-6362(01)00181-3). Conferido no PubMed em 2026-10-18.
  - População: 8 adultos saudáveis; esteira com inclinação de 0, 5 e 10% (subida e descida).
  - Trecho literal do resumo: "Increasing the treadmill grade from 0 to 10% induced an increasingly flexed posture of the hip, knee and ankle at initial foot contact as well as a progressive forward tilt of pelvis and trunk."
  - Usada em: `inclinacao_tronco_marcha`.
- **PMID 22990570**: List R, Gülay T, Stoop M, Lorenzetti S. Kinematics of the trunk and the lower extremities during restricted and unrestricted squats. J Strength Cond Res. 2013;27(6):1529-38.
  - DOI: [10.1519/JSC.0b013e3182736034](https://doi.org/10.1519/JSC.0b013e3182736034). Conferido no PubMed em 2026-10-18.
  - População: 30 pessoas; agachamento com barra, com e sem restrição do avanço dos joelhos.
  - Trecho literal do resumo: "In an unrestricted squat, the angle of the knee is larger and the range of motion (ROM) between the lumbar and the thoracic segments is significantly smaller compared with a restricted squat (p < 0.05)."
  - Usada em: `avanco_joelho`.
- **PMID 29895235**: Lopes TJA, Ferrari D, Ioannidis J, Simic M, Mícolis de Azevedo F, Pappas E. Reliability and Validity of Frontal Plane Kinematics of the Trunk and Lower Extremity Measured With 2-Dimensional Cameras During Athletic Tasks: A Systematic Review With Meta-analysis. J Orthop Sports Phys Ther. 2018;48(10):812-822.
  - DOI: [10.2519/jospt.2018.8006](https://doi.org/10.2519/jospt.2018.8006). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática com metanálise de 16 estudos sobre confiabilidade e validade da análise 2D do plano frontal em agachamento, aterrissagem e corte.
  - Trecho literal do resumo: "In terms of validity, there was poor agreement between the 2-D and 3-D methods, with no correlation between 2-D knee frontal plane projection angle and 3-D knee frontal plane angles (r = 0.127, P = .094) for the single-leg squat, but a moderate to good relationship (r = 0.619, P<.001) for the landing task."
  - Usada em: `valgo_dinamico`.
- **PMID 20542608**: Lugade V, Wu A, Jewett B, Collis D, Chou LS. Gait asymmetry following an anterior and anterolateral approach to total hip arthroplasty. Clin Biomech (Bristol). 2010;25(7):675-80.
  - DOI: [10.1016/j.clinbiomech.2010.05.003](https://doi.org/10.1016/j.clinbiomech.2010.05.003). Conferido no PubMed em 2026-10-18.
  - População: 23 pacientes com osteoartrite de quadril antes de artroplastia (abordagem anterior ou anterolateral) e 10 controles.
  - Trecho literal do resumo: "At presurgery, greater single limb support time and step length asymmetry was demonstrated by both patient groups when compared to controls."
  - Usada em: `assimetria_tempo_apoio`.
- **PMID 22100617**: Macrum E, Bell DR, Boling M, Lewek M, Padua D. Effect of limiting ankle-dorsiflexion range of motion on lower extremity kinematics and muscle-activation patterns during a squat. J Sport Rehabil. 21(2):144-50. Epub 2011.
  - DOI: [10.1123/jsr.21.2.144](https://doi.org/10.1123/jsr.21.2.144). Conferido no PubMed em 2026-10-18.
  - População: 30 adultos saudáveis e fisicamente ativos, sem lesão prévia de membro inferior; agachamento com e sem cunha sob o antepé.
  - Trecho literal do resumo: "Compared with the NW condition, the wedge produced decreased peak knee flexion (P < .001, effect size [ES] = 0.81) and knee-flexion excursion (P < .001, ES = 0.82) while producing increased peak ankle dorsiflexion (P = .006, ES = 0.31), ankle-dorsiflexion excursion (P < .001, ES = 0.31), peak knee-valgus angle (P = .02, ES = 0.21), and MKD (P < .001, ES = 2.92)."
  - Usada em: `assimetria_flexao_joelho`, `valgo_dinamico`.
- **PMID 23096063**: Mauntel TC, Begalle RL, Cram TR, Frank BS, Hirth CJ, Blackburn T, et al. The effects of lower extremity muscle activation and passive range of motion on single leg squat performance. J Strength Cond Res. 2013;27(7):1813-23.
  - DOI: [10.1519/JSC.0b013e318276b886](https://doi.org/10.1519/JSC.0b013e318276b886). Conferido no PubMed em 2026-10-18.
  - População: 40 adultos fisicamente ativos (20 com deslocamento medial do joelho no agachamento unipodal e 20 controles).
  - Trecho literal do resumo: "Results during the SLS indicated hip coactivation ratios revealed smaller gluteus medius to hip adductor (GMed:Hip Add) (p = 0.028) and gluteus maximus to hip adductor (GMax:Hip Add) coactivation ratios (p = 0.007) compared with the control group. Also, the MKD group displayed significantly less passive ankle dorsiflexion with the knee extended (p = 0.047) and flexed (p = 0.034), and greater talar glide motion (p = 0.012)."
  - Usada em: `valgo_dinamico`.
- **PMID 29927892**: Mettler JH, Shapiro R, Pohl MB. Effects of a Hip Flexor Stretching Program on Running Kinematics in Individuals With Limited Passive Hip Extension. J Strength Cond Res. 2019;33(12):3338-3344.
  - DOI: [10.1519/JSC.0000000000002586](https://doi.org/10.1519/JSC.0000000000002586). Conferido no PubMed em 2026-10-18.
  - População: 20 pessoas saudáveis com extensão passiva do quadril limitada; corrida submáxima.
  - Trecho literal do resumo: "A 3-week static stretching program of the hip flexor muscle group resulted in an increase in passive hip extension, but the sagittal plane kinematics of the LPH complex during running remained unchanged."
  - Usada em: `assimetria_amplitude_quadril`.
- **PMID 37374309**: Miyasaka H, Ebihara B, Fukaya T, Mutsuzaki H. Relationship between the Young's Modulus of the Achilles Tendon and Ankle Dorsiflexion Angle at Maximum Squat Depth in Healthy Young Males. Medicina (Kaunas). 2023;59(6).
  - DOI: [10.3390/medicina59061105](https://doi.org/10.3390/medicina59061105). Conferido no PubMed em 2026-10-18.
  - População: 31 homens jovens saudáveis.
  - Trecho literal do resumo: "The Young's modulus of the AT may affect the ankle dorsiflexion angle at the maximum squat depth in healthy young males."
  - Usada em: `assimetria_dorsiflexao`.
- **PMID 4042479**: Murray MP, Gore DR, Sepic SB, Mollinger LA. Antalgic maneuvers during walking in men with unilateral knee disability. Clin Orthop Relat Res. 1985;(199):192-200.
  - DOI: sem DOI no registro do PubMed. Conferido no PubMed em 2026-10-18.
  - População: 35 homens com incapacidade unilateral do joelho por dor.
  - Trecho literal do resumo: "The following antalgic maneuvers were found to be common to the gait of these patients: slow and uneven forward progression with lateral lurching toward the painful side, asymmetry in stride and temporal components, and abnormalities in the displacement patterns of most body segments."
  - Usada em: `assimetria_tempo_apoio`.
- **PMID 31254772**: Preece SJ, Algarni AS, Jones RK. Trunk flexion during walking in people with knee osteoarthritis. Gait Posture. 2019;72:202-205.
  - DOI: [10.1016/j.gaitpost.2019.06.012](https://doi.org/10.1016/j.gaitpost.2019.06.012). Conferido no PubMed em 2026-10-18.
  - População: Pessoas com osteoartrite de joelho e controles saudáveis.
  - Trecho literal do resumo: "Individuals with knee OA walked with a mean increase in trunk flexion of 2.6°. Although this difference was more pronounced during early stance, it was maintained across the whole of stance phase."
  - Usada em: `inclinacao_tronco_marcha`.
- **PMID 24581172**: Roos PE, Button K, van Deursen RW. Motor control strategies during double leg squat following anterior cruciate ligament rupture and reconstruction: an observational study. J Neuroeng Rehabil. 2014;11:19.
  - DOI: [10.1186/1743-0003-11-19](https://doi.org/10.1186/1743-0003-11-19). Conferido no PubMed em 2026-10-18.
  - População: 62 adultos (20 com ruptura do ligamento cruzado anterior sem reconstrução, 21 com ligamento reconstruído e 21 controles); agachamento bipodal.
  - Trecho literal do resumo: "ACLR controlled knee moment magnitude using two strategies; 1) transfer of support moment to non-injured leg; 2) transfer of support moment from knee to ankle and/or hip of injured leg."
  - Usada em: `assimetria_flexao_joelho`, `desvio_lateral_pelve`.
- **PMID 24149783**: Seeley MK, Umberger BR, Clasey JL, Shapiro R. The relation between mild leg-length inequality and able-bodied gait asymmetry. J Sports Sci Med. 2010;9(4):572-9.
  - DOI: sem DOI no registro do PubMed. Conferido no PubMed em 2026-10-18.
  - População: 26 adultos sem doença; diferença leve de comprimento dos membros medida por radiografia.
  - Trecho literal do resumo: "Statistically significant relationships were observed between LLI and the symmetry coefficient for knee joint moment (r = -0.48) and power (r = -0.51), and ankle joint moment (r = -0.41) and power (r = -0.42)."
  - Usada em: `assimetria_tempo_apoio`, `assimetria_flexao_joelho_marcha`, `assimetria_amplitude_quadril`.
- **PMID 34628200**: Song Y, Li L, Albrandt EE, Jensen MA, Dai B. Medial-lateral hip positions predicted kinetic asymmetries during double-leg squats in collegiate athletes following anterior cruciate ligament reconstruction. J Biomech. 2021;128:110787.
  - DOI: [10.1016/j.jbiomech.2021.110787](https://doi.org/10.1016/j.jbiomech.2021.110787). Conferido no PubMed em 2026-10-18.
  - População: 17 atletas universitários após reconstrução do ligamento cruzado anterior (0 a 12 meses); agachamento bipodal.
  - Trecho literal do resumo: "Medial-lateral hip positions strongly and significantly correlated with VGRF asymmetries and knee moment asymmetries at both assessments (p ≤ 0.018, r ≥ 0.62)."
  - Usada em: `desvio_lateral_pelve`.
- **PMID 42107174**: Staines R, Patterson K, Jagroop D, Inness EL, Mansfield A. The relationship between gait asymmetry and stability in people with sub-acute stroke. Gait Posture. 2026;128:110216.
  - DOI: [10.1016/j.gaitpost.2026.110216](https://doi.org/10.1016/j.gaitpost.2026.110216). Conferido no PubMed em 2026-10-18.
  - População: 31 pessoas com AVC subagudo (menos de 6 meses).
  - Trecho literal do resumo: "As swing symmetry increased, the extrapolated centre of mass tended to be closer to the lateral border of the less affected side and farther from the medial border of the more affected side. Gait asymmetry could, in part, result from a strategy to compensate for poor balance control on the more affected side."
  - Usada em: `assimetria_tempo_apoio`.
- **PMID 38046934**: Steingrebe H, Spancken S, Sell S, Stein T. Effects of hip osteoarthritis on lower body joint kinematics during locomotion tasks: a systematic review and meta-analysis. Front Sports Act Living. 2023;5:1197883.
  - DOI: [10.3389/fspor.2023.1197883](https://doi.org/10.3389/fspor.2023.1197883). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática com metanálise de 35 estudos com osteoartrite de quadril.
  - Trecho literal do resumo: "Most group differences were found in ipsi- and contralateral three-dimensional hip and sagittal knee angles with reduced ranges of motion in HOA subjects."
  - Usada em: `assimetria_flexao_joelho_marcha`, `assimetria_amplitude_quadril`.
- **PMID 42804966**: Tsutsumi R, Kikuchi N, Kadone H, Kanamori A, Mochizuki H, Terajima S, et al. Total knee arthroplasty alters trunk alignment and reduces lumbar erector spinae activity during gait. Clin Biomech (Bristol). 2026;140:106978.
  - DOI: [10.1016/j.clinbiomech.2026.106978](https://doi.org/10.1016/j.clinbiomech.2026.106978). Conferido no PubMed em 2026-10-18.
  - População: 24 pacientes avaliados antes e 1 ano depois de artroplastia total do joelho.
  - Trecho literal do resumo: "After total knee arthroplasty, the mean dynamic sagittal vertical axis and forward trunk inclination during gait decreased (p < 0.01), whereas the mean anterior pelvic tilt increased (p < 0.01)."
  - Usada em: `inclinacao_tronco_marcha`.
- **PMID 37181257**: Vermeulen S, De Bleecker C, De Blaiser C, Kilinç ÖO, Willems T, Vanrenterghem J, et al. The Effect of Fatigue on Trunk and Pelvic Jump-Landing Biomechanics in View of Lower Extremity Loading: A Systematic Review. J Hum Kinet. 2023;86:73-95.
  - DOI: [10.5114/jhk/159460](https://doi.org/10.5114/jhk/159460). Conferido no PubMed em 2026-10-18.
  - População: Revisão sistemática de 21 estudos com adultos fisicamente ativos; aterrissagem de salto.
  - Trecho literal do resumo: "The results indicate prevailing evidence for more trunk flexion during standardized jump-landing tasks after lower extremity muscle fatigue."
  - Usada em: `tendencia_na_serie`.
- **PMID 42516619**: Walker ML, Bruce S, Gore CA, Cartwright KE, Tolbert MA. 3D Motion Analysis of Single-leg Squat with Association to Hip Strength and Ankle Dorsiflexion. Int J Exerc Sci. 2026;19(1):1007.
  - DOI: [10.70252/IJES2026107](https://doi.org/10.70252/IJES2026107). Conferido no PubMed em 2026-10-18.
  - População: 72 adultos saudáveis (59,7% mulheres); agachamento unipodal.
  - Trecho literal do resumo: "Findings are congruent with previous literature regarding the biomechanical influence from ankle mobility to SLS depth; however, hip strength does not appear to affect SLS depth."
  - Usada em: `variacao_profundidade`.
- **PMID 24934927**: Webster KE, Austin DC, Feller JA, Clark RA, McClelland JA. Symmetry of squatting and the effect of fatigue following anterior cruciate ligament reconstruction. Knee Surg Sports Traumatol Arthrosc. 23(11):3208-13. Epub 2014.
  - DOI: [10.1007/s00167-014-3121-3](https://doi.org/10.1007/s00167-014-3121-3). Conferido no PubMed em 2026-10-18.
  - População: 10 homens que voltaram ao esporte após reconstrução do ligamento cruzado anterior e 10 controles; agachamento bipodal antes e depois de fadiga.
  - Trecho literal do resumo: "The ACL group preferentially unloaded the reconstructed limb at baseline, but changed to a more symmetrical load distribution to perform the squat exercise in the fatigue condition. This same loading pattern was seen at both the knee and hip joints."
  - Usada em: `desvio_lateral_pelve`, `tendencia_na_serie`.
- **PMID 26816531**: Wyndow N, De Jong A, Rial K, Tucker K, Collins N, Vicenzino B, et al. The relationship of foot and ankle mobility to the frontal plane projection angle in asymptomatic adults. J Foot Ankle Res. 2016;9:3.
  - DOI: [10.1186/s13047-016-0134-9](https://doi.org/10.1186/s13047-016-0134-9). Conferido no PubMed em 2026-10-18.
  - População: 30 adultos assintomáticos de 18 a 50 anos; agachamento unipodal filmado em vídeo.
  - Trecho literal do resumo: "Foot and ankle mobility was significantly related to the FPPA during the single leg squat in healthy individuals. Specifically, higher midfoot width mobility, or lower ankle joint dorsiflexion range and midfoot height mobility, were associated with a greater FPPA."
  - Usada em: `valgo_dinamico`.

## Como incluir ou alterar uma fonte

1. Abrir o resumo no PubMed e copiar o trecho exatamente (em inglês), sem reticências nem edição.
2. Registrar PMID, autores, periódico, ano e DOI como aparecem no registro; uma entrada por PMID em `fontes.ts`.
3. Escolher a força pelo tipo do artigo; evidência mista ou contraditória vira ressalva explícita, e população e método entram na ressalva.
4. Escrever o fator como hipótese, em linguagem de associação, e rodar `npx vitest run src/test/movimentoBiblioteca.test.ts`.
5. Atualizar este documento.
