import { describe, it, expect } from 'vitest';
import { MyIDCalculator } from '@/utils/myid/calculator';
import { analisarPerdas, contaSinaisDeAlerta } from '@/utils/myid/prioridadePerdas';

// Perdas reais de um MyID com as perdas espalhadas por todas as dimensões (valores como gravados no resultado).
const PERDAS_ESPALHADAS = {
  D: 17.81, P: 15, R: 10.8, C: 7.9, ERG: 6.9, EFI: 6, AF: 5.7, I: 4, HID: 4, NUT: 2.5, N: 1.7,
};
const perdasCalculadas = (perdas: Record<string, number>) =>
  Object.fromEntries(Object.entries(perdas).map(([k, v]) => [k, { score_bruto: 5, perda_pontos: v }]));

const resultadoEspalhado = (extra: Record<string, unknown> = {}) => ({
  perdas_calculadas: perdasCalculadas(PERDAS_ESPALHADAS),
  myid_100: { total_perdas: 90.31, pontuacao_final: 9.69 },
  red_flags_details: { weight_loss: false, fever: false, night_pain: false, incontinence: false, progressive: true, neuropathy: true },
  ...extra,
});

describe('analisarPerdas — fecha a conta do MyID', () => {
  it('perdas espalhadas: dimensões 82,3 + sinais de alerta 6 + medicação 2 = 90,3 e a nota fecha em 9,7', () => {
    const a = analisarPerdas(resultadoEspalhado())!;
    expect(a.totalDimensoes).toBe(82.31);
    expect(a.sinaisDeAlerta).toEqual({ ativos: 2, pontos: 6 });
    expect(a.medicacaoEAjustes).toBe(2);
    expect(a.totalPerdas).toBe(90.31);
    expect(a.scoreFechado).toBe(9.69);
    expect(a.limitadoEmZero).toBe(false);
    expect(a.totalGravado).toBe(true);
    expect(a.totalDimensoes + (a.sinaisDeAlerta?.pontos ?? 0) + (a.medicacaoEAjustes ?? 0)).toBeCloseTo(a.totalPerdas, 5);
  });

  it('ordena da maior perda para a menor e mostra a concentração (as 3 maiores = 48%)', () => {
    const a = analisarPerdas(resultadoEspalhado())!;
    expect(a.itens.map((i) => i.chave)).toEqual(['D', 'P', 'R', 'C', 'ERG', 'EFI', 'AF', 'I', 'HID', 'NUT', 'N']);
    expect(a.itens[0].pctDoTotal).toBeCloseTo(19.72, 1);
    expect(a.itens[2].pctAcumulado).toBeCloseTo(48.29, 1);
    expect(a.itens[0].pctDoMaximo).toBeCloseTo(98.9, 1); // dor: 17,81 de 18 possíveis
    expect(a.itens[10].pctDoMaximo).toBeCloseTo(85, 0); // sinais do corpo: 1,7 de 2
  });

  it('teto aritmético das 3 maiores: a nota iria de 9,7 para 53,3 (não é meta)', () => {
    const a = analisarPerdas(resultadoEspalhado())!;
    expect(a.teto).toEqual({ chaves: ['D', 'P', 'R'], ganho: 43.61, score: 53.3 });
    expect(analisarPerdas(resultadoEspalhado(), 1)!.teto).toEqual({ chaves: ['D'], ganho: 17.81, score: 27.5 });
  });

  it('perdas acima de 100: a nota para em 0 e o excedente fica explícito', () => {
    const a = analisarPerdas({
      perdas_calculadas: perdasCalculadas({ D: 18, P: 16, R: 14, C: 11, AF: 10, EFI: 8, ERG: 8, NUT: 7, HID: 6, I: 5, N: 2 }),
      myid_100: { total_perdas: 106.4 },
      red_flags_details: { fever: true, night_pain: true },
    })!;
    expect(a.totalDimensoes).toBe(105);
    expect(a.sinaisDeAlerta).toEqual({ ativos: 2, pontos: 6 });
    expect(a.medicacaoEAjustes).toBe(-4.6); // as perdas gravadas são menores que a soma: o ajuste fecha a conta
    expect(a.scoreFechado).toBe(0);
    expect(a.limitadoEmZero).toBe(true);
    expect(a.teto!.score).toBeLessThanOrEqual(100);
  });

  it('o limite de 15 pontos dos sinais de alerta vale (6 sinais = 15, não 18)', () => {
    const a = analisarPerdas({
      perdas_calculadas: perdasCalculadas({ D: 10 }),
      myid_100: { total_perdas: 25 },
      red_flags_details: { weight_loss: true, fever: true, night_pain: true, incontinence: true, progressive: true, neuropathy: true },
    })!;
    expect(a.sinaisDeAlerta).toEqual({ ativos: 6, pontos: 15 });
    expect(a.medicacaoEAjustes).toBe(0);
  });

  it('sem o detalhe dos sinais de alerta: não inventa a divisão, mostra o que sobra junto', () => {
    const a = analisarPerdas({ perdas_calculadas: perdasCalculadas({ D: 10, P: 5 }), myid_100: { total_perdas: 20 } })!;
    expect(a.sinaisDeAlerta).toBeNull();
    expect(a.medicacaoEAjustes).toBeNull();
    expect(a.outrosSemDetalhe).toBe(5);
    expect(a.scoreFechado).toBe(80);
  });

  it('sem o total gravado: usa dimensões + sinais de alerta e avisa que o total não veio do resultado', () => {
    const a = analisarPerdas({ perdas_calculadas: perdasCalculadas({ D: 10, P: 5 }), red_flags_details: { fever: true } })!;
    expect(a.totalGravado).toBe(false);
    expect(a.totalPerdas).toBe(18);
    expect(a.scoreFechado).toBe(82);
  });

  it('bônus de medicação (valor negativo) também fecha', () => {
    const a = analisarPerdas({
      perdas_calculadas: perdasCalculadas({ D: 10, P: 5 }),
      myid_100: { total_perdas: 13 },
      red_flags_details: { fever: false },
    })!;
    expect(a.medicacaoEAjustes).toBe(-2);
  });

  it('dimensão sem perda não entra no ranking e MED não é dimensão', () => {
    const a = analisarPerdas({
      perdas_calculadas: { ...perdasCalculadas({ D: 10, P: 0 }), MED: { perda_pontos: 99 } },
      myid_100: { total_perdas: 10 },
      red_flags_details: { fever: false },
    })!;
    expect(a.itens.map((i) => i.chave)).toEqual(['D']);
    expect(a.totalDimensoes).toBe(10);
  });

  it('registros antigos e entradas estranhas devolvem null, sem quebrar', () => {
    expect(analisarPerdas(null)).toBeNull();
    expect(analisarPerdas(undefined)).toBeNull();
    expect(analisarPerdas('texto')).toBeNull();
    expect(analisarPerdas({})).toBeNull();
    expect(analisarPerdas({ perdas_calculadas: {} })).toBeNull();
    expect(analisarPerdas({ perdas_calculadas: 'x' })).toBeNull();
    expect(analisarPerdas({ perdas_calculadas: { D: { perda_pontos: 'abc' } } })).not.toBeNull();
  });

  it('contaSinaisDeAlerta só conta true e ignora formatos que não são o detalhe', () => {
    expect(contaSinaisDeAlerta({ fever: true, night_pain: false })).toBe(1);
    expect(contaSinaisDeAlerta({})).toBeNull();
    expect(contaSinaisDeAlerta(['texto livre'])).toBeNull();
    expect(contaSinaisDeAlerta(null)).toBeNull();
  });
});

