import type { EntradaBiblioteca, FatorContribuinte } from '../tipos';
import { FONTES as F } from './fontes';

/*
 * Hipóteses para os achados da marcha filmada de lado. Muitas fontes são de populações com doença (osteoartrite): cada ressalva diz quem foi
 * estudado para ninguém extrapolar para quem não tem a condição. Depois da avaliação metodológica (docs/avaliacao-metodologica-fontes.md) saíram as
 * fontes de AVC (população e desfecho diferentes do achado, revisão narrativa, subgrupos exploratórios), as séries de casos e os estudos de antes e
 * depois sem controle; os fatores que ficaram sem fonte retida foram eliminados.
 */

const COMPRIMENTO_DOS_MEMBROS: FatorContribuinte = {
  id: 'comprimento_dos_membros',
  texto: 'Diferença de comprimento entre os membros inferiores foi associada a desvios e assimetrias da marcha e pode contribuir para a diferença entre os lados.',
  forca: 'revisao_sistematica',
  fontes: [F.khamis2017],
  ressalva:
    'A revisão (12 estudos, avaliados pela escala MINORS) reúne 4 estudos com diferença anatômica e 8 com diferença simulada por elevações de 1 a 5 cm em pessoas saudáveis, que respondem perguntas diferentes; o resumo não detalha em quais desfechos (ângulos, tempos ou forças) aparecem os desvios, e não há desfecho específico para este achado. Os autores indicam que desvios podem ocorrer com diferenças acima de 1 cm, com compensações nos dois membros. O registro do protocolo e a seleção em duplicata não constam no resumo.',
};

export const ASSIMETRIA_TEMPO_APOIO: EntradaBiblioteca = {
  chave: 'assimetria_tempo_apoio',
  titulo: 'Diferença entre os lados no tempo de apoio (marcha)',
  fatores: [
    {
      id: 'dor_ou_doenca_articular_unilateral',
      texto:
        'Osteoartrite de quadril foi associada a assimetria temporal na marcha, com apoio mais curto no membro afetado; uma condição articular unilateral desse tipo pode contribuir para a diferença no tempo de apoio.',
      forca: 'meta_analise',
      fontes: [F.constantinou2014, F.corrigan2023],
      ressalva:
        'A metanálise (30 artigos, 11 bases) trata de osteoartrite de quadril; o resumo não informa o registro do protocolo, o instrumento de qualidade nem a heterogeneidade. Evidência mista para a dor no joelho: em pessoas com dor unilateral leve a moderada no joelho de uma coorte (Corrigan: análise exploratória, com ajuste de confundidores e passarela de tempo, não vídeo), a gravidade da dor não se associou à assimetria temporal; só medidas específicas de apoio se relacionaram à dor depois de 2 anos. Não se aplica a quem não tem queixa articular.',
    },
    COMPRIMENTO_DOS_MEMBROS,
    {
      id: 'velocidade_e_eventos',
      texto:
        'A variação da velocidade entre as passadas e o erro na marcação dos eventos de contato e de saída do pé podem contribuir para uma diferença no tempo de apoio.',
      forca: 'a_confirmar',
      fontes: [],
      ressalva:
        'Sem referência verificada nesta biblioteca: decorre do método (cada evento tem erro de um quadro e as passadas de cada pé são de instantes diferentes) e deve ser conferido quadro a quadro.',
    },
  ],
  conferir: [
    { texto: 'Perguntar sobre dor, rigidez ou cirurgia em quadril, joelho, tornozelo e coluna, e de qual lado.', fonte: F.constantinou2014 },
    { texto: 'Medir o comprimento dos membros inferiores (real e aparente) nos dois lados.', fonte: F.khamis2017 },
    { texto: 'Conferir quadro a quadro os eventos de contato e de saída do pé usados nas passadas de cada lado.', semReferenciaVerificada: true },
    { texto: 'Se possível, repetir a gravação com mais passadas e velocidade mais constante.', semReferenciaVerificada: true },
  ],
};

