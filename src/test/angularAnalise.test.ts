import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  analiseDaFotoParaExportar, analiseDeJson, analiseParaJson, calcularResultados, canvasComMedidas, faltaReferenciaDoPrumo, formatarResultado, itensDaAnalise, painelParaExportar,
  medidasSalvas, nomeArquivoImagem, OPCOES_ANALISE_PADRAO, type AnaliseFoto,
} from '../lib/angular/analise';
import { ESTILO_INSTAGRAM, ESTILO_PADRAO } from '../lib/angular/estilo';
import { contextoDesenho, itensDoAngulo, type ItemDesenho } from '../lib/angular/desenho';
import { desenharAngulo, desenharPrumo, desenharReta, desenharRotulo, pintarItens } from '../lib/angular/desenharCanvas';
import { girar, type Ponto } from '../lib/angular/medidas';

const P = (x: number, y: number): Ponto => ({ x, y });
const base = (o: Partial<AnaliseFoto> = {}): AnaliseFoto => ({ vista: 'frente', largura: 1000, altura: 1500, pontos: {}, giro: null, cmPorPx: null, opcoes: { ...OPCOES_ANALISE_PADRAO }, ...o });
const de = <T extends ItemDesenho['tipo']>(itens: ItemDesenho[], tipo: T) => itens.filter((i): i is Extract<ItemDesenho, { tipo: T }> => i.tipo === tipo);

/** Contexto 2D que só registra as chamadas. */
function ctxFalso(w = 1000, h = 1500) {
  const chamadas: { fn: string; args: unknown[] }[] = [];
  const props: Record<string, unknown> = {};
  const alvo: Record<string, unknown> = { canvas: { width: w, height: h } };
  const ctx = new Proxy(alvo, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k in props) return props[k];
      return (...args: unknown[]) => { chamadas.push({ fn: k, args }); };
    },
    set(_t, k: string, v) { props[k] = v; chamadas.push({ fn: `set:${k}`, args: [v] }); return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, chamadas };
}

