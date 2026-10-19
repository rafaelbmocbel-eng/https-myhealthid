import type { EntradaBiblioteca } from '../tipos';
import { FONTES as F } from './fontes';

/*
 * Hipóteses para as diferenças entre os lados no agachamento de lado. Todo fator é hipótese para o profissional confirmar no exame
 * presencial: as fontes descrevem associações em grupos, quase sempre em outra população e com outro método de medida. Depois da avaliação
 * metodológica (docs/avaliacao-metodologica-fontes.md) só ficam fontes com qualidade alta ou moderada, e cada ressalva diz a limitação delas.
 */

export const ASSIMETRIA_FLEXAO_JOELHO: EntradaBiblioteca = {
  chave: 'assimetria_flexao_joelho',
  titulo: 'Diferença entre os lados na flexão máxima do joelho (agachamento)',
  fatores: [
    {
      id: 'dorsiflexao_limitada',
      texto:
        'Menor mobilidade de dorsiflexão do tornozelo foi associada a menor flexão do joelho no agachamento; se a limitação for diferente entre os lados, pode contribuir para a diferença medida.',
      forca: 'experimental',
      fontes: [F.macrum2011, F.dill2014],
      ressalva:
        'Macrum (30 adultos saudáveis, agachamento bipodal, medida 3D) simulou a limitação com uma cunha sob o antepé, o que não reproduz uma rigidez real do tornozelo; Dill (40 adultos ativos, 3D) comparou grupos definidos pela dorsiflexão em carga, e a medida passiva sem carga não os diferenciou. O resumo de nenhum dos dois informa cálculo amostral, e nenhum testou uma diferença de dorsiflexão entre os lados. A associação não estabelece causalidade e não confirma o fator em uma pessoa.',
    },
    {
      id: 'quadriceps_pos_lca',
      texto:
        'Déficit de força do quadríceps e antecedente de lesão ou reconstrução do ligamento cruzado anterior foram associados a assimetria de momentos articulares entre os membros no agachamento, mas não a diferença no ângulo de flexão do joelho, que ficou simétrico em um dos estudos; as fontes não sustentam este fator para a diferença de ângulo medida aqui.',
      forca: 'observacional',
      fontes: [F.ishida2023, F.roos2014],
      ressalva:
        'População específica: pessoas após lesão ou reconstrução do ligamento cruzado anterior. Ishida (26 pessoas, grupo de força baixa com 8) é transversal, padronizou a profundidade (coxas paralelas ao solo) e mede momentos articulares e razões de momento. Roos (62 pessoas, com cálculo amostral e grupos comparáveis, agachamento até a profundidade máxima) descreve assimetria de momentos e de distribuição de carga, mas a simetria do pico de flexão do joelho entre os lados foi 100 ± 3 nos controles, 100 ± 3 no ligamento reconstruído e 99 ± 3 no rompido, sem diferença dos controles (p = 1,000 no reconstruído e p = 0,057 no rompido); Roos excluiu ainda duas pessoas de uma análise de correlação depois do resultado. Portanto a assimetria descrita é de momentos e de carga, não de ângulo de flexão: o fator fica como lembrete de que o ângulo pode parecer simétrico mesmo com assimetria de carga. Não se aplica sem esse antecedente.',
    },
    {
      id: 'dominancia_do_membro',
      texto: 'Preferência do pé de chute ou dominância de um dos membros pode contribuir para diferenças entre os lados mesmo sem lesão.',
      forca: 'observacional',
      fontes: [F.hannan2022],
      ressalva:
        'Estudo cruzado com 18 adultos saudáveis e ativos e duas plataformas de força; o membro preferido foi definido por qual perna chutaria uma bola. A diferença descrita é de força de reação do solo e de centro de pressão, e não de ângulo do joelho, e depende do ritmo e da variável: a força de pico foi maior no lado preferido só no ritmo livre (550 contra 518 N; no metrônomo ficou 499 contra 508 N), o impulso foi maior no lado não preferido no ritmo livre (315 contra 300 Ns) e a variabilidade do centro de pressão foi maior no lado preferido. É um único estudo: serve como lembrete de que alguma diferença entre os lados pode existir sem condição clínica, e a direção dela muda conforme a variável.',
    },
  ],
  conferir: [
    {
      texto:
        'Medir a dorsiflexão do tornozelo em carga (teste de avanço em carga) nos dois lados: no estudo citado, a medida em carga, e não a passiva sem carga, se associou à flexão do joelho no agachamento.',
      fonte: F.dill2014,
    },
    {
      texto: 'Perguntar sobre lesão ou cirurgia no joelho, em especial do ligamento cruzado anterior, e sobre dor ou instabilidade de cada lado.',
      fonte: F.ishida2023,
    },
    { texto: 'Comparar a força de extensão do joelho entre os lados (por exemplo, com dinamometria) e confirmar no exame presencial.', semReferenciaVerificada: true },
    {
      texto: 'Rever os quadros de maior flexão: de lado, o membro mais distante da câmera pode ter sido detectado com menos precisão.',
      semReferenciaVerificada: true,
    },
  ],
};

