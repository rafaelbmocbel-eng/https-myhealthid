import { describe, expect, it } from 'vitest';
import { analisarMovimento } from '../lib/angular/movimento/analisarMovimento';
import type { AnaliseMovimento, ChaveAchado, TipoGatilho } from '../lib/angular/movimento/tipos';
import { eventosVerdadeMarcha, trilhaAgachamentoFrontal, trilhaAgachamentoLateral, trilhaMarcha } from './movimentoMotorSintetico';

/*
 * Taxas de acerto do motor sobre execuções sintéticas com semente variada (ruído gaussiano de 1,5 px em cada coordenada, em imagem de
 * 480 px de altura). As sementes são fixas, então o teste é determinístico; os limites são folgados em relação ao que foi medido com 100
 * sementes (ver o resumo do agente M) e existem para pegar regressões, não para fixar um número.
 */

const SEMENTES = Array.from({ length: 30 }, (_, i) => i + 1);
const RUIDO = 1.5;

const taxa = (fn: (semente: number) => boolean): number => SEMENTES.filter(fn).length / SEMENTES.length;
const tem = (a: AnaliseMovimento, chave: ChaveAchado, lado?: 'D' | 'E', gatilho: TipoGatilho = 'assimetria_entre_lados'): boolean =>
  a.achados.some((x) => x.chave === chave && x.gatilho === gatilho && (lado === undefined || x.lado === lado));
const lateral = (semente: number, c: Parameters<typeof trilhaAgachamentoLateral>[0] = {}) => analisarMovimento('agachamento_lateral', trilhaAgachamentoLateral({ ruidoPx: RUIDO, semente, ...c }));
const frontal = (semente: number, c: Parameters<typeof trilhaAgachamentoFrontal>[0] = {}) => analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal({ ruidoPx: RUIDO, semente, ...c }));

describe('agachamento de lado: taxas com ruído', () => {
  it('diferença de 8° na flexão do joelho: acha em quase toda execução, apontando o lado certo', () => {
    expect(taxa((s) => tem(lateral(s, { flexao: (l) => (l === 'D' ? 108 : 100) }), 'assimetria_flexao_joelho', 'D'))).toBeGreaterThanOrEqual(0.95);
    expect(taxa((s) => tem(lateral(s, { flexao: (l) => (l === 'E' ? 108 : 100) }), 'assimetria_flexao_joelho', 'E'))).toBeGreaterThanOrEqual(0.95);
  });

  it('diferença de 10° na dorsiflexão: acha na maioria das execuções', () => {
    expect(taxa((s) => tem(lateral(s, { dorsiflexao: (l) => (l === 'D' ? 30 : 20) }), 'assimetria_dorsiflexao', 'D'))).toBeGreaterThanOrEqual(0.9);
  });

  it('vídeo simétrico: nenhuma execução gera achado de assimetria', () => {
    expect(taxa((s) => lateral(s).achados.some((x) => x.gatilho === 'assimetria_entre_lados'))).toBe(0);
  });

  it('profundidade caindo 15° de flexão da primeira à última repetição: acha a tendência com o sinal certo', () => {
    const flexao = (_l: 'D' | 'E', r: number) => 110 - (15 * r) / 4;
    expect(taxa((s) => lateral(s, { flexao }).achados.some((x) => x.chave === 'tendencia_na_serie' && x.medida === 'profundidade_quadril' && (x.valor as number) < 0))).toBeGreaterThanOrEqual(0.95);
    expect(taxa((s) => lateral(s, { flexao }).achados.some((x) => x.chave === 'tendencia_na_serie' && x.medida === 'flexao_joelho_max' && x.lado === 'D' && (x.valor as number) < 0))).toBeGreaterThanOrEqual(0.9);
  });

  it('repetições idênticas: a tendência e a variação quase não aparecem só por causa do ruído', () => {
    const tendenciaDeAngulo = taxa((s) => lateral(s).achados.some((x) => x.chave === 'tendencia_na_serie' && /flexao|dorsiflexao/.test(x.medida)));
    expect(tendenciaDeAngulo).toBeLessThanOrEqual(0.15);
    expect(taxa((s) => lateral(s).achados.some((x) => x.gatilho === 'variacao_entre_repeticoes'))).toBeLessThanOrEqual(0.15);
  });
});

describe('agachamento de frente: taxas com ruído', () => {
  it('valgo maior de um lado (joelho 6 cm para dentro contra 2 cm): acha e aponta o lado', () => {
    expect(taxa((s) => tem(frontal(s, { medial: (l) => (l === 'D' ? 0.06 : 0.02) }), 'valgo_dinamico', 'D'))).toBeGreaterThanOrEqual(0.9);
  });

  it('pelve deslocada 4 cm (13% da base) para o lado direito: acha e aponta o lado, de frente e de costas', () => {
    expect(taxa((s) => tem(frontal(s, { pelve: () => 0.04 }), 'desvio_lateral_pelve', 'D'))).toBeGreaterThanOrEqual(0.95);
    expect(taxa((s) => tem(frontal(s, { pelve: () => 0.04, deCostas: true }), 'desvio_lateral_pelve', 'D'))).toBeGreaterThanOrEqual(0.95);
    expect(taxa((s) => tem(frontal(s, { pelve: () => -0.04 }), 'desvio_lateral_pelve', 'E'))).toBeGreaterThanOrEqual(0.95);
  });

  it('vídeo simétrico e centrado: nenhuma execução gera achado de assimetria', () => {
    expect(taxa((s) => frontal(s).achados.some((x) => x.gatilho === 'assimetria_entre_lados'))).toBe(0);
  });
});

describe('marcha: taxas com ruído', () => {
  it('apoio do pé esquerdo 0,13 s mais longo: acha com os eventos automáticos e com os conferidos', () => {
    const apoio = { D: 0.58, E: 0.7 };
    expect(taxa((s) => tem(analisarMovimento('marcha_lateral', trilhaMarcha({ ruidoPx: RUIDO, semente: s, apoio })), 'assimetria_tempo_apoio', 'E'))).toBeGreaterThanOrEqual(0.95);
    const eventos = eventosVerdadeMarcha({ apoio }).eventos;
    expect(taxa((s) => tem(analisarMovimento('marcha_lateral', trilhaMarcha({ ruidoPx: RUIDO, semente: s, apoio }), { eventos }), 'assimetria_tempo_apoio', 'E'))).toBeGreaterThanOrEqual(0.95);
  });

  it('marcha simétrica: nenhuma execução gera achado de assimetria', () => {
    expect(taxa((s) => analisarMovimento('marcha_lateral', trilhaMarcha({ ruidoPx: RUIDO, semente: s })).achados.some((x) => x.gatilho === 'assimetria_entre_lados'))).toBe(0);
  });
});
