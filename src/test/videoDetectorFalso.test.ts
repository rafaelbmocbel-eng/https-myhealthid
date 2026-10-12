import { describe, expect, it } from 'vitest';
import {
  aleatorio, configurar, desenharFigura, detectorFalso, eventosVerdade, landmarksSinteticos, poseSintetica, trilhaSintetica,
} from '../lib/angular/video/detectorFalso';
import { PONTOS_MEDIAPIPE } from '../lib/angular/video/tipos';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('figura sintética: determinística e fisicamente coerente', () => {
  it('mesma configuração e mesmo instante dão exatamente os mesmos pontos', async () => {
    const cfg = configurar('marcha');
    expect(poseSintetica(cfg, 1.234).landmarks).toEqual(poseSintetica(cfg, 1.234).landmarks);
    const det = detectorFalso(cfg, { ruidoPx: 2, semente: 7 });
    const a = await det(null as never, 0.5), b = await det(null as never, 0.5);
    expect(a).toEqual(b);
    expect(await detectorFalso(cfg, { ruidoPx: 2, semente: 8 })(null as never, 0.5)).not.toEqual(a);
  });

  it('devolve os 33 pontos normalizados e visíveis do corpo todo', () => {
    for (const gesto of ['marcha', 'corrida', 'agachamento', 'salto', 'ombro'] as const) {
      const { landmarks } = poseSintetica(configurar(gesto), 1);
      expect(landmarks).toHaveLength(33);
      for (const nome of ['nariz', 'ombro_d', 'ombro_e', 'quadril_d', 'quadril_e', 'joelho_d', 'joelho_e', 'tornozelo_d', 'tornozelo_e', 'calcanhar_d', 'pe_e', 'cotovelo_d', 'punho_e']) {
        const l = landmarks[(PONTOS_MEDIAPIPE as Record<string, number>)[nome]];
        expect(l.visibility, `${gesto} ${nome}`).toBeGreaterThan(0.5);
        expect(l.x, `${gesto} ${nome}`).toBeGreaterThan(0);
        expect(l.x).toBeLessThan(1);
        expect(l.y).toBeGreaterThan(0);
        expect(l.y).toBeLessThan(1);
      }
    }
  });

  it('os segmentos têm comprimento constante (coxa e perna de 0,45 m) na marcha, na corrida e no agachamento', () => {
    for (const gesto of ['marcha', 'corrida', 'agachamento'] as const) {
      const cfg = configurar(gesto);
      for (let t = 0; t < 3; t += 0.137) {
        const m = poseSintetica(cfg, t).mundo;
        for (const s of ['d', 'e']) {
          expect(dist(m[`quadril_${s}`], m[`joelho_${s}`]), `${gesto} coxa ${t}`).toBeCloseTo(0.45, 9);
          expect(dist(m[`joelho_${s}`], m[`tornozelo_${s}`]), `${gesto} perna ${t}`).toBeCloseTo(0.45, 9);
        }
        expect(dist(m.quadril_d, m.ombro_d)).toBeCloseTo(0.52, 9);
      }
    }
  });

  it('corrida: o calcanhar fica no chão e parado durante o contato (pé plantado) e sobe no balanço', () => {
    const cfg = configurar('corrida');
    const T = cfg.tempoPassada, tc = cfg.tempoContato.D;
    const x0 = poseSintetica(cfg, T * 2 + 0.02).mundo.calcanhar_d;
    for (let u = 0.02; u < tc - 0.02; u += 0.02) {
      const h = poseSintetica(cfg, T * 2 + u).mundo.calcanhar_d;
      expect(h.y, `u=${u}`).toBeCloseTo(0, 9);
      expect(h.x, `u=${u}`).toBeCloseTo(x0.x, 9);
    }
    const noAr = poseSintetica(cfg, T * 2 + tc + (T - tc) / 2).mundo.calcanhar_d;
    expect(noAr.y).toBeGreaterThan(0.3);
    // um passo (D até E) tem metade da passada: v × T ÷ 2
    const a = poseSintetica(cfg, 2 * T + 0.1).mundo.calcanhar_d.x;
    const b = poseSintetica(cfg, 2 * T + T / 2 + 0.1).mundo.calcanhar_e.x;
    expect(b - a).toBeCloseTo((cfg.velocidade * T) / 2, 9);
  });

  it('corrida: há momentos de voo sem nenhum pé no chão e eles somam T/2 − tempo de contato', () => {
    const cfg = configurar('corrida');
    let semApoio = 0;
    const passo = 0.001;
    const T = cfg.tempoPassada;
    for (let t = 2 * T; t < 3 * T; t += passo) {
      const m = poseSintetica(cfg, t).mundo;
      if (m.calcanhar_d.y > 1e-6 && m.calcanhar_e.y > 1e-6) semApoio += passo;
    }
    expect(semApoio).toBeCloseTo(2 * (T / 2 - cfg.tempoContato.D), 1);
  });

  it('agachamento: o pé não sai do lugar e a coxa desce até o ângulo configurado', () => {
    const cfg = configurar('agachamento');
    for (let t = 0; t < 6; t += 0.3) {
      const m = poseSintetica(cfg, t).mundo;
      expect(m.tornozelo_d.x).toBeCloseTo(0, 9);
      expect(m.tornozelo_d.y).toBeCloseTo(0.08, 9);
      expect(m.calcanhar_d.y).toBeCloseTo(0, 9);
    }
    expect(poseSintetica(cfg, cfg.periodo / 2).verdade.joelho_d).toBeCloseTo(cfg.flexaoMax, 9);
    expect(poseSintetica(cfg, 0).verdade.joelho_d).toBeCloseTo(0, 9);
  });

  it('salto: antes da decolagem os pés estão no chão, no ar sobem e depois do contato voltam', () => {
    const cfg = configurar('salto');
    expect(poseSintetica(cfg, 0.2).mundo.tornozelo_d.y).toBeCloseTo(0.08, 9);
    const apice = poseSintetica(cfg, cfg.inicioSalto + cfg.voo / 2).mundo.tornozelo_d.y;
    expect(apice).toBeCloseTo(0.08 + (9.81 / 8) * cfg.voo ** 2, 6);
    expect(poseSintetica(cfg, cfg.inicioSalto + cfg.voo + 0.6).mundo.tornozelo_d.y).toBeCloseTo(0.08, 9);
    expect(poseSintetica(cfg, 0.2).verdade.valgo_d).toBeCloseTo(0, 9);
    expect(poseSintetica(cfg, cfg.inicioSalto + cfg.voo + 0.25).verdade.valgo_d).toBeGreaterThan(5);
  });

  it('espelhar (direcao = −1) reflete a imagem na horizontal e não muda os ângulos conhecidos de gestos laterais', () => {
    for (const gesto of ['marcha', 'corrida', 'agachamento'] as const) {
      const a = poseSintetica(configurar(gesto, { direcao: 1 }), 0.9), b = poseSintetica(configurar(gesto, { direcao: -1 }), 0.9);
      a.landmarks.forEach((l, i) => {
        expect(b.landmarks[i].x).toBeCloseTo(1 - l.x, 9);
        expect(b.landmarks[i].y).toBeCloseTo(l.y, 9);
      });
      expect(b.verdade).toEqual(a.verdade);
    }
  });

  it('o lado mais próximo da câmera tem visibilidade maior nas pernas', () => {
    const d = poseSintetica(configurar('marcha', { direcao: 1 }), 1).landmarks, e = poseSintetica(configurar('marcha', { direcao: -1 }), 1).landmarks;
    expect(d[PONTOS_MEDIAPIPE.joelho_d].visibility).toBeGreaterThan(d[PONTOS_MEDIAPIPE.joelho_e].visibility as number);
    expect(e[PONTOS_MEDIAPIPE.joelho_e].visibility).toBeGreaterThan(e[PONTOS_MEDIAPIPE.joelho_d].visibility as number);
  });

  it('câmera fixa: o paciente atravessa o quadro na velocidade configurada; câmera que acompanha: fica no centro', () => {
    const fixa = configurar('marcha', { cameraFixa: true, largura: 3000, velocidade: 1.2 });
    const x = (t: number) => poseSintetica(fixa, t).landmarks[PONTOS_MEDIAPIPE.quadril_d].x * fixa.largura;
    const pxPorM = fixa.altura / fixa.metrosNaAltura;
    expect((x(3) - x(1)) / pxPorM / 2).toBeCloseTo(1.2, 6);
    const segue = configurar('marcha');
    expect(poseSintetica(segue, 0).landmarks[PONTOS_MEDIAPIPE.quadril_d].x).toBeCloseTo(poseSintetica(segue, 5).landmarks[PONTOS_MEDIAPIPE.quadril_d].x, 9);
  });
});

