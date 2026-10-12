import { describe, expect, it } from 'vitest';
import {
  avaliarVideoParaAnalise, detectorMediaPipe, ehCancelamento, erroCancelado, FPS_PADRAO, garantirDuracao, LIMITES_VIDEO, MAX_QUADROS_PADRAO, planejarQuadros,
  rastrearVideo,
} from '../lib/angular/video/rastrear';
import { criarVideoFalso } from '../lib/angular/video/videoFalso';
import { configurar, detectorFalso, poseSintetica } from '../lib/angular/video/detectorFalso';
import { anguloJoelho, angulosPorQuadro } from '../lib/angular/video/angulos';
import { analisarGesto } from '../lib/angular/video/metricas';
import type { DetectorQuadro } from '../lib/angular/video/tipos';

describe('planejarQuadros', () => {
  it('usa a taxa pedida quando cabe no limite de quadros', () => {
    expect(planejarQuadros(10, 30, 1200)).toEqual({ fps: 30, quadros: 300 });
    expect(planejarQuadros(2.5, 15, 1200)).toEqual({ fps: 15, quadros: 37 });
    expect(planejarQuadros(0.5, 30, 1200).quadros).toBe(15);
  });

  it('reduz a taxa para respeitar o limite e mantém a duração coberta', () => {
    const p = planejarQuadros(60, 30, 1200);
    expect(p.quadros).toBe(1200);
    expect(p.fps).toBeCloseTo(20, 9);
    expect(p.quadros / p.fps).toBeCloseTo(60, 9);
  });

  it('taxa inválida cai no padrão; sempre pelo menos um quadro', () => {
    expect(planejarQuadros(10, 0, 1200).fps).toBe(FPS_PADRAO);
    expect(planejarQuadros(10, Number.NaN, 1200).fps).toBe(FPS_PADRAO);
    expect(planejarQuadros(0.001, 30, 1200).quadros).toBe(1);
    expect(MAX_QUADROS_PADRAO).toBe(1200);
  });
});

describe('avaliarVideoParaAnalise', () => {
  it('vídeo curto não tem aviso; acima do sugerido avisa; acima do máximo bloqueia', () => {
    expect(avaliarVideoParaAnalise({ duracaoS: 12, tamanhoBytes: 10e6 })).toEqual({ avisos: [], bloqueado: false });
    const longo = avaliarVideoParaAnalise({ duracaoS: 45 });
    expect(longo.bloqueado).toBe(false);
    expect(longo.avisos[0]).toContain('30 s');
    const enorme = avaliarVideoParaAnalise({ duracaoS: 600 });
    expect(enorme.bloqueado).toBe(true);
    expect(enorme.avisos[0]).toContain(`${LIMITES_VIDEO.duracaoMaximaS} s`);
  });

  it('arquivo muito grande ganha aviso de tamanho', () => {
    const r = avaliarVideoParaAnalise({ duracaoS: 10, tamanhoBytes: 300 * 1024 * 1024 });
    expect(r.avisos.join(' ')).toContain('300 MB');
    expect(r.bloqueado).toBe(false);
  });
});

