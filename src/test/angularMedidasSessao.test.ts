import { describe, expect, it } from 'vitest';
import {
  MEDIDAS, SENTIDO, girar, ladoDoDesvio, ladoLateralNaImagem, nomeDoResultado, olhaParaDoContexto, olhaParaDoLado, unidadeDoResultadoId,
  ladoMaisVisivel, type ContextoMedida, type ContextoSugestao, type Medida, type Ponto, type Vista,
} from '@/lib/angular/medidas';
import {
  OPCOES_ANALISE_PADRAO, analiseDeJson, analiseParaJson, calcularResultados, contextoDaAnalise, itensDaAnalise, medidasSalvas, nomeArquivoImagem,
  opcoesPadraoDoLado, type AnaliseFoto,
} from '@/lib/angular/analise';
import { conferirDireitaEsquerda, escolherLadoDoPerfil, pontosAutomaticos, pontosDoPrumo, sugerirPontos, trocarDireitaEsquerda, type Landmark } from '@/lib/angular/pose';
import { parearMedidas } from '@/lib/angular/comparar';
import { ICONE_MEDIDA, LADO_MEDIDA } from '@/components/angular/iconesMedida';
import { ESTILO_PADRAO } from '@/lib/angular/estilo';
import type { ItemDesenho } from '@/lib/angular/desenho';

const P = (x: number, y: number): Ponto => ({ x, y });
const med = (id: string) => MEDIDAS.find((m) => m.id === id)!;
const ctx = (o: Partial<ContextoMedida> = {}): ContextoMedida => ({ cmPorPx: null, ...o });
const de = <T extends ItemDesenho['tipo']>(itens: ItemDesenho[], tipo: T) => itens.filter((i): i is Extract<ItemDesenho, { tipo: T }> => i.tipo === tipo);
const base = (o: Partial<AnaliseFoto> = {}): AnaliseFoto => ({ vista: 'frente', largura: 1000, altura: 1500, pontos: {}, giro: null, cmPorPx: null, opcoes: { ...OPCOES_ANALISE_PADRAO }, ...o });

// Índices do modelo de 33 pontos do MediaPipe, escritos à mão aqui (não vêm do código): "esquerdo" e "direito" são os do paciente.
const I = {
  nariz: 0, olhoE: 2, olhoD: 5, orelhaE: 7, orelhaD: 8, ombroE: 11, ombroD: 12, cotoveloE: 13, cotoveloD: 14, punhoE: 15, punhoD: 16,
  quadrilE: 23, quadrilD: 24, joelhoE: 25, joelhoD: 26, tornozeloE: 27, tornozeloD: 28,
} as const;

/** 33 pontos invisíveis; `sobre` põe pontos (x, y e visibilidade, padrão 0,9). */
function pontosDoModelo(sobre: Record<number, [number, number, number?]>, fundo = 0): Landmark[] {
  const a: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: fundo }));
  for (const [i, [x, y, v]] of Object.entries(sobre)) a[Number(i)] = { x, y, visibility: v ?? 0.9 };
  return a;
}

// Fotos de 1024 x 2048 px, com frações de 1/16 para os produtos saírem exatos.
const W = 1024, H = 2048;
const CORPO: Record<keyof typeof I, [number, number]> = {
  nariz: [0.5, 0.0625], olhoE: [0.53125, 0.0625], olhoD: [0.46875, 0.0625], orelhaE: [0.5625, 0.0625], orelhaD: [0.4375, 0.0625],
  ombroE: [0.625, 0.25], ombroD: [0.375, 0.25], cotoveloE: [0.6875, 0.375], cotoveloD: [0.3125, 0.375], punhoE: [0.6875, 0.5], punhoD: [0.3125, 0.5],
  quadrilE: [0.5625, 0.5], quadrilD: [0.4375, 0.5], joelhoE: [0.5625, 0.75], joelhoD: [0.4375, 0.75], tornozeloE: [0.5625, 0.875], tornozeloD: [0.4375, 0.875],
};

/** Corpo inteiro de frente (direito do paciente à esquerda da imagem) ou de costas (à direita). */
function corpo(vista: 'frente' | 'costas', sem: (keyof typeof I)[] = []): Landmark[] {
  const sobre: Record<number, [number, number]> = {};
  for (const [nome, [x, y]] of Object.entries(CORPO) as [keyof typeof I, [number, number]][]) {
    if (sem.includes(nome)) continue;
    const lateral = nome.endsWith('D') || nome.endsWith('E');
    sobre[I[nome]] = [vista === 'costas' && lateral ? 1 - x : x, y];
  }
  return pontosDoModelo(sobre);
}

describe('lado do perfil e para onde o paciente olha', () => {
  it('perfil direito: a câmera está do lado direito do paciente e a frente dele aparece à direita da imagem; perfil esquerdo, à esquerda', () => {
    // Paciente de frente para o norte; a câmera no leste (lado direito dele) olha para o oeste; quem olha para o oeste tem o norte à sua direita.
    expect(olhaParaDoLado('D')).toBe('direita');
    expect(olhaParaDoLado('E')).toBe('esquerda');
  });

  it('o "olha para" do contexto manda; sem ele, decorre do lado; sem os dois, não há resposta', () => {
    expect(olhaParaDoContexto(ctx({ lado: 'D' }))).toBe('direita');
    expect(olhaParaDoContexto(ctx({ lado: 'E' }))).toBe('esquerda');
    expect(olhaParaDoContexto(ctx({ lado: 'D', olhaPara: 'esquerda' }))).toBe('esquerda');
    expect(olhaParaDoContexto(ctx())).toBeUndefined();
    expect(olhaParaDoContexto(undefined)).toBeUndefined();
  });

  it('o padrão das opções vem do lado; sem lado, o padrão de sempre', () => {
    expect(opcoesPadraoDoLado('E').olhaPara).toBe('esquerda');
    expect(opcoesPadraoDoLado('D').olhaPara).toBe('direita');
    expect(opcoesPadraoDoLado()).toEqual(OPCOES_ANALISE_PADRAO);
    expect(opcoesPadraoDoLado('E').unidadePrumo).toBe('graus');
  });

  it('a análise guarda o lado só no perfil e o repassa ao contexto das medidas', () => {
    const d = base({ vista: 'perfil', lado: 'D' });
    expect(contextoDaAnalise(d).lado).toBe('D');
    expect('lado' in contextoDaAnalise(base({ vista: 'perfil' }))).toBe(false);
    expect('lado' in contextoDaAnalise({ ...base({ vista: 'frente' }), lado: 'D' })).toBe(false);
    expect(analiseParaJson(d).lado).toBe('D');
  });

  it('lê o lado do JSON: só D ou E, só no perfil; nota antiga sem lado continua sem lado', () => {
    const bruto = (o: Record<string, unknown>) => ({ largura: 10, altura: 20, ...o });
    expect(analiseDeJson(bruto({ vista: 'perfil', lado: 'E' }))!.lado).toBe('E');
    expect(analiseDeJson(bruto({ vista: 'perfil', lado: 'esquerdo' }))!.lado).toBeUndefined();
    expect(analiseDeJson(bruto({ vista: 'frente', lado: 'D' }))!.lado).toBeUndefined();
    const antiga = analiseDeJson(bruto({ vista: 'perfil', opcoes: { olhaPara: 'direita' } }))!;
    expect('lado' in antiga).toBe(false);
    expect(antiga.opcoes.olhaPara).toBe('direita');
  });

  it('sem "olha para" gravado, o JSON deriva do lado; o que o profissional escolheu continua valendo', () => {
    const bruto = (o: Record<string, unknown>) => ({ largura: 10, altura: 20, vista: 'perfil', ...o });
    expect(analiseDeJson(bruto({ lado: 'E' }))!.opcoes.olhaPara).toBe('esquerda');
    expect(analiseDeJson(bruto({ lado: 'D' }))!.opcoes.olhaPara).toBe('direita');
    expect(analiseDeJson(bruto({ lado: 'E', opcoes: { olhaPara: 'direita' } }))!.opcoes.olhaPara).toBe('direita');
    expect(analiseDeJson(bruto({}))!.opcoes.olhaPara).toBe('direita');
  });

  it('o nome do arquivo leva o lado no perfil e continua igual sem ele', () => {
    const dia = new Date('2026-10-11T15:00:00Z');
    expect(nomeArquivoImagem('perfil', dia, 'png', 'D')).toBe('analise-angular-perfil-direito-2026-10-11.png');
    expect(nomeArquivoImagem('perfil', dia, 'jpg', 'E')).toBe('analise-angular-perfil-esquerdo-2026-10-11.jpg');
    expect(nomeArquivoImagem('perfil', dia)).toBe('analise-angular-perfil-2026-10-11.png');
    expect(nomeArquivoImagem('frente', dia, 'png', 'D')).toBe('analise-angular-frente-2026-10-11.png');
  });

  it('o fio de prumo de perfil usa o lado quando o "olha para" não vem', () => {
    const pts = [P(100, 500), P(130, 100), P(120, 200), P(100, 300), P(95, 400)];
    const e = med('prumo-perfil').calcularVarios!(pts, ctx({ cmPorPx: 0.5, unidadePrumo: 'cm', lado: 'E' }));
    expect(e[0].valor).toBeCloseTo(-15, 6);
    expect(e[0].texto).toContain('olhando para a esquerda da imagem');
    const d = med('prumo-perfil').calcularVarios!(pts, ctx({ cmPorPx: 0.5, unidadePrumo: 'cm', lado: 'D' }));
    expect(d[0].valor).toBeCloseTo(15, 6);
    const antigo = med('prumo-perfil').calcularVarios!(pts, ctx({ cmPorPx: 0.5, unidadePrumo: 'cm' }));
    expect(antigo[0].valor).toBeCloseTo(15, 6);
  });
});

