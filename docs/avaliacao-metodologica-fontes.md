# Avaliação metodológica das fontes da biblioteca de hipóteses (Etapa 3)

Pedido do Rafael (18/10/2026): olhar os dados do PubMed com critério, como um profissional da biomecânica, e usar só fontes com qualidade metodológica
para isso. A curadoria anterior (`docs/biblioteca-hipoteses-movimento.md`) conferiu autores, ano, DOI e trecho literal, mas leu só resumos e não avaliou
risco de viés. Este documento é a avaliação que faltava e vale como regra para qualquer fonte nova.

Código: `src/lib/angular/movimento/biblioteca/avaliacaoMetodologica.ts` (uma entrada por PMID, inclusive das fontes removidas) e `fontes.ts`.
Teste: `src/test/movimentoBiblioteca.test.ts`. Especificação do produto: `docs/avaliacao-movimento-v3.md`.

Informações de artigos recuperadas do PubMed (conferência em 18/10/2026). Cada fonte traz DOI para consulta.

## Contexto de uso

O laudo da Etapa 3 descreve e mede movimento por vídeo (2D, estimativa de pose no dispositivo). Não é treino nem nota de desempenho. As hipóteses da
biblioteca são lembretes para o profissional confirmar no exame presencial, e quem vê o laudo é o profissional. Por isso a pergunta que decide uma fonte não é
"o artigo é bom?", e sim: **o artigo, lido com rigor metodológico, sustenta o que o laudo diz com ele, para clientes de fisioterapia e para uma medida de vídeo 2D?**

## O que foi lido, e o que isso limita

- **Resumo de todas as fontes**, pela ferramenta de metadados do PubMed.
- **Texto completo** quando o artigo está no PubMed Central e a ferramenta o devolveu. Li o texto inteiro de Wyndow 2016 e Alzahrani 2021 e, nos demais,
  os trechos de métodos, amostra, medidas, análise estatística e limitações. Dill 2014 e Seeley 2010 estão no PubMed Central, mas o texto veio vazio:
  foram avaliados só pelo resumo. A coluna "Lido" do quadro final diz, por fonte, o que foi lido.
- **O que não foi feito.** Não consultei o catálogo da NLM nem listas de periódicos predatórios. Não apliquei AMSTAR-2, Newcastle-Ottawa, JBI ou PEDro
  formalmente, com dupla leitura e pontuação: usei os itens desses instrumentos como roteiro de um único leitor. É uma triagem metodológica **a ser conferida
  pelo time científico**, e o documento diz "não avaliável" onde o texto acessível não permite julgar. Nada foi presumido.
- **Regra de honestidade.** "Não avaliável" nunca conta como "atende". O nível `alta` só é dado quando os itens críticos foram verificados no texto acessível.
  Fonte lida só pelo resumo chega no máximo a `moderada`, mesmo que o desenho seja forte.

## Critérios

### (a) Desenho e hierarquia

Revisão sistemática ou metanálise > ensaio controlado > coorte ou caso-controle > transversal ou laboratorial > série de casos > revisão narrativa ou opinião.
A hierarquia vale para a pergunta feita: um experimento intrassujeito de laboratório com manipulação controlada pode sustentar um efeito agudo melhor que
uma correlação transversal, e uma revisão sistemática mal conduzida não vale mais que um bom estudo primário. Um desenho forte não compensa uma pergunta
diferente da nossa (item d).

### (b) Revisões sistemáticas (itens-chave no estilo AMSTAR-2)

1. **protocolo**: protocolo ou registro prévio (por exemplo, PROSPERO).
2. **busca**: busca abrangente (pelo menos 3 bases, estratégia descrita, seleção e extração por dois revisores).
3. **risco_de_vies**: avaliação do risco de viés dos estudos incluídos, com instrumento nomeado.
4. **sintese**: síntese adequada (metanálise só quando os estudos são combináveis; narrativa quando não são).
5. **heterogeneidade**: tratamento da heterogeneidade e dos resultados divergentes.
6. **conflito_de_interesse**: declaração de conflito de interesse e financiamento.

Uma busca em uma única base, ou a ausência de qualquer avaliação do risco de viés, é falha crítica: a revisão não passa de `moderada`, e só fica se o uso
no laudo for uma ressalva conservadora.

### (c) Estudos primários (estilo Newcastle-Ottawa, JBI e PEDro conforme o desenho)

1. **amostra**: tamanho e justificativa (cálculo amostral ou desfecho primário que o torne desnecessário).
2. **populacao**: descrição e adequação da população à pergunta do estudo.
3. **medida**: validade e confiabilidade da medida (captura 3D de referência, dinamômetro, goniômetro, vídeo 2D com concordância e ICC informados).
4. **confundidores**: controle de confundidores (idade, sexo, velocidade, carga, ordem das condições, aprendizado).
5. **desfecho**: definição clara do desfecho, de preferência um primário.
6. **comparacoes_multiplas**: correção para comparações múltiplas ou análise que não dependa delas.

### (d) Aplicabilidade (separada da qualidade)

O achado sustenta **mesmo** a hipótese em que foi usado? A população e a tarefa se parecem com os clientes de fisioterapia e com o movimento analisado
(agachamento bilateral ou unipodal, marcha, corrida)? A medida do estudo se relaciona com o que o vídeo 2D mede?

- `direta`: tarefa, medida e população próximas do uso no laudo.
- `parcial`: um dos três difere (por exemplo, captura 3D no lugar de vídeo 2D, ou população com condição específica que o ressalva diz).
- `indireta`: dois ou mais diferem, ou a variável associada não é a que a hipótese usa. Fonte `indireta` só fica se servir para limitar a afirmação,
  nunca para sustentá-la.

### (e) Consistência

Evidência contraditória ou mista nunca é omitida: vira ressalva explícita no fator (por exemplo, a força do quadril e o valgo, a dor no joelho e a assimetria
temporal, a osteoartrite de joelho e o tronco na marcha). Fonte que contradiz o fator pode ficar justamente para dizer isso.

### (f) Veículo (critério auxiliar)

Revista indexada no MEDLINE e sem sinal de periódico predatório. Não tenho como consultar o catálogo da NLM nesta ferramenta: marquei `atende` quando a
revista é de editora ou sociedade consolidada na área e sabidamente indexada, e `não avaliável` nas demais. Nenhuma fonte foi aceita ou rejeitada só por isto.

## Como cada item é registrado

| Resultado | Quando |
| --- | --- |
| atende | o texto acessível mostra que o item foi cumprido |
| parcialmente | cumprido em parte, ou só para parte dos desfechos ou dos estudos |
| não atende | o texto acessível mostra que o item não foi cumprido |
| não avaliável | o texto acessível não permite julgar; não se presume que atende |

## Nível de qualidade e decisão

**Nível** (da fonte, pelos itens do desenho dela):

- `alta`: itens críticos verificados no texto acessível e cumpridos, sem limitação que invalide o uso. Revisão sistemática com registro, busca em várias bases,
  risco de viés avaliado e síntese adequada; ou estudo primário com amostra justificada, medida válida, confundidores tratados e comparações múltiplas tratadas.
- `moderada`: desenho adequado à pergunta, com uma ou duas limitações que não invalidam o uso (amostra modesta, sem correção de comparações múltiplas,
  população específica, itens não avaliáveis pelo resumo).
- `baixa`: limitação grave. Amostra muito pequena em desenho entre grupos, em correlação ou em regressão (cerca de 12 ou menos por grupo, sem justificativa);
  grupo sem comparação (antes e depois sem controle); série de casos; revisão narrativa; revisão sistemática com busca em uma base e sem risco de viés;
  conclusão do resumo que passa dos dados; relato estatístico inconsistente.

**Decisão:**

- `manter`: qualidade alta ou moderada e aplicabilidade direta, sem limitação que o fator precise declarar além da ressalva geral.
- `manter com ressalva`: o fator precisa dizer a limitação da fonte (população, desenho, medida 3D no lugar de 2D, resultado misto). É a decisão da maioria.
- `remover`: qualidade baixa, aplicabilidade indireta para sustentar o fator, redundância com fonte melhor ou afirmação além do que o estudo mostra.

Regras de rigor que pesaram nas decisões:

1. Experimento intrassujeito com manipulação controlada tolera amostra pequena melhor que correlação entre pessoas: o efeito agudo é medido na mesma pessoa.
2. Fonte repetida por revisão melhor (mais recente, mais ampla ou com método mais claro) é removida por redundância.
3. Se a variável associada no estudo não é a que a hipótese usa (por exemplo, dorsiflexão medida durante o agachamento, que é resultado do próprio
   movimento, no lugar da mobilidade do tornozelo), a fonte não sustenta a hipótese.
4. Quando o resumo conclui mais do que mediu (causa, prescrição, "sugere que"), o laudo usa só o que foi medido; se nem isso sustenta o fator, a fonte sai.
5. Fator que perde todas as fontes retidas vira "a confirmar" (a interface escreve "sem referência verificada") ou é eliminado, se um fator irmão bem
   fundamentado já cobre a ideia.

## O que o laudo passa a mostrar

Cada fonte exibida (tela e PDF) traz **"Qualidade metodológica: alta/moderada"** e a **limitação principal** em uma frase. O método do laudo ganha:
*"Fontes escolhidas por critérios metodológicos explícitos; avaliação feita pelo MyHealthID a partir do resumo e do texto completo indexado, a ser conferida
pelo time científico."* Fonte de qualidade `baixa` só poderia ficar com a ressalva dita no fator; nesta rodada nenhuma ficou.

<!-- INICIO-RESULTADO -->
## Resultado

Foram avaliadas **55 fontes**: as 51 da curadoria anterior e 4 incluídas nesta revisão (Lima 2017, Haberkamp 2022, Cheatham 2018, Strong 2023), buscadas no PubMed para substituir fontes removidas ou cobrir lacunas.

| Decisão | Fontes |
| --- | --- |
| manter | 2 |
| manter com ressalva | 34 |
| remover | 19 |

**Mantidas: 36** (2 sem ressalva específica e 34 com ressalva) · **removidas: 19**. Nível de qualidade das mantidas: alta 2, moderada 34, baixa 0. Das removidas: alta 0, moderada 6, baixa 13 (sair não significa só qualidade baixa: aplicabilidade indireta e redundância também removem).

**Fatores:** antes 39 (36 com fonte e 3 a confirmar); depois **35** (31 com fonte e **4 a confirmar**). Quatro fatores foram eliminados (`equilibrio_apos_avc`, `alteracoes_neuromotoras_apos_avc`, `tensao_dos_flexores_do_quadril` e `condicao_do_quadril` da marcha) e um passou a "a confirmar" (`restricao_do_avanco_do_joelho`).

**Itens a conferir:** antes 47 (25 com fonte e 22 sem); depois 47 (25 com fonte e 22 sem referência verificada). Todo item com fonte aponta para uma fonte retida.

### Onde os itens ficaram "não avaliável" (fontes mantidas)

Contagem por item entre as fontes mantidas: é o mapa do que o time científico precisa conferir no artigo completo.

**Revisões sistemáticas (11 mantidas)**

| Item | atende | parcialmente | não atende | não avaliável |
| --- | --- | --- | --- | --- |
| Protocolo ou registro prévio | 3 | 0 | 1 | 7 |
| Busca abrangente | 7 | 4 | 0 | 0 |
| Risco de viés dos incluídos | 7 | 1 | 0 | 3 |
| Síntese adequada | 9 | 2 | 0 | 0 |
| Heterogeneidade tratada | 3 | 5 | 0 | 3 |
| Conflito de interesse declarado | 0 | 0 | 0 | 11 |
| Veículo (auxiliar) | 8 | 0 | 0 | 3 |

**Estudos primários (25 mantidas)**

| Item | atende | parcialmente | não atende | não avaliável |
| --- | --- | --- | --- | --- |
| Tamanho e justificativa da amostra | 4 | 8 | 0 | 13 |
| População descrita e adequada | 13 | 12 | 0 | 0 |
| Validade e confiabilidade da medida | 19 | 6 | 0 | 0 |
| Controle de confundidores | 2 | 16 | 1 | 6 |
| Desfecho definido | 17 | 8 | 0 | 0 |
| Comparações múltiplas | 2 | 7 | 0 | 16 |
| Veículo (auxiliar) | 21 | 0 | 0 | 4 |

### Quadro por fonte

Ordem: decisão (mantidas primeiro) e, dentro dela, ordem alfabética do primeiro autor. "Lido": resumo ou métodos e limitações do texto completo no PubMed Central. "Onde é usada": chave do achado e fator ou item a conferir.

