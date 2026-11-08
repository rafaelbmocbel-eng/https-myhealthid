/**
 * Métricas de EMG de superfície para a tela ao vivo, em funções puras sobre o
 * sinal em µV já filtrado (ver filtros.ts). Sem DOM e sem dependências.
 *
 * Convenções:
 * - A amostra i está no instante i/fs. Janelas são contadas em amostras
 *   (round(fs·ms/1000), no mínimo 1).
 * - Amostra não finita (NaN/±Infinity) conta como potência 0 e não envenena as
 *   janelas vizinhas; a qualidade do sinal a denuncia à parte.
 * - Parâmetros numéricos inválidos (fs, janelas, passos <= 0 ou não finitos)
 *   lançam RangeError, mesmo com sinal vazio. Sinal vazio/curto nunca lança.
 * - Limiares e durações abaixo são parâmetros de pesquisa/indicativos, não
 *   limites clínicos nem critérios diagnósticos.
 */

export const PADRAO_CONTRACOES = {
  baselineMs: 1000,
  k: 3,
  duracaoMinMs: 100,
  juntarMs: 100,
} as const;

export const JANELA_RUIDO_BASAL_MS = 1000;
/** Menor trecho (em segundos) sobre o qual rede e ruído basal fazem sentido. */
export const DURACAO_MIN_ANALISE_S = 0.5;
/** RMS basal (µV) a partir do qual a qualidade cai para "atencao". */
export const LIMIAR_RUIDO_BASAL_ATENCAO_UV = 5;
/** RMS basal (µV) a partir do qual a qualidade cai para "ruim". */
export const LIMIAR_RUIDO_BASAL_RUIM_UV = 15;
/** Fração da potência (sem DC) concentrada na frequência da rede: "atencao". */
export const LIMIAR_REDE_ATENCAO = 0.1;
/** Fração da potência (sem DC) concentrada na frequência da rede: "ruim". */
export const LIMIAR_REDE_RUIM = 0.5;
/** Degrau do conversor (µV): o protocolo entrega contagens inteiras divididas por 3,1457. */
export const DEGRAU_ADC_UV = 1 / 3.1457;
/**
 * Desvio-padrão (µV) abaixo do qual o sinal é linha plana. Fica bem abaixo de
 * 1 degrau do conversor (≈ 0,32 µV), para não acusar sinal só quantizado.
 */
export const LIMIAR_LINHA_PLANA_UV = 0.01;
/** Fração de amostras repetidas exatamente no máximo (ou no mínimo) que indica saturação. */
export const FRACAO_SATURACAO = 0.02;
/**
 * Piso de amostras no extremo, para trechos curtos (onde 2 % são poucas amostras). Com 3, três
 * empates por quantização na cauda de um ruído de 1 a 2 µV já davam falso positivo em ~10 % dos
 * trechos de 100 ms; com 6 cai para menos de 1 %.
 */
export const MIN_AMOSTRAS_SATURACAO = 6;
/**
 * Faixa (máx - mín), em degraus do conversor, abaixo da qual não se avalia saturação: com tão
 * poucos níveis distintos o sinal inteiro é piso de quantização e não há "extremo" a cortar.
 */
export const FAIXA_MIN_SATURACAO_DEGRAUS = 8;
/**
 * Platô de saturação: o nível extremo precisa ter mais que esta razão vezes a média de amostras
 * por degrau nos NIVEIS_REFERENCIA_PLATO degraus logo abaixo. Repetição por quantização não passa
 * disso, porque ali a cauda tem níveis vizinhos tão povoados quanto o extremo; o corte (clipping)
 * deixa os degraus de baixo quase vazios.
 */
export const RAZAO_PLATO_SATURACAO = 2;
/**
 * Quantos degraus abaixo do extremo formam a referência do platô. Um degrau só é ruidoso demais
 * (lacuna casual na cauda: ~0,5 % de falso positivo em 250 ms a 1 µV); com 3, fica em ~0,1 %.
 */
export const NIVEIS_REFERENCIA_PLATO = 3;
/** Fração de amostras não finitas a partir da qual a qualidade é "ruim" (qualquer uma já é "atencao"). */
export const LIMIAR_AMOSTRAS_INVALIDAS_RUIM = 0.05;

