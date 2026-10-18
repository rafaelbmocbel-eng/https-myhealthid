import { describe, expect, it } from 'vitest';
import { analisarMovimento } from '../lib/angular/movimento/analisarMovimento';
import { avaliarCriterio, novoCriterio } from '../lib/angular/movimento/criterios';
import { escoreZModificado, fmt, fmtUn, mad, mediana, resumir } from '../lib/angular/movimento/estatistica';
import { FATOR_COBERTURA, processarSerie, residuoEntre, residuoNasJanelas } from '../lib/angular/movimento/incerteza';
import { indisponiveisDoProtocolo, protocoloDo } from '../lib/angular/movimento/protocolos';
import { segmentarPicos } from '../lib/angular/movimento/repeticoes';
import type { Achado, AnaliseMovimento, ChaveAchado, ChaveLado } from '../lib/angular/movimento/tipos';
import { termoProibido } from '../lib/angular/movimento/vocabulario';
import { configurar, trilhaSintetica } from '../lib/angular/video/detectorFalso';
import {
  eventosVerdadeMarcha, trilhaAgachamentoFrontal, trilhaAgachamentoLateral, trilhaMarcha, verdadeAgachamento, verdadeFundoLateral,
} from './movimentoMotorSintetico';

const QUADRO = 1 / 30;
const achadosDe = (a: AnaliseMovimento, chave: ChaveAchado): Achado[] => a.achados.filter((x) => x.chave === chave);
const medida = (a: AnaliseMovimento, id: string) => {
  const m = a.medidas.find((x) => x.def.id === id);
  if (!m) throw new Error(`medida ${id} não encontrada`);
  return m;
};
const valores = (a: AnaliseMovimento, id: string, lado: ChaveLado): number[] => (medida(a, id).valores[lado] ?? []).filter((v): v is number => v !== null);
const media = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
const ASSIMETRIAS: ChaveAchado[] = [
  'assimetria_flexao_joelho', 'assimetria_flexao_quadril', 'assimetria_dorsiflexao', 'assimetria_tempo_apoio', 'assimetria_flexao_joelho_marcha', 'assimetria_amplitude_quadril',
];
const permitido = new RegExp('^[\\x20-\\x7E\\u00A0-\\u00FF≥≤−–—·→“”‘’]*$');

describe('estatística e incerteza', () => {
  it('resume ignorando lacunas e marca primeira, última e tendência com sinal', () => {
    const r = resumir([null, 4, 6, null, 8, 2, null]);
    expect(r).toMatchObject({ n: 4, media: 5, mediana: 5, min: 2, max: 8, primeira: 4, ultima: 2, iPrimeira: 1, iUltima: 5, tendencia: -2 });
    expect(r.dp).toBeCloseTo(Math.sqrt(((1) ** 2 + 1 + 9 + 9) / 3), 9);
    expect(resumir([null, null])).toMatchObject({ n: 0, media: null, dp: null, tendencia: null, primeira: null });
    expect(resumir([3])).toMatchObject({ n: 1, media: 3, dp: null, tendencia: null });
  });

  it('escore z modificado de Iglewicz e Hoaglin: 0,6745 × (valor − mediana) ÷ MAD, e MAD = 0 não é avaliado', () => {
    const v = [10, 11, 12, 13, 30];
    const med = mediana(v) as number, m = mad(v) as number;
    expect(med).toBe(12);
    expect(m).toBe(1);
    expect(escoreZModificado(30, med, m)).toBeCloseTo(0.6745 * 18, 9);
    expect(escoreZModificado(5, 5, 0)).toBeNull();
    expect(escoreZModificado(5, 5, null)).toBeNull();
  });

  it('formata em pt-BR, com vírgula, sinal de menos e a unidade certa', () => {
    expect(fmt(98.24)).toBe('98,2');
    expect(fmt(-0.04)).toBe('0,0');
    expect(fmt(-7.26)).toBe('−7,3');
    expect(fmt(null)).toBe('–');
    expect(fmtUn(98.24, '°')).toBe('98,2°');
    expect(fmtUn(0.656, 's')).toBe('0,66 s');
    expect(fmtUn(12.34, '% da coxa')).toBe('12,3 % da coxa');
  });

  it('o resíduo é a raiz da soma dos quadrados ÷ (n − 1) e só conta amostras com as duas séries', () => {
    const bruto = [1, 2, null, 4, 5, 6, 7, 8];
    const suave = [1.5, 2, 3, null, 5, 5, 7, 9];
    const r = residuoEntre(bruto, suave);
    expect(r.n).toBe(6);
    expect(r.u).toBeCloseTo(Math.sqrt((0.25 + 0 + 0 + 1 + 0 + 1) / 5), 9);
    expect(residuoEntre([1, 2, 3], [1, 2, 3]).u).toBeNull();
  });

  it('a incerteza de uma série sem ruído é praticamente nula e a de uma série ruidosa acompanha o ruído, com o fator de cobertura', () => {
    const limpa = Array.from({ length: 300 }, (_, i) => 50 + 40 * Math.sin(i / 20));
    expect(processarSerie(limpa, 30, 0.12).u as number).toBeLessThan(0.3);
    let estado = 12345;
    const alea = () => { estado = (estado * 1664525 + 1013904223) >>> 0; return estado / 4294967296 - 0.5; };
    const sigma = 2;
    const ruidosa = limpa.map((v) => v + (alea() + alea() + alea() + alea()) * sigma * Math.sqrt(3));
    const u = processarSerie(ruidosa, 30, 0.12).u as number;
    // resíduo do Savitzky–Golay de 5 pontos ≈ 0,72 do desvio do ruído; vezes o fator de cobertura
    expect(u / FATOR_COBERTURA).toBeGreaterThan(0.55 * sigma);
    expect(u / FATOR_COBERTURA).toBeLessThan(0.9 * sigma);
  });

  it('com a suavização desligada a incerteza não vira zero: vem do resíduo contra a suavização padrão', () => {
    const limpa = Array.from({ length: 300 }, (_, i) => 50 + 40 * Math.sin(i / 20) + (i % 2 ? 1.5 : -1.5));
    const s = processarSerie(limpa, 30, 0);
    expect(s.suave).toEqual(limpa);
    expect(s.u as number).toBeGreaterThan(1);
  });

  it('o resíduo por janelas só olha os quadros pedidos', () => {
    const bruto = Array.from({ length: 40 }, (_, i) => (i >= 20 ? (i % 2 ? 5 : -5) : 0));
    const suave = Array.from({ length: 40 }, () => 0);
    expect(residuoNasJanelas(bruto, suave, [[0, 19]]).u).toBe(0);
    expect(residuoNasJanelas(bruto, suave, [[20, 39], [25, 30]]).u as number).toBeGreaterThan(4.5);
  });

  it('o veredito de um critério usa o intervalo valor ± incerteza', () => {
    const c = { operador: '<=' as const, valor: 5 };
    expect(avaliarCriterio(3, 1, c)).toBe('dentro_do_criterio');
    expect(avaliarCriterio(5.5, 1, c)).toBe('no_limite');
    expect(avaliarCriterio(8, 1, c)).toBe('fora_do_criterio');
  });
});

