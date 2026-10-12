import {
  anguloCoxa, anguloJoelho, anguloQuadril, anguloTibia, anguloTornozelo, anguloValgo, elevacaoBraco, elevacaoRelativaAoTronco, inclinacaoLateralTronco,
  inclinacaoTronco, linhaDaPelve, linhaDosOmbros, type DefinicaoAngulo,
} from './angulos';

export type IdGesto = 'marcha' | 'corrida' | 'agachamento' | 'salto' | 'ombro';

export interface DescricaoMetrica {
  /** Chave da métrica (ResultadoMetrica.metrica) e da tabela de referências. */
  metrica: string;
  nome: string;
  unidade: string;
  /** Calculada para cada lado (D e E). */
  porLado: boolean;
  /** Só sai com a escala (cm por pixel) informada. */
  requerEscala?: boolean;
  /** Só sai com câmera parada e o paciente se deslocando pelo quadro (não vale em esteira nem com câmera que acompanha). */
  requerCameraFixa?: boolean;
  /** Só faz sentido com eventos do ciclo (contato e saída do pé). */
  requerEventos?: boolean;
}

export interface ModeloGesto {
  id: IdGesto;
  nome: string;
  descricao: string;
  /** Vista do paciente em que o gesto é analisado. */
  vista: 'lateral' | 'frontal';
  /** Como gravar para a análise funcionar. */
  gravacao: string[];
  /** Quadros por segundo sugeridos para o rastreio (mais quadros = tempos mais precisos, porém mais lento). */
  fpsSugerido: number;
  /** Todos os ângulos que o gesto acompanha. */
  articulacoes: DefinicaoAngulo[];
  /** Ids dos ângulos mostrados no gráfico ao abrir. */
  graficoPadrao: string[];
  /** Tipo de evento do ciclo que o gesto usa (contato e saída do pé), se algum. */
  eventos: 'marcha' | 'corrida' | null;
  metricas: DescricaoMetrica[];
  /** Cuidados de interpretação específicos do gesto. */
  avisos: string[];
}

const D = 'D' as const, E = 'E' as const;
const ambos = <T>(f: (lado: typeof D | typeof E) => T): T[] => [f(D), f(E)];

const GRAVAR_LATERAL = [
  'Grave de lado (câmera perpendicular ao movimento), com a câmera parada, na altura do quadril e o corpo inteiro no quadro.',
  'Boa luz e roupa justa, para o detector enxergar as articulações.',
];