// Dois "iguais" na saturação: tolerância mínima, porque um seno liso passa muito tempo perto do pico.
const TOLERANCIA_SATURACAO_REL = 1e-6;

function validarPositivo(nome: string, valor: number): void {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new RangeError(`${nome} deve ser finito e > 0 (recebido ${valor})`);
  }
}

function validarNaoNegativo(nome: string, valor: number): void {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new RangeError(`${nome} deve ser finito e >= 0 (recebido ${valor})`);
  }
}

function amostrasDe(fsHz: number, ms: number): number {
  return Math.max(1, Math.round((fsHz * ms) / 1000));
}

function quadradoOuZero(v: number): number {
  const q = v * v;
  return Number.isFinite(q) ? q : 0;
}

// Soma cumulativa em vez de somar cada janela: janelas de 1 s a cada amostra ficariam O(n·janela).
function somaCumulativaDeQuadrados(x: ArrayLike<number>): Float64Array {
  const acc = new Float64Array(x.length + 1);
  for (let i = 0; i < x.length; i++) {
    acc[i + 1] = acc[i] + quadradoOuZero(x[i]);
  }
  return acc;
}

// A subtração de somas grandes pode dar um resíduo negativo da ordem do erro de arredondamento.
function rmsDoIntervalo(acc: Float64Array, ini: number, fim: number): number {
  return Math.sqrt(Math.max(0, acc[fim] - acc[ini]) / (fim - ini));
}

interface ExtremosDeJanela {
  minIni: number;
  minSoma: number;
  maxIni: number;
  maxSoma: number;
}

/** Varre as janelas de `janela` amostras com passo 1; exige acc.length - 1 >= janela. */
function extremosDasJanelas(acc: Float64Array, janela: number): ExtremosDeJanela {
  let minIni = 0;
  let maxIni = 0;
  let minSoma = acc[janela] - acc[0];
  let maxSoma = minSoma;
  for (let i = 1; i + janela < acc.length; i++) {
    const soma = acc[i + janela] - acc[i];
    if (soma < minSoma) {
      minSoma = soma;
      minIni = i;
    }
    if (soma > maxSoma) {
      maxSoma = soma;
      maxIni = i;
    }
  }
  return { minIni, minSoma, maxIni, maxSoma };
}

export function rms(x: ArrayLike<number>): number {
  const n = x.length;
  if (n === 0) return 0;
  let soma = 0;
  for (let i = 0; i < n; i++) soma += quadradoOuZero(x[i]);
  return Math.sqrt(soma / n);
}

/**
 * RMS em janelas deslizantes. `tempoS` é o centro da janela: para a janela que
 * começa na amostra i com W amostras, (i + (W - 1) / 2) / fs. Só janelas
 * completas; sinal menor que a janela devolve vetores vazios.
 */
export function rmsEmJanelas(
  x: ArrayLike<number>,
  fsHz: number,
  janelaMs = 250,
  passoMs = 50,
): { tempoS: Float64Array; rms: Float64Array } {
  validarPositivo('fsHz', fsHz);
  validarPositivo('janelaMs', janelaMs);
  validarPositivo('passoMs', passoMs);
  const janela = amostrasDe(fsHz, janelaMs);
  const passo = amostrasDe(fsHz, passoMs);
  const n = x.length;
  if (n < janela) {
    return { tempoS: new Float64Array(0), rms: new Float64Array(0) };
  }
  const total = Math.floor((n - janela) / passo) + 1;
  const tempoS = new Float64Array(total);
  const saida = new Float64Array(total);
  const acc = somaCumulativaDeQuadrados(x);
  for (let j = 0; j < total; j++) {
    const ini = j * passo;
    tempoS[j] = (ini + (janela - 1) / 2) / fsHz;
    saida[j] = rmsDoIntervalo(acc, ini, ini + janela);
  }
  return { tempoS, rms: saida };
}

/**
 * Envelope RMS com o mesmo comprimento de `x`. A janela é centrada na amostra
 * (para janela par, uma amostra a mais antes do que depois) e nas bordas é
 * truncada, então o RMS das pontas usa menos amostras e é mais ruidoso.
 */