describe('segmentação das repetições (histerese)', () => {
  const onda = (n: number, periodo: number, amplitude: number, ruido: number, semente: number) => {
    let e = semente;
    const alea = () => { e = (e * 1664525 + 1013904223) >>> 0; return e / 4294967296 - 0.5; };
    return Array.from({ length: n }, (_, i) => {
      const fase = i / periodo;
      const u = fase < 1 || fase >= 4 ? 0 : (1 - Math.cos(2 * Math.PI * (fase - 1))) / 2;
      return amplitude * u + (alea() + alea() + alea()) * ruido;
    });
  };

  it('ruído em pé não cria repetições nem desloca o fundo', () => {
    const serie = onda(30 * 8, 30, 100, 3, 7);
    const reps = segmentarPicos(serie, 30, { amplitudeMin: 20, proeminenciaMin: 20, distMinS: 0.8, ruido: 1.5 });
    expect(reps).toHaveLength(3);
    reps.forEach((r, k) => {
      expect(Math.abs(r.fundoI - (45 + 30 * k + 15 - 15 + 0))).toBeLessThanOrEqual(31);
      expect(r.inicioI).toBeLessThan(r.fundoI);
      expect(r.fundoI).toBeLessThan(r.fimI);
      expect(r.incompleta).toBe(false);
    });
  });

  it('série sem amplitude suficiente ou sem valores não tem repetição', () => {
    expect(segmentarPicos(onda(240, 30, 10, 1, 3), 30, { amplitudeMin: 20, proeminenciaMin: 20, distMinS: 0.8, ruido: 0 })).toEqual([]);
    expect(segmentarPicos([], 30, { amplitudeMin: 20, proeminenciaMin: 20, distMinS: 0.8, ruido: 0 })).toEqual([]);
    expect(segmentarPicos(Array(100).fill(null), 30, { amplitudeMin: 20, proeminenciaMin: 20, distMinS: 0.8, ruido: 0 })).toEqual([]);
  });
});

