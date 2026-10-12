import { describe, expect, it } from 'vitest';
import type { Landmark } from '@/lib/angular/pose';
import {
  MULTIPLICADOR_MAX, MULTIPLICADOR_MIN, caixaDoRostoPorLandmarks, caixaRostoPadrao, escalarCaixaRosto, moverCaixaRosto, pontoNaCaixa,
} from '@/lib/social/rosto';

const W = 1200, H = 1600;
const vazio = (): Landmark[] => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
const pt = (x: number, y: number, v = 0.95): Landmark => ({ x: x / W, y: y / H, visibility: v });

/** Perfil olhando para a direita: nariz, olho, orelha e boca visíveis. */
function perfil(): Landmark[] {
  const lm = vazio();
  lm[0] = pt(748, 282); lm[1] = pt(708, 243); lm[2] = pt(700, 243); lm[3] = pt(690, 243);
  lm[7] = pt(625, 278); lm[9] = pt(706, 322);
  return lm;
}

/** De frente: os dois olhos, as duas orelhas, nariz e boca. */
function frente(): Landmark[] {
  const lm = vazio();
  lm[0] = pt(600, 300); lm[1] = pt(580, 270); lm[2] = pt(570, 270); lm[3] = pt(560, 270);
  lm[4] = pt(620, 270); lm[5] = pt(630, 270); lm[6] = pt(640, 270);
  lm[7] = pt(525, 285); lm[8] = pt(675, 285); lm[9] = pt(585, 345); lm[10] = pt(615, 345);
  return lm;
}

const emPx = (c: { cx: number; cy: number; w: number; h: number }) => ({ x0: (c.cx - c.w / 2) * W, x1: (c.cx + c.w / 2) * W, y0: (c.cy - c.h / 2) * H, y1: (c.cy + c.h / 2) * H });

describe('caixa do rosto a partir dos pontos de pose', () => {
  it('de frente, cobre todos os pontos do rosto e a cabeça acima e abaixo deles', () => {
    const c = caixaDoRostoPorLandmarks(frente(), W, H)!;
    const b = emPx(c);
    expect(b.x0).toBeLessThan(525);
    expect(b.x1).toBeGreaterThan(675);
    expect(b.y0).toBeLessThan(270 - 60);
    expect(b.y1).toBeGreaterThan(345);
    expect(c.cx * W).toBeCloseTo(600, -1);
  });

  it('de perfil, cobre a ponta do nariz e a orelha, e recua o centro para o lado oposto ao nariz', () => {
    const c = caixaDoRostoPorLandmarks(perfil(), W, H)!;
    const b = emPx(c);
    expect(b.x1).toBeGreaterThan(748);
    expect(b.x0).toBeLessThan(625);
    expect(b.y0).toBeLessThan(243);
    expect(b.y1).toBeGreaterThan(322);
    expect(c.cx * W).toBeLessThan((625 + 748) / 2);
  });

  it('de perfil olhando para a esquerda o centro recua para a direita', () => {
    const lm = vazio();
    lm[0] = pt(452, 282); lm[1] = pt(492, 243); lm[2] = pt(500, 243); lm[3] = pt(510, 243); lm[7] = pt(575, 278); lm[9] = pt(494, 322);
    const c = caixaDoRostoPorLandmarks(lm, W, H)!;
    expect(c.cx * W).toBeGreaterThan((452 + 575) / 2);
    expect(emPx(c).x0).toBeLessThan(452);
  });

  it('é uma caixa dentro da foto, com tamanho de cabeça (proporção entre 0.6 e 1.2 de largura por altura)', () => {
    for (const lm of [perfil(), frente()]) {
      const c = caixaDoRostoPorLandmarks(lm, W, H)!;
      expect(c.cx).toBeGreaterThan(0);
      expect(c.cx).toBeLessThan(1);
      expect(c.w).toBeGreaterThan(0.05);
      expect(c.h).toBeGreaterThan(0.08);
      const razao = (c.w * W) / (c.h * H);
      expect(razao).toBeGreaterThan(0.6);
      expect(razao).toBeLessThan(1.3);
    }
  });

  it('devolve null sem pontos confiáveis ou com dimensões inválidas', () => {
    expect(caixaDoRostoPorLandmarks(null, W, H)).toBeNull();
    expect(caixaDoRostoPorLandmarks(undefined, W, H)).toBeNull();
    expect(caixaDoRostoPorLandmarks(vazio(), W, H)).toBeNull();
    expect(caixaDoRostoPorLandmarks(perfil(), 0, H)).toBeNull();
    const pouco = vazio();
    pouco[0] = pt(700, 280);
    pouco[7] = pt(625, 278);
    expect(caixaDoRostoPorLandmarks(pouco, W, H)).toBeNull();
  });

  it('ignora pontos com visibilidade baixa', () => {
    const lm = perfil();
    lm[10] = { x: 0.99, y: 0.99, visibility: 0.05 };
    const c = caixaDoRostoPorLandmarks(lm, W, H)!;
    expect(c.cx).toBeLessThan(0.8);
  });

  it('com a cabeça perto da borda a caixa continua com centro dentro da foto', () => {
    const lm = vazio();
    lm[0] = pt(30, 40); lm[1] = pt(20, 20); lm[2] = pt(15, 20); lm[3] = pt(10, 20); lm[7] = pt(5, 30); lm[9] = pt(25, 70);
    const c = caixaDoRostoPorLandmarks(lm, W, H)!;
    expect(c.cx).toBeGreaterThanOrEqual(0);
    expect(c.cy).toBeGreaterThanOrEqual(0);
    expect(c.w).toBeLessThanOrEqual(1);
    expect(c.h).toBeLessThanOrEqual(1);
  });
});

