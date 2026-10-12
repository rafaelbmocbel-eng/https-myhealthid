import { describe, expect, it } from 'vitest';
import {
  anguloJoelho, anguloNoQuadro, anguloQuadril, anguloTibia, anguloTornozelo, anguloValgo, angulosPorQuadro, calcularAnguloNoQuadro, definicaoPrecisaDeDirecao,
  elevacaoBraco, elevacaoRelativaAoTronco, inclinacaoLateralTronco, inclinacaoTronco, linhaDaPelve, linhaDosOmbros, pontosDaDefinicao, type DefinicaoAngulo,
} from '../lib/angular/video/angulos';
import { configurar, poseSintetica, trilhaSintetica, type GestoSintetico } from '../lib/angular/video/detectorFalso';
import { modeloDoGesto, MODELOS_GESTO } from '../lib/angular/video/modelos';
import type { QuadroPose } from '../lib/angular/video/tipos';

const quadro = (pontos: Record<string, [number, number, number?]>): QuadroPose => ({
  i: 0, t: 0, pontos: Object.fromEntries(Object.entries(pontos).map(([n, [x, y, c]]) => [n, { x, y, ...(c !== undefined ? { conf: c } : {}) }])),
});

describe('geometria dos ângulos (valores calculados à mão)', () => {
  const tres = (saida: 'interno' | 'flexao' | 'dorsiflexao') => ({ id: 'x', nome: 'x', lado: null, tipo: 'tres_pontos', a: 'a', vertice: 'v', c: 'c', saida }) as DefinicaoAngulo;

  it('três pontos: interno, flexão (180 − interno) e dorsiflexão (90 − interno)', () => {
    const q = quadro({ a: [0, -10], v: [0, 0], c: [10, 0] }); // 90° no vértice
    expect(calcularAnguloNoQuadro(tres('interno'), q)).toBeCloseTo(90, 9);
    expect(calcularAnguloNoQuadro(tres('flexao'), q)).toBeCloseTo(90, 9);
    expect(calcularAnguloNoQuadro(tres('dorsiflexao'), q)).toBeCloseTo(0, 9);
    const reto = quadro({ a: [0, -10], v: [0, 0], c: [0, 10] }); // membro estendido
    expect(calcularAnguloNoQuadro(tres('interno'), reto)).toBeCloseTo(180, 9);
    expect(calcularAnguloNoQuadro(tres('flexao'), reto)).toBeCloseTo(0, 9);
    const fechado = quadro({ a: [0, -10], v: [0, 0], c: [10, -10] }); // 45°
    expect(calcularAnguloNoQuadro(tres('interno'), fechado)).toBeCloseTo(45, 9);
    expect(calcularAnguloNoQuadro(tres('dorsiflexao'), fechado)).toBeCloseTo(45, 9);
  });

  it('flexão assinada: positiva na flexão e negativa na hiperextensão, para os dois lados do paciente', () => {
    const joelho = anguloJoelho('D'); // quadril → joelho → tornozelo, sinal +1
    // paciente virado para a direita: ao flexionar, o tornozelo vai para trás (esquerda da imagem)
    const flexionado = quadro({ quadril_d: [0, 0], joelho_d: [0, 10], tornozelo_d: [-10, 10] });
    const hiper = quadro({ quadril_d: [0, 0], joelho_d: [0, 10], tornozelo_d: [3, 20] });
    expect(calcularAnguloNoQuadro(joelho, flexionado, 1)).toBeCloseTo(90, 9);
    expect(calcularAnguloNoQuadro(joelho, hiper, 1) as number).toBeLessThan(0);
    // virado para a esquerda: tudo espelhado
    const espelhado = quadro({ quadril_d: [0, 0], joelho_d: [0, 10], tornozelo_d: [10, 10] });
    expect(calcularAnguloNoQuadro(joelho, espelhado, -1)).toBeCloseTo(90, 9);
    const quadril = anguloQuadril('D'); // ombro → quadril → joelho, sinal −1
    const coxaFrente = quadro({ ombro_d: [0, -10], quadril_d: [0, 0], joelho_d: [10, 10] }); // joelho à frente: flexão
    const coxaAtras = quadro({ ombro_d: [0, -10], quadril_d: [0, 0], joelho_d: [-10, 10] }); // extensão
    expect(calcularAnguloNoQuadro(quadril, coxaFrente, 1)).toBeCloseTo(45, 9);
    expect(calcularAnguloNoQuadro(quadril, coxaAtras, 1)).toBeCloseTo(-45, 9);
    expect(calcularAnguloNoQuadro(quadril, coxaFrente, -1)).toBeCloseTo(-45, 9);
  });

  it('segmento em relação à vertical: sem sinal (0–180) e com sinal pela direção do paciente', () => {
    const seg = (referencia: 'vertical_cima' | 'vertical_baixo', assinado: boolean) =>
      ({ id: 's', nome: 's', lado: null, tipo: 'segmento', de: 'a', para: 'b', referencia, assinado }) as DefinicaoAngulo;
    const paraCimaDireita = quadro({ a: [0, 0], b: [10, -10] }); // 45° da vertical para cima
    expect(calcularAnguloNoQuadro(seg('vertical_cima', false), paraCimaDireita)).toBeCloseTo(45, 9);
    expect(calcularAnguloNoQuadro(seg('vertical_cima', true), paraCimaDireita, 1)).toBeCloseTo(45, 9);
    expect(calcularAnguloNoQuadro(seg('vertical_cima', true), paraCimaDireita, -1)).toBeCloseTo(-45, 9);
    const reto = quadro({ a: [0, 0], b: [0, -10] });
    expect(calcularAnguloNoQuadro(seg('vertical_cima', false), reto)).toBeCloseTo(0, 9);
    expect(calcularAnguloNoQuadro(seg('vertical_baixo', false), reto)).toBeCloseTo(180, 9);
    const horizontal = quadro({ a: [0, 0], b: [10, 0] });
    expect(calcularAnguloNoQuadro(seg('vertical_baixo', false), horizontal)).toBeCloseTo(90, 9);
    const paraBaixo = quadro({ a: [0, 0], b: [-10, 10] });
    expect(calcularAnguloNoQuadro(seg('vertical_baixo', true), paraBaixo, 1)).toBeCloseTo(-45, 9);
    expect(calcularAnguloNoQuadro(seg('vertical_baixo', true), paraBaixo, -1)).toBeCloseTo(45, 9);
  });

  it('linha em relação à horizontal: positivo quando o lado direito da imagem está mais baixo', () => {
    const q = quadro({ ombro_e: [0, 0], ombro_d: [-100, 10] }); // da E para a D (para a esquerda), a D mais baixa na imagem
    const v = calcularAnguloNoQuadro(linhaDosOmbros, q) as number;
    expect(Math.abs(v)).toBeCloseTo((Math.atan(10 / 100) * 180) / Math.PI, 6);
    expect(v).toBeLessThan(0); // o lado esquerdo da imagem (D) está mais baixo: a linha sobe para a direita
    const inclinada = quadro({ quadril_e: [0, 0], quadril_d: [100, 100] });
    expect(calcularAnguloNoQuadro(linhaDaPelve, inclinada)).toBeCloseTo(45, 9);
  });

  it('entre segmentos (0–180) e tornozelo pelo eixo do pé', () => {
    const q = quadro({ tornozelo_d: [0, 0], joelho_d: [0, -10], calcanhar_d: [-5, 8], pe_d: [15, 8] });
    expect(calcularAnguloNoQuadro(anguloTornozelo('D'), q)).toBeCloseTo(0, 9); // perna perpendicular ao pé: neutro
    const dorsi = quadro({ tornozelo_d: [0, 0], joelho_d: [5, -10], calcanhar_d: [-5, 8], pe_d: [15, 8] }); // joelho à frente: dorsiflexão
    const v = calcularAnguloNoQuadro(anguloTornozelo('D'), dorsi) as number;
    expect(v).toBeCloseTo((Math.atan(5 / 10) * 180) / Math.PI, 6);
    const plantar = quadro({ tornozelo_d: [0, 0], joelho_d: [-5, -10], calcanhar_d: [-5, 8], pe_d: [15, 8] });
    expect(calcularAnguloNoQuadro(anguloTornozelo('D'), plantar) as number).toBeLessThan(0);
    const braco = quadro({ ombro_d: [0, 0], cotovelo_d: [10, 0], ombro_medio: [0, 0], quadril_medio: [0, 10] });
    expect(calcularAnguloNoQuadro({ ...elevacaoRelativaAoTronco('D'), a: ['ombro_d', 'cotovelo_d'], b: ['ombro_medio', 'quadril_medio'] }, braco)).toBeCloseTo(90, 9);
  });

  it('valgo: positivo com o joelho para dentro (em direção ao outro quadril), nos dois lados e com a imagem espelhada', () => {
    const frenteComValgo = quadro({
      quadril_d: [-10, 0], joelho_d: [-9, 50], tornozelo_d: [-15, 100], // joelho D (esquerda da imagem) vai para o centro
      quadril_e: [10, 0], joelho_e: [9, 50], tornozelo_e: [15, 100],
    });
    const varo = quadro({ quadril_d: [-10, 0], joelho_d: [-20, 50], tornozelo_d: [-15, 100], quadril_e: [10, 0], joelho_e: [20, 50], tornozelo_e: [15, 100] });
    const d = calcularAnguloNoQuadro(anguloValgo('D'), frenteComValgo) as number;
    const e = calcularAnguloNoQuadro(anguloValgo('E'), frenteComValgo) as number;
    expect(d).toBeGreaterThan(0);
    expect(e).toBeCloseTo(d, 9);
    expect(calcularAnguloNoQuadro(anguloValgo('D'), varo) as number).toBeLessThan(0);
    const espelhada = quadro({
      quadril_d: [10, 0], joelho_d: [9, 50], tornozelo_d: [15, 100], quadril_e: [-10, 0], joelho_e: [-9, 50], tornozelo_e: [-15, 100],
    });
    expect(calcularAnguloNoQuadro(anguloValgo('D'), espelhada)).toBeCloseTo(d, 9);
    // joelho exatamente na reta quadril–tornozelo: zero
    const reta = quadro({ quadril_d: [-10, 0], joelho_d: [-12.5, 50], tornozelo_d: [-15, 100], quadril_e: [10, 0] });
    expect(calcularAnguloNoQuadro(anguloValgo('D'), reta) as number).toBeCloseTo(0, 9);
  });

  it('sem ponto, com confiança baixa ou com segmento de comprimento zero o ângulo é null; ponto corrigido à mão vale sempre', () => {
    const def = tres('interno');
    expect(calcularAnguloNoQuadro(def, quadro({ a: [0, -10], v: [0, 0] }))).toBeNull();
    expect(calcularAnguloNoQuadro(def, quadro({ a: [0, -10], v: [0, 0], c: [10, 0, 0.1] }))).toBeNull();
    expect(calcularAnguloNoQuadro(def, quadro({ a: [0, -10], v: [0, 0], c: [10, 0, 0.1] }), 1, 0.05)).toBeCloseTo(90, 9);
    expect(calcularAnguloNoQuadro(def, quadro({ a: [0, 0], v: [0, 0], c: [10, 0] }))).toBeNull();
    const manual = quadro({ a: [0, -10], v: [0, 0] });
    manual.pontos.c = { x: 10, y: 0, conf: 0.01, manual: true };
    expect(calcularAnguloNoQuadro(def, manual)).toBeCloseTo(90, 9);
    expect(calcularAnguloNoQuadro(inclinacaoTronco, quadro({ quadril_d: [5, 5], ombro_d: [5, 5] }))).toBeNull();
    expect(calcularAnguloNoQuadro(def, undefined)).toBeNull();
  });

  it('pontos virtuais "_medio" e alternativas "a|b": usa a primeira utilizável', () => {
    const q = quadro({ quadril_d: [0, 100], quadril_e: [0, 100, 0.1], ombro_d: [10, 0], ombro_e: [10, 0] });
    // quadril_medio exige os dois lados utilizáveis: cai para quadril_d
    expect(calcularAnguloNoQuadro(inclinacaoTronco, q, 1)).toBeCloseTo((Math.atan(10 / 100) * 180) / Math.PI, 6);
    expect(pontosDaDefinicao(inclinacaoTronco)).toEqual(['quadril_medio', 'quadril_d', 'quadril_e', 'ombro_medio', 'ombro_d', 'ombro_e']);
    expect(pontosDaDefinicao(anguloJoelho('E'))).toEqual(['quadril_e', 'joelho_e', 'tornozelo_e']);
    expect(pontosDaDefinicao(anguloValgo('D'))).toEqual(['quadril_d', 'joelho_d', 'tornozelo_d', 'quadril_e']);
  });

  it('sabe quais definições dependem da direção do paciente', () => {
    expect(definicaoPrecisaDeDirecao(anguloJoelho('D'))).toBe(true);
    expect(definicaoPrecisaDeDirecao(anguloJoelho('D', false))).toBe(false);
    expect(definicaoPrecisaDeDirecao(inclinacaoTronco)).toBe(true);
    expect(definicaoPrecisaDeDirecao(inclinacaoLateralTronco)).toBe(false);
    expect(definicaoPrecisaDeDirecao(elevacaoBraco('D'))).toBe(false);
    expect(definicaoPrecisaDeDirecao(linhaDosOmbros)).toBe(false);
    expect(definicaoPrecisaDeDirecao(anguloTibia('D'))).toBe(true);
  });
});