| Fonte | Desenho | Lido | Qualidade | Decisão | Aplicabilidade | Onde é usada |
| --- | --- | --- | --- | --- | --- | --- |
| **Lima 2017** (PMID 28974358) | Revisão sistemática com metanálise de 17 estudos que comparam a dorsiflexão de pessoas com e sem valgo dinâmico do joelho | resumo | moderada | manter | direta | `valgo_dinamico` (fator mobilidade_tornozelo_pe) |
| **Lopes 2018** (PMID 29895235) | Revisão sistemática com metanálise de 16 estudos de confiabilidade e validade da análise 2D do plano frontal (agachamento, aterrissagem, corte) | resumo | moderada | manter | direta | `valgo_dinamico` (fator projecao_2d, a conferir) |
| **Alzahrani 2021** (PMID 34300118) | Revisão sistemática qualitativa de 7 estudos observacionais com análise de movimento 2D em adultos saudáveis | texto completo (métodos e limitações) | moderada | manter com ressalva | parcial | `valgo_dinamico` (fator forca_do_quadril, a conferir) |
| **Apti 2016** (PMID 27131202) | Antes e depois com controle externo: fraqueza experimental dos flexores plantares por alongamento passivo, 3D, 20 adultos e 7 controles | resumo | moderada | manter com ressalva | parcial | `assimetria_flexao_joelho_marcha` (fator flexores_plantares, a conferir) |
| **Baker 2016** (PMID 26895694) | Estudo transversal de três grupos (osteoartrite de quadril moderada, grave e assintomáticos): extensão passiva por goniometria e dinâmica na esteira | resumo | moderada | manter com ressalva | parcial | `assimetria_amplitude_quadril` (fator restricao_de_mobilidade_do_quadril, a conferir) |
| **Cai 2026** (PMID 42551866) | Experimento intrassujeito de laboratório: agachamento com carga em seis alturas de calcanhar (0 a 5 cm), em homens com dorsiflexão restrita | resumo | moderada | manter com ressalva | parcial | `assimetria_dorsiflexao` (fator elevacao_do_calcanhar); `inclinacao_tronco` (fator dorsiflexao_e_tronco, a conferir); `avanco_joelho` (fator dorsiflexao_e_elevacao_do_calcanhar); `variacao_profundidade` (fator elevacao_do_calcanhar) |
| **Cashman 2026** (PMID 42476040) | Revisão sistemática com metanálise parcial de 22 artigos sobre força do quadril e valgo em assintomáticos (busca em maio de 2026) | resumo | moderada | manter com ressalva | parcial | `valgo_dinamico` (fator forca_do_quadril) |
| **Cheatham 2018** (PMID 28290757) | Revisão sistemática (PRISMA) de 15 estudos sobre condições do quadril e desempenho no agachamento, graduados pela escala PEDro | resumo | moderada | manter com ressalva | parcial | `assimetria_flexao_quadril` (fator condicao_do_quadril) |
| **Constantinou 2014** (PMID 24450373) | Revisão sistemática com metanálise de 30 artigos sobre parâmetros espaço-temporais da marcha na osteoartrite de quadril | resumo | moderada | manter com ressalva | parcial | `assimetria_tempo_apoio` (fator dor_ou_doenca_articular_unilateral, a conferir) |
| **Corrigan 2023** (PMID 36305013) | Coorte prospectiva (Multicenter Osteoarthritis Study), análise exploratória de pessoas com dor unilateral leve a moderada no joelho, passarela GAITRite | texto completo (métodos e limitações) | moderada | manter com ressalva | parcial | `assimetria_tempo_apoio` (fator dor_ou_doenca_articular_unilateral) |
| **Creaby 2012** (PMID 22385873) | Coorte de laboratório com comparação entre grupos: osteoartrite medial do joelho unilateral ou bilateral e controles, marcha em 3D | resumo | moderada | manter com ressalva | parcial | `assimetria_flexao_joelho_marcha` (fator dor_ou_osteoartrite_joelho_quadril) |
| **Dill 2014** (PMID 25144599) | Estudo transversal de laboratório: dois grupos por dorsiflexão, em agachamento com braços elevados, agachamento unipodal e aterrissagem | resumo | moderada | manter com ressalva | parcial | `assimetria_flexao_joelho` (fator dorsiflexao_limitada, a conferir); `assimetria_dorsiflexao` (a conferir); `inclinacao_tronco` (a conferir); `avanco_joelho` (a conferir) |
| **Emamvirdi 2023** (PMID 37524846) | Estudo observacional transversal entre grupos (instabilidade crônica do tornozelo, dor patelofemoral e controles); agachamento unipodal em vídeo 2D | texto completo (métodos e limitações) | moderada | manter com ressalva | parcial | `assimetria_dorsiflexao` (fator dor_ou_instabilidade_tornozelo, a conferir); `valgo_dinamico` (fator dor_ou_lesao_previa, a conferir) |
| **Generoso 2025** (PMID 40391865) | Revisão sistemática com metanálise (6 estudos, 5 na metanálise) de agachamento em 3D antes e depois da cirurgia de impacto femoroacetabular | resumo | moderada | manter com ressalva | parcial | `assimetria_flexao_quadril` (fator condicao_do_quadril) |
| **Gomes 2020** (PMID 32022631) | Estudo correlacional transversal: profundidade do agachamento com barra (cinemática 2D), dorsiflexão (smartphone e dinamometria) e rigidez do tendão (elastografia) | resumo | moderada | manter com ressalva | parcial | `assimetria_flexao_quadril` (fator mobilidade_quadril_tornozelo); `assimetria_dorsiflexao` (fator tendao_calcaneo); `variacao_profundidade` (fator mobilidade_dorsiflexao_e_quadril) |
| **Haberkamp 2022** (PMID 36198251) | Estudo de validação: estimativa de pose 2D (OpenPose) frente a 3D e a análise 2D tradicional, em agachamento unipodal de adolescentes atletas | resumo | moderada | manter com ressalva | parcial | `valgo_dinamico` (fator projecao_2d) |
| **Hannan 2022** (PMID 36237648) | Estudo cruzado de laboratório: 20 agachamentos com peso do corpo em dois ritmos, sobre duas plataformas de força | texto completo (métodos e limitações) | moderada | manter com ressalva | parcial | `assimetria_flexao_joelho` (fator dominancia_do_membro); `desvio_lateral_pelve` (fator dominancia_do_membro) |
| **Harato 2008** (PMID 18585042) | Experimento intrassujeito: contratura de flexão do joelho simulada por órtese (15° e 30°) em 10 mulheres saudáveis, marcha em 3D | resumo | moderada | manter com ressalva | parcial | `inclinacao_tronco_marcha` (fator limitacao_de_extensao_do_joelho, a conferir) |
| **Hassan 2022** (PMID 35989174) | Caso-controle: teste de descida de degrau filmado, ângulo de projeção frontal por software (Kinovea) | resumo | moderada | manter com ressalva | parcial | `assimetria_dorsiflexao` (fator dor_ou_instabilidade_tornozelo); `valgo_dinamico` (fator mobilidade_tornozelo_pe) |
| **Iijima 2019** (PMID 30904334) | Revisão sistemática com metanálise de efeitos aleatórios: 32 artigos (2037 participantes) de tronco e quadril na marcha com osteoartrite de joelho | resumo | moderada | manter com ressalva | parcial | `inclinacao_tronco_marcha` (fator osteoartrite_de_joelho) |
| **Ishida 2023** (PMID 37441507) | Estudo transversal de laboratório (dois grupos pela simetria de força do quadríceps) em agachamento bipodal, mais de 1 ano após reconstrução do LCA | texto completo (métodos e limitações) | moderada | manter com ressalva | parcial | `assimetria_flexao_joelho` (fator quadriceps_pos_lca, a conferir); `desvio_lateral_pelve` (fator quadriceps_de_um_lado) |
| **Kernozek 2018** (PMID 28422563) | Experimento intrassujeito de laboratório com modelo musculoesquelético: agachamento com joelhos atrás ou além da ponta dos pés | resumo | moderada | manter com ressalva | parcial | `avanco_joelho` (fator instrucao_de_execucao, a conferir) |
| **Khamis 2017** (PMID 28600975) | Revisão sistemática (PRISMA) de 12 estudos: 4 de diferença anatômica de comprimento e 8 de diferença simulada com elevações de 1 a 5 cm | resumo | moderada | manter com ressalva | parcial | `assimetria_tempo_apoio` (fator comprimento_dos_membros, a conferir); `assimetria_flexao_joelho_marcha` (fator comprimento_dos_membros, a conferir); `assimetria_amplitude_quadril` (fator comprimento_dos_membros, a conferir) |
| **Kim 2015** (PMID 25964810) | Estudo transversal: amplitude de movimento e força relacionadas à profundidade do agachamento fotografada de lado, regressão por etapas | texto completo (métodos e limitações) | moderada | manter com ressalva | parcial | `assimetria_flexao_quadril` (fator mobilidade_quadril_tornozelo, a conferir); `variacao_profundidade` (fator mobilidade_dorsiflexao_e_quadril, a conferir) |
| **Leroux 2002** (PMID 11809582) | Experimento intrassujeito: esteira com inclinação de 0, 5 e 10% (subida e descida) em 8 adultos saudáveis, marcha em 3D | resumo | moderada | manter com ressalva | parcial | `inclinacao_tronco_marcha` (fator piso_inclinado, a conferir) |
| **List 2013** (PMID 22990570) | Experimento intrassujeito: agachamento com barra, restrito e livre, com cargas de 0, 25 e 50% do peso corporal, captura 3D com 12 câmeras | resumo | moderada | manter com ressalva | parcial | `avanco_joelho` (fator instrucao_de_execucao) |
| **Macrum 2011** (PMID 22100617) | Experimento intrassujeito de laboratório: agachamento bipodal com e sem cunha de 12° sob o antepé (o resumo o rotula como transversal) | resumo | moderada | manter com ressalva | parcial | `assimetria_flexao_joelho` (fator dorsiflexao_limitada); `valgo_dinamico` (fator mobilidade_tornozelo_pe) |
| **Miyasaka 2023** (PMID 37374309) | Estudo transversal: módulo de Young do tendão do calcâneo (elastografia) e dorsiflexão na profundidade máxima do agachamento, regressão múltipla | texto completo (métodos e limitações) | moderada | manter com ressalva | parcial | `assimetria_dorsiflexao` (fator tendao_calcaneo) |
| **Preece 2019** (PMID 31254772) | Caso-controle de laboratório: pessoas com osteoartrite de joelho e controles saudáveis, curvas inteiras por mapeamento paramétrico estatístico | resumo | moderada | manter com ressalva | parcial | `inclinacao_tronco_marcha` (fator osteoartrite_de_joelho, a conferir) |
| **Roos 2014** (PMID 24581172) | Estudo observacional transversal: ruptura do LCA, reconstrução e controles em agachamento bipodal até a profundidade máxima | texto completo (métodos e limitações) | moderada | manter com ressalva | parcial | `assimetria_flexao_joelho` (fator quadriceps_pos_lca); `desvio_lateral_pelve` (fator apoio_assimetrico_pos_lca) |
| **Song 2021** (PMID 34628200) | Estudo correlacional longitudinal curto: agachamento bipodal em atletas universitários em dois momentos (0 a 6 e 6 a 12 meses) após reconstrução do LCA | texto completo (métodos e limitações) | moderada | manter com ressalva | parcial | `desvio_lateral_pelve` (fator apoio_assimetrico_pos_lca, a conferir) |
| **Steingrebe 2023** (PMID 38046934) | Revisão sistemática com metanálise de efeitos aleatórios: 35 estudos de cinemática de pessoas com osteoartrite de quadril em tarefas de locomoção | texto completo (métodos e limitações) | alta | manter com ressalva | parcial | `assimetria_flexao_joelho_marcha` (fator dor_ou_osteoartrite_joelho_quadril); `assimetria_amplitude_quadril` (fator restricao_de_mobilidade_do_quadril) |
| **Strong 2023** (PMID 37853508) | Coorte longitudinal com controles: agachamento bipodal em três momentos após reconstrução do LCA (24 pessoas) e 29 controles, análise funcional de curvas | resumo | moderada | manter com ressalva | parcial | `desvio_lateral_pelve` (fator apoio_assimetrico_pos_lca, a conferir) |
| **Vermeulen 2023** (PMID 37181257) | Revisão sistemática (PRISMA 2020) de 21 estudos do efeito da fadiga sobre tronco e pelve na aterrissagem de saltos | texto completo (métodos e limitações) | alta | manter com ressalva | indireta | `tendencia_na_serie` (fator fadiga_muscular) |
| **Walker 2026** (PMID 42516619) | Estudo correlacional transversal: profundidade do agachamento unipodal (câmera única 3D), força do quadril (dinamômetro manual fixo) e dorsiflexão em carga | texto completo (métodos e limitações) | moderada | manter com ressalva | parcial | `variacao_profundidade` (fator mobilidade_dorsiflexao_e_quadril) |
| **Wyndow 2016** (PMID 26816531) | Estudo correlacional transversal: agachamento unipodal filmado em vídeo 2D, regressão com equações de estimativa generalizadas | texto completo (métodos e limitações) | moderada | manter com ressalva | parcial | `valgo_dinamico` (fator mobilidade_tornozelo_pe, a conferir) |
| **Barber-Westin 2017** (PMID 28298066) | Revisão sistemática (nível de evidência 4, segundo os autores) de 37 estudos de fadiga em saltos, aterrissagens e mudanças de direção | resumo | baixa | remover | indireta | removida |
| **Borrelli 2002** (PMID 11818800) | Série de casos consecutivos de 15 pacientes com fratura isolada de acetábulo, comparados com coortes sem lesão | resumo | baixa | remover | indireta | removida |
| **Cashman 2012** (PMID 22894982) | Revisão sistemática com síntese narrativa de 11 estudos de força do quadril e valgo em assintomáticos (busca em fevereiro de 2011) | resumo | moderada | remover | parcial | removida |
| **da Costa 2021** (PMID 33713896) | Estudo transversal de laboratório com amostra de conveniência: agachamento unipodal em 3D, dorsiflexão passiva em carga e dorsiflexão dinâmica | resumo | moderada | remover | indireta | removida |
| **Endo 2020** (PMID 32581431) | Estudo correlacional transversal: agachamento profundo com braços elevados em vídeo 2D de 30 quadros por segundo, regressão | texto completo (métodos e limitações) | baixa | remover | indireta | removida |
| **Fry 2003** (PMID 14636100) | Experimento intrassujeito: agachamento com barra, joelhos livres e restritos por uma barreira de madeira, em vídeo | resumo | baixa | remover | parcial | removida |
| **Fujita 2022** (PMID 36166956) | Estudo transversal exploratório: 38 pessoas com AVC crônico e joelho rígido, sensor inercial e eletromiografia, subgrupos por componente principal | resumo | baixa | remover | indireta | removida |
| **Honda 2022** (PMID 35193063) | Estudo transversal de laboratório: idosos e adultos jovens em agachamento profundo, 3D e plataformas de força | resumo | moderada | remover | indireta | removida |
| **Kerrigan 2001** (PMID 11239282) | Estudo transversal comparativo em laboratório: idosos saudáveis, idosos com quedas recorrentes e adultos jovens (3D optoeletrônico) | resumo | moderada | remover | indireta | removida |
| **Krajewski 2025** (PMID 39815400) | Revisão narrativa dos mecanismos do joelho rígido após AVC | texto completo (métodos e limitações) | baixa | remover | indireta | removida |
| **Lamontagne 2011** (PMID 21543687) | Série pré e pós-operatória de 10 pacientes com impacto femoroacetabular tipo came (nível IV), sem grupo controle | resumo | baixa | remover | indireta | removida |
| **Lugade 2010** (PMID 20542608) | Coorte comparando duas abordagens de artroplastia de quadril e controles, em 3D, antes e depois da cirurgia | resumo | moderada | remover | parcial | removida |
| **Mauntel 2013** (PMID 23096063) | Caso-controle de laboratório: agachamento unipodal, grupos definidos por deslocamento medial do joelho observado | resumo | baixa | remover | parcial | removida |
| **Mettler 2019** (PMID 29927892) | Antes e depois em um grupo, sem controle: programa de alongamento de 3 semanas em pessoas com extensão passiva do quadril limitada, avaliadas na corrida | resumo | baixa | remover | indireta | removida |
| **Murray 1985** (PMID 4042479) | Série de casos descritiva de 35 homens com incapacidade unilateral do joelho por dor (fotografia de luz interrompida) | resumo | baixa | remover | indireta | removida |
| **Seeley 2010** (PMID 24149783) | Estudo correlacional de laboratório: diferença leve de comprimento dos membros (radiografia) e coeficientes de simetria da marcha | resumo | baixa | remover | indireta | removida |
| **Staines 2026** (PMID 42107174) | Análise transversal com captura 3D (o registro do PubMed o lista como ensaio clínico randomizado, mas o resumo não descreve randomização) | resumo | moderada | remover | indireta | removida |
| **Tsutsumi 2026** (PMID 42804966) | Antes e depois sem controle: 24 pacientes avaliados antes e 1 ano depois da artroplastia total do joelho, 3D e eletromiografia | resumo | baixa | remover | parcial | removida |
| **Webster 2014** (PMID 24934927) | Caso-controle de laboratório (nível III): agachamento bipodal antes e depois de um protocolo de fadiga, em homens após reconstrução do LCA e controles | resumo | baixa | remover | parcial | removida |