describe('resultados da análise', () => {
  it('calcula só as medidas completas da vista, com a correção de nível', () => {
    const a = base({ pontos: { ombros: [P(100, 400), P(300, 400)], pelve: [P(100, 800)] } });
    const r = calcularResultados(a);
    expect(r.map((x) => x.id)).toEqual(['ombros']);
    expect(r[0].valor).toBe(0);
    // foto girada 3°: sem correção o desnível aparece; com o giro informado, some
    const torto = base({ pontos: { ombros: [girar(P(100, 400), 3), girar(P(300, 400), 3)] } });
    expect(calcularResultados(torto)[0].valor).toBeGreaterThan(2.5);
    expect(calcularResultados({ ...torto, giro: 3 })[0].valor).toBeCloseTo(0, 6);
  });

  it('medidas de outra vista não entram', () => {
    const a = base({ vista: 'frente', pontos: { cva: [P(0, 0), P(100, 100)] } });
    expect(calcularResultados(a)).toEqual([]);
  });

  it('o fio de prumo gera um resultado por ponto, na unidade escolhida e com ela no id', () => {
    const pontos = { 'prumo-perfil': [P(500, 1400), P(540, 200), P(520, 400), P(500, 800), P(490, 1100)] };
    const g = calcularResultados(base({ vista: 'perfil', pontos }));
    expect(g.map((x) => x.id)).toEqual(['prumo-perfil-orelha-graus', 'prumo-perfil-ombro-graus', 'prumo-perfil-quadril-graus', 'prumo-perfil-joelho-graus']);
    const cm = calcularResultados(base({ vista: 'perfil', pontos, cmPorPx: 0.2, opcoes: { ...OPCOES_ANALISE_PADRAO, unidadePrumo: 'cm' } }));
    expect(cm.map((x) => x.id)[0]).toBe('prumo-perfil-orelha-cm');
    expect(cm[0].valor).toBeCloseTo(8, 6);
    expect(cm.every((x) => x.unidade === 'cm')).toBe(true);
    // % usa a altura marcada, medida na vertical
    const pct = calcularResultados(base({ vista: 'perfil', pontos: { ...pontos, altura: [P(500, 100), P(500, 1400)] }, opcoes: { ...OPCOES_ANALISE_PADRAO, unidadePrumo: 'pct' } }));
    expect(pct[0].valor).toBeCloseTo((40 / 1300) * 100, 6);
    expect(pct[0].unidade).toBe('%');
  });

  it('avisa o que falta para a unidade do prumo', () => {
    const a = base({ vista: 'perfil', opcoes: { ...OPCOES_ANALISE_PADRAO, unidadePrumo: 'cm' } });
    expect(faltaReferenciaDoPrumo(a)).toMatch(/escala/);
    expect(faltaReferenciaDoPrumo({ ...a, cmPorPx: 0.1 })).toBeNull();
    expect(faltaReferenciaDoPrumo({ ...a, opcoes: { ...a.opcoes, unidadePrumo: 'pct' } })).toMatch(/altura/);
    expect(faltaReferenciaDoPrumo({ ...a, opcoes: { ...a.opcoes, unidadePrumo: 'graus' } })).toBeNull();
  });

  it('grava as medidas com a unidade certa (cm, % ou graus)', () => {
    const salvas = medidasSalvas([
      { id: 'ombros', medidaId: 'ombros', nome: 'x', valor: 2.34, unidade: 'graus', texto: 't' },
      { id: 'regua', medidaId: 'regua', nome: 'x', valor: 12.34, unidade: 'cm', texto: 't' },
      { id: 'prumo-perfil-orelha-pct', medidaId: 'prumo-perfil', nome: 'x', valor: -3.06, unidade: '%', texto: 't' },
    ]);
    expect(salvas[0]).toEqual({ id: 'ombros', graus: 2.3, texto: 't' });
    expect(salvas[1].unidade).toBe('cm');
    expect(salvas[2]).toMatchObject({ graus: -3.1, unidade: '%' });
  });

  it('o rótulo mostra o valor absoluto', () => {
    expect(formatarResultado({ valor: -12.34, unidade: 'graus' })).toBe('12,3°');
    expect(formatarResultado({ valor: -12.34, unidade: 'graus' }, 0)).toBe('12°');
    expect(formatarResultado({ valor: -2.06, unidade: '%' })).toBe('2,1%');
  });

  it('o estado é JSON: vai e volta sem a imagem; entrada inválida é recusada', () => {
    const a = base({ imagem: {} as CanvasImageSource, pontos: { ombros: [P(1, 2), P(3, 4)] }, giro: 1.5, cmPorPx: 0.25 });
    const json = analiseParaJson(a);
    expect('imagem' in json).toBe(false);
    expect(analiseDeJson(JSON.parse(JSON.stringify(json)))).toEqual(json);
    expect(analiseDeJson(null)).toBeNull();
    expect(analiseDeJson({ vista: 'lado', largura: 10, altura: 10 })).toBeNull();
    expect(analiseDeJson({ vista: 'frente', largura: 0, altura: 10 })).toBeNull();
    const lixo = analiseDeJson({ vista: 'perfil', largura: 10, altura: 20, pontos: { cva: [{ x: 1, y: 2 }, { x: 'a', y: 3 }] }, opcoes: { unidadePrumo: 'km', olhaPara: 'esquerda' } })!;
    expect(lixo.pontos.cva).toEqual([{ x: 1, y: 2 }]);
    expect(lixo.opcoes.unidadePrumo).toBe('graus');
    expect(lixo.opcoes.olhaPara).toBe('esquerda');
  });

  it('o nome do arquivo não leva dados do paciente', () => {
    expect(nomeArquivoImagem('perfil', new Date('2026-10-11T15:00:00Z'))).toBe('analise-angular-perfil-2026-10-11.png');
  });
});

