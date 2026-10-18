import type { EntradaBiblioteca, FatorContribuinte } from '../tipos';
import { FONTES as F } from './fontes';

/*
 * Hipóteses para os achados da marcha filmada de lado. Muitas fontes são de populações com doença (osteoartrite, AVC): cada
 * ressalva diz quem foi estudado para ninguém extrapolar para quem não tem a condição.
 */

const COMPRIMENTO_DOS_MEMBROS: FatorContribuinte = {
  id: 'comprimento_dos_membros',
  texto: 'Diferença de comprimento entre os membros inferiores foi associada a desvios e assimetrias da marcha e pode contribuir para a diferença entre os lados.',
  forca: 'revisao_sistematica',
  fontes: [F.khamis2017, F.seeley2010],
  ressalva:
    'A revisão (12 estudos) inclui diferença anatômica e diferença simulada com elevações em pessoas saudáveis, sem desfecho específico para este achado. Seeley (26 adultos sem doença) relacionou a diferença leve de comprimento à simetria de momentos e potências do joelho e do tornozelo, e não de ângulos ou tempos. Os autores lembram que outros fatores também contribuem para assimetrias em pessoas sem doença.',
};

export const ASSIMETRIA_TEMPO_APOIO: EntradaBiblioteca = {
  chave: 'assimetria_tempo_apoio',
  titulo: 'Diferença entre os lados no tempo de apoio (marcha)',
  fatores: [
    {
      id: 'dor_ou_doenca_articular_unilateral',
      texto:
        'Dor ou doença articular unilateral, como a osteoartrite de quadril ou a dor no joelho, foi associada a assimetria temporal na marcha (na osteoartrite de quadril, com apoio mais curto no membro afetado); condição desse tipo pode contribuir para a diferença no tempo de apoio.',
      forca: 'meta_analise',
      fontes: [F.constantinou2014, F.lugade2010, F.murray1985, F.corrigan2023],
      ressalva:
        'A metanálise (30 artigos) trata de osteoartrite de quadril; Lugade (23 pacientes antes de artroplastia) e Murray (35 homens com dor unilateral no joelho, estudo de 1985) são observacionais. Evidência mista: em pessoas com dor unilateral no joelho de uma coorte, a gravidade da dor não se associou à assimetria temporal (Corrigan). Não se aplica a quem não tem queixa articular.',
    },
    COMPRIMENTO_DOS_MEMBROS,
    {
      id: 'equilibrio_apos_avc',
      texto: 'Em pessoas com AVC, a assimetria temporal da marcha foi interpretada como possível estratégia de compensação do controle de equilíbrio do lado mais afetado.',
      forca: 'observacional',
      fontes: [F.staines2026],
      ressalva:
        '31 pessoas com AVC subagudo; a assimetria foi medida no tempo de balanço e não no de apoio, e a interpretação é dos autores, que a descrevem como possível e apenas parcial. Não extrapole para pessoas sem doença neurológica.',
    },
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
        'Menor força dos flexores plantares e menor velocidade da flexão plantar na saída do pé foram associadas a menor pico de flexão do joelho no balanço e podem contribuir para a diferença entre os lados.',
      forca: 'experimental',
      fontes: [F.apti2016, F.fujita2022],
      ressalva:
        'Apti: 20 adultos jovens saudáveis, com redução experimental da força dos flexores plantares por alongamento passivo e análise tridimensional (o título e o resumo usam linguagem causal; aqui é lido como associação). Fujita: 38 pessoas com AVC crônico, com associação entre a velocidade da flexão plantar na saída do pé e o ângulo de flexão do joelho no balanço. Nenhum compara os lados.',
    },
    {
      id: 'alteracoes_neuromotoras_apos_avc',
      texto:
        'Após AVC, alterações neuromotoras (atividade dos extensores do joelho, tônus, incoordenação e propulsão reduzida) são discutidas como mecanismos da menor flexão do joelho no balanço.',
      forca: 'observacional',
      fontes: [F.fujita2022, F.krajewski2025],
      ressalva:
        'População específica (AVC). Krajewski é uma revisão narrativa que discute esses mecanismos e conclui que ainda falta uma definição comum e mais estudos; Fujita é um estudo transversal. Não extrapole para pessoas sem doença neurológica.',
    },
    {
      id: 'dor_ou_osteoartrite_joelho_quadril',
      texto:
        'Osteoartrite de quadril e de joelho foi associada a menor amplitude de movimento do joelho e a menor flexão do joelho mais doloroso na marcha; condição desse tipo pode contribuir para a diferença entre os lados.',
      forca: 'meta_analise',
      fontes: [F.steingrebe2023, F.creaby2012],
      ressalva:
        'A metanálise (35 estudos) é de osteoartrite de quadril e descreve amplitudes reduzidas nos ângulos do quadril e sagital do joelho, com grande heterogeneidade entre os estudos; Creaby (91 pessoas com osteoartrite de joelho) descreve menor flexão no joelho mais doloroso. Os resumos não especificam que o pico seja o do balanço: a direção é a mesma, mas não é necessariamente a mesma medida.',
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
        'Osteoartrite e restrição de mobilidade do quadril foram associadas a menor amplitude de movimento do quadril na marcha, e a extensão passiva do quadril se relacionou com a extensão alcançada na marcha; condição desse tipo pode contribuir para a diferença entre os lados.',
      forca: 'meta_analise',
      fontes: [F.steingrebe2023, F.baker2016],
      ressalva:
        'População com osteoartrite de quadril (moderada e grave em Baker); entre pessoas assintomáticas não houve correlação entre a extensão passiva e a extensão na marcha (r = 0,139 no estudo). Os estudos usam análise tridimensional; neste vídeo o ângulo do quadril (ombro–quadril–joelho) inclui o movimento do tronco e da pelve, então a amplitude medida não é a articular pura.',
    },
    {
      id: 'tensao_dos_flexores_do_quadril',
      texto:
        'A menor extensão do quadril na marcha de idosos foi interpretada pelos autores como possível restrição de mobilidade do quadril, mas a evidência de que o alongamento dos flexores mude a cinemática é mista.',
      forca: 'observacional',
      fontes: [F.kerrigan2001, F.mettler2019],
      ressalva:
        'Kerrigan: 23 idosos saudáveis e 16 idosos com quedas, comparados com 30 adultos jovens (diferença entre grupos e não entre lados); a interpretação de restrição é dos autores. Mettler: em 20 pessoas com extensão passiva limitada, 3 semanas de alongamento dos flexores do quadril aumentaram a extensão passiva sem mudar a cinemática da corrida submáxima. É uma hipótese a confirmar no exame.',
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
        '10 mulheres saudáveis (média de 62 anos) com órtese que simulou a contratura; a contratura menor não mudou o tronco e só a maior mudou. Contratura simulada não equivale a uma condição clínica real.',
    },
    {
      id: 'osteoartrite_de_joelho',
      texto:
        'Pessoas com osteoartrite de joelho caminharam com mais flexão do tronco, e a inclinação anterior do tronco diminuiu depois da artroplastia total do joelho; condição desse tipo pode contribuir para a inclinação medida.',
      forca: 'observacional',
      fontes: [F.preece2019, F.tsutsumi2026, F.iijima2019],
      ressalva:
        'Evidência mista: a metanálise de 32 artigos (Iijima) viu aumento claro da inclinação lateral do tronco e aumento não significativo da flexão do tronco e da pelve; Preece relata aumento médio de 2,6° na flexão do tronco; Tsutsumi (24 pacientes) avaliou os mesmos pacientes antes e depois da cirurgia. A diferença média é pequena e pode ficar dentro da incerteza do vídeo.',
    },
    {
      id: 'condicao_do_quadril',
      texto:
        'Após fratura de acetábulo, pacientes caminharam com maior inclinação anterior do tronco do que pessoas sem a lesão; condição do quadril pode contribuir para a inclinação medida.',
      forca: 'observacional',
      fontes: [F.borrelli2002],
      ressalva: 'Série de 15 pacientes comparados com grupos sem lesão; foi a única diferença na posição dos segmentos. Amostra pequena e população específica.',
    },
    {
      id: 'piso_inclinado',
      texto:
        'Caminhar em subida aumentou a inclinação anterior do tronco e da pelve; piso ou esteira com inclinação durante a gravação pode contribuir para a inclinação medida.',
      forca: 'experimental',
      fontes: [F.leroux2002],
      ressalva:
        '8 adultos saudáveis em esteira com 0, 5 e 10% de inclinação; na descida houve inclinação para trás. Mostra o efeito do terreno e vale como lembrete de conferir o nivelamento do local de gravação.',
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
