import { describe, expect, it } from 'vitest';
import {
  criarHistorico, desfazer, limparHistorico, podeDesfazer, podeRefazer, refazer, registrar, substituirPresente,
} from '../lib/angular/video/historico';
import {
  criarTrilha, deteccaoPct, duracaoDaTrilha, estimarDirecao, indiceNoTempo, lerTrilha, pontoDoQuadro, pontosDeLandmarks, pontoUsavel,
  serializarTrilha, serieDoPonto, trilhaDeLandmarks,
} from '../lib/angular/video/trilha';
import { PONTOS_MEDIAPIPE, type TrilhaPose } from '../lib/angular/video/tipos';
import { configurar, trilhaSintetica } from '../lib/angular/video/detectorFalso';

const lm = (over: Record<number, [number, number, number?]>) => {
  const a = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  for (const [i, [x, y, v]] of Object.entries(over)) a[Number(i)] = { x, y, visibility: v ?? 0.9 };
  return a;
};

describe('histórico imutável (desfazer e refazer)', () => {
  it('registra, desfaz e refaz sem alterar os estados anteriores', () => {
    let h = criarHistorico('a');
    expect(podeDesfazer(h)).toBe(false);
    expect(podeRefazer(h)).toBe(false);
    const h0 = h;
    h = registrar(h, 'b');
    h = registrar(h, 'c');
    expect(h.presente).toBe('c');
    expect(h.passado).toEqual(['a', 'b']);
    expect(h0.presente).toBe('a');
    expect(h0.passado).toEqual([]);
    h = desfazer(h);
    expect(h.presente).toBe('b');
    expect(h.futuro).toEqual(['c']);
    expect(podeRefazer(h)).toBe(true);
    h = refazer(h);
    expect(h.presente).toBe('c');
    expect(podeRefazer(h)).toBe(false);
  });

  it('um novo registro apaga o "refazer"', () => {
    let h = registrar(registrar(criarHistorico(1), 2), 3);
    h = desfazer(desfazer(h));
    expect(h.presente).toBe(1);
    h = registrar(h, 9);
    expect(h.futuro).toEqual([]);
    expect(h.passado).toEqual([1]);
  });

  it('estado igual (mesma referência) não cria passo; desfazer e refazer vazios devolvem o mesmo histórico', () => {
    const obj = { x: 1 };
    const h = criarHistorico(obj);
    expect(registrar(h, obj)).toBe(h);
    expect(desfazer(h)).toBe(h);
    expect(refazer(h)).toBe(h);
  });

  it('respeita o limite descartando os mais antigos', () => {
    let h = criarHistorico(0, 3);
    for (let i = 1; i <= 6; i++) h = registrar(h, i);
    expect(h.passado).toEqual([3, 4, 5]);
    expect(h.presente).toBe(6);
    expect(criarHistorico(0, 0).limite).toBe(1);
  });

  it('substituirPresente pré-visualiza um arraste sem criar passo; limparHistorico guarda só o atual', () => {
    let h = registrar(criarHistorico('a'), 'b');
    h = substituirPresente(h, 'b2');
    expect(h.presente).toBe('b2');
    expect(h.passado).toEqual(['a']);
    h = registrar(h, 'c');
    expect(h.passado).toEqual(['a', 'b2']);
    const l = limparHistorico(h);
    expect(l.presente).toBe('c');
    expect(l.passado).toEqual([]);
    expect(l.futuro).toEqual([]);
  });
});

