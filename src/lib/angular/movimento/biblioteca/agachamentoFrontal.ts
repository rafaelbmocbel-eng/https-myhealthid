import type { EntradaBiblioteca } from '../tipos';
import { FONTES as F } from './fontes';

/*
 * Hipóteses para os achados do agachamento filmado de frente. A medida é uma projeção 2D no plano frontal; por isso a primeira
 * hipótese do valgo é a própria limitação da projeção. Depois da avaliação metodológica (docs/avaliacao-metodologica-fontes.md) saíram as fontes
 * de qualidade baixa ou de aplicabilidade indireta, e a força do quadril ficou só nas duas revisões mais completas.
 */

export const VALGO_DINAMICO: EntradaBiblioteca = {
  chave: 'valgo_dinamico',
  titulo: 'Valgo dinâmico do joelho na descida (agachamento de frente)',
  fatores: [
    {
      id: 'mobilidade_tornozelo_pe',
      texto:
        'Menor dorsiflexão do tornozelo foi associada a maior valgo dinâmico do joelho em uma metanálise, e diferenças na mobilidade do pé (do médio-pé) foram associadas a maior valgo (deslocamento medial) do joelho no agachamento; podem contribuir para o valgo medido.',
      forca: 'meta_analise',
      fontes: [F.lima2017, F.macrum2011, F.wyndow2016, F.hassan2022],
      ressalva:
        'Resultados não unânimes. A metanálise de Lima (17 estudos) compara pessoas com e sem valgo dinâmico e encontrou menor dorsiflexão no grupo com valgo, com resultado na mesma direção para a dorsiflexão medida em carga e sem carga; é transversal, e o resumo não informa o registro do protocolo nem a heterogeneidade. Em adultos com e sem dor patelofemoral, a dorsiflexão medida com o joelho flexionado não se correlacionou com o ângulo de projeção frontal (Hassan: teste de descida de degrau em 70 pessoas com dor patelofemoral e 70 assintomáticas). Macrum (30 adultos, agachamento bipodal) simulou a limitação com uma cunha, com efeito pequeno sobre o ângulo de valgo; Wyndow (30 adultos assintomáticos, agachamento unipodal em vídeo 2D) relacionou a dorsiflexão e a mobilidade do médio-pé ao ângulo. Nenhum testou diferença entre os lados. A associação não estabelece causalidade.',
    },
    {
      id: 'forca_do_quadril',
      texto:
        'A fraqueza dos abdutores e dos rotadores externos do quadril é uma hipótese frequente para o valgo, mas as revisões sistemáticas não a sustentam de forma consistente.',
      forca: 'revisao_sistematica',
      fontes: [F.alzahrani2021, F.cashman2026],
      ressalva:
        'Evidência conflitante em adultos assintomáticos: a revisão de 2021 (7 estudos transversais com análise 2D, qualidade de 5 a 7 de 8 pela lista do JBI, só 3 com controle de confundidores) descreve a relação como conflitante; a de 2026, com metanálise parcial de 22 artigos, não obteve significância em nenhuma metanálise e conclui que a fraqueza pode não estar associada a maior valgo dinâmico (o resumo não informa registro de protocolo nem avaliação do risco de viés). Não use a força do quadril como explicação por padrão.',
    },
    {
      id: 'dor_ou_lesao_previa',
      texto:
        'Instabilidade crônica do tornozelo e dor patelofemoral foram associadas a maior ângulo de valgo dinâmico; antecedente desse tipo pode contribuir para o valgo medido.',
      forca: 'observacional',
      fontes: [F.emamvirdi2023],
      ressalva:
        '60 atletas de basquete mulheres; agachamento unipodal em vídeo 2D, medido nos dois lados, com cálculo amostral de efeito pequeno. Estudo transversal: não mostra se o valgo antecede a dor ou a acompanha. Não vale para quem não tem esse antecedente.',
    },
    {
      id: 'projecao_2d',
      texto:
        'O ângulo 2D de projeção do joelho concordou mal com o ângulo 3D no agachamento unipodal em uma revisão com metanálise, e um estudo de validação de estimativa de pose 2D encontrou o mesmo para o ângulo frontal do joelho; a medida 2D deste vídeo pode estar distante do ângulo real e deve ser lida como observação.',
      forca: 'meta_analise',
      fontes: [F.lopes2018, F.haberkamp2022],
      ressalva:
        'Lopes (revisão com metanálise de 16 estudos): a confiabilidade da análise 2D variou de moderada a excelente, mas a concordância com a medida 3D foi fraca no agachamento unipodal (r = 0,127) e melhor na aterrissagem; os autores concluem que a evidência atual não sustenta o uso da análise 2D quando se exige medida exata (o resumo não informa registro de protocolo nem risco de viés). Haberkamp validou uma estimativa de pose 2D por inteligência artificial, como a deste app, em atletas adolescentes no agachamento unipodal: relações moderadas a fortes nos ângulos sagitais (r de 0,68 a 0,94), regulares no quadril e na pelve no plano frontal e fraca no ângulo frontal do joelho (r = 0,20); o número de participantes não consta no resumo. Os dois são do agachamento unipodal, não do bipodal medido neste app: use o valgo deste vídeo como observação e não como medida exata.',
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
      fontes: [F.song2021, F.roos2014, F.strong2023],
      ressalva:
        'População específica: atletas de 0 a 12 meses após reconstrução do ligamento cruzado anterior (Song: 17 atletas, com cálculo amostral e correção de Benjamini-Hochberg, mas amostra heterogênea), adultos com lesão ou reconstrução (Roos: 62 pessoas) e 24 pessoas avaliadas três vezes após a reconstrução, com 29 controles (Strong), todos com plataformas de força e análise tridimensional. Correlação não indica que o deslocamento seja a origem da assimetria, e não há dado nestas fontes para pessoas sem esse antecedente. Strong encontrou assimetria de momentos do joelho nas fases inicial e intermediária e nenhuma diferença do grupo controle no retorno ao esporte, com padrões individuais diferentes (alguns descarregam o joelho operado e outros o sobrecarregam).',
    },
    {
      id: 'quadriceps_de_um_lado',
      texto:
        'Déficit de força do quadríceps de um dos lados foi associado a menor momento extensor do joelho nesse lado no agachamento, o que pode contribuir para um apoio mais carregado no lado oposto.',
      forca: 'observacional',
      fontes: [F.ishida2023],
      ressalva:
        '26 pessoas com mais de 1 ano após reconstrução do ligamento cruzado anterior, com cálculo amostral prévio e grupo de força baixa de 8. O estudo mediu momentos articulares com análise tridimensional e não o deslocamento da pelve: a ligação com o deslocamento lateral é uma inferência.',
    },
    {
      id: 'dominancia_do_membro',
      texto: 'Preferência de apoio ou dominância de um dos membros pode contribuir para um apoio desigual mesmo sem lesão.',
      forca: 'observacional',
      fontes: [F.hannan2022],
      ressalva:
        'Estudo cruzado com 18 adultos saudáveis; a diferença descrita é de força de reação do solo e de centro de pressão. É um único estudo e não mediu o deslocamento da pelve.',
    },
  ],
  conferir: [
    { texto: 'Perguntar sobre cirurgia ou lesão em joelho, quadril ou tornozelo e sobre dor unilateral.', fonte: F.strong2023 },
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