describe('o lado de fora do membro na imagem e o desvio de um segmento', () => {
  it('de frente o lado direito do paciente aparece à esquerda da imagem; de costas, à direita', () => {
    expect(ladoLateralNaImagem('D', 'frente')).toBe('esquerda');
    expect(ladoLateralNaImagem('E', 'frente')).toBe('direita');
    expect(ladoLateralNaImagem('D', 'costas')).toBe('direita');
    expect(ladoLateralNaImagem('E', 'costas')).toBe('esquerda');
  });

  it('diz para que lado da imagem o segmento de baixo sai do prolongamento do de cima, com o de cima para baixo ou para cima', () => {
    expect(ladoDoDesvio(P(0, 100), P(-10, 100))).toBe('esquerda');
    expect(ladoDoDesvio(P(0, 100), P(10, 100))).toBe('direita');
    expect(ladoDoDesvio(P(0, -100), P(-10, -100))).toBe('esquerda');
    expect(ladoDoDesvio(P(0, -100), P(10, -100))).toBe('direita');
    expect(ladoDoDesvio(P(0, 100), P(0, 50))).toBeNull();
    expect(ladoDoDesvio(P(100, 0), P(100, 10))).toBeNull();
  });

  it('com o segmento de cima a 45° ou mais da vertical (deitado na foto), não diz o lado', () => {
    // 45° exatos e 45,3° da vertical: nulo. 44,7° da vertical: o de baixo, mais inclinado para baixo, sai para a esquerda da imagem.
    expect(ladoDoDesvio(P(100, 100), P(80, 140))).toBeNull();
    expect(ladoDoDesvio(P(100, 99), P(80, 140))).toBeNull();
    expect(ladoDoDesvio(P(99, 100), P(80, 120))).toBe('esquerda');
    expect(ladoDoDesvio(P(-99, 100), P(-80, 120))).toBe('direita');
    expect(ladoDoDesvio(P(-100, -100), P(-80, -140))).toBeNull();
  });

  it('o vocabulário de sentido é fixo (o comparador pareia as avaliações por essas palavras)', () => {
    expect(Object.values(SENTIDO)).toEqual([
      'valgo', 'varo', 'flexão', 'hiperextensão', 'afastado do tronco', 'junto do tronco',
      'cotovelo à frente', 'cotovelo atrás', 'joelho à frente', 'joelho atrás', 'mão para fora', 'mão para dentro',
    ]);
  });
});

describe('joelho de frente e de costas: valgo e varo, os 4 casos D/E x vista', () => {
  // Coxa de (300,0) até o joelho e perna até (300,200). Joelho com 10 px de deslocamento para o lado: 2 x atan(0,1) = 11,4212° de afastamento.
  const pernaComJoelhoEm = (id: 'joelho-d' | 'joelho-e', vista: 'frente' | 'costas', xJoelho: number) =>
    med(id).calcular([P(300, 0), P(xJoelho, 100), P(300, 200)], ctx({ vista }))!;

  it('frente, perna direita (metade esquerda da imagem): joelho para o centro do corpo, à direita da imagem, é valgo', () => {
    const r = pernaComJoelhoEm('joelho-d', 'frente', 310);
    expect(r.sentido).toBe('valgo');
    expect(r.valor).toBeCloseTo(168.5788, 3);
    expect(r.texto).toContain('Joelho direito, quadril–joelho–tornozelo: 168,6° (11,4° de afastamento da linha reta), em valgo (joelho para dentro da linha quadril–tornozelo).');
    expect(pernaComJoelhoEm('joelho-d', 'frente', 290).sentido).toBe('varo');
  });

  it('frente, perna esquerda (metade direita da imagem): joelho para o centro do corpo, à esquerda da imagem, é valgo', () => {
    expect(pernaComJoelhoEm('joelho-e', 'frente', 290).sentido).toBe('valgo');
    const varo = pernaComJoelhoEm('joelho-e', 'frente', 310);
    expect(varo.sentido).toBe('varo');
    expect(varo.texto).toContain('em varo (joelho para fora da linha quadril–tornozelo)');
  });

  it('costas, perna direita (metade direita da imagem): joelho para o centro do corpo, à esquerda da imagem, é valgo', () => {
    expect(pernaComJoelhoEm('joelho-d', 'costas', 290).sentido).toBe('valgo');
    expect(pernaComJoelhoEm('joelho-d', 'costas', 310).sentido).toBe('varo');
  });

  it('costas, perna esquerda (metade esquerda da imagem): joelho para o centro do corpo, à direita da imagem, é valgo', () => {
    expect(pernaComJoelhoEm('joelho-e', 'costas', 310).sentido).toBe('valgo');
    expect(pernaComJoelhoEm('joelho-e', 'costas', 290).sentido).toBe('varo');
  });

  it('o valor continua sendo o ângulo interno (compatível com as notas antigas) e o sentido não vai ao valor', () => {
    expect(pernaComJoelhoEm('joelho-d', 'frente', 310).valor).toBeCloseTo(pernaComJoelhoEm('joelho-d', 'frente', 290).valor, 6);
  });

  it('sem a vista no contexto (chamada antiga) ou com a perna reta, não inventa lado', () => {
    const antigo = med('joelho-d').calcular([P(300, 0), P(310, 100), P(300, 200)])!;
    expect(antigo.sentido).toBeUndefined();
    expect(antigo.texto).toBe('Joelho direito, quadril–joelho–tornozelo: 168,6° (11,4° de afastamento da linha reta).');
    const reta = med('joelho-e').calcular([P(300, 0), P(300, 100), P(300, 200)], ctx({ vista: 'frente' }))!;
    expect(reta.sentido).toBeUndefined();
    expect(reta.valor).toBeCloseTo(180, 6);
  });

  it('a diferença de lado entre duas avaliações vira "lado trocado" no comparador, sem subtrair', () => {
    const a = (xJoelho: number): AnaliseFoto => base({ vista: 'frente', pontos: { 'joelho-d': [P(300, 0), P(xJoelho, 100), P(300, 200)] } });
    const antes = medidasSalvas(calcularResultados(a(310)));
    const depois = medidasSalvas(calcularResultados(a(290)));
    const [linha] = parearMedidas(antes, depois);
    expect(antes[0].sentido).toBe('valgo');
    expect(depois[0].sentido).toBe('varo');
    expect(linha.motivo).toBe('lado-trocado');
    expect(linha.diferenca).toBeNull();
    expect(parearMedidas(antes, antes)[0].diferenca).toBe(0);
  });
});

describe('joelho de perfil: flexão e hiperextensão', () => {
  // Quadril (100,0), tornozelo (100,200); o joelho 10 px à frente ou atrás da linha.
  const joelhoEm = (xJoelho: number, c: Partial<ContextoMedida>) => med('joelho').calcular([P(100, 0), P(xJoelho, 100), P(100, 200)], ctx(c))!;

  it('olhando para a direita da imagem, joelho à direita da linha é flexão e à esquerda é hiperextensão', () => {
    const f = joelhoEm(110, { olhaPara: 'direita' });
    expect(f.sentido).toBe('flexão');
    expect(f.valor).toBeCloseTo(168.5788, 3);
    expect(f.texto).toBe('Ângulo quadril–joelho–tornozelo: 168,6° (11,4° de afastamento da linha reta), em flexão (joelho à frente da linha quadril–tornozelo).');
    expect(joelhoEm(90, { olhaPara: 'direita' }).sentido).toBe('hiperextensão');
  });

  it('olhando para a esquerda da imagem os lados se invertem', () => {
    expect(joelhoEm(90, { olhaPara: 'esquerda' }).sentido).toBe('flexão');
    const h = joelhoEm(110, { olhaPara: 'esquerda' });
    expect(h.sentido).toBe('hiperextensão');
    expect(h.texto).toContain('em hiperextensão (joelho atrás da linha quadril–tornozelo)');
  });

  it('pelo lado do perfil, quando o "olha para" não vem (D olha para a direita, E para a esquerda)', () => {
    expect(joelhoEm(110, { lado: 'D' }).sentido).toBe('flexão');
    expect(joelhoEm(110, { lado: 'E' }).sentido).toBe('hiperextensão');
  });

  it('sem lado nem "olha para", ou com a perna reta, não diz o sentido e mantém o texto de antes', () => {
    const r = joelhoEm(110, {});
    expect(r.sentido).toBeUndefined();
    expect(r.texto).toBe('Ângulo quadril–joelho–tornozelo: 168,6° (11,4° de afastamento da linha reta).');
    expect(joelhoEm(100, { olhaPara: 'direita' }).sentido).toBeUndefined();
  });
});