describe('agachamento de lado: repetições e medidas', () => {
  it('acha as 5 repetições conhecidas, com o fundo no instante certo e início e fim em volta dele', () => {
    for (const ruidoPx of [0, 1.5]) {
      const cfg = { ruidoPx, semente: 5 };
      const a = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral(cfg));
      const v = verdadeAgachamento(cfg);
      expect(a.repeticoes, `ruído ${ruidoPx}`).toHaveLength(5);
      a.repeticoes.forEach((r, k) => {
        expect(r.numero).toBe(k + 1);
        expect(r.lado).toBeNull();
        expect(Math.abs(r.fundoT - v.fundo[k]), `fundo ${k}`).toBeLessThanOrEqual(2 * QUADRO);
        expect(r.inicioT, `início ${k}`).toBeGreaterThan(v.inicio[k] - QUADRO);
        expect(r.inicioT, `início ${k}`).toBeLessThan(v.inicio[k] + 0.2 * 3);
        expect(r.fimT, `fim ${k}`).toBeLessThan(v.fim[k] + QUADRO);
        expect(r.fimT, `fim ${k}`).toBeGreaterThan(v.fim[k] - 0.2 * 3);
        expect(r.inicioT).toBeLessThan(r.fundoT);
        expect(r.fundoT).toBeLessThan(r.fimT);
        expect(r.duracao).toBeCloseTo(r.fimT - r.inicioT, 9);
        expect(r.sinalizadores).toEqual([]);
      });
    }
  });

  it('mede a flexão do joelho, a dorsiflexão, o avanço e a profundidade conhecidos pela construção da figura', () => {
    const a = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({}));
    const verdade = verdadeFundoLateral(105, 25);
    for (const lado of ['D', 'E'] as const) {
      expect(media(valores(a, 'flexao_joelho_max', lado))).toBeCloseTo(105, 0);
      expect(media(valores(a, 'dorsiflexao_max', lado))).toBeCloseTo(25, 0);
      expect(media(valores(a, 'avanco_joelho_fundo', lado))).toBeCloseTo(verdade.avancoPct, 0);
    }
    expect(media(valores(a, 'profundidade_quadril', 'unico'))).toBeCloseTo(verdade.profundidadePct, 0);
    expect(media(valores(a, 'inclinacao_tronco_fundo', 'unico'))).toBeCloseTo(30, 0);
    expect(media(valores(a, 'duracao_repeticao', 'unico'))).toBeGreaterThan(2.4);
    expect(media(valores(a, 'duracao_repeticao', 'unico'))).toBeLessThan(3.01);
  });

  it('uma entrada por medida do protocolo, alinhada às repetições, com resumo por lado', () => {
    const p = protocoloDo('agachamento_lateral');
    const a = analisarMovimento(p, trilhaAgachamentoLateral({ ruidoPx: 1, semente: 2 }));
    expect(a.medidas.map((m) => m.def.id)).toEqual(p.medidas.map((m) => m.id));
    for (const m of a.medidas) {
      const lados: ChaveLado[] = m.def.porLado ? ['D', 'E'] : ['unico'];
      expect(Object.keys(m.valores).sort()).toEqual([...lados].sort());
      for (const l of lados) {
        expect(m.valores[l]).toHaveLength(a.repeticoes.length);
        expect(m.incerteza[l]).not.toBeUndefined();
        const r = a.resumos[m.def.id][l];
        expect(r?.n).toBe(valores(a, m.def.id, l).length);
      }
    }
    expect(a.planoFilmado).toBe('lateral');
    expect(Object.keys(a.series).sort()).toEqual(p.articulacoes.map((d) => d.id).sort());
    expect(a.incerteza.quadroS).toBeCloseTo(QUADRO, 9);
    expect(a.incerteza.angularGraus).toBeGreaterThan(0);
    expect(a.incerteza.formula).toContain('raiz(');
    expect(a.eventos).toEqual([]);
  });

  it('o paciente virado para a esquerda dá as mesmas medidas, com a direção estimada ou informada', () => {
    const base = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ direcao: 1 }));
    const espelhada = trilhaAgachamentoLateral({ direcao: -1 });
    for (const opcoes of [{}, { direcao: -1 as const }]) {
      const a = analisarMovimento('agachamento_lateral', espelhada, opcoes);
      expect(a.direcao).toBe(-1);
      expect(a.repeticoes).toHaveLength(5);
      for (const id of ['flexao_joelho_max', 'flexao_quadril_max', 'dorsiflexao_max', 'avanco_joelho_fundo']) {
        expect(media(valores(a, id, 'D')), id).toBeCloseTo(media(valores(base, id, 'D')), 1);
      }
      expect(media(valores(a, 'inclinacao_tronco_fundo', 'unico'))).toBeCloseTo(media(valores(base, 'inclinacao_tronco_fundo', 'unico')), 1);
    }
  });

  it('funciona com a figura sintética do motor de vídeo (5 repetições de 3 s, flexão de 105°)', () => {
    const cfg = configurar('agachamento');
    const a = analisarMovimento('agachamento_lateral', trilhaSintetica(cfg, 30, 15));
    expect(a.repeticoes).toHaveLength(5);
    a.repeticoes.forEach((r, k) => expect(Math.abs(r.fundoT - (1.5 + 3 * k))).toBeLessThanOrEqual(2 * QUADRO));
    expect(media(valores(a, 'flexao_joelho_max', 'D'))).toBeCloseTo(105, 0);
    expect(media(valores(a, 'dorsiflexao_max', 'E'))).toBeCloseTo(25, 0);
    expect(a.achados.filter((x) => ASSIMETRIAS.includes(x.chave))).toEqual([]);
  });

  it('sem critério do profissional nenhum achado tem veredito', () => {
    const a = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ flexao: (l) => (l === 'D' ? 105 : 90), ruidoPx: 1, semente: 4 }));
    expect(a.achados.length).toBeGreaterThan(0);
    for (const x of a.achados) {
      expect(x.situacao, x.id).toBe('sem_referencia');
      expect(x.veredito, x.id).toBeUndefined();
      expect(x.gatilho, x.id).not.toBe('criterio_profissional');
    }
  });
});

