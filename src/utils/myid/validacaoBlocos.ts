import type { MyIDResponses } from './calculator';

// Todas as perguntas que entram no cálculo são obrigatórias: sem resposta elas
// entrariam com um valor assumido em silêncio (o cliente não sabia que tinha pulado).
// Perguntas de lista têm sempre uma opção "nenhum"/"não se aplica" para poderem
// ser respondidas.
type Regra = { campo: string; rotulo: string; quando?: (d: Record<string, unknown>) => boolean; vazioSeLista?: boolean };

const filled = (v: unknown) => {
  if (v === undefined || v === null || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  // Objetos de caixas (alertas, sintomas): só vale se alguma estiver marcada.
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).some(Boolean);
  return true;
};

const MEDS = ['bloco_6_daily_nsaid', 'bloco_6_antidepressant', 'bloco_6_muscle_relaxant', 'bloco_6_supplementation', 'bloco_6_corticoid'];

const OBRIGATORIAS: Record<number, Regra[]> = {
  1: [
    { campo: 'bloco_1_changes', rotulo: 'Mudanças dos últimos 30 dias' },
    { campo: 'bloco_1_duracao', rotulo: 'Há quanto tempo sente a dor' },
  ],
  2: [
    { campo: 'bloco_2_pain_now', rotulo: 'Dor agora' },
    { campo: 'bloco_2_pain_max', rotulo: 'Pior dor nos últimos 7 dias' },
    { campo: 'bloco_2_red_flags', rotulo: 'Outros sintomas (ou "nenhum desses")' },
  ],
  3: [
    { campo: 'bloco_3_work', rotulo: 'Trabalho' },
    { campo: 'bloco_3_home', rotulo: 'Tarefas de casa' },
    { campo: 'bloco_3_exercise', rotulo: 'Exercício' },
    { campo: 'bloco_3_independence', rotulo: 'Independência física' },
    { campo: 'bloco_3_social', rotulo: 'Vida social' },
  ],
  4: [
    { campo: 'bloco_4_fear_movement', rotulo: 'Medo de movimento' },
    { campo: 'bloco_4_belief_damage', rotulo: 'Crença de dano' },
    { campo: 'bloco_4_avoidance', rotulo: 'Evitação' },
    { campo: 'bloco_4_self_efficacy', rotulo: 'Confiança' },
    { campo: 'bloco_4_expectation', rotulo: 'Expectativa de melhora' },
  ],
  5: [
    { campo: 'bloco_5a_hours', rotulo: 'Horas de sono' },
    { campo: 'bloco_5a_quality', rotulo: 'Qualidade do sono' },
    { campo: 'bloco_5a_awake', rotulo: 'Acordar na madrugada' },
    { campo: 'bloco_5a_disorders', rotulo: 'Distúrbios do sono (ou "nenhum")' },
    { campo: 'bloco_5b_tired_awake', rotulo: 'Cansaço ao acordar' },
    { campo: 'bloco_5b_energy', rotulo: 'Energia ao longo do dia' },
    { campo: 'bloco_5c_stress', rotulo: 'Nível de estresse' },
    { campo: 'bloco_5c_anxiety', rotulo: 'Nível de ansiedade' },
    { campo: 'bloco_5c_control', rotulo: 'Sensação de controle' },
    { campo: 'bloco_5d_work_stress', rotulo: 'Estresse no trabalho' },
    { campo: 'bloco_5d_family_conflict', rotulo: 'Conflitos familiares' },
    { campo: 'bloco_5d_financial_worry', rotulo: 'Preocupação financeira' },
    { campo: 'bloco_5e_sitting_hours', rotulo: 'Tempo total sentado por dia' },
    { campo: 'bloco_5e_lifestyle', rotulo: 'Estilo de vida' },
    { campo: 'bloco_5e_intensity', rotulo: 'Intensidade do exercício' },
    { campo: 'bloco_5f_water_liters', rotulo: 'Litros de água' },
    { campo: 'bloco_5f_urine_color', rotulo: 'Cor da urina' },
    { campo: 'bloco_5f_micturition', rotulo: 'Quantas vezes urina por dia' },
    { campo: 'bloco_5f_dehydration_symptoms', rotulo: 'Sintomas de desidratação (ou "nenhum")' },
    { campo: 'bloco_5g_quality', rotulo: 'Qualidade da alimentação' },
    { campo: 'bloco_5g_fruits_portions', rotulo: 'Porções de frutas e verduras' },
    { campo: 'bloco_5g_protein', rotulo: 'Proteína nas refeições' },
    { campo: 'bloco_5g_inflammatory', rotulo: 'Alimentos inflamatórios' },
    { campo: 'bloco_5g_deficiency', rotulo: 'Deficiências nutricionais' },
    { campo: 'bloco_5h_workspace', rotulo: 'Ergonomia no trabalho' },
    { campo: 'bloco_5h_sitting_continuous', rotulo: 'Tempo sentado sem pausar' },
    { campo: 'bloco_5h_sleep_position', rotulo: 'Posição de dormir' },
    { campo: 'bloco_5h_mattress', rotulo: 'Qualidade do colchão' },
    { campo: 'bloco_5h_bad_habits', rotulo: 'Hábitos posturais (ou "nenhum")' },
  ],
  6: [
    { campo: 'bloco_6_visceral_issues', rotulo: 'Saúde visceral (ou "nenhum")' },
    { campo: 'bloco_6_feminino_aplica', rotulo: 'Perguntas hormonais: se aplicam a você?' },
    { campo: 'bloco_6_diagnostico', rotulo: 'Diagnóstico hormonal', quando: (d) => d.bloco_6_feminino_aplica === 'sim' },
    { campo: 'bloco_6_cycle_regularity', rotulo: 'Ciclo menstrual regular?', quando: (d) => d.bloco_6_feminino_aplica === 'sim' },
    { campo: 'bloco_6_cycle_affects_pain', rotulo: 'A dor piora em fase do ciclo?', quando: (d) => d.bloco_6_feminino_aplica === 'sim' },
    { campo: 'bloco_6_cycle_pain_phase', rotulo: 'Em qual fase do ciclo a dor piora', quando: (d) => d.bloco_6_feminino_aplica === 'sim' && d.bloco_6_cycle_affects_pain === true },
    { campo: 'bloco_6_hormonal_use', rotulo: 'Uso de hormonal', quando: (d) => d.bloco_6_feminino_aplica === 'sim' },
    { campo: 'bloco_6_hormonal_improved', rotulo: 'A dor melhorou com o hormonal?', quando: (d) => d.bloco_6_feminino_aplica === 'sim' && filled(d.bloco_6_hormonal_use) && d.bloco_6_hormonal_use !== 'none' },
  ],
};

/** Rótulos das perguntas obrigatórias ainda sem resposta no bloco. */
export function pendenciasDoBloco(bloco: number, data: MyIDResponses): string[] {
  const d = data as Record<string, unknown>;
  const faltam = (OBRIGATORIAS[bloco] || [])
    .filter((r) => (r.quando ? r.quando(d) : true))
    .filter((r) => !filled(d[r.campo]))
    .map((r) => r.rotulo);
  if (bloco === 6 && !MEDS.some((c) => d[c] === true) && d.bloco_6_meds_none !== true) {
    faltam.push('Medicações (ou "não tomo nenhuma")');
  }
  return faltam;
}
