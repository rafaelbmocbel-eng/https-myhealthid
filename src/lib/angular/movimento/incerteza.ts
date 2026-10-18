import { janelaEmAmostras, preencherLacunas, suavizar } from '../video/suavizar';
import type { TrilhaPose } from '../video/tipos';
import { finito, mediana, type Num } from './estatistica';

/*
 * Incerteza estimada do próprio vídeo (agente M). Segue FORMULAS_INCERTEZA (protocolos.ts): para ângulos e deslocamentos,
 * u = FATOR_COBERTURA × raiz( soma((bruto − suavizado)²) ÷ (n − 1) ) sobre as n amostras em que as duas séries têm valor
 * (as das janelas em que a medida é lida); para tempos, um quadro. Nenhuma tolerância fixa em graus: o número vem do quanto a série
 * bruta de ESTE vídeo se afasta da suavizada.
 */

/**
 * Fator de cobertura da incerteza informada (convenção da incerteza expandida: cerca de 95% de cobertura se o erro for gaussiano).
 * Sem ele, "maior que a incerteza" equivale a passar de 1 desvio-padrão do ruído, e um vídeo só com ruído e repetições idênticas dispara a
 * variação, a tendência e a repetição discrepante em cerca de um terço das medidas (medido nos testes). Com 2, isso cai para poucos por cento.
 * Para voltar à regra de 1 desvio-padrão, basta valer 1 aqui (e ajustar o texto de FORMULAS_INCERTEZA em protocolos.ts).
 */
export const FATOR_COBERTURA = 2;

export const expandir = (rms: number | null): number | null => (rms === null ? null : FATOR_COBERTURA * rms);

/** Janela de suavização padrão do motor (mesma de analisarGesto), em segundos. */
export const JANELA_SUAVIZACAO_S = 0.12;

/** Menos amostras que isto e o resíduo não é estimado (a raiz de poucos pontos não diz nada do vídeo). */
const MIN_AMOSTRAS_RESIDUO = 5;

/** `u` é o resíduo quadrático médio (1 desvio-padrão), sem o fator de cobertura. */
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
  const u = n >= MIN_AMOSTRAS_RESIDUO ? Math.sqrt(soma / (n - 1)) : null;
  return { u: u !== null && Number.isFinite(u) ? u : null, n };
}

/**
 * Resíduo só nas janelas em que a medida é lida (índices inclusivos, sem contar duas vezes os quadros comuns). O ruído de uma medida
 * depende da postura (a razão quadril–joelho, por exemplo, é bem mais ruidosa com a coxa na horizontal do que em pé): o resíduo do vídeo
 * inteiro, dominado pelos quadros em pé, subestimaria a incerteza de um valor lido no ponto mais baixo.
 */
export function residuoNasJanelas(bruto: readonly Num[], suave: readonly Num[], janelas: readonly (readonly [number, number])[]): Residuo {
  const n = Math.min(bruto.length, suave.length);
  const usado = new Uint8Array(n);
  for (const [a, b] of janelas) {
    for (let i = Math.max(0, Math.min(a, b)); i <= Math.min(n - 1, Math.max(a, b)); i++) usado[i] = 1;
  }
  const b2: Num[] = [], s2: Num[] = [];
  for (let i = 0; i < n; i++) {
    if (!usado[i]) continue;
    b2.push(bruto[i]);
    s2.push(suave[i]);
  }
  return residuoEntre(b2, s2);
}

/** Série pronta para medir: bruta, suavizada e a incerteza (expandida) de um valor dela, na unidade da própria série. */
export interface SerieProcessada {
  bruto: (number | null)[];
  suave: (number | null)[];
  /** Série contra a qual o resíduo é calculado (a própria suavizada; com a suavização desligada, a suavização padrão). */
  referencia: (number | null)[];
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
  return { bruto: limpo, suave, referencia, u: expandir(r.u), nAmostras: r.n };
}

/** Taxas de quadros plausíveis para um vídeo de pessoa se movendo; fora disso a janela de suavização explode ou some. */
const FPS_MIN = 1;
const FPS_MAX = 1000;
const fpsPlausivel = (f: number): boolean => finito(f) && f >= FPS_MIN && f <= FPS_MAX;

/**
 * Taxa efetiva da trilha. A declarada vale se for plausível; senão sai do intervalo mediano entre os quadros, e, se nem isso servir,
 * assume 30 quadros/s. `declarada` diz se a taxa da trilha foi usada como veio.
 */
export function fpsEfetivo(trilha: TrilhaPose): { fps: number; declarada: boolean } {
  if (fpsPlausivel(trilha.fps)) return { fps: trilha.fps, declarada: true };
  const passos: number[] = [];
  for (let i = 1; i < trilha.quadros.length; i++) {
    const d = trilha.quadros[i].t - trilha.quadros[i - 1].t;
    if (finito(d) && d > 0) passos.push(d);
  }
  const d = mediana(passos);
  if (d !== null && fpsPlausivel(1 / d)) return { fps: 1 / d, declarada: false };
  return { fps: 30, declarada: false };
}

/** Um quadro, em segundos: 1 ÷ taxa efetiva da trilha. */
export const quadroDaTrilha = (trilha: TrilhaPose): number => 1 / fpsEfetivo(trilha).fps;

/** Incerteza angular geral do vídeo: a mediana de u entre as séries angulares do protocolo. */
export function incertezaAngularGeral(us: readonly Num[]): number | null {
  return mediana(us.filter(finito));
}