describe('agachamento de lado: achados', () => {
  it('uma diferença injetada na flexão do joelho D × E vira achado, com o lado maior, os valores por lado e a incerteza', () => {
    const cfg = { flexao: (l: 'D' | 'E') => (l === 'D' ? 108 : 96), ruidoPx: 1.5, semente: 11 };
    const a = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral(cfg));
    const [x] = achadosDe(a, 'assimetria_flexao_joelho');
    expect(x).toBeDefined();
    expect(x.gatilho).toBe('assimetria_entre_lados');
    expect(x.lado).toBe('D');
    expect(x.medida).toBe('flexao_joelho_max');
    expect(x.unidade).toBe('°');
    expect(x.valor as number).toBeGreaterThan(10);
    expect(x.valor as number).toBeLessThan(14);
    expect(x.valoresPorLado?.D as number).toBeGreaterThan(x.valoresPorLado?.E as number);
    expect(x.incerteza as number).toBeGreaterThan(0);
    expect(x.superaIncerteza).toBe(true);
    expect(x.repeticoes).toEqual([0, 1, 2, 3, 4]);
    expect(x.planoCamera).toBe('lateral');
    expect(x.limitacoes.length).toBeGreaterThan(0);
    expect(x.descricao).toMatch(/lado direito/);
    expect(x.descricao).toMatch(/lado esquerdo/);
  });

  it('uma diferença só na dorsiflexão aparece só no achado da dorsiflexão', () => {
    const a = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ dorsiflexao: (l) => (l === 'E' ? 12 : 26) }));
    expect(achadosDe(a, 'assimetria_dorsiflexao')).toHaveLength(1);
    expect(achadosDe(a, 'assimetria_dorsiflexao')[0].lado).toBe('D');
    expect(achadosDe(a, 'assimetria_flexao_joelho')).toEqual([]);
  });

  it('vídeo simétrico com ruído não gera achado de assimetria (30 sementes)', () => {
    for (let semente = 1; semente <= 30; semente++) {
      const a = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ ruidoPx: 1.5, semente }));
      expect(a.achados.filter((x) => x.gatilho === 'assimetria_entre_lados').map((x) => x.id), `semente ${semente}`).toEqual([]);
    }
  });

  it('vídeo simétrico e sem ruído não gera nenhum achado', () => {
    const a = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({}));
    expect(a.achados).toEqual([]);
  });

  it('a profundidade diminuindo ao longo da série vira tendência (com sinal) e variação da profundidade', () => {
    const flexao = (_: 'D' | 'E', r: number) => 115 - 7.5 * r;
    const a = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ flexao, ruidoPx: 1, semente: 3 }));
    const t = achadosDe(a, 'tendencia_na_serie').find((x) => x.medida === 'profundidade_quadril');
    expect(t, 'tendência da profundidade').toBeDefined();
    expect(t?.gatilho).toBe('tendencia_primeira_ultima');
    expect(t?.valor as number).toBeLessThan(-30);
    expect(t?.repeticoes).toEqual([0, 4]);
    expect(t?.superaIncerteza).toBe(true);
    expect(t?.descricao).toMatch(/diminuiu/);
    const esperado = (-Math.cos(60 * Math.PI / 180) + Math.cos(90 * Math.PI / 180)) * 100;
    expect(t?.valor as number).toBeCloseTo(esperado, -1);
    const v = achadosDe(a, 'variacao_profundidade').find((x) => x.gatilho === 'variacao_entre_repeticoes');
    expect(v?.valor as number).toBeGreaterThan(10);
    const joelho = achadosDe(a, 'tendencia_na_serie').filter((x) => x.medida === 'flexao_joelho_max');
    expect(joelho.map((x) => x.lado).sort()).toEqual(['D', 'E']);
    expect(joelho.every((x) => (x.valor as number) < -25)).toBe(true);
  });

  it('com menos de 3 repetições não calcula tendência, variação nem comparação entre os lados, e avisa', () => {
    const a = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ reps: 2, flexao: (l) => (l === 'D' ? 110 : 90) }));
    expect(a.repeticoes).toHaveLength(2);
    expect(a.achados).toEqual([]);
    expect(a.avisos.join(' ')).toMatch(/menos de 3/);
    const uma = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ reps: 1 }));
    expect(uma.repeticoes).toHaveLength(1);
    expect(uma.achados).toEqual([]);
  });

  it('uma repetição discrepante é apontada quando as demais variam um pouco (MAD > 0) e não quando são idênticas (MAD = 0)', () => {
    const flexao = (_: 'D' | 'E', r: number) => (r === 3 ? 70 : 108);
    const comRuido = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ reps: 6, flexao, ruidoPx: 0.6, semente: 8 }));
    const d = comRuido.achados.filter((x) => x.gatilho === 'repeticao_discrepante' && x.medida === 'profundidade_quadril');
    expect(d.map((x) => x.repeticoes)).toEqual([[3]]);
    expect(d[0].valor as number).toBeLessThan(-20);
    expect(d[0].descricao).toMatch(/repetição 4/);
    expect(d[0].descricao).toMatch(/abaixo da mediana/);
    expect(d[0].descricao).toMatch(/não limite clínico/);
    const identicas = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ reps: 6, flexao }));
    expect(identicas.achados.filter((x) => x.gatilho === 'repeticao_discrepante')).toEqual([]);
  });

  it('o avanço do joelho é só observação medida, sem veredito, e vira equivalente em cm só com a escala', () => {
    const cfg = { dorsiflexao: (_: 'D' | 'E', r: number) => 10 + 4 * r, ruidoPx: 0.5, semente: 6 };
    const sem = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral(cfg));
    const xs = achadosDe(sem, 'avanco_joelho');
    expect(xs.length).toBeGreaterThan(0);
    for (const x of xs) {
      expect(x.situacao).toBe('sem_referencia');
      expect(x.veredito).toBeUndefined();
      expect(x.equivalenteCm).toBeUndefined();
    }
    const com = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral(cfg), { escalaCmPorPixel: 0.4 });
    const tendencia = achadosDe(com, 'tendencia_na_serie').find((x) => x.medida === 'avanco_joelho_fundo');
    expect(tendencia?.equivalenteCm).toBeTypeOf('number');
    // % do comprimento do pé × comprimento do pé em pixels × escala; o pé da figura mede 0,23 m = cerca de 50 px de 480 px para 2,2 m
    const pePx = 0.23 * (480 / 2.2);
    expect(Math.abs(tendencia?.equivalenteCm as number)).toBeCloseTo((Math.abs(tendencia?.valor as number) / 100) * pePx * 0.4, 0);
    const angulo = achadosDe(com, 'tendencia_na_serie').find((x) => x.medida === 'flexao_joelho_max');
    expect(angulo?.equivalenteCm).toBeUndefined();
  });

  it('repetição que encosta numa ponta do trecho fica na lista como incompleta, sem medidas, e o restante é medido', () => {
    const inteira = trilhaAgachamentoLateral({});
    const cortada = { ...inteira, quadros: inteira.quadros.filter((q) => q.t >= 1.7 && q.t < 12.2).map((q, i) => ({ ...q, i })) };
    const a = analisarMovimento('agachamento_lateral', cortada);
    const incompletas = a.repeticoes.filter((r) => r.sinalizadores.includes('incompleta'));
    expect(incompletas).toHaveLength(2);
    expect(a.repeticoes[0].sinalizadores).toContain('incompleta');
    expect(a.repeticoes[a.repeticoes.length - 1].sinalizadores).toContain('incompleta');
    a.repeticoes.forEach((r, k) => {
      if (!r.sinalizadores.includes('incompleta')) return;
      for (const m of a.medidas) for (const l of Object.keys(m.valores) as ChaveLado[]) expect(m.valores[l]?.[k], `${m.def.id} rep ${k}`).toBeNull();
    });
    const completas = a.repeticoes.filter((r) => !r.sinalizadores.includes('incompleta'));
    expect(completas).toHaveLength(2);
    expect(a.avisos.join(' ')).toMatch(/2 repetições incompletas/);
    expect(media(valores(a, 'flexao_joelho_max', 'D'))).toBeCloseTo(105, 0);
  });

  it('pontos ausentes em parte dos quadros: as medidas que dependem deles ficam sem valor e a repetição é sinalizada', () => {
    const cfg = { perdidos: (_i: number, t: number) => (t > 4.2 && t < 7.2 ? ['joelho_e'] : false) };
    const a = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral(cfg));
    expect(a.repeticoes).toHaveLength(5);
    const afetadas = a.repeticoes.map((r, k) => (r.sinalizadores.includes('pontos_ausentes') ? k : -1)).filter((k) => k >= 0);
    expect(afetadas).toEqual([1]);
    const joelho = medida(a, 'flexao_joelho_max');
    expect(joelho.valores.E?.[1]).toBeNull();
    expect(joelho.valores.D?.[1]).not.toBeNull();
    expect(joelho.valores.E?.filter((v) => v !== null)).toHaveLength(4);
    expect(joelho.avisos.join(' ')).toMatch(/falta de pontos/);
  });
});

