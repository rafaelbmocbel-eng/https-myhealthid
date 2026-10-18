import { describe, expect, it } from 'vitest';
import { analisarMovimento } from '../lib/angular/movimento/analisarMovimento';
import { novoCriterio } from '../lib/angular/movimento/criterios';
import { IDS_PROTOCOLO, protocoloDo } from '../lib/angular/movimento/protocolos';
import type { AnaliseMovimento, IdProtocolo } from '../lib/angular/movimento/tipos';
import { termoProibido } from '../lib/angular/movimento/vocabulario';
import { aleatorio } from '../lib/angular/video/figuraSintetica';
import { NOMES_PONTOS, type QuadroPose, type TrilhaPose } from '../lib/angular/video/tipos';
import { trilhaAgachamentoFrontal, trilhaAgachamentoLateral, trilhaMarcha } from './movimentoMotorSintetico';

const permitido = new RegExp('^[\\x20-\\x7E\\u00A0-\\u00FF≥≤−–—·→“”‘’]*$');

/** Propriedades que valem para qualquer saída, venha o dado que vier. */
function verificar(a: AnaliseMovimento, rotulo: string): void {
  expect(a.avisos.join(' '), `${rotulo}: erro interno`).not.toMatch(/Erro interno/);
  const n = a.repeticoes.length;
  const p = protocoloDo(a.protocolo);
  expect(a.medidas.map((m) => m.def.id), rotulo).toEqual(p.medidas.map((m) => m.id));
  for (const m of a.medidas) {
    const lados = m.def.porLado ? ['D', 'E'] : ['unico'];
    for (const l of lados) {
      const v = m.valores[l as 'D' | 'E' | 'unico'];
      expect(v, `${rotulo}: ${m.def.id}/${l}`).toHaveLength(n);
      for (const x of v ?? []) expect(x === null || Number.isFinite(x), `${rotulo}: ${m.def.id}/${l} = ${x}`).toBe(true);
      const u = m.incerteza[l as 'D' | 'E' | 'unico'];
      expect(u === null || (typeof u === 'number' && Number.isFinite(u) && u >= 0), `${rotulo}: u ${m.def.id}`).toBe(true);
      const r = a.resumos[m.def.id]?.[l as 'D' | 'E' | 'unico'];
      expect(r, `${rotulo}: resumo ${m.def.id}/${l}`).toBeDefined();
      expect(r?.n).toBe((v ?? []).filter((x) => x !== null).length);
    }
  }
  a.repeticoes.forEach((r, k) => {
    expect(r.numero).toBe(k + 1);
    expect([r.inicioI, r.fundoI, r.fimI].every((i) => Number.isInteger(i) && i >= 0), `${rotulo}: índices`).toBe(true);
    expect(r.inicioI <= r.fundoI && r.fundoI <= r.fimI, `${rotulo}: ordem dos marcos`).toBe(true);
    expect([r.inicioT, r.fundoT, r.fimT, r.duracao].every(Number.isFinite), `${rotulo}: tempos`).toBe(true);
  });
  const ids = new Set<string>();
  for (const x of a.achados) {
    expect(ids.has(x.id), `${rotulo}: id repetido ${x.id}`).toBe(false);
    ids.add(x.id);
    expect(Number.isFinite(x.valor as number), `${rotulo}: valor`).toBe(true);
    expect(x.incerteza === null || Number.isFinite(x.incerteza), `${rotulo}: incerteza`).toBe(true);
    for (const i of x.repeticoes) expect(i >= 0 && i < n, `${rotulo}: posição ${i}`).toBe(true);
    if (x.equivalenteCm !== undefined && x.equivalenteCm !== null) expect(Number.isFinite(x.equivalenteCm)).toBe(true);
  }
  for (const t of [...a.avisos, ...a.achados.map((x) => x.descricao), ...a.medidas.flatMap((m) => m.avisos)]) {
    expect(termoProibido(t), t).toBeNull();
    expect(permitido.test(t), t).toBe(true);
  }
  expect(a.incerteza.quadroS).toBeGreaterThan(0);
  expect(Number.isFinite(a.incerteza.quadroS)).toBe(true);
  for (const s of Object.values(a.series)) expect(s).toHaveLength(a.series[Object.keys(a.series)[0]].length);
}