describe('ângulos medidos na figura sintética batem com os ângulos conhecidos', () => {
  const casos: { gesto: GestoSintetico; fps: number; dur: number }[] = [
    { gesto: 'marcha', fps: 30, dur: 4 }, { gesto: 'corrida', fps: 60, dur: 3 }, { gesto: 'agachamento', fps: 15, dur: 6 },
    { gesto: 'salto', fps: 60, dur: 2.5 }, { gesto: 'ombro', fps: 15, dur: 6 },
  ];
  for (const { gesto, fps, dur } of casos) {
    for (const direcao of [1, -1] as const) {
      it(`${gesto}, paciente virado para ${direcao === 1 ? 'a direita' : 'a esquerda'}: todas as articulações do modelo (erro < 0,01°)`, () => {
        const cfg = configurar(gesto, { direcao });
        const trilha = trilhaSintetica(cfg, fps, dur);
        const modelo = modeloDoGesto(gesto);
        for (const def of modelo.articulacoes) {
          const amostras = angulosPorQuadro(trilha, def);
          expect(amostras).toHaveLength(trilha.quadros.length);
          let comparados = 0;
          amostras.forEach((a) => {
            const verdade = poseSintetica(cfg, a.t).verdade[def.id];
            if (verdade === undefined) return;
            expect(a.graus, `${def.id} em t=${a.t}`).not.toBeNull();
            expect(Math.abs((a.graus as number) - verdade), `${def.id} em t=${a.t}`).toBeLessThan(0.01);
            comparados++;
          });
          expect(comparados, `a figura sintética deve conhecer ${def.id}`).toBeGreaterThan(0);
        }
      });
    }
  }

  it('cada articulação listada nos modelos tem id único dentro do modelo', () => {
    for (const m of MODELOS_GESTO) {
      const ids = m.articulacoes.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const g of m.graficoPadrao) expect(ids).toContain(g);
    }
  });

  it('com a câmera fixa (o paciente atravessa o quadro) os ângulos não mudam', () => {
    const cfg = configurar('marcha', { cameraFixa: true, largura: 3000, velocidade: 1.2 });
    const trilha = trilhaSintetica(cfg, 30, 4);
    for (const def of [anguloJoelho('D'), anguloQuadril('E'), anguloTornozelo('D')]) {
      angulosPorQuadro(trilha, def).forEach((a) => expect(Math.abs((a.graus as number) - poseSintetica(cfg, a.t).verdade[def.id])).toBeLessThan(0.01));
    }
  });

  it('o ruído de 1,5 px do detector vira erro angular pequeno e sem viés', () => {
    const cfg = configurar('marcha');
    const trilha = trilhaSintetica(cfg, 30, 8, { ruidoPx: 1.5, semente: 3 });
    const erros = angulosPorQuadro(trilha, anguloJoelho('D')).map((a) => (a.graus as number) - poseSintetica(cfg, a.t).verdade.joelho_d);
    const media = erros.reduce((s, v) => s + v, 0) / erros.length;
    const eqm = Math.sqrt(erros.reduce((s, v) => s + v * v, 0) / erros.length);
    expect(Math.abs(media)).toBeLessThan(1);
    expect(eqm).toBeLessThan(3);
    expect(eqm).toBeGreaterThan(0.1);
  });

  it('anguloNoQuadro dá o mesmo valor que a série', () => {
    const cfg = configurar('marcha');
    const trilha = trilhaSintetica(cfg, 30, 3);
    const serie = angulosPorQuadro(trilha, anguloJoelho('E'));
    for (const i of [0, 10, 45, 89]) expect(anguloNoQuadro(trilha, i, anguloJoelho('E'))).toBeCloseTo(serie[i].graus as number, 9);
    expect(anguloNoQuadro(trilha, 999, anguloJoelho('E'))).toBeNull();
  });

  it('quadros sem pose dão null e o resto da série continua', () => {
    const cfg = configurar('marcha');
    const trilha = trilhaSintetica(cfg, 30, 3, { ausentes: (t) => t >= 1 && t < 1.2 });
    const serie = angulosPorQuadro(trilha, anguloJoelho('D'));
    expect(serie.filter((a) => a.graus === null).length).toBe(6);
    expect(serie[0].graus).not.toBeNull();
    expect(serie[60].graus).not.toBeNull();
  });
});
