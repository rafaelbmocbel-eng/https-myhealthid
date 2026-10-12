/*
 * Tempo, quadros e limites do player de vídeo (funções puras). O vídeo é percorrido por quadros da trilha
 * de pose: índice 0..n-1, cada um com seu tempo em segundos.
 */

export const VELOCIDADES = [0.1, 0.25, 0.5, 1] as const;
export type Velocidade = (typeof VELOCIDADES)[number];

import { LIMITES_VIDEO } from '@/lib/angular/video/rastrear';

// Os limites de duração e tamanho são os do motor de rastreio, para a tela e o motor concordarem.
export const DURACAO_SUGERIDA_S = LIMITES_VIDEO.duracaoSugeridaS;
export const DURACAO_MINIMA_S = 1;
export const TAMANHO_AVISO_MB = LIMITES_VIDEO.tamanhoSugeridoMB;
export const LADO_MAIOR_AVISO_PX = 1920;

export const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/** Índice do tempo mais próximo de `t` numa lista crescente de tempos. */
export function indiceMaisProximo(tempos: readonly number[], t: number): number {
  const n = tempos.length;
  if (n === 0) return 0;
  if (t <= tempos[0]) return 0;
  if (t >= tempos[n - 1]) return n - 1;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (tempos[mid] <= t) lo = mid; else hi = mid;
  }
  return t - tempos[lo] <= tempos[hi] - t ? lo : hi;
}

/**
 * Instante em que o vídeo é parado para mostrar o quadro de tempo `t`: um pouco depois do início do quadro,
 * porque parar exatamente no carimbo de tempo pode mostrar o quadro anterior por erro de arredondamento.
 */
export const tempoDeExibicao = (t: number, fps: number): number => t + 0.25 / Math.max(1, fps);

/** Intervalo entre quadros (ms) para tocar quadro a quadro na velocidade pedida. */
export const intervaloEntreQuadrosMs = (fps: number, velocidade: number): number => 1000 / (Math.max(1, fps) * Math.max(0.01, velocidade));

/** Quantos quadros um deslizar de dedo de `dxPx` pixels avança (negativo volta); `pxPorQuadro` é a sensibilidade. */
export function quadrosDoDeslize(dxPx: number, pxPorQuadro = 12): number {
  return Math.trunc(dxPx / Math.max(1, pxPorQuadro));
}

/** Sensibilidade do deslize: o vídeo todo cabe em ~1,5 largura da caixa, mas nunca menos de 6 px por quadro. */
export function sensibilidadeDoDeslize(larguraCaixaPx: number, nQuadros: number): number {
  return Math.max(6, (larguraCaixaPx * 1.5) / Math.max(1, nQuadros));
}

export const formatarSegundos = (t: number, casas = 2): string =>
  `${t.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })} s`;

export interface MarcaScrubber { chave: string; i: number; pct: number; tipo: 'corrigido' | 'contato' | 'saida'; lado?: 'D' | 'E' | null }

/** Marcadores sobre a barra de quadros: quadros corrigidos pelo profissional e eventos da marcha ou corrida. */
export function marcasDoScrubber(nQuadros: number, corrigidos: readonly number[], eventos: readonly { i: number; tipo: 'contato' | 'saida'; lado?: 'D' | 'E' | null; id?: string }[]): MarcaScrubber[] {
  if (nQuadros < 1) return [];
  const pct = (i: number) => (nQuadros === 1 ? 0 : (limitar(i, 0, nQuadros - 1) / (nQuadros - 1)) * 100);
  return [
    ...eventos.map((e, k): MarcaScrubber => ({ chave: `e-${e.id ?? k}`, i: e.i, pct: pct(e.i), tipo: e.tipo, lado: e.lado })),
    ...corrigidos.map((i): MarcaScrubber => ({ chave: `c-${i}`, i, pct: pct(i), tipo: 'corrigido' })),
  ];
}

export interface AvisoDoVideo { nivel: 'ok' | 'aviso'; mensagens: string[] }

/** Avisos (não bloqueiam) sobre duração, resolução e tamanho do vídeo escolhido. */
export function avisosDoVideo(v: { duracao: number; largura: number; altura: number; tamanho?: number }): AvisoDoVideo {
  const m: string[] = [];
  if (!Number.isFinite(v.duracao) || v.duracao <= 0) m.push('Não consegui ler a duração deste vídeo.');
  if (v.duracao > DURACAO_SUGERIDA_S) m.push(`O vídeo tem ${Math.round(v.duracao)} s. Para análise rápida, escolha um trecho de até ${DURACAO_SUGERIDA_S} s.`);
  if (v.duracao > 0 && v.duracao < DURACAO_MINIMA_S) m.push('Vídeo muito curto: grave pelo menos 1 s do gesto.');
  if (Math.max(v.largura, v.altura) > LADO_MAIOR_AVISO_PX) m.push('Vídeo em resolução muito alta (4K): a análise fica mais lenta. Se puder, grave em 1080p.');
  if (v.tamanho && v.tamanho > TAMANHO_AVISO_MB * 1024 * 1024) m.push(`Arquivo grande (${Math.round(v.tamanho / 1024 / 1024)} MB): a análise pode demorar e consumir bateria.`);
  return { nivel: m.length ? 'aviso' : 'ok', mensagens: m };
}

export interface IntervaloVideo { inicio: number; fim: number }

/** Trecho padrão a analisar: do início até o limite sugerido. */
export function intervaloPadrao(duracao: number, max = DURACAO_SUGERIDA_S): IntervaloVideo {
  const d = Number.isFinite(duracao) && duracao > 0 ? duracao : 0;
  return { inicio: 0, fim: Math.min(d, max) };
}

/** Mantém o trecho dentro do vídeo, com no mínimo `minimo` s e no máximo `max` s (o lado movido cede ao outro). */
export function ajustarIntervalo(i: IntervaloVideo, duracao: number, ladoMovido: 'inicio' | 'fim', max = DURACAO_SUGERIDA_S, minimo = 0.5): IntervaloVideo {
  let inicio = limitar(i.inicio, 0, duracao), fim = limitar(i.fim, 0, duracao);
  if (ladoMovido === 'inicio') {
    inicio = Math.min(inicio, fim - minimo);
    if (fim - inicio > max) fim = inicio + max;
  } else {
    fim = Math.max(fim, inicio + minimo);
    if (fim - inicio > max) inicio = fim - max;
  }
  return { inicio: Math.max(0, inicio), fim: Math.min(duracao, fim) };
}

export interface OpcaoTaxa { id: 'rapida' | 'detalhada' | 'maxima'; nome: string; fps: number }

/** Taxas de amostragem da análise para um vídeo gravado a `fpsVideo` q/s: nunca acima do que o vídeo tem. */
export function opcoesDeTaxa(fpsVideo: number): OpcaoTaxa[] {
  const f = Math.max(1, Math.round(fpsVideo));
  const lista: OpcaoTaxa[] = [{ id: 'rapida', nome: 'Rápida', fps: Math.min(f, 30) }];
  if (f > 30) lista.push({ id: 'detalhada', nome: 'Detalhada', fps: Math.min(f, 60) });
  if (f > 60) lista.push({ id: 'maxima', nome: 'Máxima', fps: Math.min(f, 120) });
  return lista;
}

/** Estimativa grosseira (s) do rastreio: cerca de 12 quadros por segundo num celular. */
export const estimativaDoRastreio = (duracao: number, fps: number, quadrosPorSegundoDoAparelho = 12): number =>
  Math.max(1, Math.round((duracao * fps) / quadrosPorSegundoDoAparelho));