describe('trilha de pontos', () => {
  it('converte pontos normalizados em pixels e descarta o que o detector quase não vê', () => {
    const pontos = pontosDeLandmarks(lm({ 27: [0.25, 0.5, 0.9], 28: [0.75, 0.25, 0.05], 0: [Number.NaN, 0.5, 0.9] }), 1000, 2000);
    expect(pontos.tornozelo_e).toEqual({ x: 250, y: 1000, conf: 0.9 });
    expect(pontos.tornozelo_d).toBeUndefined();
    expect(pontos.nariz).toBeUndefined();
    expect(pontosDeLandmarks(null, 10, 10)).toEqual({});
  });

  it('guarda os nomes em português do lado do paciente e deixa as mãos de fora', () => {
    expect(PONTOS_MEDIAPIPE.joelho_d).toBe(26);
    expect(PONTOS_MEDIAPIPE.joelho_e).toBe(25);
    const idx = Object.values(PONTOS_MEDIAPIPE);
    expect(idx.some((i) => i >= 17 && i <= 22)).toBe(false);
    expect(new Set(idx).size).toBe(idx.length);
  });

  it('monta a trilha com índice, tempo e dimensões', () => {
    const t = trilhaDeLandmarks([{ t: 0.5, lm: lm({ 0: [0.5, 0.5] }) }, { t: 0.6, lm: null }], 10, 640, 480);
    expect(t.fps).toBe(10);
    expect(t.quadros.map((q) => q.i)).toEqual([0, 1]);
    expect(t.quadros[1].pontos).toEqual({});
    expect(duracaoDaTrilha(t)).toBeCloseTo(0.1, 9);
    expect(duracaoDaTrilha(criarTrilha(30, 1, 1))).toBe(0);
  });

  it('indiceNoTempo arredonda para o quadro mais próximo e limita às pontas', () => {
    const t = trilhaDeLandmarks(Array.from({ length: 10 }, (_, i) => ({ t: 2 + i / 10, lm: null })), 10, 10, 10);
    expect(indiceNoTempo(t, 2.34)).toBe(3);
    expect(indiceNoTempo(t, 2.36)).toBe(4);
    expect(indiceNoTempo(t, -5)).toBe(0);
    expect(indiceNoTempo(t, 99)).toBe(9);
    expect(indiceNoTempo(t, Number.NaN)).toBe(0);
    expect(indiceNoTempo(criarTrilha(30, 1, 1), 1)).toBe(0);
  });

  it('um ponto corrigido à mão vale sempre; os automáticos precisam de confiança mínima', () => {
    expect(pontoUsavel({ x: 1, y: 1, conf: 0.1 })).toBe(false);
    expect(pontoUsavel({ x: 1, y: 1, conf: 0.1, manual: true })).toBe(true);
    expect(pontoUsavel({ x: 1, y: 1 })).toBe(true);
    expect(pontoUsavel({ x: 1, y: Number.NaN })).toBe(false);
    expect(pontoUsavel(undefined)).toBe(false);
    expect(pontoUsavel({ x: 1, y: 1, conf: 0.5 }, 0.6)).toBe(false);
  });

  it('pontos "_medio" existem só quando os dois lados estão utilizáveis', () => {
    const q = trilhaDeLandmarks([{ t: 0, lm: lm({ 23: [0.4, 0.6, 0.9], 24: [0.6, 0.6, 0.9], 11: [0.4, 0.3, 0.9], 12: [0.6, 0.3, 0.1] }) }], 30, 100, 100).quadros[0];
    expect(pontoDoQuadro(q, 'quadril_medio')).toEqual({ x: 50, y: 60 });
    expect(pontoDoQuadro(q, 'ombro_medio')).toBeNull();
    expect(pontoDoQuadro(q, 'ombro_e')).toEqual({ x: 40, y: 30 });
    expect(pontoDoQuadro(q, 'inexistente')).toBeNull();
    expect(pontoDoQuadro(undefined, 'nariz')).toBeNull();
  });

  it('serieDoPonto traz null onde o ponto não é utilizável', () => {
    const t = trilhaDeLandmarks([{ t: 0, lm: lm({ 0: [0.1, 0.2] }) }, { t: 0.1, lm: null }, { t: 0.2, lm: lm({ 0: [0.3, 0.4, 0.1] }) }], 10, 100, 100);
    expect(serieDoPonto(t, 'nariz', 'x')).toEqual([10, null, null]);
    expect(serieDoPonto(t, 'nariz', 'y', 0.05)).toEqual([20, null, 40]);
  });

  it('deteccaoPct conta os quadros em que o corpo foi visto', () => {
    const corpo = lm({ 11: [0.4, 0.3], 12: [0.6, 0.3], 23: [0.4, 0.6], 24: [0.6, 0.6], 25: [0.4, 0.8], 26: [0.6, 0.8] });
    const t = trilhaDeLandmarks([{ t: 0, lm: corpo }, { t: 0.1, lm: null }, { t: 0.2, lm: corpo }, { t: 0.3, lm: lm({ 11: [0.4, 0.3] }) }], 10, 100, 100);
    expect(deteccaoPct(t)).toBe(50);
    expect(deteccaoPct(criarTrilha(30, 1, 1))).toBe(0);
  });

  it('estima a direção pelos pés e, sem pés, pelo nariz em relação à orelha', () => {
    const direita = trilhaDeLandmarks([{ t: 0, lm: lm({ 29: [0.4, 0.9], 31: [0.5, 0.9], 30: [0.42, 0.9], 32: [0.53, 0.9] }) }], 30, 100, 100);
    const esquerda = trilhaDeLandmarks([{ t: 0, lm: lm({ 29: [0.5, 0.9], 31: [0.4, 0.9] }) }], 30, 100, 100);
    const rosto = trilhaDeLandmarks([{ t: 0, lm: lm({ 0: [0.42, 0.2], 8: [0.5, 0.2] }) }], 30, 100, 100);
    expect(estimarDirecao(direita)).toBe(1);
    expect(estimarDirecao(esquerda)).toBe(-1);
    expect(estimarDirecao(rosto)).toBe(-1);
    expect(estimarDirecao(criarTrilha(30, 1, 1))).toBe(1);
  });

  it('com a figura sintética a direção estimada acerta nos dois sentidos', () => {
    expect(estimarDirecao(trilhaSintetica(configurar('marcha', { direcao: 1 }), 30, 2))).toBe(1);
    expect(estimarDirecao(trilhaSintetica(configurar('marcha', { direcao: -1 }), 30, 2))).toBe(-1);
  });
});

