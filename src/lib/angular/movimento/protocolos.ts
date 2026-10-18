import { anguloJoelho, anguloQuadril, anguloTornozelo, anguloValgo, inclinacaoLateralTronco, inclinacaoTronco, linhaDaPelve } from '../video/angulos';
import { modeloDoGesto, type IdGesto } from '../video/modelos';
import type { Lado } from '../video/tipos';
import type {
  AchadoDoProtocolo, AchadoIndisponivel, ChaveAchado, DefAchado, DefGatilho, DefMedidaRepeticao, FaseMovimento, GrandezaMedida, IdProtocolo, PlanoCamera, Protocolo,
  TipoGatilho,
} from './tipos';
import { ROTULO_PLANO } from './vocabulario';

/*
 * Catálogo de achados, gatilhos e protocolos (agachamento de lado e de frente, marcha de lado). É o texto de produto da Etapa 3:
 * quem implementa a análise (M), o laudo (L) e a biblioteca de hipóteses (R) lê daqui e não redefine nada.
 *
 * Princípios (docs/avaliacao-movimento-v3.md): os protocolos DESCREVEM e MEDEM; não treinam, não dão nota e não diagnosticam.
 * Nenhum gatilho usa limite clínico: a incerteza vem do próprio vídeo, a variação vem das repetições e o único limite possível é o
 * que o profissional define e ativa. Todo texto aqui evita o vocabulário de julgamento (ver vocabulario.ts) e só usa caracteres
 * que o PDF consegue imprimir (Latin-1 mais os que o gerador de PDF converte).
 */

// ---------- catálogo de achados ----------

/**
 * As chaves são fixas e compartilhadas (M gera, L imprime, R tem hipóteses para cada uma). `gatilhos` diz quais regras podem criar
 * o achado; `criterio_profissional` está em todos porque qualquer medida pode receber um critério do profissional (desligado).
 */