// A conta da tela tem que bater com o cálculo oficial do MyID (o mesmo que grava o resultado).
describe('analisarPerdas — bate com o MyIDCalculator real', () => {
  const base = {
    bloco_2_pain_now: 7, bloco_2_pain_max: 9, bloco_2_temporal_pattern: 'constant',
    bloco_3_work: 8, bloco_3_home: 7, bloco_3_exercise: 8, bloco_3_independence: 6, bloco_3_social: 7,
    bloco_4_fear_movement: 8, bloco_4_avoidance: 7, bloco_4_belief_damage: 8, bloco_4_self_efficacy: 3, bloco_4_expectation: 3,
    bloco_5a_hours: 4, bloco_5a_quality: 2, bloco_5a_awake: 'always', bloco_5b_energy: 3, bloco_5b_fatigue: 8, bloco_5b_tired_awake: 'often',
    bloco_5c_stress: 8, bloco_5c_anxiety: 8, bloco_5c_control: 'little',
    bloco_5d_work_stress: 8, bloco_5d_family_conflict: 6, bloco_5d_financial_worry: 7,
    bloco_5e_sitting_hours: 10, bloco_5e_lifestyle: 'sedentary', bloco_5e_intensity: 'low',
    bloco_5f_water_liters: 1, bloco_5f_urine_color: 'dark',
    bloco_5h_workspace: 'poor', bloco_5h_sitting_continuous: 4,
  };
  const casos: Array<[string, Record<string, unknown>]> = [
    ['sem sinais de alerta nem medicação', { ...base, bloco_2_red_flags: {} }],
    ['dois sinais de alerta', { ...base, bloco_2_red_flags: { neuropathy: true, progressive: true } }],
    ['seis sinais de alerta (teto de 15 pontos)', { ...base, bloco_2_red_flags: { weight_loss: true, fever: true, night_pain: true, incontinence: true, progressive: true, neuropathy: true } }],
    ['corticoide e AINE diário', { ...base, bloco_2_red_flags: {}, bloco_6_corticoid: true, bloco_6_daily_nsaid: true }],
    ['sinais de alerta e medicação juntos', { ...base, bloco_2_red_flags: { fever: true }, bloco_6_corticoid: true, bloco_6_muscle_relaxant: true }],
  ];

  it.each(casos)('%s: o fechamento reproduz o total e a nota do cálculo oficial', (_nome, respostas) => {
    const completo = new MyIDCalculator(respostas as never).getFullResult() as Record<string, any>;
    const a = analisarPerdas(completo)!;
    expect(a).not.toBeNull();
    expect(a.totalGravado).toBe(true);
    expect(a.totalPerdas).toBeCloseTo(completo.myid_100.total_perdas, 1);
    expect(a.scoreFechado).toBeCloseTo(completo.MyID_score, 1);
    // dimensões + sinais de alerta + medicação = total
    expect(a.totalDimensoes + (a.sinaisDeAlerta?.pontos ?? 0) + (a.medicacaoEAjustes ?? 0)).toBeCloseTo(a.totalPerdas, 1);
    // a parte de medicação é exatamente a penalidade de medicação do cálculo (MED negativo = perda)
    expect(a.medicacaoEAjustes).toBeCloseTo(-(completo.component_scores?.MED ?? 0), 1);
  });
});