export function envelopeRms(x: ArrayLike<number>, fsHz: number, janelaMs = 250): Float64Array {
  validarPositivo('fsHz', fsHz);
  validarPositivo('janelaMs', janelaMs);
  const n = x.length;
  const saida = new Float64Array(n);
  if (n === 0) return saida;
  const janela = amostrasDe(fsHz, janelaMs);
  const atras = Math.floor(janela / 2);
  const frente = janela - 1 - atras;
  const acc = somaCumulativaDeQuadrados(x);
  for (let k = 0; k < n; k++) {
    saida[k] = rmsDoIntervalo(acc, Math.max(0, k - atras), Math.min(n, k + frente + 1));
  }
  return saida;
}

/**
 * Maior RMS entre as janelas completas (passo de 1 amostra) e onde ela começa.
 * Sinal menor que a janela devolve { valor: 0, inicioS: 0 }: uma tentativa curta
 * demais não vira referência (valor 0 faz normalizarPorCVM devolver null).
 */
export function picoEmJanela(
  x: ArrayLike<number>,
  fsHz: number,
  janelaMs = 1000,
): { valor: number; inicioS: number } {
  validarPositivo('fsHz', fsHz);
  validarPositivo('janelaMs', janelaMs);
  const janela = amostrasDe(fsHz, janelaMs);
  if (x.length < janela) return { valor: 0, inicioS: 0 };
  const acc = somaCumulativaDeQuadrados(x);
  const { maxIni, maxSoma } = extremosDasJanelas(acc, janela);
  return { valor: Math.sqrt(Math.max(0, maxSoma) / janela), inicioS: maxIni / fsHz };
}

export interface OpcoesContracoes {
  /** Duração do repouso no início do envelope (padrão 1000 ms). */
  baselineMs?: number;
  /** Limiar = média + k·desvio do repouso (padrão 3). */
  k?: number;
  /** Contrações mais curtas que isto são descartadas (padrão 100 ms). */
  duracaoMinMs?: number;
  /** Segmentos separados por menos que isto são unidos (padrão 100 ms). */
  juntarMs?: number;
  /** Trecho de repouso informado; substitui os primeiros `baselineMs` do envelope. */
  repouso?: ArrayLike<number>;
}

export interface Contracao {
  /** Início do primeiro segmento. */
  inicioS: number;
  /** Instante logo após a última amostra acima do limiar: intervalo [inicioS, fimS). */
  fimS: number;
  duracaoS: number;
  picoUv: number;
  /** Média do envelope no intervalo (inclui as lacunas unidas). */
  rmsMedioUv: number;
  /** Integral do envelope no intervalo (soma · 1/fs) = rmsMedioUv · duracaoS. */
  areaUvS: number;
}

interface MediaDesvio {
  media: number;
  desvio: number;
}

// Desvio amostral (n - 1): com repouso curto o limiar fica mais conservador.
function mediaEDesvio(x: ArrayLike<number>, n: number): MediaDesvio | null {
  let validas = 0;
  let soma = 0;
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(x[i])) {
      validas++;
      soma += x[i];
    }
  }
  if (validas < 2) return null;
  const media = soma / validas;
  let desvios = 0;
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(x[i])) desvios += (x[i] - media) * (x[i] - media);
  }
  return { media, desvio: Math.sqrt(desvios / (validas - 1)) };
}

/**
 * Detecta contrações no envelope: amostras estritamente acima de
 * média + k·desvio do repouso formam segmentos; segmentos separados por menos de
 * `juntarMs` são unidos e, depois, os mais curtos que `duracaoMinMs` caem.
 *
 * O repouso são os primeiros `baselineMs` do envelope (precisam estar relaxados)
 * ou o trecho `repouso`. Sem repouso suficiente (envelope menor que `baselineMs`,
 * ou menos de 2 amostras finitas) devolve [] sem lançar. A detecção varre o
 * envelope inteiro, inclusive o trecho de repouso.
 *
 * k e as durações são parâmetros de pesquisa, não limites clínicos. Com repouso
 * curto, o desvio é mal estimado (o envelope é suave, tem poucas amostras
 * independentes) e o limiar pode ficar baixo demais: prefira repouso longo ou k maior.
 */