### Itens avaliados: revisões sistemáticas

Resultado por item (Protocolo ou registro prévio, Busca abrangente, Risco de viés dos incluídos, Síntese adequada, Heterogeneidade tratada, Conflito de interesse declarado, e veículo). As notas de cada célula estão em `avaliacaoMetodologica.ts`.

| Fonte | Protocolo ou registro prévio | Busca abrangente | Risco de viés dos incluídos | Síntese adequada | Heterogeneidade tratada | Conflito de interesse declarado | Veículo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lima 2017 (PMID 28974358) | não avaliável | parcialmente | atende | atende | parcialmente | não avaliável | atende |
| Lopes 2018 (PMID 29895235) | não avaliável | atende | não avaliável | atende | parcialmente | não avaliável | atende |
| Alzahrani 2021 (PMID 34300118) | não atende | atende | atende | atende | atende | não avaliável | não avaliável |
| Cashman 2026 (PMID 42476040) | não avaliável | parcialmente | não avaliável | atende | parcialmente | não avaliável | atende |
| Cheatham 2018 (PMID 28290757) | não avaliável | atende | atende | parcialmente | parcialmente | não avaliável | atende |
| Constantinou 2014 (PMID 24450373) | não avaliável | atende | parcialmente | atende | não avaliável | não avaliável | atende |
| Generoso 2025 (PMID 40391865) | atende | parcialmente | atende | atende | não avaliável | não avaliável | atende |
| Iijima 2019 (PMID 30904334) | não avaliável | atende | não avaliável | atende | não avaliável | não avaliável | atende |
| Khamis 2017 (PMID 28600975) | não avaliável | parcialmente | atende | parcialmente | parcialmente | não avaliável | atende |
| Steingrebe 2023 (PMID 38046934) | atende | atende | atende | atende | atende | não avaliável | não avaliável |
| Vermeulen 2023 (PMID 37181257) | atende | atende | atende | atende | atende | não avaliável | não avaliável |
| Barber-Westin 2017 (PMID 28298066) | não avaliável | não atende | não avaliável | atende | atende | não avaliável | atende |
| Cashman 2012 (PMID 22894982) | não avaliável | parcialmente | não avaliável | atende | parcialmente | não avaliável | atende |
| Krajewski 2025 (PMID 39815400) | não atende | não atende | não atende | parcialmente | parcialmente | não avaliável | atende |

### Itens avaliados: estudos primários

| Fonte | Tamanho e justificativa da amostra | População descrita e adequada | Validade e confiabilidade da medida | Controle de confundidores | Desfecho definido | Comparações múltiplas | Veículo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Apti 2016 (PMID 27131202) | não avaliável | parcialmente | atende | parcialmente | atende | não avaliável | atende |
| Baker 2016 (PMID 26895694) | não avaliável | atende | parcialmente | não avaliável | atende | não avaliável | atende |
| Cai 2026 (PMID 42551866) | não avaliável | parcialmente | atende | parcialmente | parcialmente | parcialmente | atende |
| Corrigan 2023 (PMID 36305013) | parcialmente | atende | atende | atende | atende | não avaliável | atende |
| Creaby 2012 (PMID 22385873) | não avaliável | atende | atende | atende | parcialmente | não avaliável | atende |
| Dill 2014 (PMID 25144599) | não avaliável | atende | atende | não avaliável | parcialmente | não avaliável | atende |
| Emamvirdi 2023 (PMID 37524846) | parcialmente | parcialmente | atende | parcialmente | atende | parcialmente | atende |
| Gomes 2020 (PMID 32022631) | não avaliável | atende | atende | não avaliável | parcialmente | não avaliável | atende |
| Haberkamp 2022 (PMID 36198251) | não avaliável | parcialmente | atende | não avaliável | atende | parcialmente | atende |
| Hannan 2022 (PMID 36237648) | parcialmente | atende | atende | parcialmente | parcialmente | não avaliável | não avaliável |
| Harato 2008 (PMID 18585042) | parcialmente | parcialmente | atende | parcialmente | atende | não avaliável | atende |
| Hassan 2022 (PMID 35989174) | não avaliável | atende | parcialmente | não avaliável | atende | não avaliável | atende |
| Ishida 2023 (PMID 37441507) | parcialmente | atende | atende | parcialmente | atende | não avaliável | atende |
| Kernozek 2018 (PMID 28422563) | não avaliável | parcialmente | parcialmente | parcialmente | atende | não avaliável | atende |
| Kim 2015 (PMID 25964810) | parcialmente | parcialmente | parcialmente | parcialmente | atende | parcialmente | não avaliável |
| Leroux 2002 (PMID 11809582) | parcialmente | parcialmente | atende | parcialmente | atende | não avaliável | atende |
| List 2013 (PMID 22990570) | não avaliável | parcialmente | atende | parcialmente | parcialmente | não avaliável | atende |
| Macrum 2011 (PMID 22100617) | não avaliável | atende | atende | parcialmente | parcialmente | não avaliável | atende |
| Miyasaka 2023 (PMID 37374309) | atende | parcialmente | atende | parcialmente | atende | parcialmente | não avaliável |
| Preece 2019 (PMID 31254772) | não avaliável | atende | atende | não avaliável | atende | atende | atende |
| Roos 2014 (PMID 24581172) | atende | atende | atende | parcialmente | parcialmente | não avaliável | atende |
| Song 2021 (PMID 34628200) | atende | parcialmente | atende | não atende | atende | atende | atende |
| Strong 2023 (PMID 37853508) | não avaliável | parcialmente | atende | parcialmente | atende | parcialmente | atende |
| Walker 2026 (PMID 42516619) | atende | atende | parcialmente | parcialmente | atende | não avaliável | não avaliável |
| Wyndow 2016 (PMID 26816531) | parcialmente | atende | parcialmente | parcialmente | atende | parcialmente | atende |
| Borrelli 2002 (PMID 11818800) | parcialmente | parcialmente | atende | não atende | parcialmente | não atende | atende |
| da Costa 2021 (PMID 33713896) | não avaliável | atende | atende | não atende | parcialmente | não avaliável | atende |
| Endo 2020 (PMID 32581431) | não atende | parcialmente | parcialmente | não atende | parcialmente | não atende | não avaliável |
| Fry 2003 (PMID 14636100) | não atende | parcialmente | parcialmente | parcialmente | atende | não avaliável | atende |
| Fujita 2022 (PMID 36166956) | não avaliável | parcialmente | parcialmente | não avaliável | parcialmente | não avaliável | atende |
| Honda 2022 (PMID 35193063) | parcialmente | atende | atende | não atende | atende | não avaliável | atende |
| Kerrigan 2001 (PMID 11239282) | parcialmente | atende | atende | parcialmente | atende | não avaliável | atende |
| Lamontagne 2011 (PMID 21543687) | parcialmente | parcialmente | atende | não atende | parcialmente | não avaliável | atende |
| Lugade 2010 (PMID 20542608) | parcialmente | parcialmente | atende | parcialmente | parcialmente | não avaliável | atende |
| Mauntel 2013 (PMID 23096063) | não avaliável | parcialmente | parcialmente | não avaliável | não atende | parcialmente | atende |
| Mettler 2019 (PMID 29927892) | não avaliável | parcialmente | atende | não atende | atende | não avaliável | atende |
| Murray 1985 (PMID 4042479) | parcialmente | parcialmente | parcialmente | não atende | parcialmente | não avaliável | atende |
| Seeley 2010 (PMID 24149783) | parcialmente | atende | parcialmente | não avaliável | parcialmente | não avaliável | não avaliável |
| Staines 2026 (PMID 42107174) | não avaliável | parcialmente | atende | parcialmente | atende | não avaliável | atende |
| Tsutsumi 2026 (PMID 42804966) | não avaliável | atende | atende | não atende | parcialmente | não avaliável | atende |
| Webster 2014 (PMID 24934927) | parcialmente | parcialmente | atende | parcialmente | atende | não avaliável | atende |

### Ficha de cada fonte

Limitações, aplicabilidade e justificativa por PMID. A ficha das removidas diz por que saíram.

#### Lima 2017 — PMID 28974358 — manter (qualidade moderada)

- **Desenho:** Revisão sistemática com metanálise de 17 estudos que comparam a dorsiflexão de pessoas com e sem valgo dinâmico do joelho.
- **Aplicabilidade (direta):** Responde à relação entre a dorsiflexão e o valgo dinâmico, que é a hipótese do fator; as tarefas variam entre os estudos.
- **Itens com nota:**
  - Protocolo ou registro prévio (não avaliável)
  - Busca abrangente (parcialmente): MEDLINE, EMBASE, CINAHL e SPORTDiscus; seleção em duplicata não consta no resumo
  - Risco de viés dos incluídos (atende): lista de Downs e Black modificada
  - Síntese adequada (atende): metanálise de diferenças padronizadas, com análise por tipo de medida da dorsiflexão
  - Heterogeneidade tratada (parcialmente): análise por subgrupo; a heterogeneidade não consta no resumo
  - Conflito de interesse declarado (não avaliável)
- **Limitações:**
  - Compara pessoas com e sem valgo dinâmico (desenho transversal): não mostra direção de causa.
  - O resumo não informa registro de protocolo, heterogeneidade nem como cada estudo classificou o valgo.
- **Justificativa:** Revisão com metanálise e risco de viés que responde direto à relação entre dorsiflexão e valgo; moderada por itens não avaliáveis pelo resumo.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 17 estudos que comparam pessoas com e sem valgo dinâmico; transversal; o resumo não informa registro nem heterogeneidade.

#### Lopes 2018 — PMID 29895235 — manter (qualidade moderada)

- **Desenho:** Revisão sistemática com metanálise de 16 estudos de confiabilidade e validade da análise 2D do plano frontal (agachamento, aterrissagem, corte).
- **Aplicabilidade (direta):** Trata da validade e da confiabilidade da análise 2D do plano frontal, que é o limite do vídeo do app.
- **Itens com nota:**
  - Protocolo ou registro prévio (não avaliável)
  - Busca abrangente (atende): MEDLINE, CINAHL, Embase, Scopus e SPORTDiscus até mar/2017
  - Risco de viés dos incluídos (não avaliável): não mencionado no resumo
  - Síntese adequada (atende): metanálise de confiabilidade e de validade, separada por tarefa
  - Heterogeneidade tratada (parcialmente): resultados separados por tarefa e por tipo de confiabilidade
  - Conflito de interesse declarado (não avaliável)
- **Limitações:**
  - O resumo não informa registro de protocolo nem avaliação do risco de viés.
  - Concordância 2D e 3D fraca no agachamento unipodal (r = 0,127) e moderada a boa na aterrissagem.
  - Compara câmeras 2D convencionais com 3D, não estimativa de pose por software.
- **Justificativa:** Pergunta idêntica ao limite do app (validade do 2D frente ao 3D), com busca em cinco bases e metanálise por tarefa; mantida e usada para limitar a afirmação.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: Revisão de 16 estudos sobre vídeo 2D e 3D; o resumo não informa registro de protocolo nem risco de viés.

#### Alzahrani 2021 — PMID 34300118 — manter com ressalva (qualidade moderada)

- **Desenho:** Revisão sistemática qualitativa de 7 estudos observacionais com análise de movimento 2D em adultos saudáveis.
- **Aplicabilidade (parcial):** Mesma medida 2D de projeção frontal do app, mas em adultos saudáveis e tarefas unipodais.
- **Itens com nota:**
  - Protocolo ou registro prévio (não atende): segue o PRISMA-P na estratégia, mas não informa registro do protocolo
  - Busca abrangente (atende): MEDLINE, PubMed, CINAHL e SPORTDiscus (jul/2018, atualizada em out/2020); dois revisores independentes; só inglês
  - Risco de viés dos incluídos (atende): lista do JBI por dois autores; estudos transversais com 5 a 7 de 8
  - Síntese adequada (atende): narrativa, sem metanálise
  - Heterogeneidade tratada (atende): discute tarefas, sexo, métodos de força e tamanho de amostra
  - Conflito de interesse declarado (não avaliável)
  - Veículo (auxiliar) (não avaliável)
- **Limitações:**
  - Sete estudos transversais; só três controlaram confundidores e a maioria não calculou o tamanho da amostra.
  - Tarefas diferentes (agachamento unipodal, descida de degrau, avanço) e força isométrica, não excêntrica.
  - Exclui artigos que não estão em inglês; poucos estudos elegíveis.
- **Justificativa:** Busca em várias bases, dois revisores e risco de viés pela lista do JBI, centrada em medida 2D; sem registro de protocolo e com estudos primários frágeis.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: Sete estudos transversais em adultos saudáveis, com pouco controle de confundidores; resultado conflitante entre os estudos.

#### Apti 2016 — PMID 27131202 — manter com ressalva (qualidade moderada)

- **Desenho:** Antes e depois com controle externo: fraqueza experimental dos flexores plantares por alongamento passivo, 3D, 20 adultos e 7 controles.
- **Aplicabilidade (parcial):** Pico de flexão do joelho no balanço, que o app mede, mas com fraqueza induzida em adultos saudáveis.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): 20 adultos e 7 controles; sem justificativa no resumo
  - População descrita e adequada (parcialmente): adultos jovens saudáveis; fraqueza induzida
  - Validade e confiabilidade da medida (atende): 3D e dinamômetro manual
  - Controle de confundidores (parcialmente): sete controles pareados por idade para separar o efeito da marcha lenta
  - Desfecho definido (atende): quatro parâmetros do padrão de joelho rígido
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - Fraqueza induzida de forma aguda por alongamento passivo, não fraqueza crônica; o alongamento pode alterar outras propriedades do músculo.
  - Sem randomização nem cegamento descritos; título e conclusão em linguagem causal.
  - Adultos jovens saudáveis; não compara os lados.
- **Justificativa:** Manipulação com medida 3D e controles para a marcha lenta; o efeito agudo da fraqueza induzida não representa fraqueza crônica.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 20 adultos jovens saudáveis com fraqueza induzida por alongamento passivo e 7 controles; efeito agudo, não fraqueza crônica; não compara os lados.

#### Baker 2016 — PMID 26895694 — manter com ressalva (qualidade moderada)

- **Desenho:** Estudo transversal de três grupos (osteoartrite de quadril moderada, grave e assintomáticos): extensão passiva por goniometria e dinâmica na esteira.
- **Aplicabilidade (parcial):** Relaciona a mobilidade passiva com a da marcha, que a hipótese usa, mas só em osteoartrite de quadril.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): o resumo não informa o número de participantes por grupo
  - População descrita e adequada (atende): osteoartrite de quadril moderada e grave e grupo assintomático
  - Validade e confiabilidade da medida (parcialmente): goniometria padronizada para a passiva e marcadores na pele na esteira para a dinâmica; confiabilidade não consta no resumo
  - Controle de confundidores (não avaliável)
  - Desfecho definido (atende): extensão, flexão e amplitude passiva e dinâmica
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - O número de participantes não consta no resumo.
  - A relação entre a extensão passiva e a da marcha aparece só nos grupos com osteoartrite (r de 0,59), não no assintomático (r de 0,139).
  - Marcha em esteira com marcadores na pele.
