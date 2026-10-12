import { describe, expect, it } from 'vitest';
import { dominioDoEixoY, layoutDoGrafico, passoBonito, ticksDoEixo, valorNoTempo, type SerieGrafico } from '../lib/angular/analiseVideo/graficoLayout';
import {
  ajustarIntervalo, avisosDoVideo, estimativaDoRastreio, indiceMaisProximo, intervaloEntreQuadrosMs, intervaloPadrao, marcasDoScrubber, opcoesDeTaxa,
  quadrosDoDeslize, sensibilidadeDoDeslize, tempoDeExibicao,
} from '../lib/angular/analiseVideo/tempo';
import {
  APP_ANALISE, VERSAO_ANALISE, chaveDoRascunho, lerAnaliseSalva, mesmaImpressao, nomeArquivoAnalise, serializarAnalise,
} from '../lib/angular/analiseVideo/persistencia';
import { fpsMaisProximo, fpsPorIntervalos } from '../lib/angular/analiseVideo/carregarVideo';
import type { TrilhaPose } from '../lib/angular/video/tipos';

const trilha = (n = 5): TrilhaPose => ({
  fps: 30, largura: 640, altura: 480,
  quadros: Array.from({ length: n }, (_, i) => ({ i, t: i / 30, pontos: { joelho_d: { x: 100.123456 + i, y: 200.987654, conf: 0.9 }, quadril_d: { x: 300.5, y: 250.25, conf: 1, manual: true, auto: { x: 299.987, y: 251.111, conf: 0.8 } } } })),
});
const video = { nome: 'a.webm', tamanho: 1000, duracao: 6, largura: 640, altura: 480 };

describe('layout do gráfico ângulo x tempo', () => {
  const serie = (id: string, f: (t: number) => number | null): SerieGrafico => ({ id, rotulo: id, cor: '#2A78D6', pontos: Array.from({ length: 61 }, (_, i) => ({ t: i / 10, v: f(i / 10) })) });

  it('passo e marcas do eixo são números redondos', () => {
    expect(passoBonito(100, 4)).toBe(25);
    expect(passoBonito(60, 4)).toBe(20);
    expect(passoBonito(0, 4)).toBe(1);
    expect(ticksDoEixo(0, 60, 4)).toEqual([0, 20, 40, 60]);
    expect(ticksDoEixo(-20, 40, 4)).toEqual([-20, 0, 20, 40]);
  });

  it('o domínio do Y contém todos os dados e termina em marcas redondas', () => {
    const d = dominioDoEixoY([serie('a', (t) => 10 + 50 * Math.sin(t))]);
    expect(d.min).toBeLessThanOrEqual(-40);
    expect(d.max).toBeGreaterThanOrEqual(60);
    expect(d.min % passoBonito(d.max - d.min, 4)).toBeCloseTo(0, 6);
  });

  it('faixa de referência distante dos dados não achata a curva', () => {
    const s = serie('a', () => 30);
    const sem = dominioDoEixoY([s]);
    const longe = dominioDoEixoY([s], [{ id: 'b', min: 500, max: 600, rotulo: 'x' }]);
    expect(longe).toEqual(sem);
    const perto = dominioDoEixoY([serie('a', (t) => 30 + t)], [{ id: 'b', min: 20, max: 45, rotulo: 'x' }]);
    expect(perto.min).toBeLessThanOrEqual(20);
  });

  it('série constante e série vazia têm domínio válido', () => {
    const d = dominioDoEixoY([serie('a', () => 42)]);
    expect(d.max).toBeGreaterThan(d.min);
    expect(dominioDoEixoY([])).toEqual({ min: 0, max: 1 });
  });

  it('o caminho quebra nas lacunas (null) em vez de ligar pontos distantes', () => {
    const s = serie('a', (t) => (t >= 2 && t < 3 ? null : t * 5));
    const l = layoutDoGrafico([s], [], [], { largura: 360, altura: 180, duracao: 6 });
    const d = l.caminhos[0].d;
    expect((d.match(/M/g) ?? []).length).toBe(2);
  });

  it('x e tempo são inversos; marcadores fora do trecho somem; bandas viram faixas dentro do gráfico', () => {
    const s = serie('a', (t) => 20 + 40 * Math.sin(t));
    const l = layoutDoGrafico([s], [
      { id: 'e1', t: 1, tipo: 'contato', lado: 'D' }, { id: 'e2', t: 9, tipo: 'saida', lado: 'E' },
    ], [{ id: 'ref', min: 10, max: 30, rotulo: '10–30°' }, { id: 'sem', min: 900, max: 950, rotulo: 'fora' }], { largura: 360, altura: 180, duracao: 6 });
    expect(l.tempoDoX(l.xDoTempo(2.5))).toBeCloseTo(2.5, 9);
    expect(l.marcadores.map((m) => m.id)).toEqual(['e1']);
    expect(l.bandas).toHaveLength(1);
    expect(l.bandas[0].y0).toBeLessThan(l.bandas[0].y1);
    expect(l.bandas[0].y0).toBeGreaterThanOrEqual(l.area.y0 - 1e-6);
    expect(l.bandas[0].y1).toBeLessThanOrEqual(l.area.y1 + 1e-6);
    for (const tk of l.ticksY) expect(tk.rotulo.endsWith('°')).toBe(true);
  });

  it('valorNoTempo interpola entre os quadros e respeita lacunas', () => {
    const s: SerieGrafico = { id: 'a', rotulo: 'a', cor: '#000', pontos: [{ t: 0, v: 0 }, { t: 1, v: 10 }, { t: 2, v: null }, { t: 3, v: 30 }] };
    expect(valorNoTempo(s, 0.5)).toBeCloseTo(5, 9);
    expect(valorNoTempo(s, 1.5)).toBeNull();
    expect(valorNoTempo(s, -1)).toBe(0);
    expect(valorNoTempo(s, 9)).toBe(30);
  });
});