describe('caixa de rosto manual', () => {
  it('a caixa padrão fica no alto e ao centro, dentro da foto', () => {
    const c = caixaRostoPadrao(W, H);
    expect(c.cx).toBe(0.5);
    expect(c.cy).toBeLessThan(0.3);
    expect(c.cx - c.w / 2).toBeGreaterThanOrEqual(0);
    expect(c.cy - c.h / 2).toBeGreaterThanOrEqual(0);
    expect(caixaRostoPadrao(0, 0).w).toBeGreaterThan(0);
  });

  it('os controles de tamanho multiplicam largura e altura dentro dos limites e sem passar da foto', () => {
    const c = { cx: 0.5, cy: 0.2, w: 0.2, h: 0.1 };
    expect(escalarCaixaRosto(c, 1.5, 2)).toEqual({ cx: 0.5, cy: 0.2, w: 0.30000000000000004, h: 0.2 });
    expect(escalarCaixaRosto(c, 100, 100).w).toBeCloseTo(0.2 * MULTIPLICADOR_MAX);
    expect(escalarCaixaRosto(c, 0, 0).h).toBeCloseTo(0.1 * MULTIPLICADOR_MIN);
    expect(escalarCaixaRosto({ ...c, w: 0.9 }, 2, 1).w).toBe(1);
  });

  it('mover mantém o tamanho e prende o centro à foto', () => {
    const c = { cx: 0.5, cy: 0.2, w: 0.2, h: 0.1 };
    expect(moverCaixaRosto(c, 0.7, 0.3)).toEqual({ cx: 0.7, cy: 0.3, w: 0.2, h: 0.1 });
    expect(moverCaixaRosto(c, -3, 9)).toMatchObject({ cx: 0, cy: 1 });
  });

  it('pontoNaCaixa reconhece pontos dentro e fora', () => {
    const c = { cx: 0.5, cy: 0.2, w: 0.2, h: 0.1 };
    expect(pontoNaCaixa(c, 0.55, 0.22)).toBe(true);
    expect(pontoNaCaixa(c, 0.8, 0.2)).toBe(false);
  });
});
