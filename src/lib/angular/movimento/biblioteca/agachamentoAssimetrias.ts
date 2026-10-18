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
        'Déficit de força do quadríceps e antecedente de lesão ou reconstrução do ligamento cruzado anterior foram associados a assimetria entre os membros no agachamento e podem contribuir para a diferença entre os lados.',
      forca: 'observacional',
      fontes: [F.ishida2023, F.roos2014],
      ressalva:
        'População específica: pessoas após lesão ou reconstrução do ligamento cruzado anterior. Ishida (26 pessoas, grupo de força baixa com 8) é transversal e mede momentos articulares; Roos (62 pessoas, com cálculo amostral e grupos comparáveis) também mede momentos e distribuição de carga em laboratório, e excluiu duas pessoas de uma análise de correlação depois do resultado. A assimetria descrita não é necessariamente de ângulo de flexão. Não se aplica sem esse antecedente.',
    },
    {
      id: 'dominancia_do_membro',
      texto: 'Preferência de apoio ou dominância de um dos membros pode contribuir para diferenças entre os lados mesmo sem lesão.',
      forca: 'observacional',
      fontes: [F.hannan2022],
      ressalva:
        'Estudo cruzado com 18 adultos saudáveis e ativos e duas plataformas de força; a diferença descrita é de força de reação do solo e de centro de pressão, e não de ângulo do joelho. É um único estudo: serve como lembrete de que alguma diferença entre os lados pode existir sem condição clínica.',
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
        'Instabilidade crônica do tornozelo e dor patelofemoral foram associadas a menor dorsiflexão do tornozelo e a assimetria entre os membros; antecedente desse tipo pode contribuir para a diferença medida.',
      forca: 'observacional',
      fontes: [F.emamvirdi2023, F.hassan2022],
      ressalva:
        'Emamvirdi: estudo transversal com 60 atletas de basquete mulheres (instabilidade crônica do tornozelo, dor patelofemoral e controles), cálculo amostral com efeito pequeno, dorsiflexão em carga e valgo em vídeo 2D; a dorsiflexão foi menor nos dois lados, não só no lado afetado. Hassan: caso-controle com 140 adultos, em que a dorsiflexão com o joelho flexionado foi menor no grupo com dor (30,20 contra 33,15). A associação não indica direção: a menor dorsiflexão pode acompanhar a condição em vez de antecedê-la.',
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
