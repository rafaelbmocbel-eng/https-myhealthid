import { describe, expect, it } from 'vitest';
import {
  adicionarEvento, detectarEventosCorrida, detectarEventosMarcha, eventosDo, extremosLocais, moverEvento, refinarExtremo, removerEvento, tempoDoEvento,
  type EventoPasso,
} from '../lib/angular/video/eventos';
import { configurar, eventosVerdade, trilhaSintetica, type ConfigFigura } from '../lib/angular/video/detectorFalso';
import { criarTrilha } from '../lib/angular/video/trilha';
import type { Lado } from '../lib/angular/video/tipos';

/** Confere cada evento conhecido (no miolo do vídeo) com o detectado mais próximo do mesmo tipo e lado. */
function conferir(detectados: EventoPasso[], cfg: ConfigFigura, duracao: number, tol: number) {
  const verdade = eventosVerdade(cfg, duracao);
  const margem = 0.6;
  for (const tipo of ['contato', 'saida'] as const) {
    for (const lado of ['D', 'E'] as Lado[]) {
      const conhecidos = verdade[tipo][lado].filter((t) => t > margem && t < duracao - margem);
      const achados = eventosDo(detectados, lado, tipo).filter((e) => e.t > margem && e.t < duracao - margem);
      expect(achados.length, `${tipo} ${lado}: quantidade`).toBe(conhecidos.length);
      for (const t of conhecidos) {
        const mais = Math.min(...achados.map((e) => Math.abs(tempoDoEvento(e) - t)));
        expect(mais, `${tipo} ${lado} em ${t.toFixed(2)} s`).toBeLessThanOrEqual(tol);
      }
    }
  }
}

describe('detectarEventosMarcha', () => {
  it('acha contato e saída de cada pé dentro de um quadro (30 quadros/s)', () => {
    const cfg = configurar('marcha');
    const eventos = detectarEventosMarcha(trilhaSintetica(cfg, 30, 8));
    conferir(eventos, cfg, 8, 1 / 30);
  });

  it('funciona com o paciente virado para a esquerda e com câmera fixa', () => {
    for (const mudancas of [{ direcao: -1 as const }, { cameraFixa: true, largura: 3000 }, { direcao: -1 as const, cameraFixa: true, largura: 3000 }]) {
      const cfg = configurar('marcha', mudancas);
      conferir(detectarEventosMarcha(trilhaSintetica(cfg, 30, 8)), cfg, 8, 1.5 / 30);
    }
  });

  it('resiste a ruído de 1,5 px e a 15 quadros/s', () => {
    const cfg = configurar('marcha');
    conferir(detectarEventosMarcha(trilhaSintetica(cfg, 30, 10, { ruidoPx: 1.5, semente: 11 })), cfg, 10, 2.5 / 30);
    conferir(detectarEventosMarcha(trilhaSintetica(cfg, 15, 10)), cfg, 10, 1.5 / 15);
  });

  it('com quadros em que o detector não achou ninguém, ainda acha os demais eventos', () => {
    const cfg = configurar('marcha');
    const trilha = trilhaSintetica(cfg, 30, 8, { ausentes: (t) => t > 3.9 && t < 4.1 });
    const eventos = detectarEventosMarcha(trilha);
    const verdade = eventosVerdade(cfg, 8);
    for (const t of verdade.contato.D.filter((x) => x > 0.5 && x < 7.4 && (x < 3.7 || x > 4.3))) {
      const mais = Math.min(...eventosDo(eventos, 'D', 'contato').map((e) => Math.abs(tempoDoEvento(e) - t)));
      expect(mais).toBeLessThanOrEqual(1.5 / 30);
    }
  });

  it('alterna contato e saída em cada pé e traz as sugestões marcadas como automáticas', () => {
    const eventos = detectarEventosMarcha(trilhaSintetica(configurar('marcha'), 30, 8));
    for (const lado of ['D', 'E'] as Lado[]) {
      const seq = eventos.filter((e) => e.lado === lado).sort((a, b) => a.i - b.i);
      seq.forEach((e, k) => { if (k > 0) expect(e.tipo).not.toBe(seq[k - 1].tipo); });
    }
    expect(eventos.every((e) => e.sugerido)).toBe(true);
    expect(new Set(eventos.map((e) => e.id)).size).toBe(eventos.length);
    expect(eventos.every((e) => Math.abs(e.t - (tempoDoEvento(e))) <= 0.5 / 30 + 1e-9)).toBe(true);
    expect(eventos.map((e) => e.i)).toEqual([...eventos.map((e) => e.i)].sort((a, b) => a - b));
  });

  it('assimetria de tempo é preservada nos eventos: o passo D→E dura mais que o E→D', () => {
    const cfg = configurar('marcha', { atrasoE: 0.05 });
    const ev = detectarEventosMarcha(trilhaSintetica(cfg, 30, 12)).filter((e) => e.tipo === 'contato').sort((a, b) => a.i - b.i);
    const passos: Record<string, number[]> = { D: [], E: [] };
    for (let k = 0; k + 1 < ev.length; k++) if (ev[k].lado !== ev[k + 1].lado) passos[ev[k].lado].push(tempoDoEvento(ev[k + 1]) - tempoDoEvento(ev[k]));
    const media = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
    expect(media(passos.D)).toBeCloseTo(0.605, 1);
    expect(media(passos.E)).toBeCloseTo(0.495, 1);
  });

  it('sem movimento (pessoa parada) ou sem pontos não sugere evento nenhum', () => {
    const parado = trilhaSintetica(configurar('agachamento', { periodo: 1e9 }), 30, 5);
    expect(detectarEventosMarcha(parado)).toEqual([]);
    expect(detectarEventosCorrida(parado)).toEqual([]);
    expect(detectarEventosMarcha(criarTrilha(30, 640, 480))).toEqual([]);
    expect(detectarEventosMarcha(trilhaSintetica(configurar('marcha'), 30, 8, { ausentes: () => true }))).toEqual([]);
  });
});

