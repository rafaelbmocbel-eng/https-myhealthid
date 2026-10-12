import { afterEach, describe, expect, it, vi } from 'vitest';
import { OPCOES_ANALISE_PADRAO, itensDaAnalise, painelParaExportar, type AnaliseFoto } from '@/lib/angular/analise';
import { separarRotulos, type ItemDesenho } from '@/lib/angular/desenho';
import { ESCALA_ESTILO_NA_ARTE, ESTILO_INSTAGRAM, escalaDoEstiloNaArte } from '@/lib/angular/estilo';
import type { Ponto } from '@/lib/angular/medidas';
import { desenharArteSocial, perfilDasMarcacoes, type OpcoesArte, type PainelPronto } from '@/lib/social/desenhar';
import {
  PERDA_MAXIMA_PREENCHER, PERDA_MAXIMA_PREENCHER_COM_MARCAS, VISIVEL_MINIMO_PREENCHER, ajusteSugerido, enquadramentoAutomatico, fracaoVisivel, janelaDaImagem, perfilMedio,
  type PerfilMarcas,
} from '@/lib/social/geometria';
import { estimarLargura } from '@/lib/social/fontes';
import { ALTURA_CAPITAL, ALTURA_PILULA, calcularLayoutSocial, type ParametrosLayout } from '@/lib/social/layout';

const P = (x: number, y: number): Ponto => ({ x, y });
type Rotulo = Extract<ItemDesenho, { tipo: 'rotulo' }>;
const rotulo = (texto: string, x: number, y: number, largura = 200, altura = 60): Rotulo => ({
  tipo: 'rotulo', texto, x, y, largura, altura, fonte: 40, borda: '#000', larguraBorda: 1, cor: '#000', larguraContorno: 0,
});
const rotulos = (itens: ItemDesenho[]) => itens.filter((i): i is Rotulo => i.tipo === 'rotulo');
const cruzam = (a: Rotulo, b: Rotulo) => Math.abs(a.x - b.x) < (a.largura + b.largura) / 2 && Math.abs(a.y - b.y) < (a.altura + b.altura) / 2;

describe('escala do estilo na arte social', () => {
  it('deixa a linha com a mesma espessura na arte, qualquer que seja o tamanho da foto na moldura', () => {
    // foto de 1000 px mostrada a 0,5 da arte, ou de 2000 px mostrada a 0,25: em ambos a espessura 9 vira ~6,3 px na arte
    for (const pxArtePorPxFoto of [0.5, 0.25, 1, 1.5]) {
      expect(9 * escalaDoEstiloNaArte(pxArtePorPxFoto) * pxArtePorPxFoto).toBeCloseTo(9 * ESCALA_ESTILO_NA_ARTE, 9);
    }
    expect(9 * ESCALA_ESTILO_NA_ARTE).toBeGreaterThanOrEqual(5.5);
    expect(9 * ESCALA_ESTILO_NA_ARTE).toBeLessThanOrEqual(8);
  });

  it('escala inválida não quebra a conta', () => {
    expect(escalaDoEstiloNaArte(0)).toBe(ESCALA_ESTILO_NA_ARTE);
    expect(escalaDoEstiloNaArte(Number.NaN)).toBe(ESCALA_ESTILO_NA_ARTE);
  });
});

