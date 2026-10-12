import { describe, expect, it } from 'vitest';
import { adicionarEvento, detectarEventosMarcha, eventosDo } from '../lib/angular/video/eventos';
import { configurar, eventosVerdade, poseSintetica, trilhaSintetica, type ConfigFigura, type GestoSintetico } from '../lib/angular/video/detectorFalso';
import {
  amplitudeDaSerie, analisarGesto, calcularMetricas, detectarAterrissagem, FORMULA_ASSIMETRIA, indiceAssimetria, razaoSimetria, type AnaliseGesto,
} from '../lib/angular/video/metricas';
import { MODELOS_GESTO } from '../lib/angular/video/modelos';
import type { ResultadoMetrica } from '../lib/angular/video/tipos';

const achar = (a: AnaliseGesto | ResultadoMetrica[], id: string): ResultadoMetrica => {
  const lista = Array.isArray(a) ? a : a.metricas;
  const r = lista.find((m) => m.id === id);
  if (!r) throw new Error(`métrica ${id} não encontrada`);
  return r;
};
const v = (a: AnaliseGesto, id: string): number => {
  const r = achar(a, id);
  if (r.valor === null) throw new Error(`métrica ${id} sem valor: ${r.avisos.join(' ')}`);
  return r.valor;
};

/** Menor e maior valor de uma grandeza conhecida da figura sintética num trecho, amostrando fino. */
const faixaVerdade = (cfg: ConfigFigura, chave: string, de: number, ate: number, passo = 0.002) => {
  let min = Infinity, max = -Infinity;
  for (let t = de; t <= ate; t += passo) {
    const x = poseSintetica(cfg, t).verdade[chave];
    min = Math.min(min, x); max = Math.max(max, x);
  }
  return { min, max };
};

describe('índices de simetria', () => {
  it('índice de assimetria: |D − E| ÷ ((D + E) ÷ 2) × 100', () => {
    expect(indiceAssimetria(10, 12)).toBeCloseTo((2 / 11) * 100, 9);
    expect(indiceAssimetria(12, 10)).toBeCloseTo((2 / 11) * 100, 9);
    expect(indiceAssimetria(5, 5)).toBe(0);
    expect(indiceAssimetria(0.6, 0.4)).toBeCloseTo(40, 9);
  });

  it('razão de simetria: menor ÷ maior × 100', () => {
    expect(razaoSimetria(10, 12)).toBeCloseTo((10 / 12) * 100, 9);
    expect(razaoSimetria(12, 10)).toBeCloseTo((10 / 12) * 100, 9);
    expect(razaoSimetria(7, 7)).toBe(100);
  });

  it('entradas inválidas, nulas ou de média não positiva dão null', () => {
    expect(indiceAssimetria(null, 3)).toBeNull();
    expect(indiceAssimetria(3, undefined)).toBeNull();
    expect(indiceAssimetria(Number.NaN, 3)).toBeNull();
    expect(indiceAssimetria(0, 0)).toBeNull();
    expect(indiceAssimetria(-3, 1)).toBeNull();
    expect(razaoSimetria(0, 3)).toBeNull();
    expect(razaoSimetria(null, 3)).toBeNull();
    expect(FORMULA_ASSIMETRIA).toContain('|D − E|');
  });
});

describe('amplitude articular (mínimo, máximo e ADM)', () => {
  it('amplitudeDaSerie dá mínimo, máximo, amplitude e o instante de cada extremo, ignorando lacunas', () => {
    const r = amplitudeDaSerie([{ t: 0, graus: 10 }, { t: 0.1, graus: null }, { t: 0.2, graus: -5 }, { t: 0.3, graus: 42 }, { t: 0.4, graus: 7 }]);
    expect(r).toEqual({ min: -5, max: 42, adm: 47, tMin: 0.2, tMax: 0.3, n: 4 });
    expect(amplitudeDaSerie([])).toBeNull();
    expect(amplitudeDaSerie([{ t: 0, graus: null }, { t: 1, graus: Number.NaN }])).toBeNull();
  });

  it('a análise traz a amplitude de cada articulação do modelo, e a do joelho bate com a curva conhecida', () => {
    const cfg = configurar('agachamento');
    const a = analisarGesto('agachamento', trilhaSintetica(cfg, 15, 9));
    expect(Object.keys(a.amplitudes).sort()).toEqual(Object.keys(a.series).sort());
    expect(a.amplitudes.joelho_d.min).toBeCloseTo(0, 0);
    expect(a.amplitudes.joelho_d.max).toBeCloseTo(105, 0);
    expect(a.amplitudes.joelho_d.adm).toBeCloseTo(105, 0);
    expect(a.amplitudes.tornozelo_d.max).toBeCloseTo(25, 0);
    // o fundo do primeiro agachamento está em 1,5 s (meio período), e o máximo cai num dos três fundos
    expect([1.5, 4.5, 7.5].some((t) => Math.abs(a.amplitudes.joelho_d.tMax - t) < 0.1)).toBe(true);
  });
});

