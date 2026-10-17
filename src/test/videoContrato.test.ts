import { describe, expect, it } from 'vitest';
import * as motor from '../lib/angular/video';
import {
  angulosPorQuadro, anguloJoelho, analisarGesto, caixasDoRosto, classificarContraReferencia, corrigirPonto, criarHistorico, desfazer, detectarEventosCorrida,
  detectarEventosMarcha, MODELOS_GESTO, rastrearVideo, refazer, REFERENCIAS, registrar, removerCorrecao, suavizar,
  type DetectorQuadro, type TrilhaPose,
} from '../lib/angular/video';
import { configurar, detectorFalso, trilhaSintetica } from '../lib/angular/video/detectorFalso';
import { criarVideoFalso } from '../lib/angular/video/videoFalso';

/*
 * Contrato do motor com os outros agentes (interface de vídeo e exportação): estes nomes e formatos não podem mudar sem avisar.
 * O que é só de teste (detector falso, figura sintética, vídeo falso) NÃO sai do pacote público.
 */

const congelar = <T,>(o: T): T => {
  Object.freeze(o);
  for (const v of Object.values(o as object)) if (v && typeof v === 'object' && !Object.isFrozen(v)) congelar(v);
  return o;
};

describe('API pública do motor de vídeo', () => {
  it('exporta, por um único ponto de entrada, tudo o que a interface e a exportação usam', () => {
    const funcoes = [
      'rastrearVideo', 'corrigirPonto', 'removerCorrecao', 'criarHistorico', 'registrar', 'desfazer', 'refazer', 'suavizar', 'angulosPorQuadro',
      'detectarEventosMarcha', 'detectarEventosCorrida', 'analisarGesto', 'classificarContraReferencia', 'montarCartoes', 'caixasDoRosto', 'caixaDoRostoEm',
      'serializarTrilha', 'lerTrilha', 'indiceAssimetria', 'modeloDoGesto', 'adicionarEvento', 'moverEvento', 'removerEvento', 'planejarQuadros',
    ];
    for (const nome of funcoes) expect(typeof (motor as Record<string, unknown>)[nome], nome).toBe('function');
    expect(Array.isArray(motor.MODELOS_GESTO)).toBe(true);
    expect(Array.isArray(motor.REFERENCIAS)).toBe(true);
  });

  it('o código só de teste não sai pelo pacote público (não entra no build de produção)', () => {
    for (const nome of ['detectorFalso', 'configurar', 'poseSintetica', 'trilhaSintetica', 'criarVideoFalso', 'gerarVideoSintetico']) {
      expect((motor as Record<string, unknown>)[nome], nome).toBeUndefined();
    }
  });

  it('o detector falso cumpre o tipo DetectorQuadro e devolve 33 pontos normalizados', async () => {
    const detector: DetectorQuadro = detectorFalso(configurar('marcha'));
    const lm = await detector(document.createElement('canvas'), 1.25);
    expect(lm).toHaveLength(33);
    for (const l of lm ?? []) {
      expect(l.x).toBeGreaterThanOrEqual(0);
      expect(l.x).toBeLessThanOrEqual(1);
      expect(l.y).toBeGreaterThanOrEqual(0);
      expect(l.y).toBeLessThanOrEqual(1);
    }
  });
});

describe('formato da trilha', () => {
  it('rastrearVideo devolve fps, largura, altura e um quadro por instante, com pontos em pixels', async () => {
    const cfg = configurar('agachamento', { largura: 800, altura: 600 });
    const trilha: TrilhaPose = await rastrearVideo(criarVideoFalso({ duracao: 3, largura: 800, altura: 600 }), { fps: 10, detector: detectorFalso(cfg), onProgresso: () => undefined });
    expect(trilha.fps).toBe(10);
    expect(trilha.largura).toBe(800);
    expect(trilha.altura).toBe(600);
    expect(trilha.quadros).toHaveLength(30);
    trilha.quadros.forEach((q, k) => {
      expect(q.i).toBe(k);
      expect(q.t).toBeCloseTo(k / 10, 9);
      const nomes = Object.keys(q.pontos);
      expect(nomes).toContain('joelho_d');
      for (const p of Object.values(q.pontos)) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(800);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(600);
        expect(typeof p.conf).toBe('number');
        expect(p.manual).toBeUndefined();
      }
    });
  });

  it('corrigirPonto devolve uma trilha nova com manual = true e a original intacta; removerCorrecao desfaz', () => {
    const trilha = congelar(trilhaSintetica(configurar('marcha'), 30, 2));
    const nova = corrigirPonto(trilha, 10, 'joelho_d', { x: 111, y: 222 });
    expect(nova).not.toBe(trilha);
    expect(nova.quadros[10].pontos.joelho_d).toMatchObject({ x: 111, y: 222, manual: true });
    expect(trilha.quadros[10].pontos.joelho_d.manual).toBeUndefined();
    expect(removerCorrecao(nova, 10, 'joelho_d')).toEqual(trilha);
  });

  it('desfazer e refazer pelo histórico imutável', () => {
    const t0 = trilhaSintetica(configurar('marcha'), 30, 1);
    const t1 = corrigirPonto(t0, 5, 'joelho_d', { x: 10, y: 20 });
    let h = registrar(criarHistorico(t0), t1);
    expect(h.presente).toBe(t1);
    h = desfazer(h);
    expect(h.presente).toBe(t0);
    h = refazer(h);
    expect(h.presente).toBe(t1);
  });
});