describe('separarRotulos', () => {
  it('não mexe em rótulos que não se tocam, nem em itens de outro tipo', () => {
    const itens: ItemDesenho[] = [{ tipo: 'ponto', x: 5, y: 5, raio: 3, cor: '#f00', anel: '#fff', larguraAnel: 1 }, rotulo('A', 200, 200), rotulo('B', 600, 600)];
    expect(separarRotulos(itens, 1000, 1000)).toEqual(itens);
  });

  it('afasta o segundo rótulo do primeiro, que fica onde estava', () => {
    const a = rotulo('Ombros 4°', 500, 400), b = rotulo('C7 0°', 520, 420);
    const [a2, b2] = rotulos(separarRotulos([a, b], 1000, 1000));
    expect(a2).toEqual(a);
    expect(cruzam(a2, b2)).toBe(false);
    // anda o mínimo: cerca de uma altura de rótulo, não para o outro lado da foto
    expect(Math.hypot(b2.x - b.x, b2.y - b.y)).toBeLessThan(2 * a.altura);
  });

  it('resolve uma pilha de três rótulos no mesmo lugar, sem sobreposição e dentro da foto', () => {
    const itens = [rotulo('1', 500, 500), rotulo('2', 500, 500), rotulo('3', 500, 500)];
    const saida = rotulos(separarRotulos(itens, 1000, 1000));
    for (let i = 0; i < saida.length; i++) {
      expect(saida[i].x - saida[i].largura / 2).toBeGreaterThanOrEqual(0);
      expect(saida[i].y - saida[i].altura / 2).toBeGreaterThanOrEqual(0);
      expect(saida[i].x + saida[i].largura / 2).toBeLessThanOrEqual(1000);
      expect(saida[i].y + saida[i].altura / 2).toBeLessThanOrEqual(1000);
      for (let j = i + 1; j < saida.length; j++) expect(cruzam(saida[i], saida[j])).toBe(false);
    }
  });

  it('sem lugar livre, deixa o rótulo onde estava em vez de empurrá-lo para fora da foto', () => {
    const itens = [rotulo('A', 100, 50, 200, 100), rotulo('B', 100, 50, 200, 100)];
    const saida = rotulos(separarRotulos(itens, 200, 100));
    expect(saida[1]).toMatchObject({ x: 100, y: 50 });
  });

  it('na análise de frente, "C7" e "Desnível dos ombros" no meio dos ombros não se cobrem', () => {
    const a: AnaliseFoto = {
      vista: 'frente', largura: 900, altura: 1400, pontos: {
        ombros: [P(300, 404), P(600, 426)],
        'prumo-frente': [P(450, 1330), P(450, 215), P(452, 360), P(458, 790)],
      }, giro: null, cmPorPx: null, opcoes: { ...OPCOES_ANALISE_PADRAO },
    };
    const r = rotulos(itensDaAnalise(a, ESTILO_INSTAGRAM));
    expect(r.length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) expect(cruzam(r[i], r[j])).toBe(false);
  });
});

describe('marcações redesenhadas na escala da arte', () => {
  afterEach(() => vi.restoreAllMocks());

  function canvasFalso(largura: number, altura: number) {
    const larguras: number[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      const alvo: Record<string, unknown> = { canvas: this };
      return new Proxy(alvo, {
        get(t, k: string) { return k in t ? t[k] : () => undefined; },
        set(_t, k: string, v) { if (k === 'lineWidth') larguras.push(v as number); return true; },
      }) as unknown as RenderingContext;
    } as never);
    const a: AnaliseFoto = { vista: 'frente', largura, altura, imagem: {} as CanvasImageSource, pontos: { ombros: [P(600, 1200), P(2400, 1020)] }, giro: null, cmPorPx: null, opcoes: { ...OPCOES_ANALISE_PADRAO } };
    return { a, larguras };
  }

  it('o painel oferece refazer as marcações e a linha na arte tem a mesma espessura para qualquer escala', () => {
    const { a, larguras } = canvasFalso(3000, 4000);
    const painel = painelParaExportar(a, ESTILO_INSTAGRAM, { ladoMax: 2000 })!;
    expect(painel.marcacoesNaEscala).toBeTypeOf('function');
    const espessuraNaArte = (pxArtePorPxFoto: number) => {
      larguras.length = 0;
      painel.marcacoesNaEscala!(pxArtePorPxFoto);
      // O contexto é escalado de 3000 para 1500 px (ladoMax 2000): a linha sai na foto original e vira px da arte ao multiplicar.
      return Math.max(...larguras) * (painel.largura / 3000) * pxArtePorPxFoto;
    };
    expect(espessuraNaArte(0.25)).toBeCloseTo(9 * ESCALA_ESTILO_NA_ARTE, 6);
    expect(espessuraNaArte(0.5)).toBeCloseTo(9 * ESCALA_ESTILO_NA_ARTE, 6);
    expect(espessuraNaArte(1)).toBeCloseTo(9 * ESCALA_ESTILO_NA_ARTE, 6);
  });
});

const fonteFalsa = (w: number, h: number) => ({ width: w, height: h } as unknown as CanvasImageSource);