describe('ruído, ausências e trilha direta', () => {
  it('o ruído é de média zero e do tamanho pedido', () => {
    const cfg = configurar('marcha', { largura: 1000, altura: 1000 });
    const limpo = poseSintetica(cfg, 1).landmarks;
    const erros: number[] = [];
    for (let k = 0; k < 400; k++) {
      const r = landmarksSinteticos(cfg, 1 + k * 0.001, { ruidoPx: 2, semente: 3 }) as typeof limpo;
      const ref = poseSintetica(cfg, 1 + k * 0.001).landmarks;
      erros.push((r[26].x - ref[26].x) * 1000);
    }
    const media = erros.reduce((s, v) => s + v, 0) / erros.length;
    const dp = Math.sqrt(erros.reduce((s, v) => s + (v - media) ** 2, 0) / erros.length);
    expect(Math.abs(media)).toBeLessThan(0.4);
    expect(dp).toBeGreaterThan(1.4);
    expect(dp).toBeLessThan(2.6);
    expect(landmarksSinteticos(cfg, 1, {})).toEqual(limpo);
  });

  it('ausentes: true devolve null; uma lista zera a visibilidade só desses pontos', () => {
    const cfg = configurar('marcha');
    expect(landmarksSinteticos(cfg, 1, { ausentes: () => true })).toBeNull();
    const parcial = landmarksSinteticos(cfg, 1, { ausentes: () => [27, 28] }) as ReturnType<typeof poseSintetica>['landmarks'];
    expect(parcial[27].visibility).toBe(0);
    expect(parcial[28].visibility).toBe(0);
    expect(parcial[26].visibility).toBeGreaterThan(0.5);
  });

  it('trilhaSintetica monta a trilha em pixels no tempo certo', () => {
    const cfg = configurar('marcha', { largura: 800, altura: 600 });
    const t = trilhaSintetica(cfg, 20, 2, { inicio: 3 });
    expect(t.quadros).toHaveLength(40);
    expect(t.quadros[0].t).toBe(3);
    expect(t.quadros[39].t).toBeCloseTo(4.95, 9);
    expect(t.largura).toBe(800);
    const ref = poseSintetica(cfg, 3.5).landmarks[PONTOS_MEDIAPIPE.joelho_d];
    expect(t.quadros[10].pontos.joelho_d.x).toBeCloseTo(ref.x * 800, 6);
    expect(t.quadros[10].pontos.joelho_d.y).toBeCloseTo(ref.y * 600, 6);
  });

  it('o gerador aleatório é determinístico e uniforme', () => {
    const a = aleatorio(42), b = aleatorio(42);
    const va = Array.from({ length: 5 }, () => a()), vb = Array.from({ length: 5 }, () => b());
    expect(va).toEqual(vb);
    const r = aleatorio(1);
    const amostra = Array.from({ length: 2000 }, () => r());
    expect(amostra.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(amostra.reduce((s, x) => s + x, 0) / amostra.length).toBeCloseTo(0.5, 1);
  });

  it('eventosVerdade da corrida: contatos a cada passada, o pé E meia passada depois, saída após o tempo de contato', () => {
    const cfg = configurar('corrida', { tempoContato: { D: 0.2, E: 0.25 } });
    const v = eventosVerdade(cfg, 3);
    expect(v.contato.D.slice(0, 3)).toEqual([0, 0.7, 1.4].map((x) => expect.closeTo(x, 9)));
    expect(v.contato.E.slice(0, 2)).toEqual([0.35, 1.05].map((x) => expect.closeTo(x, 9)));
    expect(v.saida.D[0]).toBeCloseTo(0.2, 9);
    expect(v.saida.E[0]).toBeCloseTo(0.6, 9);
  });
});

describe('desenharFigura', () => {
  it('desenha o fundo, os segmentos e as articulações com um contexto de canvas', () => {
    const chamadas: string[] = [];
    const ctx = new Proxy({}, {
      get: (_t, nome: string) => (...args: unknown[]) => { chamadas.push(`${nome}`); return args; },
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    desenharFigura(ctx, poseSintetica(configurar('marcha'), 1).landmarks, 640, 480);
    expect(chamadas.filter((c) => c === 'fillRect').length).toBe(2);
    expect(chamadas.filter((c) => c === 'stroke').length).toBeGreaterThan(10);
    expect(chamadas.filter((c) => c === 'arc').length).toBeGreaterThan(10);
  });
});