describe('alinhamento do braço (ombro–cotovelo contra a vertical)', () => {
  // Ombro em (300,100); cotovelo 200 px abaixo e 20 px para o lado: atan(0,1) = 5,7106° com a vertical.
  const braco = (id: 'braco-d' | 'braco-e', xCotovelo: number, c: Partial<ContextoMedida>, yCotovelo = 300) =>
    med(id).calcular([P(300, 100), P(xCotovelo, yCotovelo)], ctx(c))!;

  it('de frente: braço direito com o cotovelo para a esquerda da imagem (para fora do corpo) está afastado do tronco', () => {
    const r = braco('braco-d', 280, { vista: 'frente' });
    expect(r.valor).toBeCloseTo(5.7106, 3);
    expect(r.sentido).toBe('afastado do tronco');
    expect(r.texto).toBe('Braço direito: 5,7° com a vertical (reta ombro–cotovelo), cotovelo afastado do tronco.');
    expect(braco('braco-d', 320, { vista: 'frente' }).sentido).toBe('junto do tronco');
  });

  it('de frente: braço esquerdo com o cotovelo para a direita da imagem está afastado', () => {
    expect(braco('braco-e', 320, { vista: 'frente' }).sentido).toBe('afastado do tronco');
    expect(braco('braco-e', 280, { vista: 'frente' }).sentido).toBe('junto do tronco');
  });

  it('de costas os lados da imagem se invertem', () => {
    expect(braco('braco-d', 320, { vista: 'costas' }).sentido).toBe('afastado do tronco');
    expect(braco('braco-d', 280, { vista: 'costas' }).sentido).toBe('junto do tronco');
    expect(braco('braco-e', 280, { vista: 'costas' }).sentido).toBe('afastado do tronco');
    expect(braco('braco-e', 320, { vista: 'costas' }).sentido).toBe('junto do tronco');
  });

  it('de perfil: cotovelo à frente ou atrás do ombro, conforme para onde o paciente olha ou o lado', () => {
    const frente = braco('braco-d', 320, { vista: 'perfil', olhaPara: 'direita' });
    expect(frente.sentido).toBe('cotovelo à frente');
    expect(frente.texto).toContain('cotovelo à frente do ombro.');
    expect(braco('braco-d', 280, { vista: 'perfil', olhaPara: 'direita' }).sentido).toBe('cotovelo atrás');
    expect(braco('braco-d', 320, { vista: 'perfil', olhaPara: 'esquerda' }).sentido).toBe('cotovelo atrás');
    expect(braco('braco-e', 280, { vista: 'perfil', lado: 'E' }).sentido).toBe('cotovelo à frente');
  });

  it('vai de 0° (para baixo) a 180° (para cima) e só diz o lado quando há desvio', () => {
    expect(braco('braco-d', 300, { vista: 'frente' }).valor).toBeCloseTo(0, 6);
    expect(braco('braco-d', 300, { vista: 'frente' }).sentido).toBeUndefined();
    expect(braco('braco-d', 500, { vista: 'frente' }, 100).valor).toBeCloseTo(90, 6);
    expect(braco('braco-d', 400, { vista: 'frente' }, 0).valor).toBeCloseTo(135, 6);
    const cima = braco('braco-d', 300, { vista: 'frente' }, -100);
    expect(cima.valor).toBeCloseTo(180, 6);
    expect(cima.sentido).toBeUndefined();
  });

  it('sem a vista, mede mas não diz o lado', () => {
    const r = braco('braco-d', 280, {});
    expect(r.valor).toBeCloseTo(5.7106, 3);
    expect(r.sentido).toBeUndefined();
    expect(r.texto).toBe('Braço direito: 5,7° com a vertical (reta ombro–cotovelo).');
  });

  it('existe nas três vistas e sai desenhado contra a vertical para baixo, também com o braço acima do ombro', () => {
    expect(med('braco-d').vistas).toEqual(['frente', 'costas', 'perfil']);
    const normal = itensDaAnalise(base({ pontos: { 'braco-d': [P(300, 100), P(320, 300)] } }), ESTILO_PADRAO);
    expect(de(normal, 'rotulo')[0].texto).toBe('5,7°');
    expect((Math.abs(de(normal, 'arco')[0].delta) * 180) / Math.PI).toBeCloseTo(5.7106, 3);
    const ref = de(normal, 'reta').find((r) => r.tracejado)!;
    expect(ref.a).toEqual(P(300, 100));
    expect(ref.b.x).toBeCloseTo(300, 6);
    expect(ref.b.y).toBeGreaterThan(100);
    // Cotovelo acima do ombro: o arco precisa varrer os mesmos 135° do rótulo, com o vértice no ombro.
    const alto = itensDaAnalise(base({ pontos: { 'braco-d': [P(300, 100), P(400, 0)] } }), ESTILO_PADRAO);
    expect(de(alto, 'rotulo')[0].texto).toBe('135,0°');
    expect((Math.abs(de(alto, 'arco')[0].delta) * 180) / Math.PI).toBeCloseTo(135, 3);
    expect(de(alto, 'arco')[0].centro).toEqual(P(300, 100));
  });

  it('com a foto torta, a referência vertical acompanha o nível e o valor sai corrigido', () => {
    const a = base({ giro: 4, pontos: { 'braco-d': [P(300, 100), P(300, 300)] } });
    expect(calcularResultados(a)[0].valor).toBeCloseTo(4, 4);
    const ref = de(itensDaAnalise(a, ESTILO_PADRAO), 'reta').find((r) => r.tracejado)!;
    expect(Math.abs((Math.atan2(ref.b.x - ref.a.x, ref.b.y - ref.a.y) * 180) / Math.PI)).toBeCloseTo(4, 3);
  });
});

describe('flexão e extensão do cotovelo (perfil)', () => {
  // Braço do ombro (0,0) ao cotovelo (0,100).
  const cotovelo = (punho: Ponto, c: Partial<ContextoMedida>) => med('cotovelo-perfil').calcular([P(0, 0), P(0, 100), punho], ctx(c))!;

  it('olhando para a direita, o antebraço que sobe para a frente é flexão (0° = braço estendido)', () => {
    // antebraço (60,−40): 90° do braço mais 33,69° acima da horizontal = 123,69°
    const r = cotovelo(P(60, 60), { olhaPara: 'direita' });
    expect(r.valor).toBeCloseTo(123.6901, 3);
    expect(r.sentido).toBe('flexão');
    expect(r.texto).toBe('Cotovelo: 123,7° de flexão (0° = braço estendido).');
  });

  it('o antebraço que vai para trás do prolongamento do braço é hiperextensão', () => {
    const r = cotovelo(P(-20, 190), { olhaPara: 'direita' });
    expect(r.valor).toBeCloseTo(12.5288, 3);
    expect(r.sentido).toBe('hiperextensão');
    expect(r.texto).toContain('12,5° de hiperextensão');
  });

  it('olhando para a esquerda os lados se invertem, e o lado do perfil basta quando não há "olha para"', () => {
    expect(cotovelo(P(60, 60), { olhaPara: 'esquerda' }).sentido).toBe('hiperextensão');
    expect(cotovelo(P(-60, 60), { olhaPara: 'esquerda' }).sentido).toBe('flexão');
    expect(cotovelo(P(60, 60), { lado: 'D' }).sentido).toBe('flexão');
    expect(cotovelo(P(60, 60), { lado: 'E' }).sentido).toBe('hiperextensão');
  });

  it('com o braço apontando para a frente, a flexão continua sendo o mesmo giro', () => {
    // Ombro (0,0), cotovelo (100,0): braço para a frente. Mão subindo (100,−60): giro anti-horário na tela = flexão olhando para a direita.
    const r = med('cotovelo-perfil').calcular([P(0, 0), P(100, 0), P(100, -60)], ctx({ olhaPara: 'direita' }))!;
    expect(r.sentido).toBe('flexão');
    expect(r.valor).toBeCloseTo(90, 6);
  });

  it('braço estendido dá 0° sem lado; sem "olha para", mede e não diz o lado', () => {
    const reto = cotovelo(P(0, 200), { olhaPara: 'direita' });
    expect(reto.valor).toBe(0);
    expect(reto.sentido).toBeUndefined();
    const sem = cotovelo(P(60, 60), {});
    expect(sem.sentido).toBeUndefined();
    expect(sem.valor).toBeCloseTo(123.6901, 3);
  });

  it('só existe no perfil', () => {
    expect(med('cotovelo-perfil').vistas).toEqual(['perfil']);
  });
});

describe('ângulo de carregamento do cotovelo (estimativa por foto, só à mão)', () => {
  // Braço do ombro (300,0) ao cotovelo (300,200); antebraço até o punho. Desvio de 10 em 200 px: atan(0,05) = 2,8624°.
  const carga = (id: 'carregamento-d' | 'carregamento-e', xPunho: number, c: Partial<ContextoMedida> = { vista: 'frente' }) =>
    med(id).calcular([P(300, 0), P(300, 200), P(xPunho, 400)], ctx(c))!;

  it('braço direito de frente: antebraço para a esquerda da imagem (para fora do corpo) é valgo; para a direita é varo', () => {
    const r = carga('carregamento-d', 290);
    expect(r.valor).toBeCloseTo(2.8624, 3);
    expect(r.sentido).toBe('valgo');
    expect(r.texto).toBe('Ângulo de carregamento do cotovelo direito (estimativa por foto): 2,9° em valgo (antebraço desviado para fora do prolongamento do braço). Confirmar com goniômetro.');
    expect(carga('carregamento-d', 310).sentido).toBe('varo');
  });

  it('braço esquerdo de frente: antebraço para a direita da imagem é valgo; para a esquerda é varo', () => {
    expect(carga('carregamento-e', 310).sentido).toBe('valgo');
    const varo = carga('carregamento-e', 290);
    expect(varo.sentido).toBe('varo');
    expect(varo.texto).toContain('em varo (antebraço desviado para dentro do prolongamento do braço)');
  });

  it('o mesmo cuidado de sinal por vista: de costas os lados da imagem se invertem', () => {
    expect(carga('carregamento-d', 310, { vista: 'costas' }).sentido).toBe('valgo');
    expect(carga('carregamento-e', 290, { vista: 'costas' }).sentido).toBe('valgo');
  });

  it('antebraço alinhado: 0° e sem lado', () => {
    const r = carga('carregamento-d', 300);
    expect(r.valor).toBeCloseTo(0, 6);
    expect(r.sentido).toBeUndefined();
  });

  it('com o braço deitado na foto, mede mas não diz valgo nem varo, e não afirma que está alinhado', () => {
    const r = med('carregamento-d').calcular([P(0, 300), P(200, 300), P(200, 310)], ctx({ vista: 'frente' }))!;
    expect(r.valor).toBeCloseTo(90, 6);
    expect(r.sentido).toBeUndefined();
    expect(r.texto).toBe('Ângulo de carregamento do cotovelo direito (estimativa por foto): 90,0° entre o prolongamento do braço e o antebraço (sem lado: o braço está deitado na foto). Confirmar com goniômetro.');
  });

  it('não tem sugestão automática, só existe de frente e a definição pede conferência com goniômetro', () => {
    for (const id of ['carregamento-d', 'carregamento-e']) {
      const m = med(id);
      expect(m.vistas).toEqual(['frente']);
      expect(m.sugerir).toBeUndefined();
      expect(m.semAuto).toBe(true);
      expect(m.motivoSemAuto).toBeTruthy();
      expect(m.definicao).toContain('Estimativa por foto, com o cotovelo estendido e a palma para a frente: confirmar com goniômetro');
      expect(m.nome).toContain('estimativa por foto');
    }
    expect(Object.keys(sugerirPontos(corpo('frente'), 'frente', W, H).sugeridos)).not.toContain('carregamento-d');
  });
});

