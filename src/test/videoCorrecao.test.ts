import { describe, expect, it } from 'vitest';
import {
  corrigirPonto, limparCorrecoes, nomesCorrigidos, pontosCorrigidosNoQuadro, quadrosCorrigidos, removerCorrecao, removerCorrecoesDoPonto, resumoCorrecoes,
} from '../lib/angular/video/correcao';
import { anguloJoelho, angulosPorQuadro } from '../lib/angular/video/angulos';
import { criarHistorico, desfazer, refazer, registrar } from '../lib/angular/video/historico';
import { criarTrilha, pontoDoQuadro } from '../lib/angular/video/trilha';
import type { TrilhaPose } from '../lib/angular/video/tipos';

const congelar = <T,>(o: T): T => {
  Object.freeze(o);
  for (const v of Object.values(o as object)) if (v && typeof v === 'object' && !Object.isFrozen(v)) congelar(v);
  return o;
};

/** 31 quadros a 30 quadros/s; o joelho anda 2 px por quadro em x e fica em y = 200. */
const linha = (n = 31): TrilhaPose => criarTrilha(30, 1000, 500, Array.from({ length: n }, (_, i) => ({
  i, t: i / 30, pontos: { joelho_d: { x: 100 + 2 * i, y: 200, conf: 0.9 }, nariz: { x: 10, y: 10, conf: 0.9 } },
})));

