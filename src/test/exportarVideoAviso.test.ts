import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepararRenderizador, type OpcoesExportarVideo } from '@/lib/angular/video/exportarVideo';
import { RODAPE_VIDEO, RODAPE_VIDEO_COM_AVISO } from '@/lib/angular/video/exportarVideoPuro';
import { cartoesDeMetricas } from '@/lib/angular/analiseVideo/resultados';
import { modeloDoGesto } from '@/lib/angular/video/modelos';
import { criarTrilha } from '@/lib/angular/video/trilha';
import { ESTILO_PADRAO } from '@/lib/angular/estilo';
import { FORMATOS, zonaSeguraDoTexto } from '@/lib/social/formatos';
import type { ResultadoMetrica } from '@/lib/angular/video/tipos';

/*
 * jsdom não tem canvas: cada canvas ganha um contexto que só anota o que foi escrito (texto, posição, corpo da letra, alinhamento).
 * Assim dá para conferir, formato por formato, onde o aviso do vídeo cai de fato no quadro que vai para o arquivo.
 */
interface Escrito { texto: string; x: number; y: number; corpo: number; alinhamento: string; largura: number; altura: number }
const escritos: Escrito[] = [];
const contextos = new WeakMap<HTMLCanvasElement, unknown>();

const corpoDe = (font: unknown) => Number(/(\d+(?:\.\d+)?)px/.exec(String(font))?.[1] ?? 10);

function gravador(canvas: HTMLCanvasElement) {
  const estado: Record<string, unknown> = { font: '10px sans-serif', textAlign: 'start' };
  return new Proxy(estado, {
    get(t, p: string) {
      if (p in t) return t[p];
      if (p === 'canvas') return canvas;
      if (p === 'measureText') return (s: string) => ({ width: s.length * corpoDe(t.font) * 0.52 });
      if (p === 'fillText') {
        return (texto: string, x: number, y: number) => {
          escritos.push({ texto, x, y, corpo: corpoDe(t.font), alinhamento: String(t.textAlign), largura: canvas.width, altura: canvas.height });
        };
      }
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop: () => {} });
      return () => undefined;
    },
    set(t, p: string, v) { t[p] = v; return true; },
  });
}

beforeEach(() => {
  escritos.length = 0;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    if (!contextos.has(this)) contextos.set(this, gravador(this));
    return contextos.get(this) as never;
  });
});
afterEach(() => { vi.restoreAllMocks(); });

const modelo = modeloDoGesto('marcha');
const metrica = (id: string, nome: string, valor: number, unidade: string): ResultadoMetrica => ({ id, metrica: id, nome, valor, unidade, lado: null, avisos: [] });
const cartoes = cartoesDeMetricas([metrica('velocidade_marcha', 'Velocidade estimada', 100, 'cm/s'), metrica('cadencia', 'Cadência', 88, 'passos/min')], modelo);
const trilha = criarTrilha(30, 960, 540, Array.from({ length: 30 }, (_, i) => ({ i, t: i / 30, pontos: {} })));

const opcoes = (formato: OpcoesExportarVideo['formato'], extra: Partial<OpcoesExportarVideo> = {}): OpcoesExportarVideo => ({
  video: document.createElement('video'), trilha, definicoes: [], estilo: ESTILO_PADRAO, formato, velocidade: 1, mostrarGrafico: false, mostrarMetricas: true,
  modoRosto: 'tarja', intervalo: { inicio: 0, fim: 0.9 }, titulo: 'Marcha (caminhada)', cartoes,
  ...(formato === 'original' ? {} : { moldura: { autorizado: true, margensStories: true, titulo: 'Marcha', legenda: '3ª semana', perfis: ['rafaelmocbel'] } }),
  ...extra,
});

const avisoEscrito = (texto: string) => escritos.filter((e) => e.texto === texto);