describe('alinhamento antebraço-mão (só à mão)', () => {
  // Antebraço do cotovelo (300,0) ao punho (300,200); eixo da mão até (xMao,300): desvio de 10 em 100 px = atan(0,1) = 5,7106°.
  const punho = (id: 'punho-d' | 'punho-e', xMao: number, c: Partial<ContextoMedida>) =>
    med(id).calcular([P(300, 0), P(300, 200), P(xMao, 300)], ctx(c))!;

  it('de frente: mão do braço direito desviada para a esquerda da imagem está para fora; para a direita, para dentro', () => {
    const r = punho('punho-d', 290, { vista: 'frente' });
    expect(r.valor).toBeCloseTo(5.7106, 3);
    expect(r.sentido).toBe('mão para fora');
    expect(r.texto).toContain('mão desviada para fora');
    expect(punho('punho-d', 310, { vista: 'frente' }).sentido).toBe('mão para dentro');
  });

  it('de frente o braço esquerdo e, de costas, os dois lados se invertem', () => {
    expect(punho('punho-e', 310, { vista: 'frente' }).sentido).toBe('mão para fora');
    expect(punho('punho-d', 310, { vista: 'costas' }).sentido).toBe('mão para fora');
    expect(punho('punho-e', 290, { vista: 'costas' }).sentido).toBe('mão para fora');
    expect(punho('punho-e', 310, { vista: 'costas' }).sentido).toBe('mão para dentro');
  });

  it('com o antebraço deitado na foto (cotovelo dobrado), mede e não diz para fora nem para dentro', () => {
    const r = med('punho-d').calcular([P(0, 300), P(200, 300), P(300, 310)], ctx({ vista: 'frente' }))!;
    expect(r.valor).toBeCloseTo(5.7106, 3);
    expect(r.sentido).toBeUndefined();
    expect(r.texto).toBe('Antebraço–mão direito: 5,7° entre o prolongamento do antebraço e o eixo da mão.');
  });

  it('sem a vista, mede e não diz o lado; é só à mão e avisa da rotação do antebraço', () => {
    const r = punho('punho-d', 290, {});
    expect(r.sentido).toBeUndefined();
    expect(r.valor).toBeCloseTo(5.7106, 3);
    const m = med('punho-d');
    expect(m.vistas).toEqual(['frente', 'costas']);
    expect(m.sugerir).toBeUndefined();
    expect(m.semAuto).toBe(true);
    expect(m.pontos[2]).toMatch(/3º metacarpo/);
    expect(m.definicao).toMatch(/rotação do antebraço/);
  });
});

describe('desníveis novos (cotovelos, quadris, joelhos, tornozelos, escápulas)', () => {
  // Ponto direito 20 px mais alto que o esquerdo, a 200 px de distância: atan(0,1) = 5,7106°.
  const dir = [P(100, 380), P(300, 400)];
  const esq = [P(100, 400), P(300, 380)];

  it.each([
    ['cotovelos', 'Linha dos cotovelos', 'frente'],
    ['quadris', 'Linha dos quadris', 'costas'],
    ['linha-joelhos', 'Linha dos joelhos', 'frente'],
    ['linha-tornozelos', 'Linha dos tornozelos', 'costas'],
    ['escapulas', 'Linha dos ângulos inferiores das escápulas', 'costas'],
  ] as const)('%s: o lado mais alto é o do paciente, como nos ombros', (id, linha, vista) => {
    const d = med(id).calcular(dir as Ponto[], ctx({ vista }))!;
    expect(d.valor).toBeCloseTo(5.7106, 3);
    expect(d.texto).toBe(`${linha}: 5,7° com a horizontal, lado direito mais alto.`);
    expect(med(id).calcular(esq as Ponto[], ctx({ vista }))!.texto).toContain('lado esquerdo mais alto');
    expect(med(id).calcular([P(100, 400), P(300, 400)])!.texto).toBe(`${linha} nivelada (0,0°).`);
  });

  it('o comparador lê o lado do texto (o mesmo desnível com o lado trocado não é subtraído)', () => {
    const marca = (pontos: Ponto[]) => medidasSalvas(calcularResultados(base({ vista: 'costas', pontos: { escapulas: pontos } })));
    const [linha] = parearMedidas(marca(dir as Ponto[]), marca(esq as Ponto[]));
    expect(linha.motivo).toBe('lado-trocado');
  });

  it('vistas certas: escápulas só de costas; quadris e linhas de frente e de costas', () => {
    expect(med('escapulas').vistas).toEqual(['costas']);
    for (const id of ['cotovelos', 'quadris', 'linha-joelhos', 'linha-tornozelos']) expect(med(id).vistas).toEqual(['frente', 'costas']);
  });
});

describe('quadris (automática) separados da pelve (cristas, à mão)', () => {
  it('a pelve deixa de ser sugerida com o centro do quadril; a linha dos quadris é a sugerida', () => {
    expect(med('pelve').sugerir).toBeUndefined();
    expect(med('pelve').semAuto).toBe(true);
    expect(med('pelve').pontos[0]).toMatch(/Crista ilíaca/);
    expect(med('quadris').sugerir).toBeDefined();
    expect(med('quadris').nome).toBe('Linha dos quadris (sugerida pelo modelo)');
    const r = pontosAutomaticos(corpo('frente'), 'frente', W, H);
    expect(r.quadris).toEqual([P(448, 1024), P(576, 1024)]);
    expect(r.pelve).toBeUndefined();
  });

  it('o nome dos resultados diz qual é qual', () => {
    expect(nomeDoResultado('pelve')).toBe('Desnível da pelve');
    expect(nomeDoResultado('quadris')).toBe('Linha dos quadris (sugerida pelo modelo)');
  });
});

describe('ombros também em centímetros, quando há escala', () => {
  const pontos = { ombros: [P(100, 380), P(300, 400)] };

  it('devolve o desnível em cm depois do desnível em graus, com o lado e a ressalva do plano', () => {
    const r = calcularResultados(base({ pontos, cmPorPx: 0.5 }));
    expect(r.map((x) => x.id)).toEqual(['ombros', 'ombros-cm']);
    expect(r[0].unidade).toBe('graus');
    expect(r[1].unidade).toBe('cm');
    expect(r[1].valor).toBeCloseTo(10, 6);
    expect(r[1].nome).toBe('Desnível dos ombros (cm)');
    expect(r[1].medidaId).toBe('ombros');
    expect(r[1].texto).toBe('Linha dos ombros: diferença de altura de 10,0 cm, lado direito mais alto (estimativa pela escala marcada; vale para pontos à mesma distância da câmera).');
  });

  it('sem escala, só os graus (como antes)', () => {
    expect(calcularResultados(base({ pontos })).map((x) => x.id)).toEqual(['ombros']);
  });

  it('ombros nivelados: 0,0 cm sem lado', () => {
    const r = calcularResultados(base({ pontos: { ombros: [P(100, 400), P(300, 400)] }, cmPorPx: 0.5 }));
    expect(r[1].valor).toBe(0);
    expect(r[1].texto).toBe('Linha dos ombros nivelada (0,0 cm).');
  });

  it('o nível corrigido vale para os centímetros também', () => {
    const girados = base({ giro: 3, cmPorPx: 0.5, pontos: { ombros: [girar(P(100, 400), 3), girar(P(300, 400), 3)] } });
    const r = calcularResultados(girados);
    expect(r[0].valor).toBeCloseTo(0, 3);
    expect(r[1].valor).toBeCloseTo(0, 2);
  });

  it('o id, o nome e a unidade do extra são reconhecidos e o rótulo da foto continua sendo o dos graus', () => {
    expect(nomeDoResultado('ombros-cm')).toBe('Desnível dos ombros (cm)');
    expect(unidadeDoResultadoId('ombros-cm')).toBe('cm');
    expect(unidadeDoResultadoId('ombros')).toBe('graus');
    const salvas = medidasSalvas(calcularResultados(base({ pontos, cmPorPx: 0.5 })));
    expect(salvas[1]).toMatchObject({ id: 'ombros-cm', graus: 10, unidade: 'cm' });
    expect('sentido' in salvas[1]).toBe(false);
    const rotulos = de(itensDaAnalise(base({ pontos, cmPorPx: 0.5 }), ESTILO_PADRAO), 'rotulo');
    expect(rotulos.map((r) => r.texto)).toEqual(['5,7°']);
  });

  it('a diferença em cm entre duas avaliações respeita o lado lido do texto', () => {
    const marca = (p: Ponto[]) => medidasSalvas(calcularResultados(base({ pontos: { ombros: p }, cmPorPx: 0.5 })));
    const linhas = parearMedidas(marca([P(100, 380), P(300, 400)]), marca([P(100, 400), P(300, 380)]));
    expect(linhas.map((l) => l.id)).toEqual(['ombros', 'ombros-cm']);
    expect(linhas.every((l) => l.motivo === 'lado-trocado')).toBe(true);
    const mesmo = parearMedidas(marca([P(100, 380), P(300, 400)]), marca([P(100, 390), P(300, 400)]));
    expect(mesmo[1].diferenca).toBe(-5);
  });
});