describe('corrigirPonto: quadro-chave no estilo stop-motion', () => {
  it('o ponto corrigido fica preso onde foi deixado, vira quadro-chave e guarda a detecção original', () => {
    const t = congelar(linha());
    const c = corrigirPonto(t, 10, 'joelho_d', { x: 300, y: 250 });
    expect(c.quadros[10].pontos.joelho_d).toEqual({ x: 300, y: 250, conf: 1, manual: true, auto: { x: 120, y: 200, conf: 0.9 } });
    expect(t.quadros[10].pontos.joelho_d).toEqual({ x: 120, y: 200, conf: 0.9 });
  });

  it('nunca altera a trilha recebida e reaproveita os quadros que não mudaram', () => {
    const t = congelar(linha());
    const c = corrigirPonto(t, 15, 'joelho_d', { x: 400, y: 200 });
    expect(c).not.toBe(t);
    expect(c.quadros).not.toBe(t.quadros);
    expect(c.quadros[15]).not.toBe(t.quadros[15]);
    for (const i of [0, 3, 14, 16, 27]) expect(c.quadros[i]).toBe(t.quadros[i]);
    // com o ajuste das vizinhas ligado, só a janela é refeita; o resto segue compartilhado
    const aj = corrigirPonto(t, 15, 'joelho_d', { x: 400, y: 200 }, { janelaAjusteS: 0.25 });
    expect(aj.quadros[14]).not.toBe(t.quadros[14]);
    expect(aj.quadros[0]).toBe(t.quadros[0]);
    expect(aj.quadros[27]).toBe(t.quadros[27]);
  });

  it('por padrão corrigir um quadro não mexe nos vizinhos (um erro isolado do detector não pode estragar quadros que estavam certos)', () => {
    const t = linha();
    const c = corrigirPonto(t, 15, 'joelho_d', { x: 130 + 80, y: 260 });
    for (let i = 0; i < 31; i++) if (i !== 15) expect(c.quadros[i]).toBe(t.quadros[i]);
  });

  it('com o ajuste ligado, o desvio corrigido se espalha pelas vizinhas e some linearmente', () => {
    const t = linha();
    const c = corrigirPonto(t, 15, 'joelho_d', { x: 130 + 10, y: 200 }, { janelaAjusteS: 0.25 }); // automático: 130; desvio de +10 px
    const dx = (i: number) => c.quadros[i].pontos.joelho_d.x - t.quadros[i].pontos.joelho_d.x;
    expect(dx(15)).toBeCloseTo(10, 9);
    // janela: round(0,25 s × 30) = 8 quadros; peso = 1 − d/9
    expect(dx(14)).toBeCloseTo(10 * (1 - 1 / 9), 9);
    expect(dx(16)).toBeCloseTo(10 * (1 - 1 / 9), 9);
    expect(dx(8)).toBeCloseTo(10 * (1 - 7 / 9), 9);
    expect(dx(7)).toBeCloseTo(10 * (1 - 8 / 9), 9);
    expect(dx(6)).toBe(0);
    expect(c.quadros[6]).toBe(t.quadros[6]);
    expect(dx(23)).toBeCloseTo(10 * (1 - 8 / 9), 9);
    expect(dx(24)).toBe(0);
    expect(c.quadros[14].pontos.joelho_d.interp).toBe(true);
    expect(c.quadros[14].pontos.joelho_d.manual).toBeUndefined();
    expect(c.quadros[14].pontos.joelho_d.auto).toEqual({ x: 128, y: 200, conf: 0.9 });
    // a forma da detecção automática é mantida: continua andando 2 px por quadro, mais o desvio
    expect(c.quadros[12].pontos.joelho_d.conf).toBe(0.9);
  });

  it('entre dois quadros-chave a posição é interpolada em linha reta', () => {
    const t = linha();
    let c = corrigirPonto(t, 10, 'joelho_d', { x: 100, y: 300 });
    c = corrigirPonto(c, 20, 'joelho_d', { x: 200, y: 100 });
    for (let i = 11; i < 20; i++) {
      const s = (i - 10) / 10;
      const p = c.quadros[i].pontos.joelho_d;
      expect(p.x).toBeCloseTo(100 + 100 * s, 9);
      expect(p.y).toBeCloseTo(300 - 200 * s, 9);
      expect(p.interp).toBe(true);
      expect(p.manual).toBeUndefined();
      expect(p.auto).toEqual({ x: 100 + 2 * i, y: 200, conf: 0.9 });
    }
    // o quadro-chave segue preso
    expect(c.quadros[10].pontos.joelho_d).toMatchObject({ x: 100, y: 300, manual: true });
    expect(c.quadros[20].pontos.joelho_d).toMatchObject({ x: 200, y: 100, manual: true });
  });

  it('ao colocar um novo quadro-chave entre dois, as duas metades são reinterpoladas', () => {
    let c = corrigirPonto(corrigirPonto(linha(), 10, 'joelho_d', { x: 100, y: 300 }), 20, 'joelho_d', { x: 200, y: 100 });
    c = corrigirPonto(c, 15, 'joelho_d', { x: 150, y: 300 });
    expect(c.quadros[12].pontos.joelho_d.y).toBeCloseTo(300, 9);
    expect(c.quadros[12].pontos.joelho_d.x).toBeCloseTo(100 + 50 * (2 / 5), 9);
    expect(c.quadros[17].pontos.joelho_d.y).toBeCloseTo(300 - 200 * (2 / 5), 9);
    expect(c.quadros[17].pontos.joelho_d.x).toBeCloseTo(150 + 50 * (2 / 5), 9);
  });

  it('lacuna entre quadros-chave maior que o limite não apaga a detecção automática do meio', () => {
    const t = linha();
    let c = corrigirPonto(t, 2, 'joelho_d', { x: 70, y: 200 });
    c = corrigirPonto(c, 28, 'joelho_d', { x: 170, y: 200 }, { maxLacunaS: 0.5 });
    expect(c.quadros[15].pontos.joelho_d).toEqual(t.quadros[15].pontos.joelho_d);
    expect(c.quadros[15]).toBe(t.quadros[15]);
    // com o limite padrão (1,5 s = 45 quadros) a mesma dupla é interpolada
    let d = corrigirPonto(t, 2, 'joelho_d', { x: 70, y: 200 });
    d = corrigirPonto(d, 28, 'joelho_d', { x: 170, y: 200 });
    expect(d.quadros[15].pontos.joelho_d.interp).toBe(true);
    expect(d.quadros[15].pontos.joelho_d.x).toBeCloseTo(70 + (100 * 13) / 26, 9);
  });

  it('preenche quadros em que o detector não achou o ponto, entre dois quadros-chave', () => {
    const t = linha();
    for (let i = 11; i <= 19; i++) delete t.quadros[i].pontos.joelho_d;
    let c = corrigirPonto(t, 10, 'joelho_d', { x: 120, y: 200 });
    c = corrigirPonto(c, 20, 'joelho_d', { x: 140, y: 220 });
    expect(c.quadros[15].pontos.joelho_d).toEqual({ x: 130, y: 210, interp: true });
    // fora da janela de ajuste dos quadros-chave a detecção automática segue intacta
    expect(c.quadros[29]).toBe(t.quadros[29]);
    const r = removerCorrecao(removerCorrecao(c, 10, 'joelho_d'), 20, 'joelho_d');
    expect(r.quadros[15].pontos.joelho_d).toBeUndefined();
    expect(r.quadros[10].pontos.joelho_d).toEqual(t.quadros[10].pontos.joelho_d);
  });

  it('corrige em um quadro sem detecção: o ponto passa a existir só nele', () => {
    const t = linha();
    delete t.quadros[5].pontos.joelho_d;
    const c = corrigirPonto(t, 5, 'joelho_d', { x: 50, y: 60 });
    expect(c.quadros[5].pontos.joelho_d).toEqual({ x: 50, y: 60, conf: 1, manual: true });
    expect(c.quadros[4].pontos.joelho_d).toEqual(t.quadros[4].pontos.joelho_d);
    expect(removerCorrecao(c, 5, 'joelho_d').quadros[5].pontos.joelho_d).toBeUndefined();
  });

  it('mover o mesmo quadro-chave de novo mantém a detecção original; repetir a posição não muda nada', () => {
    const t = linha();
    const a = corrigirPonto(t, 10, 'joelho_d', { x: 300, y: 250 });
    const b = corrigirPonto(a, 10, 'joelho_d', { x: 310, y: 255 });
    expect(b.quadros[10].pontos.joelho_d.auto).toEqual({ x: 120, y: 200, conf: 0.9 });
    expect(b.quadros[10].pontos.joelho_d).toMatchObject({ x: 310, y: 255 });
    expect(corrigirPonto(b, 10, 'joelho_d', { x: 310, y: 255 })).toBe(b);
  });

  it('só o ponto corrigido muda: os outros pontos do quadro continuam os mesmos objetos', () => {
    const t = linha();
    const c = corrigirPonto(t, 10, 'joelho_d', { x: 300, y: 250 });
    expect(c.quadros[10].pontos.nariz).toBe(t.quadros[10].pontos.nariz);
    expect(c.quadros[12].pontos.nariz).toBe(t.quadros[12].pontos.nariz);
  });

  it('entradas inválidas devolvem a mesma trilha; a posição é mantida dentro do vídeo', () => {
    const t = linha();
    expect(corrigirPonto(t, -1, 'joelho_d', { x: 1, y: 1 })).toBe(t);
    expect(corrigirPonto(t, 99, 'joelho_d', { x: 1, y: 1 })).toBe(t);
    expect(corrigirPonto(t, 3, '', { x: 1, y: 1 })).toBe(t);
    expect(corrigirPonto(t, 3, 'joelho_d', { x: Number.NaN, y: 1 })).toBe(t);
    const fora = corrigirPonto(t, 3, 'joelho_d', { x: -50, y: 9999 });
    expect(fora.quadros[3].pontos.joelho_d).toMatchObject({ x: 0, y: 500 });
  });
});

