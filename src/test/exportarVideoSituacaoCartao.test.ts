import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepararRenderizador, type OpcoesExportarVideo } from '@/lib/angular/video/exportarVideo';
import { cartoesDeMetricas } from '@/lib/angular/analiseVideo/resultados';
import { situacaoDoCartaoTexto } from '@/lib/angular/analiseVideo/statusReferencia';
import type { CartaoMetricaUi } from '@/lib/angular/analiseVideo/tiposUi';
import { ALTURA_CARTAO_FONTES } from '@/lib/angular/video/exportarVideoPuro';
import { modeloDoGesto } from '@/lib/angular/video/modelos';
import { criarTrilha } from '@/lib/angular/video/trilha';
import { ESTILO_PADRAO } from '@/lib/angular/estilo';
import type { ResultadoMetrica } from '@/lib/angular/video/tipos';

/*
 * jsdom não tem canvas: cada canvas ganha um contexto que anota o que foi escrito (texto, posição, corpo, cor).
 * Assim dá para conferir que a situação do cartão no vídeo e no quadro PNG é a mesma frase da tela e do PDF, com o rótulo da fonte.
 */
interface Escrito { texto: string; x: number; y: number; corpo: number; cor: string }
const escritos: Escrito[] = [];
const contextos = new WeakMap<HTMLCanvasElement, unknown>();

const corpoDe = (font: unknown) => Number(/(\d+(?:\.\d+)?)px/.exec(String(font))?.[1] ?? 10);