export const CATALOGO_ACHADOS: Record<ChaveAchado, DefAchado> = {
  assimetria_flexao_joelho: {
    chave: 'assimetria_flexao_joelho',
    titulo: 'Diferença entre os lados na flexão máxima do joelho',
    oQueCompara: 'Média, entre as repetições, da flexão máxima do joelho direito comparada com a do esquerdo.',
    gatilhos: ['assimetria_entre_lados', 'criterio_profissional'],
    grandeza: 'diferenca_entre_lados',
  },
  assimetria_flexao_quadril: {
    chave: 'assimetria_flexao_quadril',
    titulo: 'Diferença entre os lados na flexão máxima do quadril',
    oQueCompara: 'Média, entre as repetições, da flexão máxima do quadril direito comparada com a do esquerdo.',
    gatilhos: ['assimetria_entre_lados', 'criterio_profissional'],
    grandeza: 'diferenca_entre_lados',
  },
  assimetria_dorsiflexao: {
    chave: 'assimetria_dorsiflexao',
    titulo: 'Diferença entre os lados na dorsiflexão máxima do tornozelo',
    oQueCompara: 'Média, entre as repetições, da dorsiflexão máxima do tornozelo direito comparada com a do esquerdo.',
    gatilhos: ['assimetria_entre_lados', 'criterio_profissional'],
    grandeza: 'diferenca_entre_lados',
  },
  valgo_dinamico: {
    chave: 'valgo_dinamico',
    titulo: 'Valgo dinâmico do joelho: desvio medido na descida',
    oQueCompara: 'Desvio do joelho para dentro em relação à reta quadril–tornozelo, no plano frontal, entre o início e o fundo da repetição, por lado.',
    gatilhos: ['assimetria_entre_lados', 'repeticao_discrepante', 'criterio_profissional'],
    grandeza: 'media_por_lado',
  },
  desvio_lateral_pelve: {
    chave: 'desvio_lateral_pelve',
    titulo: 'Deslocamento lateral da pelve em relação à base de apoio',
    oQueCompara: 'Posição horizontal do ponto médio dos quadris em relação ao ponto médio dos tornozelos, no ponto mais baixo, em % da base de apoio. Positivo = para o lado direito do paciente.',
    gatilhos: ['assimetria_entre_lados', 'repeticao_discrepante', 'criterio_profissional'],
    grandeza: 'modulo_da_media',
  },
  inclinacao_tronco: {
    chave: 'inclinacao_tronco',
    titulo: 'Inclinação do tronco no ponto mais baixo',
    oQueCompara: 'Inclinação da reta quadril–ombro com a vertical no ponto mais baixo e sua variação entre as repetições.',
    gatilhos: ['variacao_entre_repeticoes', 'repeticao_discrepante', 'criterio_profissional'],
    grandeza: 'media',
  },
  avanco_joelho: {
    chave: 'avanco_joelho',
    titulo: 'Avanço do joelho em relação à ponta do pé (observação medida)',
    oQueCompara: 'Posição horizontal do joelho em relação à ponta do pé no ponto mais baixo, em % do comprimento do pé, por lado.',
    gatilhos: ['variacao_entre_repeticoes', 'repeticao_discrepante', 'criterio_profissional'],
    grandeza: 'media_por_lado',
    criterioDebatido: true,
    notaCriterio:
      'O limite de avanço do joelho além do pé é debatido na literatura: nenhum limite vem definido e o critério fica desligado. O número é uma observação medida; só vira veredito se o profissional definir e ativar um critério.',
  },
  variacao_profundidade: {
    chave: 'variacao_profundidade',
    titulo: 'Variação da profundidade entre as repetições',
    oQueCompara: 'Desvio-padrão, entre as repetições, da profundidade atingida no ponto mais baixo.',
    gatilhos: ['variacao_entre_repeticoes', 'repeticao_discrepante', 'criterio_profissional'],
    grandeza: 'desvio_padrao',
  },
  tendencia_na_serie: {
    chave: 'tendencia_na_serie',
    titulo: 'Mudança de uma medida da primeira para a última repetição',
    oQueCompara: 'Última repetição menos a primeira, para uma medida do protocolo, por lado quando a medida é por lado.',
    gatilhos: ['tendencia_primeira_ultima', 'criterio_profissional'],
    grandeza: 'tendencia',
  },
  assimetria_tempo_apoio: {
    chave: 'assimetria_tempo_apoio',
    titulo: 'Diferença entre os lados no tempo de apoio',
    oQueCompara: 'Média do tempo de apoio (do contato inicial à saída do pé) nas passadas do pé direito comparada com a das passadas do pé esquerdo.',
    gatilhos: ['assimetria_entre_lados', 'criterio_profissional'],
    grandeza: 'diferenca_entre_lados',
  },
  assimetria_flexao_joelho_marcha: {
    chave: 'assimetria_flexao_joelho_marcha',
    titulo: 'Diferença entre os lados no pico de flexão do joelho no balanço',
    oQueCompara: 'Média do pico de flexão do joelho na fase de balanço nas passadas do pé direito comparada com a das passadas do pé esquerdo.',
    gatilhos: ['assimetria_entre_lados', 'criterio_profissional'],
    grandeza: 'diferenca_entre_lados',
  },
  assimetria_amplitude_quadril: {
    chave: 'assimetria_amplitude_quadril',
    titulo: 'Diferença entre os lados na amplitude do quadril',
    oQueCompara: 'Média da amplitude de flexão e extensão do quadril ao longo da passada, nas passadas do pé direito comparada com a das passadas do pé esquerdo.',
    gatilhos: ['assimetria_entre_lados', 'criterio_profissional'],
    grandeza: 'diferenca_entre_lados',
  },
  inclinacao_tronco_marcha: {
    chave: 'inclinacao_tronco_marcha',
    titulo: 'Inclinação do tronco durante a passada',
    oQueCompara: 'Média da inclinação da reta quadril–ombro com a vertical ao longo de cada passada e sua variação entre as passadas.',
    gatilhos: ['variacao_entre_repeticoes', 'repeticao_discrepante', 'criterio_profissional'],
    grandeza: 'media',
  },
};

export const CHAVES_ACHADO = Object.keys(CATALOGO_ACHADOS) as ChaveAchado[];

export const ehChaveAchado = (chave: string): chave is ChaveAchado => Object.prototype.hasOwnProperty.call(CATALOGO_ACHADOS, chave);

export function achadoDoCatalogo(chave: ChaveAchado): DefAchado {
  return CATALOGO_ACHADOS[chave];
}

// ---------- gatilhos ----------

/*
 * Notação das regras: para uma medida e um lado, v1..vn são os valores das repetições COM valor; u é a incerteza de um valor
 * (MedidaPorRepeticao.incerteza); dp é o desvio-padrão amostral (n − 1) dos v. `minimoRepeticoes` é decisão de engenharia, para
 * a estatística não oscilar com 1 ou 2 valores; não é limite clínico. Abaixo dele o gatilho simplesmente não é avaliado.
 */
