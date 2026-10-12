import type { Landmark } from '@/lib/angular/pose';
import { limitar } from './geometria';

/*
 * Região do rosto a esconder. Tudo em fração da foto (0–1): centro e tamanho. Assim a região continua
 * sobre o rosto mesmo quando a foto muda de enquadramento ou de tamanho.
 */

export type ModoRosto = 'nenhum' | 'desfoque' | 'tarja';

export interface CaixaRosto { cx: number; cy: number; w: number; h: number }

// Pontos do rosto no modelo de 33 pontos do MediaPipe: nariz, olhos, orelhas e boca.
const INDICES_ROSTO = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ORELHAS = [7, 8];
const VISIBILIDADE_MINIMA = 0.3;
const VISIBILIDADE_ORELHA = 0.5;

/**
 * Caixa da cabeça a partir dos pontos de pose, ou null se faltar ponto confiável. A cabeça é estimada
 * pelas proporções do rosto (a distância olhos–boca e a largura entre orelhas ou orelha–nariz), com
 * folga para cabelo e queixo: errar para maior é o lado seguro de uma região de privacidade.
 */
export function caixaDoRostoPorLandmarks(lm: Landmark[] | null | undefined, largura: number, altura: number): CaixaRosto | null {
  if (!lm || !(largura > 0) || !(altura > 0)) return null;
  const visiveis = (i: number) => {
    const l = lm[i];
    return l && Number.isFinite(l.x) && Number.isFinite(l.y) && (l.visibility ?? 1) >= VISIBILIDADE_MINIMA ? { x: l.x * largura, y: l.y * altura } : null;
  };
  const pts = INDICES_ROSTO.map(visiveis).filter((p): p is { x: number; y: number } => p !== null);
  if (pts.length < 3) return null;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const bw = Math.max(maxX - minX, 1), bh = Math.max(maxY - minY, 1);

  const alturaCabeca = Math.max(bw * 1.7, bh * 3);
  const larguraCabeca = Math.max(bw * 1.5, alturaCabeca * 0.8);
  let cx = (minX + maxX) / 2;

  // De perfil só uma orelha aparece e o centro dos pontos fica na frente da cabeça: recua para o lado oposto ao nariz.
  const orelhas = ORELHAS.filter((i) => (lm[i]?.visibility ?? 1) >= VISIBILIDADE_ORELHA);
  const nariz = visiveis(0);
  if (orelhas.length === 1 && nariz) {
    const o = lm[orelhas[0]];
    cx -= Math.sign(nariz.x - o.x * largura) * larguraCabeca * 0.15;
  }

  const folga = 1.12;
  const topo = minY - alturaCabeca * 0.52, base = minY + alturaCabeca * 0.55;
  const cy = (topo + base) / 2;
  const h = (base - topo) * folga;
  // Os pontos do rosto (a ponta do nariz, em especial) nunca ficam de fora, mesmo com a cabeça estimada pequena.
  const sobra = larguraCabeca * 0.14;
  const esquerda = Math.min(cx - (larguraCabeca * folga) / 2, minX - sobra), direita = Math.max(cx + (larguraCabeca * folga) / 2, maxX + sobra);
  return {
    cx: limitar((esquerda + direita) / 2 / largura, 0, 1), cy: limitar(cy / altura, 0, 1),
    w: Math.min(1, (direita - esquerda) / largura), h: Math.min(1, h / altura),
  };
}

/** Caixa de partida sem pontos de pose: no alto e ao centro, onde costuma estar a cabeça numa foto de corpo inteiro; o usuário arrasta até o rosto. */
export function caixaRostoPadrao(largura: number, altura: number): CaixaRosto {
  const h = 0.15;
  const w = largura > 0 && altura > 0 ? Math.min(0.9, (h * altura * 0.85) / largura) : 0.2;
  return { cx: 0.5, cy: 0.12, w, h };
}

export const MULTIPLICADOR_MIN = 0.5;
export const MULTIPLICADOR_MAX = 2.2;

/** Caixa com largura e altura multiplicadas (os controles de tamanho), sempre dentro da foto. */
export function escalarCaixaRosto(c: CaixaRosto, mulLargura: number, mulAltura: number): CaixaRosto {
  const ml = limitar(mulLargura, MULTIPLICADOR_MIN, MULTIPLICADOR_MAX), ma = limitar(mulAltura, MULTIPLICADOR_MIN, MULTIPLICADOR_MAX);
  return { cx: c.cx, cy: c.cy, w: Math.min(1, c.w * ml), h: Math.min(1, c.h * ma) };
}

/** Centro da caixa movido para (`cx`,`cy`), sem sair da foto. */
export function moverCaixaRosto(c: CaixaRosto, cx: number, cy: number): CaixaRosto {
  return { ...c, cx: limitar(cx, 0, 1), cy: limitar(cy, 0, 1) };
}

/** Se o ponto (fração da foto) está dentro da caixa. */
export function pontoNaCaixa(c: CaixaRosto, x: number, y: number): boolean {
  return Math.abs(x - c.cx) <= c.w / 2 && Math.abs(y - c.cy) <= c.h / 2;
}
