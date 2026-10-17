import { describe, expect, it } from 'vitest';
import { caixasDoRosto } from '../lib/angular/video/rostoPorQuadro';
import { corrigirPonto } from '../lib/angular/video/correcao';
import { detectarEventosCorrida, detectarEventosMarcha } from '../lib/angular/video/eventos';
import { analisarGesto, type AnaliseGesto } from '../lib/angular/video/metricas';
import { MODELOS_GESTO } from '../lib/angular/video/modelos';
import { montarCartoes } from '../lib/angular/video/referencias';
import { aleatorio, configurar, trilhaSintetica } from '../lib/angular/video/figuraSintetica';
import { criarTrilha, lerTrilha, serializarTrilha } from '../lib/angular/video/trilha';
import type { TrilhaPose } from '../lib/angular/video/tipos';

/*
 * Vídeo de celular real traz trilhas ruins: poucos quadros, corpo cortado, detector perdido, ruído forte, taxas de quadros estranhas.
 * Nada disso pode derrubar a tela nem produzir NaN/Infinity nos cartões e gráficos.
 */

function tudoFinito(a: AnaliseGesto, rotulo: string) {
  for (const m of a.metricas) {
    if (m.valor !== null) expect(Number.isFinite(m.valor), `${rotulo} ${m.id}`).toBe(true);
    if (m.dp !== undefined) expect(Number.isFinite(m.dp), `${rotulo} ${m.id} dp`).toBe(true);
    if (m.incerteza !== undefined) expect(Number.isFinite(m.incerteza), `${rotulo} ${m.id} incerteza`).toBe(true);
  }
  for (const [id, serie] of Object.entries(a.series)) {
    for (const x of serie) if (x.graus !== null) expect(Number.isFinite(x.graus), `${rotulo} série ${id}`).toBe(true);
  }
  for (const e of a.eventos) expect(Number.isFinite(e.t), `${rotulo} evento`).toBe(true);
}

describe('trilhas degeneradas em todos os gestos', () => {
  for (const modelo of MODELOS_GESTO) {
    it(`${modelo.id}: vazia, de 1 ou 2 quadros, sem pontos, taxas extremas, início tardio, ruído forte e 60% de quadros perdidos`, () => {
      const cfg = configurar(modelo.id);
      const casos: [string, TrilhaPose][] = [
        ['vazia', criarTrilha(30, 640, 480, [])],
        ['1 quadro', criarTrilha(30, 640, 480, [{ i: 0, t: 0, pontos: {} }])],
        ['100 quadros sem pontos', criarTrilha(30, 640, 480, Array.from({ length: 100 }, (_, i) => ({ i, t: i / 30, pontos: {} })))],
        ['2 quadros', trilhaSintetica(cfg, 30, 2 / 30)],
        ['1 quadro/s', trilhaSintetica(cfg, 1, 20)],
        ['240 quadros/s', trilhaSintetica(cfg, 240, 4)],
        ['começa em 10 s', trilhaSintetica(cfg, 30, 6, { inicio: 10 })],
        ['ruído de 25 px', trilhaSintetica(cfg, 30, 6, { ruidoPx: 25 })],
        ['60% dos quadros perdidos', trilhaSintetica(cfg, 30, 6, { ausentes: (t) => Math.floor(t * 30) % 5 < 3 })],
      ];
      for (const [nome, trilha] of casos) {
        const analise = analisarGesto(modelo.id, trilha, { escalaCmPorPx: 0.3, cameraFixa: true });
        tudoFinito(analise, `${modelo.id} / ${nome}`);
        expect(() => caixasDoRosto(trilha), nome).not.toThrow();
        expect(() => montarCartoes(analise.metricas, modelo.id), nome).not.toThrow();
        expect(lerTrilha(serializarTrilha(trilha)).quadros, nome).toHaveLength(trilha.quadros.length);
      }
    });
  }

  it('sem pessoa na imagem os eventos de marcha e de corrida ficam vazios', () => {
    const vazia = criarTrilha(30, 640, 480, Array.from({ length: 120 }, (_, i) => ({ i, t: i / 30, pontos: {} })));
    expect(detectarEventosMarcha(vazia)).toEqual([]);
    expect(detectarEventosCorrida(vazia)).toEqual([]);
  });

  it('pontos com NaN ou coordenadas absurdas não contaminam as métricas', () => {
    const sorteio = aleatorio(7);
    const base = trilhaSintetica(configurar('marcha'), 30, 4);
    const ruim: TrilhaPose = {
      ...base,
      quadros: base.quadros.map((q) => ({
        ...q,
        pontos: Object.fromEntries(Object.entries(q.pontos).map(([nome, p]) => {
          const r = sorteio();
          if (r < 0.05) return [nome, { ...p, x: Number.NaN }];
          if (r < 0.1) return [nome, { ...p, x: 1e9, y: -1e9 }];
          return [nome, p];
        })),
      })),
    };
    for (const modelo of MODELOS_GESTO) tudoFinito(analisarGesto(modelo.id, ruim), `${modelo.id} / NaN`);
  });
});

describe('muitas correções seguidas', () => {
  it('cem correções alternando os dois joelhos mantêm a análise válida e a trilha anterior intacta', () => {
    const inicial = trilhaSintetica(configurar('marcha'), 30, 20);
    let atual = inicial;
    for (let i = 0; i < 100; i++) atual = corrigirPonto(atual, (i * 7) % atual.quadros.length, i % 2 ? 'joelho_d' : 'joelho_e', { x: 100 + i, y: 200 });
    expect(atual.quadros.filter((q) => q.pontos.joelho_d?.manual || q.pontos.joelho_e?.manual).length).toBeGreaterThan(50);
    expect(inicial.quadros.every((q) => !q.pontos.joelho_d?.manual && !q.pontos.joelho_e?.manual)).toBe(true);
    tudoFinito(analisarGesto('marcha', atual), 'marcha corrigida');
  });
});