export function detectarContracoes(
  envelope: ArrayLike<number>,
  fsHz: number,
  opcoes: OpcoesContracoes = {},
): Contracao[] {
  const {
    baselineMs = PADRAO_CONTRACOES.baselineMs,
    k = PADRAO_CONTRACOES.k,
    duracaoMinMs = PADRAO_CONTRACOES.duracaoMinMs,
    juntarMs = PADRAO_CONTRACOES.juntarMs,
    repouso,
  } = opcoes;
  validarPositivo('fsHz', fsHz);
  validarPositivo('baselineMs', baselineMs);
  validarNaoNegativo('k', k);
  validarNaoNegativo('duracaoMinMs', duracaoMinMs);
  validarNaoNegativo('juntarMs', juntarMs);

  const n = envelope.length;
  let estatistica: MediaDesvio | null;
  if (repouso) {
    estatistica = mediaEDesvio(repouso, repouso.length);
  } else {
    const nBase = amostrasDe(fsHz, baselineMs);
    estatistica = n >= nBase ? mediaEDesvio(envelope, nBase) : null;
  }
  if (!estatistica) return [];
  const limiar = estatistica.media + k * estatistica.desvio;

  const segmentos: Array<[number, number]> = [];
  let ini = -1;
  for (let i = 0; i < n; i++) {
    const acima = envelope[i] > limiar;
    if (acima && ini < 0) {
      ini = i;
    } else if (!acima && ini >= 0) {
      segmentos.push([ini, i - 1]);
      ini = -1;
    }
  }
  if (ini >= 0) segmentos.push([ini, n - 1]);

  // Comparações em amostras×1000 vs ms×fs para não depender de divisão em ponto flutuante.
  const unidos: Array<[number, number]> = [];
  for (const [a, b] of segmentos) {
    const ultimo = unidos[unidos.length - 1];
    if (ultimo && (a - ultimo[1] - 1) * 1000 < juntarMs * fsHz) {
      ultimo[1] = b;
    } else {
      unidos.push([a, b]);
    }
  }

  const contracoes: Contracao[] = [];
  for (const [a, b] of unidos) {
    const amostras = b - a + 1;
    if (amostras * 1000 < duracaoMinMs * fsHz) continue;
    let pico = 0;
    let soma = 0;
    for (let i = a; i <= b; i++) {
      const v = envelope[i];
      if (Number.isFinite(v)) {
        soma += v;
        if (v > pico) pico = v;
      }
    }
    const duracaoS = amostras / fsHz;
    contracoes.push({
      inicioS: a / fsHz,
      fimS: (b + 1) / fsHz,
      duracaoS,
      picoUv: pico,
      rmsMedioUv: soma / amostras,
      areaUvS: soma / fsHz,
    });
  }
  return contracoes;
}

/**
 * Valor como % da CVM, sem teto (acima de 100 % é possível e informativo).
 * null se a CVM é <= 0 ou não finita, ou se o valor não é finito.
 */
export function normalizarPorCVM(valor: number, cvm: number): number | null {
  if (!Number.isFinite(cvm) || cvm <= 0 || !Number.isFinite(valor)) return null;
  return (valor / cvm) * 100;
}

/** CVM = maior pico (picoEmJanela) entre as tentativas; sem tentativas, 0. */
export function cvmDeTentativas(
  tentativas: ArrayLike<number>[],
  fsHz: number,
  janelaMs = 1000,
): { cvm: number; porTentativa: number[] } {
  validarPositivo('fsHz', fsHz);
  validarPositivo('janelaMs', janelaMs);
  const porTentativa = tentativas.map((t) => picoEmJanela(t, fsHz, janelaMs).valor);
  let cvm = 0;
  for (const v of porTentativa) {
    if (v > cvm) cvm = v;
  }
  return { cvm, porTentativa };
}

export type NivelQualidade = 'bom' | 'atencao' | 'ruim';

export interface QualidadeSinal {
  /** Menor RMS de janela de 1 s (ou do trecho todo, se menor que 1 s). Avalie em repouso. */
  ruidoBasalRms: number;
  /** Fração da potência (sem DC) na frequência da rede, em [0, 1]. */
  contaminacaoRede: number;
  linhaPlana: boolean;
  saturacao: boolean;
  nivel: NivelQualidade;
  motivos: string[];
}