describe('detectarEventosCorrida', () => {
  it('acha contato e saída de cada pé dentro de ~1 quadro a 60 quadros/s', () => {
    const cfg = configurar('corrida');
    conferir(detectarEventosCorrida(trilhaSintetica(cfg, 60, 8)), cfg, 8, 0.025);
  });

  it('também com 30 quadros/s, espelhado, com câmera fixa e com ruído', () => {
    conferir(detectarEventosCorrida(trilhaSintetica(configurar('corrida'), 30, 8)), configurar('corrida'), 8, 0.05);
    const esp = configurar('corrida', { direcao: -1 });
    conferir(detectarEventosCorrida(trilhaSintetica(esp, 60, 8)), esp, 8, 0.03);
    const fixa = configurar('corrida', { cameraFixa: true, largura: 9000 });
    conferir(detectarEventosCorrida(trilhaSintetica(fixa, 60, 8)), fixa, 8, 0.03);
    const cfg = configurar('corrida');
    conferir(detectarEventosCorrida(trilhaSintetica(cfg, 60, 8, { ruidoPx: 1, semente: 5 })), cfg, 8, 0.045);
  });

  it('o tempo de contato assimétrico aparece nos eventos', () => {
    const cfg = configurar('corrida', { tempoContato: { D: 0.2, E: 0.26 } });
    const ev = detectarEventosCorrida(trilhaSintetica(cfg, 60, 8));
    const dur = (lado: Lado) => {
      const c = eventosDo(ev, lado, 'contato'), s = eventosDo(ev, lado, 'saida');
      const v = c.map((e) => { const x = s.find((y) => y.i > e.i); return x ? tempoDoEvento(x) - tempoDoEvento(e) : NaN; }).filter(Number.isFinite);
      return v.reduce((a, b) => a + b, 0) / v.length;
    };
    expect(dur('D')).toBeGreaterThan(0.18);
    expect(dur('D')).toBeLessThan(0.23);
    expect(dur('E')).toBeGreaterThan(0.24);
    expect(dur('E')).toBeLessThan(0.29);
  });

  it('alterna contato e saída', () => {
    const ev = detectarEventosCorrida(trilhaSintetica(configurar('corrida'), 60, 6));
    for (const lado of ['D', 'E'] as Lado[]) {
      const seq = ev.filter((e) => e.lado === lado).sort((a, b) => a.i - b.i);
      seq.forEach((e, k) => { if (k > 0) expect(e.tipo).not.toBe(seq[k - 1].tipo); });
    }
  });
});