export const GATILHOS: Record<TipoGatilho, DefGatilho> = {
  assimetria_entre_lados: {
    tipo: 'assimetria_entre_lados',
    nome: 'Diferença entre os lados maior que a incerteza e que a variação entre repetições',
    regra:
      'Compara a média do lado D com a do lado E. Dispara quando |média D − média E| é maior que a incerteza da diferença, raiz(uD² + uE²), ' +
      'e também maior que o maior dos dois desvios-padrão entre repetições (dpD e dpE). Em medidas sem par D/E (deslocamento lateral da pelve) ' +
      'usa |média|, a incerteza u e o desvio-padrão da própria medida. Nenhum limite clínico entra na regra.',
    minimoRepeticoes: 3,
  },
  variacao_entre_repeticoes: {
    tipo: 'variacao_entre_repeticoes',
    nome: 'Variação entre repetições maior que a incerteza',
    regra: 'Dispara quando o desvio-padrão entre as repetições, calculado por lado, é maior que a incerteza u de um valor da medida.',
    minimoRepeticoes: 3,
  },
  tendencia_primeira_ultima: {
    tipo: 'tendencia_primeira_ultima',
    nome: 'Mudança da primeira para a última repetição maior que a incerteza',
    regra:
      'Toma a primeira e a última repetição com valor, por lado. Dispara quando |última − primeira| é maior que a incerteza da diferença entre ' +
      'dois valores, raiz(2) × u. O sinal da diferença é mantido no achado (positivo = a medida aumentou).',
    minimoRepeticoes: 3,
  },
  repeticao_discrepante: {
    tipo: 'repeticao_discrepante',
    nome: 'Repetição discrepante em relação à mediana',
    regra:
      'Escore z modificado (Iglewicz e Hoaglin, 1993): M = 0,6745 × (valor − mediana) ÷ MAD, com MAD = mediana de |valor − mediana|. ' +
      'Dispara para a repetição com |M| maior que 3,5 e |valor − mediana| maior que a incerteza u. Se MAD = 0, não é avaliado. ' +
      'É um critério estatístico de valor atípico, não um limite clínico.',
    minimoRepeticoes: 4,
  },
  criterio_profissional: {
    tipo: 'criterio_profissional',
    nome: 'Critério definido pelo profissional',
    regra:
      'Compara a grandeza natural do achado com o limite que o profissional definiu e ativou. O intervalo valor ± incerteza decide: se todo ele cumpre ' +
      'o critério, dentro do critério; se nenhum ponto cumpre, fora do critério; se o limite cai dentro do intervalo, no limite. O critério nasce ' +
      'desligado, sem valor presumido, e só vale com o nome de quem o definiu.',
    minimoRepeticoes: 1,
  },
};

// ---------- incerteza estimada do vídeo ----------

/**
 * Como a incerteza de UM valor é estimada, por grandeza. Todas vêm do próprio vídeo (empíricas); nenhuma é tolerância fixa em graus.
 * O texto vai para o método do laudo, então M implementa exatamente isto.
 */
export const FORMULAS_INCERTEZA: Record<GrandezaMedida, string> = {
  angulo:
    'Ângulos: u = 2 × raiz( soma((bruto − suavizado)²) ÷ (n − 1) ), em que 2 é o fator de cobertura (cerca de 95% se o erro for gaussiano) e a soma percorre ' +
    'as n amostras das janelas em que a medida é lida e em que a série bruta e a suavizada têm valor; ' +
    'cada medida usa a série da sua articulação, e a incerteza angular geral do vídeo é a mediana de u entre as séries angulares do protocolo.',
  deslocamento: 'Deslocamentos: o mesmo cálculo (fator de cobertura 2 e resíduo bruto − suavizado), feito sobre a série normalizada da própria medida (por exemplo, % da coxa).',
  tempo: 'Tempos: u = 1 ÷ taxa efetiva da trilha (um quadro).',
};

export const DESCRICAO_INCERTEZA =
  'Estimada do próprio vídeo, pelo quanto a série bruta se afasta da suavizada. Não capta erro sistemático do detector (um ponto deslocado de forma constante, por exemplo) nem o efeito da perspectiva: não é intervalo de confiança da medida.';

/** Texto da fórmula da incerteza para um protocolo: só as grandezas que ele realmente usa, na ordem angulo, deslocamento, tempo. */
export function formulaDaIncerteza(p: Protocolo): string {
  const usadas = new Set(p.medidas.map((m) => m.grandeza));
  return (['angulo', 'deslocamento', 'tempo'] as const).filter((g) => usadas.has(g)).map((g) => FORMULAS_INCERTEZA[g]).join(' ');
}

// ---------- limitações ----------

