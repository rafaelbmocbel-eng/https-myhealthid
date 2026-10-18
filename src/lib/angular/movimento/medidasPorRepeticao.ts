import { faseDo } from './protocolos';
import { finito, resolucaoDaUnidade, resumir, validos, type Num } from './estatistica';
import { expandir, FATOR_COBERTURA, residuoNasJanelas, type SerieProcessada } from './incerteza';
import type { Fonte } from './seriesDerivadas';
import type {
  ChaveLado, DefMedidaRepeticao, FaseMovimento, MarcoRepeticao, MedidaPorRepeticao, Protocolo, Repeticao, ResumosPorMedida, ValoresPorLado,
} from './tipos';

/*
 * Medidas por repetição e por lado (agente M). Cada medida declara a fase (janela entre dois marcos da repetição) e a extração
 * (máximo, amplitude, média, valor no marco, duração); o valor sai SEMPRE da série suavizada, dentro da janela da repetição.
 * Os arrays têm o comprimento de `repeticoes`, com null onde não houve medida (repetição incompleta, outro pé na marcha ou falta de pontos).
 * Máximo, mínimo, amplitude e valor no marco só valem se a série BRUTA (sem interpolação) tem pontos em torno do instante do extremo:
 * quando o detector perde o membro justamente no ponto mais baixo, o que sobra da descida dá um extremo menor que o real, e a diferença
 * entre os lados sairia como achado sem que nada avisasse.
 */

/** Fração mínima de quadros com valor na janela da fase; abaixo disso a medida da repetição fica sem valor (mesma regra do motor de métricas). */
const FRACAO_MINIMA_VALIDOS = 0.7;

/** Meia-largura, em segundos, da vizinhança do instante do extremo em que a série bruta precisa ter a mesma fração mínima de pontos. */
const VIZINHANCA_EXTREMO_S = 0.15;

export interface EntradaMedidas {
  protocolo: Protocolo;
  repeticoes: Repeticao[];
  /** Séries angulares por id da articulação. */
  angulos: Record<string, SerieProcessada>;
  /** Séries dos deslocamentos (avanco_d, avanco_e, profundidade, desvio_pelve, altura_pelve, quadril_tornozelo). */
  deslocamentos: Record<string, Fonte>;
  quadroS: number;
}

/**
 * Quadros de incerteza de um tempo. Na marcha os marcos são eventos (contato e saída do pé, com instante refinado entre quadros): um
 * quadro. No agachamento o início e o fim vêm do cruzamento de um nível numa série ruidosa, e o instante oscila mais que um quadro
 * quando o vídeo é ruidoso: dois quadros (o fator de cobertura sobre o erro de um quadro).
 */
export const quadrosDeIncertezaDoTempo = (protocolo: Protocolo): number => (protocolo.gesto === 'marcha' ? 1 : FATOR_COBERTURA);

/** Meia-largura, em segundos, da vizinhança do marco em que se estima a incerteza de uma medida lida num instante só. */
const VIZINHANCA_MARCO_S = 0.3;

export interface ResultadoMedidas {
  medidas: MedidaPorRepeticao[];
  resumos: ResumosPorMedida;
  /** Referência em pixels que normaliza cada medida de deslocamento (para converter em cm com a escala), por medida e lado. */
  refsPx: Record<string, Partial<Record<ChaveLado, number | null>>>;
  /** Posições das repetições em que faltaram pontos do corpo para alguma medida. */
  comPontosAusentes: Set<number>;
}

/** Chave da série que alimenta a medida, por lado; null para os tempos (que não usam série). */
export function chaveDaSerie(idMedida: string, lado: ChaveLado): string | null {
  const s = lado === 'E' ? 'e' : 'd';
  switch (idMedida) {
    case 'flexao_joelho_max':
    case 'flexao_joelho_pico_balanco':
      return `joelho_${s}`;
    case 'flexao_quadril_max':
    case 'amplitude_quadril':
      return `quadril_${s}`;
    case 'dorsiflexao_max':
      return `tornozelo_${s}`;
    case 'inclinacao_tronco_fundo':
    case 'inclinacao_tronco_media':
      return 'tronco';
    case 'avanco_joelho_fundo':
      return `avanco_${s}`;
    case 'profundidade_quadril':
      return 'profundidade';
    case 'valgo_joelho_max':
      return `valgo_${s}`;
    case 'desvio_lateral_pelve_fundo':
      return 'desvio_pelve';
    case 'descida_pelve':
      return 'altura_pelve';
    default:
      return null;
  }
}

