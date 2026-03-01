// ═══════════════════════════════════════════════════════════
// Tipos para o Questionário MyID v2
// ═══════════════════════════════════════════════════════════

// ── BLOCO 1: Identificação e Gatilhos (Score I - Inércia) ──
export interface MyIDBloco1Data {
  queixaPrincipal: string;      // Legacy
  queixa_principal?: string;    // v2
  mudancasRecentes: string[];   // Legacy
  mudancas_recentes?: string[]; // v2
  dataInicioDor: string;        // Legacy
  data_inicio_dor?: string;     // v2
  descricaoEvento: string;      // Legacy
  descricao_evento?: string;    // v2
  scoreI: number;
}

// ── BLOCO 2: Mapeamento da Dor + Red Flags (Score D) ──
export interface MyIDRegiaoDor {
  id: string;
  nome: string;
  tiposDor: string[]; // 'Pontada aguda','Queimação','Peso/Pressão','Dormência','Formigamento'
  intensidadeAtual: number;  // 0-10
  intensidadeMaxima: number; // 0-10
  intensidadeMelhorDia: number; // 0-10
}

export interface RedFlags {
  perdaPeso: boolean;
  febreCalafrios: boolean;
  dorNoturnaImpedeSono: boolean;
  alteracaoEsfincteriana: boolean;
  dorPioraConsistente: boolean;
  dormenciaProgressiva: boolean;
}

export interface MyIDBloco2Data {
  regioes: MyIDRegiaoDor[];
  redFlags: RedFlags;
  temRedFlag: boolean;
  scoreD: number;
  bloco_2_pain_frequency?: string;
  bloco_2_worst_time?: string;
}

// ── BLOCO 3: Funcionalidade (Score EFI) ──
export interface MyIDBloco3Data {
  trabalho: number;      // 0-10
  domesticas: number;    // 0-10
  exercicio: number;     // 0-10
  independencia: number; // 0-10
  vidaSocial: number;    // 0-10
  scoreEFI: number;
}

// ── BLOCO 4: Comportamento e Crenças (Score P) ──
export interface MyIDBloco4Data {
  medoMovimento: number;   // 1-4
  catastrofizacao: number; // 1-4
  evitacao: number;        // 1-4
  autoeficacia: number;    // 0-10 (invertida)
  bloco_4_expectation?: number; // 0-10
  scoreP: number;
}

// ── BLOCO 5: Regulação Neurovegetativa (Score R + C) ──
export interface MyIDBloco5Data {
  // 5A: Sono (R1)
  qualidadeSono: number;   // Legacy
  horasSono: number;       // Legacy
  acordaPorDor: string;    // Legacy
  bloco_5a_hours?: number;
  bloco_5a_quality?: number;
  bloco_5a_awake?: string;
  bloco_5a_disorders?: string[];
  scoreR1: number;

  // 5B: Energia (R2)
  fadiga: number;          // Legacy
  exaustoAoAcordar: string; // Legacy
  bloco_5b_tired_awake?: string;
  scoreR2: number;

  // 5C: Psicológico (R3)
  estresse: number;        // Legacy
  ansiedade: number;       // Legacy
  controleSaude: string;   // Legacy
  bloco_5c_stress?: number;
  bloco_5c_anxiety?: number;
  bloco_5c_control?: string;
  scoreR3: number;

  // 5D: Contexto (C)
  trabalhoEstressante: number;    // Legacy
  conflitosFamiliares: number;    // Legacy
  preocupacaoFinanceira: number;  // Legacy
  scoreC: number;

  // 5E: Atividade Física (AF)
  bloco_5e_sitting_hours?: number;
  bloco_5e_lifestyle?: string;
  bloco_5e_exercise_types?: string[];
  bloco_5e_intensity?: string;

  // 5F: Hidratação (HID)
  bloco_5f_water_liters?: number;
  bloco_5f_urine_color?: string;
  bloco_5f_micturition?: number;
  bloco_5f_dehydration_symptoms?: Record<string, boolean>;

  // 5G: Nutrição (NUT)
  bloco_5g_quality?: string;
  bloco_5g_fruits_portions?: number;
  bloco_5g_protein?: string;
  bloco_5g_inflammatory?: string;
  bloco_5g_deficiency?: string;

  // 5H: Ergonomia (ERG)
  bloco_5h_workspace?: string;
  bloco_5h_sitting_continuous?: number;
  bloco_5h_sleep_position?: string;
  bloco_5h_mattress?: string;
  bloco_5h_bad_habits?: string[];

  scoreR: number;
}

