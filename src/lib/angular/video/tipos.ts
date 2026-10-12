import type { Landmark } from '../pose';

export type { Landmark };

/** Lado do corpo do paciente (D = direito, E = esquerdo), como no modelo de 33 pontos do MediaPipe. */
export type Lado = 'D' | 'E';

/**
 * Um ponto da trilha, em PIXELS do vídeo (x para a direita, y para baixo).
 * `manual` marca o quadro-chave corrigido pelo profissional; `interp` marca um quadro automático que foi
 * ajustado a partir dos quadros-chave vizinhos; `auto` guarda a detecção original para poder desfazer.
 */
export interface PontoPose {
  x: number;
  y: number;
  conf?: number;
  manual?: boolean;
  interp?: boolean;
  auto?: { x: number; y: number; conf?: number };
}

export interface QuadroPose {
  /** Índice do quadro dentro da trilha (0, 1, 2...). */
  i: number;
  /** Instante no vídeo, em segundos (absoluto: inclui o início do intervalo rastreado). */
  t: number;
  pontos: Record<string, PontoPose>;
}

export interface TrilhaPose {
  fps: number;
  largura: number;
  altura: number;
  quadros: QuadroPose[];
}

/** Trecho do vídeo, em segundos. */
export interface Intervalo { inicio: number; fim: number }

/** Entrada do detector: o quadro já posicionado em `t`. Devolve os 33 pontos normalizados (0–1) ou null se não achar ninguém. */
export type DetectorQuadro = (
  quadro: ImageBitmap | HTMLCanvasElement | HTMLVideoElement,
  t: number,
) => Promise<Landmark[] | null>;

/**
 * Nomes dos pontos da trilha e seus índices no modelo de 33 pontos. "e" e "d" são o lado do paciente.
 * Os pontos das mãos (17 a 22) ficam de fora: nenhuma medida os usa e a trilha fica mais leve.
 */
export const PONTOS_MEDIAPIPE = {
  nariz: 0,
  olho_e_int: 1, olho_e: 2, olho_e_ext: 3, olho_d_int: 4, olho_d: 5, olho_d_ext: 6,
  orelha_e: 7, orelha_d: 8, boca_e: 9, boca_d: 10,
  ombro_e: 11, ombro_d: 12, cotovelo_e: 13, cotovelo_d: 14, punho_e: 15, punho_d: 16,
  quadril_e: 23, quadril_d: 24, joelho_e: 25, joelho_d: 26, tornozelo_e: 27, tornozelo_d: 28,
  calcanhar_e: 29, calcanhar_d: 30, pe_e: 31, pe_d: 32,
} as const;

export type NomePonto = keyof typeof PONTOS_MEDIAPIPE;

export const NOMES_PONTOS = Object.keys(PONTOS_MEDIAPIPE) as NomePonto[];

/** Nomes dos pontos do rosto, na ordem em que o módulo de rosto os usa. */
export const PONTOS_ROSTO: NomePonto[] = [
  'nariz', 'olho_e_int', 'olho_e', 'olho_e_ext', 'olho_d_int', 'olho_d', 'olho_d_ext', 'orelha_e', 'orelha_d', 'boca_e', 'boca_d',
];

/** Abaixo disso o ponto é tratado como ausente nas medidas (um ponto corrigido à mão vale sempre). */
export const CONF_MINIMA = 0.3;

/** Detecções com confiança menor que isto nem entram na trilha. */
export const CONF_GUARDAR = 0.1;

export const ladoDe = (nome: string): Lado | null => {
  if (/_d(_|$)/.test(nome)) return 'D';
  if (/_e(_|$)/.test(nome)) return 'E';
  return null;
};

export const outroLado = (lado: Lado): Lado => (lado === 'D' ? 'E' : 'D');

/** Resultado de uma métrica calculada sobre a trilha. `metrica` é a chave usada na tabela de referências (sem o lado). */
export interface ResultadoMetrica {
  id: string;
  metrica: string;
  nome: string;
  valor: number | null;
  unidade: string;
  lado: Lado | null;
  /** Quantas observações (ciclos, repetições, quadros) entraram no valor. */
  n?: number;
  /** Desvio-padrão das observações, quando o valor é uma média. */
  dp?: number;
  /** Incerteza de medida que o próprio vídeo impõe (na unidade do valor), por exemplo 1 quadro nos tempos. */
  incerteza?: number;
  /** Como o valor é calculado (mostrado no cartão). */
  formula?: string;
  /** Explicação curta do que foi medido. */
  detalhe?: string;
  avisos: string[];
}