- **Justificativa:** Mede a relação entre a mobilidade passiva e a da marcha, que a hipótese usa; amostra não avaliável pelo resumo, por isso moderada provisória.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: Osteoartrite de quadril moderada e grave; sem relação no grupo assintomático; número de participantes não consta no resumo.

#### Cai 2026 — PMID 42551866 — manter com ressalva (qualidade moderada)

- **Desenho:** Experimento intrassujeito de laboratório: agachamento com carga em seis alturas de calcanhar (0 a 5 cm), em homens com dorsiflexão restrita.
- **Aplicabilidade (parcial):** Efeito da elevação do calcanhar sobre dorsiflexão, tronco e joelho, mas com carga, 3D e elevação igual nos dois pés.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): 30 homens; sem cálculo amostral no resumo
  - População descrita e adequada (parcialmente): homens saudáveis com dorsiflexão restrita; sem grupo com dorsiflexão não restrita
  - Validade e confiabilidade da medida (atende): 3D, plataformas de força, eletromiografia e análise por elementos finitos
  - Controle de confundidores (parcialmente): cada pessoa nas seis alturas; ordem não descrita no resumo
  - Desfecho definido (parcialmente): muitos desfechos, sem desfecho primário
  - Comparações múltiplas (parcialmente): SPM1D nas curvas de momento; os demais desfechos sem correção descrita
- **Limitações:**
  - Só homens com dorsiflexão restrita; sem comparação com quem não tem restrição.
  - Agachamento com carga e elevação igual nos dois pés, não diferença de apoio entre os lados.
  - Artigo em versão antecipada (sem volume) de 2026.
- **Justificativa:** Manipulação controlada na mesma pessoa, com 3D e curvas inteiras; é a única fonte retida que testa a elevação do calcanhar.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 30 homens saudáveis com dorsiflexão restrita, com carga e 3D; sem comparação com quem não tem restrição e sem teste de apoio diferente entre os lados.

#### Cashman 2026 — PMID 42476040 — manter com ressalva (qualidade moderada)

- **Desenho:** Revisão sistemática com metanálise parcial de 22 artigos sobre força do quadril e valgo em assintomáticos (busca em maio de 2026).
- **Aplicabilidade (parcial):** Adultos assintomáticos e cinemática de uma ou várias câmeras; força medida por dinamometria, não por vídeo.
- **Itens com nota:**
  - Protocolo ou registro prévio (não avaliável)
  - Busca abrangente (parcialmente): Medline, EMBASE, CINAHL e Google Scholar (mai/2026); seleção em duplicata não descrita no resumo
  - Risco de viés dos incluídos (não avaliável): não mencionado no resumo
  - Síntese adequada (atende): metanálise parcial sem significância e conclusão cautelosa
  - Heterogeneidade tratada (parcialmente): agrupa os estudos por desfecho; a heterogeneidade não consta no resumo
  - Conflito de interesse declarado (não avaliável)
- **Limitações:**
  - O resumo não informa registro de protocolo, risco de viés nem seleção em duplicata.
  - Estudos de adultos assintomáticos, em sua maioria por correlação.
- **Justificativa:** Revisão mais recente e ampla sobre força do quadril e valgo; itens críticos não avaliáveis pelo resumo, por isso moderada e usada só para limitar a hipótese.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 22 estudos em assintomáticos sem metanálise significativa; o resumo não informa registro de protocolo nem risco de viés.

#### Cheatham 2018 — PMID 28290757 — manter com ressalva (qualidade moderada)

- **Desenho:** Revisão sistemática (PRISMA) de 15 estudos sobre condições do quadril e desempenho no agachamento, graduados pela escala PEDro.
- **Aplicabilidade (parcial):** Condições do quadril e agachamento em geral; usada para o fator inconclusivo do quadril, ao lado da metanálise pós-operatória.
- **Itens com nota:**
  - Protocolo ou registro prévio (não avaliável)
  - Busca abrangente (atende): PubMed, CINAHL, SPORTDiscus, ProQuest e Google Scholar (out/2016)
  - Risco de viés dos incluídos (atende): escala PEDro
  - Síntese adequada (parcialmente): síntese narrativa de estudos muito diferentes (barra, descida de degrau, agachamento bipodal e unipodal)
  - Heterogeneidade tratada (parcialmente): reconhece que o tema é pouco investigado
  - Conflito de interesse declarado (não avaliável)
- **Limitações:**
  - Quinze estudos heterogêneos (barra, descida de degrau, bilateral e unipodal) e 542 participantes.
  - O desempenho no agachamento é definido de formas diferentes, e o resumo não detalha a direção do efeito.
  - Busca de outubro de 2016; o resumo não informa registro do protocolo.
- **Justificativa:** Revisão com PRISMA, cinco bases e escala PEDro que mostra o impacto femoroacetabular associado ao agachamento; usada para o fator inconclusivo do quadril.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 15 estudos heterogêneos sobre condições do quadril e desempenho no agachamento; o resumo não detalha a direção dos efeitos nem informa registro.

#### Constantinou 2014 — PMID 24450373 — manter com ressalva (qualidade moderada)

- **Desenho:** Revisão sistemática com metanálise de 30 artigos sobre parâmetros espaço-temporais da marcha na osteoartrite de quadril.
- **Aplicabilidade (parcial):** Duração do apoio entre os membros, a mesma variável do app, mas em população com osteoartrite de quadril.
- **Itens com nota:**
  - Protocolo ou registro prévio (não avaliável)
  - Busca abrangente (atende): onze bases eletrônicas
  - Risco de viés dos incluídos (parcialmente): avaliação crítica da qualidade metodológica, sem instrumento nomeado no resumo
  - Síntese adequada (atende): metanálise com tamanhos de efeito (d de Cohen) e intervalos de confiança
  - Heterogeneidade tratada (não avaliável)
  - Conflito de interesse declarado (não avaliável)
- **Limitações:**
  - População com osteoartrite de quadril.
  - O resumo não informa registro de protocolo, instrumento de qualidade nem heterogeneidade.
- **Justificativa:** Revisão com metanálise e onze bases, na variável do achado (duração do apoio entre os membros); população com doença e itens não avaliáveis pelo resumo.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 30 artigos de osteoartrite de quadril; o resumo não informa registro, instrumento de qualidade nem heterogeneidade.

#### Corrigan 2023 — PMID 36305013 — manter com ressalva (qualidade moderada)

- **Desenho:** Coorte prospectiva (Multicenter Osteoarthritis Study), análise exploratória de pessoas com dor unilateral leve a moderada no joelho, passarela GAITRite.
- **Aplicabilidade (parcial):** Mesma variável (assimetria do tempo de apoio) em dor unilateral no joelho, medida por passarela e não por vídeo.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (parcialmente): 105 elegíveis para a análise longitudinal; análise de sensibilidade com 84, com baixo poder segundo os autores
  - População descrita e adequada (atende): coorte MOST com dor unilateral leve a moderada, critérios de exclusão descritos
  - Validade e confiabilidade da medida (atende): passarela GAITRite com confiabilidade (ICC de 0,89 ou mais) citada
  - Controle de confundidores (atende): ajuste por idade, sexo, massa, raça, depressão, velocidade e grau radiográfico
  - Desfecho definido (atende): dor incidente no joelho contralateral e dor persistente no ipsilateral
  - Comparações múltiplas (não avaliável): análise exploratória; correção não identificada no texto lido
- **Limitações:**
  - Análise exploratória, só com dor leve a moderada; dois anos podem não bastar para o efeito da marcha.
  - Medidas de tempo não substituem a carga articular.
- **Justificativa:** Coorte com ajuste de confundidores e medida de tempo validada; o resultado misto precisa constar no fator.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: Coorte exploratória de dor unilateral leve a moderada no joelho, com passarela de tempo e não vídeo; a gravidade da dor não se associou à assimetria.

#### Creaby 2012 — PMID 22385873 — manter com ressalva (qualidade moderada)

- **Desenho:** Coorte de laboratório com comparação entre grupos: osteoartrite medial do joelho unilateral ou bilateral e controles, marcha em 3D.
- **Aplicabilidade (parcial):** Diferença entre os joelhos na flexão e inclinação do tronco, mas em osteoartrite medial e por 3D.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): 91 com osteoartrite e 31 controles; sem cálculo amostral no resumo
  - População descrita e adequada (atende): osteoartrite medial do joelho uni ou bilateral e controles assintomáticos
  - Validade e confiabilidade da medida (atende): 3D e plataformas de força
  - Controle de confundidores (atende): ajuste pela velocidade de marcha
  - Desfecho definido (parcialmente): vários desfechos de cinemática e cinética
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - Osteoartrite medial do joelho.
  - O pico de flexão do joelho é calculado no ciclo; o resumo não separa apoio de balanço.
- **Justificativa:** Amostra grande, ajuste pela velocidade e comparação entre os joelhos; população com osteoartrite e fase do pico não especificada.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 91 pessoas com osteoartrite medial do joelho e 31 controles; medida 3D; o resumo não separa o pico de flexão do apoio do de balanço.

#### Dill 2014 — PMID 25144599 — manter com ressalva (qualidade moderada)

- **Desenho:** Estudo transversal de laboratório: dois grupos por dorsiflexão, em agachamento com braços elevados, agachamento unipodal e aterrissagem.
- **Aplicabilidade (parcial):** Inclui agachamento bipodal com braços elevados, mas com medida 3D e adultos ativos.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): 40 adultos (20 e 20); sem cálculo amostral no resumo
  - População descrita e adequada (atende): adultos fisicamente ativos
  - Validade e confiabilidade da medida (atende): cinemática 3D; dorsiflexão em carga e sem carga
  - Controle de confundidores (não avaliável)
  - Desfecho definido (parcialmente): vários desfechos em três tarefas, sem desfecho primário
  - Comparações múltiplas (não avaliável): ANOVAs separadas; correção não descrita no resumo
- **Limitações:**
  - O corte entre dorsiflexão limitada e não limitada não consta no resumo.
  - Associações em adultos ativos e sem lesão; não mostram causa.
  - O resumo sugere melhorar a dorsiflexão para alterar padrões de risco, o que o desenho não testou.
  - Texto completo indexado no PubMed Central, mas não devolvido pela ferramenta: avaliada só pelo resumo.
- **Justificativa:** Compara a medida em carga e a passiva na mesma amostra, com agachamento bipodal e 3D; fica com ressalva por amostra não justificada e itens não avaliáveis pelo resumo.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 40 adultos ativos comparados pela dorsiflexão em carga, com medida 3D; a dorsiflexão passiva sem carga não diferenciou os grupos.

#### Emamvirdi 2023 — PMID 37524846 — manter com ressalva (qualidade moderada)

- **Desenho:** Estudo observacional transversal entre grupos (instabilidade crônica do tornozelo, dor patelofemoral e controles); agachamento unipodal em vídeo 2D.
- **Aplicabilidade (parcial):** Medida 2D do valgo, como no app, e dorsiflexão em carga, mas em agachamento unipodal de atletas com instabilidade de tornozelo ou dor patelofemoral.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (parcialmente): 60 atletas (20 por grupo) com G*Power; os autores apontam efeito pequeno e poder limitado
  - População descrita e adequada (parcialmente): atletas recreacionais de basquete do sexo feminino, critérios descritos; não generaliza
  - Validade e confiabilidade da medida (atende): ângulo de valgo por vídeo 2D com ICC de 0,92 do examinador; dorsiflexão em carga
  - Controle de confundidores (parcialmente): avaliador cego ao grupo; sem ajuste estatístico descrito
  - Desfecho definido (atende): ângulo de valgo no pico de flexão e índice de assimetria
  - Comparações múltiplas (parcialmente): pós-teste de Scheffé
- **Limitações:**
  - Transversal: não mostra se a menor dorsiflexão antecede a dor ou a acompanha.
  - Só mulheres atletas recreacionais; cálculo amostral com efeito pequeno.
  - Ângulo medido em vídeo 2D, com o pico de flexão escolhido visualmente.
- **Justificativa:** Medida 2D igual à do app, avaliador cego e cálculo amostral; fica com ressalva pela população específica e pelo desenho transversal.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 60 atletas de basquete (mulheres) com instabilidade de tornozelo, dor patelofemoral ou sem queixa; estudo transversal, sem direção do efeito.

#### Generoso 2025 — PMID 40391865 — manter com ressalva (qualidade moderada)

- **Desenho:** Revisão sistemática com metanálise (6 estudos, 5 na metanálise) de agachamento em 3D antes e depois da cirurgia de impacto femoroacetabular.
- **Aplicabilidade (parcial):** Agachamento após cirurgia do quadril em pacientes com impacto; serve para dizer que a evidência sobre a flexão do quadril é inconclusiva.
- **Itens com nota:**
  - Protocolo ou registro prévio (atende): PROSPERO CRD42023473974
  - Busca abrangente (parcialmente): "múltiplas bases" sem lista no resumo; segue o PRISMA
  - Risco de viés dos incluídos (atende): escala MINORS; qualidade global moderada
  - Síntese adequada (atende): metanálise em 5 dos 6 estudos
  - Heterogeneidade tratada (não avaliável): não consta no resumo
  - Conflito de interesse declarado (não avaliável)
- **Limitações:**
  - Seis estudos (cinco na metanálise), todos de cirurgia por impacto femoroacetabular e com 3D.
  - Qualidade dos estudos incluídos moderada pela MINORS.
  - Resultado nulo: não mostra diferença cinemática, só que o assunto é inconclusivo.
- **Justificativa:** Revisão registrada, com avaliação de qualidade e metanálise; usada só para dizer que a evidência é inconclusiva.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 6 estudos de pacientes operados por impacto femoroacetabular, com 3D e qualidade moderada pela MINORS; sem diferença cinemática significativa.

#### Gomes 2020 — PMID 32022631 — manter com ressalva (qualidade moderada)

- **Desenho:** Estudo correlacional transversal: profundidade do agachamento com barra (cinemática 2D), dorsiflexão (smartphone e dinamometria) e rigidez do tendão (elastografia).
- **Aplicabilidade (parcial):** Profundidade em vídeo 2D, mas com barra e em adultos saudáveis.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): 20 adultos; sem cálculo amostral no resumo
  - População descrita e adequada (atende): adultos saudáveis
  - Validade e confiabilidade da medida (atende): cinemática 2D da profundidade, goniometria por smartphone, dinamometria isocinética, elastografia e ultrassom
  - Controle de confundidores (não avaliável)
  - Desfecho definido (parcialmente): vários desfechos (flexibilidade, rigidez e profundidade)
  - Comparações múltiplas (não avaliável): várias correlações; correção não descrita no resumo
- **Limitações:**
  - 20 adultos e muitas correlações; só uma foi significativa para a profundidade (teste de avanço, r = 0,69).
  - Agachamento com barra, não agachamento bipodal sem carga.
  - Confiabilidade da medida 2D da profundidade não consta no resumo.