describe('perna contra a vertical (perfil)', () => {
  // Joelho (500,500), tornozelo 400 px abaixo e 20 px para o lado: atan(0,05) = 2,8624°.
  const perna = (xTornozelo: number, c: Partial<ContextoMedida>) => med('perna-vertical').calcular([P(500, 500), P(xTornozelo, 900)], ctx(c))!;

  it('olhando para a direita, tornozelo à direita do joelho significa joelho atrás; à esquerda, joelho à frente', () => {
    const r = perna(520, { olhaPara: 'direita' });
    expect(r.valor).toBeCloseTo(2.8624, 3);
    expect(r.sentido).toBe('joelho atrás');
    expect(r.texto).toBe('Perna: 2,9° com a vertical (reta joelho–tornozelo), joelho atrás do tornozelo.');
    expect(perna(480, { olhaPara: 'direita' }).sentido).toBe('joelho à frente');
  });

  it('olhando para a esquerda ou pelo lado, os sentidos se invertem', () => {
    expect(perna(520, { olhaPara: 'esquerda' }).sentido).toBe('joelho à frente');
    expect(perna(520, { lado: 'E' }).sentido).toBe('joelho à frente');
    expect(perna(520, { lado: 'D' }).sentido).toBe('joelho atrás');
  });

  it('perna na vertical ou sem lado: mede e não diz o sentido; só existe no perfil', () => {
    expect(perna(500, { olhaPara: 'direita' }).sentido).toBeUndefined();
    expect(perna(520, {}).sentido).toBeUndefined();
    expect(med('perna-vertical').vistas).toEqual(['perfil']);
  });
});

describe('cifose e lordose: estimativa de superfície, não é Cobb', () => {
  // Reta de cima horizontal; a de baixo com 40°: tan(40°) = 0,8391.
  const pts = [P(0, 0), P(100, 0), P(0, 100), P(100, 100 + 83.9099631)];

  it.each([['cifose', 'Cifose torácica'], ['lordose', 'Lordose lombar']])('%s mede o ângulo entre as duas retas e diz que não é o Cobb', (id, nome) => {
    const m = med(id);
    const r = m.calcular(pts)!;
    expect(r.valor).toBeCloseTo(40, 3);
    expect(r.texto).toBe(`${nome} (estimativa de superfície): 40,0° entre as duas retas marcadas sobre a pele. Não é o ângulo de Cobb da radiografia.`);
    expect(m.nome).toContain('estimativa de superfície, não é Cobb');
    expect(m.vistas).toEqual(['perfil']);
    expect(m.pontos).toHaveLength(4);
    expect(m.segmentos).toEqual([[0, 1], [2, 3]]);
    expect(m.desenho).toBe('retas');
    expect(m.semAuto).toBe(true);
    expect(m.sugerir).toBeUndefined();
  });

  it('retas paralelas dão 0°, em qualquer ordem dos pontos', () => {
    expect(med('cifose').calcular([P(0, 0), P(100, 0), P(100, 100), P(0, 100)])!.valor).toBeCloseTo(0, 6);
  });
});

describe('ângulo craniovertebral com o tragus sugerido e o C7 à mão', () => {
  it('o tragus vem primeiro (é o que a orelha do modelo sugere) e o valor não depende da ordem', () => {
    const m = med('cva');
    expect(m.pontos[0]).toMatch(/Tragus/);
    expect(m.pontos[1]).toMatch(/C7/);
    // C7 (0,100), tragus (100,0): reta a 45° da horizontal.
    expect(m.calcular([P(100, 0), P(0, 100)])!.valor).toBeCloseTo(45, 6);
    expect(m.calcular([P(0, 100), P(100, 0)])!.valor).toBeCloseTo(45, 6);
  });

  it('a sugestão traz só o tragus (ponto 1 de 2) e a medida fica pela metade até o C7 ser marcado', () => {
    const lm = pontosDoModelo({ [I.orelhaE]: [0.5, 0.0625], [I.ombroE]: [0.5, 0.25] });
    const s = sugerirPontos(lm, 'perfil', W, H, 'E');
    expect(s.sugeridos.cva).toEqual([P(512, 128)]);
    expect(s.origens.cva).toMatch(/orelha \(modelo\), no lugar do tragus/);
    const a = base({ vista: 'perfil', lado: 'E', pontos: { cva: s.sugeridos.cva } });
    expect(calcularResultados(a)).toEqual([]);
    expect(de(itensDaAnalise(a, ESTILO_PADRAO), 'ponto')).toHaveLength(1);
  });
});

describe('sugerirPontos: de frente e de costas', () => {
  it('de frente, usa os 33 pontos: ombros, cotovelos, braços, quadris, cabeça, tronco, joelhos e linhas, na ordem do catálogo', () => {
    const s = sugerirPontos(corpo('frente'), 'frente', W, H);
    expect(Object.keys(s.sugeridos)).toEqual(['ombros', 'cotovelos', 'braco-d', 'braco-e', 'quadris', 'cabeca', 'tronco', 'joelho-d', 'joelho-e', 'linha-joelhos', 'linha-tornozelos']);
    expect(s.sugeridos.ombros).toEqual([P(384, 512), P(640, 512)]);
    expect(s.sugeridos.cotovelos).toEqual([P(320, 768), P(704, 768)]);
    expect(s.sugeridos['braco-d']).toEqual([P(384, 512), P(320, 768)]);
    expect(s.sugeridos['braco-e']).toEqual([P(640, 512), P(704, 768)]);
    expect(s.sugeridos.quadris).toEqual([P(448, 1024), P(576, 1024)]);
    expect(s.sugeridos.cabeca).toEqual([P(448, 128), P(576, 128)]);
    expect(s.sugeridos.tronco).toEqual([P(512, 512), P(512, 1024)]);
    expect(s.sugeridos['joelho-d']).toEqual([P(448, 1024), P(448, 1536), P(448, 1792)]);
    expect(s.sugeridos['joelho-e']).toEqual([P(576, 1024), P(576, 1536), P(576, 1792)]);
    expect(s.sugeridos['linha-joelhos']).toEqual([P(448, 1536), P(576, 1536)]);
    expect(s.sugeridos['linha-tornozelos']).toEqual([P(448, 1792), P(576, 1792)]);
    expect(s.descartados).toEqual([]);
    expect(s.avisos).toEqual([]);
    expect(s.ladoUsado).toBeUndefined();
  });

  it('não sugere o que só se faz à mão: pelve, punho, carregamento, escápulas, ângulo Q, retropé, fio de prumo', () => {
    const chaves = Object.keys(sugerirPontos(corpo('frente'), 'frente', W, H).sugeridos);
    for (const id of ['pelve', 'punho-d', 'carregamento-d', 'carregamento-e', 'escapulas', 'angulo-q-d', 'retrope-d', 'prumo-frente']) expect(chaves).not.toContain(id);
  });

  it('de costas, os pontos do lado direito do paciente ficam à direita da imagem e saem nas medidas do lado direito', () => {
    const s = sugerirPontos(corpo('costas'), 'costas', W, H);
    expect(s.avisos).toEqual([]);
    expect(s.sugeridos.ombros).toEqual([P(640, 512), P(384, 512)]);
    expect(s.sugeridos['braco-d']).toEqual([P(640, 512), P(704, 768)]);
    expect(s.sugeridos['joelho-e']).toEqual([P(448, 1024), P(448, 1536), P(448, 1792)]);
    expect(Object.keys(s.sugeridos)).not.toContain('escapulas');
  });

  it('diz de onde vem cada ponto: centro articular do modelo, e olho quando falta a orelha', () => {
    const s = sugerirPontos(corpo('frente'), 'frente', W, H);
    expect(s.origens.ombros).toBe('centro do ombro (modelo)');
    expect(s.origens.quadris).toBe('centro do quadril (modelo)');
    expect(s.origens.cabeca).toBe('orelha (modelo)');
    expect(s.origens['linha-joelhos']).toMatch(/não a interlinha/);
    expect(s.origens['linha-tornozelos']).toMatch(/não o maléolo/);
    const semOrelhas = sugerirPontos(corpo('frente', ['orelhaD', 'orelhaE']), 'frente', W, H);
    expect(semOrelhas.sugeridos.cabeca).toEqual([P(480, 128), P(544, 128)]);
    expect(semOrelhas.origens.cabeca).toMatch(/olho \(modelo\), porque as orelhas não apareceram/);
  });

  it('o que falta vira motivo legível em vez de sumir', () => {
    const s = sugerirPontos(corpo('frente', ['cotoveloD']), 'frente', W, H);
    expect(s.descartados).toEqual([
      { medidaId: 'cotovelos', motivo: 'não achei o cotovelo direito' },
      { medidaId: 'braco-d', motivo: 'não achei o cotovelo direito' },
    ]);
    expect(s.sugeridos['braco-e']).toBeDefined();
    expect(s.sugeridos.cotovelos).toBeUndefined();
    const cortado = sugerirPontos(corpo('frente', ['joelhoD', 'tornozeloD', 'orelhaE', 'olhoE']), 'frente', W, H);
    const motivo = (id: string) => cortado.descartados.find((d) => d.medidaId === id)?.motivo;
    expect(motivo('joelho-d')).toBe('não achei o joelho direito e o tornozelo direito');
    expect(motivo('linha-joelhos')).toBe('não achei o joelho direito');
    expect(motivo('linha-tornozelos')).toBe('não achei o tornozelo direito');
    expect(motivo('cabeca')).toBe('não achei as orelhas nem os olhos');
    expect(motivo('joelho-e')).toBeUndefined();
  });

  it('ponto com visibilidade abaixo de 0,5 não entra; com exatamente 0,5 entra', () => {
    const lm = corpo('frente');
    lm[I.ombroD] = { ...lm[I.ombroD], visibility: 0.49 };
    expect(sugerirPontos(lm, 'frente', W, H).descartados.find((d) => d.medidaId === 'ombros')?.motivo).toBe('não achei o ombro direito');
    lm[I.ombroD] = { ...lm[I.ombroD], visibility: 0.5 };
    expect(sugerirPontos(lm, 'frente', W, H).sugeridos.ombros).toBeDefined();
  });

  it('um ponto sem visibilidade informada vale como visível', () => {
    const lm = corpo('frente');
    lm[I.ombroD] = { x: 0.375, y: 0.25 };
    expect(sugerirPontos(lm, 'frente', W, H).sugeridos.ombros).toEqual([P(384, 512), P(640, 512)]);
  });

  it('o resultado das medidas sugeridas já dá sentido: joelhos retos, braços na vertical', () => {
    const s = sugerirPontos(corpo('frente'), 'frente', W, H);
    const r = calcularResultados(base({ vista: 'frente', largura: W, altura: H, pontos: s.sugeridos }));
    const braco = r.find((x) => x.id === 'braco-d')!;
    // ombro (384,512) e cotovelo (320,768): 64 px para a esquerda da imagem em 256 px = atan(0,25) = 14,0362°, para fora do corpo.
    expect(braco.valor).toBeCloseTo(14.0362, 3);
    expect(braco.sentido).toBe('afastado do tronco');
    expect(r.find((x) => x.id === 'joelho-d')!.valor).toBeCloseTo(180, 6);
  });
});