export const ASSIMETRIA_FLEXAO_QUADRIL: EntradaBiblioteca = {
  chave: 'assimetria_flexao_quadril',
  titulo: 'Diferença entre os lados na flexão máxima do quadril (agachamento)',
  fatores: [
    {
      id: 'mobilidade_quadril_tornozelo',
      texto:
        'Menor mobilidade de dorsiflexão do tornozelo (e, em homens, de flexão do quadril) foi associada a agachamentos menos profundos; diferenças dessas mobilidades entre os lados podem contribuir para a diferença medida.',
      forca: 'observacional',
      fontes: [F.kim2015, F.gomes2020],
      ressalva:
        'Kim (101 adultos jovens, fotografia sagital, regressão por etapas) e Gomes (20 adultos, vídeo 2D, agachamento com barra) relacionam a mobilidade com a profundidade, e não com o ângulo do quadril nem com a assimetria; a associação variou com o sexo em Kim e, em Gomes, só a dorsiflexão no teste de avanço se associou à profundidade. Os dois são transversais, e a ligação com a diferença entre os lados é uma inferência.',
    },
    {
      id: 'condicao_do_quadril',
      texto:
        'Dor ou alteração estrutural do quadril, como o impacto femoroacetabular, pode estar relacionada a diferenças no agachamento (profundidade, joelho e tornozelo), mas a evidência de que mude o ângulo de flexão do quadril é inconclusiva.',
      forca: 'meta_analise',
      fontes: [F.generoso2025, F.cheatham2018],
      ressalva:
        'Evidência mista e inconclusiva: a revisão com metanálise de pacientes operados por impacto femoroacetabular (6 estudos, qualidade moderada pela escala MINORS) não encontrou diferença significativa nos parâmetros cinemáticos, e os autores sugerem que deformidades ósseas isoladas não explicam as limitações no agachamento; a revisão sobre condições do quadril (15 estudos heterogêneos) relata que o impacto femoroacetabular e a artroscopia do quadril afetaram o agachamento, mas o tema é pouco investigado e o resumo não detalha a direção dos efeitos. Serve apenas como lembrete de investigar o quadril.',
    },
  ],
  conferir: [
    {
      texto: 'Medir a flexão passiva e as rotações do quadril de cada lado (goniometria), além da dorsiflexão em carga.',
      fonte: F.kim2015,
    },
    { texto: 'Perguntar sobre dor na região da virilha ou do quadril e sobre cirurgia prévia no quadril.', semReferenciaVerificada: true },
    {
      texto: 'Rever os quadros: a inclinação do tronco e a rotação da pelve mudam o ângulo do quadril projetado no plano da imagem.',
      semReferenciaVerificada: true,
    },
  ],
};

