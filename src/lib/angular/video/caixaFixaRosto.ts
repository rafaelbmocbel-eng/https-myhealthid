import { caixaRostoPadrao, escalarCaixaRosto, type CaixaRosto } from '@/lib/social/rosto';
import { MARGEM_ROSTO, ampliarCaixa, type OrigemCaixa } from './rostoPorQuadro';

/*
 * Caixa fixa do rosto: onde o app não localiza o rosto num quadro, a cobertura usa uma caixa de posição fixa, e o profissional pode
 * movê-la na prévia (toque, mouse ou setas) até cobrir o rosto. Tudo aqui é aritmética pura, em fração do quadro do vídeo (0 a 1).
 */

/** Centro da caixa fixa, em fração do quadro do vídeo. */
export interface PosicaoCaixa { cx: number; cy: number }

export interface TamanhoCaixa { w: number; h: number }

interface AjusteDeTamanho { mulLargura: number; mulAltura: number }

/** Passo das setas, em fração do quadro; com Shift o passo é o grande. */
export const PASSO_TECLA = 0.01;
export const PASSO_TECLA_GRANDE = 0.05;

const finito = (v: number, padrao: number) => (Number.isFinite(v) ? v : padrao);

/** Caixa inteira dentro do quadro: tamanho entre 0 e 1 e as quatro bordas entre 0 e 1. Valores que não são número viram o centro. */
export function limitarCaixaAoQuadro(c: CaixaRosto): CaixaRosto {
  const w = Math.min(1, Math.max(0, finito(c.w, 0)));
  const h = Math.min(1, Math.max(0, finito(c.h, 0)));
  const cx = Math.min(1 - w / 2, Math.max(w / 2, finito(c.cx, 0.5)));
  const cy = Math.min(1 - h / 2, Math.max(h / 2, finito(c.cy, 0.5)));
  return { cx, cy, w, h };
}

/** Posição que mantém uma caixa do `tamanho` dado inteira dentro do quadro. */
export function limitarPosicaoDaCaixa(posicao: PosicaoCaixa, tamanho: TamanhoCaixa): PosicaoCaixa {
  const { cx, cy } = limitarCaixaAoQuadro({ ...posicao, ...tamanho });
  return { cx, cy };
}

/** Posição movida por (`dx`,`dy`), em fração do quadro, sem a caixa sair dele. */
export function moverPosicaoDaCaixa(posicao: PosicaoCaixa, dx: number, dy: number, tamanho: TamanhoCaixa): PosicaoCaixa {
  return limitarPosicaoDaCaixa({ cx: posicao.cx + finito(dx, 0), cy: posicao.cy + finito(dy, 0) }, tamanho);
}

/** Posição de partida da caixa fixa: a da arte social (alto e ao centro). */
export function posicaoPadraoDaCaixaFixa(largura: number, altura: number): PosicaoCaixa {
  const { cx, cy } = caixaRostoPadrao(largura, altura);
  return { cx, cy };
}

/** A caixa fixa na posição escolhida (ou na padrão, sem escolha), com o tamanho de partida. */
export function caixaFixaNaPosicao(largura: number, altura: number, posicao: PosicaoCaixa | null): CaixaRosto {
  const base = caixaRostoPadrao(largura, altura);
  return limitarCaixaAoQuadro(posicao ? { ...base, cx: posicao.cx, cy: posicao.cy } : base);
}

/**
 * Tamanho que a caixa fixa cobre de fato num quadro sem rosto: o de partida, com a margem do módulo de rosto e o ajuste (a folga do
 * vídeo vezes os controles de largura e altura). É o tamanho que o diálogo mostra e usa para manter a caixa dentro do quadro.
 */
export function tamanhoCobertoDaCaixaFixa(base: CaixaRosto, ajuste: AjusteDeTamanho): TamanhoCaixa {
  const { w, h } = escalarCaixaRosto(ampliarCaixa(base, MARGEM_ROSTO), ajuste.mulLargura, ajuste.mulAltura);
  return { w, h };
}

/** Deslocamento de uma tecla de seta, em fração do quadro; null para qualquer outra tecla. */
export function deslocamentoDaTecla(tecla: string, grande = false): { dx: number; dy: number } | null {
  const passo = grande ? PASSO_TECLA_GRANDE : PASSO_TECLA;
  switch (tecla) {
    case 'ArrowLeft': return { dx: -passo, dy: 0 };
    case 'ArrowRight': return { dx: passo, dy: 0 };
    case 'ArrowUp': return { dx: 0, dy: -passo };
    case 'ArrowDown': return { dx: 0, dy: passo };
    default: return null;
  }
}

/**
 * Próximo quadro do trecho (de `primeiro` a `ultimo`) cuja cobertura usa a caixa fixa, depois do `atual` e voltando ao começo do
 * trecho quando acaba. Devolve o próprio `atual` se ele é o único, e null se o trecho não tem nenhum.
 */
export function proximoQuadroSemRosto(origens: readonly OrigemCaixa[], atual: number, primeiro: number, ultimo: number): number | null {
  const de = Math.max(0, primeiro), ate = Math.min(origens.length - 1, ultimo);
  const total = ate - de + 1;
  if (total <= 0) return null;
  for (let k = 1; k <= total; k++) {
    const i = de + ((((atual - de + k) % total) + total) % total);
    if (origens[i] === 'fixa') return i;
  }
  return null;
}