describe('sugerirPontos: percorre as medidas da vista que sabem se sugerir', () => {
  const falsa = (id: string, vistas: Vista[], sugerir: NonNullable<Medida['sugerir']>, origemSugestao?: string): Medida => ({
    id, nome: id, vistas, grupo: 'postura', pontos: ['a', 'b'], calcular: () => null, sugerir, origemSugestao,
  });
  /** Põe medidas de mentira no catálogo só durante o teste. */
  const comMedidas = (extras: Medida[], teste: () => void) => {
    const antes = MEDIDAS.length;
    MEDIDAS.push(...extras);
    try {
      teste();
    } finally {
      MEDIDAS.splice(antes, extras.length);
    }
  };

  it('guarda o que cada medida devolve: pontos (com a origem da medida ou a dela), motivo de descarte; nada para null ou lista vazia', () => {
    comMedidas([
      falsa('x-pontos', ['frente'], () => ({ pontos: [P(1, 2)], origem: 'origem do resultado' }), 'origem da medida'),
      falsa('x-padrao', ['frente'], () => ({ pontos: [P(3, 4)] }), 'origem da medida'),
      falsa('x-motivo', ['frente'], () => ({ motivo: 'não achei o que faltava' })),
      falsa('x-nula', ['frente'], () => null),
      falsa('x-vazia', ['frente'], () => ({ pontos: [] }), 'origem da medida'),
    ], () => {
      const s = sugerirPontos(corpo('frente'), 'frente', W, H);
      expect(s.sugeridos['x-pontos']).toEqual([P(1, 2)]);
      expect(s.origens['x-pontos']).toBe('origem do resultado');
      expect(s.sugeridos['x-padrao']).toEqual([P(3, 4)]);
      expect(s.origens['x-padrao']).toBe('origem da medida');
      expect(s.descartados).toEqual([{ medidaId: 'x-motivo', motivo: 'não achei o que faltava' }]);
      for (const id of ['x-motivo', 'x-nula', 'x-vazia']) expect(s.sugeridos[id], id).toBeUndefined();
      expect(s.origens['x-vazia']).toBeUndefined();
    });
  });

  it('só chama as medidas da vista da foto, com o tamanho da foto, a vista e o lado do perfil', () => {
    const chamadas: { id: string; c: ContextoSugestao }[] = [];
    const espia = (id: string, vistas: Vista[]) => falsa(id, vistas, (_lm, c) => {
      chamadas.push({ id, c });
      return null;
    });
    comMedidas([espia('x-frente', ['frente']), espia('x-perfil', ['perfil'])], () => {
      sugerirPontos(corpo('frente'), 'frente', W, H, 'D');
      expect(chamadas).toEqual([{ id: 'x-frente', c: { w: W, h: H, vista: 'frente', lado: undefined } }]);
      chamadas.length = 0;
      sugerirPontos(corpo('frente'), 'perfil', W, H, 'D');
      expect(chamadas).toEqual([{ id: 'x-perfil', c: { w: W, h: H, vista: 'perfil', lado: 'D' } }]);
    });
  });

  it('o catálogo volta ao que era depois do teste', () => {
    expect(MEDIDAS.some((m) => m.id.startsWith('x-'))).toBe(false);
  });
});

describe('sugerirPontos: teste de sanidade de direito e esquerdo', () => {
  it('de frente o ombro direito fica à esquerda do esquerdo; se não ficar, avisa que o modelo pode ter trocado os lados', () => {
    expect(conferirDireitaEsquerda(corpo('frente'), 'frente')).toBeNull();
    const trocado = corpo('costas');
    const aviso = conferirDireitaEsquerda(trocado, 'frente')!;
    expect(aviso).toContain('O modelo pode ter trocado direito e esquerdo');
    expect(aviso).toContain('nesta foto de frente o ombro direito apareceu à direita do esquerdo');
    expect(sugerirPontos(trocado, 'frente', W, H).avisos).toEqual([aviso]);
  });

  it('de costas o contrário: o direito fica à direita', () => {
    expect(conferirDireitaEsquerda(corpo('costas'), 'costas')).toBeNull();
    const aviso = conferirDireitaEsquerda(corpo('frente'), 'costas')!;
    expect(aviso).toContain('nesta foto de costas o ombro direito apareceu à esquerda do esquerdo');
  });

  it('usa o quadril quando os ombros não aparecem, e não opina com pontos demais próximos ou ausentes', () => {
    const semOmbros = corpo('costas', ['ombroD', 'ombroE']);
    expect(conferirDireitaEsquerda(semOmbros, 'frente')).toContain('o quadril direito apareceu à direita do esquerdo');
    // De frente o direito à direita do esquerdo seria troca, mas 0,01 da largura é pequeno demais para valer como indício.
    const colados = pontosDoModelo({ [I.ombroD]: [0.51, 0.25], [I.ombroE]: [0.5, 0.25] });
    expect(conferirDireitaEsquerda(colados, 'frente')).toBeNull();
    const separados = pontosDoModelo({ [I.ombroD]: [0.53, 0.25], [I.ombroE]: [0.5, 0.25] });
    expect(conferirDireitaEsquerda(separados, 'frente')).toContain('o ombro direito apareceu à direita do esquerdo');
    expect(conferirDireitaEsquerda(pontosDoModelo({}), 'frente')).toBeNull();
    expect(conferirDireitaEsquerda(corpo('costas'), 'perfil')).toBeNull();
  });

  it('"inverter D/E" troca os lados antes de sugerir e o aviso some', () => {
    const trocado = corpo('costas');
    const normal = sugerirPontos(corpo('frente'), 'frente', W, H);
    const s = sugerirPontos(trocado, 'frente', W, H, undefined, { inverterDE: true });
    expect(s.avisos).toEqual([]);
    expect(s.sugeridos).toEqual(normal.sugeridos);
  });

  it('trocar direito e esquerdo é uma cópia: a original não muda e dá a identidade em duas trocas', () => {
    const lm = corpo('frente');
    const copia = trocarDireitaEsquerda(lm);
    expect(copia[I.ombroD]).toEqual(lm[I.ombroE]);
    expect(copia[I.ombroE]).toEqual(lm[I.ombroD]);
    expect(copia[I.olhoD]).toEqual(lm[I.olhoE]);
    expect(copia[I.nariz]).toEqual(lm[I.nariz]);
    expect(lm[I.ombroD].x).toBe(0.375);
    expect(trocarDireitaEsquerda(copia)).toEqual(lm);
  });

  it('sem pontos do modelo, devolve a lista vazia: não inventa pontos', () => {
    expect(trocarDireitaEsquerda([])).toEqual([]);
  });
});

