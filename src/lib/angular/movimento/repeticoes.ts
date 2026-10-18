import { eventosDo, extremosLocais, tempoDoEvento, type EventoPasso } from '../video/eventos';
import type { Lado, TrilhaPose } from '../video/tipos';
import { escoreZModificado, finito, mad, mediana, percentil, validos, type Num } from './estatistica';
import type { Repeticao, SinalizadorRepeticao } from './tipos';

/*
 * Segmentação das repetições (agente M). Cada repetição tem três marcos: início, fundo e fim.
 *  - Agachamento: o fundo é o pico da série de referência (flexão do joelho de lado; descida do quadril de frente). O início e o fim
 *    são os pontos em que o movimento começa e termina, achados com HISTERESE: o movimento só é confirmado quando a série passa de
 *    15% da amplitude da repetição acima do nível em pé, mas o marco é posto onde ela deixou os 5% (a última passagem por esse nível
 *    antes da confirmação). Assim o ruído em pé não cria repetições nem desloca o início.
 *  - Marcha: a repetição é a passada (contato do pé até o contato seguinte do mesmo pé) e o fundo é a saída do pé entre os dois.
 */

/** Fração da amplitude acima do nível em pé que marca o começo e o fim do movimento (nível baixo da histerese). */
const FRACAO_REPOUSO = 0.05;
/** Fração da amplitude que confirma que o movimento começou (nível alto da histerese). */
const FRACAO_MOVIMENTO = 0.15;
/** Quanto o nível em pé da ponta do trecho pode estar acima do nível em pé do vídeo, em fração da amplitude, para a repetição contar como completa. */
const TOLERANCIA_EM_PE = 0.2;
/** Menor proeminência relativa de um pico para ser uma repetição, como no motor de métricas (metricas.ts). */
const PROEMINENCIA_RELATIVA = 0.4;
/** Duração plausível de uma passada na marcha (mesma regra do motor de métricas): fora disso o intervalo é ignorado, não é passada. */
export const PASSADA_MARCHA_S = { min: 0.6, max: 2.5 };

export interface ParametrosPicos {
  /** Amplitude mínima (P95 − P5) da série para haver repetição, na unidade da série. */
  amplitudeMin: number;
  /** Proeminência mínima absoluta de um pico, na unidade da série. */
  proeminenciaMin: number;
  /** Distância mínima entre dois fundos, em segundos. */
  distMinS: number;
  /** Ruído da série (u), para os níveis da histerese nunca ficarem abaixo dele. 0 se desconhecido. */
  ruido: number;
}

export interface RepeticaoBruta { inicioI: number; fundoI: number; fimI: number; incompleta: boolean }

function minimoNoTrecho(s: readonly Num[], de: number, ate: number): { i: number; v: number } | null {
  let melhor: { i: number; v: number } | null = null;
  for (let j = Math.max(0, de); j <= Math.min(s.length - 1, ate); j++) {
    const v = s[j];
    if (finito(v) && (melhor === null || v < melhor.v)) melhor = { i: j, v };
  }
  return melhor;
}

/** Início do movimento antes do pico: a última passagem pelo nível baixo antes da primeira passagem pelo nível alto. */
function inicioDoMovimento(s: readonly Num[], vale: { i: number; v: number }, pico: number, nivelAlto: number, nivelBaixo: number): number | null {
  let confirmado = -1;
  for (let j = vale.i; j <= pico; j++) {
    const v = s[j];
    if (finito(v) && v > nivelAlto) { confirmado = j; break; }
  }
  if (confirmado < 0) return null;
  for (let j = confirmado; j >= vale.i; j--) {
    const v = s[j];
    if (finito(v) && v <= nivelBaixo) return j;
  }
  return vale.i;
}

/** Fim do movimento depois do pico: simétrico do início (a última passagem pelo nível alto, e a primeira abaixo do nível baixo depois dela). */
function fimDoMovimento(s: readonly Num[], pico: number, vale: { i: number; v: number }, nivelAlto: number, nivelBaixo: number): number | null {
  let confirmado = -1;
  for (let j = vale.i; j >= pico; j--) {
    const v = s[j];
    if (finito(v) && v > nivelAlto) { confirmado = j; break; }
  }
  if (confirmado < 0) return null;
  for (let j = confirmado; j <= vale.i; j++) {
    const v = s[j];
    if (finito(v) && v <= nivelBaixo) return j;
  }
  return vale.i;
}