describe('agachamento de frente', () => {
  it('acha as repetições pelos vales da altura dos quadris e mede a descida da pelve', () => {
    const cfg = { descida: () => 0.3 };
    const a = analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal(cfg));
    const v = verdadeAgachamento(cfg);
    expect(a.planoFilmado).toBe('frontal');
    expect(a.repeticoes).toHaveLength(5);
    a.repeticoes.forEach((r, k) => expect(Math.abs(r.fundoT - v.fundo[k])).toBeLessThanOrEqual(2 * QUADRO));
    // descida de 0,30 m sobre 0,86 m entre o quadril e o tornozelo em pé (34,9%), medida do início do movimento (5% da descida) até o fundo
    const descida = media(valores(a, 'descida_pelve', 'unico'));
    expect(descida).toBeGreaterThan(32.5);
    expect(descida).toBeLessThan(35.5);
  });

  it('um valgo maior de um lado vira achado, apontando o lado, e o simétrico não gera', () => {
    const a = analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal({ medial: (l) => (l === 'D' ? 0.07 : 0.01), ruidoPx: 1, semente: 9 }));
    const [x] = achadosDe(a, 'valgo_dinamico').filter((y) => y.gatilho === 'assimetria_entre_lados');
    expect(x).toBeDefined();
    expect(x.lado).toBe('D');
    expect(x.medida).toBe('valgo_joelho_max');
    expect(x.valoresPorLado?.D as number).toBeGreaterThan(x.valoresPorLado?.E as number);
    expect(x.planoCamera).toBe('frontal');
    expect(media(valores(a, 'valgo_joelho_max', 'D'))).toBeGreaterThan(media(valores(a, 'valgo_joelho_max', 'E')) + 4);
    const simetrico = analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal({ medial: () => 0.05, ruidoPx: 1, semente: 9 }));
    expect(achadosDe(simetrico, 'valgo_dinamico').filter((y) => y.gatilho === 'assimetria_entre_lados')).toEqual([]);
    expect(media(valores(simetrico, 'valgo_joelho_max', 'D'))).toBeGreaterThan(5);
  });

  it('o valgo é o ângulo do motor: positivo com o joelho para dentro, e o mesmo visto de frente ou de costas', () => {
    const frente = analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal({ medial: () => 0.05 }));
    const costas = analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal({ medial: () => 0.05, deCostas: true }));
    for (const lado of ['D', 'E'] as const) {
      expect(media(valores(frente, 'valgo_joelho_max', lado))).toBeGreaterThan(5);
      expect(media(valores(costas, 'valgo_joelho_max', lado))).toBeCloseTo(media(valores(frente, 'valgo_joelho_max', lado)), 1);
    }
    const varo = analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal({ medial: () => -0.05 }));
    expect(media(valores(varo, 'valgo_joelho_max', 'D'))).toBeLessThan(0.5);
  });

  it('o deslocamento lateral da pelve tem o sinal do lado do paciente, de frente e de costas', () => {
    for (const deCostas of [false, true]) {
      const direita = analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal({ pelve: () => 0.06, deCostas, ruidoPx: 1, semente: 2 }));
      const [d] = achadosDe(direita, 'desvio_lateral_pelve').filter((y) => y.gatilho === 'assimetria_entre_lados');
      expect(d, `direita, deCostas ${deCostas}`).toBeDefined();
      expect(d.lado).toBe('D');
      expect(d.valoresPorLado?.D as number).toBeGreaterThan(0);
      expect(d.unidade).toBe('% da base de apoio');
      expect(d.descricao).toMatch(/lado direito do paciente/);
      // 0,06 m sobre a base entre os tornozelos (0,30 m)
      expect(d.valor as number).toBeCloseTo((0.06 / 0.3) * 100, -1);
      const esquerda = analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal({ pelve: () => -0.06, deCostas, ruidoPx: 1, semente: 2 }));
      const [e] = achadosDe(esquerda, 'desvio_lateral_pelve').filter((y) => y.gatilho === 'assimetria_entre_lados');
      expect(e.lado).toBe('E');
      expect(e.valoresPorLado?.E as number).toBeLessThan(0);
    }
    const centrada = analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal({ pelve: () => 0, ruidoPx: 1, semente: 2 }));
    expect(achadosDe(centrada, 'desvio_lateral_pelve').filter((y) => y.gatilho === 'assimetria_entre_lados')).toEqual([]);
  });

  it('o equivalente em cm do deslocamento da pelve usa a base de apoio em pixels', () => {
    const a = analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal({ pelve: () => 0.06 }), { escalaCmPorPixel: 0.4587 });
    const [d] = achadosDe(a, 'desvio_lateral_pelve').filter((y) => y.gatilho === 'assimetria_entre_lados');
    // 0,06 m = 6 cm, com a escala de 0,4587 cm por pixel (1 px = 0,4587 cm quando 1 m = 218 px)
    expect(d.equivalenteCm as number).toBeCloseTo(6, 0);
  });
});