describe('marcha: métricas com valores conhecidos', () => {
  const cfg = configurar('marcha');
  const trilha = trilhaSintetica(cfg, 30, 12);
  const a = analisarGesto('marcha', trilha);

  it('cadência e tempos do ciclo', () => {
    expect(v(a, 'cadencia')).toBeCloseTo(120 / 1.1, 0);
    expect(v(a, 'tempo_passada_d')).toBeCloseTo(1.1, 2);
    expect(v(a, 'tempo_passada_e')).toBeCloseTo(1.1, 2);
    expect(v(a, 'tempo_passo_d')).toBeCloseTo(0.55, 2);
    expect(v(a, 'tempo_passo_e')).toBeCloseTo(0.55, 2);
    expect(achar(a, 'tempo_passada_d').n).toBeGreaterThanOrEqual(8);
    expect(achar(a, 'tempo_passada_d').incerteza).toBeCloseTo(1 / 30, 9);
  });

  it('apoio e balanço batem com os eventos conhecidos (saída = ponta do pé mais atrás) e somam 100% do ciclo', () => {
    const ev = eventosVerdade(cfg, 12);
    const apoios = ev.contato.D.map((c) => ev.saida.D.find((s) => s > c) as number - c).filter((x) => x > 0 && x < 1.1);
    const esperado = apoios.reduce((s, x) => s + x, 0) / apoios.length;
    expect(v(a, 'tempo_apoio_d')).toBeCloseTo(esperado, 1);
    expect(v(a, 'apoio_pct_d') + v(a, 'balanco_pct_d')).toBeCloseTo(100, 6);
    expect(v(a, 'tempo_apoio_d') + v(a, 'tempo_balanco_d')).toBeCloseTo(v(a, 'tempo_passada_d'), 6);
  });

  it('amplitudes e pico de flexão do joelho no balanço batem com a curva conhecida', () => {
    const joelho = faixaVerdade(cfg, 'joelho_d', 1, 2.1);
    const quadril = faixaVerdade(cfg, 'quadril_d', 1, 2.1);
    const tornozelo = faixaVerdade(cfg, 'tornozelo_d', 1, 2.1);
    expect(v(a, 'adm_joelho_d')).toBeCloseTo(joelho.max - joelho.min, 0);
    expect(Math.abs(v(a, 'adm_quadril_d') - (quadril.max - quadril.min))).toBeLessThan(1.5);
    expect(Math.abs(v(a, 'adm_tornozelo_d') - (tornozelo.max - tornozelo.min))).toBeLessThan(1.5);
    expect(Math.abs(v(a, 'flexao_joelho_pico_balanco_d') - joelho.max)).toBeLessThan(1);
    expect(v(a, 'inclinacao_tronco')).toBeCloseTo(5, 1);
  });

  it('a marcha simétrica dá assimetria perto de zero e avisa que está dentro do erro de um quadro', () => {
    for (const id of ['assimetria_tempo_passo', 'assimetria_tempo_apoio', 'assimetria_adm_joelho']) expect(v(a, id)).toBeLessThan(1);
    const r = achar(a, 'assimetria_tempo_passo');
    expect(r.formula).toBe(FORMULA_ASSIMETRIA);
    expect(r.incerteza).toBeCloseTo(100 / (30 * 0.55), 1);
    expect(r.avisos.join(' ')).toContain('erro de um quadro');
    expect(r.detalhe).toContain('D = 0,6');
  });

  it('assimetria de 20% no tempo do passo (atraso do pé E de 5% da passada) é medida e identifica o lado maior', () => {
    const c = configurar('marcha', { atrasoE: 0.05 });
    const r = analisarGesto('marcha', trilhaSintetica(c, 30, 14));
    // passos: D→E = 0,605 s e E→D = 0,495 s → IS = 0,11 ÷ 0,55 × 100 = 20%
    expect(v(r, 'tempo_passo_d')).toBeCloseTo(0.605, 2);
    expect(v(r, 'tempo_passo_e')).toBeCloseTo(0.495, 2);
    expect(v(r, 'assimetria_tempo_passo')).toBeCloseTo(20, 0);
    expect(achar(r, 'assimetria_tempo_passo').detalhe).toContain('maior no lado direito');
    expect(achar(r, 'assimetria_tempo_passo').avisos).toEqual([]);
    expect(v(r, 'tempo_passada_d')).toBeCloseTo(1.1, 2);
  });

  it('sem escala as medidas em cm ficam sem valor e dizem o que falta', () => {
    for (const id of ['comprimento_passo_d', 'comprimento_passo_e', 'comprimento_passada', 'velocidade_marcha']) {
      const r = achar(a, id);
      expect(r.valor).toBeNull();
      expect(r.avisos.join(' ')).toContain('escala');
    }
  });

  it('com a escala, comprimento do passo, da passada e velocidade batem com a geometria conhecida', () => {
    const cmPorPx = (100 * cfg.metrosNaAltura) / cfg.altura;
    const r = analisarGesto('marcha', trilha, { escalaCmPorPx: cmPorPx });
    const ev = eventosVerdade(cfg, 12);
    const passo = (lado: 'D' | 'E') => {
      const outro = lado === 'D' ? 'e' : 'd';
      const seps = ev.contato[lado].filter((t) => t > 1 && t < 11).map((t) => {
        const m = poseSintetica(cfg, t).mundo;
        return Math.abs(m[`calcanhar_${lado.toLowerCase()}`].x - m[`calcanhar_${outro}`].x) * 100;
      });
      return seps.reduce((s, x) => s + x, 0) / seps.length;
    };
    expect(Math.abs(v(r, 'comprimento_passo_d') - passo('D'))).toBeLessThan(4);
    expect(Math.abs(v(r, 'comprimento_passo_e') - passo('E'))).toBeLessThan(4);
    expect(v(r, 'comprimento_passada')).toBeCloseTo(v(r, 'comprimento_passo_d') + v(r, 'comprimento_passo_e'), 6);
    expect(v(r, 'velocidade_marcha')).toBeCloseTo(v(r, 'comprimento_passada') / 1.1, 0);
    expect(achar(r, 'velocidade_marcha').avisos).toEqual([]);
  });

  it('o resultado é o mesmo com o paciente virado para a esquerda e com câmera fixa', () => {
    const base = calcularMetricas('marcha', trilha);
    for (const mud of [{ direcao: -1 as const }, { cameraFixa: true, largura: 3000 }]) {
      const outra = calcularMetricas('marcha', trilhaSintetica(configurar('marcha', mud), 30, 12));
      for (const id of ['cadencia', 'tempo_passada_d', 'adm_joelho_d', 'adm_quadril_e', 'inclinacao_tronco', 'flexao_joelho_pico_balanco_e']) {
        expect(achar(outra, id).valor as number).toBeCloseTo(achar(base, id).valor as number, 0);
      }
    }
  });

  it('com ruído de 1,5 px e perda de quadros continua perto do valor certo', () => {
    const r = analisarGesto('marcha', trilhaSintetica(cfg, 30, 12, { ruidoPx: 1.5, semente: 9, ausentes: (t) => t > 5 && t < 5.2 }));
    expect(Math.abs(v(r, 'cadencia') - 120 / 1.1)).toBeLessThan(2);
    expect(Math.abs(v(r, 'adm_joelho_d') - v(a, 'adm_joelho_d'))).toBeLessThan(5);
    expect(Math.abs(v(r, 'tempo_passada_e') - 1.1)).toBeLessThan(0.05);
  });

  it('eventos editados pelo profissional substituem os automáticos', () => {
    const sem = analisarGesto('marcha', trilha, { eventos: [] });
    expect(achar(sem, 'cadencia').valor).toBeNull();
    expect(sem.avisos.join(' ')).toContain('contatos do pé');
    expect(sem.eventos).toEqual([]);
    const auto = detectarEventosMarcha(trilha);
    const alvo = eventosDo(auto, 'D', 'contato')[2];
    const deslocado = auto.filter((e) => e.id !== alvo.id);
    const editados = adicionarEvento(deslocado, trilha, 'D', 'contato', alvo.i + 4);
    const r = analisarGesto('marcha', trilha, { eventos: editados });
    // mover um contato 4 quadros (133 ms) alonga uma passada e encurta a seguinte: a média fica, a dispersão aparece
    expect(achar(r, 'tempo_passada_d').dp as number).toBeGreaterThan(0.05);
    expect(achar(a, 'tempo_passada_d').dp as number).toBeLessThan(0.01);
    expect(r.eventos).toBe(editados);
  });

  it('avisa quando o corpo foi detectado em poucos quadros', () => {
    const ruim = analisarGesto('marcha', trilhaSintetica(cfg, 30, 12, { ausentes: (t) => (t * 10) % 10 < 5 }));
    expect(ruim.avisos.join(' ')).toContain('detectado de forma confiável');
  });

  it('as séries suavizadas acompanham o ângulo conhecido', () => {
    const joelho = a.series.joelho_d;
    expect(joelho).toHaveLength(trilha.quadros.length);
    let maior = 0;
    joelho.forEach((s) => { maior = Math.max(maior, Math.abs((s.graus as number) - poseSintetica(cfg, s.t).verdade.joelho_d)); });
    expect(maior).toBeLessThan(3);
    expect(a.direcao).toBe(1);
  });
});