function potenciaDeGoertzel(
  x: ArrayLike<number>,
  media: number,
  fHz: number,
  fsHz: number,
): number {
  const n = x.length;
  const coef = 2 * Math.cos((2 * Math.PI * fHz) / fsHz);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    const d = Number.isFinite(x[i]) ? x[i] - media : 0;
    const s0 = d + coef * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const modulo2 = s1 * s1 + s2 * s2 - coef * s1 * s2;
  // Um seno de amplitude A tem |X|² = (A·n/2)² e potência A²/2.
  return (2 * Math.max(0, modulo2)) / (n * n);
}

// Sinal quantizado repete o nível extremo sem haver corte, então contar repetições não basta:
// exige-se também que o extremo seja um pico frente aos degraus logo abaixo (ver RAZAO_PLATO_SATURACAO).
// A vizinhança termina meio degrau além do último degrau de referência, para tolerar erro de
// ponto flutuante em sinal que está na grade do ADC sem pegar o degrau seguinte.
function temPlatoNoExtremo(
  x: ArrayLike<number>,
  minimo: number,
  maximo: number,
  validas: number,
): boolean {
  const faixa = maximo - minimo;
  if (!(faixa >= FAIXA_MIN_SATURACAO_DEGRAUS * DEGRAU_ADC_UV)) return false;
  const tol = TOLERANCIA_SATURACAO_REL * faixa;
  const vizinhanca = (NIVEIS_REFERENCIA_PLATO + 0.5) * DEGRAU_ADC_UV;
  let noMaximo = 0;
  let abaixoDoMaximo = 0;
  let noMinimo = 0;
  let acimaDoMinimo = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (!Number.isFinite(v)) continue;
    const doMaximo = maximo - v;
    const doMinimo = v - minimo;
    if (doMaximo <= tol) {
      noMaximo++;
    } else if (doMaximo <= vizinhanca) {
      abaixoDoMaximo++;
    }
    if (doMinimo <= tol) {
      noMinimo++;
    } else if (doMinimo <= vizinhanca) {
      acimaDoMinimo++;
    }
  }
  const exigido = Math.max(MIN_AMOSTRAS_SATURACAO, Math.ceil(FRACAO_SATURACAO * validas));
  // noMaximo > RAZAO · (média por degrau abaixo), com contagens inteiras para não depender de divisão.
  const platoNoMaximo =
    noMaximo >= exigido && noMaximo * NIVEIS_REFERENCIA_PLATO > RAZAO_PLATO_SATURACAO * abaixoDoMaximo;
  const platoNoMinimo =
    noMinimo >= exigido && noMinimo * NIVEIS_REFERENCIA_PLATO > RAZAO_PLATO_SATURACAO * acimaDoMinimo;
  return platoNoMaximo || platoNoMinimo;
}

/**
 * Indicadores de qualidade para a tela ao vivo. Os limiares são as constantes
 * exportadas acima: indicativos, não diagnóstico.
 *
 * - Rede: só a fundamental (`redeHz`), por Goertzel (sem FFT), sobre a potência
 *   total do sinal sem DC. Não é avaliada com trecho menor que
 *   DURACAO_MIN_ANALISE_S nem com redeHz >= fs/2; nesses casos o nível é no
 *   máximo "atencao" por falta de dados.
 * - Saturação: platô de amostras repetidas exatamente no máximo/mínimo (pelo menos
 *   max(MIN_AMOSTRAS_SATURACAO, FRACAO_SATURACAO·n)), bem mais povoado que os degraus do
 *   conversor logo abaixo. Não é avaliada se a faixa do sinal tem menos de FAIXA_MIN_SATURACAO_DEGRAUS
 *   degraus (≈ 2,5 µV): ali o sinal é só quantização, como um repouso muito silencioso. Depois de
 *   um passa-alta o platô do clipping deixa de ser exato; para detectá-la avalie o sinal antes
 *   do filtro.
 * - Amostras não finitas contam como o valor médio na análise e rebaixam o nível.
 */