function gravador(canvas: HTMLCanvasElement) {
  const estado: Record<string, unknown> = { font: '10px sans-serif', textAlign: 'start', fillStyle: '#000' };
  return new Proxy(estado, {
    get(t, p: string) {
      if (p in t) return t[p];
      if (p === 'canvas') return canvas;
      if (p === 'measureText') return (s: string) => ({ width: s.length * corpoDe(t.font) * 0.52 });
      if (p === 'fillText') {
        return (texto: string, x: number, y: number) => { escritos.push({ texto, x, y, corpo: corpoDe(t.font), cor: String(t.fillStyle) }); };
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

const cartoesDe = (velocidade: number, cadencia: number): CartaoMetricaUi[] =>
  cartoesDeMetricas([metrica('velocidade_marcha', 'Velocidade estimada', velocidade, 'cm/s'), metrica('cadencia', 'Cadência', cadencia, 'passos/min')], modelo);

// dentro só da faixa de 2011, dentro das duas, fora das duas; cadência acima e abaixo do limiar
const lista = [...cartoesDe(100, 109), ...cartoesDe(135, 88), ...cartoesDe(150, 100), ...cartoesDe(90, 130)];

const trilhaDe = (w: number, h: number) => criarTrilha(30, w, h, Array.from({ length: 30 }, (_, i) => ({ i, t: i / 30, pontos: {} })));

const opcoes = (formato: OpcoesExportarVideo['formato'], cartoes: CartaoMetricaUi[], larguraVideo = 960): OpcoesExportarVideo => ({
  video: document.createElement('video'), trilha: trilhaDe(larguraVideo, Math.round((larguraVideo * 9) / 16)), definicoes: [], estilo: ESTILO_PADRAO, formato, velocidade: 1,
  mostrarGrafico: false, mostrarMetricas: true, modoRosto: 'tarja', intervalo: { inicio: 0, fim: 0.9 }, titulo: 'Marcha (caminhada)', cartoes,
  ...(formato === 'original' ? {} : { moldura: { autorizado: true, margensStories: true, titulo: 'Marcha', legenda: '3ª semana', perfis: ['rafaelmocbel'] } }),
});

/** As linhas da situação de um cartão: a frase esperada inteira, numa linha ou repartida em duas linhas consecutivas e alinhadas. */
function linhasDaFrase(frase: string): Escrito[] | null {
  for (let i = 0; i < escritos.length; i++) {
    if (escritos[i].texto === frase) return [escritos[i]];
    const seguinte = escritos[i + 1];
    if (seguinte && seguinte.x === escritos[i].x && `${escritos[i].texto} ${seguinte.texto}` === frase) return [escritos[i], seguinte];
  }
  return null;
}

const FORMATOS_TESTADOS = ['original', 'story', 'feed', 'quadrado'] as const;

/** Os cartões que aparecem de fato: se faltar espaço, o último espaço vira "+N métricas no PDF" e esconde o resto. */
const cartoesDesenhados = (visiveis: number) => (lista.length > visiveis ? lista.slice(0, visiveis - 1) : lista);

describe('cartão do vídeo exportado: a situação é a mesma frase da tela e do PDF', () => {
  for (const formato of FORMATOS_TESTADOS) {
    it(`${formato}: toda situação sai inteira, com o rótulo da fonte, sem corte e sem reticências`, async () => {
      const r = await prepararRenderizador(opcoes(formato, lista), document.createElement('video'));
      expect(cartoesDesenhados(r.layout.cartoesVisiveis).length).toBeGreaterThan(0);
      for (const c of cartoesDesenhados(r.layout.cartoesVisiveis)) {
        const frase = situacaoDoCartaoTexto(c);
        expect(frase, c.titulo).toMatch(/\(.+\)$/);
        const linhas = linhasDaFrase(frase);
        expect(linhas, `${formato}: "${frase}" não foi escrita inteira`).not.toBeNull();
        for (const l of linhas ?? []) expect(l.texto.includes('…')).toBe(false);
      }
      expect(escritos.some((e) => /^(dentro|fora) da faixa das médias do estudo$|^(acima|abaixo) do limiar de 100 passos\/min$/.test(e.texto))).toBe(false);
      r.liberar();
    });

    it(`${formato}: a linha de referência é neutra (sem o verde de "dentro") e as linhas de texto não se sobrepõem`, async () => {
      const r = await prepararRenderizador(opcoes(formato, lista), document.createElement('video'));
      const { layout } = r;
      if (!layout.cartoes) throw new Error('layout sem cartões');
      const referencias = escritos.filter((e) => /cm\/s · (Bohannon|Tudor-Locke)/.test(e.texto) || /^≥ 100 passos\/min · /.test(e.texto));
      expect(referencias.length).toBeGreaterThan(0);
      for (const ref of referencias) expect(ref.cor, ref.texto).not.toBe('rgba(167,243,208,0.92)');
      // a linha de referência fica abaixo da última linha da situação do mesmo cartão e dentro do cartão
      for (const c of cartoesDesenhados(layout.cartoesVisiveis)) {
        const linhas = linhasDaFrase(situacaoDoCartaoTexto(c));
        if (!linhas) continue;
        const ultima = linhas[linhas.length - 1];
        const ref = escritos.find((e) => e.y > ultima.y && e.x === ultima.x && /PMID|passos\/min ·/.test(e.texto));
        expect(ref, `${formato}: sem linha de referência abaixo de "${ultima.texto}"`).toBeDefined();
        if (!ref) continue;
        expect(ref.y - ultima.y, 'entrelinha mínima entre a situação e a referência').toBeGreaterThanOrEqual(ultima.corpo * 0.9);
        const linhaDoCartao = Math.floor((ultima.y - layout.cartoes.y) / (layout.alturaCartao + layout.espacoCartoes));
        const fundo = layout.cartoes.y + linhaDoCartao * (layout.alturaCartao + layout.espacoCartoes) + layout.alturaCartao;
        expect(ref.y).toBeLessThan(fundo);
      }
      r.liberar();
    });
  }

  it('cartão largo (uma coluna, vídeo de 480 px): a frase cabe numa linha e o cartão não ganha a segunda', async () => {
    const r = await prepararRenderizador(opcoes('original', lista, 480), document.createElement('video'));
    expect(r.layout.colunas).toBe(1);
    expect(r.layout.alturaCartao).toBe(Math.round(r.layout.fonte * ALTURA_CARTAO_FONTES.comSituacao));
    for (const c of cartoesDesenhados(r.layout.cartoesVisiveis)) {
      const frase = situacaoDoCartaoTexto(c);
      expect(linhasDaFrase(frase), frase).toHaveLength(1);
    }
    r.liberar();
  });

  it('cartão de duas colunas: a frase com a fonte quebra em duas linhas e o cartão reserva a segunda', async () => {
    const r = await prepararRenderizador(opcoes('original', lista), document.createElement('video'));
    expect(r.layout.colunas).toBe(2);
    expect(r.layout.alturaCartao).toBe(Math.round(r.layout.fonte * ALTURA_CARTAO_FONTES.comSituacaoEmDuasLinhas));
    expect(linhasDaFrase(situacaoDoCartaoTexto(lista[0])), 'velocidade').toHaveLength(2);
    r.liberar();
  });
});