describe('modos de interpolação entre quadros-chave: desvio (padrão) e posição', () => {
  /** O joelho oscila em y (30 + 40 sen) para a detecção automática ter uma forma que a reta não reproduz. */
  const onda = (): TrilhaPose => criarTrilha(30, 1000, 500, Array.from({ length: 41 }, (_, i) => ({
    i, t: i / 30, pontos: { joelho_d: { x: 100 + 2 * i, y: 200 + 60 * Math.sin(i / 4), conf: 0.9 } },
  })));

  it('desvio: entre dois quadros-chave a forma da detecção é mantida e só o erro sistemático some', () => {
    const t = onda();
    // a detecção entre os quadros 10 e 20 está 40 px à direita e 30 px acima do certo
    const errada = { ...t, quadros: t.quadros.map((q, i) => (i >= 10 && i <= 20 ? { ...q, pontos: { joelho_d: { ...q.pontos.joelho_d, x: q.pontos.joelho_d.x + 40, y: q.pontos.joelho_d.y - 30 } } } : q)) };
    let c = corrigirPonto(errada, 10, 'joelho_d', { x: t.quadros[10].pontos.joelho_d.x, y: t.quadros[10].pontos.joelho_d.y });
    c = corrigirPonto(c, 20, 'joelho_d', { x: t.quadros[20].pontos.joelho_d.x, y: t.quadros[20].pontos.joelho_d.y });
    for (let i = 10; i <= 20; i++) {
      expect(c.quadros[i].pontos.joelho_d.x, `x ${i}`).toBeCloseTo(t.quadros[i].pontos.joelho_d.x, 9);
      expect(c.quadros[i].pontos.joelho_d.y, `y ${i}`).toBeCloseTo(t.quadros[i].pontos.joelho_d.y, 9);
    }
    expect(c.quadros[15].pontos.joelho_d.interp).toBe(true);
    expect(c.quadros[15].pontos.joelho_d.auto).toEqual(errada.quadros[15].pontos.joelho_d);
  });

  it('desvio: com o mesmo desvio nos dois quadros-chave, todos os quadros do meio levam o mesmo desvio', () => {
    const t = onda();
    let c = corrigirPonto(t, 10, 'joelho_d', { x: t.quadros[10].pontos.joelho_d.x + 30, y: t.quadros[10].pontos.joelho_d.y });
    c = corrigirPonto(c, 20, 'joelho_d', { x: t.quadros[20].pontos.joelho_d.x + 30, y: t.quadros[20].pontos.joelho_d.y });
    for (let i = 10; i <= 20; i++) {
      expect(c.quadros[i].pontos.joelho_d.x - t.quadros[i].pontos.joelho_d.x).toBeCloseTo(30, 9);
      expect(c.quadros[i].pontos.joelho_d.y).toBeCloseTo(t.quadros[i].pontos.joelho_d.y, 9);
    }
  });

  it('desvio: desvios diferentes nos dois quadros-chave variam linearmente entre eles', () => {
    const t = onda();
    let c = corrigirPonto(t, 10, 'joelho_d', { x: t.quadros[10].pontos.joelho_d.x + 10, y: t.quadros[10].pontos.joelho_d.y });
    c = corrigirPonto(c, 20, 'joelho_d', { x: t.quadros[20].pontos.joelho_d.x + 50, y: t.quadros[20].pontos.joelho_d.y });
    expect(c.quadros[15].pontos.joelho_d.x - t.quadros[15].pontos.joelho_d.x).toBeCloseTo(30, 9);
    expect(c.quadros[12].pontos.joelho_d.x - t.quadros[12].pontos.joelho_d.x).toBeCloseTo(10 + 40 * 0.2, 9);
  });

  it('posição: a posição segue uma reta entre os quadros-chave, ignorando a forma da detecção', () => {
    const t = onda();
    let c = corrigirPonto(t, 10, 'joelho_d', { x: 100, y: 100 }, { modo: 'posicao' });
    c = corrigirPonto(c, 20, 'joelho_d', { x: 200, y: 300 }, { modo: 'posicao' });
    for (let i = 11; i < 20; i++) {
      const s = (i - 10) / 10;
      expect(c.quadros[i].pontos.joelho_d.x).toBeCloseTo(100 + 100 * s, 9);
      expect(c.quadros[i].pontos.joelho_d.y).toBeCloseTo(100 + 200 * s, 9);
    }
    // e os dois modos dão resultados diferentes numa detecção que não é reta
    let d = corrigirPonto(t, 10, 'joelho_d', { x: 100, y: 100 });
    d = corrigirPonto(d, 20, 'joelho_d', { x: 200, y: 300 });
    expect(d.quadros[15].pontos.joelho_d.y).not.toBeCloseTo(c.quadros[15].pontos.joelho_d.y, 3);
  });

  it('no modo desvio, onde falta a detecção automática (ou no quadro-chave) a posição é interpolada em reta', () => {
    const t = onda();
    for (let i = 11; i <= 19; i++) delete t.quadros[i].pontos.joelho_d;
    let c = corrigirPonto(t, 10, 'joelho_d', { x: 120, y: 200 });
    c = corrigirPonto(c, 20, 'joelho_d', { x: 140, y: 220 });
    expect(c.quadros[15].pontos.joelho_d).toEqual({ x: 130, y: 210, interp: true });
    // quadro-chave sem detecção original: não há desvio para interpolar
    const u = onda();
    delete u.quadros[20].pontos.joelho_d;
    let d = corrigirPonto(u, 10, 'joelho_d', { x: u.quadros[10].pontos.joelho_d.x, y: u.quadros[10].pontos.joelho_d.y });
    d = corrigirPonto(d, 20, 'joelho_d', { x: 140, y: 220 });
    const meio = d.quadros[15].pontos.joelho_d;
    expect(meio.x).toBeCloseTo(u.quadros[10].pontos.joelho_d.x + (140 - u.quadros[10].pontos.joelho_d.x) * 0.5, 9);
    expect(meio.y).toBeCloseTo(u.quadros[10].pontos.joelho_d.y + (220 - u.quadros[10].pontos.joelho_d.y) * 0.5, 9);
  });

  it('remover os quadros-chave restaura a detecção original em qualquer modo', () => {
    const t = onda();
    for (const modo of ['desvio', 'posicao'] as const) {
      let c = corrigirPonto(t, 10, 'joelho_d', { x: 5, y: 5 }, { modo });
      c = corrigirPonto(c, 20, 'joelho_d', { x: 9, y: 9 }, { modo });
      c = removerCorrecao(c, 10, 'joelho_d', { modo });
      c = removerCorrecao(c, 20, 'joelho_d', { modo });
      expect(c).toEqual(t);
    }
  });
});