describe('salvar e retomar a análise', () => {
  const base = (): TrilhaPose => {
    const t = trilhaSintetica(configurar('marcha'), 30, 1);
    t.quadros[3].pontos.joelho_d = { x: 123.456, y: 234.567, conf: 1, manual: true, auto: { x: 100.111, y: 200.222, conf: 0.8 } };
    t.quadros[4].pontos.joelho_d = { x: 124, y: 235, conf: 0.8, interp: true, auto: { x: 101, y: 201, conf: 0.8 } };
    t.quadros[5].pontos.nariz = { x: 50, y: 60 };
    return t;
  };

  it('ida e volta preserva os pontos, os quadros-chave e as detecções originais (com arredondamento de centésimos)', () => {
    const t = base();
    const volta = lerTrilha(serializarTrilha(t));
    expect(volta.fps).toBe(t.fps);
    expect(volta.largura).toBe(t.largura);
    expect(volta.quadros).toHaveLength(t.quadros.length);
    expect(volta.quadros[3].pontos.joelho_d).toEqual({ x: 123.46, y: 234.57, conf: 1, manual: true, auto: { x: 100.11, y: 200.22, conf: 0.8 } });
    expect(volta.quadros[4].pontos.joelho_d).toMatchObject({ interp: true, auto: { x: 101, y: 201 } });
    expect(volta.quadros[5].pontos.nariz).toEqual({ x: 50, y: 60 });
    expect(volta.quadros[7].i).toBe(7);
    expect(volta.quadros[7].t).toBeCloseTo(t.quadros[7].t, 3);
  });

  it('aceita o objeto já convertido e não altera a trilha original', () => {
    const t = base();
    const antes = JSON.stringify(t);
    lerTrilha(JSON.parse(serializarTrilha(t)));
    expect(JSON.stringify(t)).toBe(antes);
  });

  it('rejeita arquivo inválido com mensagem em português', () => {
    expect(() => lerTrilha('{não é json')).toThrow('JSON válido');
    expect(() => lerTrilha(JSON.stringify({ tipo: 'outra-coisa' }))).toThrow('não é uma análise de vídeo');
    expect(() => lerTrilha(null)).toThrow('não é uma análise de vídeo');
    expect(() => lerTrilha(JSON.stringify({ tipo: 'trilha-pose', versao: 99, fps: 30, largura: 1, altura: 1, quadros: [] }))).toThrow('versão mais nova');
    expect(() => lerTrilha(JSON.stringify({ tipo: 'trilha-pose', versao: 1, fps: 0, largura: 1, altura: 1, quadros: [] }))).toThrow('incompleta');
    expect(() => lerTrilha(JSON.stringify({ tipo: 'trilha-pose', versao: 1, fps: 30, largura: 1, altura: 1, quadros: [{ t: 'x', p: {} }] }))).toThrow('Quadro 1');
  });

  it('ignora pontos desconhecidos ou malformados em vez de quebrar', () => {
    const texto = JSON.stringify({ tipo: 'trilha-pose', versao: 1, fps: 30, largura: 100, altura: 100, quadros: [{ t: 0, p: { nariz: [1, 2, 0.9, 0], dedo_mindinho: [1, 2, 1, 0], joelho_d: [1, 2], ombro_d: ['a', 2, 1, 0] } }] });
    const t = lerTrilha(texto);
    expect(Object.keys(t.quadros[0].pontos)).toEqual(['nariz']);
    expect(t.quadros[0].pontos.nariz).toEqual({ x: 1, y: 2, conf: 0.9 });
  });

  it('o texto salvo é compacto: uma trilha de 30 s a 30 quadros/s cabe em poucos megabytes', () => {
    const t = trilhaSintetica(configurar('marcha'), 30, 30);
    const bytes = serializarTrilha(t).length;
    expect(t.quadros).toHaveLength(900);
    expect(bytes).toBeLessThan(2_000_000);
  });
});