describe('achados de outro plano de câmera', () => {
  it('o protocolo de lado não calcula valgo nem pelve, e o de frente não calcula flexão, tronco nem avanço: viram indisponíveis com o motivo', () => {
    const lateral = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ ruidoPx: 1, semente: 2 }));
    expect(lateral.indisponiveis).toEqual(indisponiveisDoProtocolo(protocoloDo('agachamento_lateral')));
    expect(lateral.indisponiveis.map((i) => i.chave).sort()).toEqual(['desvio_lateral_pelve', 'valgo_dinamico']);
    expect(lateral.achados.filter((x) => x.chave === 'valgo_dinamico' || x.chave === 'desvio_lateral_pelve')).toEqual([]);
    const frontal = analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal({ ruidoPx: 1, semente: 2 }));
    expect(frontal.indisponiveis.map((i) => i.chave).sort()).toEqual(
      ['assimetria_dorsiflexao', 'assimetria_flexao_joelho', 'assimetria_flexao_quadril', 'avanco_joelho', 'inclinacao_tronco'],
    );
    for (const x of frontal.achados) expect(x.planoCamera).toBe('frontal');
    for (const i of [...lateral.indisponiveis, ...frontal.indisponiveis]) {
      expect(i.motivo.length).toBeGreaterThan(20);
      expect(i.comoObter.length).toBeGreaterThan(40);
    }
  });
});

describe('marcha', () => {
  it('acha as passadas dos dois pés, intercaladas, e alinha as medidas por pé às repetições', () => {
    const a = analisarMovimento('marcha_lateral', trilhaMarcha({ ruidoPx: 1, semente: 3 }));
    expect(a.repeticoes.length).toBeGreaterThanOrEqual(16);
    const lados = a.repeticoes.map((r) => r.lado);
    expect(lados.filter((l) => l === 'D').length).toBeGreaterThanOrEqual(8);
    expect(lados.filter((l) => l === 'E').length).toBeGreaterThanOrEqual(8);
    a.repeticoes.forEach((r, k) => {
      expect(r.lado === 'D' || r.lado === 'E').toBe(true);
      expect(r.duracao).toBeGreaterThan(0.9);
      expect(r.duracao).toBeLessThan(1.3);
      expect(r.inicioT).toBeLessThan(r.fundoT);
      expect(r.fundoT).toBeLessThan(r.fimT);
      if (k > 0) expect(r.inicioI).toBeGreaterThanOrEqual(a.repeticoes[k - 1].inicioI);
    });
    const apoio = medida(a, 'tempo_apoio');
    a.repeticoes.forEach((r, k) => {
      const incompleta = r.sinalizadores.includes('incompleta');
      for (const lado of ['D', 'E'] as const) {
        const v = apoio.valores[lado]?.[k] ?? null;
        if (incompleta || r.lado !== lado) expect(v, `${lado} rep ${k}`).toBeNull();
        else expect(v, `${lado} rep ${k}`).not.toBeNull();
      }
    });
    expect(a.eventos.length).toBeGreaterThan(30);
    expect(medida(a, 'inclinacao_tronco_media').valores.unico?.filter((v) => v !== null).length).toBe(a.repeticoes.filter((r) => !r.sinalizadores.includes('incompleta')).length);
    expect(media(valores(a, 'inclinacao_tronco_media', 'unico'))).toBeCloseTo(5, 0);
    expect(media(valores(a, 'duracao_passada', 'D'))).toBeCloseTo(1.1, 1);
  });

  it('uma diferença injetada no tempo de apoio vira achado apontando o pé de apoio mais longo (eventos conferidos e eventos automáticos)', () => {
    const cfg = { apoio: { D: 0.58, E: 0.7 }, ruidoPx: 1, semente: 2 };
    const trilha = trilhaMarcha(cfg);
    const verdade = eventosVerdadeMarcha(cfg);
    const conferidos = analisarMovimento('marcha_lateral', trilha, { eventos: verdade.eventos });
    const automatico = analisarMovimento('marcha_lateral', trilha);
    for (const [nome, a] of [['conferidos', conferidos], ['automático', automatico]] as const) {
      const [x] = achadosDe(a, 'assimetria_tempo_apoio');
      expect(x, nome).toBeDefined();
      expect(x.lado, nome).toBe('E');
      expect(x.medida).toBe('tempo_apoio');
      expect(x.unidade).toBe('s');
      expect(x.valor as number, nome).toBeGreaterThan(0.09);
      expect(x.valor as number, nome).toBeLessThan(0.16);
      expect(x.descricao, nome).toMatch(/pé direito/);
      expect(x.descricao, nome).toMatch(/pé esquerdo/);
    }
    // com os eventos conferidos os tempos saem exatos: 0,58 × 1,1 s e 0,70 × 1,1 s
    expect(media(valores(conferidos, 'tempo_apoio', 'D'))).toBeCloseTo(verdade.tempoApoio.D, 2);
    expect(media(valores(conferidos, 'tempo_apoio', 'E'))).toBeCloseTo(verdade.tempoApoio.E, 2);
    expect(conferidos.eventos).toEqual(verdade.eventos);
  });

  it('marcha simétrica com ruído não gera achado de assimetria (30 sementes)', () => {
    for (let semente = 1; semente <= 30; semente++) {
      const a = analisarMovimento('marcha_lateral', trilhaMarcha({ ruidoPx: 1.5, semente }));
      expect(a.achados.filter((x) => x.gatilho === 'assimetria_entre_lados').map((x) => x.id), `semente ${semente}`).toEqual([]);
    }
  });

  it('um pico de flexão do joelho no balanço diferente entre os pés é apontado', () => {
    const a = analisarMovimento('marcha_lateral', trilhaMarcha({ elevacao: { D: 0.06, E: 0.2 }, ruidoPx: 1, semente: 5 }));
    const [x] = achadosDe(a, 'assimetria_flexao_joelho_marcha');
    expect(x).toBeDefined();
    expect(x.lado).toBe('E');
    expect(x.medida).toBe('flexao_joelho_pico_balanco');
  });

  it('funciona com a figura sintética de marcha do motor de vídeo e não inventa assimetria nela', () => {
    const cfg = configurar('marcha');
    const a = analisarMovimento('marcha_lateral', trilhaSintetica(cfg, 30, 12));
    expect(a.repeticoes.length).toBeGreaterThanOrEqual(8);
    expect(a.achados.filter((x) => x.gatilho === 'assimetria_entre_lados')).toEqual([]);
    expect(media(valores(a, 'duracao_passada', 'D'))).toBeCloseTo(cfg.tempoPassada, 1);
  });

  it('poucas passadas por pé: avisa e não compara os lados', () => {
    const a = analisarMovimento('marcha_lateral', trilhaMarcha({ duracao: 4, apoio: { D: 0.55, E: 0.75 } }));
    expect(a.avisos.join(' ')).toMatch(/pelo menos 3 por pé/);
    expect(a.achados.filter((x) => x.gatilho === 'assimetria_entre_lados')).toEqual([]);
  });

  it('passada sem a saída do pé fica incompleta; eventos fora do trecho são ignorados; intervalo implausível não é passada', () => {
    const cfg = { ruidoPx: 0 };
    const trilha = trilhaMarcha(cfg);
    const verdade = eventosVerdadeMarcha(cfg).eventos;
    const semUmaSaida = verdade.filter((e) => !(e.lado === 'D' && e.tipo === 'saida' && e.i === verdade.filter((x) => x.lado === 'D' && x.tipo === 'saida')[2].i));
    const a = analisarMovimento('marcha_lateral', trilha, { eventos: semUmaSaida });
    expect(a.repeticoes.filter((r) => r.sinalizadores.includes('incompleta'))).toHaveLength(1);
    expect(a.avisos.join(' ')).toMatch(/sem a saída/);
    const fora = analisarMovimento('marcha_lateral', trilha, { eventos: [...verdade, { id: 'x', lado: 'D', tipo: 'contato', i: 99999, t: 3333, sugerido: false }] });
    expect(fora.avisos.join(' ')).toMatch(/fora do trecho/);
    const lacuna = verdade.filter((e) => !(e.lado === 'D' && e.tipo === 'contato' && e.i > 100 && e.i < 170));
    const l = analisarMovimento('marcha_lateral', trilha, { eventos: lacuna });
    expect(l.avisos.join(' ')).toMatch(/fora de 0,6 a 2,5 s/);
  });
});