function paraTodos(trilha: TrilhaPose, rotulo: string, opcoes = {}): AnaliseMovimento[] {
  return IDS_PROTOCOLO.map((id) => {
    const a = analisarMovimento(id, trilha, opcoes);
    verificar(a, `${rotulo} / ${id}`);
    return a;
  });
}

const quadro = (i: number, t: number, pontos: QuadroPose['pontos'] = {}): QuadroPose => ({ i, t, pontos });
const trilhaDe = (quadros: QuadroPose[], fps = 30): TrilhaPose => ({ fps, largura: 640, altura: 480, quadros });

/** Corpo de pé com todos os pontos usados pelos protocolos, em pixels. */
function corpoEmPe(deslocamento = 0): QuadroPose['pontos'] {
  const p = (x: number, y: number) => ({ x: x + deslocamento, y, conf: 0.9 });
  return {
    ombro_d: p(300, 150), ombro_e: p(340, 150), quadril_d: p(305, 260), quadril_e: p(335, 260), joelho_d: p(305, 350), joelho_e: p(335, 350),
    tornozelo_d: p(305, 430), tornozelo_e: p(335, 430), calcanhar_d: p(300, 440), calcanhar_e: p(330, 440), pe_d: p(330, 445), pe_e: p(360, 445),
    nariz: p(320, 100), orelha_d: p(310, 100), orelha_e: p(330, 100),
  };
}