- **Justificativa:** Combina medida 2D e várias propriedades do tornozelo, e traz um resultado que limita a hipótese do tendão; amostra pequena e correlações múltiplas pedem ressalva.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 20 adultos saudáveis; muitas correlações e só a dorsiflexão no teste de avanço se associou à profundidade; agachamento com barra.

#### Haberkamp 2022 — PMID 36198251 — manter com ressalva (qualidade moderada)

- **Desenho:** Estudo de validação: estimativa de pose 2D (OpenPose) frente a 3D e a análise 2D tradicional, em agachamento unipodal de adolescentes atletas.
- **Aplicabilidade (parcial):** Valida a mesma tecnologia do app (estimativa de pose 2D), mas em adolescentes e em agachamento unipodal.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): o resumo não informa o número de atletas
  - População descrita e adequada (parcialmente): atletas adolescentes
  - Validade e confiabilidade da medida (atende): comparação com 3D de referência, curvas por SPM e correlação de Pearson
  - Controle de confundidores (não avaliável)
  - Desfecho definido (atende): ângulos sagitais e frontais ao longo do agachamento e no pico de flexão
  - Comparações múltiplas (parcialmente): SPM nas curvas; correlações sem correção descrita
- **Limitações:**
  - Adolescentes atletas em agachamento unipodal; o resumo não informa o número de participantes.
  - Concordância fraca do ângulo frontal do joelho com o 3D (r = 0,20), igual à do 2D tradicional (r = 0,05).
- **Justificativa:** Valida a mesma tecnologia do app frente ao 3D: concordância moderada a forte nos ângulos sagitais e fraca no ângulo frontal do joelho; usada para limitar a afirmação.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: Validação de estimativa de pose 2D em adolescentes no agachamento unipodal; o número de participantes não consta no resumo.

#### Hannan 2022 — PMID 36237648 — manter com ressalva (qualidade moderada)

- **Desenho:** Estudo cruzado de laboratório: 20 agachamentos com peso do corpo em dois ritmos, sobre duas plataformas de força.
- **Aplicabilidade (parcial):** Agachamento bipodal com diferença entre os lados, mas em variáveis de força e não de ângulo.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (parcialmente): 18 adultos; os autores informam poder de 0,84 para efeito de 0,15
  - População descrita e adequada (atende): adultos jovens fisicamente ativos (10 mulheres)
  - Validade e confiabilidade da medida (atende): duas plataformas de força
  - Controle de confundidores (parcialmente): ordem dos ritmos randomizada; definição do membro preferido não consta no resumo
  - Desfecho definido (parcialmente): quatro variáveis de força e de centro de pressão
  - Comparações múltiplas (não avaliável)
  - Veículo (auxiliar) (não avaliável)
- **Limitações:**
  - Mede força de reação do solo e centro de pressão, não ângulos.
  - Adultos jovens ativos; o efeito da modalidade esportiva não foi controlado.
- **Justificativa:** Desenho cruzado com ordem randomizada e plataformas de força, em agachamento bipodal; serve só como lembrete de que há diferença entre os lados sem condição clínica.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 18 adultos ativos; diferença entre as pernas em força de reação do solo e centro de pressão, e não em ângulo.

#### Harato 2008 — PMID 18585042 — manter com ressalva (qualidade moderada)

- **Desenho:** Experimento intrassujeito: contratura de flexão do joelho simulada por órtese (15° e 30°) em 10 mulheres saudáveis, marcha em 3D.
- **Aplicabilidade (parcial):** Inclinação anterior do tronco na marcha, que o app mede, mas com contratura simulada em mulheres saudáveis.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (parcialmente): 10 mulheres; justificativa não consta no resumo
  - População descrita e adequada (parcialmente): mulheres saudáveis de cerca de 62 anos; contratura simulada
  - Validade e confiabilidade da medida (atende): 3D com cinco câmeras e plataforma de força
  - Controle de confundidores (parcialmente): cada pessoa é o próprio controle; ordem não descrita
  - Desfecho definido (atende): cinemática 3D do tronco e da pelve
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - 10 mulheres; contratura simulada por órtese não equivale a uma contratura real.
  - Só a contratura de 30° alterou o tronco; a de 15° não.
  - A conclusão do resumo (desequilíbrio da coluna e síndrome joelho-coluna) passa do que foi medido.
- **Justificativa:** Manipulação controlada na mesma pessoa e 3D; amostra pequena, contratura simulada e conclusão além do medido pedem ressalva.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 10 mulheres saudáveis com contratura de flexão do joelho simulada por órtese; só a contratura de 30° alterou o tronco.

#### Hassan 2022 — PMID 35989174 — manter com ressalva (qualidade moderada)

- **Desenho:** Caso-controle: teste de descida de degrau filmado, ângulo de projeção frontal por software (Kinovea).
- **Aplicabilidade (parcial):** Mesma medida 2D de projeção frontal do app, mas em descida de degrau.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): 70 e 70; sem cálculo amostral no resumo
  - População descrita e adequada (atende): adultos com dor patelofemoral e controles assintomáticos
  - Validade e confiabilidade da medida (parcialmente): ângulo 2D por software e dorsiflexão por inclinômetro; confiabilidade não consta no resumo
  - Controle de confundidores (não avaliável)
  - Desfecho definido (atende): ângulo de projeção frontal e dorsiflexão com o joelho flexionado e estendido
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - A correlação entre o ângulo de projeção frontal e a dorsiflexão não foi significativa em nenhum dos grupos.
  - O resumo conclui que a menor dorsiflexão pode contribuir para o desenvolvimento da dor, o que um caso-controle transversal não testou.
  - Teste de descida de degrau, não agachamento.
- **Justificativa:** Amostra grande e medida 2D igual à do app; fica como evidência que não confirma a relação, e a conclusão do resumo é descartada por ir além dos dados.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 70 pessoas com dor patelofemoral e 70 assintomáticas em descida de degrau; o ângulo frontal não se correlacionou com a dorsiflexão.

#### Iijima 2019 — PMID 30904334 — manter com ressalva (qualidade moderada)

- **Desenho:** Revisão sistemática com metanálise de efeitos aleatórios: 32 artigos (2037 participantes) de tronco e quadril na marcha com osteoartrite de joelho.
- **Aplicabilidade (parcial):** Tronco na marcha com osteoartrite de joelho, mas o efeito claro é lateral e o app mede a inclinação sagital.
- **Itens com nota:**
  - Protocolo ou registro prévio (não avaliável)
  - Busca abrangente (atende): PubMed, PEDro, CINAHL e Cochrane CENTRAL até mai/2018
  - Risco de viés dos incluídos (não avaliável): não consta no resumo; o GRADE foi aplicado
  - Síntese adequada (atende): metanálise de efeitos aleatórios com diferenças padronizadas
  - Heterogeneidade tratada (não avaliável)
  - Conflito de interesse declarado (não avaliável)
- **Limitações:**
  - O GRADE classificou todas as medidas como de certeza muito baixa.
  - O aumento claro foi na inclinação lateral do tronco; a flexão do tronco e da pelve no plano sagital não foi significativa.
  - Medida 3D de pessoas com osteoartrite de joelho.
- **Justificativa:** Revisão com metanálise e GRADE aplicado; usada principalmente para registrar que o efeito sagital não é claro.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 32 artigos com certeza muito baixa pelo GRADE em todas as medidas; o aumento claro foi lateral, não sagital.

#### Ishida 2023 — PMID 37441507 — manter com ressalva (qualidade moderada)

- **Desenho:** Estudo transversal de laboratório (dois grupos pela simetria de força do quadríceps) em agachamento bipodal, mais de 1 ano após reconstrução do LCA.
- **Aplicabilidade (parcial):** Agachamento bipodal, como no app, mas em pessoas após reconstrução do LCA e com desfecho em momento articular.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (parcialmente): 26 participantes, com cálculo prévio de 20; grupo de quadríceps fraco com 8
  - População descrita e adequada (atende): mais de 1 ano após reconstrução primária do LCA, critérios descritos
  - Validade e confiabilidade da medida (atende): análise 3D e dinamometria isocinética
  - Controle de confundidores (parcialmente): tempo desde a lesão ausente; efeito do tipo de enxerto não analisado por poucos casos
  - Desfecho definido (atende): pico do momento extensor do joelho e razões do momento de apoio
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - Transversal: a causa não pode ser determinada.
  - Grupo de quadríceps fraco com 8 pessoas; atividade muscular não avaliada.
  - Mede momentos articulares, não ângulos.
- **Justificativa:** Cálculo amostral prévio, 3D e agachamento bipodal; fica com ressalva pela população pós-LCA, pelo grupo pequeno e por medir momentos.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 26 pessoas com mais de 1 ano após reconstrução do ligamento cruzado anterior; desfecho em momento articular e não em ângulo; grupo de força baixa com 8 pessoas.

#### Kernozek 2018 — PMID 28422563 — manter com ressalva (qualidade moderada)

- **Desenho:** Experimento intrassujeito de laboratório com modelo musculoesquelético: agachamento com joelhos atrás ou além da ponta dos pés.
- **Aplicabilidade (parcial):** Registra o debate sobre o avanço do joelho; medida modelada em mulheres saudáveis.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): 25 mulheres; sem cálculo amostral no resumo
  - População descrita e adequada (parcialmente): mulheres saudáveis de cerca de 23 anos; a conclusão fala em dor patelofemoral
  - Validade e confiabilidade da medida (parcialmente): 3D e cinética, mas o estresse patelofemoral é estimado por modelo, não medido
  - Controle de confundidores (parcialmente): mesma pessoa nas duas técnicas
  - Desfecho definido (atende): estresse e força de reação patelofemorais estimados
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - Estresse estimado por modelo, sem validação descrita no resumo.
  - Mulheres saudáveis; a conclusão sobre dor patelofemoral é extrapolação.
- **Justificativa:** Mesma pessoa nas duas técnicas e 3D; a estimativa por modelo e a extrapolação para dor patelofemoral pedem ressalva. Registra o debate, sem limite.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 25 mulheres saudáveis; estresse patelofemoral estimado por modelo e não medido.

#### Khamis 2017 — PMID 28600975 — manter com ressalva (qualidade moderada)

- **Desenho:** Revisão sistemática (PRISMA) de 12 estudos: 4 de diferença anatômica de comprimento e 8 de diferença simulada com elevações de 1 a 5 cm.
- **Aplicabilidade (parcial):** Diferença de comprimento e desvios da marcha, sem desfecho específico para cada achado do app.
- **Itens com nota:**
  - Protocolo ou registro prévio (não avaliável): segue o PRISMA; registro não consta no resumo
  - Busca abrangente (parcialmente): Medline, CINAHL e EMBASE; seleção em duplicata não descrita no resumo
  - Risco de viés dos incluídos (atende): escala MINORS
  - Síntese adequada (parcialmente): agrupa diferença anatômica e simulada, que respondem perguntas diferentes
  - Heterogeneidade tratada (parcialmente): separa os dois tipos de estudo; não quantifica
  - Conflito de interesse declarado (não avaliável)
- **Limitações:**
  - Doze estudos, oito deles com diferença simulada por elevações em pessoas saudáveis.
  - O resumo não detalha em quais desfechos (ângulos, tempos ou forças) aparecem os desvios.
  - Diferença simulada não equivale a diferença anatômica.
- **Justificativa:** Revisão com PRISMA e MINORS que cobre o fator; resumo sem desfechos específicos e metade simulada, o que a ressalva declara.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 12 estudos, 8 deles com diferença simulada por elevações em pessoas saudáveis; o resumo não detalha os desfechos.

#### Kim 2015 — PMID 25964810 — manter com ressalva (qualidade moderada)

- **Desenho:** Estudo transversal: amplitude de movimento e força relacionadas à profundidade do agachamento fotografada de lado, regressão por etapas.
- **Aplicabilidade (parcial):** Profundidade medida em imagem 2D no plano sagital, como no app, mas é profundidade e não o ângulo do quadril nem a assimetria.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (parcialmente): 101 voluntários de conveniência; cálculo amostral não identificado
  - População descrita e adequada (parcialmente): estudantes na faixa dos 20 anos; os autores citam a falta de generalização
  - Validade e confiabilidade da medida (parcialmente): profundidade em fotografia sagital com software; confiabilidade da força informada (ICC de 0,978 e 0,988), a da profundidade não identificada no trecho lido
  - Controle de confundidores (parcialmente): homens e mulheres analisados separadamente
  - Desfecho definido (atende): profundidade em porcentagem do comprimento da perna
  - Comparações múltiplas (parcialmente): correlações e regressão por etapas sem correção descrita
  - Veículo (auxiliar) (não avaliável)
- **Limitações:**
  - Transversal: associações, não causa.
  - Só adultos na faixa dos 20 anos.
  - Regressão por etapas com vários preditores: R² de 0,435 (homens) e 0,324 (mulheres), sem validação em outra amostra.
- **Justificativa:** Amostra grande, medida 2D sagital e homens e mulheres separados; fica com ressalva pela amostra jovem e pela regressão por etapas.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 101 adultos jovens saudáveis; associação com a profundidade (não com o ângulo do quadril nem a assimetria); regressão por etapas sem validação externa.

#### Leroux 2002 — PMID 11809582 — manter com ressalva (qualidade moderada)

- **Desenho:** Experimento intrassujeito: esteira com inclinação de 0, 5 e 10% (subida e descida) em 8 adultos saudáveis, marcha em 3D.
- **Aplicabilidade (parcial):** Mostra o efeito da inclinação do piso sobre o tronco, útil como lembrete de conferir o nivelamento da gravação.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (parcialmente): 8 adultos; justificativa não consta no resumo
  - População descrita e adequada (parcialmente): adultos saudáveis
  - Validade e confiabilidade da medida (atende): captura 3D da postura e da marcha
  - Controle de confundidores (parcialmente): cada pessoa em todas as inclinações; ordem não descrita
  - Desfecho definido (atende): postura do quadril, joelho, tornozelo, pelve e tronco
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - 8 adultos saudáveis em esteira com inclinação de 0, 5 e 10%.
  - Mostra o efeito do terreno, não de uma condição clínica.
- **Justificativa:** Manipulação controlada na mesma pessoa, com efeito grande e esperado; amostra pequena, mas a pergunta é só conferir o nivelamento do local.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 8 adultos saudáveis em esteira com 0, 5 e 10% de inclinação; mostra o efeito do piso, não de uma condição clínica.

#### List 2013 — PMID 22990570 — manter com ressalva (qualidade moderada)