describe('sugerirPontos: perfil com o lado informado', () => {
  // Perfil esquerdo: o lado esquerdo do paciente aparece (visibilidade alta) e ele olha para a esquerda da imagem (nariz à esquerda da orelha).
  const perfilE = (sobre: Record<number, [number, number, number?]> = {}) => pontosDoModelo({
    [I.nariz]: [0.40625, 0.0625], [I.orelhaE]: [0.5, 0.0625], [I.ombroE]: [0.5, 0.25], [I.cotoveloE]: [0.5625, 0.375], [I.punhoE]: [0.5, 0.5],
    [I.quadrilE]: [0.5, 0.5], [I.joelhoE]: [0.4375, 0.75], [I.tornozeloE]: [0.5, 0.875],
    [I.ombroD]: [0.5, 0.25, 0.1], [I.cotoveloD]: [0.5, 0.375, 0.1], [I.quadrilD]: [0.5, 0.5, 0.1], [I.joelhoD]: [0.5, 0.75, 0.1], [I.tornozeloD]: [0.5, 0.875, 0.1], [I.orelhaD]: [0.5, 0.0625, 0.1],
    ...sobre,
  });

  it('usa o lado informado: o braço, o cotovelo, o tronco, o joelho e a perna do lado da foto', () => {
    const s = sugerirPontos(perfilE(), 'perfil', W, H, 'E');
    expect(Object.keys(s.sugeridos)).toEqual(['braco-e', 'cotovelo-perfil', 'cva', 'tronco-perfil', 'joelho', 'perna-vertical']);
    expect(s.sugeridos['braco-e']).toEqual([P(512, 512), P(576, 768)]);
    expect(s.sugeridos['cotovelo-perfil']).toEqual([P(512, 512), P(576, 768), P(512, 1024)]);
    expect(s.sugeridos['tronco-perfil']).toEqual([P(512, 512), P(512, 1024)]);
    expect(s.sugeridos.joelho).toEqual([P(512, 1024), P(448, 1536), P(512, 1792)]);
    expect(s.sugeridos['perna-vertical']).toEqual([P(448, 1536), P(512, 1792)]);
    expect(s.sugeridos.cva).toEqual([P(512, 128)]);
    expect(s.ladoUsado).toBe('E');
    expect(s.avisos).toEqual([]);
    expect(s.descartados).toEqual([]);
  });

  it('sem a orelha do lado da foto, o ângulo craniovertebral vira motivo de descarte (o olho não substitui o tragus)', () => {
    const s = sugerirPontos(perfilE({ [I.orelhaE]: [0.5, 0.0625, 0.2], [I.olhoE]: [0.46875, 0.0625, 0.9] }), 'perfil', W, H, 'E');
    expect(s.sugeridos.cva).toBeUndefined();
    expect(s.descartados).toEqual([{ medidaId: 'cva', motivo: 'não achei a orelha esquerda' }]);
  });

  it('cada medida chama sua própria sugestão com o contexto da foto: a do braço do outro lado no perfil devolve null, a que falta devolve o motivo', () => {
    const lm = perfilE();
    const contexto = { w: W, h: H, vista: 'perfil' as const, lado: 'E' as const };
    expect(med('braco-d').sugerir!(lm, contexto)).toBeNull();
    expect(med('braco-e').sugerir!(lm, contexto)).toEqual({ pontos: [P(512, 512), P(576, 768)] });
    const semCotovelo = perfilE({ [I.cotoveloE]: [0.5625, 0.375, 0.2] });
    expect(med('braco-e').sugerir!(semCotovelo, contexto)).toEqual({ motivo: 'não achei o cotovelo esquerdo' });
    expect(med('cotovelo-perfil').sugerir!(semCotovelo, contexto)).toEqual({ motivo: 'não achei o cotovelo esquerdo' });
  });

  it('o braço do outro lado fica atrás do corpo: não é sugerido nem vira motivo de descarte', () => {
    const s = sugerirPontos(perfilE(), 'perfil', W, H, 'E');
    expect(s.sugeridos['braco-d']).toBeUndefined();
    expect(s.descartados.find((d) => d.medidaId === 'braco-d')).toBeUndefined();
  });

  it('as medidas sugeridas dizem o sentido pelo lado: joelho à frente da linha, olhando para a esquerda, é flexão', () => {
    const s = sugerirPontos(perfilE(), 'perfil', W, H, 'E');
    const r = calcularResultados(base({ vista: 'perfil', lado: 'E', largura: W, altura: H, pontos: s.sugeridos, opcoes: opcoesPadraoDoLado('E') }));
    expect(r.find((x) => x.id === 'joelho')!.sentido).toBe('flexão');
    // tornozelo (512,1792) está 64 px à direita do joelho (448,1536): o joelho fica à frente de quem olha para a esquerda.
    expect(r.find((x) => x.id === 'perna-vertical')!.sentido).toBe('joelho à frente');
  });

  it('o lado informado vale mesmo quando o outro aparece melhor: avisa "confira o lado" e descarta com motivo', () => {
    const s = sugerirPontos(perfilE(), 'perfil', W, H, 'D');
    expect(s.avisos[0]).toBe('Confira o lado: nesta foto de perfil direito o modelo enxergou melhor o lado esquerdo do corpo.');
    expect(s.ladoUsado).toBe('D');
    expect(s.descartados.find((d) => d.medidaId === 'tronco-perfil')?.motivo).toBe('não achei o ombro direito e o quadril direito');
    expect(s.descartados.find((d) => d.medidaId === 'braco-d')?.motivo).toBe('não achei o ombro direito e o cotovelo direito');
  });

  it('o nariz apontando para o lado contrário ao do perfil também pede conferência', () => {
    // Nariz à esquerda da orelha com perfil direito informado (o perfil direito costuma mostrar o paciente olhando para a direita).
    const so = escolherLadoDoPerfil(perfilE(), 'D');
    expect(so.avisos).toHaveLength(2);
    expect(so.avisos[1]).toBe('Confira o lado: o nariz aponta para a esquerda da imagem, mas no perfil direito o paciente costuma aparecer olhando para a direita. Se o lado estiver certo, corrija “para onde o paciente olha”.');
    const ok = perfilE({ [I.nariz]: [0.59375, 0.0625] });
    expect(escolherLadoDoPerfil(ok, 'E').avisos[0]).toMatch(/o nariz aponta para a direita da imagem, mas no perfil esquerdo/);
    expect(escolherLadoDoPerfil(perfilE(), 'E').avisos).toEqual([]);
  });

  it('nariz quase na vertical da orelha ou fora de vista: não opina', () => {
    expect(escolherLadoDoPerfil(perfilE({ [I.nariz]: [0.505, 0.0625] }), 'D').avisos).toHaveLength(1);
    expect(escolherLadoDoPerfil(perfilE({ [I.nariz]: [0.7, 0.0625, 0.2] }), 'D').avisos).toHaveLength(1);
  });

  it('só avisa da visibilidade quando a diferença é clara (a partir de 1,0 somando quatro pontos)', () => {
    const lado = (visE: number, visD: number) => {
      const o: Record<number, [number, number, number]> = {};
      for (const i of [I.ombroE, I.quadrilE, I.joelhoE, I.tornozeloE]) o[i] = [0.5, 0.5, visE];
      for (const i of [I.ombroD, I.quadrilD, I.joelhoD, I.tornozeloD]) o[i] = [0.5, 0.5, visD];
      return pontosDoModelo(o);
    };
    expect(escolherLadoDoPerfil(lado(0.9, 0.6), 'D').avisos[0]).toMatch(/enxergou melhor o lado esquerdo/);
    expect(escolherLadoDoPerfil(lado(0.8, 0.6), 'D').avisos).toEqual([]);
    expect(escolherLadoDoPerfil(lado(0.6, 0.9), 'D').avisos).toEqual([]);
  });

  it('sem o lado informado, usa o mais visível e avisa; o resultado antigo (só o dicionário) continua o mesmo', () => {
    const lm = perfilE();
    const s = sugerirPontos(lm, 'perfil', W, H);
    expect(s.ladoUsado).toBe('E');
    expect(s.avisos).toEqual(['Lado do perfil não informado: usei o lado esquerdo do paciente, o mais visível para o modelo. Confira.']);
    expect(pontosAutomaticos(lm, 'perfil', W, H)).toEqual(s.sugeridos);
    expect(pontosAutomaticos(lm, 'perfil', W, H, 'E')).toEqual(s.sugeridos);
  });

  it('o resultado antigo também recebe o lado: com o lado direito informado numa foto que só mostra o esquerdo, não sobra sugestão', () => {
    expect(pontosAutomaticos(perfilE(), 'perfil', W, H, 'D')).toEqual({});
  });

  it('no empate de visibilidade o lado mais visível é o esquerdo', () => {
    expect(ladoMaisVisivel(pontosDoModelo({}))).toBe('E');
    expect(ladoMaisVisivel(pontosDoModelo({ [I.ombroD]: [0.5, 0.25] }))).toBe('D');
  });

  it('perfil direito com o lado direito visível e o paciente olhando para a direita: sem avisos', () => {
    const lm = pontosDoModelo({
      [I.nariz]: [0.59375, 0.0625], [I.orelhaD]: [0.5, 0.0625], [I.ombroD]: [0.5, 0.25], [I.cotoveloD]: [0.4375, 0.375], [I.punhoD]: [0.4375, 0.5],
      [I.quadrilD]: [0.5, 0.5], [I.joelhoD]: [0.5625, 0.75], [I.tornozeloD]: [0.5, 0.875],
    }, 0.1);
    const s = sugerirPontos(lm, 'perfil', W, H, 'D');
    expect(s.avisos).toEqual([]);
    expect(Object.keys(s.sugeridos)).toEqual(['braco-d', 'cotovelo-perfil', 'cva', 'tronco-perfil', 'joelho', 'perna-vertical']);
    expect(s.sugeridos['braco-d']).toEqual([P(512, 512), P(448, 768)]);
    expect(s.sugeridos['cotovelo-perfil']).toEqual([P(512, 512), P(448, 768), P(448, 1024)]);
    expect(s.sugeridos['tronco-perfil']).toEqual([P(512, 512), P(512, 1024)]);
    expect(s.sugeridos.joelho).toEqual([P(512, 1024), P(576, 1536), P(512, 1792)]);
    expect(s.sugeridos['perna-vertical']).toEqual([P(576, 1536), P(512, 1792)]);
    expect(s.sugeridos.cva).toEqual([P(512, 128)]);
    const r = calcularResultados(base({ vista: 'perfil', lado: 'D', largura: W, altura: H, pontos: s.sugeridos, opcoes: opcoesPadraoDoLado('D') }));
    expect(r.find((x) => x.id === 'braco-d')!.sentido).toBe('cotovelo atrás');
    expect(r.find((x) => x.id === 'joelho')!.sentido).toBe('flexão');
  });
});

describe('fio de prumo: o lado informado e os avisos', () => {
  it('de perfil usa o lado informado mesmo com o outro mais visível, e traz o aviso', () => {
    const lm = pontosDoModelo({
      [I.nariz]: [0.59375, 0.0625], [I.orelhaD]: [0.5, 0.0625, 0.6], [I.ombroD]: [0.5, 0.25, 0.6], [I.quadrilD]: [0.5, 0.5, 0.6], [I.joelhoD]: [0.5, 0.75, 0.6], [I.tornozeloD]: [0.5, 0.875, 0.6],
      [I.orelhaE]: [0.25, 0.0625], [I.ombroE]: [0.25, 0.25], [I.quadrilE]: [0.25, 0.5], [I.joelhoE]: [0.25, 0.75], [I.tornozeloE]: [0.25, 0.875],
    });
    const d = pontosDoPrumo(lm, 'perfil', W, H, 'D')!;
    expect(d.pontos[0]).toEqual(P(512, 1792));
    expect(d.avisos).toEqual(['Confira o lado: nesta foto de perfil direito o modelo enxergou melhor o lado esquerdo do corpo.']);
    const e = pontosDoPrumo(lm, 'perfil', W, H, 'E')!;
    expect(e.pontos[0]).toEqual(P(256, 1792));
    expect(e.avisos.some((a) => a.includes('o nariz aponta para a direita da imagem, mas no perfil esquerdo'))).toBe(true);
    expect(pontosDoPrumo(lm, 'perfil', W, H)!.pontos[0]).toEqual(P(256, 1792));
  });

  it('de frente avisa quando o modelo parece ter trocado direito e esquerdo', () => {
    expect(pontosDoPrumo(corpo('frente'), 'frente', W, H)!.avisos).toEqual([]);
    expect(pontosDoPrumo(corpo('costas'), 'frente', W, H)!.avisos[0]).toContain('O modelo pode ter trocado direito e esquerdo');
  });
});

