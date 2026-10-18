import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ajusteTotalDoRosto, prepararRenderizador, type OpcoesExportarVideo } from '@/lib/angular/video/exportarVideo';
import { caixaFixaNaPosicao, tamanhoCobertoDaCaixaFixa } from '@/lib/angular/video/caixaFixaRosto';
import { configurar, trilhaSintetica } from '@/lib/angular/video/figuraSintetica';
import { ESTILO_PADRAO } from '@/lib/angular/estilo';

/*
 * jsdom não tem canvas: cada canvas ganha um contexto que só anota o que foi desenhado. Aqui interessa onde a cobertura do rosto
 * (a tarja) é pintada em cada quadro, e se mover a caixa fixa muda só os quadros em que o rosto não foi localizado.
 */
interface Chamada { nome: string; args: unknown[]; canvas: HTMLCanvasElement }
const chamadas: Chamada[] = [];
const contextos = new WeakMap<HTMLCanvasElement, unknown>();

function gravador(canvas: HTMLCanvasElement) {
  const estado: Record<string, unknown> = { font: '10px sans-serif', textAlign: 'start' };
  return new Proxy(estado, {
    get(t, p: string) {
      if (p in t) return t[p];
      if (p === 'canvas') return canvas;
      if (p === 'measureText') return (s: string) => ({ width: s.length * 5 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop: () => {} });
      return (...args: unknown[]) => { chamadas.push({ nome: p, args, canvas }); };
    },
    set(t, p: string, v) { t[p] = v; return true; },
  });
}

beforeEach(() => {
  chamadas.length = 0;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
    if (!contextos.has(this)) contextos.set(this, gravador(this));
    return contextos.get(this) as never;
  });
});
afterEach(() => { vi.restoreAllMocks(); });

const SEM_ROSTO = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
// 3 s a 30 q/s: rosto localizado até 1 s; depois nenhum ponto do rosto (a partir de 1,5 s só há vizinho antes, então a origem é 'fixa').
const trilha = trilhaSintetica(configurar('agachamento', { largura: 540, altura: 960 }), 30, 3, { ausentes: (t) => (t >= 1 ? SEM_ROSTO : false) });
const QUADRO_COM_ROSTO = 5;
const QUADRO_SEM_ROSTO = 80;

const opcoes = (extra: Partial<OpcoesExportarVideo> = {}): OpcoesExportarVideo => ({
  video: document.createElement('video'), trilha, definicoes: [], estilo: ESTILO_PADRAO, formato: 'original', velocidade: 1, mostrarGrafico: false, mostrarMetricas: false,
  modoRosto: 'tarja', intervalo: { inicio: 0, fim: 2.9 }, titulo: 'Agachamento', ...extra,
});

/** Onde a tarja foi pintada: o primeiro `moveTo` do caminho arredondado é (x + raio, y), com raio = 16% do menor lado. */
function tarjaPintada(r: { saida: HTMLCanvasElement }, esperado: { x: number; y: number; w: number; h: number }) {
  const k = Math.min(esperado.w, esperado.h) * 0.16;
  return chamadas.some((c) => c.nome === 'moveTo' && Math.abs((c.args[0] as number) - (esperado.x + k)) < 0.01 && Math.abs((c.args[1] as number) - esperado.y) < 0.01);
}