- **Desenho:** Experimento intrassujeito: agachamento com barra, restrito e livre, com cargas de 0, 25 e 50% do peso corporal, captura 3D com 12 câmeras.
- **Aplicabilidade (parcial):** Mostra que a restrição do avanço do joelho muda ângulo do joelho e movimento do tronco; com barra e 3D.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): 30 participantes; sem cálculo amostral no resumo
  - População descrita e adequada (parcialmente): 30 pessoas sem caracterização no resumo
  - Validade e confiabilidade da medida (atende): Vicon de 12 câmeras e conjunto de marcadores do tronco e da pelve
  - Controle de confundidores (parcialmente): mesma pessoa em dois estilos e três cargas
  - Desfecho definido (parcialmente): vários segmentos e curvaturas, sem desfecho primário
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - Agachamento com barra e carga de 0 a 50% do peso corporal.
  - A conclusão do resumo (o agachamento livre pode ser a melhor opção, com menos carga nas costas) passa do que foi medido: medem-se ângulos e amplitudes, não cargas na coluna.
  - População não caracterizada no resumo.
- **Justificativa:** Captura 3D, 30 pessoas e três cargas; a conclusão sobre carga nas costas é descartada. Não mede a inclinação do tronco como reta quadril-ombro.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 30 pessoas com barra e captura 3D; mede ângulos e amplitudes do tronco e não cargas; a conclusão prescritiva do resumo não é usada.

#### Macrum 2011 — PMID 22100617 — manter com ressalva (qualidade moderada)

- **Desenho:** Experimento intrassujeito de laboratório: agachamento bipodal com e sem cunha de 12° sob o antepé (o resumo o rotula como transversal).
- **Aplicabilidade (parcial):** Agachamento bipodal, como neste app, mas com medida 3D e limitação simulada em adultos saudáveis.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): 30 adultos; sem cálculo amostral no resumo
  - População descrita e adequada (atende): adultos saudáveis e ativos, sem lesão de membro inferior
  - Validade e confiabilidade da medida (atende): cinemática 3D e eletromiografia
  - Controle de confundidores (parcialmente): cada pessoa é o próprio controle; ordem das condições e aprendizado não descritos
  - Desfecho definido (parcialmente): vários desfechos, sem desfecho primário declarado
  - Comparações múltiplas (não avaliável): várias ANOVAs; correção não descrita no resumo
- **Limitações:**
  - A cunha simula a limitação de dorsiflexão, mas não reproduz uma rigidez real do tornozelo.
  - Efeito pequeno sobre o ângulo de valgo (tamanho de efeito de 0,21).
  - Adultos saudáveis e ativos; medida 3D, não vídeo 2D.
- **Justificativa:** Manipulação controlada na mesma pessoa, em tarefa bipodal e com medida 3D; fica com ressalva pela simulação da limitação e pelo efeito pequeno no valgo.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: Limitação de dorsiflexão simulada com cunha em 30 adultos saudáveis, com medida 3D; efeito pequeno sobre o ângulo de valgo.

#### Miyasaka 2023 — PMID 37374309 — manter com ressalva (qualidade moderada)

- **Desenho:** Estudo transversal: módulo de Young do tendão do calcâneo (elastografia) e dorsiflexão na profundidade máxima do agachamento, regressão múltipla.
- **Aplicabilidade (parcial):** Dorsiflexão na profundidade máxima, mas explicada por uma medida (rigidez do tendão) que o vídeo não faz e sem comparar lados.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (atende): 31 homens; cálculo no G*Power para dois preditores (efeito de 0,35, poder de 0,8)
  - População descrita e adequada (parcialmente): só homens jovens saudáveis, critérios descritos
  - Validade e confiabilidade da medida (atende): elastografia por onda de cisalhamento (ICC de 0,958 a 0,968) e goniômetro com o agachamento mantido por 3 segundos
  - Controle de confundidores (parcialmente): regressão com dois preditores; sexo e idade não variam
  - Desfecho definido (atende): ângulo de dorsiflexão na profundidade máxima
  - Comparações múltiplas (parcialmente): Bonferroni na análise por posição do tornozelo
  - Veículo (auxiliar) (não avaliável)
- **Limitações:**
  - Só homens jovens e só o pé direito.
  - Confiabilidade interavaliador não avaliada pelos autores.
  - A elastografia não existe em vídeo, e o estudo não compara os lados.
- **Justificativa:** Cálculo amostral, medida com ICC alto e desfecho claro; população restrita e medida de rigidez fora do alcance do vídeo.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 31 homens jovens saudáveis; rigidez do tendão medida por elastografia, que o vídeo não mede; não compara os lados.

#### Preece 2019 — PMID 31254772 — manter com ressalva (qualidade moderada)

- **Desenho:** Caso-controle de laboratório: pessoas com osteoartrite de joelho e controles saudáveis, curvas inteiras por mapeamento paramétrico estatístico.
- **Aplicabilidade (parcial):** Inclinação sagital do tronco na marcha, que o app mede, mas em 3D e em osteoartrite de joelho.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): o resumo não informa o número de participantes
  - População descrita e adequada (atende): pessoas com osteoartrite de joelho e controles saudáveis
  - Validade e confiabilidade da medida (atende): captura 3D
  - Controle de confundidores (não avaliável): velocidade e idade não constam no resumo
  - Desfecho definido (atende): curvas sagitais e frontais de tronco, pelve e quadril
  - Comparações múltiplas (atende): análise de curvas inteiras (SPM), sem escolher um instante
- **Limitações:**
  - O número de participantes não consta no resumo.
  - Diferença média pequena (2,6°).
  - O resumo sugere uma marca clínica da doença, além do que um caso-controle mostra.
- **Justificativa:** Análise de curvas inteiras e variável igual à do app; amostra não avaliável pelo resumo e diferença pequena.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: Pessoas com osteoartrite de joelho e controles; diferença média pequena (2,6°) em 3D; número de participantes não consta no resumo.

#### Roos 2014 — PMID 24581172 — manter com ressalva (qualidade moderada)

- **Desenho:** Estudo observacional transversal: ruptura do LCA, reconstrução e controles em agachamento bipodal até a profundidade máxima.
- **Aplicabilidade (parcial):** Agachamento bipodal com medida de assimetria entre os lados, mas em pessoas com lesão do LCA e com desfechos de momento articular.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (atende): 62 participantes, com cálculo (efeito de 0,84, poder de 0,8) para 21 por grupo
  - População descrita e adequada (atende): três grupos sem diferença em altura, massa e idade; critérios de inclusão descritos
  - Validade e confiabilidade da medida (atende): 3D (Vicon) e duas plataformas de força
  - Controle de confundidores (parcialmente): grupos comparáveis nas características; duas pessoas excluídas de uma análise de correlação depois do resultado
  - Desfecho definido (parcialmente): vários desfechos de cinemática e cinética
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - Duas pessoas que se recuperaram pior foram excluídas de uma análise de correlação, depois de conhecido o resultado.
  - Sem padronização de apoio dos pés nem de postura dos braços (para observar o comportamento habitual).
  - Resultado específico de pessoas com ruptura ou reconstrução do LCA.
- **Justificativa:** Cálculo amostral, grupos comparáveis, 3D e plataformas, em agachamento bipodal; fica com ressalva pela população e pela exclusão posterior de dois participantes.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 62 pessoas (ruptura, reconstrução e controles) com 3D e plataformas de força; resultado específico do ligamento cruzado anterior; duas exclusões numa análise.

#### Song 2021 — PMID 34628200 — manter com ressalva (qualidade moderada)

- **Desenho:** Estudo correlacional longitudinal curto: agachamento bipodal em atletas universitários em dois momentos (0 a 6 e 6 a 12 meses) após reconstrução do LCA.
- **Aplicabilidade (parcial):** Agachamento bipodal e posição lateral do quadril, que o vídeo também observa; população pós-LCA e medida 3D.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (atende): 17 atletas; cálculo indica 11 para r = 0,7 com poder de 0,8
  - População descrita e adequada (parcialmente): atletas universitários da divisão I; enxertos, mecanismos de lesão e sexos diferentes
  - Validade e confiabilidade da medida (atende): 3D e plataformas de força
  - Controle de confundidores (não atende): enxerto, mecanismo e sexo não controlados (limitação dos autores)
  - Desfecho definido (atende): assimetria de força de reação vertical e de momento do joelho
  - Comparações múltiplas (atende): procedimento de Benjamini-Hochberg para correlações e testes t
- **Limitações:**
  - Amostra heterogênea (enxertos, mecanismos de lesão e sexos diferentes) e só de atletas universitários.
  - Só agachamento bipodal; a correlação não prova que a posição lateral do quadril seja a origem da assimetria.
  - Avaliações em até 12 meses após a cirurgia.
- **Justificativa:** Cálculo de amostra e correção de Benjamini-Hochberg declarados, tarefa bipodal e variável de posição próxima da observada no vídeo; população específica.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 17 atletas universitários até 12 meses após reconstrução do ligamento cruzado anterior; amostra heterogênea e medida 3D.

#### Steingrebe 2023 — PMID 38046934 — manter com ressalva (qualidade alta)

- **Desenho:** Revisão sistemática com metanálise de efeitos aleatórios: 35 estudos de cinemática de pessoas com osteoartrite de quadril em tarefas de locomoção.
- **Aplicabilidade (parcial):** Amplitudes de quadril e de joelho na marcha, mas em osteoartrite de quadril e em 3D.
- **Itens com nota:**
  - Protocolo ou registro prévio (atende): PROSPERO
  - Busca abrangente (atende): PubMed, Web of Science e Scopus (ago/2022), só em inglês; busca, triagem e elegibilidade por dois revisores
  - Risco de viés dos incluídos (atende): lista de Downs e Black por dois revisores; escores variam muito entre estudos
  - Síntese adequada (atende): efeitos aleatórios com REML e ajuste de Knapp-Hartung
  - Heterogeneidade tratada (atende): I² calculado, grande heterogeneidade declarada, análises por subgrupo
  - Conflito de interesse declarado (não avaliável): não verificado no trecho lido
  - Veículo (auxiliar) (não avaliável)
- **Limitações:**
  - Grande heterogeneidade entre os estudos em todos os parâmetros, sobretudo nos planos sagital e frontal.
  - Poucos estudos informam cálculo amostral (6 de 47 relatos) e o recrutamento é pouco descrito.
  - Ângulos 3D de pessoas com osteoartrite de quadril, não vídeo 2D.
- **Justificativa:** Revisão registrada, com risco de viés, metanálise de efeitos aleatórios e heterogeneidade declarada; população com osteoartrite de quadril.
- **Exibido no laudo:** Qualidade metodológica: alta. Limitação principal: 35 estudos de osteoartrite de quadril com grande heterogeneidade e medida 3D; poucos estudos com cálculo amostral.

#### Strong 2023 — PMID 37853508 — manter com ressalva (qualidade moderada)

- **Desenho:** Coorte longitudinal com controles: agachamento bipodal em três momentos após reconstrução do LCA (24 pessoas) e 29 controles, análise funcional de curvas.
- **Aplicabilidade (parcial):** Agachamento bipodal e assimetria entre os lados, mas em pessoas após reconstrução do LCA e com momentos e forças.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): 24 após reconstrução (três momentos) e 29 controles; sem cálculo amostral no resumo
  - População descrita e adequada (parcialmente): pessoas após reconstrução do LCA; proporção de mulheres diferente entre o grupo e os controles (13 de 24 e 22 de 29)
  - Validade e confiabilidade da medida (atende): 3D e plataformas de força; análise funcional de curvas
  - Controle de confundidores (parcialmente): controles avaliados uma vez; classificação individual pelo intervalo de confiança dos controles
  - Desfecho definido (atende): assimetria de momentos e de força vertical em curvas
  - Comparações múltiplas (parcialmente): análise de curvas inteiras, sem correção descrita para os desfechos
- **Limitações:**
  - Mede assimetria de momentos e de força de reação, não de posição.
  - Controles avaliados uma única vez e proporção de mulheres diferente entre os grupos.
- **Justificativa:** Seguimento longitudinal com controles e análise de curvas; substitui Webster 2014 (10 por grupo) como fonte de assimetria de carga no agachamento bipodal pós-LCA.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 24 pessoas após reconstrução do ligamento cruzado anterior, avaliadas três vezes, e 29 controles; mede momentos e forças, não posição.

#### Vermeulen 2023 — PMID 37181257 — manter com ressalva (qualidade alta)

- **Desenho:** Revisão sistemática (PRISMA 2020) de 21 estudos do efeito da fadiga sobre tronco e pelve na aterrissagem de saltos.
- **Aplicabilidade (indireta):** Mesmo bem conduzida, trata de saltos e não de séries curtas de agachamento: serve para dizer que a evidência é indireta.
- **Itens com nota:**
  - Protocolo ou registro prévio (atende): PROSPERO CRD42020154706 e PRISMA 2020
  - Busca abrangente (atende): PubMed, Web of Science, Embase, CINAHL e SPORTDiscus até abr/2022, busca manual e dois autores independentes
  - Risco de viés dos incluídos (atende): lista de Downs e Black modificada, com 9 a 14 de 16
  - Síntese adequada (atende): sem metanálise por heterogeneidade; síntese narrativa por tipo de fadiga
  - Heterogeneidade tratada (atende): reconhece grande heterogeneidade de protocolos de fadiga e de tarefas
  - Conflito de interesse declarado (não avaliável): não verificado no trecho lido
  - Veículo (auxiliar) (não avaliável)
- **Limitações:**
  - Só aterrissagens de salto em pessoas ativas; nenhum estudo de agachamento.
  - Protocolos de fadiga intensos e heterogêneos, bem diferentes de poucas repetições.
  - Estudos incluídos de qualidade moderada a alta; sem metanálise.
- **Justificativa:** Revisão registrada e bem conduzida; fica só para dizer que a evidência sobre fadiga é indireta e heterogênea, nunca para afirmar efeito em séries de agachamento.
- **Exibido no laudo:** Qualidade metodológica: alta. Limitação principal: 21 estudos de aterrissagem de salto em pessoas ativas, com protocolos de fadiga heterogêneos; nenhum de agachamento nem de séries curtas.

#### Walker 2026 — PMID 42516619 — manter com ressalva (qualidade moderada)

- **Desenho:** Estudo correlacional transversal: profundidade do agachamento unipodal (câmera única 3D), força do quadril (dinamômetro manual fixo) e dorsiflexão em carga.
- **Aplicabilidade (parcial):** Profundidade do agachamento e dorsiflexão em carga, mas unipodal e com outro sensor.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (atende): 72 participantes; cálculo no G*Power indica 67 para efeito de 0,30 e poder de 0,80
  - População descrita e adequada (atende): adultos saudáveis de 18 a 40 anos, critérios descritos; 59,7% mulheres
  - Validade e confiabilidade da medida (parcialmente): câmera única 3D por infravermelho, confiabilidade interavaliador de 0,85 citada de outro estudo; dinamômetro fixo com confiabilidade de 0,80 a 0,90 no estudo-piloto
  - Controle de confundidores (parcialmente): frequência de exercício só em análise post hoc
  - Desfecho definido (atende): profundidade como pico de flexão do joelho no agachamento unipodal
  - Comparações múltiplas (não avaliável): várias correlações; correção não identificada no texto lido
  - Veículo (auxiliar) (não avaliável)