describe('corrida: métricas com valores conhecidos', () => {
  const cfg = configurar('corrida');
  const trilha = trilhaSintetica(cfg, 60, 8);
  const a = analisarGesto('corrida', trilha);

  it('cadência, tempo da passada, contato e voo', () => {
    expect(v(a, 'cadencia')).toBeCloseTo(120 / 0.7, 0);
    expect(v(a, 'tempo_passada_d')).toBeCloseTo(0.7, 2);
    expect(Math.abs(v(a, 'tempo_contato_d') - 220)).toBeLessThan(15);
    expect(Math.abs(v(a, 'tempo_contato_e') - 220)).toBeLessThan(15);
    expect(Math.abs(v(a, 'tempo_voo') - 130)).toBeLessThan(15);
    expect(achar(a, 'tempo_contato_d').incerteza).toBeCloseTo(1000 / 60, 6);
    expect(a.avisos.join(' ')).toContain('120 Hz');
  });

  it('tempo de contato 220 ms contra 260 ms dá 16,7% de assimetria, acima do erro de um quadro', () => {
    const c = configurar('corrida', { tempoContato: { D: 0.22, E: 0.26 } });
    const r = analisarGesto('corrida', trilhaSintetica(c, 60, 8));
    expect(Math.abs(v(r, 'assimetria_tempo_contato') - (40 / 240) * 100)).toBeLessThan(5);
    expect(achar(r, 'assimetria_tempo_contato').detalhe).toContain('maior no lado esquerdo');
    expect(v(r, 'assimetria_tempo_contato')).toBeGreaterThan(achar(r, 'assimetria_tempo_contato').incerteza as number);
  });

  it('abaixo de 120 quadros/s avisa o tamanho do quadro em ms; a 120 não há aviso de taxa', () => {
    expect(analisarGesto('corrida', trilhaSintetica(cfg, 120, 4)).avisos.join(' ')).not.toContain('120 Hz');
    expect(analisarGesto('corrida', trilhaSintetica(cfg, 30, 8)).avisos.join(' ')).toContain('33 ms');
    expect(a.avisos.join(' ')).toContain('17 ms');
    expect(analisarGesto('marcha', trilhaSintetica(configurar('marcha'), 30, 8)).avisos.join(' ')).not.toContain('Hz');
  });

  it('flexão do joelho, tíbia e tronco no contato batem com a figura no instante do contato', () => {
    const verd = (chave: string) => {
      const ev = eventosVerdade(cfg, 8).contato.D.filter((t) => t > 0.8 && t < 7);
      return ev.reduce((s, t) => s + poseSintetica(cfg, t).verdade[chave], 0) / ev.length;
    };
    // o ângulo muda depressa perto do contato: o erro cabe na incerteza que o próprio resultado informa (variação por quadro)
    for (const [id, chave] of [['flexao_joelho_contato_d', 'joelho_d'], ['angulo_tibia_contato_d', 'tibia_d']] as const) {
      const incerteza = achar(a, id).incerteza as number;
      expect(incerteza, id).toBeGreaterThan(0);
      expect(Math.abs(v(a, id) - verd(chave)), id).toBeLessThanOrEqual(Math.max(2 * incerteza, 3));
    }
    expect(v(a, 'inclinacao_tronco_contato')).toBeCloseTo(8, 0);
    const apoio = faixaVerdade(cfg, 'joelho_d', 1.4, 1.62);
    expect(Math.abs(v(a, 'flexao_joelho_pico_apoio_d') - apoio.max)).toBeLessThan(3);
    // a suavização aplaina um pouco o pico rápido do balanço: a amplitude nunca passa da verdadeira e fica perto dela
    const passada = faixaVerdade(cfg, 'joelho_d', 1.4, 2.1);
    expect(v(a, 'adm_joelho_d')).toBeLessThanOrEqual(passada.max - passada.min + 0.5);
    expect(v(a, 'adm_joelho_d')).toBeGreaterThan(passada.max - passada.min - 8);
  });

  it('comprimento da passada e velocidade só valem com câmera fixa e escala', () => {
    const cmPorPx = (100 * cfg.metrosNaAltura) / cfg.altura;
    const fixa = configurar('corrida', { cameraFixa: true, largura: 9000 });
    const tf = trilhaSintetica(fixa, 60, 8);
    const r = analisarGesto('corrida', tf, { escalaCmPorPx: cmPorPx, cameraFixa: true });
    expect(Math.abs(v(r, 'comprimento_passada') - 210)).toBeLessThan(6);
    expect(Math.abs(v(r, 'velocidade_corrida') - 300)).toBeLessThan(9);
    const semCamera = analisarGesto('corrida', tf, { escalaCmPorPx: cmPorPx });
    expect(achar(semCamera, 'comprimento_passada').valor).toBeNull();
    expect(achar(semCamera, 'comprimento_passada').avisos.join(' ')).toContain('câmera parada');
    expect(achar(a, 'comprimento_passada').avisos.join(' ')).toContain('escala');
    expect(achar(a, 'velocidade_corrida').valor).toBeNull();
  });
});

