import { janelaEmAmostras, preencherLacunas, suavizar } from '../video/suavizar';
import type { TrilhaPose } from '../video/tipos';
import { finito, mediana, type Num } from './estatistica';

/*
 * Incerteza estimada do próprio vídeo (agente M). Segue FORMULAS_INCERTEZA (protocolos.ts): para ângulos e deslocamentos,
 * u = raiz( soma((bruto − suavizado)²) ÷ (n − 1) ) sobre as n amostras em que as duas séries têm valor; para tempos, um quadro.
 * Nenhuma tolerância fixa em graus: o número vem do quanto a série bruta de ESTE vídeo se afasta da suavizada.
 */

/** Janela de suavização padrão do motor (mesma de analisarGesto), em segundos. */
export const JANELA_SUAVIZACAO_S = 0.12;

/** Menos amostras que isto e o resíduo não é estimado (a raiz de poucos pontos não diz nada do vídeo). */
const MIN_AMOSTRAS_RESIDUO = 5;

export interface Residuo { u: number | null; n: number }

/** Resíduo entre a série bruta e a suavizada. u é null com menos de 5 amostras em comum. */
export function residuoEntre(bruto: readonly Num[], suave: readonly Num[]): Residuo {
  let soma = 0, n = 0;
  const m = Math.min(bruto.length, suave.length);
  for (let i = 0; i < m; i++) {
    const b = bruto[i], s = suave[i];
    if (!finito(b) || !finito(s)) continue;
    soma += (b - s) ** 2;
    n++;
  }
  return { u: n >= MIN_AMOSTRAS_RESIDUO ? Math.sqrt(soma / (n - 1)) : null, n };
}

/** Série pronta para medir: bruta, suavizada e a incerteza de um valor dela (na unidade da própria série). */
export interface SerieProcessada {
  bruto: (number | null)[];
  suave: (number | null)[];
  u: number | null;
  nAmostras: number;
}

const OPCOES_SG = { metodo: 'savitzky_golay', ordem: 2 } as const;

/**
 * Preenche lacunas curtas (até 0,25 s), suaviza (Savitzky–Golay, como o motor) e estima a incerteza. Com a suavização desligada
 * (`suavizacaoS` ≤ 0) a série medida é a bruta, e a incerteza vem do resíduo contra a suavização padrão, para nunca ser zero por construção.
 */
export function processarSerie(bruto: readonly Num[], fps: number, suavizacaoS: number): SerieProcessada {
  const limpo = bruto.map((v) => (finito(v) ? v : null));
  const cheio = preencherLacunas(limpo, Math.max(1, Math.round(0.25 * fps)));
  const suave = suavizacaoS > 0 ? suavizar(cheio, janelaEmAmostras(suavizacaoS, fps), OPCOES_SG) : cheio;
  const referencia = suavizacaoS > 0 ? suave : suavizar(cheio, janelaEmAmostras(JANELA_SUAVIZACAO_S, fps), OPCOES_SG);
  const r = residuoEntre(limpo, referencia);
  return { bruto: limpo, suave, u: r.u, nAmostras: r.n };
}

/** Um quadro, em segundos: 1 ÷ taxa efetiva da trilha (ou o intervalo mediano entre quadros, se a taxa declarada não servir). */
export function quadroDaTrilha(trilha: TrilhaPose): number {
  if (finito(trilha.fps) && trilha.fps > 0) return 1 / trilha.fps;
  const passos: number[] = [];
  for (let i = 1; i < trilha.quadros.length; i++) {
    const d = trilha.quadros[i].t - trilha.quadros[i - 1].t;
    if (finito(d) && d > 0) passos.push(d);
  }
  return mediana(passos) ?? 1 / 30;
}

/** Incerteza angular geral do vídeo: a mediana de u entre as séries angulares do protocolo. */
export function incertezaAngularGeral(us: readonly Num[]): number | null {
  return mediana(us.filter(finito));
}