describe('detecção perdida (confiança baixa) entre dois quadros-chave', () => {
  /** O joelho some do detector nos quadros 3 a 6 (confiança 0,1): as medidas ignoram esses quadros até o profissional corrigi-los. */
  const perdida = (): TrilhaPose => criarTrilha(10, 640, 480, Array.from({ length: 10 }, (_, i) => ({
    i, t: i / 10, pontos: { joelho_d: { x: 100 + i, y: 100, conf: i >= 3 && i <= 6 ? 0.1 : 0.9 } },
  })));

  it('os quadros entre os dois quadros-chave valem nas medidas, em reta, e não herdam a confiança baixa', () => {
    const t = perdida();
    expect(pontoDoQuadro(t.quadros[4], 'joelho_d')).toBeNull();
    for (const modo of ['desvio', 'posicao'] as const) {
      let c = corrigirPonto(t, 2, 'joelho_d', { x: 200, y: 200 }, { modo });
      c = corrigirPonto(c, 7, 'joelho_d', { x: 300, y: 300 }, { modo });
      for (let i = 3; i <= 6; i++) {
        const p = c.quadros[i].pontos.joelho_d;
        expect(p.interp, `${modo} interp ${i}`).toBe(true);
        expect(p.conf, `${modo} conf ${i}`).toBeUndefined();
        expect(pontoDoQuadro(c.quadros[i], 'joelho_d'), `${modo} usável ${i}`).toEqual({ x: 200 + 20 * (i - 2), y: 200 + 20 * (i - 2) });
        expect(p.auto, `${modo} auto ${i}`).toEqual({ x: 100 + i, y: 100, conf: 0.1 });
      }
    }
  });

  it('a detecção boa continua guiando a forma (modo desvio) e mantém a confiança dela', () => {
    const t = perdida();
    let c = corrigirPonto(t, 1, 'joelho_d', { x: 101 + 10, y: 100 });
    c = corrigirPonto(c, 8, 'joelho_d', { x: 108 + 10, y: 100 });
    expect(c.quadros[2].pontos.joelho_d).toMatchObject({ x: 112, y: 100, conf: 0.9, interp: true });
    // com a detecção perdida no meio, o desvio de 10 px deixa de valer e a posição vai em reta entre os quadros-chave
    expect(c.quadros[4].pontos.joelho_d.x).toBeCloseTo(111 + (118 - 111) * (3 / 7), 9);
    expect(c.quadros[4].pontos.joelho_d.conf).toBeUndefined();
  });

  it('um quadro-chave dado sobre uma detecção perdida não usa o desvio dela: a reta vale também nos quadros bons', () => {
    const t = perdida();
    let c = corrigirPonto(t, 3, 'joelho_d', { x: 50, y: 60 });
    c = corrigirPonto(c, 8, 'joelho_d', { x: 80, y: 90 });
    for (let i = 4; i <= 7; i++) {
      const s = (i - 3) / 5;
      expect(c.quadros[i].pontos.joelho_d.x, `x ${i}`).toBeCloseTo(50 + 30 * s, 9);
      expect(c.quadros[i].pontos.joelho_d.y, `y ${i}`).toBeCloseTo(60 + 30 * s, 9);
    }
  });

  it('remover as correções devolve a detecção perdida exatamente como o detector deu', () => {
    const t = perdida();
    let c = corrigirPonto(t, 2, 'joelho_d', { x: 200, y: 200 });
    c = corrigirPonto(c, 7, 'joelho_d', { x: 300, y: 300 });
    expect(limparCorrecoes(c)).toEqual(t);
    expect(removerCorrecao(removerCorrecao(c, 2, 'joelho_d'), 7, 'joelho_d')).toEqual(t);
  });
});