const LIMITACOES_COMUNS = [
  'A medida é feita em duas dimensões e só vale no plano filmado: o movimento fora desse plano (rotação, profundidade) não é captado e altera os ângulos.',
  'O instante de cada marco da repetição e os tempos têm erro de um quadro (1 ÷ taxa efetiva do vídeo).',
  'Diferença menor que a incerteza estimada do próprio vídeo não é tratada como achado.',
  'O modelo de pose estima as articulações pela imagem: não mede a curvatura da coluna (inclusive a lombar) nem a rotação da pelve, e roupa larga, oclusão e pouca luz reduzem a confiabilidade dos pontos.',
  'A incerteza estimada vem do resíduo entre a série bruta e a suavizada; ela não capta erro sistemático do detector.',
  'Os achados descrevem medidas. As hipóteses de fatores contribuintes são para o profissional confirmar na avaliação presencial e não são diagnóstico.',
];

// ---------- fases ----------

const FASES_AGACHAMENTO: FaseMovimento[] = [
  { id: 'repeticao', nome: 'Repetição inteira', descricao: 'Do início da descida ao fim da subida.', de: 'inicio', ate: 'fim' },
  { id: 'descida', nome: 'Descida', descricao: 'Do início da descida até o ponto mais baixo.', de: 'inicio', ate: 'fundo' },
  { id: 'fundo', nome: 'Ponto mais baixo', descricao: 'Instante do ponto mais baixo da repetição.', de: 'fundo', ate: 'fundo' },
  { id: 'subida', nome: 'Subida', descricao: 'Do ponto mais baixo ao fim da subida.', de: 'fundo', ate: 'fim' },
];

const FASES_MARCHA: FaseMovimento[] = [
  { id: 'passada', nome: 'Passada', descricao: 'Do contato inicial de um pé ao contato seguinte do mesmo pé.', de: 'inicio', ate: 'fim' },
  { id: 'apoio', nome: 'Apoio', descricao: 'Do contato inicial à saída do pé.', de: 'inicio', ate: 'fundo' },
  { id: 'balanco', nome: 'Balanço', descricao: 'Da saída do pé ao contato seguinte do mesmo pé.', de: 'fundo', ate: 'fim' },
];

// ---------- medidas ----------

const DURACAO_REPETICAO: DefMedidaRepeticao = {
  id: 'duracao_repeticao', nome: 'Duração da repetição', unidade: 's', porLado: false, fase: 'repeticao', extracao: 'duracao', grandeza: 'tempo', planoCamera: 'lateral',
  formula: 'tempo entre o início e o fim da repetição',
};

const MEDIDAS_AGACHAMENTO_LATERAL: DefMedidaRepeticao[] = [
  {
    id: 'flexao_joelho_max', nome: 'Flexão máxima do joelho', unidade: '°', porLado: true, fase: 'repeticao', extracao: 'maximo', grandeza: 'angulo', planoCamera: 'lateral',
    formula: 'maior flexão do joelho (ângulo quadril–joelho–tornozelo; 0° = estendido) entre o início e o fim da repetição',
  },
  {
    id: 'flexao_quadril_max', nome: 'Flexão máxima do quadril', unidade: '°', porLado: true, fase: 'repeticao', extracao: 'maximo', grandeza: 'angulo', planoCamera: 'lateral',
    formula: 'maior flexão do quadril (ângulo ombro–quadril–joelho; 0° = em pé, positivo = coxa à frente do tronco) entre o início e o fim da repetição',
  },
  {
    id: 'dorsiflexao_max', nome: 'Dorsiflexão máxima do tornozelo', unidade: '°', porLado: true, fase: 'repeticao', extracao: 'maximo', grandeza: 'angulo', planoCamera: 'lateral',
    formula: 'maior dorsiflexão do tornozelo (ângulo entre a perna e o eixo do pé, contado a partir do neutro de 90°; positivo = dorsiflexão) entre o início e o fim da repetição',
  },
  {
    id: 'inclinacao_tronco_fundo', nome: 'Inclinação do tronco no ponto mais baixo', unidade: '°', porLado: false, fase: 'fundo', extracao: 'valor_no_marco', grandeza: 'angulo', planoCamera: 'lateral',
    formula: 'inclinação da reta quadril–ombro com a vertical no ponto mais baixo; positivo = tronco inclinado para a frente',
  },
  {
    id: 'avanco_joelho_fundo', nome: 'Avanço do joelho em relação à ponta do pé', unidade: '% do comprimento do pé', porLado: true, fase: 'fundo', extracao: 'valor_no_marco', grandeza: 'deslocamento', planoCamera: 'lateral',
    formula:
      '(posição horizontal do joelho − posição horizontal da ponta do pé) × direção ÷ comprimento do pé (calcanhar–ponta) × 100, no ponto mais baixo; ' +
      'direção = +1 se o paciente está virado para a direita da imagem e −1 se para a esquerda; positivo = joelho à frente da ponta do pé',
  },
  {
    id: 'profundidade_quadril', nome: 'Profundidade (quadril em relação ao joelho)', unidade: '% da coxa', porLado: false, fase: 'fundo', extracao: 'valor_no_marco', grandeza: 'deslocamento', planoCamera: 'lateral',
    formula:
      'distância vertical do quadril abaixo do joelho ÷ comprimento da coxa (quadril–joelho) × 100, no ponto mais baixo, média dos dois lados; ' +
      '0 = quadril na altura do joelho, positivo = quadril abaixo do joelho, negativo = acima',
  },
  DURACAO_REPETICAO,
];

