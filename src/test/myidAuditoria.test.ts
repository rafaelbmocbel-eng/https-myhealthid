import { describe, it, expect } from 'vitest';
import { MyIDCalculator } from '@/utils/myid/calculator';
import { getMyIDInterpretation } from '@/utils/myidCalculations';
import { pendenciasDoBloco } from '@/utils/myid/validacaoBlocos';

describe('getMyIDInterpretation — recebe valores brutos', () => {
  it('nota 0 de R/AF/ERG gera alerta crítico (antes virava "sem alerta")', () => {
    const a = getMyIDInterpretation(40, false, { R: 0, AF: 0, ERG: 0 });
    expect(a.dimensionAlerts?.map((x) => x.dimension).sort()).toEqual(['AF', 'ERG', 'R']);
    expect(a.dimensionAlerts?.every((x) => x.severity === 'CRÍTICO')).toBe(true);
  });
  it('nota alta de R/AF/ERG não gera alerta', () => {
    expect(getMyIDInterpretation(90, false, { R: 9, AF: 10, ERG: 9 }).dimensionAlerts).toBeUndefined();
  });
  it('EFI baixa é crítica e D alta é crítica/moderada', () => {
    const a = getMyIDInterpretation(50, false, { EFI: 2, D: 8 });
    expect(a.dimensionAlerts?.find((x) => x.dimension === 'EFI')?.severity).toBe('CRÍTICO');
    expect(a.dimensionAlerts?.find((x) => x.dimension === 'D')?.severity).toBe('MODERADO');
  });
});

describe('R e C: o pior item domina', () => {
  const base = { bloco_5a_hours: 8, bloco_5a_quality: 10, bloco_5a_awake: 'never', bloco_5b_tired_awake: 'never', bloco_5b_energy: 10,
    bloco_5c_stress: 0, bloco_5c_anxiety: 0, bloco_5c_control: 'very' };
  it('sono péssimo não é diluído pelo psicológico ótimo', () => {
    const r = new MyIDCalculator({ ...base, bloco_5a_hours: 3, bloco_5a_quality: 0, bloco_5a_awake: 'always' } as never);
    expect(r.calculateRegulation()).toBeLessThan(6);
  });
  it('finanças 10/10 puxa C para baixo', () => {
    const c = new MyIDCalculator({ bloco_5d_work_stress: 0, bloco_5d_family_conflict: 0, bloco_5d_financial_worry: 10 } as never);
    expect(c.calculateContext()).toBeLessThan(7);
  });
  it('"nenhum" nas listas não penaliza', () => {
    const c = new MyIDCalculator({ bloco_5a_disorders: ['none'], bloco_5h_bad_habits: ['none'], bloco_5f_dehydration_symptoms: { none: true }, bloco_5h_workspace: 'excellent', bloco_5f_water_liters: 3, bloco_5f_urine_color: 'clear' } as never);
    expect(c.calculateErgonomics()).toBe(10);
    expect(c.calculateHydration()).toBe(10);
  });
});

describe('validação: tudo obrigatório', () => {
  it('bloco 6 vazio cobra gate hormonal e medicação', () => {
    const f = pendenciasDoBloco(6, {});
    expect(f.some((x) => x.includes('se aplicam'))).toBe(true);
    expect(f.some((x) => x.includes('Medicações'))).toBe(true);
  });
  it('"não se aplica" dispensa as perguntas do ciclo', () => {
    const f = pendenciasDoBloco(6, { bloco_6_visceral_issues: ['none'], bloco_6_feminino_aplica: 'na', bloco_6_meds_none: true } as never);
    expect(f).toEqual([]);
  });
  it('"sim" exige ciclo, diagnóstico e hormonal', () => {
    const f = pendenciasDoBloco(6, { bloco_6_visceral_issues: ['none'], bloco_6_feminino_aplica: 'sim', bloco_6_meds_none: true } as never);
    expect(f.length).toBe(4);
  });
  it('alertas com tudo desmarcado não contam como respondido', () => {
    expect(pendenciasDoBloco(2, { bloco_2_pain_now: 0, bloco_2_pain_max: 0, bloco_2_red_flags: { fever: false } } as never)).toEqual(['Outros sintomas (ou "nenhum desses")']);
  });
  it('dor 0 conta como respondida', () => {
    expect(pendenciasDoBloco(2, { bloco_2_pain_now: 0, bloco_2_pain_max: 0, bloco_2_red_flags: { none: true } } as never)).toEqual([]);
  });
});