describe('critério do profissional', () => {
  const trilha = trilhaAgachamentoLateral({ flexao: (l) => (l === 'D' ? 108 : 96), ruidoPx: 1, semente: 21 });
  const base = {
    id: 'c1', chave: 'assimetria_flexao_joelho' as const, metrica: 'flexao_joelho_max', operador: '<=' as const, valor: 5, unidade: '°',
    rotulo: 'diferença entre os lados ≤ 5°', definidoPor: 'Dra. Teste',
  };

  it('critério desligado ou sem responsável não gera veredito', () => {
    const desligado = novoCriterio(base);
    expect(desligado.ativo).toBe(false);
    const a = analisarMovimento('agachamento_lateral', trilha, { criterios: [desligado, { ...desligado, ativo: true, definidoPor: '  ' }] });
    expect(a.achados.filter((x) => x.gatilho === 'criterio_profissional')).toEqual([]);
    expect(a.achados.every((x) => x.situacao === 'sem_referencia')).toBe(true);
  });

  it('critério ativo dá um achado próprio com o veredito, a incerteza e o nome de quem definiu', () => {
    const c = { ...novoCriterio(base), ativo: true };
    const a = analisarMovimento('agachamento_lateral', trilha, { criterios: [c] });
    const x = a.achados.find((y) => y.gatilho === 'criterio_profissional');
    expect(x).toBeDefined();
    expect(x?.chave).toBe('assimetria_flexao_joelho');
    expect(x?.titulo).toBe('Critério do profissional: diferença entre os lados ≤ 5°');
    expect(x?.situacao).toBe('fora_do_criterio');
    expect(x?.veredito).toEqual({ situacao: 'fora_do_criterio', criterio: c });
    expect(x?.valor as number).toBeGreaterThan(9);
    expect(x?.superaIncerteza).toBe(true);
    expect(x?.descricao).toMatch(/fora do critério/);
    expect(x?.descricao).toMatch(/Dra\. Teste/);
    // o achado do gatilho (a) continua sem referência: o veredito mora só no achado do critério
    const a1 = a.achados.find((y) => y.gatilho === 'assimetria_entre_lados' && y.chave === 'assimetria_flexao_joelho');
    expect(a1?.situacao).toBe('sem_referencia');
    expect(a1?.veredito).toBeUndefined();
  });

  it('o critério folgado dá "dentro do critério" e o que cai na incerteza dá "no limite"', () => {
    const folgado = { ...novoCriterio({ ...base, valor: 30, id: 'c2', rotulo: 'diferença ≤ 30°' }), ativo: true };
    const a = analisarMovimento('agachamento_lateral', trilha, { criterios: [folgado] });
    expect(a.achados.find((y) => y.gatilho === 'criterio_profissional')?.situacao).toBe('dentro_do_criterio');
    const diferenca = a.achados.find((y) => y.gatilho === 'assimetria_entre_lados' && y.chave === 'assimetria_flexao_joelho')?.valor as number;
    const noLimite = { ...novoCriterio({ ...base, valor: diferenca, id: 'c3', rotulo: 'diferença ≤ medida' }), ativo: true };
    const b = analisarMovimento('agachamento_lateral', trilha, { criterios: [noLimite] });
    expect(b.achados.find((y) => y.gatilho === 'criterio_profissional')?.situacao).toBe('no_limite');
  });

  it('critério em medida que o achado não usa, ou em achado de outro plano, é ignorado', () => {
    const errado = { ...novoCriterio({ ...base, id: 'c4', metrica: 'flexao_quadril_max' }), ativo: true };
    const outroPlano = { ...novoCriterio({ ...base, id: 'c5', chave: 'valgo_dinamico', metrica: 'valgo_joelho_max' }), ativo: true };
    const a = analisarMovimento('agachamento_lateral', trilha, { criterios: [errado, outroPlano] });
    expect(a.achados.filter((x) => x.gatilho === 'criterio_profissional')).toEqual([]);
  });

  it('critério sobre o avanço do joelho só vale se o profissional o definir e ativar, por lado', () => {
    const c = {
      ...novoCriterio({ id: 'c6', chave: 'avanco_joelho', metrica: 'avanco_joelho_fundo', lado: 'D', operador: '<=', valor: 0, unidade: '% do comprimento do pé', rotulo: 'avanço D ≤ 0%', definidoPor: 'Dr. Teste' }),
      ativo: true,
    };
    const a = analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ ruidoPx: 1, semente: 4 }), { criterios: [c] });
    const xs = a.achados.filter((x) => x.gatilho === 'criterio_profissional');
    expect(xs).toHaveLength(1);
    expect(xs[0].lado).toBe('D');
    expect(xs[0].chave).toBe('avanco_joelho');
    expect(xs[0].veredito?.criterio.definidoPor).toBe('Dr. Teste');
  });

  it('critério de tendência e de desvio-padrão usam a grandeza natural da chave', () => {
    const flexao = (_: 'D' | 'E', r: number) => 115 - 7.5 * r;
    const trilhaTend = trilhaAgachamentoLateral({ flexao, ruidoPx: 1, semente: 3 });
    const tend = { ...novoCriterio({ id: 'c7', chave: 'tendencia_na_serie', metrica: 'profundidade_quadril', operador: '>=', valor: -10, unidade: '% da coxa', rotulo: 'mudança ≥ −10%', definidoPor: 'X' }), ativo: true };
    const dp = { ...novoCriterio({ id: 'c8', chave: 'variacao_profundidade', metrica: 'profundidade_quadril', operador: '<=', valor: 2, unidade: '% da coxa', rotulo: 'desvio-padrão ≤ 2%', definidoPor: 'X' }), ativo: true };
    const a = analisarMovimento('agachamento_lateral', trilhaTend, { criterios: [tend, dp] });
    const t = a.achados.find((x) => x.gatilho === 'criterio_profissional' && x.chave === 'tendencia_na_serie');
    const v = a.achados.find((x) => x.gatilho === 'criterio_profissional' && x.chave === 'variacao_profundidade');
    expect(t?.valor as number).toBeLessThan(-30);
    expect(t?.situacao).toBe('fora_do_criterio');
    expect(v?.valor as number).toBeGreaterThan(10);
    expect(v?.situacao).toBe('fora_do_criterio');
  });
});