describe('edição dos eventos pelo profissional', () => {
  const trilha = trilhaSintetica(configurar('marcha'), 30, 4);
  const base = detectarEventosMarcha(trilha);

  it('adicionarEvento cria um evento manual no quadro, em ordem, sem duplicar', () => {
    const a = adicionarEvento([], trilha, 'D', 'contato', 12);
    expect(a).toEqual([{ id: 'D-contato-12', lado: 'D', tipo: 'contato', i: 12, t: trilha.quadros[12].t, sugerido: false }]);
    const b = adicionarEvento(adicionarEvento(a, trilha, 'E', 'saida', 5), trilha, 'D', 'contato', 12);
    expect(b.map((e) => e.id)).toEqual(['E-saida-5', 'D-contato-12']);
    expect(adicionarEvento(a, trilha, 'D', 'contato', 9999)[1].i).toBe(trilha.quadros.length - 1);
    expect(adicionarEvento(a, trilha, 'D', 'contato', -5)[0].i).toBe(0);
    expect(adicionarEvento(a, criarTrilha(30, 1, 1), 'D', 'contato', 2)).toBe(a);
  });

  it('moverEvento troca o quadro, tira a marca de sugestão e o instante refinado; remover tira da lista', () => {
    const alvo = base.find((e) => e.tipo === 'contato' && e.lado === 'D')!;
    expect(alvo.tFino).toBeDefined();
    const movido = moverEvento(base, trilha, alvo.id, alvo.i + 2);
    const novo = movido.find((e) => e.i === alvo.i + 2 && e.lado === 'D' && e.tipo === 'contato')!;
    expect(novo.sugerido).toBe(false);
    expect(novo.tFino).toBeUndefined();
    expect(tempoDoEvento(novo)).toBe(novo.t);
    expect(movido.find((e) => e.id === alvo.id)).toBeUndefined();
    expect(movido).toHaveLength(base.length);
    expect(moverEvento(base, trilha, 'nao-existe', 3)).toBe(base);
    const sem = removerEvento(movido, novo.id);
    expect(sem).toHaveLength(base.length - 1);
    expect(base.some((e) => e.id === alvo.id)).toBe(true); // a lista original não muda
  });
});

describe('extremosLocais e refinarExtremo', () => {
  const seno = Array.from({ length: 200 }, (_, i) => 10 * Math.sin((2 * Math.PI * i) / 48));

  it('acha os picos de um seno, com a distância mínima respeitada', () => {
    const picos = extremosLocais(seno, 'max', 20, 5);
    expect(picos).toEqual([12, 60, 108, 156, 204].filter((i) => i < 190));
    expect(extremosLocais(seno, 'min', 20, 5)).toEqual([36, 84, 132, 180]);
  });

  it('descarta picos pouco proeminentes e pontas cortadas', () => {
    const s = [...seno];
    s[30] += 0.5; // ondulação pequena no meio da descida
    expect(extremosLocais(s, 'max', 6, 5)).not.toContain(30);
    expect(extremosLocais(seno, 'max', 20, 50)).toEqual([]);
    expect(extremosLocais([0, 1, 5, 1, 0], 'max', 4, 1)).toEqual([2]);
    expect(extremosLocais([9, 5, 1, 0, 0, 0], 'max', 4, 1)).toEqual([]); // pico no quadro 0: janela cortada
  });

  it('em platô fica o primeiro quadro; lacunas não geram picos', () => {
    expect(extremosLocais([0, 0, 1, 5, 5, 5, 5, 1, 0, 0, 0], 'max', 4, 2)).toEqual([3]);
    expect(extremosLocais([0, 1, null, null, 9, null, 1, 0], 'max', 2, 2)).toEqual([4]);
    expect(extremosLocais([], 'max', 4, 1)).toEqual([]);
  });

  it('a parábola dá o instante entre quadros', () => {
    const f = (x: number) => -((x - 10.3) ** 2);
    const serie = Array.from({ length: 21 }, (_, i) => f(i));
    expect(10 + refinarExtremo(serie, 10)).toBeCloseTo(10.3, 9);
    expect(refinarExtremo([1, 2, 1], 1)).toBe(0);
    expect(refinarExtremo([1, 1, 1], 1)).toBe(0);
    expect(refinarExtremo([1, null, 1], 1)).toBe(0);
    expect(refinarExtremo([1, 2], 1)).toBe(0);
    expect(Math.abs(refinarExtremo([0, 1, 100], 1))).toBeLessThanOrEqual(0.5);
  });
});