describe('caixa fixa do rosto no renderizador', () => {
  it('a origem do quadro diz onde a cobertura usa a caixa fixa', async () => {
    const r = await prepararRenderizador(opcoes(), document.createElement('video'));
    expect(r.origemDoQuadro(QUADRO_COM_ROSTO)).toBe('pose');
    expect(r.origemDoQuadro(QUADRO_SEM_ROSTO)).toBe('fixa');
    expect(r.resumoRosto.semRosto).toBe(true);
    r.liberar();
  });

  it('a área do vídeo no canvas fica dentro do canvas e a prévia a informa para posicionar a caixa', async () => {
    const r = await prepararRenderizador(opcoes(), document.createElement('video'));
    const a = r.areaVideo;
    expect(a.w).toBeGreaterThan(0);
    expect(a.x).toBeGreaterThanOrEqual(0);
    expect(a.y).toBeGreaterThanOrEqual(0);
    expect(a.x + a.w).toBeLessThanOrEqual(r.largura + 1e-6);
    expect(a.y + a.h).toBeLessThanOrEqual(r.altura + 1e-6);
    // a proporção do vídeo é mantida
    expect(a.w / a.h).toBeCloseTo(540 / 960, 2);
    r.liberar();
  });

  it('nos formatos do Instagram a área do vídeo fica dentro da moldura (e não no canvas inteiro)', async () => {
    const r = await prepararRenderizador(opcoes({ formato: 'story', moldura: { autorizado: true, margensStories: true } }), document.createElement('video'));
    expect(r.largura).toBe(1080);
    expect(r.altura).toBe(1920);
    expect(r.areaVideo.w).toBeLessThan(1080);
    expect(r.areaVideo.x).toBeGreaterThan(0);
    r.liberar();
  });

  it('a caixa fixa escolhida vale para os quadros sem rosto localizado e a tarja é pintada nela', async () => {
    const caixaFixa = caixaFixaNaPosicao(540, 960, { cx: 0.62, cy: 0.35 });
    const r = await prepararRenderizador(opcoes({ caixaFixa }), document.createElement('video'));
    const coberta = r.rostoNaSaida(QUADRO_SEM_ROSTO);
    expect(coberta).not.toBeNull();
    const tamanho = tamanhoCobertoDaCaixaFixa(caixaFixa, ajusteTotalDoRosto({}));
    const a = r.areaVideo;
    expect(coberta!.x + coberta!.w / 2).toBeCloseTo(a.x + 0.62 * a.w, 3);
    expect(coberta!.y + coberta!.h / 2).toBeCloseTo(a.y + 0.35 * a.h, 3);
    expect(coberta!.w).toBeCloseTo(tamanho.w * a.w, 3);
    expect(coberta!.h).toBeCloseTo(tamanho.h * a.h, 3);
    chamadas.length = 0;
    r.desenhar(QUADRO_SEM_ROSTO);
    expect(tarjaPintada(r, coberta!)).toBe(true);
    r.liberar();
  });

  it('mover a caixa fixa muda o que é coberto nos quadros sem rosto e não mexe nos quadros com rosto localizado', async () => {
    const r = await prepararRenderizador(opcoes(), document.createElement('video'));
    const comRostoAntes = r.rostoNaSaida(QUADRO_COM_ROSTO);
    const semRostoAntes = r.rostoNaSaida(QUADRO_SEM_ROSTO)!;
    r.definirCaixaFixa(caixaFixaNaPosicao(540, 960, { cx: 0.7, cy: 0.5 }));
    const semRostoDepois = r.rostoNaSaida(QUADRO_SEM_ROSTO)!;
    const a = r.areaVideo;
    expect(semRostoDepois.x + semRostoDepois.w / 2).toBeCloseTo(a.x + 0.7 * a.w, 3);
    expect(semRostoDepois.y + semRostoDepois.h / 2).toBeCloseTo(a.y + 0.5 * a.h, 3);
    expect(semRostoDepois).not.toEqual(semRostoAntes);
    expect(r.rostoNaSaida(QUADRO_COM_ROSTO)).toEqual(comRostoAntes);
    chamadas.length = 0;
    r.desenhar(QUADRO_SEM_ROSTO);
    expect(tarjaPintada(r, semRostoDepois)).toBe(true);
    expect(tarjaPintada(r, semRostoAntes)).toBe(false);
    r.liberar();
  });

  it('sem argumento volta à caixa de partida (ou à que veio nas opções)', async () => {
    const inicial = caixaFixaNaPosicao(540, 960, { cx: 0.3, cy: 0.3 });
    const r = await prepararRenderizador(opcoes({ caixaFixa: inicial }), document.createElement('video'));
    const original = r.rostoNaSaida(QUADRO_SEM_ROSTO);
    r.definirCaixaFixa(caixaFixaNaPosicao(540, 960, { cx: 0.8, cy: 0.8 }));
    expect(r.rostoNaSaida(QUADRO_SEM_ROSTO)).not.toEqual(original);
    r.definirCaixaFixa();
    expect(r.rostoNaSaida(QUADRO_SEM_ROSTO)).toEqual(original);
    r.liberar();
  });

  it('mover a caixa não muda a contagem de quadros sem rosto (o aviso e a conferência continuam valendo)', async () => {
    const r = await prepararRenderizador(opcoes(), document.createElement('video'));
    const antes = r.resumoRosto;
    r.definirCaixaFixa(caixaFixaNaPosicao(540, 960, { cx: 0.9, cy: 0.9 }));
    expect(r.resumoRosto).toEqual(antes);
    expect(antes.semRosto).toBe(true);
    expect(r.caixas.filter((c) => c.origem === 'fixa').length).toBeGreaterThan(0);
    r.liberar();
  });

  it('com o rosto à mostra (modo "nenhum") nada é coberto, nem pela caixa fixa', async () => {
    const r = await prepararRenderizador(opcoes({ modoRosto: 'nenhum', autorizado: true }), document.createElement('video'));
    expect(r.rostoNaSaida(QUADRO_SEM_ROSTO)).toBeNull();
    r.definirCaixaFixa(caixaFixaNaPosicao(540, 960, { cx: 0.5, cy: 0.5 }));
    expect(r.rostoNaSaida(QUADRO_SEM_ROSTO)).toBeNull();
    r.liberar();
  });

  it('a proteção falha fechada: se o desfoque não consegue trabalhar, a tarja cobre a área da caixa movida', async () => {
    const caixaFixa = caixaFixaNaPosicao(540, 960, { cx: 0.55, cy: 0.3 });
    const r = await prepararRenderizador(opcoes({ modoRosto: 'desfoque', caixaFixa }), document.createElement('video'));
    const coberta = r.rostoNaSaida(QUADRO_SEM_ROSTO)!;
    // os canvas temporários do desfoque (criados durante o desenho) não ganham contexto: o desfoque desiste e a tarja entra no lugar
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) { return (contextos.get(this) ?? null) as never; });
    chamadas.length = 0;
    r.desenhar(QUADRO_SEM_ROSTO);
    expect(tarjaPintada(r, coberta)).toBe(true);
    r.liberar();
  });
});