describe('trilhas degeneradas: nenhuma exceção, listas vazias e avisos', () => {
  it('trilha sem quadros', () => {
    for (const a of paraTodos(trilhaDe([]), 'vazia')) {
      expect(a.repeticoes).toEqual([]);
      expect(a.achados).toEqual([]);
      expect(a.avisos.join(' ')).toMatch(/não tem quadros/);
      expect(a.medidas.length).toBeGreaterThan(0);
    }
  });

  it('trilha nula ou sem a lista de quadros (dado corrompido)', () => {
    for (const ruim of [null, undefined, {}, { fps: 30, quadros: 'x' }]) {
      for (const id of IDS_PROTOCOLO) {
        const a = analisarMovimento(id, ruim as unknown as TrilhaPose);
        verificar(a, `corrompida ${JSON.stringify(ruim)} / ${id}`);
        expect(a.repeticoes).toEqual([]);
      }
    }
  });

  it.each([1, 2, 3, 5, 9])('trilha de %i quadro(s) com o corpo de pé', (n) => {
    const quadros = Array.from({ length: n }, (_, i) => quadro(i, i / 30, corpoEmPe()));
    for (const a of paraTodos(trilhaDe(quadros), `${n} quadros`)) {
      expect(a.repeticoes).toEqual([]);
      expect(a.achados).toEqual([]);
    }
  });

  it('corpo parado durante 10 s: não há repetição nem passada', () => {
    const quadros = Array.from({ length: 300 }, (_, i) => quadro(i, i / 30, corpoEmPe()));
    for (const a of paraTodos(trilhaDe(quadros), 'parado')) {
      expect(a.repeticoes).toEqual([]);
      expect(a.achados).toEqual([]);
      expect(a.avisos.length).toBeGreaterThan(0);
    }
  });

  it('nenhum ponto detectado em nenhum quadro, e pontos só com confiança baixa', () => {
    const vazios = Array.from({ length: 200 }, (_, i) => quadro(i, i / 30));
    for (const a of paraTodos(trilhaDe(vazios), 'sem pontos')) {
      expect(a.repeticoes).toEqual([]);
      expect(a.avisos.join(' ')).toMatch(/detectado/);
    }
    const fracos = Array.from({ length: 200 }, (_, i) => {
      const pontos = corpoEmPe(i % 7);
      for (const p of Object.values(pontos)) p.conf = 0.05;
      return quadro(i, i / 30, pontos);
    });
    for (const a of paraTodos(trilhaDe(fracos), 'confiança baixa')) expect(a.repeticoes).toEqual([]);
  });

  it('coordenadas NaN, infinitas, enormes ou todas iguais', () => {
    const ruins = [Number.NaN, Infinity, -Infinity, 1e300, -1e300];
    for (const v of ruins) {
      const quadros = Array.from({ length: 150 }, (_, i) => {
        const pontos = corpoEmPe();
        for (const nome of Object.keys(pontos)) if ((i + nome.length) % 3 === 0) pontos[nome] = { x: v, y: v, conf: 0.9 };
        return quadro(i, i / 30, pontos);
      });
      paraTodos(trilhaDe(quadros), `coordenada ${v}`);
    }
    const iguais = Array.from({ length: 150 }, (_, i) => {
      const pontos: QuadroPose['pontos'] = {};
      for (const nome of NOMES_PONTOS) pontos[nome] = { x: 100, y: 100, conf: 0.9 };
      return quadro(i, i / 30, pontos);
    });
    for (const a of paraTodos(trilhaDe(iguais), 'todos os pontos no mesmo lugar')) expect(a.achados).toEqual([]);
  });

  it('tempos repetidos, decrescentes ou inválidos e taxa de quadros inválida', () => {
    const base = trilhaAgachamentoLateral({ reps: 3 });
    const variantes: [string, TrilhaPose][] = [
      ['tempos iguais', { ...base, quadros: base.quadros.map((q) => ({ ...q, t: 1 })) }],
      ['tempos decrescentes', { ...base, quadros: base.quadros.map((q, i, todos) => ({ ...q, t: todos[todos.length - 1 - i].t })) }],
      ['tempos NaN', { ...base, quadros: base.quadros.map((q) => ({ ...q, t: Number.NaN })) }],
      ['fps zero', { ...base, fps: 0 }],
      ['fps NaN', { ...base, fps: Number.NaN }],
      ['fps negativo', { ...base, fps: -30 }],
      ['fps enorme', { ...base, fps: 1e6 }],
      ['fps minúsculo', { ...base, fps: 1e-6 }],
      ['largura e altura zero', { ...base, largura: 0, altura: 0 }],
    ];
    for (const [nome, t] of variantes) paraTodos(t, nome);
  });

  it('quadros sem o campo de pontos ou com ponto sem coordenadas', () => {
    const quadros = Array.from({ length: 100 }, (_, i) => (i % 2
      ? ({ i, t: i / 30 } as unknown as QuadroPose)
      : quadro(i, i / 30, { joelho_d: {} as never, quadril_d: { x: 1 } as never, nariz: null as never })));
    paraTodos(trilhaDe(quadros), 'pontos malformados');
  });

  it('opções estranhas: suavização inválida, escala inválida, eventos inválidos e critérios com valor inválido', () => {
    const lateral = trilhaAgachamentoLateral({ ruidoPx: 1, semente: 3 });
    const marcha = trilhaMarcha({ ruidoPx: 1, semente: 3 });
    const criterio = { ...novoCriterio({ id: 'x', chave: 'assimetria_flexao_joelho', metrica: 'flexao_joelho_max', operador: '<=', valor: Number.NaN, unidade: '°', rotulo: 'x', definidoPor: 'Y' }), ativo: true };
    for (const opcoes of [
      { suavizacaoS: Number.NaN }, { suavizacaoS: -1 }, { suavizacaoS: 0 }, { suavizacaoS: 100 }, { escalaCmPorPixel: Number.NaN }, { escalaCmPorPixel: -3 }, { escalaCmPorPixel: 0 },
      { criterios: [criterio] }, { criterios: [] }, { direcao: -1 as const }, { eventos: [] },
      { eventos: [{ id: 'a', lado: 'D' as const, tipo: 'contato' as const, i: -3, t: Number.NaN, sugerido: false }, { id: 'b', lado: 'E' as const, tipo: 'saida' as const, i: 2.5, t: 1, sugerido: true }] },
    ]) {
      verificar(analisarMovimento('agachamento_lateral', lateral, opcoes), `opções ${JSON.stringify(opcoes)}`);
      verificar(analisarMovimento('marcha_lateral', marcha, opcoes), `opções (marcha) ${JSON.stringify(opcoes)}`);
    }
  });

  it('a suavização desligada mede a série bruta e avisa', () => {
    const a = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ ruidoPx: 1, semente: 3 }), { suavizacaoS: 0 });
    verificar(a, 'sem suavização');
    expect(a.repeticoes.length).toBeGreaterThanOrEqual(4);
    expect(a.avisos.join(' ')).toMatch(/Suavização desligada/);
    expect(a.incerteza.angularGraus as number).toBeGreaterThan(0);
  });

  it('um id de protocolo desconhecido é erro de programação e lança, como protocoloDo', () => {
    expect(() => analisarMovimento('inventado' as IdProtocolo, trilhaDe([]))).toThrow();
  });

  it('fuzz: 120 trilhas aleatórias (pontos soltos, saltos, quadros vazios) nos três protocolos', () => {
    const rnd = aleatorio(20260718);
    for (let k = 0; k < 120; k++) {
      const n = 1 + Math.floor(rnd() * 260);
      const modo = k % 4;
      const quadros = Array.from({ length: n }, (_, i) => {
        const pontos: QuadroPose['pontos'] = {};
        for (const nome of NOMES_PONTOS) {
          if (rnd() < (modo === 0 ? 0.1 : modo === 1 ? 0.5 : 0.9)) continue;
          const salto = modo === 3 && rnd() < 0.1 ? 400 : 0;
          pontos[nome] = { x: rnd() * 640 + salto, y: rnd() * 480, ...(rnd() < 0.8 ? { conf: rnd() } : {}) };
        }
        return quadro(i, i / 30 + (modo === 2 ? rnd() * 0.02 : 0), pontos);
      });
      paraTodos(trilhaDe(quadros, modo === 2 ? 25 : 30), `fuzz ${k}`);
    }
  });
});