describe('tempo e quadros do player', () => {
  it('acha o quadro mais próximo do tempo', () => {
    const t = [0, 0.1, 0.2, 0.3];
    expect(indiceMaisProximo(t, -1)).toBe(0);
    expect(indiceMaisProximo(t, 0.14)).toBe(1);
    expect(indiceMaisProximo(t, 0.16)).toBe(2);
    expect(indiceMaisProximo(t, 9)).toBe(3);
    expect(indiceMaisProximo([], 1)).toBe(0);
  });

  it('o instante de exibição cai dentro do quadro (nunca no anterior)', () => {
    const fps = 30;
    for (let i = 1; i < 90; i++) {
      const t = i / fps, e = tempoDeExibicao(t, fps);
      expect(Math.floor(e * fps + 1e-9)).toBe(i);
    }
  });

  it('câmera lenta alonga o intervalo entre quadros', () => {
    expect(intervaloEntreQuadrosMs(30, 1)).toBeCloseTo(33.33, 1);
    expect(intervaloEntreQuadrosMs(30, 0.25)).toBeCloseTo(133.33, 1);
    expect(intervaloEntreQuadrosMs(30, 0.1)).toBeCloseTo(333.33, 1);
  });

  it('deslizar o dedo avança ou volta quadros, sem tremor', () => {
    expect(quadrosDoDeslize(11, 12)).toBe(0);
    expect(quadrosDoDeslize(25, 12)).toBe(2);
    expect(quadrosDoDeslize(-25, 12)).toBe(-2);
    expect(sensibilidadeDoDeslize(360, 180)).toBe(6);
    expect(sensibilidadeDoDeslize(360, 30)).toBe(18);
  });

  it('marcas do scrubber: eventos e quadros corrigidos em percentual', () => {
    const m = marcasDoScrubber(101, [50], [{ i: 0, tipo: 'contato', lado: 'D' }, { i: 100, tipo: 'saida', lado: 'E' }]);
    expect(m.map((x) => [x.tipo, x.pct])).toEqual([['contato', 0], ['saida', 100], ['corrigido', 50]]);
    expect(marcasDoScrubber(0, [], [])).toEqual([]);
    expect(marcasDoScrubber(1, [0], [])[0].pct).toBe(0);
  });

  it('avisa (sem bloquear) vídeo longo, 4K e arquivo grande', () => {
    expect(avisosDoVideo({ duracao: 10, largura: 1280, altura: 720, tamanho: 5e6 })).toEqual({ nivel: 'ok', mensagens: [] });
    const a = avisosDoVideo({ duracao: 75, largura: 3840, altura: 2160, tamanho: 400 * 1024 * 1024 });
    expect(a.nivel).toBe('aviso');
    expect(a.mensagens).toHaveLength(3);
    expect(avisosDoVideo({ duracao: 0.3, largura: 640, altura: 480 }).mensagens[0]).toMatch(/curto/);
  });

  it('o trecho padrão e o ajuste respeitam o limite de 30 s', () => {
    expect(intervaloPadrao(75)).toEqual({ inicio: 0, fim: 30 });
    expect(intervaloPadrao(12)).toEqual({ inicio: 0, fim: 12 });
    expect(ajustarIntervalo({ inicio: 10, fim: 70 }, 75, 'inicio')).toEqual({ inicio: 10, fim: 40 });
    expect(ajustarIntervalo({ inicio: 10, fim: 70 }, 75, 'fim')).toEqual({ inicio: 40, fim: 70 });
    expect(ajustarIntervalo({ inicio: 5, fim: 4 }, 75, 'fim').fim).toBeGreaterThan(5);
  });

  it('taxas de amostragem nunca passam do que o vídeo tem', () => {
    expect(opcoesDeTaxa(24).map((o) => o.fps)).toEqual([24]);
    expect(opcoesDeTaxa(30).map((o) => o.fps)).toEqual([30]);
    expect(opcoesDeTaxa(60).map((o) => o.fps)).toEqual([30, 60]);
    expect(opcoesDeTaxa(240).map((o) => o.fps)).toEqual([30, 60, 120]);
    expect(estimativaDoRastreio(10, 30)).toBe(25);
  });
});