describe('agachamento', () => {
  const cfg = configurar('agachamento');
  const a = analisarGesto('agachamento', trilhaSintetica(cfg, 15, 9));

  it('conta as repetições e mede o tempo de cada uma', () => {
    expect(v(a, 'repeticoes')).toBe(3);
    expect(a.repeticoes).toHaveLength(3);
    expect(v(a, 'tempo_repeticao')).toBeCloseTo(3, 1);
    expect(a.repeticoes.map((i) => i / 15)).toEqual(expect.arrayContaining([expect.closeTo(1.5, 0)]));
  });

  it('flexão de joelho e quadril, dorsiflexão, tronco e profundidade no fundo batem com os ângulos conhecidos', () => {
    const fundo = poseSintetica(cfg, 1.5).verdade;
    for (const l of ['d', 'e']) {
      expect(Math.abs(v(a, `flexao_joelho_max_${l}`) - fundo[`joelho_${l}`])).toBeLessThan(1.5);
      expect(Math.abs(v(a, `flexao_quadril_max_${l}`) - fundo[`quadril_${l}`])).toBeLessThan(1.5);
      expect(Math.abs(v(a, `dorsiflexao_max_${l}`) - fundo[`tornozelo_${l}`])).toBeLessThan(1.5);
    }
    expect(Math.abs(v(a, 'inclinacao_tronco_max') - fundo.tronco)).toBeLessThan(1.5);
    // coxa a (105 − 25) = 80° da vertical: o quadril fica acima do joelho por cos(80°) = 17,4% da coxa
    expect(v(a, 'profundidade_quadril')).toBeCloseTo(-Math.cos((80 * Math.PI) / 180) * 100, 0);
    expect(v(a, 'adm_joelho_d')).toBeCloseTo(105, 0);
  });

  it('agachamento mais fundo dá profundidade positiva (quadril abaixo do joelho)', () => {
    const fundo = analisarGesto('agachamento', trilhaSintetica(configurar('agachamento', { flexaoMax: 130, dorsiflexaoMax: 25 }), 15, 9));
    expect(v(fundo, 'profundidade_quadril')).toBeCloseTo(-Math.cos((105 * Math.PI) / 180) * 100, 0);
    expect(v(fundo, 'profundidade_quadril')).toBeGreaterThan(0);
  });

  it('sem repetições (pessoa parada) conta zero e diz isso', () => {
    const parado = analisarGesto('agachamento', trilhaSintetica(configurar('agachamento', { periodo: 1e9 }), 15, 5));
    expect(v(parado, 'repeticoes')).toBe(0);
    expect(achar(parado, 'tempo_repeticao').valor).toBeNull();
    expect(parado.avisos.join(' ')).toContain('repetições');
  });
});