describe('texto e contrato dos achados', () => {
  const casos: [string, AnaliseMovimento][] = [
    ['lateral', analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ flexao: (l, r) => (l === 'D' ? 108 : 96) - 3 * r, ruidoPx: 1.2, semente: 17 }), {
      criterios: [{ ...novoCriterio({ id: 'k', chave: 'assimetria_flexao_joelho', metrica: 'flexao_joelho_max', operador: '<=', valor: 5, unidade: '°', rotulo: 'diferença ≤ 5°', definidoPor: 'Dra. A' }), ativo: true }],
      escalaCmPorPixel: 0.4,
    })],
    ['frontal', analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal({ medial: (l) => (l === 'D' ? 0.07 : 0.01), pelve: () => 0.05, ruidoPx: 1, semente: 3 }))],
    ['marcha', analisarMovimento('marcha_lateral', trilhaMarcha({ apoio: { D: 0.58, E: 0.7 }, ruidoPx: 1, semente: 2 }))],
  ];

  it.each(casos)('%s: ids únicos, posições válidas, gatilhos do catálogo e textos seguros para o PDF', (_, a) => {
    expect(a.achados.length).toBeGreaterThan(0);
    const ids = a.achados.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const x of a.achados) {
      expect(x.repeticoes.length, x.id).toBeGreaterThan(0);
      for (const i of x.repeticoes) {
        expect(Number.isInteger(i) && i >= 0 && i < a.repeticoes.length, `${x.id} posição ${i}`).toBe(true);
      }
      expect(x.planoCamera).toBe(a.planoFilmado);
      expect(x.limitacoes.length).toBeGreaterThan(0);
      expect(x.valor).not.toBeNull();
      expect(Number.isFinite(x.valor as number)).toBe(true);
      expect(x.unidade.length).toBeGreaterThan(0);
      expect(x.descricao.length).toBeGreaterThan(30);
      expect(x.id.startsWith(`${x.chave}:${x.medida}:${x.gatilho}`)).toBe(true);
      if (x.gatilho !== 'criterio_profissional') expect(x.situacao).toBe('sem_referencia');
    }
    const textos = [...a.avisos, ...a.achados.flatMap((x) => [x.titulo, x.descricao, ...x.limitacoes]), ...a.medidas.flatMap((m) => m.avisos), a.incerteza.formula, a.incerteza.descricao];
    for (const t of textos) {
      expect(termoProibido(t), t).toBeNull();
      expect(permitido.test(t), t).toBe(true);
    }
  });

  it('uma análise é determinística: a mesma trilha dá o mesmo resultado', () => {
    const t = trilhaAgachamentoLateral({ ruidoPx: 1.5, semente: 8, flexao: (l) => (l === 'D' ? 106 : 98) });
    expect(JSON.stringify(analisarMovimento('agachamento_lateral', t))).toBe(JSON.stringify(analisarMovimento('agachamento_lateral', t)));
  });

  it('a trilha recebida não é alterada', () => {
    const t = trilhaAgachamentoLateral({ ruidoPx: 1.5, semente: 8 });
    const antes = JSON.stringify(t);
    analisarMovimento('agachamento_lateral', t);
    analisarMovimento('agachamento_frontal', t);
    analisarMovimento('marcha_lateral', t);
    expect(JSON.stringify(t)).toBe(antes);
  });
});