function ctxGravador() {
  const desenhos: { src: unknown; args: number[] }[] = [];
  const alvo: Record<string, unknown> = { canvas: { width: 1080, height: 1920 } };
  const ctx = new Proxy(alvo, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: () => undefined });
      if (k === 'measureText') return (s: string) => ({ width: s.length * 10 });
      if (k === 'drawImage') return (src: unknown, ...args: number[]) => { desenhos.push({ src, args }); };
      return () => undefined;
    },
    set(t, k: string, v) { t[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, desenhos };
}

const opcoesArte: OpcoesArte = { formato: 'story', layout: 'unica', tituloModo: 'nenhum', margensStories: true, modoAjuste: 'inteira', modoRosto: 'nenhum' };

describe('compositor com marcações na escala da arte', () => {
  afterEach(() => vi.restoreAllMocks());

  it('pede as marcações para a escala em que a foto aparece e usa a camada devolvida', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const camadaPadrao = fonteFalsa(2000, 3000), camadaNova = fonteFalsa(2000, 3000);
    const pedidos: number[] = [];
    const painel: PainelPronto = {
      fonte: fonteFalsa(2000, 3000), largura: 2000, altura: 3000,
      camadas: { foto: fonteFalsa(2000, 3000), marcacoes: camadaPadrao },
      marcacoesNaEscala: (e) => { pedidos.push(e); return camadaNova; },
    };
    const { ctx, desenhos } = ctxGravador();
    desenharArteSocial(ctx, opcoesArte, [painel], {}, 1);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]).toBeGreaterThan(0);
    expect(desenhos.some((d) => d.src === camadaNova)).toBe(true);
    expect(desenhos.some((d) => d.src === camadaPadrao)).toBe(false);
  });

  it('não refaz a camada enquanto a foto aparece no mesmo tamanho, e refaz quando o tamanho muda de verdade', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const pedidos: number[] = [];
    const painel: PainelPronto = {
      fonte: fonteFalsa(2000, 3000), largura: 2000, altura: 3000,
      camadas: { foto: fonteFalsa(2000, 3000), marcacoes: fonteFalsa(2000, 3000) },
      marcacoesNaEscala: (e) => { pedidos.push(e); return fonteFalsa(2000, 3000); },
    };
    const { ctx } = ctxGravador();
    desenharArteSocial(ctx, opcoesArte, [painel], {}, 1);
    desenharArteSocial(ctx, opcoesArte, [painel], {}, 0.6);
    expect(pedidos).toHaveLength(1);
    desenharArteSocial(ctx, { ...opcoesArte, enquadramentos: [{ zoom: 2, cx: 0.5, cy: 0.5 }] }, [painel], {}, 1);
    expect(pedidos).toHaveLength(2);
    expect(pedidos[1]).toBeGreaterThan(pedidos[0] * 1.5);
  });

  it('sem a função de refazer, vale a camada que veio com a foto', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const marcacoes = fonteFalsa(2000, 3000);
    const painel: PainelPronto = { fonte: fonteFalsa(2000, 3000), largura: 2000, altura: 3000, camadas: { foto: fonteFalsa(2000, 3000), marcacoes } };
    const { ctx, desenhos } = ctxGravador();
    desenharArteSocial(ctx, opcoesArte, [painel], {}, 1);
    expect(desenhos.some((d) => d.src === marcacoes)).toBe(true);
  });
});

describe('perfilDasMarcacoes', () => {
  it('sem leitura de pixels (jsdom, canvas sujo) devolve null em vez de quebrar', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(perfilDasMarcacoes(fonteFalsa(100, 100), 100, 100)).toBeNull();
    expect(perfilDasMarcacoes(fonteFalsa(0, 0), 0, 0)).toBeNull();
  });

  it('soma 1 por eixo e acusa onde está a marcação', () => {
    const w = 96, h = 96;
    const dados = new Uint8ClampedArray(w * h * 4);
    // marcação só no quadrante superior esquerdo
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) dados[(y * w + x) * 4 + 3] = 255;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
      return { drawImage: () => undefined, getImageData: () => ({ data: dados }) } as unknown as RenderingContext;
    } as never);
    const perfil = perfilDasMarcacoes(fonteFalsa(96, 96), 96, 96)!;
    expect(perfil.colunas.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
    expect(perfil.linhas.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
    expect(perfil.colunas.slice(0, 12).reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
    expect(perfil.linhas.slice(24).reduce((s, v) => s + v, 0)).toBeCloseTo(0, 9);
  });
});