describe('medidas novas: catálogo, ordem, ícones e cautela', () => {
  const postura = MEDIDAS.filter((m) => m.grupo === 'postura');
  const novas = ['cotovelos', 'braco-d', 'braco-e', 'cotovelo-perfil', 'carregamento-d', 'carregamento-e', 'punho-d', 'punho-e', 'escapulas', 'quadris', 'linha-joelhos', 'linha-tornozelos', 'perna-vertical', 'cifose', 'lordose'];

  it('os ids são únicos e cada medida de postura tem sugestão automática ou diz por que é só à mão', () => {
    const ids = MEDIDAS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of postura.filter((x) => x.desenho !== 'prumo')) {
      expect(Boolean(m.sugerir) !== Boolean(m.semAuto), m.id).toBe(true);
      if (m.semAuto) expect(m.motivoSemAuto, m.id).toBeTruthy();
      if (m.sugerir) expect(m.origemSugestao, m.id).toBeTruthy();
    }
  });

  it('toda medida de postura tem ícone, e as de um lado só levam a letra D ou E', () => {
    for (const m of postura) expect(ICONE_MEDIDA[m.id], m.id).toBeDefined();
    for (const m of MEDIDAS.filter((x) => /-(d|e)$/.test(x.id))) expect(LADO_MEDIDA[m.id], m.id).toBe(m.id.endsWith('-d') ? 'D' : 'E');
  });

  it('os nomes dos resultados novos são reconhecidos', () => {
    for (const id of novas) expect(nomeDoResultado(id), id).toBe(med(id).nome);
    expect(nomeDoResultado('braco-d')).toBe('Alinhamento do braço direito');
    expect(nomeDoResultado('cotovelo-perfil')).toBe('Flexão/extensão do cotovelo');
    expect(nomeDoResultado('carregamento-e')).toBe('Ângulo de carregamento do cotovelo esquerdo (estimativa por foto)');
    expect(nomeDoResultado('punho-d')).toBe('Alinhamento antebraço-mão direito');
    expect(nomeDoResultado('escapulas')).toBe('Desnível dos ângulos inferiores das escápulas');
  });

  it('a ordem de exibição é a do catálogo: membros superiores logo depois dos ombros, e a linha dos quadris logo depois da pelve', () => {
    const pos = (id: string) => MEDIDAS.findIndex((m) => m.id === id);
    const ordem = ['ombros', 'cotovelos', 'braco-d', 'braco-e', 'carregamento-d', 'punho-d', 'escapulas', 'pelve', 'quadris'].map(pos);
    expect(ordem.every((i) => i >= 0)).toBe(true);
    expect(ordem).toEqual([...ordem].sort((a, b) => a - b));
    expect(pos('quadris')).toBe(pos('pelve') + 1);
    expect(pos('ombros')).toBeLessThan(pos('joelho'));
  });

  it('as medidas novas valem nas vistas certas', () => {
    const vistas = (id: string): Vista[] => med(id).vistas;
    expect(vistas('braco-e')).toEqual(['frente', 'costas', 'perfil']);
    expect(vistas('cotovelo-perfil')).toEqual(['perfil']);
    expect(vistas('carregamento-d')).toEqual(['frente']);
    expect(vistas('punho-e')).toEqual(['frente', 'costas']);
    expect(vistas('perna-vertical')).toEqual(['perfil']);
    expect(vistas('lordose')).toEqual(['perfil']);
    expect(vistas('joelho-d')).toEqual(['frente', 'costas']);
  });

  it('nenhuma medida nova traz valor de referência, nota ou classificação: só medida e lado', () => {
    const proibido = /\b(normal|normais|alterad[oa]s?|anormal|patol[óo]gic|ideal|ideais|melhora|piora|diagn[óo]stic|déficit|saud[áa]vel)\b/i;
    for (const id of novas) expect(med(id).definicao ?? '', id).not.toMatch(proibido);
    const contextos: ContextoMedida[] = [
      ctx({ vista: 'frente' }), ctx({ vista: 'costas' }), ctx({ vista: 'perfil', lado: 'D' }), ctx({ vista: 'perfil', lado: 'E', olhaPara: 'esquerda' }), ctx({ vista: 'perfil', lado: 'D', cmPorPx: 0.5 }),
    ];
    for (const m of MEDIDAS.filter((x) => x.grupo === 'postura' && x.desenho !== 'prumo')) {
      const pts = m.pontos.map((_, i) => P(100 + 37 * i, 200 + 53 * ((i * 7) % 5)));
      for (const c of contextos) {
        const r = m.calcular(pts, c);
        if (r) expect(r.texto, m.id).not.toMatch(proibido);
        for (const e of m.extras ?? []) {
          const x = e.calcular(pts, c);
          if (x) expect(x.texto, m.id).not.toMatch(proibido);
        }
      }
    }
  });

  it('as medidas novas retornam null com pontos coincidentes (nunca NaN); o extra só roda depois do principal', () => {
    for (const id of novas) {
      const m = med(id);
      const iguais = m.pontos.map(() => P(5, 5));
      expect(m.calcular(iguais, ctx({ vista: 'frente', lado: 'D', olhaPara: 'direita', cmPorPx: 1 })), id).toBeNull();
    }
    expect(med('ombros').extras![0].calcular([P(5, 5), P(5, 5)], ctx({ cmPorPx: 1 }))).toEqual({ valor: 0, texto: 'Linha dos ombros nivelada (0,0 cm).' });
  });

  it('as definições que dependem de marcador na pele ou de conferência dizem isso', () => {
    expect(med('escapulas').definicao).toMatch(/palpação/);
    expect(med('escapulas').definicao).toMatch(/marcador na pele/);
    expect(med('cifose').definicao).toMatch(/não é Cobb/);
    expect(med('joelho-d').definicao).toMatch(/centros articulares, não a interlinha nem o maléolo/);
    expect(med('linha-joelhos').definicao).toMatch(/não a interlinha/);
    expect(med('linha-tornozelos').definicao).toMatch(/não o maléolo/);
    expect(med('quadris').definicao).toMatch(/não é a crista ilíaca nem o trocânter/);
  });

  it('os rótulos dos pontos concordam em gênero com a parte do corpo (mão, perna, espinha, patela e tuberosidade são femininas)', () => {
    expect(med('punho-d').pontos[2]).toBe('Eixo da mão direita (cabeça do 3º metacarpo)');
    expect(med('punho-e').pontos[2]).toBe('Eixo da mão esquerda (cabeça do 3º metacarpo)');
    expect(med('retrope-e').pontos[0]).toBe('Perna esquerda: ponto de cima (meio da panturrilha)');
    expect(med('retrope-d').pontos[2]).toBe('Calcâneo direito: ponto de cima');
    expect(med('angulo-q-d').pontos).toEqual(['EIAS direita (espinha ilíaca anterossuperior)', 'Centro da patela direita', 'Tuberosidade da tíbia direita']);
    expect(med('braco-e').pontos[1]).toBe('Cotovelo esquerdo (epicôndilo lateral)');
  });

  it('as medidas que o modelo sugere dizem na definição o que ele realmente marca (centro, não o ponto ósseo)', () => {
    expect(med('ombros').definicao).toMatch(/centro do ombro, não o acrômio/);
    expect(med('ombros').definicao).toMatch(/diferença de altura em cm/);
    expect(med('cabeca').definicao).toMatch(/orelha, não o tragus/);
    expect(med('tronco').definicao).toMatch(/não marca o C7/);
    expect(med('tronco-perfil').definicao).toMatch(/não o acrômio nem o trocânter/);
    expect(med('braco-d').definicao).toMatch(/centro da articulação, não o acrômio nem o epicôndilo/);
    expect(med('cotovelos').definicao).toMatch(/não o epicôndilo/);
  });

  it('medidas marcadas pela metade desenham só os pontos feitos, sem quebrar', () => {
    for (const id of novas) {
      const m = med(id);
      const vista = m.vistas[0];
      const a = base({ vista, lado: vista === 'perfil' ? 'D' : undefined, pontos: { [id]: [P(100, 100)] } });
      expect(calcularResultados(a)).toEqual([]);
      const itens = itensDaAnalise(a, ESTILO_PADRAO);
      expect(de(itens, 'ponto')).toHaveLength(1);
    }
  });

  it('completas, todas desenham com rótulo e sem NaN, e o rótulo é o valor sem sinal', () => {
    const exemplos: Record<string, Ponto[]> = {
      cotovelos: [P(200, 500), P(800, 520)], 'braco-d': [P(300, 300), P(260, 700)], 'braco-e': [P(700, 300), P(740, 700)],
      'cotovelo-perfil': [P(500, 300), P(500, 700), P(620, 620)], 'carregamento-d': [P(300, 300), P(290, 700), P(270, 1100)], 'carregamento-e': [P(700, 300), P(710, 700), P(730, 1100)],
      'punho-d': [P(290, 700), P(270, 1100), P(262, 1200)], 'punho-e': [P(710, 700), P(730, 1100), P(738, 1200)], escapulas: [P(300, 600), P(700, 640)],
      quadris: [P(350, 1000), P(650, 1020)], 'linha-joelhos': [P(350, 1300), P(650, 1290)], 'linha-tornozelos': [P(350, 1450), P(650, 1450)],
      'perna-vertical': [P(500, 1300), P(520, 1450)], cifose: [P(500, 300), P(520, 420), P(560, 600), P(520, 700)], lordose: [P(500, 800), P(480, 900), P(470, 1000), P(500, 1100)],
    };
    for (const id of novas) {
      const vista = med(id).vistas[0];
      const a = base({ vista, lado: vista === 'perfil' ? 'E' : undefined, pontos: { [id]: exemplos[id] }, opcoes: opcoesPadraoDoLado(vista === 'perfil' ? 'E' : undefined) });
      const r = calcularResultados(a);
      expect(r.length, id).toBeGreaterThanOrEqual(1);
      const itens = itensDaAnalise(a, ESTILO_PADRAO);
      expect(JSON.stringify(itens), id).not.toMatch(/NaN|null/);
      expect(de(itens, 'rotulo')[0].texto, id).toMatch(/^\d+,\d°$/);
    }
  });
});