describe('aterrissagem de salto (valgo dinâmico)', () => {
  const cfg = configurar('salto');
  const trilha = trilhaSintetica(cfg, 60, 2.6);
  const a = analisarGesto('salto', trilha);

  it('acha o quadro do contato da aterrissagem', () => {
    const verdade = (cfg.inicioSalto + cfg.voo) * 60;
    expect(Math.abs((detectarAterrissagem(trilha) as number) - verdade)).toBeLessThanOrEqual(3);
    expect(a.aterrissagem).toBe(detectarAterrissagem(trilha));
  });

  it('o desvio do joelho e a razão joelho/tornozelo batem com a geometria conhecida', () => {
    const t0 = cfg.inicioSalto + cfg.voo;
    const d = faixaVerdade(cfg, 'valgo_d', t0, t0 + 0.5);
    const e = faixaVerdade(cfg, 'valgo_e', t0, t0 + 0.5);
    expect(Math.abs(v(a, 'valgo_max_d') - d.max)).toBeLessThan(0.7);
    expect(Math.abs(v(a, 'valgo_max_e') - e.max)).toBeLessThan(0.7);
    expect(v(a, 'valgo_max_d')).toBeGreaterThan(v(a, 'valgo_max_e'));
    expect(v(a, 'valgo_contato_d')).toBeLessThan(2);
    const kasr = faixaVerdade(cfg, 'kasr', t0, t0 + 0.5);
    expect(Math.abs(v(a, 'kasr_min') - kasr.min)).toBeLessThan(0.03);
    expect(v(a, 'kasr_contato')).toBeGreaterThan(v(a, 'kasr_min'));
    expect(a.razoes.kasr).toHaveLength(trilha.quadros.length);
  });

  it('sem valgo a razão fica perto do que a separação dos pés dá e o desvio perto de zero', () => {
    const reto = analisarGesto('salto', trilhaSintetica(configurar('salto', { valgoMax: { D: 0, E: 0 } }), 60, 2.6));
    expect(Math.abs(v(reto, 'valgo_max_d'))).toBeLessThan(0.5);
    expect(v(reto, 'kasr_min')).toBeCloseTo(0.25 / 0.3, 1);
  });

  it('sem salto na gravação as medidas ficam sem valor e o aviso explica', () => {
    const parado = analisarGesto('salto', trilhaSintetica(configurar('salto', { inicioSalto: 99 }), 60, 2));
    expect(parado.aterrissagem).toBeNull();
    expect(achar(parado, 'valgo_max_d').valor).toBeNull();
    expect(achar(parado, 'kasr_min').valor).toBeNull();
    expect(parado.avisos.join(' ')).toContain('aterrissagem');
  });

  it('espelhar a imagem não muda o valgo (projeção 2D, positivo = joelho para dentro)', () => {
    const esp = analisarGesto('salto', trilhaSintetica(configurar('salto', { direcao: -1 }), 60, 2.6));
    expect(v(esp, 'valgo_max_d')).toBeCloseTo(v(a, 'valgo_max_d'), 1);
    expect(v(esp, 'kasr_min')).toBeCloseTo(v(a, 'kasr_min'), 2);
  });
});