describe('remover correções', () => {
  it('removerCorrecao restaura exatamente a detecção original e as vizinhas', () => {
    const t = linha();
    const c = corrigirPonto(corrigirPonto(t, 10, 'joelho_d', { x: 300, y: 250 }), 20, 'joelho_d', { x: 50, y: 50 });
    expect(c.quadros[15].pontos.joelho_d.interp).toBe(true);
    const r1 = removerCorrecao(c, 20, 'joelho_d');
    expect(r1.quadros[20].pontos.joelho_d).toEqual(t.quadros[20].pontos.joelho_d);
    expect(r1.quadros[10].pontos.joelho_d.manual).toBe(true);
    // sem o segundo quadro-chave o meio volta à detecção automática
    expect(r1.quadros[15]).toEqual(t.quadros[15]);
    expect(r1.quadros[25]).toEqual(t.quadros[25]);
    const r2 = removerCorrecao(r1, 10, 'joelho_d');
    expect(r2).toEqual(t);
    // com o ajuste das vizinhas ligado, a janela ao redor do único quadro-chave restante segue ajustada
    const aj = corrigirPonto(corrigirPonto(t, 10, 'joelho_d', { x: 300, y: 250 }, { janelaAjusteS: 0.25 }), 20, 'joelho_d', { x: 50, y: 50 }, { janelaAjusteS: 0.25 });
    const so10 = removerCorrecao(aj, 20, 'joelho_d', { janelaAjusteS: 0.25 });
    expect(so10.quadros[12].pontos.joelho_d.interp).toBe(true);
    expect(so10.quadros[25]).toEqual(t.quadros[25]);
    expect(removerCorrecao(so10, 10, 'joelho_d', { janelaAjusteS: 0.25 })).toEqual(t);
  });

  it('remover onde não há correção não faz nada', () => {
    const t = linha();
    expect(removerCorrecao(t, 3, 'joelho_d')).toBe(t);
    expect(removerCorrecao(t, 99, 'joelho_d')).toBe(t);
    expect(removerCorrecoesDoPonto(t, 'joelho_d')).toBe(t);
  });

  it('removerCorrecoesDoPonto e limparCorrecoes devolvem a saída original do detector', () => {
    const t = linha();
    let c = corrigirPonto(t, 5, 'joelho_d', { x: 1, y: 1 });
    c = corrigirPonto(c, 20, 'joelho_d', { x: 2, y: 2 });
    c = corrigirPonto(c, 12, 'nariz', { x: 77, y: 77 });
    expect(nomesCorrigidos(c).sort()).toEqual(['joelho_d', 'nariz']);
    const semJoelho = removerCorrecoesDoPonto(c, 'joelho_d');
    expect(semJoelho.quadros.map((q) => q.pontos.joelho_d)).toEqual(t.quadros.map((q) => q.pontos.joelho_d));
    expect(semJoelho.quadros[12].pontos.nariz.manual).toBe(true);
    expect(limparCorrecoes(c)).toEqual(t);
    expect(limparCorrecoes(t)).toBe(t);
  });
});

