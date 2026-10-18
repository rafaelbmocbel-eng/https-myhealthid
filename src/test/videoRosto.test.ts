import { describe, expect, it } from 'vitest';
import { caixaRostoPadrao, pontoNaCaixa, type CaixaRosto } from '../lib/social/rosto';
import {
  caixaDoRostoEm, caixaDoRostoNoQuadro, caixasDoRosto, landmarksDoRosto, resumoDoRosto, semPontosDoRosto, unirCaixas,
} from '../lib/angular/video/rostoPorQuadro';
import { configurar, poseSintetica, trilhaSintetica } from '../lib/angular/video/detectorFalso';
import { criarTrilha } from '../lib/angular/video/trilha';
import { PONTOS_ROSTO, type TrilhaPose } from '../lib/angular/video/tipos';

/** Todos os pontos do rosto do quadro (em fração do vídeo) cabem na caixa? */
function rostoCabe(trilha: TrilhaPose, i: number, caixa: CaixaRosto): boolean {
  const q = trilha.quadros[i];
  return PONTOS_ROSTO.every((nome) => {
    const p = q.pontos[nome];
    return !p || pontoNaCaixa(caixa, p.x / trilha.largura, p.y / trilha.altura);
  });
}

describe('caixa do rosto por quadro', () => {
  it('cobre nariz, olhos, orelhas e boca em todos os quadros, em cada gesto e nos dois sentidos', () => {
    for (const gesto of ['marcha', 'corrida', 'agachamento', 'salto', 'ombro'] as const) {
      for (const direcao of [1, -1] as const) {
        const trilha = trilhaSintetica(configurar(gesto, { direcao }), 30, 4);
        const caixas = caixasDoRosto(trilha);
        expect(caixas).toHaveLength(trilha.quadros.length);
        caixas.forEach((c, i) => {
          expect(c.origem, `${gesto} ${direcao} #${i}`).toBe('pose');
          expect(rostoCabe(trilha, i, c.caixa), `${gesto} ${direcao} #${i}`).toBe(true);
        });
      }
    }
  });

  it('a caixa fica sobre a cabeça: acima dos ombros e perto da horizontal do nariz', () => {
    const cfg = configurar('marcha');
    const trilha = trilhaSintetica(cfg, 30, 2);
    const c = caixasDoRosto(trilha)[10].caixa;
    const q = trilha.quadros[10];
    expect(c.cy).toBeLessThan(q.pontos.ombro_d.y / trilha.altura);
    expect(Math.abs(c.cx - q.pontos.nariz.x / trilha.largura)).toBeLessThan(0.1);
    expect(c.w).toBeGreaterThan(0.03);
    expect(c.h).toBeGreaterThan(0.05);
    expect(c.w).toBeLessThan(0.5);
  });

  it('erra para maior: a caixa de um quadro contém a caixa bruta dos quadros vizinhos (movimento entre amostras) e cresce com a margem', () => {
    const trilha = trilhaSintetica(configurar('corrida'), 30, 3);
    const sem = caixasDoRosto(trilha, { folgaTemporalS: 0, margem: 1 });
    const com = caixasDoRosto(trilha, { folgaTemporalS: 0.1, margem: 1.15 });
    com.forEach((c, i) => {
      const a = sem[i].caixa;
      expect(c.caixa.w).toBeGreaterThanOrEqual(a.w - 1e-12);
      expect(c.caixa.h).toBeGreaterThanOrEqual(a.h - 1e-12);
      expect(c.caixa.cx - c.caixa.w / 2).toBeLessThanOrEqual(a.cx - a.w / 2 + 1e-12);
      expect(c.caixa.cx + c.caixa.w / 2).toBeGreaterThanOrEqual(a.cx + a.w / 2 - 1e-12);
    });
    // a caixa do quadro 10 cobre o rosto dos quadros 8 a 12
    for (let j = 8; j <= 12; j++) expect(rostoCabe(trilha, j, com[10].caixa)).toBe(true);
  });

  it('quadro sem rosto só é dado como coberto pelos vizinhos quando há rosto detectado dos DOIS lados; com um lado só vira caixa fixa (a conferir)', () => {
    const trilha = trilhaSintetica(configurar('marcha'), 30, 4, { ausentes: (t) => t >= 1 && t < 2.2 });
    const caixas = caixasDoRosto(trilha);
    // sem rosto de 1,0 s (quadro 30) a 2,17 s (quadro 65): a lacuna de 36 quadros é maior que 2 × 15, então nenhum quadro tem os dois lados
    expect(caixas[29].origem).toBe('pose');
    for (let i = 30; i <= 65; i++) expect(caixas[i].origem, `quadro ${i}`).toBe('fixa');
    expect(caixas[66].origem).toBe('pose');
    const padrao = caixaRostoPadrao(trilha.largura, trilha.altura);
    const meio = caixas[47];
    expect(meio.caixa.cx).toBeCloseTo(padrao.cx, 6);
    expect(meio.caixa.w).toBeGreaterThanOrEqual(padrao.w);
    expect(meio.caixa.h).toBeGreaterThanOrEqual(padrao.h);
    // o quadro logo depois da perda ainda cobre onde o rosto estava, além da caixa fixa
    const sem = trilhaSintetica(configurar('marcha'), 30, 4);
    expect(rostoCabe(sem, 31, caixas[31].caixa)).toBe(true);
    expect(rostoCabe(sem, 64, caixas[64].caixa)).toBe(true);
  });

  it('lacuna curta com rosto dos dois lados: a união das duas caixas cobre o trajeto e o quadro vale como coberto', () => {
    const sintetica = trilhaSintetica(configurar('marcha'), 30, 4);
    const trilha = trilhaSintetica(configurar('marcha'), 30, 4, { ausentes: (t) => t >= 1 && t < 1.4 });
    const caixas = caixasDoRosto(trilha);
    for (let i = 30; i <= 41; i++) {
      expect(caixas[i].origem, `quadro ${i}`).toBe('vizinho');
      expect(rostoCabe(sintetica, i, caixas[i].caixa), `quadro ${i}`).toBe(true);
    }
  });

  it('paciente cruzando o quadro com câmera parada e o detector perdendo-o por 0,8 s: nenhum quadro com o rosto fora da caixa fica sem o aviso de conferir', () => {
    for (const gesto of ['marcha', 'corrida'] as const) {
      const inteira = trilhaSintetica(configurar(gesto), 30, 5);
      const trilha = trilhaSintetica(configurar(gesto), 30, 5, { ausentes: (t) => t >= 2 && t < 2.8 });
      const caixas = caixasDoRosto(trilha);
      let comAviso = 0;
      caixas.forEach((c, i) => {
        if (c.origem === 'fixa') comAviso++;
        else expect(rostoCabe(inteira, i, c.caixa), `${gesto} #${i} (${c.origem})`).toBe(true);
      });
      expect(comAviso, gesto).toBeGreaterThan(0);
      expect(resumoDoRosto(caixas).fixa, gesto).toBeGreaterThan(0);
    }
  });

  it('o começo do vídeo sem rosto detectado (só há vizinho depois) também é sinalizado', () => {
    const trilha = trilhaSintetica(configurar('marcha'), 30, 3, { ausentes: (t) => t < 0.5 });
    const caixas = caixasDoRosto(trilha);
    for (let i = 0; i < 15; i++) expect(caixas[i].origem, `quadro ${i}`).toBe('fixa');
  });

  it('a caixa fixa pode ser a que o profissional arrastou até o rosto', () => {
    const trilha = trilhaSintetica(configurar('marcha'), 30, 2, { ausentes: () => true });
    const minha: CaixaRosto = { cx: 0.3, cy: 0.2, w: 0.1, h: 0.12 };
    const caixas = caixasDoRosto(trilha, { caixaFixa: minha, margem: 1 });
    expect(caixas.every((c) => c.origem === 'fixa')).toBe(true);
    for (const k of ['cx', 'cy', 'w', 'h'] as const) expect(caixas[5].caixa[k]).toBeCloseTo(minha[k], 9);
  });

  it('um vídeo sem nenhum rosto detectado fica inteiro coberto pela caixa fixa', () => {
    const trilha = trilhaSintetica(configurar('marcha'), 30, 2, { ausentes: () => true });
    const r = resumoDoRosto(caixasDoRosto(trilha));
    expect(r).toEqual({ pose: 0, vizinho: 0, fixa: 100 });
  });

  it('o resumo soma 100% e mostra quanto veio da pose', () => {
    const trilha = trilhaSintetica(configurar('marcha'), 30, 4, { ausentes: (t) => t >= 1 && t < 2.2 });
    const r = resumoDoRosto(caixasDoRosto(trilha));
    expect(r.pose + r.vizinho + r.fixa).toBeCloseTo(100, 9);
    expect(r.pose).toBeGreaterThan(50);
    expect(r.fixa).toBeGreaterThan(0);
    expect(resumoDoRosto([])).toEqual({ pose: 0, vizinho: 0, fixa: 0 });
  });

  it('o rosto continua coberto quando a cabeça se mexe de verdade (ruído e movimento)', () => {
    const trilha = trilhaSintetica(configurar('ombro'), 15, 9, { ruidoPx: 2, semente: 4 });
    const caixas = caixasDoRosto(trilha);
    caixas.forEach((c, i) => expect(rostoCabe(trilha, i, c.caixa), `quadro ${i}`).toBe(true));
  });

  it('caixaDoRostoEm usa a união dos dois quadros que cercam o instante', () => {
    const trilha = trilhaSintetica(configurar('corrida'), 30, 2);
    const caixas = caixasDoRosto(trilha);
    const a = caixaDoRostoEm(trilha, caixas, trilha.quadros[10].t);
    expect(a).toBe(caixas[10]);
    const entre = caixaDoRostoEm(trilha, caixas, (trilha.quadros[10].t + trilha.quadros[11].t) / 2);
    for (const j of [10, 11]) {
      expect(entre.caixa.cx - entre.caixa.w / 2).toBeLessThanOrEqual(caixas[j].caixa.cx - caixas[j].caixa.w / 2 + 1e-12);
      expect(entre.caixa.cx + entre.caixa.w / 2).toBeGreaterThanOrEqual(caixas[j].caixa.cx + caixas[j].caixa.w / 2 - 1e-12);
    }
    expect(caixaDoRostoEm(trilha, caixas, -3)).toBe(caixas[0]);
    expect(caixaDoRostoEm(trilha, caixas, 99)).toBe(caixas[caixas.length - 1]);
  });

  it('sem quadros a caixa é a fixa', () => {
    const vazia = criarTrilha(30, 640, 480);
    expect(caixasDoRosto(vazia)).toEqual([]);
    const c = caixaDoRostoEm(vazia, [], 0);
    expect(c.origem).toBe('fixa');
    expect(c.caixa).toEqual(caixaRostoPadrao(640, 480));
  });

  it('caixaDoRostoNoQuadro dá a mesma cobertura que a trilha toda no miolo do vídeo', () => {
    const trilha = trilhaSintetica(configurar('marcha'), 30, 8);
    const todas = caixasDoRosto(trilha);
    const um = caixaDoRostoNoQuadro(trilha, 120);
    expect(um.origem).toBe('pose');
    expect(um.caixa.cx).toBeCloseTo(todas[120].caixa.cx, 9);
    expect(um.caixa.w).toBeCloseTo(todas[120].caixa.w, 9);
    expect(caixaDoRostoNoQuadro(criarTrilha(30, 640, 480), 3).origem).toBe('fixa');
  });

  it('unirCaixas e landmarksDoRosto', () => {
    expect(unirCaixas([])).toBeNull();
    const u = unirCaixas([{ cx: 0.2, cy: 0.2, w: 0.1, h: 0.1 }, { cx: 0.4, cy: 0.3, w: 0.1, h: 0.2 }])!;
    expect(u.cx).toBeCloseTo(0.3, 9);
    expect(u.w).toBeCloseTo(0.3, 9);
    expect(u.cy).toBeCloseTo(0.275, 9);
    expect(u.h).toBeCloseTo(0.25, 9);
    const trilha = trilhaSintetica(configurar('marcha'), 30, 1);
    const lm = landmarksDoRosto(trilha, 0);
    expect(lm).toHaveLength(33);
    expect(lm[0].visibility).toBeGreaterThan(0.5);
    expect(lm[0].x).toBeCloseTo(poseSintetica(configurar('marcha'), 0).landmarks[0].x, 6);
    expect(lm[27].visibility).toBe(0); // fora do rosto
    expect(landmarksDoRosto(trilha, 999).every((l) => l.visibility === 0)).toBe(true);
  });
});

describe('semPontosDoRosto', () => {
  it('tira nariz, olhos, orelhas e boca e mantém o resto do corpo e os demais campos do quadro', () => {
    const trilha = trilhaSintetica(configurar('marcha'), 30, 1);
    const q = trilha.quadros[0];
    expect(PONTOS_ROSTO.some((n) => q.pontos[n])).toBe(true);
    const limpo = semPontosDoRosto(q);
    expect(PONTOS_ROSTO.some((n) => limpo.pontos[n])).toBe(false);
    expect(limpo.pontos.joelho_d).toEqual(q.pontos.joelho_d);
    expect(limpo.t).toBe(q.t);
    expect(limpo.i).toBe(q.i);
    expect(q.pontos.nariz).toBeDefined();
  });

  it('devolve o próprio quadro quando não há ponto do rosto', () => {
    const q = { i: 0, t: 0, pontos: { joelho_d: { x: 1, y: 2 } } };
    expect(semPontosDoRosto(q)).toBe(q);
  });
});