describe('rastrearVideo com vídeo e detector falsos', () => {
  const cfg = configurar('marcha');

  it('devolve um quadro por instante, com tempo, índice, dimensões e pontos em pixels', async () => {
    const video = criarVideoFalso({ duracao: 2, largura: 640, altura: 480 });
    const trilha = await rastrearVideo(video, { fps: 10, detector: detectorFalso(cfg) });
    expect(trilha.fps).toBe(10);
    expect(trilha.largura).toBe(640);
    expect(trilha.altura).toBe(480);
    expect(trilha.quadros).toHaveLength(20);
    expect(trilha.quadros.map((q) => q.i)).toEqual(Array.from({ length: 20 }, (_, i) => i));
    expect(trilha.quadros[7].t).toBeCloseTo(0.7, 9);
    const esperado = poseSintetica(cfg, 0.7).landmarks[26];
    expect(trilha.quadros[7].pontos.joelho_d.x).toBeCloseTo(esperado.x * 640, 6);
    expect(trilha.quadros[7].pontos.joelho_d.y).toBeCloseTo(esperado.y * 480, 6);
  });

  it('percorre os instantes em ordem, um a um, e devolve o vídeo ao início', async () => {
    const buscas: number[] = [];
    const video = criarVideoFalso({ duracao: 1, buscas });
    await rastrearVideo(video, { fps: 10, detector: detectorFalso(cfg) });
    // o primeiro quadro (0 s) não exige busca, porque o vídeo já está no início; depois cada instante é pedido em ordem e o fim volta a 0
    expect(buscas.slice(0, 9).map((t) => Math.round(t * 100) / 100)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]);
    expect(buscas[9]).toBe(0);
    expect(buscas).toHaveLength(10);
    expect(video.currentTime).toBe(0);
  });

  it('o detector recebe o vídeo e o instante exato de cada quadro', async () => {
    const vistos: number[] = [];
    const video = criarVideoFalso({ duracao: 1 });
    const detector: DetectorQuadro = async (quadro, t) => { expect(quadro).toBe(video); vistos.push(t); return null; };
    await rastrearVideo(video, { fps: 5, detector });
    expect(vistos).toEqual([0, 0.2, 0.4, 0.6000000000000001, 0.8].map((x) => expect.closeTo(x, 9)));
  });

  it('informa o progresso de 0 a 1, sempre crescente, e entrega cada quadro pronto', async () => {
    const progresso: number[] = [];
    const prontos: number[] = [];
    await rastrearVideo(criarVideoFalso({ duracao: 1 }), {
      fps: 10, detector: detectorFalso(cfg), onProgresso: (p) => progresso.push(p), onQuadro: (q, i, total) => { prontos.push(i); expect(total).toBe(10); expect(q.i).toBe(i); },
    });
    expect(progresso).toHaveLength(10);
    expect(progresso[9]).toBe(1);
    expect(progresso.every((p, k) => k === 0 || p > progresso[k - 1])).toBe(true);
    expect(prontos).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('rastreia só o trecho pedido: os tempos são absolutos no vídeo e a contagem do índice recomeça em zero', async () => {
    const trilha = await rastrearVideo(criarVideoFalso({ duracao: 10 }), { fps: 10, intervalo: { inicio: 2, fim: 3.5 }, detector: detectorFalso(cfg) });
    expect(trilha.quadros).toHaveLength(15);
    expect(trilha.quadros[0].t).toBeCloseTo(2, 9);
    expect(trilha.quadros[0].i).toBe(0);
    expect(trilha.quadros[14].t).toBeCloseTo(3.4, 9);
    const esperado = poseSintetica(cfg, 3.4).landmarks[26];
    expect(trilha.quadros[14].pontos.joelho_d.x).toBeCloseTo(esperado.x * 640, 6);
  });

  it('trecho fora do vídeo é limitado; trecho curto demais dá erro claro', async () => {
    const t = await rastrearVideo(criarVideoFalso({ duracao: 2 }), { fps: 10, intervalo: { inicio: -5, fim: 99 }, detector: detectorFalso(cfg) });
    expect(t.quadros).toHaveLength(20);
    await expect(rastrearVideo(criarVideoFalso({ duracao: 2 }), { intervalo: { inicio: 1, fim: 1.01 }, detector: detectorFalso(cfg) })).rejects.toThrow('curto demais');
  });

  it('reduz a taxa em vídeos longos para não passar do limite de quadros', async () => {
    const trilha = await rastrearVideo(criarVideoFalso({ duracao: 20 }), { fps: 30, maxQuadros: 100, detector: detectorFalso(cfg) });
    expect(trilha.quadros).toHaveLength(100);
    expect(trilha.fps).toBeCloseTo(5, 9);
    expect(trilha.quadros[99].t).toBeCloseTo(19.8, 6);
  });

  it('quadro em que o detector não acha ninguém vira quadro vazio, sem derrubar o rastreio', async () => {
    const detector = detectorFalso(cfg, { ausentes: (t) => t >= 0.3 && t < 0.5 });
    const trilha = await rastrearVideo(criarVideoFalso({ duracao: 1 }), { fps: 10, detector });
    expect(trilha.quadros.filter((q) => Object.keys(q.pontos).length === 0).map((q) => q.i)).toEqual([3, 4]);
    expect(Object.keys(trilha.quadros[5].pontos).length).toBeGreaterThan(10);
  });

  it('falhas isoladas do detector são toleradas; cinco seguidas abortam com mensagem clara', async () => {
    let n = 0;
    const falhaVez: DetectorQuadro = async (_q, t) => { n++; if (n === 3) throw new Error('GPU ocupada'); return detectorFalso(cfg)(null as never, t); };
    const ok = await rastrearVideo(criarVideoFalso({ duracao: 1 }), { fps: 10, detector: falhaVez });
    expect(ok.quadros).toHaveLength(10);
    expect(Object.keys(ok.quadros[2].pontos)).toHaveLength(0);

    const semModelo: DetectorQuadro = async () => { throw new Error('modelo não baixou'); };
    await expect(rastrearVideo(criarVideoFalso({ duracao: 5 }), { fps: 10, detector: semModelo })).rejects.toThrow(/detector de pose falhou \(modelo não baixou\)/);
  });

  it('cancelamento: rejeita com AbortError, para de pedir quadros e não devolve trilha parcial', async () => {
    const ctrl = new AbortController();
    let chamados = 0;
    const detector: DetectorQuadro = async (_q, t) => { chamados++; if (chamados === 4) ctrl.abort(); return detectorFalso(cfg)(null as never, t); };
    const erro = await rastrearVideo(criarVideoFalso({ duracao: 5 }), { fps: 10, detector, sinal: ctrl.signal }).catch((e) => e);
    expect(ehCancelamento(erro)).toBe(true);
    expect(erro.name).toBe('AbortError');
    expect(chamados).toBe(4);
    expect(ehCancelamento(new Error('outro'))).toBe(false);
    expect(erroCancelado().name).toBe('AbortError');
  });

  it('já cancelado antes de começar: não mexe no vídeo', async () => {
    const buscas: number[] = [];
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(rastrearVideo(criarVideoFalso({ buscas }), { detector: detectorFalso(cfg), sinal: ctrl.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(buscas).toEqual([]);
  });

  it('WebM gravado pelo navegador chega sem duração (Infinity): a duração é descoberta indo ao fim e o vídeo volta ao início', async () => {
    const video = criarVideoFalso({ duracao: 3, semDuracao: true });
    expect(video.duration).toBe(Infinity);
    expect(await garantirDuracao(video)).toBe(3);
    expect(video.currentTime).toBe(0);
    const trilha = await rastrearVideo(criarVideoFalso({ duracao: 3, semDuracao: true }), { fps: 10, detector: detectorFalso(cfg) });
    expect(trilha.quadros).toHaveLength(30);
  });

  it('vídeo sem dimensões dá erro claro', async () => {
    const video = criarVideoFalso({ largura: 0, altura: 0 });
    await expect(rastrearVideo(video, { detector: detectorFalso(cfg) })).rejects.toThrow('tamanho do vídeo');
  });

  it('o detector padrão é o MediaPipe e só é carregado quando usado', () => {
    expect(typeof detectorMediaPipe()).toBe('function');
  });
});

describe('do vídeo à medida: o fluxo completo com a figura sintética', () => {
  it('marcha: rastrear, medir ângulos e métricas dá o que a figura conhecida tem', async () => {
    const cfg = configurar('marcha');
    const trilha = await rastrearVideo(criarVideoFalso({ duracao: 10 }), { fps: 30, detector: detectorFalso(cfg) });
    const joelho = angulosPorQuadro(trilha, anguloJoelho('D'));
    joelho.forEach((a) => expect(Math.abs((a.graus as number) - poseSintetica(cfg, a.t).verdade.joelho_d)).toBeLessThan(0.01));
    const r = analisarGesto('marcha', trilha);
    expect(r.metricas.find((m) => m.id === 'cadencia')?.valor as number).toBeCloseTo(120 / 1.1, 0);
  });
});