- **Limitações:**
  - Correlações baixas (r de 0,22 a 0,37) entre dorsiflexão e profundidade.
  - A associação mais forte aparece só em análise post hoc de quem se exercita mais de 3 vezes por semana.
  - Agachamento unipodal e câmera única 3D, não vídeo 2D de estimativa de pose.
- **Justificativa:** Cálculo amostral declarado, desfecho bem definido e resultado coerente com Kim e Gomes; correlações baixas e análise post hoc pedem ressalva.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 72 adultos jovens saudáveis; correlações baixas entre dorsiflexão e profundidade; associação maior só em análise post hoc de quem treina mais.

#### Wyndow 2016 — PMID 26816531 — manter com ressalva (qualidade moderada)

- **Desenho:** Estudo correlacional transversal: agachamento unipodal filmado em vídeo 2D, regressão com equações de estimativa generalizadas.
- **Aplicabilidade (parcial):** Medida 2D de projeção frontal, como no app, mas agachamento unipodal em assintomáticos.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (parcialmente): 30 adultos de conveniência (60 membros); sem cálculo amostral
  - População descrita e adequada (atende): assintomáticos de 18 a 50 anos, critérios de exclusão descritos
  - Validade e confiabilidade da medida (parcialmente): ângulo 2D com erro padrão de 0,63 a 0,74° e concordância com 3D citada de outro estudo; mobilidade do pé por plataforma com confiabilidade citada
  - Controle de confundidores (parcialmente): sexo, altura e peso no modelo; dois membros por pessoa tratados por equações de estimativa generalizadas
  - Desfecho definido (atende): ângulo de projeção frontal no pico e excursão
  - Comparações múltiplas (parcialmente): dois modelos com vários preditores; correção não descrita
- **Limitações:**
  - Correlacional, em 30 adultos de conveniência e sem cálculo amostral.
  - Agachamento unipodal controlado por metrônomo e profundidade fixa; os autores não generalizam para populações clínicas.
  - Cinco preditores para 60 membros de 30 pessoas.
- **Justificativa:** Medida 2D próxima da do app, com erro de medida informado e covariáveis no modelo; amostra pequena e sem cálculo, e tarefa unipodal.
- **Exibido no laudo:** Qualidade metodológica: moderada. Limitação principal: 30 adultos assintomáticos de conveniência em agachamento unipodal controlado; resultado correlacional que os autores não estendem a populações clínicas.

#### Barber-Westin 2017 — PMID 28298066 — remover (qualidade baixa)

- **Desenho:** Revisão sistemática (nível de evidência 4, segundo os autores) de 37 estudos de fadiga em saltos, aterrissagens e mudanças de direção.
- **Aplicabilidade (indireta):** Saltos e aterrissagens em atletas; o fator é sobre séries curtas de agachamento.
- **Itens com nota:**
  - Protocolo ou registro prévio (não avaliável)
  - Busca abrangente (não atende): uma única base (MEDLINE)
  - Risco de viés dos incluídos (não avaliável): não mencionado no resumo
  - Síntese adequada (atende): narrativa
  - Heterogeneidade tratada (atende): descreve ampla variação de protocolos de fadiga, tarefas e desfechos
  - Conflito de interesse declarado (não avaliável)
- **Limitações:**
  - Busca em uma única base (MEDLINE) e risco de viés não mencionado no resumo: falha crítica no estilo AMSTAR-2.
  - Tarefas de salto, aterrissagem e corte, não agachamento.
- **Justificativa:** Busca em uma base só e sem risco de viés no resumo. A revisão de Vermeulen 2023 (registrada, cinco bases, risco de viés) cobre a fadiga em aterrissagens.

#### Borrelli 2002 — PMID 11818800 — remover (qualidade baixa)

- **Desenho:** Série de casos consecutivos de 15 pacientes com fratura isolada de acetábulo, comparados com coortes sem lesão.
- **Aplicabilidade (indireta):** População específica de fratura de acetábulo.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (parcialmente): 15 pacientes; justificativa não consta no resumo
  - População descrita e adequada (parcialmente): fratura isolada de acetábulo tratada cirurgicamente
  - Validade e confiabilidade da medida (atende): análise 3D da marcha e dinamometria
  - Controle de confundidores (não atende): comparação com coortes sem lesão e sem pareamento descrito no resumo
  - Desfecho definido (parcialmente): muitas variáveis de força, marcha e questionário
  - Comparações múltiplas (não atende): muitas comparações de segmentos e planos; uma única diferença encontrada, sem correção
- **Limitações:**
  - Série de casos consecutivos de 15 pacientes.
  - Entre muitas comparações de segmentos e planos, só a inclinação do tronco diferiu, sem correção descrita.
- **Justificativa:** Série de casos com muitas comparações e uma única diferença, em população específica; não sustenta um fator.

#### Cashman 2012 — PMID 22894982 — remover (qualidade moderada)

- **Desenho:** Revisão sistemática com síntese narrativa de 11 estudos de força do quadril e valgo em assintomáticos (busca em fevereiro de 2011).
- **Aplicabilidade (parcial):** Adultos assintomáticos e cinemática de uma ou várias câmeras; força por dinamometria.
- **Itens com nota:**
  - Protocolo ou registro prévio (não avaliável)
  - Busca abrangente (parcialmente): Medline, EMBASE, CINAHL, SPORTDiscus e Google Scholar até fev/2011; um único autor
  - Risco de viés dos incluídos (não avaliável): não mencionado no resumo
  - Síntese adequada (atende): narrativa, sem metanálise, com conclusão cautelosa
  - Heterogeneidade tratada (parcialmente): cita variação de metodologia e falta de concordância entre estudos
  - Conflito de interesse declarado (não avaliável)
- **Limitações:**
  - Busca de 2011, anterior a duas revisões mais recentes e maiores sobre a mesma pergunta.
  - Um único autor; risco de viés não mencionado no resumo.
- **Justificativa:** Revisão cautelosa, mas de 2011, com um autor e sem risco de viés no resumo; as revisões de 2021 e de 2026 cobrem a mesma pergunta com mais estudos.

#### da Costa 2021 — PMID 33713896 — remover (qualidade moderada)

- **Desenho:** Estudo transversal de laboratório com amostra de conveniência: agachamento unipodal em 3D, dorsiflexão passiva em carga e dorsiflexão dinâmica.
- **Aplicabilidade (indireta):** A hipótese fala em mobilidade limitada do tornozelo; a variável associada ao tronco é a dorsiflexão alcançada no agachamento, que é resultado do movimento.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): 30 participantes de conveniência; sem cálculo amostral no resumo
  - População descrita e adequada (atende): 30 adultos sem lesão, membro dominante
  - Validade e confiabilidade da medida (atende): cinemática 3D; dorsiflexão passiva em carga e dinâmica
  - Controle de confundidores (não atende): correlações simples, sem ajuste
  - Desfecho definido (parcialmente): vários segmentos (perna, coxa, pelve e tronco), sem desfecho primário
  - Comparações múltiplas (não avaliável): várias correlações; correção não descrita no resumo
- **Limitações:**
  - A dorsiflexão associada ao tronco é a dinâmica, medida durante o próprio agachamento; a mobilidade passiva não se associou ao tronco.
  - Correlações simples em 30 pessoas de conveniência, com vários desfechos.
- **Justificativa:** Não sustenta a hipótese de mobilidade: a associação com o tronco é com a dorsiflexão medida durante o agachamento. Cai 2026 testa a dorsiflexão por manipulação.

#### Endo 2020 — PMID 32581431 — remover (qualidade baixa)

- **Desenho:** Estudo correlacional transversal: agachamento profundo com braços elevados em vídeo 2D de 30 quadros por segundo, regressão.
- **Aplicabilidade (indireta):** Agachamento profundo com braços elevados em 9 homens jovens.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não atende): 9 homens de cerca de 18 anos, regressão com vários preditores
  - População descrita e adequada (parcialmente): só homens jovens saudáveis
  - Validade e confiabilidade da medida (parcialmente): vídeo 2D de 30 quadros por segundo, sem confiabilidade informada; os autores citam a falta de 3D
  - Controle de confundidores (não atende)
  - Desfecho definido (parcialmente): vários ângulos e vários preditores, sem desfecho primário
  - Comparações múltiplas (não atende): regressões por lado e por articulação sem correção
  - Veículo (auxiliar) (não avaliável)
- **Limitações:**
  - Nove participantes com regressões de vários preditores: resultado instável.
  - A conclusão de que o movimento de um lado afeta o do outro vem de preditores de lados diferentes na mesma análise.
  - Vídeo 2D sem 3D, como os autores reconhecem.
- **Justificativa:** Nove participantes com regressão de vários preditores e conclusão (um lado afeta o outro) além dos dados; Kim 2015 (101 participantes) cobre a mesma pergunta.

#### Fry 2003 — PMID 14636100 — remover (qualidade baixa)

- **Desenho:** Experimento intrassujeito: agachamento com barra, joelhos livres e restritos por uma barreira de madeira, em vídeo.
- **Aplicabilidade (parcial):** Agachamento com barra em homens treinados; vídeo 2D lateral.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não atende): 7 homens treinados, sem justificativa
  - População descrita e adequada (parcialmente): homens treinados com pesos, carga igual ao peso corporal
  - Validade e confiabilidade da medida (parcialmente): vídeo 2D com torques calculados de posições estáticas; confiabilidade não consta no resumo
  - Controle de confundidores (parcialmente): mesma pessoa nas duas condições; ordem não descrita
  - Desfecho definido (atende): torques do joelho e do quadril
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - 7 participantes, em 2003, com torques calculados a partir de posições estáticas.
  - O resumo recomenda deixar os joelhos passarem dos pés, o que passa do que foi medido.
- **Justificativa:** Amostra de 7 e método antigo; List 2013 estuda a mesma pergunta com 30 pessoas e captura 3D. A inclinação do tronco com os joelhos restritos fica sem referência (a confirmar).

#### Fujita 2022 — PMID 36166956 — remover (qualidade baixa)

- **Desenho:** Estudo transversal exploratório: 38 pessoas com AVC crônico e joelho rígido, sensor inercial e eletromiografia, subgrupos por componente principal.
- **Aplicabilidade (indireta):** Pessoas com AVC crônico selecionadas por joelho rígido.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): 38 pessoas; sem cálculo amostral no resumo
  - População descrita e adequada (parcialmente): AVC crônico com joelho rígido
  - Validade e confiabilidade da medida (parcialmente): sensor inercial e eletromiografia, sem 3D de referência
  - Controle de confundidores (não avaliável)
  - Desfecho definido (parcialmente): subgrupos definidos pelo sinal do componente principal 2 da eletromiografia (divisão exploratória)
  - Comparações múltiplas (não avaliável): correlações em dois subgrupos; correção não descrita no resumo
- **Limitações:**
  - Subgrupos definidos pelo sinal de um componente principal: divisão exploratória.
  - Correlações em subgrupos de cerca de metade da amostra, sem correção descrita.
  - O resumo fala em causa a partir de correlações transversais.
- **Justificativa:** Subgrupos exploratórios e correlações transversais em AVC, chamadas de causa no resumo; Apti 2016 cobre a ligação com os flexores plantares em adultos saudáveis.

#### Honda 2022 — PMID 35193063 — remover (qualidade moderada)

- **Desenho:** Estudo transversal de laboratório: idosos e adultos jovens em agachamento profundo, 3D e plataformas de força.
- **Aplicabilidade (indireta):** A exposição do estudo é a idade, não a dorsiflexão; não sustenta que a dorsiflexão contribua para a inclinação do tronco.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (parcialmente): 12 idosos e 19 jovens; sem cálculo amostral no resumo
  - População descrita e adequada (atende): idosos (mediana de 76,5 anos) e jovens (mediana de 30 anos)
  - Validade e confiabilidade da medida (atende): 3D e plataformas de força
  - Controle de confundidores (não atende): a idade separa os grupos e tudo o que muda com ela
  - Desfecho definido (atende): ângulos articulares, centro de massa e contribuição dos momentos
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - A comparação é entre idades: dorsiflexão, flexão do tronco e do joelho diferem juntas, sem separar fatores.
  - Grupos de 12 e 19 pessoas.
- **Justificativa:** A menor dorsiflexão e a maior flexão do tronco aparecem juntas no grupo mais velho, sem que o estudo isole a dorsiflexão. Cai 2026 manipula a dorsiflexão.

#### Kerrigan 2001 — PMID 11239282 — remover (qualidade moderada)

- **Desenho:** Estudo transversal comparativo em laboratório: idosos saudáveis, idosos com quedas recorrentes e adultos jovens (3D optoeletrônico).
- **Aplicabilidade (indireta):** O fator seria a tensão dos flexores como contribuinte da diferença entre os lados; o estudo compara idades e não mediu a tensão.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (parcialmente): 23, 16 e 30 participantes; sem cálculo amostral no resumo
  - População descrita e adequada (atende): idosos saudáveis, idosos com quedas recorrentes e adultos jovens
  - Validade e confiabilidade da medida (atende): captura 3D optoeletrônica
  - Controle de confundidores (parcialmente): compara velocidade confortável e rápida; a idade é o fator dos grupos
  - Desfecho definido (atende): pico de extensão do quadril na marcha
  - Comparações múltiplas (não avaliável): vários parâmetros articulares; correção não descrita no resumo
- **Limitações:**
  - A restrição de mobilidade do quadril é interpretação dos autores: nenhuma medida de mobilidade passiva é descrita no resumo.
  - Compara grupos de idade, não os dois lados da mesma pessoa.
- **Justificativa:** Mostra menor extensão do quadril em idosos, mas não mede a tensão dos flexores nem compara os lados; a restrição é interpretação dos autores.

#### Krajewski 2025 — PMID 39815400 — remover (qualidade baixa)

- **Desenho:** Revisão narrativa dos mecanismos do joelho rígido após AVC.
- **Aplicabilidade (indireta):** População com AVC e discussão de mecanismos.
- **Itens com nota:**
  - Protocolo ou registro prévio (não atende): revisão narrativa, sem protocolo
  - Busca abrangente (não atende): sem busca sistemática descrita
  - Risco de viés dos incluídos (não atende)
  - Síntese adequada (parcialmente): síntese narrativa de mecanismos
  - Heterogeneidade tratada (parcialmente): reconhece amostras pequenas (média de 9,8 participantes nos estudos de joelho rígido) e definição subjetiva
  - Conflito de interesse declarado (não avaliável)
- **Limitações:**
  - Revisão narrativa, sem método de busca nem avaliação do risco de viés.
  - Só AVC, com estudos de cerca de 10 participantes.
- **Justificativa:** Revisão narrativa em AVC: está no nível mais baixo da hierarquia e não serve de fonte para um fator.

#### Lamontagne 2011 — PMID 21543687 — remover (qualidade baixa)