describe('elevação do braço / ombro', () => {
  const cfg = configurar('ombro');
  const a = analisarGesto('ombro', trilhaSintetica(cfg, 15, 9));

  it('elevação máxima de cada lado, em relação ao tronco, e assimetria', () => {
    expect(Math.abs(v(a, 'elevacao_max_d') - 160)).toBeLessThan(1.5);
    expect(Math.abs(v(a, 'elevacao_max_e') - 140)).toBeLessThan(1.5);
    // o tronco inclinado 6° para a direita da imagem soma 6° à elevação do lado E e tira 6° do lado D (em relação ao tronco)
    expect(Math.abs(v(a, 'elevacao_tronco_max_d') - 154)).toBeLessThan(1.5);
    expect(Math.abs(v(a, 'elevacao_tronco_max_e') - 146)).toBeLessThan(1.5);
    expect(Math.abs(v(a, 'assimetria_elevacao') - (20 / 150) * 100)).toBeLessThan(1.2);
    expect(achar(a, 'assimetria_elevacao').detalhe).toContain('maior no lado direito');
  });

  it('compensação do tronco e tempo até o pico', () => {
    expect(Math.abs(v(a, 'compensacao_tronco') - 6)).toBeLessThan(0.6);
    expect(Math.abs(v(a, 'tempo_ate_pico') - 1.5)).toBeLessThan(0.15);
    expect(a.repeticoes).toHaveLength(3);
  });

  it('braços iguais e tronco parado dão assimetria e compensação zero', () => {
    const r = analisarGesto('ombro', trilhaSintetica(configurar('ombro', { elevacaoMax: { D: 150, E: 150 }, compensacao: 0 }), 15, 9));
    expect(v(r, 'assimetria_elevacao')).toBeLessThan(0.5);
    expect(Math.abs(v(r, 'compensacao_tronco'))).toBeLessThan(0.3);
    expect(Math.abs(v(r, 'elevacao_tronco_max_d') - v(r, 'elevacao_tronco_max_e'))).toBeLessThan(0.5);
  });
});