describe('funções puras nunca alteram a trilha recebida', () => {
  it('ângulos, suavização, eventos, métricas de cada gesto e caixas do rosto aceitam uma trilha congelada', () => {
    for (const modelo of MODELOS_GESTO) {
      const trilha = congelar(trilhaSintetica(configurar(modelo.id), 30, 6, { ruidoPx: 1 }));
      const serie = angulosPorQuadro(trilha, anguloJoelho('D'));
      expect(serie).toHaveLength(trilha.quadros.length);
      expect(Object.keys(serie[0]).sort()).toEqual(['graus', 't']);
      const suave = suavizar(serie.map((a) => a.graus), 7);
      expect(suave).toHaveLength(serie.length);
      expect(() => analisarGesto(modelo.id, trilha, { escalaCmPorPx: 0.3 })).not.toThrow();
      expect(() => caixasDoRosto(trilha)).not.toThrow();
    }
    const marcha = congelar(trilhaSintetica(configurar('marcha'), 30, 6));
    const corrida = congelar(trilhaSintetica(configurar('corrida'), 60, 5));
    expect(detectarEventosMarcha(marcha).length).toBeGreaterThan(0);
    expect(detectarEventosCorrida(corrida).length).toBeGreaterThan(0);
  });

  it('os eventos são sugestões editáveis: tipo contato ou saída, lado D ou E, marcados como sugeridos', () => {
    for (const e of detectarEventosMarcha(trilhaSintetica(configurar('marcha'), 30, 6))) {
      expect(['contato', 'saida']).toContain(e.tipo);
      expect(['D', 'E']).toContain(e.lado);
      expect(e.sugerido).toBe(true);
      expect(Number.isInteger(e.i)).toBe(true);
    }
  });
});

describe('modelos de gesto e referências no formato combinado', () => {
  it('os cinco gestos pedidos existem, cada um com articulações, vista e métricas', () => {
    expect(MODELOS_GESTO.map((m) => m.id).sort()).toEqual(['agachamento', 'corrida', 'marcha', 'ombro', 'salto']);
    for (const m of MODELOS_GESTO) {
      expect(m.articulacoes.length, m.id).toBeGreaterThan(0);
      expect(['lateral', 'frontal'], m.id).toContain(m.vista);
      expect(m.metricas.length, m.id).toBeGreaterThan(0);
    }
  });

  it('cada referência traz chave, métrica, população, faixa, fonte e estatuto; só a confirmada tem faixa e PMID', () => {
    expect(REFERENCIAS.length).toBeGreaterThan(0);
    for (const r of REFERENCIAS) {
      expect(typeof r.chave).toBe('string');
      expect(typeof r.metrica).toBe('string');
      expect(typeof r.populacao).toBe('string');
      expect(typeof r.fonte.citacao).toBe('string');
      expect(['confirmada', 'sem_referencia']).toContain(r.estatuto);
      if (r.estatuto === 'confirmada') {
        expect(r.fonte.pmid, r.chave).toMatch(/^\d{6,9}$/);
        expect(r.faixa.min !== undefined || r.faixa.max !== undefined, r.chave).toBe(true);
      } else {
        expect(r.faixa, r.chave).toEqual({});
        expect(r.fonte.pmid, r.chave).toBeUndefined();
      }
    }
  });

  it('classificarContraReferencia devolve só dentro, fora ou sem_referencia e nunca inventa limite', () => {
    const confirmada = REFERENCIAS.find((r) => r.estatuto === 'confirmada');
    const semRef = REFERENCIAS.find((r) => r.estatuto === 'sem_referencia');
    expect(confirmada && semRef).toBeTruthy();
    const { min, max } = confirmada!.faixa;
    const meio = min !== undefined && max !== undefined ? (min + max) / 2 : (min ?? max)!;
    expect(classificarContraReferencia(meio, confirmada)).toBe('dentro');
    if (min !== undefined) expect(classificarContraReferencia(min - 0.01, confirmada)).toBe('fora');
    if (max !== undefined) expect(classificarContraReferencia(max + 0.01, confirmada)).toBe('fora');
    expect(classificarContraReferencia(50, semRef)).toBe('sem_referencia');
    expect(classificarContraReferencia(null, confirmada)).toBe('sem_referencia');
    expect(classificarContraReferencia(50, undefined)).toBe('sem_referencia');
  });
});