describe('desempenho', () => {
  const casos: [IdProtocolo, TrilhaPose][] = [
    ['agachamento_lateral', trilhaAgachamentoLateral({ reps: 12, periodo: 3, repouso: 2, ruidoPx: 1.2, semente: 2, flexao: (l) => (l === 'D' ? 108 : 100) })],
    ['agachamento_frontal', trilhaAgachamentoFrontal({ reps: 12, periodo: 3, repouso: 2, ruidoPx: 1.2, semente: 2 })],
    ['marcha_lateral', trilhaMarcha({ duracao: 40, ruidoPx: 1.2, semente: 2 })],
  ];

  it.each(casos)('%s: trilha de 1200 quadros em tempo razoável', (id, trilha) => {
    expect(trilha.quadros.length).toBeGreaterThanOrEqual(1200);
    const t0 = performance.now();
    const a = analisarMovimento(id, trilha);
    const ms = performance.now() - t0;
    verificar(a, `1200 quadros / ${id}`);
    expect(a.repeticoes.length).toBeGreaterThanOrEqual(10);
    // folga larga para máquinas lentas; na medição local fica em dezenas de milissegundos
    expect(ms, `${id}: ${ms.toFixed(0)} ms`).toBeLessThan(1500);
  });

  it('trilha de 6000 quadros (3 minutos e meio) também termina', () => {
    const trilha = trilhaMarcha({ duracao: 200, ruidoPx: 1 });
    expect(trilha.quadros.length).toBe(6000);
    const t0 = performance.now();
    const a = analisarMovimento('marcha_lateral', trilha);
    const ms = performance.now() - t0;
    verificar(a, '6000 quadros');
    expect(ms, `${ms.toFixed(0)} ms`).toBeLessThan(6000);
  });
});