const MEDIDAS_AGACHAMENTO_FRONTAL: DefMedidaRepeticao[] = [
  {
    id: 'valgo_joelho_max', nome: 'Valgo máximo do joelho na descida', unidade: '°', porLado: true, fase: 'descida', extracao: 'maximo', grandeza: 'angulo', planoCamera: 'frontal',
    formula:
      'maior ângulo de valgo (desvio do joelho em relação à reta quadril–tornozelo no plano frontal; positivo = joelho para dentro, em direção ao outro quadril) ' +
      'entre o início e o ponto mais baixo da repetição',
  },
  {
    id: 'desvio_lateral_pelve_fundo', nome: 'Deslocamento lateral da pelve no ponto mais baixo', unidade: '% da base de apoio', porLado: false, fase: 'fundo', extracao: 'valor_no_marco', grandeza: 'deslocamento', planoCamera: 'frontal',
    formula:
      '(posição horizontal do ponto médio dos quadris − posição horizontal do ponto médio dos tornozelos) ÷ distância horizontal entre os tornozelos × 100, no ponto mais baixo; ' +
      'positivo = pelve deslocada para o lado direito do paciente, negativo = para o esquerdo (o sentido vem da posição relativa dos quadris D e E na imagem)',
  },
  {
    id: 'descida_pelve', nome: 'Descida da pelve', unidade: '% da altura do quadril em pé', porLado: false, fase: 'descida', extracao: 'amplitude', grandeza: 'deslocamento', planoCamera: 'frontal',
    formula:
      '(maior − menor posição vertical do ponto médio dos quadris entre o início e o ponto mais baixo) ÷ distância vertical entre o ponto médio dos quadris e o ponto médio dos tornozelos ' +
      'no início da repetição × 100',
  },
  { ...DURACAO_REPETICAO, planoCamera: 'frontal' },
];

const MEDIDAS_MARCHA_LATERAL: DefMedidaRepeticao[] = [
  {
    id: 'tempo_apoio', nome: 'Tempo de apoio', unidade: 's', porLado: true, fase: 'apoio', extracao: 'duracao', grandeza: 'tempo', planoCamera: 'lateral',
    formula: 'tempo entre o contato inicial e a saída do mesmo pé (eventos sugeridos e conferidos pelo profissional)',
  },
  {
    id: 'flexao_joelho_pico_balanco', nome: 'Pico de flexão do joelho no balanço', unidade: '°', porLado: true, fase: 'balanco', extracao: 'maximo', grandeza: 'angulo', planoCamera: 'lateral',
    formula: 'maior flexão do joelho do pé que define a passada (0° = estendido) entre a saída do pé e o contato seguinte',
  },
  {
    id: 'amplitude_quadril', nome: 'Amplitude do quadril na passada', unidade: '°', porLado: true, fase: 'passada', extracao: 'amplitude', grandeza: 'angulo', planoCamera: 'lateral',
    formula: 'maior − menor flexão do quadril (ombro–quadril–joelho, assinada) do pé que define a passada, entre dois contatos consecutivos',
  },
  {
    id: 'inclinacao_tronco_media', nome: 'Inclinação do tronco na passada', unidade: '°', porLado: false, fase: 'passada', extracao: 'media', grandeza: 'angulo', planoCamera: 'lateral',
    formula: 'média da inclinação da reta quadril–ombro com a vertical ao longo da passada; positivo = tronco inclinado para o lado em que o paciente caminha',
  },
  {
    id: 'duracao_passada', nome: 'Duração da passada', unidade: 's', porLado: true, fase: 'passada', extracao: 'duracao', grandeza: 'tempo', planoCamera: 'lateral',
    formula: 'tempo entre dois contatos consecutivos do mesmo pé',
  },
];

// ---------- achados por protocolo ----------

const LIM_LADOS_LATERAL = 'A comparação entre os lados depende de o detector enxergar os dois membros: de lado, o membro mais distante da câmera é menos confiável.';
const LIM_TENDENCIA = 'Compara só a primeira e a última repetição com valor: com poucas repetições, uma única repetição discrepante muda o resultado.';
const LIM_FUNDO = 'Depende de o ponto mais baixo de cada repetição ser identificado corretamente: confira os marcos de cada repetição.';