- **Desenho:** Série pré e pós-operatória de 10 pacientes com impacto femoroacetabular tipo came (nível IV), sem grupo controle.
- **Aplicabilidade (indireta):** Impacto femoroacetabular cirúrgico; pergunta diferente de uma diferença entre os lados.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (parcialmente): 10 pacientes; justificativa não consta no resumo
  - População descrita e adequada (parcialmente): impacto tipo came unilateral sintomático
  - Validade e confiabilidade da medida (atende): cinemática 3D
  - Controle de confundidores (não atende): sem grupo controle; reavaliação entre 8 e 32 meses depois da cirurgia
  - Desfecho definido (parcialmente): vários ângulos no ponto mais baixo, sem desfecho primário
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - Antes e depois em 10 pacientes, sem grupo controle e com seguimento de 8 a 32 meses.
  - A explicação do resumo (abertura do acetábulo e menor cobertura da cabeça do fêmur) é especulativa.
- **Justificativa:** Série pré e pós-operatória sem controle, de 10 pacientes; a revisão com metanálise de 2025 cobre a mesma pergunta com mais estudos.

#### Lugade 2010 — PMID 20542608 — remover (qualidade moderada)

- **Desenho:** Coorte comparando duas abordagens de artroplastia de quadril e controles, em 3D, antes e depois da cirurgia.
- **Aplicabilidade (parcial):** Assimetria do apoio na osteoartrite de quadril, que Constantinou 2014 (30 artigos) já mostra.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (parcialmente): 12 e 11 pacientes e 10 controles; sem justificativa no resumo
  - População descrita e adequada (parcialmente): osteoartrite de quadril antes da artroplastia, duas abordagens
  - Validade e confiabilidade da medida (atende): cinemática e cinética 3D
  - Controle de confundidores (parcialmente): controles pareados por idade
  - Desfecho definido (parcialmente): o desfecho principal é a mudança depois da cirurgia; a assimetria pré-operatória é secundária
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - Grupos de 10 a 12 pessoas.
  - A comparação com controles antes da cirurgia não é o desfecho principal do estudo.
- **Justificativa:** Grupos pequenos e comparação pré-operatória secundária; Constantinou 2014 (30 artigos) já mostra a assimetria do apoio na osteoartrite de quadril.

#### Mauntel 2013 — PMID 23096063 — remover (qualidade baixa)

- **Desenho:** Caso-controle de laboratório: agachamento unipodal, grupos definidos por deslocamento medial do joelho observado.
- **Aplicabilidade (parcial):** Agachamento unipodal em adultos ativos; a dorsiflexão tem fontes melhores (revisão com metanálise, experimento).
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): 40 adultos (20 e 20); sem cálculo amostral no resumo
  - População descrita e adequada (parcialmente): adultos ativos; grupos definidos por observação visual do deslocamento medial do joelho
  - Validade e confiabilidade da medida (parcialmente): EMG e goniometria; a classificação visual do grupo não tem confiabilidade informada no resumo
  - Controle de confundidores (não avaliável)
  - Desfecho definido (não atende): 18 variáveis (8 músculos e 10 mobilidades passivas) sem desfecho primário
  - Comparações múltiplas (parcialmente): três MANOVAs; diferenças com p entre 0,007 e 0,047 sem correção descrita nos testes seguintes
- **Limitações:**
  - Grupos definidos por observação visual do deslocamento medial do joelho, sem confiabilidade informada no resumo.
  - Muitas variáveis e diferenças com p próximo de 0,05.
  - O resumo conclui que a coativação influencia o deslocamento e recomenda programas de treino, o que um caso-controle não permite.
- **Justificativa:** Classificação visual dos grupos, muitas variáveis com p próximo de 0,05 e conclusão causal e prescritiva no resumo. A dorsiflexão e o valgo têm fontes melhores; a coativação deixa de ser citada.

#### Mettler 2019 — PMID 29927892 — remover (qualidade baixa)

- **Desenho:** Antes e depois em um grupo, sem controle: programa de alongamento de 3 semanas em pessoas com extensão passiva do quadril limitada, avaliadas na corrida.
- **Aplicabilidade (indireta):** Corrida submáxima e resultado nulo; não sustenta nem refuta a hipótese para a marcha.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): 20 pessoas; sem cálculo amostral no resumo
  - População descrita e adequada (parcialmente): saudáveis com extensão passiva do quadril limitada
  - Validade e confiabilidade da medida (atende): análise 3D da corrida
  - Controle de confundidores (não atende): sem grupo controle
  - Desfecho definido (atende): extensão passiva e cinemática sagital do complexo lombo-pélvico-quadril na corrida
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - Antes e depois de 3 semanas, sem grupo controle.
  - Corrida submáxima, não marcha.
  - Resultado nulo para a cinemática, que não testa se a tensão dos flexores explica a menor extensão do quadril.
- **Justificativa:** Sem grupo controle, em corrida e com resultado nulo; não sustenta nem refuta a hipótese para a marcha.

#### Murray 1985 — PMID 4042479 — remover (qualidade baixa)

- **Desenho:** Série de casos descritiva de 35 homens com incapacidade unilateral do joelho por dor (fotografia de luz interrompida).
- **Aplicabilidade (indireta):** Dor unilateral no joelho; assimetria temporal descrita sem medida comparável com a duração do apoio.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (parcialmente): 35 homens; justificativa não consta no resumo
  - População descrita e adequada (parcialmente): só homens com dor unilateral no joelho
  - Validade e confiabilidade da medida (parcialmente): fotografia de luz interrompida (1985); validade não consta no resumo
  - Controle de confundidores (não atende): sem controle descrito no resumo
  - Desfecho definido (parcialmente): muitas variáveis descritivas
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - Série de casos de 1985, só de homens, sem grupo de comparação descrito no resumo.
  - Os achados "comuns" aos pacientes são descritivos.
- **Justificativa:** Série de casos antiga, só de homens e sem controle no resumo; Constantinou 2014 e Corrigan 2023 cobrem a assimetria temporal com desenhos melhores.

#### Seeley 2010 — PMID 24149783 — remover (qualidade baixa)

- **Desenho:** Estudo correlacional de laboratório: diferença leve de comprimento dos membros (radiografia) e coeficientes de simetria da marcha.
- **Aplicabilidade (indireta):** Desfecho (momentos e potências) diferente de tempo de apoio, flexão do joelho ou amplitude do quadril.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (parcialmente): 26 adultos; o subgrupo com diferença maior tem 7
  - População descrita e adequada (atende): adultos sem doença
  - Validade e confiabilidade da medida (parcialmente): radiografia e análise de marcha; os desfechos são coeficientes de simetria de momentos e potências
  - Controle de confundidores (não avaliável)
  - Desfecho definido (parcialmente): nove coeficientes de simetria de ângulos, momentos e potências
  - Comparações múltiplas (não avaliável): várias correlações; correção não descrita no resumo
  - Veículo (auxiliar) (não avaliável)
- **Limitações:**
  - O resumo descreve como significativas diferenças de grupo com p de 0,40, 0,35, 0,40 e 0,22 (provável erro de digitação, não verificável: o texto completo está indexado, mas a ferramenta não o devolveu).
  - Mede simetria de momentos e potências, não ângulos nem tempos.
  - Subgrupo de diferença maior com 7 pessoas.
- **Justificativa:** Valores de p no resumo incompatíveis com a conclusão, desfecho (momentos e potências) diferente dos achados do app e subgrupo de 7. Khamis 2017 cobre a pergunta.

#### Staines 2026 — PMID 42107174 — remover (qualidade moderada)

- **Desenho:** Análise transversal com captura 3D (o registro do PubMed o lista como ensaio clínico randomizado, mas o resumo não descreve randomização).
- **Aplicabilidade (indireta):** O desfecho (balanço) e a população (AVC) diferem do achado de tempo de apoio.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): 31 pessoas; sem cálculo amostral no resumo
  - População descrita e adequada (parcialmente): AVC subagudo (menos de 6 meses)
  - Validade e confiabilidade da medida (atende): captura 3D e margem de estabilidade
  - Controle de confundidores (parcialmente): regressão ajustada por largura do passo e velocidade
  - Desfecho definido (atende): razão do tempo de balanço e margem mínima de estabilidade
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - A assimetria é medida no tempo de balanço, não no tempo de apoio.
  - A leitura da razão de simetria e a explicação (estratégia de equilíbrio) são dos autores e não foram testadas.
  - Só AVC subagudo.
- **Justificativa:** Variável e população diferentes do achado (balanço em AVC, não apoio); a interpretação é dos autores e o rótulo de ensaio randomizado no registro não bate com o resumo.

#### Tsutsumi 2026 — PMID 42804966 — remover (qualidade baixa)

- **Desenho:** Antes e depois sem controle: 24 pacientes avaliados antes e 1 ano depois da artroplastia total do joelho, 3D e eletromiografia.
- **Aplicabilidade (parcial):** Inclinação do tronco na marcha depois da cirurgia do joelho.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (não avaliável): 24 pacientes; sem cálculo amostral no resumo
  - População descrita e adequada (atende): pacientes de artroplastia total do joelho
  - Validade e confiabilidade da medida (atende): 3D, plataformas de força e eletromiografia
  - Controle de confundidores (não atende): sem grupo controle; um ano de recuperação, dor e reabilitação mudam juntos
  - Desfecho definido (parcialmente): vários desfechos, sem desfecho primário
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - Antes e depois de um ano, sem grupo controle.
  - A mudança do tronco pode vir da cirurgia, da recuperação da dor, da reabilitação ou do tempo.
- **Justificativa:** Antes e depois sem controle em 24 pacientes; a inclinação do tronco muda com a cirurgia, a dor e o tempo ao mesmo tempo.

#### Webster 2014 — PMID 24934927 — remover (qualidade baixa)

- **Desenho:** Caso-controle de laboratório (nível III): agachamento bipodal antes e depois de um protocolo de fadiga, em homens após reconstrução do LCA e controles.
- **Aplicabilidade (parcial):** Agachamento bipodal, mas em população pós-LCA e com protocolo de fadiga geral.
- **Itens com nota:**
  - Tamanho e justificativa da amostra (parcialmente): 10 por grupo, só homens; justificativa não consta no resumo
  - População descrita e adequada (parcialmente): homens que voltaram ao esporte após reconstrução; não inclui mulheres
  - Validade e confiabilidade da medida (atende): 3D e plataformas de força
  - Controle de confundidores (parcialmente): controles sem lesão; fadiga generalizada
  - Desfecho definido (atende): índices de simetria de carga e de momento
  - Comparações múltiplas (não avaliável)
- **Limitações:**
  - 10 por grupo, só homens, sem justificativa do tamanho no resumo.
  - A conclusão prática do resumo (induzir fadiga bilateral para obter carga simétrica) passa do que foi medido.
- **Justificativa:** Amostra de 10 por grupo entre pessoas, só homens, e conclusão prática além do medido. Strong 2023 traz amostra maior, três momentos e controles.

<!-- FIM-RESULTADO -->

## O que ficou sem fonte

Depois da avaliação, quatro fatores estão **a confirmar** (a interface escreve "sem referência verificada"): `restricao_do_avanco_do_joelho` (única fonte que media o tronco nessa condição
tem 7 participantes e foi removida), `referencia_de_profundidade_e_ritmo`, `familiarizacao_e_ritmo` e `velocidade_e_eventos` (os três decorrem da forma de coletar o vídeo).
Vinte e dois itens a conferir seguem sem fonte (sugestões de método ou de exame). Quatro fatores foram eliminados por falta de fonte retida: `equilibrio_apos_avc` e
`alteracoes_neuromotoras_apos_avc` (AVC), `tensao_dos_flexores_do_quadril` e `condicao_do_quadril` da marcha. A lista completa, com os textos, está em
`docs/biblioteca-hipoteses-movimento.md`.

## Limites desta avaliação e o que o time científico deve conferir

1. **Um único leitor.** Não houve dupla leitura nem pontuação formal de instrumento. Recomendo dupla leitura das fontes que sustentam fatores com tipo de estudo mais forte:
   Lima 2017, Lopes 2018, Alzahrani 2021, Cashman 2026, Constantinou 2014, Steingrebe 2023, Generoso 2025 e Vermeulen 2023.
2. **Resumo na maior parte.** Só 15 das 55 fontes tiveram métodos e limitações lidos no texto completo (13 das 36 mantidas e 2 das 19 removidas). Os itens "não avaliável" (quadros acima) pedem o artigo completo:
   conflito de interesse e financiamento (nenhuma revisão tem esse item verificado), correção para comparações múltiplas, justificativa do tamanho da amostra e registro do protocolo.
3. **Conflito de interesse e financiamento** não foram avaliados em nenhuma fonte além do que o texto lido mostrou por acaso.
4. **Veículo e retratação.** Não consultei o catálogo da NLM. O item de veículo é auxiliar e não decidiu nenhuma fonte. Nos tipos de publicação dos registros recuperados, nenhuma das 55 fontes consta
   como retratada nem com expressão de preocupação; não busquei erratas nem comentários posteriores.
5. **Registros do PubMed com inconsistência.** Staines 2026 está rotulado como ensaio clínico randomizado, mas o resumo descreve análise transversal. O resumo de Seeley 2010 descreve como
   significativas diferenças com p de 0,22 a 0,40. Nos dois casos a fonte foi removida por motivos independentes; o time pode conferir os artigos.
6. **Decisões sensíveis, para o time confirmar:**
   - Barber-Westin 2017 foi removida por busca em uma única base e ausência de risco de viés no resumo; se o artigo completo mostrar outra coisa, pode voltar.
   - Cashman 2026 (revisão mais recente sobre força do quadril e valgo) ficou como moderada por itens não avaliáveis; o resumo não cita registro nem risco de viés.
   - Haberkamp 2022 valida uma estimativa de pose 2D (OpenPose) em adolescentes; o modelo de pose deste app é outro, então a concordância medida não se transfere sem validação própria.
   - Baker 2016 e Preece 2019 não informam, no resumo, o número de participantes.
   - A elevação do calcanhar (Cai 2026) sustenta quatro fatores (dorsiflexão, tronco, avanço do joelho e profundidade) com uma só fonte: um experimento de 30 homens com dorsiflexão restrita, sem grupo de comparação.
7. **Nenhum limite clínico.** A biblioteca continua sem propor valores de referência: as fontes comparam grupos, não dizem quantos graus de diferença entre os lados indicam condição.

## Mudanças no produto

- `FonteBiblio` ganhou `qualidade` e `limitacaoPrincipal`; `fontes.ts` os preenche a partir de `avaliacaoMetodologica.ts` e não contém fonte removida.
- Cada fonte exibida no laudo (tela e PDF) mostra "Qualidade metodológica" e a limitação principal; o método do laudo traz a frase das fontes escolhidas por critérios explícitos e a conferir.
- O teste `src/test/movimentoBiblioteca.test.ts` barra: fonte sem avaliação; fonte removida que ainda é citada; fator com força e sem fonte retida; qualidade baixa sem ressalva; nível "alta" sem os itens
  críticos atendidos ou lido só pelo resumo; limitação principal com verbo causal ou juízo sobre o corpo; e este documento fora de sincronia com os dados.
- Para repetir a avaliação de uma fonte nova, veja "Como incluir ou alterar uma fonte" em `docs/biblioteca-hipoteses-movimento.md`.