export const ASSIMETRIA_FLEXAO_JOELHO_MARCHA: EntradaBiblioteca = {
  chave: 'assimetria_flexao_joelho_marcha',
  titulo: 'Diferença entre os lados no pico de flexão do joelho no balanço (marcha)',
  fatores: [
    {
      id: 'flexores_plantares',
      texto:
        'A redução experimental da força dos flexores plantares (cerca de 33%) em adultos jovens saudáveis foi acompanhada de menor pico de flexão do joelho no balanço, e a menor velocidade da flexão plantar na saída do pé se correlacionou com essa redução; fraqueza desse grupo pode contribuir para a diferença entre os lados.',
      forca: 'experimental',
      fontes: [F.apti2016],
      ressalva:
        'Apti: 20 adultos jovens saudáveis avaliados antes e depois de um alongamento passivo que reduziu a força em cerca de 33%, mais 7 controles para separar o efeito da marcha lenta, com análise tridimensional; não há randomização nem cegamento descritos, e o título e o resumo usam linguagem causal (aqui lida como associação). A fraqueza induzida de forma aguda não equivale a uma fraqueza crônica. O estudo não compara os lados.',
    },
    {
      id: 'dor_ou_osteoartrite_joelho_quadril',
      texto:
        'Osteoartrite de quadril e de joelho foi associada a menor amplitude de movimento do joelho e, no joelho mais doloroso, a menor flexão na marcha, em comparação com controles; condição desse tipo pode estar relacionada a alterações da marcha, mas as fontes não compararam um lado com o outro.',
      forca: 'observacional',
      fontes: [F.steingrebe2023, F.creaby2012],
      ressalva:
        'A metanálise (35 estudos, registrada, com risco de viés pela lista de Downs e Black e grande heterogeneidade entre os estudos) é de osteoartrite de quadril: compara pessoas com a doença e controles saudáveis (excluiu estudos que usavam o membro contralateral como controle ou que analisavam medidas de assimetria) e descreve amplitudes reduzidas nos ângulos do quadril e sagital do joelho, também no lado contralateral. Os autores avisam que a maioria dos intervalos de predição dos resultados significativos cruza o zero e que só 10 de 68 análises da marcha reúnem 5 ou mais estudos. Creaby (91 pessoas com osteoartrite medial de joelho e 31 controles, com ajuste pela velocidade) descreve menor flexão no joelho mais doloroso em relação aos controles; as assimetrias entre os joelhos que descreve são de ângulo varo e de momento flexor externo, e não de ângulo de flexão. Os resumos não especificam que o pico seja o do balanço: a direção é a mesma, mas não é necessariamente a mesma medida. Nenhuma fonte testou a diferença entre os lados no pico de flexão do joelho; por isso o tipo de estudo é "observacional".',
    },
    COMPRIMENTO_DOS_MEMBROS,
  ],
  conferir: [
    { texto: 'Testar a força dos flexores plantares de cada lado (por exemplo, com dinamometria) e a mobilidade do tornozelo.', fonte: F.apti2016 },
    { texto: 'Perguntar sobre dor, derrame ou cirurgia no joelho e sobre entorses.', semReferenciaVerificada: true },
    { texto: 'Medir o comprimento dos membros inferiores nos dois lados.', fonte: F.khamis2017 },
    { texto: 'Conferir se o membro mais distante da câmera foi detectado corretamente na fase de balanço.', semReferenciaVerificada: true },
  ],
};