const IDS_TENDENCIA_LATERAL = ['flexao_joelho_max', 'flexao_quadril_max', 'dorsiflexao_max', 'inclinacao_tronco_fundo', 'avanco_joelho_fundo', 'profundidade_quadril', 'duracao_repeticao'];
const IDS_TENDENCIA_FRONTAL = ['valgo_joelho_max', 'desvio_lateral_pelve_fundo', 'descida_pelve', 'duracao_repeticao'];

/** Os achados do agachamento que só existem no plano oposto entram sem medidas: viram `indisponiveis` na análise. */
const semMedida = (chave: ChaveAchado, planoExigido: PlanoCamera): AchadoDoProtocolo => ({ chave, planoExigido, medidas: [], limitacoes: [] });

const ACHADOS_AGACHAMENTO_LATERAL: AchadoDoProtocolo[] = [
  { chave: 'assimetria_flexao_joelho', planoExigido: 'lateral', medidas: ['flexao_joelho_max'], limitacoes: [LIM_LADOS_LATERAL] },
  { chave: 'assimetria_flexao_quadril', planoExigido: 'lateral', medidas: ['flexao_quadril_max'], limitacoes: [LIM_LADOS_LATERAL] },
  { chave: 'assimetria_dorsiflexao', planoExigido: 'lateral', medidas: ['dorsiflexao_max'], limitacoes: [LIM_LADOS_LATERAL, 'A dorsiflexão é medida pela perna e pelo eixo calcanhar–ponta do pé; calçado e posição dos pés alteram a leitura.'] },
  semMedida('valgo_dinamico', 'frontal'),
  semMedida('desvio_lateral_pelve', 'frontal'),
  { chave: 'inclinacao_tronco', planoExigido: 'lateral', medidas: ['inclinacao_tronco_fundo'], limitacoes: ['É a inclinação da reta quadril–ombro: não informa a curvatura da coluna.', LIM_FUNDO] },
  {
    chave: 'avanco_joelho', planoExigido: 'lateral', medidas: ['avanco_joelho_fundo'],
    limitacoes: [
      'Medido em relação à ponta do pé no plano da imagem; a ponta do pé do modelo de pose varia com o calçado.',
      'O limite de avanço do joelho é debatido na literatura: nenhum critério vem ativado, então é observação medida e não veredito.',
    ],
  },
  { chave: 'variacao_profundidade', planoExigido: 'lateral', medidas: ['profundidade_quadril'], limitacoes: [LIM_FUNDO] },
  { chave: 'tendencia_na_serie', planoExigido: 'lateral', medidas: IDS_TENDENCIA_LATERAL, limitacoes: [LIM_TENDENCIA] },
];

const ACHADOS_AGACHAMENTO_FRONTAL: AchadoDoProtocolo[] = [
  semMedida('assimetria_flexao_joelho', 'lateral'),
  semMedida('assimetria_flexao_quadril', 'lateral'),
  semMedida('assimetria_dorsiflexao', 'lateral'),
  {
    chave: 'valgo_dinamico', planoExigido: 'frontal', medidas: ['valgo_joelho_max'],
    limitacoes: [
      'Ângulo de projeção 2D no plano frontal: a rotação do quadril e do pé muda a leitura, e o ângulo não separa o movimento do fêmur do da tíbia.',
      'Sem critério definido pelo profissional, um valor semelhante nos dois lados aparece só na tabela de medidas, não como achado.',
    ],
  },
  {
    chave: 'desvio_lateral_pelve', planoExigido: 'frontal', medidas: ['desvio_lateral_pelve_fundo'],
    limitacoes: [
      'A base de apoio é a distância entre os tornozelos na imagem: mudar os pés durante a repetição altera a referência.',
      'A medida não separa o deslocamento da pelve da inclinação do tronco.',
    ],
  },
  semMedida('inclinacao_tronco', 'lateral'),
  semMedida('avanco_joelho', 'lateral'),
  { chave: 'variacao_profundidade', planoExigido: 'frontal', medidas: ['descida_pelve'], limitacoes: [LIM_FUNDO] },
  { chave: 'tendencia_na_serie', planoExigido: 'frontal', medidas: IDS_TENDENCIA_FRONTAL, limitacoes: [LIM_TENDENCIA] },
];

const LIM_PASSADA = 'Cada passada pertence a um pé: a comparação entre os lados usa passadas de instantes diferentes, e a velocidade pode mudar entre elas.';