/** Picos da série de referência (a série cresce no fundo da repetição) com início e fim por histerese. */
export function segmentarPicos(serie: readonly Num[], fps: number, p: ParametrosPicos): RepeticaoBruta[] {
  const v = validos(serie);
  if (v.length < 5) return [];
  const p5 = percentil(v, 0.05) as number, p95 = percentil(v, 0.95) as number;
  const amplitude = p95 - p5;
  if (!(amplitude >= p.amplitudeMin) || !(amplitude > 0)) return [];
  const proeminencia = Math.max(p.proeminenciaMin, PROEMINENCIA_RELATIVA * amplitude);
  const dist = Math.max(3, Math.round(p.distMinS * fps));
  const picos = extremosLocais(serie, 'max', dist, proeminencia, Math.round(dist * 1.5));
  if (!picos.length) return [];

  let primeiro = 0;
  while (primeiro < serie.length && !finito(serie[primeiro])) primeiro++;
  let ultimo = serie.length - 1;
  while (ultimo > 0 && !finito(serie[ultimo])) ultimo--;

  const saida: RepeticaoBruta[] = [];
  picos.forEach((pico, k) => {
    const vp = serie[pico] as number;
    const valeE = minimoNoTrecho(serie, k > 0 ? picos[k - 1] : primeiro, pico);
    const valeD = minimoNoTrecho(serie, pico, k + 1 < picos.length ? picos[k + 1] : ultimo);
    if (!valeE || !valeD) return;
    const niveis = (base: number) => {
      const a = vp - base;
      return { alto: base + Math.max(FRACAO_MOVIMENTO * a, 3 * p.ruido), baixo: base + Math.max(FRACAO_REPOUSO * a, p.ruido) };
    };
    const ne = niveis(valeE.v), nd = niveis(valeD.v);
    const inicio = ne.alto < vp ? inicioDoMovimento(serie, valeE, pico, ne.alto, ne.baixo) : null;
    const fim = nd.alto < vp ? fimDoMovimento(serie, pico, valeD, nd.alto, nd.baixo) : null;
    if (inicio === null || fim === null) return;
    const naPontaEsquerda = k === 0 && valeE.v > p5 + TOLERANCIA_EM_PE * amplitude;
    const naPontaDireita = k === picos.length - 1 && valeD.v > p5 + TOLERANCIA_EM_PE * amplitude;
    saida.push({ inicioI: inicio, fundoI: pico, fimI: fim, incompleta: naPontaEsquerda || naPontaDireita });
  });
  return saida;
}

/** Duração plausível: a repetição cujo tempo se afasta da mediana pelo critério do escore z modificado e por mais de um quadro. */
export function marcarDuracoesDiscrepantes(repeticoes: Repeticao[], quadroS: number): void {
  const completas = repeticoes.filter((r) => !r.sinalizadores.includes('incompleta'));
  if (completas.length < 4) return;
  const duracoes = completas.map((r) => r.duracao);
  const med = mediana(duracoes) as number;
  const madValor = mad(duracoes);
  for (const r of completas) {
    const m = escoreZModificado(r.duracao, med, madValor);
    if (m !== null && Math.abs(m) > 3.5 && Math.abs(r.duracao - med) > quadroS) r.sinalizadores.push('duracao_discrepante');
  }
}

function repeticao(numero: number, lado: Lado | null, i0: number, i1: number, i2: number, t: [number, number, number], incompleta: boolean): Repeticao {
  const sinalizadores: SinalizadorRepeticao[] = incompleta ? ['incompleta'] : [];
  return { numero, lado, inicioI: i0, fundoI: i1, fimI: i2, inicioT: t[0], fundoT: t[1], fimT: t[2], duracao: t[2] - t[0], sinalizadores };
}

/** Repetições do agachamento a partir da segmentação por picos. */
export function repeticoesDoAgachamento(trilha: TrilhaPose, brutas: RepeticaoBruta[]): Repeticao[] {
  return brutas.map((b, k) =>
    repeticao(k + 1, null, b.inicioI, b.fundoI, b.fimI, [trilha.quadros[b.inicioI].t, trilha.quadros[b.fundoI].t, trilha.quadros[b.fimI].t], b.incompleta));
}

export interface PassadasMarcha { repeticoes: Repeticao[]; ignoradas: number; semSaida: number }

/**
 * Passadas da marcha: do contato de um pé ao contato seguinte do mesmo pé, com a saída desse pé entre os dois. Intervalos fora de
 * 0,6 a 2,5 s não são passadas (provável contato perdido) e são ignorados; passada sem saída fica como incompleta.
 * A ordem é a do início (os dois pés intercalados).
 */
export function repeticoesDaMarcha(trilha: TrilhaPose, eventos: EventoPasso[]): PassadasMarcha {
  type Item = { lado: Lado; a: EventoPasso; b: EventoPasso; s: EventoPasso | undefined };
  const itens: Item[] = [];
  let ignoradas = 0;
  for (const lado of ['D', 'E'] as const) {
    const contatos = eventosDo(eventos, lado, 'contato');
    const saidas = eventosDo(eventos, lado, 'saida');
    for (let k = 0; k + 1 < contatos.length; k++) {
      const a = contatos[k], b = contatos[k + 1];
      const dur = tempoDoEvento(b) - tempoDoEvento(a);
      if (!(dur >= PASSADA_MARCHA_S.min && dur <= PASSADA_MARCHA_S.max)) { ignoradas++; continue; }
      itens.push({ lado, a, b, s: saidas.find((e) => e.i > a.i && e.i < b.i) });
    }
  }
  itens.sort((x, y) => x.a.i - y.a.i || (x.lado < y.lado ? -1 : 1));
  let semSaida = 0;
  const repeticoes = itens.map((it, k) => {
    if (!it.s) semSaida++;
    const saida = it.s ?? it.a;
    return repeticao(k + 1, it.lado, it.a.i, saida.i, it.b.i, [tempoDoEvento(it.a), tempoDoEvento(saida), tempoDoEvento(it.b)], !it.s);
  });
  return { repeticoes, ignoradas, semSaida };
}