const indiceDoMarco = (r: Repeticao, m: MarcoRepeticao): number => (m === 'inicio' ? r.inicioI : m === 'fundo' ? r.fundoI : r.fimI);
const tempoDoMarco = (r: Repeticao, m: MarcoRepeticao): number => (m === 'inicio' ? r.inicioT : m === 'fundo' ? r.fundoT : r.fimT);

function extremos(v: number[]): { min: number; max: number; media: number } {
  let min = Infinity, max = -Infinity, soma = 0;
  for (const x of v) {
    if (x < min) min = x;
    if (x > max) max = x;
    soma += x;
  }
  return { min, max, media: soma / v.length };
}

interface Extraido { valor: number | null; faltou: boolean }

/** O instante do extremo tem pontos brutos (não interpolados) em pelo menos 70% dos quadros de sua vizinhança? */
function extremoCoberto(bruto: readonly Num[], i: number, meia: number): boolean {
  let total = 0, com = 0;
  for (let j = Math.max(0, i - meia); j <= Math.min(bruto.length - 1, i + meia); j++) {
    total++;
    if (finito(bruto[j])) com++;
  }
  return total > 0 && com >= FRACAO_MINIMA_VALIDOS * total;
}

function extrair(
  def: DefMedidaRepeticao, fase: FaseMovimento, rep: Repeticao, serie: Pick<SerieProcessada, 'suave' | 'bruto'> | null, divisor: number | null, meiaExtremo: number,
): Extraido {
  if (def.extracao === 'duracao') {
    const d = tempoDoMarco(rep, fase.ate) - tempoDoMarco(rep, fase.de);
    return { valor: finito(d) && d >= 0 ? d : null, faltou: false };
  }
  if (!serie) return { valor: null, faltou: true };
  const suave = serie.suave;
  const a = indiceDoMarco(rep, fase.de), b = indiceDoMarco(rep, fase.ate);
  if (def.extracao === 'valor_no_marco') {
    const v = suave[a];
    return finito(v) && extremoCoberto(serie.bruto, a, meiaExtremo) ? { valor: v, faltou: false } : { valor: null, faltou: true };
  }
  const inicio = Math.min(a, b);
  const trecho = suave.slice(inicio, Math.max(a, b) + 1);
  const v = validos(trecho);
  if (!v.length || v.length < FRACAO_MINIMA_VALIDOS * trecho.length) return { valor: null, faltou: true };
  const e = extremos(v);
  const exigeMaximo = def.extracao === 'maximo' || def.extracao === 'amplitude';
  const exigeMinimo = def.extracao === 'minimo' || def.extracao === 'amplitude';
  if (exigeMaximo && !extremoCoberto(serie.bruto, inicio + trecho.findIndex((x) => x === e.max), meiaExtremo)) return { valor: null, faltou: true };
  if (exigeMinimo && !extremoCoberto(serie.bruto, inicio + trecho.findIndex((x) => x === e.min), meiaExtremo)) return { valor: null, faltou: true };
  let valor: number;
  if (def.extracao === 'maximo') valor = e.max;
  else if (def.extracao === 'minimo') valor = e.min;
  else if (def.extracao === 'media') valor = e.media;
  else valor = e.max - e.min;
  if (divisor !== null) {
    if (!(divisor > 0)) return { valor: null, faltou: true };
    valor = (valor / divisor) * 100;
  }
  return finito(valor) ? { valor, faltou: false } : { valor: null, faltou: true };
}

type Janela = readonly [number, number];

/** Janelas (índices de quadro) em que a medida é lida: a fase inteira, ou a vizinhança do marco quando a medida é lida num instante só. */
function janelasDaMedida(def: DefMedidaRepeticao, fase: FaseMovimento, repeticoes: Repeticao[], lado: ChaveLado, fps: number): Janela[] {
  const meia = Math.max(2, Math.round(VIZINHANCA_MARCO_S * fps));
  const janelas: Janela[] = [];
  for (const rep of repeticoes) {
    if (rep.sinalizadores.includes('incompleta')) continue;
    if (def.porLado && rep.lado !== null && rep.lado !== lado) continue;
    const a = indiceDoMarco(rep, fase.de), b = indiceDoMarco(rep, fase.ate);
    if (def.extracao === 'valor_no_marco') janelas.push([Math.max(rep.inicioI, a - meia), Math.min(rep.fimI, a + meia)]);
    else janelas.push([a, b]);
  }
  return janelas;
}

/**
 * Incerteza de um valor da medida: o resíduo nas janelas em que ela é lida (sem amostras suficientes, o resíduo da série inteira), com
 * piso na incerteza estimada nos trechos em pé do vídeo, quando há (ver incerteza.ts).
 */
