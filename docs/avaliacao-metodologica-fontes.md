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

Cada fonte exibida (tela, PDF e relatório) traz **"Qualidade metodológica: alta/moderada"** e a **limitação principal** em uma frase. O método do laudo ganha:
*"Fontes escolhidas por critérios metodológicos explícitos; avaliação feita pelo MyHealthID a partir do resumo e do texto completo indexado, a ser conferida
pelo time científico."* Fonte de qualidade `baixa` só poderia ficar com a ressalva dita no fator; nesta rodada nenhuma ficou.

<!-- INICIO-RESULTADO -->
(O resultado é gerado a partir de `avaliacaoMetodologica.ts` e fica abaixo.)
<!-- FIM-RESULTADO -->
