import type { EntradaBiblioteca } from '../tipos';
import { FONTES as F } from './fontes';

/*
 * Hipóteses para os achados do agachamento filmado de frente. A medida é uma projeção 2D no plano frontal; por isso a primeira
 * hipótese do valgo é a própria limitação da projeção.
 */

export const VALGO_DINAMICO: EntradaBiblioteca = {
  chave: 'valgo_dinamico',
  titulo: 'Valgo dinâmico do joelho na descida (agachamento de frente)',
  fatores: [
    {
      id: 'mobilidade_tornozelo_pe',
      texto:
        'Menor dorsiflexão do tornozelo e maior mobilidade do pé foram associadas a maior valgo (deslocamento medial) do joelho no agachamento e podem contribuir para o valgo medido.',
      forca: 'experimental',
      fontes: [F.macrum2011, F.mauntel2013, F.wyndow2016, F.hassan2022],
      ressalva:
        'Resultados não unânimes: em adultos com e sem dor patelofemoral, a dorsiflexão não se correlacionou com o ângulo de projeção frontal (Hassan). Os estudos são de agachamento unipodal ou bipodal em adultos fisicamente ativos ou assintomáticos; o estudo experimental (Macrum) simulou a limitação com uma cunha sob o antepé. A associação não estabelece causalidade.',
    },
    {
      id: 'forca_e_coativacao_do_quadril',
      texto:
        'A fraqueza dos abdutores e dos rotadores externos do quadril é uma hipótese frequente para o valgo, mas as revisões sistemáticas não a sustentam de forma consistente.',
      forca: 'revisao_sistematica',
      fontes: [F.cashman2012, F.alzahrani2021, F.cashman2026, F.mauntel2013],
      ressalva:
        'Evidência conflitante em adultos assintomáticos: a revisão de 2012 encontrou pouca evidência a favor e nenhuma conclusão definitiva; a de 2021 descreve a relação como conflitante; a mais recente, com metanálise parcial de 22 artigos, não obteve significância em nenhuma metanálise e conclui que a fraqueza pode não estar associada a maior valgo dinâmico. Uma coativação menor entre glúteos e adutores apareceu em um estudo de 40 pessoas (Mauntel), sem confirmação nas revisões. Não use a força do quadril como explicação por padrão.',
    },
    {
      id: 'dor_ou_lesao_previa',
      texto:
        'Instabilidade crônica do tornozelo e dor patelofemoral foram associadas a maior ângulo de valgo dinâmico; antecedente desse tipo pode contribuir para o valgo medido.',
      forca: 'observacional',
      fontes: [F.emamvirdi2023],
      ressalva:
        '60 atletas de basquete mulheres; agachamento unipodal, medido nos dois lados. Estudo transversal: não mostra se o valgo antecede a dor ou a acompanha. Não vale para quem não tem esse antecedente.',
    },
    {
      id: 'projecao_2d',
      texto:
        'O ângulo de projeção 2D do joelho pode divergir do ângulo tridimensional; parte do valgo medido em vídeo pode refletir a perspectiva da câmera e não só o movimento do joelho.',
      forca: 'meta_analise',
      fontes: [F.lopes2018],
      ressalva:
        'Revisão com metanálise de 16 estudos: a confiabilidade da análise 2D variou de moderada a excelente, mas a concordância com a medida 3D foi fraca no agachamento unipodal e melhor na aterrissagem. Os autores não recomendam a análise 2D quando se exige medida exata. Vale para qualquer valor de valgo deste vídeo: use como observação e não como medida exata.',
    },
  ],
  conferir: [
    { texto: 'Medir a dorsiflexão em carga e a mobilidade do pé (por exemplo, do médio-pé) de cada lado.', fonte: F.wyndow2016 },
    { texto: 'Perguntar sobre dor anterior no joelho, entorse e instabilidade do tornozelo.', fonte: F.emamvirdi2023 },
    {
      texto: 'Testar a força dos abdutores e dos rotadores externos do quadril, interpretando com cautela: a relação com o valgo é conflitante na literatura.',
      fonte: F.alzahrani2021,
    },
    {
      texto: 'Observar o valgo no exame presencial, se possível também em outra tarefa, antes de concluir: a medida 2D em vídeo é uma projeção.',
      fonte: F.lopes2018,
    },
  ],
};

export const DESVIO_LATERAL_PELVE: EntradaBiblioteca = {
  chave: 'desvio_lateral_pelve',
  titulo: 'Deslocamento lateral da pelve em relação à base de apoio (agachamento de frente)',
  fatores: [
    {
      id: 'apoio_assimetrico_pos_lca',
      texto:
        'Em atletas após reconstrução do ligamento cruzado anterior, a posição lateral do quadril no agachamento se correlacionou com a assimetria de carga entre os membros; um deslocamento da pelve pode refletir apoio assimétrico.',
      forca: 'observacional',
      fontes: [F.song2021, F.webster2014, F.roos2014],
      ressalva:
        'População específica: atletas de 0 a 12 meses após reconstrução do ligamento cruzado anterior (Song), homens que voltaram ao esporte (Webster) e adultos com lesão ou reconstrução (Roos), com plataformas de força e análise tridimensional. Correlação não indica que o deslocamento seja a origem da assimetria, e não há dado nestas fontes para pessoas sem esse antecedente. Webster também observou que a carga ficou mais simétrica depois de fadiga.',
    },
    {
      id: 'quadriceps_de_um_lado',
      texto:
        'Déficit de força do quadríceps de um dos lados foi associado a menor momento extensor do joelho nesse lado no agachamento, o que pode contribuir para um apoio mais carregado no lado oposto.',
      forca: 'observacional',
      fontes: [F.ishida2023],
      ressalva:
        '26 pessoas com mais de 1 ano após reconstrução do ligamento cruzado anterior. O estudo mediu momentos articulares com análise tridimensional e não o deslocamento da pelve: a ligação com o deslocamento lateral é uma inferência.',
    },
    {
      id: 'dominancia_do_membro',
      texto: 'Preferência de apoio ou dominância de um dos membros pode contribuir para um apoio desigual mesmo sem lesão.',
      forca: 'observacional',
      fontes: [F.hannan2022],
      ressalva:
        'Estudo com 18 adultos saudáveis; a diferença descrita é de força de reação do solo e de centro de pressão. É um único estudo e não mediu o deslocamento da pelve.',
    },
  ],
  conferir: [
    { texto: 'Perguntar sobre cirurgia ou lesão em joelho, quadril ou tornozelo e sobre dor unilateral.', fonte: F.webster2014 },
    {
      texto: 'Quando houver duas balanças ou uma plataforma de força, comparar a descarga de peso entre os lados no ponto mais baixo.',
      fonte: F.song2021,
    },
    {
      texto: 'Conferir se os pés estavam na mesma posição e se o peso estava distribuído por igual no início de cada repetição.',
      semReferenciaVerificada: true,
    },
  ],
};