describe('itens de desenho', () => {
  const ombros = base({ pontos: { ombros: [P(200, 400), P(800, 340)] } });

  it('estilo Instagram: reta grossa, arco e rótulo "6°" sem casas; padrão: "5,7°"', () => {
    const ig = itensDaAnalise(ombros, ESTILO_INSTAGRAM);
    const rot = de(ig, 'rotulo');
    expect(rot).toHaveLength(1);
    expect(rot[0].texto).toBe('6°');
    expect(rot[0].fundo).toBe('#ffffff');
    expect(de(ig, 'arco')).toHaveLength(1);
    const grossa = de(ig, 'reta').filter((r) => !r.tracejado);
    expect(grossa.length).toBeGreaterThan(0);
    // espessura 9 para 1000 px de menor lado
    expect(grossa[0].largura).toBeCloseTo(9, 6);
    const pad = itensDaAnalise(ombros, ESTILO_PADRAO);
    expect(de(pad, 'rotulo')[0].texto).toBe('5,7°');
    expect(de(pad, 'rotulo')[0].fundo).toBeUndefined();
    expect(de(pad, 'rotulo')[0].contorno).toBe('#000000');
  });

  it('a espessura segue o menor lado: a mesma marcação em foto 3x maior sai 3x mais grossa', () => {
    const grande = base({ largura: 3000, altura: 4500, pontos: { ombros: [P(600, 1200), P(2400, 1020)] } });
    expect(de(itensDaAnalise(grande, ESTILO_INSTAGRAM), 'reta').find((r) => !r.tracejado)!.largura).toBeCloseTo(27, 6);
  });

  it('desligar arco e rótulo tira os dois', () => {
    const it = itensDaAnalise(ombros, { ...ESTILO_INSTAGRAM, mostrarArco: false, mostrarRotulo: false });
    expect(de(it, 'arco')).toHaveLength(0);
    expect(de(it, 'rotulo')).toHaveLength(0);
  });

  it('a referência horizontal sai tracejada e o arco varre o ângulo da medida', () => {
    const it = itensDaAnalise(ombros, ESTILO_INSTAGRAM);
    expect(de(it, 'reta').some((r) => r.tracejado)).toBe(true);
    const arco = de(it, 'arco')[0];
    const graus = (Math.abs(arco.delta) * 180) / Math.PI;
    expect(graus).toBeCloseTo(calcularResultados(ombros)[0].valor, 4);
  });

  it('a referência acompanha o nível corrigido', () => {
    const giro = 5;
    const a = base({ giro, pontos: { ombros: [girar(P(200, 400), giro), girar(P(800, 400), giro)] } });
    const it = itensDaAnalise(a, ESTILO_INSTAGRAM);
    const ref = de(it, 'reta').find((r) => r.tracejado)!;
    const ang = (Math.atan2(ref.b.y - ref.a.y, ref.b.x - ref.a.x) * 180) / Math.PI;
    expect(Math.abs((((ang % 180) + 180) % 180) - giro)).toBeLessThan(0.01);
    // a medida em si dá 0 e o arco quase some, mas nunca produz NaN
    for (const i of it) expect(JSON.stringify(i)).not.toMatch(/null|NaN/);
  });

  it('medida marcada pela metade mostra só pontos e retas, sem arco nem rótulo', () => {
    const it = itensDaAnalise(base({ pontos: { livre: [P(100, 100), P(300, 300)] } }), ESTILO_INSTAGRAM);
    expect(de(it, 'ponto')).toHaveLength(2);
    expect(de(it, 'reta')).toHaveLength(1);
    expect(de(it, 'arco')).toHaveLength(0);
    expect(de(it, 'rotulo')).toHaveLength(0);
  });

  it('ângulo livre: braços, arco, três pontos nas cores do estilo e rótulo do valor', () => {
    const a = base({ pontos: { livre: [P(500, 100), P(500, 500), P(900, 700)] } });
    const it = itensDaAnalise(a, ESTILO_INSTAGRAM);
    expect(de(it, 'reta')).toHaveLength(2);
    expect(de(it, 'ponto').map((p) => p.cor)).toEqual([ESTILO_INSTAGRAM.corPontoA, ESTILO_INSTAGRAM.corVertice, ESTILO_INSTAGRAM.corPontoB]);
    expect(de(it, 'rotulo')[0].texto).toBe(`${Math.round(calcularResultados(a)[0].valor)}°`);
  });

  it('compasso com referência: o braço de referência desce do vértice e o ângulo é 118°', () => {
    const r = 400, rad = (118 * Math.PI) / 180;
    const a = base({ vista: 'perfil', pontos: { 'compasso-ref': [P(500, 500), P(500 + r * Math.sin(rad), 500 + r * Math.cos(rad))] } });
    const it = itensDaAnalise(a, ESTILO_INSTAGRAM);
    expect(de(it, 'rotulo')[0].texto).toBe('118°');
    const ref = de(it, 'reta').find((x) => x.b.x === 500 && x.b.y > 500)!;
    expect(ref.b.y).toBeCloseTo(900, 6);
    // só dois pontos: o vértice e a ponta; a referência não tem bolinha
    expect(de(it, 'ponto')).toHaveLength(2);
    const direita = itensDaAnalise({ ...a, opcoes: { ...a.opcoes, compassoRef: 'direita' } }, ESTILO_INSTAGRAM);
    expect(de(direita, 'rotulo')[0].texto).not.toBe('118°');
  });

  it('Cobb com as retas se cruzando: prolonga tracejado até o cruzamento e põe o arco lá', () => {
    const a = base({ pontos: { cobb: [P(100, 100), P(300, 160), P(100, 400), P(300, 340)] } });
    const it = itensDaAnalise(a, ESTILO_INSTAGRAM);
    expect(de(it, 'arco')).toHaveLength(1);
    expect(de(it, 'reta').filter((r) => r.tracejado).length).toBeGreaterThan(0);
    expect(de(it, 'rotulo')[0].texto).toBe(`${Math.round(calcularResultados(a)[0].valor)}°`);
  });

  it('retas paralelas não geram arco, só o rótulo', () => {
    const a = base({ pontos: { cobb: [P(100, 100), P(300, 100), P(100, 400), P(300, 400)] } });
    const it = itensDaAnalise(a, ESTILO_INSTAGRAM);
    expect(de(it, 'arco')).toHaveLength(0);
    expect(de(it, 'rotulo')).toHaveLength(1);
  });

  it('ângulo Q: o prolongamento tracejado e o arco entre ele e a reta da tuberosidade', () => {
    const a = base({ pontos: { 'angulo-q-d': [P(300, 100), P(300, 600), P(340, 1000)] } });
    const it = itensDaAnalise(a, ESTILO_INSTAGRAM);
    expect(de(it, 'reta').some((r) => r.tracejado)).toBe(true);
    const arco = de(it, 'arco')[0];
    expect((Math.abs(arco.delta) * 180) / Math.PI).toBeCloseTo(calcularResultados(a)[0].valor, 4);
  });

  it('fio de prumo: linha vertical de ponta a ponta, desvio de cada ponto e rótulos com nome', () => {
    const pontos = { 'prumo-perfil': [P(500, 1400), P(560, 200), P(520, 400), P(500, 800), P(490, 1100)] };
    const a = base({ vista: 'perfil', pontos, cmPorPx: 0.1, opcoes: { ...OPCOES_ANALISE_PADRAO, unidadePrumo: 'cm' } });
    const it = itensDaAnalise(a, ESTILO_INSTAGRAM);
    const fio = de(it, 'reta').find((r) => !r.tracejado)!;
    expect(fio.a.y).toBeCloseTo(0, 6);
    expect(fio.b.y).toBeCloseTo(1500, 6);
    expect(fio.a.x).toBeCloseTo(500, 6);
    expect(de(it, 'rotulo').map((r) => r.texto)).toEqual(['Orelha 6,0 cm', 'Ombro 2,0 cm', 'Quadril 0,0 cm', 'Joelho 1,0 cm']);
    // o conector horizontal liga o fio ao ponto
    const conector = de(it, 'reta').filter((r) => r.tracejado);
    expect(conector.length).toBe(3);
    expect(de(it, 'ponto')).toHaveLength(5);
  });

  it('com nível corrigido, o fio de prumo fica vertical na vida real (inclinado na foto)', () => {
    const a = base({ vista: 'perfil', giro: 3, pontos: { 'prumo-perfil': [P(500, 1400)] } });
    const fio = de(itensDaAnalise(a, ESTILO_INSTAGRAM), 'reta').find((r) => !r.tracejado)!;
    const ang = (Math.atan2(fio.b.x - fio.a.x, fio.b.y - fio.a.y) * 180) / Math.PI;
    expect(Math.abs(Math.abs(ang) - 3)).toBeLessThan(0.01);
  });

  it('rótulos e pontos ficam dentro da foto, mesmo com a marcação na borda', () => {
    const a = base({ pontos: { ombros: [P(5, 20), P(990, 10)] } });
    for (const r of de(itensDaAnalise(a, { ...ESTILO_INSTAGRAM, tamanhoRotulo: 70 }), 'rotulo')) {
      expect(r.x - r.largura / 2).toBeGreaterThanOrEqual(-1e-6);
      expect(r.x + r.largura / 2).toBeLessThanOrEqual(1000 + 1e-6);
      expect(r.y - r.altura / 2).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  it('os rótulos ficam por cima de tudo', () => {
    const a = base({ pontos: { ombros: [P(200, 400), P(800, 340)], pelve: [P(220, 900), P(780, 880)] } });
    const tipos = itensDaAnalise(a, ESTILO_INSTAGRAM).map((i) => i.tipo);
    const primeiroRotulo = tipos.indexOf('rotulo');
    expect(tipos.slice(primeiroRotulo).every((t) => t === 'rotulo')).toBe(true);
  });

  it('exclui nível, escala e altura quando pedido', () => {
    const a = base({ pontos: { nivel: [P(0, 0), P(100, 3)], ombros: [P(200, 400), P(800, 340)] } });
    const com = itensDaAnalise(a, ESTILO_INSTAGRAM, { auxiliares: true });
    const sem = itensDaAnalise(a, ESTILO_INSTAGRAM, { auxiliares: false });
    expect(com.length).toBeGreaterThan(sem.length);
  });
});

describe('canvas', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('o pintor cobre os quatro tipos de item e respeita a opacidade do grupo', () => {
    const itens = itensDoAngulo(P(500, 500), P(900, 500), P(500, 900), contextoDesenho(1000, 1000, ESTILO_INSTAGRAM), { graus: 90 });
    const { ctx, chamadas } = ctxFalso(1000, 1000);
    pintarItens(ctx, itens);
    const nomes = chamadas.map((c) => c.fn);
    expect(nomes).toContain('lineTo');
    expect(nomes).toContain('arc');
    expect(nomes).toContain('fillText');
    expect(chamadas.find((c) => c.fn === 'fillText')!.args[0]).toBe('90°');
    const larguras = chamadas.filter((c) => c.fn === 'set:lineWidth').map((c) => c.args[0] as number);
    expect(larguras).toContain(9);
  });

  it('os atalhos do contrato desenham ângulo, reta, rótulo e prumo', () => {
    const { ctx, chamadas } = ctxFalso(1000, 1000);
    desenharAngulo(ctx, P(500, 500), P(900, 500), P(500, 900), ESTILO_INSTAGRAM, 118);
    desenharReta(ctx, P(0, 0), P(100, 100), ESTILO_PADRAO);
    desenharRotulo(ctx, 'Pré', 200, 200, ESTILO_PADRAO);
    desenharPrumo(ctx, P(500, 900), [{ ponto: P(520, 300), rotulo: 'Orelha 2,0 cm' }], ESTILO_INSTAGRAM);
    const textos = chamadas.filter((c) => c.fn === 'fillText').map((c) => c.args[0]);
    expect(textos).toEqual(['118°', 'Pré', 'Orelha 2,0 cm']);
  });

  it('o rótulo do estilo padrão leva contorno de texto; o do Instagram, pílula', () => {
    const a = ctxFalso();
    desenharRotulo(a.ctx, '5,7°', 300, 300, ESTILO_PADRAO);
    expect(a.chamadas.some((c) => c.fn === 'strokeText')).toBe(true);
    const b = ctxFalso();
    desenharRotulo(b.ctx, '118°', 300, 300, ESTILO_INSTAGRAM);
    expect(b.chamadas.some((c) => c.fn === 'strokeText')).toBe(false);
    expect(b.chamadas.some((c) => c.fn === 'fill')).toBe(true);
  });

  describe('foto marcada', () => {
    const imagem = {} as CanvasImageSource;
    const a = base({ imagem, largura: 3000, altura: 4000, pontos: { ombros: [P(600, 1200), P(2400, 1020)] } });

    function simularCanvas() {
      const falso = ctxFalso(3000, 4000);
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
        (falso.ctx as unknown as { canvas: HTMLCanvasElement }).canvas = this;
        return falso.ctx as unknown as RenderingContext;
      } as never);
      return falso;
    }

    it('reduz para o lado máximo, escala o contexto e desenha a foto antes das marcações', () => {
      const { chamadas } = simularCanvas();
      const cv = canvasComMedidas(a, ESTILO_INSTAGRAM, { ladoMax: 2000 })!;
      expect(cv.width).toBe(1500);
      expect(cv.height).toBe(2000);
      const nomes = chamadas.map((c) => c.fn);
      expect(nomes.indexOf('drawImage')).toBeLessThan(nomes.indexOf('scale'));
      expect(chamadas.find((c) => c.fn === 'scale')!.args).toEqual([0.5, 0.5]);
      expect(chamadas.find((c) => c.fn === 'fillText')!.args[0]).toBe('6°');
      // 9 px por 1000 de menor lado, na foto original de 3000
      expect(chamadas.filter((c) => c.fn === 'set:lineWidth').map((c) => c.args[0])).toContain(27);
    });

    it('nunca amplia e aceita limitar pela largura (PDF)', () => {
      simularCanvas();
      expect(canvasComMedidas({ ...a, largura: 800, altura: 600 }, ESTILO_INSTAGRAM)!.width).toBe(800);
      expect(canvasComMedidas(a, ESTILO_INSTAGRAM, { larguraMax: 1100, ladoMax: 5000 })!.width).toBe(1100);
    });

    it('sem foto ou sem canvas devolve null em vez de quebrar', () => {
      expect(canvasComMedidas({ ...a, imagem: null }, ESTILO_INSTAGRAM)).toBeNull();
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
      expect(canvasComMedidas(a, ESTILO_INSTAGRAM)).toBeNull();
    });

    it('o pacote para a arte traz a foto marcada sem rótulos de arte e as medidas', () => {
      simularCanvas();
      const p = analiseDaFotoParaExportar(a, ESTILO_INSTAGRAM, { rotulo: 'Pré', data: '11/10/2026' })!;
      expect(p.paineis).toHaveLength(1);
      expect(p.paineis[0]).toMatchObject({ rotulo: 'Pré', data: '11/10/2026', largura: 2160 * 0.75, altura: 2160 });
      expect(p.medidas).toEqual([{ nome: 'Desnível dos ombros', valor: '6°' }]);
    });

    it('o painel traz também a foto limpa e as marcações em camadas do mesmo tamanho', () => {
      const { chamadas } = simularCanvas();
      const painel = painelParaExportar(a, ESTILO_INSTAGRAM, { rotulo: 'Pós' })!;
      expect(painel.camadas).toBeDefined();
      const { foto, marcacoes } = painel.camadas!;
      for (const cv of [foto, marcacoes]) expect([cv.width, cv.height]).toEqual([painel.largura, painel.altura]);
      expect(new Set([foto, marcacoes, painel.imagem]).size).toBe(3);
      // 3 canvases: a marcada (foto + marcações), a limpa (só a foto) e a das marcações (sem a foto).
      expect(chamadas.filter((c) => c.fn === 'drawImage')).toHaveLength(2);
      expect(chamadas.filter((c) => c.fn === 'fillText')).toHaveLength(2);
    });

    it('sem a foto, o canvas leva só as marcações', () => {
      const { chamadas } = simularCanvas();
      canvasComMedidas(a, ESTILO_INSTAGRAM, { ladoMax: 2000, semFoto: true });
      expect(chamadas.some((c) => c.fn === 'drawImage')).toBe(false);
      expect(chamadas.some((c) => c.fn === 'fillText')).toBe(true);
    });
  });
});