export function qualidadeDoSinal(x: ArrayLike<number>, fsHz: number, redeHz = 60): QualidadeSinal {
  validarPositivo('fsHz', fsHz);
  validarPositivo('redeHz', redeHz);
  const n = x.length;

  let validas = 0;
  let soma = 0;
  let minimo = Infinity;
  let maximo = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = x[i];
    if (!Number.isFinite(v)) continue;
    validas++;
    soma += v;
    if (v < minimo) minimo = v;
    if (v > maximo) maximo = v;
  }
  if (validas === 0) {
    const motivo = n === 0 ? 'sem amostras' : 'nenhuma amostra válida (NaN/Infinity)';
    return {
      ruidoBasalRms: 0,
      contaminacaoRede: 0,
      linhaPlana: false,
      saturacao: false,
      nivel: 'ruim',
      motivos: [motivo],
    };
  }

  const media = soma / validas;
  let desvios = 0;
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(x[i])) desvios += (x[i] - media) * (x[i] - media);
  }
  const desvioPadrao = validas > 1 ? Math.sqrt(desvios / (validas - 1)) : 0;
  const linhaPlana = validas >= 2 && desvioPadrao <= LIMIAR_LINHA_PLANA_UV;

  const saturacao = !linhaPlana && temPlatoNoExtremo(x, minimo, maximo, validas);

  const acc = somaCumulativaDeQuadrados(x);
  const janelaBasal = Math.min(n, amostrasDe(fsHz, JANELA_RUIDO_BASAL_MS));
  const { minSoma } = extremosDasJanelas(acc, janelaBasal);
  const ruidoBasalRms = Math.sqrt(Math.max(0, minSoma) / janelaBasal);

  const curto = n < DURACAO_MIN_ANALISE_S * fsHz;
  const redeForaDoAlcance = redeHz >= fsHz / 2;
  let contaminacaoRede = 0;
  if (!linhaPlana && !curto && !redeForaDoAlcance) {
    const potenciaTotal = desvios / n;
    if (potenciaTotal > 0) {
      const potenciaRede = potenciaDeGoertzel(x, media, redeHz, fsHz);
      contaminacaoRede = Math.min(1, potenciaRede / potenciaTotal);
    }
  }

  const invalidas = n - validas;
  const motivos: string[] = [];
  let ruim = false;
  let atencao = false;

  if (linhaPlana) {
    ruim = true;
    motivos.push('linha plana: eletrodo solto, sensor desconectado ou sem sinal');
  }
  if (saturacao) {
    ruim = true;
    motivos.push('saturação: muitas amostras repetidas no valor extremo do sinal');
  }
  if (contaminacaoRede >= LIMIAR_REDE_RUIM) {
    ruim = true;
    motivos.push(`rede elétrica de ${redeHz} Hz domina o sinal`);
  } else if (contaminacaoRede >= LIMIAR_REDE_ATENCAO) {
    atencao = true;
    motivos.push(`interferência da rede elétrica de ${redeHz} Hz`);
  }
  if (!linhaPlana && ruidoBasalRms >= LIMIAR_RUIDO_BASAL_RUIM_UV) {
    ruim = true;
    motivos.push('ruído basal muito alto (ou sem trecho de repouso)');
  } else if (!linhaPlana && ruidoBasalRms >= LIMIAR_RUIDO_BASAL_ATENCAO_UV) {
    atencao = true;
    motivos.push('ruído basal elevado (ou sem trecho de repouso)');
  }
  if (invalidas > 0) {
    if (invalidas / n >= LIMIAR_AMOSTRAS_INVALIDAS_RUIM) {
      ruim = true;
    } else {
      atencao = true;
    }
    motivos.push(`${invalidas} amostra(s) inválida(s) (NaN/Infinity)`);
  }
  if (curto) {
    atencao = true;
    motivos.push('trecho curto demais para avaliar a rede e o ruído basal');
  } else if (redeForaDoAlcance) {
    atencao = true;
    motivos.push('taxa de amostragem baixa demais para medir a rede elétrica');
  }

  let nivel: NivelQualidade = 'bom';
  if (ruim) {
    nivel = 'ruim';
  } else if (atencao) {
    nivel = 'atencao';
  }
  return { ruidoBasalRms, contaminacaoRede, linhaPlana, saturacao, nivel, motivos };
}