describe('salvar e retomar a análise', () => {
  it('ida e volta preserva a trilha, as correções e os eventos', () => {
    const texto = serializarAnalise({ video, modeloId: 'marcha', fpsVideo: 30, intervalo: { inicio: 0, fim: 6 }, trilha: trilha(), eventos: [{ id: 'D-contato-15', tipo: 'contato', lado: 'D', i: 15, t: 0.5, sugerido: false }], cmPorPx: 0.2, extras: { articulacao: 'joelho' } });
    const r = lerAnaliseSalva(texto);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.analise.app).toBe(APP_ANALISE);
    expect(r.analise.versao).toBe(VERSAO_ANALISE);
    expect(r.analise.trilha.quadros).toHaveLength(5);
    expect(r.analise.trilha.quadros[2].pontos.quadril_d.manual).toBe(true);
    expect(r.analise.intervalo).toEqual({ inicio: 0, fim: 6 });
    expect(r.analise.eventos?.[0].sugerido).toBe(false);
    expect(r.analise.cmPorPx).toBe(0.2);
    expect(r.analise.extras.articulacao).toBe('joelho');
  });

  it('arredonda as coordenadas no arquivo e guarda a detecção original do ponto corrigido', () => {
    const original = trilha(2);
    const r = lerAnaliseSalva(serializarAnalise({ video, modeloId: 'marcha', fpsVideo: 30, intervalo: { inicio: 0, fim: 6 }, trilha: original, eventos: null, cmPorPx: null, extras: {} }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.analise.trilha.quadros[0].pontos.joelho_d.x).toBe(100.12);
    expect(r.analise.trilha.quadros[0].pontos.quadril_d.auto).toEqual({ x: 299.99, y: 251.11, conf: 0.8 });
    expect(original.quadros[0].pontos.joelho_d.x).toBe(100.123456);
  });

  it('rejeita arquivo que não é do app, versão futura e trilha danificada', () => {
    expect(lerAnaliseSalva('não é json').ok).toBe(false);
    expect(lerAnaliseSalva('{"foo":1}').ok).toBe(false);
    const base = JSON.parse(serializarAnalise({ video, modeloId: 'marcha', fpsVideo: 30, intervalo: { inicio: 0, fim: 6 }, trilha: trilha(), eventos: null, cmPorPx: null, extras: {} }));
    const futura = lerAnaliseSalva(JSON.stringify({ ...base, versao: 99 }));
    expect(futura.ok).toBe(false);
    expect('erro' in futura && futura.erro).toMatch(/mais nova/);
    expect(lerAnaliseSalva(JSON.stringify({ ...base, trilha: { ...base.trilha, quadros: [] } })).ok).toBe(false);
    expect(lerAnaliseSalva(JSON.stringify({ ...base, trilha: { ...base.trilha, quadros: [{ t: 'zero', p: {} }] } })).ok).toBe(false);
    expect(lerAnaliseSalva(JSON.stringify({ ...base, trilha: { tipo: 'outra-coisa' } })).ok).toBe(false);
  });

  it('eventos malformados são descartados, não quebram a leitura', () => {
    const base = JSON.parse(serializarAnalise({ video, modeloId: 'marcha', fpsVideo: 30, intervalo: { inicio: 0, fim: 6 }, trilha: trilha(), eventos: null, cmPorPx: null, extras: {} }));
    const r = lerAnaliseSalva(JSON.stringify({ ...base, eventos: [{ id: 1 }] }));
    expect(r.ok && r.analise.eventos).toBeNull();
  });

  it('reconhece o mesmo vídeo mesmo com outro nome, e recusa outro arquivo', () => {
    expect(mesmaImpressao(video, { ...video, nome: 'IMG_0001.mov' })).toBe(true);
    expect(mesmaImpressao(video, { ...video, duracao: 6.05 })).toBe(true);
    expect(mesmaImpressao(video, { ...video, duracao: 7 })).toBe(false);
    expect(mesmaImpressao(video, { ...video, tamanho: 999 })).toBe(false);
    expect(mesmaImpressao(video, { ...video, largura: 1280 })).toBe(false);
    expect(chaveDoRascunho(video)).toBe('1000-640x480-6.00');
    expect(nomeArquivoAnalise('salto aterrissagem', new Date(2026, 9, 12))).toBe('analise-video-salto_aterrissagem-2026-10-12.json');
  });
});

describe('taxa de quadros do vídeo', () => {
  it('estimativas viram taxas redondas', () => {
    expect(fpsMaisProximo(29.97)).toBe(30);
    expect(fpsMaisProximo(59.94)).toBe(60);
    expect(fpsMaisProximo(239)).toBe(240);
    expect(fpsMaisProximo(24.1)).toBe(24);
    expect(fpsMaisProximo(NaN)).toBe(30);
  });
  it('a mediana dos intervalos dá a taxa e ignora saltos', () => {
    expect(fpsPorIntervalos([1 / 30, 1 / 30, 1 / 30, 1 / 30, 0.2])).toBe(30);
    expect(fpsPorIntervalos([1 / 120, 1 / 120, 1 / 119, 1 / 121, 1 / 120])).toBe(120);
    expect(fpsPorIntervalos([0.03])).toBeNull();
  });
});