function incertezaNasJanelas(serie: SerieProcessada, janelas: readonly Janela[]): number | null {
  const r = residuoNasJanelas(serie.bruto, serie.referencia, janelas);
  const doResiduo = r.u !== null ? expandir(r.u) : serie.u;
  const piso = serie.uEmPe ?? null;
  if (doResiduo === null) return piso;
  return piso !== null ? Math.max(doResiduo, piso) : doResiduo;
}

/** Nunca informa incerteza menor que o último dígito exibido (ver `resolucaoDaUnidade`). */
const comPisoDeResolucao = (u: number | null, unidade: string): number | null => (u === null ? null : Math.max(u, resolucaoDaUnidade(unidade)));

export function calcularMedidas(e: EntradaMedidas): ResultadoMedidas {
  const { protocolo, repeticoes, angulos, deslocamentos, quadroS } = e;
  const medidas: MedidaPorRepeticao[] = [];
  const resumos: ResumosPorMedida = {};
  const refsPx: ResultadoMedidas['refsPx'] = {};
  const comPontosAusentes = new Set<number>();
  const meiaExtremo = Math.max(2, Math.round(VIZINHANCA_EXTREMO_S / quadroS));

  for (const def of protocolo.medidas) {
    const fase = faseDo(protocolo, def.fase);
    const lados: ChaveLado[] = def.porLado ? ['D', 'E'] : ['unico'];
    const valores: ValoresPorLado = {};
    const incerteza: MedidaPorRepeticao['incerteza'] = {};
    const avisos: string[] = [];
    refsPx[def.id] = {};
    resumos[def.id] = {};
    let semPontos = 0;

    for (const lado of lados) {
      const chave = chaveDaSerie(def.id, lado);
      const fonteDesloc = chave ? deslocamentos[chave] : undefined;
      const serie = chave ? (angulos[chave] ?? fonteDesloc ?? null) : null;
      const normalizador = def.id === 'descida_pelve' ? deslocamentos.quadril_tornozelo : undefined;
      refsPx[def.id][lado] = def.id === 'descida_pelve' ? (normalizador?.refPx ?? null) : (fonteDesloc?.refPx ?? null);

      const uSerie = serie && fase ? incertezaNasJanelas(serie, janelasDaMedida(def, fase, repeticoes, lado, 1 / quadroS)) : (serie?.u ?? null);
      if (def.grandeza === 'tempo') {
        const quadros = quadrosDeIncertezaDoTempo(protocolo);
        incerteza[lado] = comPisoDeResolucao(quadros * quadroS, def.unidade);
        if (quadros > 1 && lado === lados[0]) avisos.push('Início e fim da repetição são achados por um nível na série suavizada, que oscila com o ruído do vídeo: a incerteza da duração é de dois quadros.');
      } else if (def.id === 'descida_pelve') {
        const ref = normalizador?.refPx ?? null;
        incerteza[lado] = comPisoDeResolucao(uSerie !== null && ref !== null && ref > 0 ? (uSerie / ref) * 100 : null, def.unidade);
      } else incerteza[lado] = comPisoDeResolucao(uSerie, def.unidade);

      if (!fase) {
        avisos.push(`A fase "${def.fase}" não existe neste protocolo: a medida não foi calculada.`);
        valores[lado] = repeticoes.map(() => null);
        resumos[def.id][lado] = resumir(valores[lado] as (number | null)[]);
        continue;
      }
      if (def.grandeza !== 'tempo' && !serie) avisos.push('Sem série para esta medida: faltam pontos do corpo em todos os quadros.');

      const arr: (number | null)[] = repeticoes.map((rep, r) => {
        if (rep.sinalizadores.includes('incompleta')) return null;
        if (def.porLado && rep.lado !== null && rep.lado !== lado) return null;
        let divisor: number | null = null;
        if (def.id === 'descida_pelve') {
          const h0 = normalizador?.suave[rep.inicioI];
          if (!finito(h0) || !(h0 > 0)) { comPontosAusentes.add(r); semPontos++; return null; }
          divisor = h0;
        }
        const x = extrair(def, fase, rep, serie, divisor, meiaExtremo);
        if (x.faltou) { comPontosAusentes.add(r); semPontos++; }
        return x.valor;
      });
      valores[lado] = arr;
      resumos[def.id][lado] = resumir(arr);
    }

    if (semPontos) {
      const rotulo = semPontos === 1 ? 'valor ficou' : 'valores ficaram';
      avisos.push(`${semPontos} ${rotulo} sem medida por falta de pontos do corpo na janela da repetição ou em torno do instante do extremo.`);
    }
    medidas.push({ def, valores, incerteza, avisos });
  }
  return { medidas, resumos, refsPx, comPontosAusentes };
}