describe('enquadramento que não corta o que foi medido', () => {
  const faixa = (de: number, ate: number): number[] => {
    const v = Array.from({ length: 48 }, (_, i) => (i >= de && i < ate ? 1 : 0));
    const soma = v.reduce((s, x) => s + x, 0);
    return v.map((x) => x / soma);
  };
  const perfil = (colunas: [number, number], linhas: [number, number]): PerfilMarcas => ({ colunas: faixa(...colunas), linhas: faixa(...linhas) });
  const caixa = { x: 0, y: 0, w: 474, h: 860 };

  it('a fração visível é 1 com tudo à vista e cai com o corte', () => {
    const j = janelaDaImagem(caixa, 900, 1200, 'preencher', { zoom: 1, cx: 0.5, cy: 0.5 });
    expect(fracaoVisivel(j, 900, 1200, perfil([20, 28], [10, 20]))).toBeCloseTo(1, 6);
    // marcações coladas na borda direita, onde a janela (centrada) já cortou
    expect(fracaoVisivel(j, 900, 1200, perfil([44, 48], [10, 20]))).toBeLessThan(0.9);
  });

  it('anda o centro para a marcação ficar à vista quando o enquadramento do rosto a cortaria', () => {
    const perfilDireita = perfil([34, 48], [10, 20]);
    const rosto = { cx: 0.5, cy: 0.2 };
    const centrado = fracaoVisivel(janelaDaImagem(caixa, 900, 1200, 'preencher', { zoom: 1, cx: 0.5, cy: 0.5 }), 900, 1200, perfilDireita);
    const r = enquadramentoAutomatico(caixa, 900, 1200, 'preencher', rosto, perfilDireita);
    expect(r.visivel).toBeGreaterThan(centrado);
    expect(r.visivel).toBeGreaterThanOrEqual(VISIVEL_MINIMO_PREENCHER);
    expect(r.enquadramento.cx).toBeGreaterThan(0.5);
  });

  it('mantém o enquadramento do rosto quando ele já mostra as marcações', () => {
    const r = enquadramentoAutomatico(caixa, 900, 1200, 'preencher', { cx: 0.5, cy: 0.2 }, perfil([20, 28], [8, 22]));
    expect(r.enquadramento.cx).toBeCloseTo(0.5, 9);
    expect(r.visivel).toBeCloseTo(1, 6);
  });

  it('marcações que não cabem na janela (fio de prumo da cabeça aos pés) ficam abaixo do mínimo: o diálogo escolhe a foto inteira', () => {
    const alta = enquadramentoAutomatico({ x: 0, y: 0, w: 750, h: 600 }, 900, 1200, 'preencher', { cx: 0.5, cy: 0.2 }, perfil([20, 28], [0, 48]));
    expect(alta.visivel).toBeLessThan(VISIVEL_MINIMO_PREENCHER);
  });

  it('na foto inteira nada é cortado e o enquadramento é o padrão; sem perfil vale o do rosto', () => {
    const inteira = enquadramentoAutomatico(caixa, 900, 1200, 'inteira', null, perfil([0, 4], [0, 4]));
    expect(inteira).toEqual({ enquadramento: { zoom: 1, cx: 0.5, cy: 0.5 }, visivel: 1 });
    const semPerfil = enquadramentoAutomatico(caixa, 900, 1200, 'preencher', { cx: 0.5, cy: 0.2 }, null);
    expect(semPerfil.visivel).toBe(1);
    expect(semPerfil.enquadramento.cx).toBe(0.5);
  });

  it('a média dos perfis das duas fotos serve às duas; sem nenhum perfil devolve null', () => {
    const m = perfilMedio([perfil([0, 4], [0, 4]), null, perfil([44, 48], [44, 48])])!;
    expect(m.colunas[0]).toBeCloseTo(0.125, 9);
    expect(m.colunas[47]).toBeCloseTo(0.125, 9);
    expect(m.colunas.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
    expect(perfilMedio([null, undefined])).toBeNull();
  });

  it('com as marcações localizadas, aceita cortar mais da foto para encher a caixa', () => {
    // caixa larga (972x590) para foto em pé 3:4: corta 55% da altura
    expect(ajusteSugerido(972, 590, 900, 1200)).toBe('inteira');
    expect(ajusteSugerido(972, 590, 900, 1200, PERDA_MAXIMA_PREENCHER_COM_MARCAS)).toBe('preencher');
    expect(PERDA_MAXIMA_PREENCHER_COM_MARCAS).toBeGreaterThan(PERDA_MAXIMA_PREENCHER);
  });
});

const medir = estimarLargura;
const base = (o: Partial<ParametrosLayout> = {}): ParametrosLayout => ({
  formato: 'story', layout: 'empilhada', nPaineis: 2, margensStories: true, titulo: 'Pós operatório de SLAP', tituloModo: 'vertical',
  rotulos: ['Pré-Sessão', 'Pós-Sessão'], datas: ['11/10/2026', '25/10/2026'], legenda: '3ª Semana de PO', temAvatar: false, temSelo: true,
  perfis: ['rafaelmocbel', 'myhealthid.app', 'physio.mocbel'], ...o,
});

describe('layout: cedilha e rodapé', () => {
  it('título vertical com cedilha (Ç) ganha coluna mais larga: a cedilha desce para o lado da foto e não pode encostar nela', () => {
    const sem = calcularLayoutSocial(base({ titulo: 'Avaliacao postural' }), medir);
    const com = calcularLayoutSocial(base({ titulo: 'Avaliação postural' }), medir);
    // o acento sobre a capital (Ã) também alarga; a cedilha acrescenta o seu: comparamos com um título só com acento
    const soAcento = calcularLayoutSocial(base({ titulo: 'Avaliacão postural' }), medir);
    expect(com.titulo!.caixa.w).toBeGreaterThan(soAcento.titulo!.caixa.w);
    expect(sem.titulo!.caixa.w).toBeLessThan(soAcento.titulo!.caixa.w);
    // a cedilha (0,16 do corpo) cabe entre a base das letras e a borda esquerda da primeira foto
    const t = com.titulo!;
    const baseDasLetras = t.ancora.x + (t.linhas.length - 1) * t.passo;
    expect(baseDasLetras + 0.16 * t.fonte).toBeLessThanOrEqual(com.paineis[0].x - 1);
    expect(com.rotulos.every((r) => r.caixa.x >= t.caixa.x + t.caixa.w - 0.5)).toBe(true);
  });

  it('a última linha dos perfis fica na mesma linha de base do texto da pílula', () => {
    for (const formato of ['story', 'feed', 'quadrado'] as const) {
      const l = calcularLayoutSocial(base({ formato }), medir);
      expect(l.pilula).not.toBeNull();
      const ultima = l.perfis!.linhas[l.perfis!.linhas.length - 1];
      expect(ultima.baseY).toBeCloseTo(l.pilula!.baseY, 6);
    }
  });

  it('o bloco dos perfis (três linhas) e a pílula continuam dentro do rodapé, sem invadir as fotos', () => {
    const l = calcularLayoutSocial(base(), medir);
    const topoPerfis = l.perfis!.linhas[0].baseY - ALTURA_CAPITAL.texto * l.perfis!.fonte;
    expect(topoPerfis).toBeGreaterThanOrEqual(l.rodape!.y - 0.5);
    const baseFotos = Math.max(...l.paineis.map((p) => p.y + p.h));
    expect(l.rodape!.y).toBeGreaterThan(baseFotos);
    expect(l.pilula!.caixa.y + l.pilula!.caixa.h).toBeLessThanOrEqual(l.rodape!.y + l.rodape!.h + 0.5);
    expect(l.pilula!.caixa.h).toBe(ALTURA_PILULA);
  });

  it('sem pílula, os perfis seguem a base de sempre; sem perfis, só a pílula', () => {
    const so = calcularLayoutSocial(base({ legenda: '' }), medir);
    expect(so.pilula).toBeNull();
    expect(so.perfis!.linhas).toHaveLength(3);
    const semPerfis = calcularLayoutSocial(base({ perfis: [] }), medir);
    expect(semPerfis.perfis).toBeNull();
    expect(semPerfis.pilula).not.toBeNull();
  });
});