// ── BLOCO 6: Ruído Sistêmico (Score N) ──
export interface MyIDBloco6Data {
  traumaAxial: boolean;
  traumaAxialAnos: number | null;
  cicatrizAbdominal: boolean;
  cicatrizTipo: string;
  cicatrizAnos: number | null;
  sinaisAutonomicos: string[];  // checkboxes
  // v2 fields
  bloco_6_axial_trauma?: boolean;
  bloco_6_abdominal_surgeries?: string[];
  bloco_6_visceral_issues?: string[];
  bloco_6_endometriosis?: boolean;
  bloco_6_pcos?: boolean;
  bloco_6_cycle_regularity?: string;
  bloco_6_cycle_affects_pain?: boolean;
  bloco_6_cycle_pain_phase?: string[];
  bloco_6_hormonal_use?: string;
  bloco_6_hormonal_improved?: boolean;
  bloco_6_daily_nsaid?: boolean;
  bloco_6_antidepressant?: boolean;
  bloco_6_antidepressant_type?: string;
  bloco_6_muscle_relaxant?: boolean;
  bloco_6_supplementation?: boolean;
  bloco_6_corticoid?: boolean;
  // Saúde feminina (opcional)
  diagnosticoFeminino: string; // 'endometriose','pcos','ambas','nao','prefiro_nao'
  scoreN: number;
}

// ── RESULTADO MyID ──
export interface MyIDResult {
  myidScore: number;
  myidStatus: string;
  componentScores: {
    D: number;
    EFI: number;
    P: number;
    I: number;
    R: number;
    C: number;
    N: number;
    AF?: number;
    HID?: number;
    NUT?: number;
    ERG?: number;
  };
  redFlagsDetected: boolean;
  redFlagAlerts: string[];
  classificacao: string;
}

// ── AVALIAÇÃO COMPLETA ──
export interface AvaliacaoMyID {
  id?: string;
  pacienteNome: string;
  pacienteIdade: number;
  dataAvaliacao: string;
  bloco1: MyIDBloco1Data;
  bloco2: MyIDBloco2Data;
  bloco3: MyIDBloco3Data;
  bloco4: MyIDBloco4Data;
  bloco5: MyIDBloco5Data;
  bloco6: MyIDBloco6Data;
  resultado: MyIDResult;
  blocoAtual: number;
  concluido: boolean;
}

// ── FINGERPRINT VISUALIZATION ──
export interface FingerprintRing {
  label: string;
  value: number;
  type: 'inner' | 'outer';
  color: string;
  scoreKey: string;
}

// ── Defaults ──
export const DEFAULT_RED_FLAGS: RedFlags = {
  perdaPeso: false,
  febreCalafrios: false,
  dorNoturnaImpedeSono: false,
  alteracaoEsfincteriana: false,
  dorPioraConsistente: false,
  dormenciaProgressiva: false,
};

export const DEFAULT_BLOCO1: MyIDBloco1Data = {
  queixaPrincipal: '',
  mudancasRecentes: [],
  dataInicioDor: '',
  descricaoEvento: '',
  scoreI: 0,
};

export const DEFAULT_BLOCO2: MyIDBloco2Data = {
  regioes: [],
  redFlags: { ...DEFAULT_RED_FLAGS },
  temRedFlag: false,
  scoreD: 0,
};

export const DEFAULT_BLOCO3: MyIDBloco3Data = {
  trabalho: 5, domesticas: 5, exercicio: 5, independencia: 5, vidaSocial: 5,
  scoreEFI: 5,
};

export const DEFAULT_BLOCO4: MyIDBloco4Data = {
  medoMovimento: 1, catastrofizacao: 1, evitacao: 1, autoeficacia: 5,
  scoreP: 0,
};

export const DEFAULT_BLOCO5: MyIDBloco5Data = {
  qualidadeSono: 5, horasSono: 7, acordaPorDor: 'nunca',
  scoreR1: 0,
  fadiga: 4, exaustoAoAcordar: 'nunca',
  scoreR2: 0,
  estresse: 5, ansiedade: 5, controleSaude: 'moderado',
  scoreR3: 0,
  trabalhoEstressante: 5, conflitosFamiliares: 3, preocupacaoFinanceira: 5,
  scoreC: 0,
  scoreR: 0,
};

export const DEFAULT_BLOCO6: MyIDBloco6Data = {
  traumaAxial: false, traumaAxialAnos: null,
  cicatrizAbdominal: false, cicatrizTipo: '', cicatrizAnos: null,
  sinaisAutonomicos: [],
  diagnosticoFeminino: 'nao',
  scoreN: 0,
};

export const MUDANCAS_RECENTES_OPTIONS = [
  'Novo equipamento (Tênis, colchão, travesseiro, cadeira de trabalho)',
  'Aumento de carga (Mais treino, nova atividade, competição)',
  'Mudança de postura (Mais tempo sentado, home office, viagem longa)',
  'Susto físico (Movimento em falso, quase escorregão, "travada")',
  'Nenhuma mudança que eu note',
];

export const TIPOS_DOR_MYID = [
  'Pontada aguda', 'Queimação', 'Peso/Pressão', 'Dormência', 'Formigamento',
];

export const SINAIS_AUTONOMICOS = [
  'Estufamento / Inchaço abdominal',
  'Refluxo / Azia',
  'Gastrite / Dor abdominal',
  'Cansaço excessivo logo após comer',
  'Sono logo após refeições',
  'Nenhum desses',
];