const ACHADOS_MARCHA_LATERAL: AchadoDoProtocolo[] = [
  {
    chave: 'assimetria_tempo_apoio', planoExigido: 'lateral', medidas: ['tempo_apoio'],
    limitacoes: [LIM_PASSADA, 'Depende dos eventos de contato e saída do pé, cada um com erro de um quadro: confira-os quadro a quadro.'],
  },
  { chave: 'assimetria_flexao_joelho_marcha', planoExigido: 'lateral', medidas: ['flexao_joelho_pico_balanco'], limitacoes: [LIM_PASSADA, LIM_LADOS_LATERAL] },
  { chave: 'assimetria_amplitude_quadril', planoExigido: 'lateral', medidas: ['amplitude_quadril'], limitacoes: [LIM_PASSADA, LIM_LADOS_LATERAL] },
  { chave: 'inclinacao_tronco_marcha', planoExigido: 'lateral', medidas: ['inclinacao_tronco_media'], limitacoes: ['É a inclinação da reta quadril–ombro: não informa a curvatura da coluna.'] },
];

// ---------- gravação ----------

const GRAVAR_LATERAL = [
  'Grave de lado (câmera perpendicular ao movimento), com a câmera parada, na altura do quadril e o corpo inteiro no quadro.',
  'Boa luz e roupa justa, para o detector enxergar as articulações.',
];

const GRAVAR_FRONTAL = [
  'Grave de frente, com a câmera parada, na altura do quadril, o corpo inteiro no quadro e os dois pés visíveis.',
  'Boa luz e roupa justa nas pernas, para o detector enxergar joelhos e tornozelos.',
];

const GRAVAR_AGACHAMENTO = { lateral: [...GRAVAR_LATERAL, 'Em pé, de lado, com os pés inteiros no quadro; 3 a 5 repetições, vídeos de 5 a 30 s.'], frontal: [...GRAVAR_FRONTAL, 'Pés na posição habitual do agachamento; 3 a 5 repetições, vídeos de 5 a 30 s.'] };

// ---------- protocolos ----------

const ambos = <T,>(f: (lado: Lado) => T): T[] => [f('D'), f('E')];

export const PROTOCOLOS: Protocolo[] = [
  {
    id: 'agachamento_lateral',
    nome: 'Agachamento — vista lateral',
    gesto: 'agachamento',
    planoFilmado: 'lateral',
    rotuloRepeticao: { singular: 'repetição', plural: 'repetições' },
    descricao: 'Flexão de joelho, quadril e tornozelo, inclinação do tronco, avanço do joelho e profundidade, por repetição e por lado.',
    segmentacao:
      'As repetições são os picos de flexão do joelho (média dos dois lados) na série suavizada: o início e o fim são os pontos em pé antes e depois de cada pico, ' +
      'e o ponto mais baixo é o próprio pico. Picos que tocam as pontas do trecho analisado ficam como incompletos.',
    fases: FASES_AGACHAMENTO,
    gravacao: GRAVAR_AGACHAMENTO,
    fpsSugerido: modeloDoGesto('agachamento').fpsSugerido,
    articulacoes: [...ambos(anguloJoelho), ...ambos(anguloQuadril), ...ambos(anguloTornozelo), inclinacaoTronco],
    medidas: MEDIDAS_AGACHAMENTO_LATERAL,
    achados: ACHADOS_AGACHAMENTO_LATERAL,
    limitacoes: [
      ...LIMITACOES_COMUNS,
      'De lado, os dois membros ficam sobrepostos: o detector os confunde mais facilmente no ponto mais baixo e o membro mais distante da câmera é menos confiável. Confira o quadro de maior flexão.',
      'O valgo dinâmico e o deslocamento lateral da pelve exigem a vista frontal e não são avaliados neste vídeo.',
    ],
  },
  {
    id: 'agachamento_frontal',
    nome: 'Agachamento — vista frontal',
    gesto: 'agachamento',
    planoFilmado: 'frontal',
    rotuloRepeticao: { singular: 'repetição', plural: 'repetições' },
    descricao: 'Valgo do joelho, deslocamento lateral da pelve e descida da pelve, por repetição e por lado.',
    segmentacao:
      'De frente a flexão do joelho quase não aparece no plano da imagem, por isso as repetições são os vales da altura do ponto médio dos quadris na série suavizada: ' +
      'o ponto mais baixo é o vale, e o início e o fim são os pontos em pé antes e depois dele. Vales que tocam as pontas do trecho analisado ficam como incompletos.',
    fases: FASES_AGACHAMENTO,
    gravacao: GRAVAR_AGACHAMENTO,
    fpsSugerido: modeloDoGesto('agachamento').fpsSugerido,
    articulacoes: [...ambos(anguloValgo), linhaDaPelve, inclinacaoLateralTronco],
    medidas: MEDIDAS_AGACHAMENTO_FRONTAL,
    achados: ACHADOS_AGACHAMENTO_FRONTAL,
    limitacoes: [
      ...LIMITACOES_COMUNS,
      'De frente, a flexão do joelho, do quadril e do tornozelo fica quase toda fora do plano da imagem: não é medida neste vídeo (exige a vista lateral).',
      'O valgo é um ângulo de projeção 2D: a rotação do quadril e do pé muda a leitura.',
    ],
  },
  {
    id: 'marcha_lateral',
    nome: 'Marcha — vista lateral',
    gesto: 'marcha',
    planoFilmado: 'lateral',
    rotuloRepeticao: { singular: 'passada', plural: 'passadas' },
    descricao: 'Tempo de apoio, flexão do joelho no balanço, amplitude do quadril e inclinação do tronco, por passada e por pé.',
    segmentacao:
      'Cada passada vai do contato inicial de um pé ao contato seguinte do mesmo pé; a saída do pé separa o apoio do balanço. Os eventos são sugeridos pelo algoritmo ' +
      'e podem ser corrigidos pelo profissional na tela; passadas sem os três eventos ficam como incompletas.',
    fases: FASES_MARCHA,
    gravacao: {
      lateral: [...GRAVAR_LATERAL, 'Pelo menos 10 passos seguidos (5 de cada pé), em ritmo confortável; vídeos de 5 a 30 s.'],
    },
    fpsSugerido: modeloDoGesto('marcha').fpsSugerido,
    articulacoes: [...ambos(anguloQuadril), ...ambos(anguloJoelho), ...ambos(anguloTornozelo), inclinacaoTronco],
    medidas: MEDIDAS_MARCHA_LATERAL,
    achados: ACHADOS_MARCHA_LATERAL,
    limitacoes: [
      ...LIMITACOES_COMUNS,
      'Na gravação de lado, a perna mais distante da câmera é menos confiável: dê mais peso à perna mais próxima.',
      'O vídeo não separa a rotação nem a inclinação da pelve: os ângulos são projeções no plano da imagem.',
      'Os eventos de contato e saída do pé são sugestões com erro de um quadro; os tempos de apoio só valem depois de conferidos quadro a quadro.',
      'Cada passada pertence a um pé: a comparação entre os lados usa passadas de instantes diferentes, e a velocidade pode mudar entre elas.',
    ],
  },
];

