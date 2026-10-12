import { describe, expect, it } from 'vitest';
import { pontosDoPrumo } from '../lib/angular/pose';
import { alcaDoPrumo, apoioPelaAlca } from '../lib/angular/analise';
import { girar } from '../lib/angular/medidas';

const lm = (over: Record<number, [number, number, number?]>) => {
  const a = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  for (const [i, [x, y, v]] of Object.entries(over)) a[Number(i)] = { x, y, visibility: v ?? 0.9 };
  return a;
};

describe('sugestão dos pontos do fio de prumo', () => {
  // lado esquerdo do paciente visível, olhando para a direita da imagem (nariz à frente da orelha)
  const perfil = lm({ 0: [0.65, 0.17], 7: [0.55, 0.17], 11: [0.53, 0.29], 23: [0.5, 0.56], 25: [0.52, 0.81], 27: [0.5, 0.92], 8: [0.55, 0.17, 0.1], 12: [0.53, 0.29, 0.1], 24: [0.5, 0.56, 0.1], 26: [0.52, 0.81, 0.1], 28: [0.5, 0.92, 0.1] });

  it('de perfil: apoio no tornozelo e orelha, ombro, quadril e joelho do lado mais visível', () => {
    const s = pontosDoPrumo(perfil, 'perfil', 1000, 2000)!;
    expect(s.medidaId).toBe('prumo-perfil');
    expect(s.pontos).toEqual([{ x: 500, y: 1840 }, { x: 550, y: 340 }, { x: 530, y: 580 }, { x: 500, y: 1120 }, { x: 520, y: 1620 }]);
    expect(s.olhaPara).toBe('direita');
  });

  it('o lado para onde o paciente olha vem do nariz em relação à orelha', () => {
    const esquerda = lm({ 0: [0.4, 0.17], 7: [0.55, 0.17], 11: [0.53, 0.29], 23: [0.5, 0.56], 25: [0.52, 0.81], 27: [0.5, 0.92] });
    expect(pontosDoPrumo(esquerda, 'perfil', 1000, 2000)!.olhaPara).toBe('esquerda');
    const semNariz = lm({ 7: [0.55, 0.17], 11: [0.53, 0.29], 23: [0.5, 0.56], 25: [0.52, 0.81], 27: [0.5, 0.92] });
    expect(pontosDoPrumo(semNariz, 'perfil', 1000, 2000)!.olhaPara).toBeUndefined();
  });

  it('de frente e de costas: apoio entre os tornozelos e pontos médios da cabeça, dos ombros e da pelve', () => {
    const f = lm({ 27: [0.45, 0.95], 28: [0.55, 0.95], 7: [0.56, 0.1], 8: [0.44, 0.1], 11: [0.6, 0.25], 12: [0.4, 0.25], 23: [0.55, 0.55], 24: [0.45, 0.55] });
    for (const vista of ['frente', 'costas'] as const) {
      const s = pontosDoPrumo(f, vista, 1000, 2000)!;
      expect(s.medidaId).toBe('prumo-frente');
      expect(s.pontos).toEqual([{ x: 500, y: 1900 }, { x: 500, y: 200 }, { x: 500, y: 500 }, { x: 500, y: 1100 }]);
      expect(s.olhaPara).toBeUndefined();
    }
  });

  it('ponto pouco visível ou ausente: não sugere nada', () => {
    expect(pontosDoPrumo(lm({ 7: [0.55, 0.17], 11: [0.53, 0.29], 23: [0.5, 0.56], 25: [0.52, 0.81] }), 'perfil', 1000, 2000)).toBeNull();
    expect(pontosDoPrumo(lm({ 27: [0.45, 0.95], 28: [0.55, 0.95] }), 'frente', 1000, 2000)).toBeNull();
  });
});

describe('alça do fio de prumo', () => {
  it('fica no topo do fio, na mesma vertical do apoio', () => {
    const a = alcaDoPrumo({ x: 400, y: 1300 }, 1400, null);
    expect(a.x).toBeCloseTo(400, 6);
    expect(a.y).toBeCloseTo(70, 6);
  });

  it('com a foto girada, a alça acompanha o fio inclinado', () => {
    const apoio = { x: 400, y: 1300 };
    const alca = alcaDoPrumo(apoio, 1400, 4);
    const v = { x: apoio.x - alca.x, y: apoio.y - alca.y };
    const ang = (Math.atan2(v.x, v.y) * 180) / Math.PI;
    expect(Math.abs(ang)).toBeCloseTo(4, 4);
    expect(alca.y).toBeCloseTo(70, 4);
  });

  it('arrastar a alça move o apoio na horizontal e mantém a altura', () => {
    const apoio = { x: 400, y: 1300 };
    const novo = apoioPelaAlca({ x: 460, y: 70 }, apoio, null, 900);
    expect(novo).toEqual({ x: 460, y: 1300 });
    expect(apoioPelaAlca({ x: 5000, y: 70 }, apoio, null, 900).x).toBe(900);
    expect(apoioPelaAlca({ x: -30, y: 70 }, apoio, null, 900).x).toBe(0);
  });

  it('com giro, o fio passa pelo ponto arrastado e o apoio mantém a altura', () => {
    const apoio = { x: 400, y: 1300 };
    const alca = alcaDoPrumo(apoio, 1400, 4);
    const movida = { x: alca.x + 50, y: alca.y };
    const novo = apoioPelaAlca(movida, apoio, 4, 2000);
    expect(novo.y).toBe(1300);
    // a alça recalculada a partir do novo apoio cai de volta sobre o ponto arrastado
    const volta = alcaDoPrumo(novo, 1400, 4);
    expect(volta.x).toBeCloseTo(movida.x, 4);
    expect(girar({ x: 0, y: 1 }, 0)).toEqual({ x: 0, y: 1 });
  });
});