describe('marcadores e resumo das correções', () => {
  it('lista os quadros corrigidos (de um ponto ou de qualquer ponto), em ordem, e os pontos de cada quadro', () => {
    let c = corrigirPonto(linha(), 20, 'joelho_d', { x: 1, y: 1 });
    c = corrigirPonto(c, 5, 'joelho_d', { x: 1, y: 1 });
    c = corrigirPonto(c, 12, 'nariz', { x: 1, y: 1 });
    expect(quadrosCorrigidos(c)).toEqual([5, 12, 20]);
    expect(quadrosCorrigidos(c, 'joelho_d')).toEqual([5, 20]);
    expect(quadrosCorrigidos(c, 'nariz')).toEqual([12]);
    expect(pontosCorrigidosNoQuadro(c, 12)).toEqual(['nariz']);
    expect(pontosCorrigidosNoQuadro(c, 13)).toEqual([]);
    expect(pontosCorrigidosNoQuadro(c, 99)).toEqual([]);
    const r = resumoCorrecoes(c);
    expect(r.quadros).toBe(3);
    expect(r.pontos).toBe(3);
    expect(r.pontosAjustados).toBeGreaterThan(0);
  });
});

describe('desfazer e refazer com o histórico', () => {
  it('cada correção é um passo; desfazer volta à trilha anterior sem copiar quadros à toa', () => {
    const t0 = linha();
    let h = criarHistorico(t0);
    h = registrar(h, corrigirPonto(h.presente, 10, 'joelho_d', { x: 5, y: 5 }));
    h = registrar(h, corrigirPonto(h.presente, 20, 'joelho_d', { x: 9, y: 9 }));
    expect(quadrosCorrigidos(h.presente)).toEqual([10, 20]);
    h = desfazer(h);
    expect(quadrosCorrigidos(h.presente)).toEqual([10]);
    h = desfazer(h);
    expect(h.presente).toBe(t0);
    h = refazer(refazer(h));
    expect(quadrosCorrigidos(h.presente)).toEqual([10, 20]);
    // a trilha de 30 quadros distantes continua compartilhando objetos entre os passos
    expect(h.passado[0].quadros[0]).toBe(h.presente.quadros[0]);
  });
});