export const ASSIMETRIA_AMPLITUDE_QUADRIL: EntradaBiblioteca = {
  chave: 'assimetria_amplitude_quadril',
  titulo: 'Diferença entre os lados na amplitude do quadril (marcha)',
  fatores: [
    {
      id: 'restricao_de_mobilidade_do_quadril',
      texto:
        'Osteoartrite e restrição de mobilidade do quadril foram associadas a menor amplitude de movimento do quadril na marcha, em comparação com controles, e a extensão passiva do quadril se relacionou com a extensão alcançada na marcha em pessoas com osteoartrite; condição desse tipo pode estar relacionada a menor amplitude do quadril, mas as fontes não compararam um lado com o outro.',
      forca: 'observacional',
      fontes: [F.steingrebe2023, F.baker2016],
      ressalva:
        'A metanálise (35 estudos, com grande heterogeneidade) e Baker (osteoartrite de quadril moderada e grave e grupo assintomático; o número de participantes não consta no resumo) tratam de pessoas com osteoartrite de quadril; entre pessoas assintomáticas não houve correlação entre a extensão passiva e a extensão na marcha (r = 0,139 no estudo). A metanálise compara com controles saudáveis, excluiu estudos que usavam o membro contralateral como controle ou que analisavam medidas de assimetria, e descreve alterações também no lado contralateral (menor extensão do quadril contralateral); os autores avisam que a maioria dos intervalos de predição dos resultados significativos cruza o zero. Os estudos usam análise tridimensional; neste vídeo o ângulo do quadril (ombro–quadril–joelho) inclui o movimento do tronco e da pelve, então a amplitude medida não é a articular pura. Nenhuma fonte testou a diferença entre os lados; por isso o tipo de estudo é "observacional".',
    },
    COMPRIMENTO_DOS_MEMBROS,
  ],
  conferir: [
    { texto: 'Medir a extensão e a flexão passivas do quadril de cada lado (goniometria).', fonte: F.baker2016 },
    { texto: 'Perguntar sobre dor na virilha, no quadril ou na região lombar de cada lado.', semReferenciaVerificada: true },
    { texto: 'Medir o comprimento dos membros inferiores nos dois lados.', fonte: F.khamis2017 },
    {
      texto: 'Lembrar que o ângulo medido inclui a inclinação do tronco: conferir se a amplitude muda junto com a inclinação do tronco.',
      semReferenciaVerificada: true,
    },
  ],
};

export const INCLINACAO_TRONCO_MARCHA: EntradaBiblioteca = {
  chave: 'inclinacao_tronco_marcha',
  titulo: 'Inclinação do tronco durante a passada (marcha)',
  fatores: [
    {
      id: 'limitacao_de_extensao_do_joelho',
      texto:
        'Uma contratura de flexão do joelho simulada em mulheres saudáveis aumentou a inclinação anterior do tronco e da pelve na marcha; uma limitação de extensão do joelho pode contribuir para a inclinação medida.',
      forca: 'experimental',
      fontes: [F.harato2008],
      ressalva:
        '10 mulheres saudáveis (média de 62 anos) com órtese que simulou a contratura, avaliadas nas duas condições, sem justificativa de amostra no resumo; a contratura menor não mudou o tronco e só a maior (30°) mudou. Contratura simulada não equivale a uma condição clínica real, e a conclusão do resumo sobre desequilíbrio da coluna passa do que foi medido.',
    },
    {
      id: 'osteoartrite_de_joelho',
      texto:
        'Um estudo encontrou mais flexão do tronco na marcha de pessoas com osteoartrite de joelho, mas a metanálise não viu aumento claro no plano sagital (o aumento claro foi na inclinação lateral do tronco). Condição desse tipo pode contribuir para a inclinação medida.',
      forca: 'observacional',
      fontes: [F.preece2019, F.iijima2019],
      ressalva:
        'Evidência mista: a metanálise de 32 artigos (Iijima) viu aumento claro da inclinação lateral do tronco e aumento não significativo da flexão do tronco e da pelve, e classificou todas as medidas como de certeza muito baixa pelo método GRADE; Preece relata aumento médio de 2,6° na flexão do tronco em captura 3D (o resumo não informa o número de participantes). A diferença média é pequena e pode ficar dentro da incerteza do vídeo.',
    },
    {
      id: 'piso_inclinado',
      texto:
        'Caminhar em subida aumentou a inclinação anterior do tronco e da pelve; piso ou esteira com inclinação durante a gravação pode contribuir para a inclinação medida.',
      forca: 'experimental',
      fontes: [F.leroux2002],
      ressalva:
        '8 adultos saudáveis em esteira com 0, 5 e 10% de inclinação, avaliados em todas as inclinações; na descida houve inclinação para trás. Mostra o efeito do terreno e vale como lembrete de conferir o nivelamento do local de gravação.',
    },
  ],
  conferir: [
    { texto: 'Conferir se o piso ou a esteira estavam nivelados durante a gravação.', fonte: F.leroux2002 },
    { texto: 'Perguntar sobre dor ou rigidez no joelho, no quadril e na coluna lombar.', fonte: F.preece2019 },
    { texto: 'Medir a extensão passiva do joelho e do quadril de cada lado.', fonte: F.harato2008 },
    {
      texto: 'Observar a coluna no exame presencial: o vídeo mede a reta quadril–ombro e não a curvatura da coluna.',
      semReferenciaVerificada: true,
    },
  ],
};