export const MODELOS_GESTO: ModeloGesto[] = [
  {
    id: 'marcha',
    nome: 'Marcha (caminhada)',
    descricao: 'Ângulos de quadril, joelho e tornozelo ao longo do ciclo, tempos de apoio e balanço, cadência e simetria entre os lados.',
    vista: 'lateral',
    gravacao: [...GRAVAR_LATERAL, 'Pelo menos 6 passos seguidos, em ritmo confortável; vídeos de 5 a 30 s.'],
    fpsSugerido: 30,
    articulacoes: [...ambos(anguloQuadril), ...ambos(anguloJoelho), ...ambos(anguloTornozelo), ...ambos(anguloCoxa), ...ambos(anguloTibia), inclinacaoTronco],
    graficoPadrao: ['joelho_d', 'joelho_e'],
    eventos: 'marcha',
    metricas: [
      { metrica: 'cadencia', nome: 'Cadência', unidade: 'passos/min', porLado: false, requerEventos: true },
      { metrica: 'tempo_passada', nome: 'Tempo da passada', unidade: 's', porLado: true, requerEventos: true },
      { metrica: 'tempo_passo', nome: 'Tempo do passo', unidade: 's', porLado: true, requerEventos: true },
      { metrica: 'tempo_apoio', nome: 'Tempo de apoio', unidade: 's', porLado: true, requerEventos: true },
      { metrica: 'apoio_pct', nome: 'Apoio (% do ciclo)', unidade: '% do ciclo', porLado: true, requerEventos: true },
      { metrica: 'tempo_balanco', nome: 'Tempo de balanço', unidade: 's', porLado: true, requerEventos: true },
      { metrica: 'balanco_pct', nome: 'Balanço (% do ciclo)', unidade: '% do ciclo', porLado: true, requerEventos: true },
      { metrica: 'adm_quadril', nome: 'Amplitude do quadril', unidade: '°', porLado: true },
      { metrica: 'adm_joelho', nome: 'Amplitude do joelho', unidade: '°', porLado: true },
      { metrica: 'adm_tornozelo', nome: 'Amplitude do tornozelo', unidade: '°', porLado: true },
      { metrica: 'flexao_joelho_pico_balanco', nome: 'Pico de flexão do joelho no balanço', unidade: '°', porLado: true, requerEventos: true },
      { metrica: 'inclinacao_tronco', nome: 'Inclinação do tronco', unidade: '°', porLado: false },
      { metrica: 'assimetria_tempo_passo', nome: 'Assimetria do tempo de passo (D×E)', unidade: '%', porLado: false, requerEventos: true },
      { metrica: 'assimetria_tempo_apoio', nome: 'Assimetria do tempo de apoio (D×E)', unidade: '%', porLado: false, requerEventos: true },
      { metrica: 'assimetria_adm_joelho', nome: 'Assimetria da amplitude do joelho (D×E)', unidade: '%', porLado: false },
      { metrica: 'comprimento_passo', nome: 'Comprimento do passo', unidade: 'cm', porLado: true, requerEscala: true, requerEventos: true },
      { metrica: 'comprimento_passada', nome: 'Comprimento da passada', unidade: 'cm', porLado: false, requerEscala: true, requerEventos: true },
      { metrica: 'velocidade_marcha', nome: 'Velocidade estimada', unidade: 'cm/s', porLado: false, requerEscala: true, requerEventos: true },
    ],
    avisos: [
      'Na gravação de lado, a perna mais distante da câmera é menos confiável: dê mais peso aos ângulos da perna mais próxima.',
      'O vídeo não separa a rotação nem a inclinação da pelve: os ângulos são projeções no plano da imagem.',
    ],
  },
  {
    id: 'corrida',
    nome: 'Corrida',
    descricao: 'Ângulos de quadril e joelho, tíbia no contato, inclinação do tronco, cadência e tempos de contato e de voo.',
    vista: 'lateral',
    gravacao: [
      ...GRAVAR_LATERAL,
      'Em esteira ou em linha reta, pelo menos 8 passadas; vídeos de 5 a 30 s.',
      'Quanto mais quadros por segundo, melhor: Souza (2016; PMID 26616185) cita câmeras com taxa maior (por exemplo, ≥120 Hz) como mais adequadas à cinemática da corrida, e, no mínimo, duas vistas em ângulo reto.',
    ],
    fpsSugerido: 60,
    articulacoes: [...ambos(anguloQuadril), ...ambos(anguloJoelho), ...ambos(anguloTornozelo), ...ambos(anguloCoxa), ...ambos(anguloTibia), inclinacaoTronco],
    graficoPadrao: ['joelho_d', 'joelho_e'],
    eventos: 'corrida',
    metricas: [
      { metrica: 'cadencia', nome: 'Cadência', unidade: 'passos/min', porLado: false, requerEventos: true },
      { metrica: 'tempo_passada', nome: 'Tempo da passada', unidade: 's', porLado: true, requerEventos: true },
      { metrica: 'tempo_contato', nome: 'Tempo de contato', unidade: 'ms', porLado: true, requerEventos: true },
      { metrica: 'tempo_voo', nome: 'Tempo de voo', unidade: 'ms', porLado: false, requerEventos: true },
      { metrica: 'flexao_joelho_contato', nome: 'Flexão do joelho no contato', unidade: '°', porLado: true, requerEventos: true },
      { metrica: 'flexao_joelho_pico_apoio', nome: 'Pico de flexão do joelho no apoio', unidade: '°', porLado: true, requerEventos: true },
      { metrica: 'angulo_tibia_contato', nome: 'Ângulo da tíbia no contato', unidade: '°', porLado: true, requerEventos: true },
      { metrica: 'adm_quadril', nome: 'Amplitude do quadril', unidade: '°', porLado: true },
      { metrica: 'adm_joelho', nome: 'Amplitude do joelho', unidade: '°', porLado: true },
      { metrica: 'inclinacao_tronco', nome: 'Inclinação do tronco', unidade: '°', porLado: false },
      { metrica: 'inclinacao_tronco_contato', nome: 'Inclinação do tronco no contato', unidade: '°', porLado: false, requerEventos: true },
      { metrica: 'assimetria_tempo_contato', nome: 'Assimetria do tempo de contato (D×E)', unidade: '%', porLado: false, requerEventos: true },
      { metrica: 'assimetria_adm_joelho', nome: 'Assimetria da amplitude do joelho (D×E)', unidade: '%', porLado: false },
      { metrica: 'comprimento_passada', nome: 'Comprimento da passada', unidade: 'cm', porLado: false, requerEscala: true, requerCameraFixa: true, requerEventos: true },
      { metrica: 'velocidade_corrida', nome: 'Velocidade estimada', unidade: 'cm/s', porLado: false, requerEscala: true, requerCameraFixa: true, requerEventos: true },
    ],
    avisos: [
      'Os tempos de contato e de voo são curtos: cada quadro vale 1/fps de erro (a 30 quadros/s, cerca de 33 ms). Confira os eventos no quadro a quadro.',
      'Segundo Souza (2016), ainda não existem pontos de corte para classificar a cinemática da corrida como anormal ou preditiva de lesão: os números descrevem, não diagnosticam.',
      'Souza (2016) relata que, em uma câmera só, a reprodutibilidade varia muito entre as medidas (por exemplo, boa para a flexão do joelho e ruim para a distância calcanhar–centro de massa).',
    ],
  },
  {
    id: 'agachamento',
    nome: 'Agachamento',
    descricao: 'Flexão de joelho e quadril, dorsiflexão, inclinação do tronco, profundidade e repetições.',
    vista: 'lateral',
    gravacao: [...GRAVAR_LATERAL, 'Em pé, de lado, com os pés inteiros no quadro; 3 a 5 repetições, vídeos de 5 a 30 s.'],
    fpsSugerido: 15,
    articulacoes: [...ambos(anguloQuadril), ...ambos(anguloJoelho), ...ambos(anguloTornozelo), ...ambos(anguloCoxa), ...ambos(anguloTibia), inclinacaoTronco],
    graficoPadrao: ['joelho_d', 'quadril_d'],
    eventos: null,
    metricas: [
      { metrica: 'repeticoes', nome: 'Repetições', unidade: '', porLado: false },
      { metrica: 'tempo_repeticao', nome: 'Tempo por repetição', unidade: 's', porLado: false },
      { metrica: 'flexao_joelho_max', nome: 'Flexão máxima do joelho', unidade: '°', porLado: true },
      { metrica: 'flexao_quadril_max', nome: 'Flexão máxima do quadril', unidade: '°', porLado: true },
      { metrica: 'dorsiflexao_max', nome: 'Dorsiflexão máxima do tornozelo', unidade: '°', porLado: true },
      { metrica: 'inclinacao_tronco_max', nome: 'Inclinação máxima do tronco', unidade: '°', porLado: false },
      { metrica: 'profundidade_quadril', nome: 'Profundidade (quadril em relação ao joelho)', unidade: '% da coxa', porLado: false },
      { metrica: 'adm_joelho', nome: 'Amplitude do joelho', unidade: '°', porLado: true },
    ],
    avisos: [
      'De lado, o detector confunde mais facilmente os dois membros no fundo da posição; confira o quadro de maior flexão.',
    ],
  },
  {
    id: 'salto',
    nome: 'Aterrissagem de salto (valgo dinâmico)',
    descricao: 'Alinhamento do joelho no plano frontal na aterrissagem: desvio do joelho e razão entre as distâncias dos joelhos e dos tornozelos.',
    vista: 'frontal',
    gravacao: [
      'Grave de frente, com a câmera parada na altura do quadril, o corpo inteiro no quadro e os dois pés visíveis.',
      'Salto com aterrissagem nos dois pés; vídeos curtos, com 60 quadros/s ou mais se possível.',
    ],
    fpsSugerido: 60,
    articulacoes: [...ambos(anguloValgo), linhaDaPelve, linhaDosOmbros, inclinacaoLateralTronco],
    graficoPadrao: ['valgo_d', 'valgo_e'],
    eventos: null,
    metricas: [
      { metrica: 'valgo_contato', nome: 'Desvio do joelho no contato', unidade: '°', porLado: true },
      { metrica: 'valgo_max', nome: 'Desvio máximo do joelho na aterrissagem', unidade: '°', porLado: true },
      { metrica: 'kasr_contato', nome: 'Razão joelho/tornozelo no contato', unidade: 'razão', porLado: false },
      { metrica: 'kasr_min', nome: 'Menor razão joelho/tornozelo na aterrissagem', unidade: 'razão', porLado: false },
    ],
    avisos: [
      'Em 16 adultos saudáveis, a razão joelho–tornozelo (KASR) em vídeo 2D concordou muito bem com o 3D (ICC 0,96), mas o ângulo de projeção no plano frontal concordou pouco (ICC de 0 a 0,57): prefira a razão e use o ângulo com cautela (Ortiz et al., 2016; PMID 27313480).',
      'A razão e o ângulo são projeções no plano da imagem; a rotação do quadril e do pé muda a leitura.',
    ],
  },
  {
    id: 'ombro',
    nome: 'Elevação do braço / ombro',
    descricao: 'Elevação de cada braço, assimetria entre os lados, compensação do tronco e tempo até o pico.',
    vista: 'frontal',
    gravacao: [
      'Grave de frente (ou de lado, para flexão), com a câmera parada, o tronco e os dois braços inteiros no quadro.',
      'Repita a elevação 3 a 5 vezes, em ritmo lento; vídeos de 5 a 30 s.',
    ],
    fpsSugerido: 15,
    articulacoes: [...ambos(elevacaoBraco), ...ambos(elevacaoRelativaAoTronco), inclinacaoLateralTronco, linhaDosOmbros],
    graficoPadrao: ['elevacao_d', 'elevacao_e'],
    eventos: null,
    metricas: [
      { metrica: 'elevacao_max', nome: 'Elevação máxima do braço', unidade: '°', porLado: true },
      { metrica: 'elevacao_tronco_max', nome: 'Elevação máxima em relação ao tronco', unidade: '°', porLado: true },
      { metrica: 'tempo_ate_pico', nome: 'Tempo até o pico', unidade: 's', porLado: false },
      { metrica: 'assimetria_elevacao', nome: 'Assimetria da elevação máxima (D×E)', unidade: '%', porLado: false },
      { metrica: 'compensacao_tronco', nome: 'Compensação do tronco', unidade: '°', porLado: false },
    ],
    avisos: [
      'A elevação medida no vídeo é a do braço em relação à vertical da imagem, não a do osso úmero em relação à escápula: inclui o movimento da escápula e do tronco.',
    ],
  },
];

export function modeloDoGesto(id: IdGesto): ModeloGesto {
  const modelo = MODELOS_GESTO.find((m) => m.id === id);
  if (!modelo) throw new Error(`Gesto desconhecido: ${id}`);
  return modelo;
}