export const IDS_PROTOCOLO: IdProtocolo[] = PROTOCOLOS.map((p) => p.id);

export function protocoloDo(id: IdProtocolo): Protocolo {
  const p = PROTOCOLOS.find((x) => x.id === id);
  if (!p) throw new Error(`Protocolo desconhecido: ${id}`);
  return p;
}

/** Protocolos de um gesto do motor (agachamento → lateral e frontal; marcha → lateral; os demais gestos ainda não têm protocolo). */
export const protocolosDoGesto = (gesto: IdGesto): Protocolo[] => PROTOCOLOS.filter((p) => p.gesto === gesto);

export const medidaDo = (p: Protocolo, id: string): DefMedidaRepeticao | undefined => p.medidas.find((m) => m.id === id);

export const faseDo = (p: Protocolo, id: string): FaseMovimento | undefined => p.fases.find((f) => f.id === id);

/** Achados cujo plano exigido é o plano filmado: os únicos que a análise pode produzir. */
export const achadosAvaliaveis = (p: Protocolo): AchadoDoProtocolo[] => p.achados.filter((a) => a.planoExigido === p.planoFilmado);

/**
 * Achados que exigem outro plano de câmera, já com o motivo e o que gravar. O texto é montado aqui para a análise, o laudo e a
 * tela dizerem a mesma coisa.
 */
export function indisponiveisDoProtocolo(p: Protocolo): AchadoIndisponivel[] {
  return p.achados
    .filter((a) => a.planoExigido !== p.planoFilmado)
    .map((a) => ({
      chave: a.chave,
      titulo: CATALOGO_ACHADOS[a.chave].titulo,
      planoExigido: a.planoExigido,
      planoFilmado: p.planoFilmado,
      motivo: `Exige ${ROTULO_PLANO[a.planoExigido]}; este vídeo foi analisado em ${ROTULO_PLANO[p.planoFilmado]}, e a medida 2D só vale no plano filmado.`,
      comoObter: `Grave também em ${ROTULO_PLANO[a.planoExigido]}. ${(p.gravacao[a.planoExigido] ?? []).join(' ')}`.trim(),
    }));
}