describe('a correção muda os ângulos medidos', () => {
  it('arrastar o tornozelo num quadro muda a flexão do joelho só ali (e perto, se o ajuste das vizinhas estiver ligado)', () => {
    const t = criarTrilha(30, 1000, 1000, Array.from({ length: 40 }, (_, i) => ({
      i, t: i / 30, pontos: {
        quadril_d: { x: 500, y: 300, conf: 1 }, joelho_d: { x: 500, y: 500, conf: 1 }, tornozelo_d: { x: 500, y: 700, conf: 1 },
      },
    })));
    const def = anguloJoelho('D', false);
    expect(angulosPorQuadro(t, def)[10].graus).toBeCloseTo(0, 6);
    const c = corrigirPonto(t, 10, 'tornozelo_d', { x: 700, y: 500 });
    const a = angulosPorQuadro(c, def);
    expect(a[10].graus).toBeCloseTo(90, 6);
    expect(a[30].graus).toBeCloseTo(0, 6);
    expect(a[9].graus).toBeCloseTo(0, 6);
    // com o ajuste das vizinhas ligado, o quadro 9 acompanha em parte
    const aj = angulosPorQuadro(corrigirPonto(t, 10, 'tornozelo_d', { x: 700, y: 500 }, { janelaAjusteS: 0.25 }), def);
    expect(aj[9].graus as number).toBeGreaterThan(0);
    expect(aj[9].graus as number).toBeLessThan(90);
    // a trilha original continua com a flexão zero
    expect(angulosPorQuadro(t, def)[10].graus).toBeCloseTo(0, 6);
  });
});