export const ASSIMETRIA_DORSIFLEXAO: EntradaBiblioteca = {
  chave: 'assimetria_dorsiflexao',
  titulo: 'Diferença entre os lados na dorsiflexão máxima do tornozelo (agachamento)',
  fatores: [
    {
      id: 'dor_ou_instabilidade_tornozelo',
      texto:
        'Instabilidade crônica do tornozelo e dor patelofemoral foram associadas a menor dorsiflexão do tornozelo nos dois lados, em comparação com controles; antecedente desse tipo pode estar relacionado à dorsiflexão menor medida, mas as fontes não mostram diferença relevante entre os lados na dor patelofemoral.',
      forca: 'observacional',
      fontes: [F.emamvirdi2023, F.hassan2022],
      ressalva:
        'Emamvirdi: estudo transversal com 60 atletas de basquete mulheres (instabilidade crônica do tornozelo, dor patelofemoral e controles), dorsiflexão em carga e valgo em vídeo 2D; a dorsiflexão foi menor nos dois lados, não só no lado afetado. O índice de assimetria foi calculado e testado dentro de cada grupo (o texto não descreve teste entre grupos): o resumo conclui que há assimetria de dorsiflexão, mas, nos resultados, nos grupos com dor patelofemoral e controle o índice ficou abaixo da variação individual (coeficiente de variação), e os autores dizem que não houve desequilíbrio relevante entre os lados na dorsiflexão; o texto não diz o mesmo do grupo com instabilidade. O cálculo amostral usou efeito de 0,30 e poder de 0,30, e os próprios autores citam isso como limitação. Hassan: caso-controle com 140 adultos, em que a dorsiflexão com o joelho flexionado foi menor no grupo com dor (30,20 contra 33,15), sem dado por lado. A associação não indica direção: a menor dorsiflexão pode acompanhar a condição em vez de antecedê-la.',
    },
    {
      id: 'tendao_calcaneo',
      texto:
        'A rigidez do tendão do calcâneo foi associada ao ângulo de dorsiflexão no ponto mais baixo do agachamento e pode contribuir para a diferença entre os lados.',
      forca: 'observacional',
      fontes: [F.miyasaka2023, F.gomes2020],
      ressalva:
        'Evidência mista: Miyasaka (31 homens jovens saudáveis, com cálculo amostral e elastografia) encontrou associação com a dorsiflexão no ponto mais baixo do agachamento, enquanto Gomes (20 adultos saudáveis) viu a dorsiflexão no teste de avanço se associar à rigidez do tendão, mas não viu influência evidente das propriedades mecânicas do tendão do calcâneo sobre a profundidade do agachamento. Ambos medem a rigidez por ultrassom, o que não é possível em vídeo, e nenhum compara os lados.',
    },
    {
      id: 'elevacao_do_calcanhar',
      texto:
        'Elevar o calcanhar (calçado com salto, calço ou palmilha) reduziu a dorsiflexão máxima medida no agachamento; calçado ou apoio diferentes entre os lados no vídeo podem contribuir para a diferença.',
      forca: 'experimental',
      fontes: [F.cai2026],
      ressalva:
        '30 homens saudáveis com dorsiflexão restrita, agachamento com carga e análise tridimensional; a elevação era igual nos dois pés e não houve comparação com quem tem dorsiflexão não restrita. O estudo não testou diferença de apoio entre os lados.',
    },
  ],
  conferir: [
    {
      texto: 'Medir a dorsiflexão em carga (teste de avanço em carga) em cada lado: a medida passiva sem carga teve menos relação com a cinemática do agachamento.',
      fonte: F.dill2014,
    },
    { texto: 'Perguntar sobre entorse prévia, instabilidade do tornozelo e dor patelofemoral.', fonte: F.emamvirdi2023 },
    { texto: 'Conferir se o calçado, a posição e a abertura dos pés eram iguais nos dois lados.', semReferenciaVerificada: true },
  ],
};
