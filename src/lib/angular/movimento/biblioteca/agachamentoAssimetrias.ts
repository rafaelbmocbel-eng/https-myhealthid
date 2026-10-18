import type { EntradaBiblioteca } from '../tipos';
import { FONTES as F } from './fontes';

/*
 * Hipóteses para as diferenças entre os lados no agachamento de lado. Todo fator é hipótese para o profissional confirmar no exame
 * presencial: as fontes descrevem associações em grupos, quase sempre em outra população e com outro método de medida.
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
        'O estudo experimental (30 adultos saudáveis) simulou a limitação com uma cunha sob o antepé, e o estudo transversal comparou pessoas com e sem limitação; nenhum testou uma diferença de dorsiflexão entre os lados. A associação não estabelece causalidade e não confirma o fator em uma pessoa.',
    },
    {
      id: 'quadriceps_pos_lca',
      texto:
        'Déficit de força do quadríceps e antecedente de lesão ou reconstrução do ligamento cruzado anterior foram associados a assimetria entre os membros no agachamento e podem contribuir para a diferença entre os lados.',
      forca: 'observacional',
      fontes: [F.ishida2023, F.roos2014],
      ressalva:
        'População específica: pessoas após lesão ou reconstrução do ligamento cruzado anterior. A assimetria descrita é de momentos articulares e de distribuição de carga, medidos em laboratório, e não necessariamente de ângulo de flexão; as amostras são pequenas e os estudos são observacionais. Não se aplica sem esse antecedente.',
    },
    {
      id: 'dominancia_do_membro',
      texto: 'Preferência de apoio ou dominância de um dos membros pode contribuir para diferenças entre os lados mesmo sem lesão.',
      forca: 'observacional',
      fontes: [F.hannan2022],
      ressalva:
        'Estudo com 18 adultos saudáveis; a diferença descrita é de força de reação do solo e de centro de pressão, e não de ângulo do joelho. É um único estudo: serve como lembrete de que alguma diferença entre os lados pode existir sem condição clínica.',
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
        'Menor mobilidade de dorsiflexão do tornozelo (e, em homens, de flexão do quadril) foi associada a agachamentos menos profundos, e a dorsiflexão do mesmo lado se associou ao ângulo de flexão do quadril; diferenças dessas mobilidades entre os lados podem contribuir para a diferença medida.',
      forca: 'observacional',
      fontes: [F.kim2015, F.endo2020],
      ressalva:
        'Kim e colaboradores estudaram 101 adultos saudáveis e relacionaram mobilidade com profundidade, e não com assimetria; a associação variou com o sexo. O estudo de Endo e colaboradores tem 9 homens, usa vídeo bidimensional e também mostra que o movimento de um lado se associa ao do lado oposto, então a diferença medida pode refletir compensação e não restrição local.',
    },
    {
      id: 'condicao_do_quadril',
      texto:
        'Dor ou alteração estrutural do quadril, como o impacto femoroacetabular, pode estar relacionada a diferenças no agachamento (profundidade, joelho e tornozelo), mas a evidência de que mude o ângulo de flexão do quadril é inconclusiva.',
      forca: 'observacional',
      fontes: [F.lamontagne2011, F.generoso2025],
      ressalva:
        'Evidência inconclusiva: na revisão com metanálise não houve diferença significativa nos parâmetros cinemáticos depois da cirurgia, e os autores sugerem que deformidades ósseas isoladas não explicam as limitações observadas no agachamento. No estudo de 10 pacientes, a cinemática do quadril afetado também não mudou após a cirurgia, embora o joelho e o tornozelo tenham flexionado mais. Serve apenas como lembrete de investigar o quadril.',
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
        'Estudos transversais em atletas de basquete mulheres (instabilidade de tornozelo e dor patelofemoral) e em adultos com dor patelofemoral; a dorsiflexão foi medida em testes clínicos e não em vídeo. A associação não indica direção: a menor dorsiflexão pode acompanhar a condição em vez de antecedê-la. No estudo de Emamvirdi a dorsiflexão foi menor nos dois lados, não só no lado afetado.',
    },
    {
      id: 'tendao_calcaneo',
      texto:
        'A rigidez do tendão do calcâneo foi associada ao ângulo de dorsiflexão no ponto mais baixo do agachamento e pode contribuir para a diferença entre os lados.',
      forca: 'observacional',
      fontes: [F.miyasaka2023, F.gomes2020],
      ressalva:
        'Evidência mista: Miyasaka (31 homens jovens saudáveis) encontrou associação, enquanto Gomes (20 adultos saudáveis) viu a dorsiflexão no teste de avanço se associar à rigidez do tendão, mas não viu influência evidente das propriedades mecânicas do tendão do calcâneo sobre a profundidade do agachamento. Ambos medem a rigidez por ultrassom, o que não é possível em vídeo, e nenhum compara os lados.',
    },
    {
      id: 'elevacao_do_calcanhar',
      texto:
        'Elevar o calcanhar (calçado com salto, calço ou palmilha) reduziu a dorsiflexão máxima medida no agachamento; calçado ou apoio diferentes entre os lados no vídeo podem contribuir para a diferença.',
      forca: 'experimental',
      fontes: [F.cai2026],
      ressalva:
        '30 homens saudáveis com dorsiflexão restrita, agachamento com carga e análise tridimensional; a elevação era igual nos dois pés. O estudo não testou diferença de apoio entre os lados.',
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