describe('aviso "Estimativa por vídeo · não é diagnóstico" no quadro do vídeo exportado', () => {
  it('a frase é a mesma em toda saída; o asterisco das ressalvas só a acrescenta', () => {
    expect(RODAPE_VIDEO).toBe('Estimativa por vídeo · não é diagnóstico');
    expect(RODAPE_VIDEO_COM_AVISO.startsWith(`${RODAPE_VIDEO} · `)).toBe(true);
  });

  for (const formato of ['original', 'story', 'feed', 'quadrado'] as const) {
    it(`${formato}: o aviso é escrito inteiro, centralizado, com corpo proporcional ao quadro`, async () => {
      const r = await prepararRenderizador(opcoes(formato), document.createElement('video'));
      const chamadas = avisoEscrito(RODAPE_VIDEO);
      expect(chamadas, 'uma só vez no quadro').toHaveLength(1);
      const a = chamadas[0];
      expect(a.alinhamento).toBe('center');
      // largura do quadro onde o texto foi escrito: o canvas de saída (formatos sociais) ou o próprio quadro composto (original)
      expect(a.x).toBeCloseTo(a.largura / 2, 0);
      // proporcional ao quadro (2,4% da largura) e nunca menor que 1,85% (o corpo só encolhe para o texto caber)
      expect(a.corpo).toBeGreaterThanOrEqual(a.largura * 0.0185);
      expect(a.corpo).toBeLessThanOrEqual(a.largura * 0.03);
      // cabe dentro do quadro com folga nas laterais
      expect(a.texto.length * a.corpo * 0.52).toBeLessThanOrEqual(a.largura - 2 * 8);
      expect(r.altura).toBe(formato === 'original' ? r.layout.altura : FORMATOS[formato].altura);
      r.liberar();
    });
  }

  it('story: o aviso fica fora das faixas que o Instagram cobre (14% de cima e 20% de baixo) e longe das bordas', async () => {
    const r = await prepararRenderizador(opcoes('story'), document.createElement('video'));
    const [a] = avisoEscrito(RODAPE_VIDEO);
    const zona = zonaSeguraDoTexto('story');
    expect(zona).toEqual({ topo: 269, base: 1536 });
    expect(r.largura).toBe(1080);
    expect(r.altura).toBe(1920);
    expect(a.y).toBeGreaterThan(zona.topo);
    expect(a.y + a.corpo * 0.3).toBeLessThanOrEqual(zona.base);
    // folga que sobra até o início da faixa de baixo: a faixa do Instagram é aproximada
    expect(zona.base - a.y).toBeGreaterThanOrEqual(30);
    expect(1920 - a.y).toBeGreaterThan(1920 * 0.2);
    r.liberar();
  });

  it('feed e quadrado: o aviso fica dentro da arte, a mais de 48 px da borda de baixo, sem cobrir o quadro do conteúdo', async () => {
    for (const formato of ['feed', 'quadrado'] as const) {
      const r = await prepararRenderizador(opcoes(formato), document.createElement('video'));
      const [a] = avisoEscrito(RODAPE_VIDEO);
      expect(FORMATOS[formato].altura - a.y, formato).toBeGreaterThanOrEqual(48);
      const caixa = r.naSaida({ x: 0, y: 0, w: r.layout.largura, h: r.layout.altura });
      expect(a.y - a.corpo, formato).toBeGreaterThanOrEqual(caixa.y + caixa.h);
      r.liberar();
      escritos.length = 0;
    }
  });

  it('original: o aviso tem faixa própria no pé do quadro, abaixo dos cartões, longe da borda de baixo', async () => {
    const r = await prepararRenderizador(opcoes('original'), document.createElement('video'));
    const [a] = avisoEscrito(RODAPE_VIDEO);
    const rodape = r.layout.rodape;
    expect(rodape).not.toBeNull();
    if (!rodape || !r.layout.cartoes) throw new Error('layout sem rodapé ou cartões');
    expect(a.y).toBeGreaterThan(rodape.y);
    expect(a.y).toBeLessThan(rodape.y + rodape.h);
    expect(rodape.y).toBeGreaterThanOrEqual(r.layout.cartoes.y + r.layout.cartoes.h);
    expect(r.altura - a.y).toBeGreaterThan(a.corpo * 1.2);
    expect(a.corpo).toBeGreaterThanOrEqual(Math.round(r.largura * 0.024) - 1);
    r.liberar();
  });

  it('com ressalvas numa métrica o aviso leva o complemento "* ver ressalvas no PDF", sem cortar a frase fixa', async () => {
    const comAviso = cartoes.map((c, i) => (i === 0 ? { ...c, avisos: ['Poucos ciclos.'] } : c));
    for (const formato of ['original', 'story'] as const) {
      const r = await prepararRenderizador(opcoes(formato, { cartoes: comAviso }), document.createElement('video'));
      const chamadas = avisoEscrito(RODAPE_VIDEO_COM_AVISO);
      expect(chamadas, formato).toHaveLength(1);
      expect(chamadas[0].texto.startsWith(RODAPE_VIDEO)).toBe(true);
      r.liberar();
      escritos.length = 0;
    }
  });
});

describe('cartões do vídeo: situação neutra e igual nos dois lados', () => {
  it('faixa de médias e limiar: dentro e fora ganham texto neutro com a fonte, nunca "dentro/fora do limiar"', async () => {
    const lista = cartoesDeMetricas([
      metrica('velocidade_marcha', 'Velocidade estimada', 100, 'cm/s'),
      metrica('cadencia', 'Cadência', 109, 'passos/min'),
    ], modelo).concat(cartoesDeMetricas([
      metrica('velocidade_marcha', 'Velocidade estimada', 150, 'cm/s'),
      metrica('cadencia', 'Cadência', 88, 'passos/min'),
    ], modelo));
    const r = await prepararRenderizador(opcoes('original', { cartoes: lista }), document.createElement('video'));
    const textos = escritos.map((e) => e.texto);
    expect(textos.some((t) => /^dentro da faixa das médias do estudo/.test(t))).toBe(true);
    expect(textos.some((t) => /^fora da faixa das médias do estudo/.test(t))).toBe(true);
    expect(textos.some((t) => /^acima do limiar de 100 passos\/min/.test(t))).toBe(true);
    expect(textos.some((t) => /^abaixo do limiar de 100 passos\/min/.test(t))).toBe(true);
    expect(textos.some((t) => /(dentro|fora) do limiar|médias de grupos/.test(t))).toBe(false);
    // quando o rótulo não cabe na linha da situação, a linha da referência logo abaixo sempre traz a fonte
    for (const i of textos.keys()) {
      if (/^(dentro|fora) da faixa das médias do estudo|^(acima|abaixo) do limiar/.test(textos[i]) && !/\(.+\)$/.test(textos[i])) expect(textos[i + 1]).toMatch(/Bohannon|Tudor-Locke/);
    }
    r.liberar();
  });
});