describe('modelos de gesto e métricas declaradas', () => {
  const casos: { gesto: GestoSintetico; fps: number; dur: number; ctx?: object }[] = [
    { gesto: 'marcha', fps: 30, dur: 8 }, { gesto: 'corrida', fps: 60, dur: 6 }, { gesto: 'agachamento', fps: 15, dur: 9 },
    { gesto: 'salto', fps: 60, dur: 2.6 }, { gesto: 'ombro', fps: 15, dur: 9 },
  ];
  for (const c of casos) {
    it(`${c.gesto}: o modelo declara exatamente as métricas que a análise calcula`, () => {
      const modelo = MODELOS_GESTO.find((m) => m.id === c.gesto)!;
      const r = analisarGesto(modelo, trilhaSintetica(configurar(c.gesto), c.fps, c.dur));
      const calculadas = new Set(r.metricas.map((m) => m.metrica));
      const declaradas = new Set(modelo.metricas.map((m) => m.metrica));
      expect([...calculadas].sort()).toEqual([...declaradas].sort());
      for (const d of modelo.metricas) {
        const doLado = r.metricas.filter((m) => m.metrica === d.metrica);
        expect(doLado.length, d.metrica).toBe(d.porLado ? 2 : 1);
        for (const m of doLado) expect(m.unidade, m.id).toBe(d.unidade);
      }
      expect(new Set(r.metricas.map((m) => m.id)).size).toBe(r.metricas.length);
      expect(r.metricas.every((m) => Array.isArray(m.avisos))).toBe(true);
    });
  }

  it('toda métrica em cm exige escala; as da corrida em cm exigem também câmera fixa', () => {
    for (const m of MODELOS_GESTO) for (const d of m.metricas) if (d.unidade === 'cm' || d.unidade === 'cm/s') expect(d.requerEscala, `${m.id}/${d.metrica}`).toBe(true);
    const corrida = MODELOS_GESTO.find((m) => m.id === 'corrida')!;
    expect(corrida.metricas.filter((d) => d.requerEscala).every((d) => d.requerCameraFixa)).toBe(true);
  });

  it('cada modelo traz vista, orientações de gravação e avisos', () => {
    for (const m of MODELOS_GESTO) {
      expect(['lateral', 'frontal']).toContain(m.vista);
      expect(m.gravacao.length).toBeGreaterThan(0);
      expect(m.avisos.length).toBeGreaterThan(0);
      expect(m.fpsSugerido).toBeGreaterThanOrEqual(15);
    }
    expect(MODELOS_GESTO.map((m) => m.id)).toEqual(['marcha', 'corrida', 'agachamento', 'salto', 'ombro']);
  });
});
