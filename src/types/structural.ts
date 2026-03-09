// ============================================
// SISTEMA DE AVALIAÇÃO ESTRUTURAL - MÉTODO IDENTIDADE
// Tipos, constantes, testes baseados em evidências, relações
// ============================================

// ---- Tipos ----

export interface StructuralPreferences {
  techniquePreference: string[];
  techniqueAversion: string[];
  medicalHistory: string[];
  painTolerance: number;
  additionalNotes: string;
}

export interface TestResult {
  testId: string;
  testName: string;
  result: string;
  scoreContribution: number;
  notes: string;
  performed: boolean;
}

export interface AffectedStructure {
  name: string;
  severity: 'LEVE' | 'MODERADA' | 'SEVERA';
  side?: string;
  finding: string;
}

export interface UnitAssessment {
  unitId: string;
  score: number;
  classification: string;
  testsPerformed: TestResult[];
  affectedStructures: {
    muscles: AffectedStructure[];
    joints: AffectedStructure[];
    ligaments: AffectedStructure[];
    nerves: AffectedStructure[];
    viscera: AffectedStructure[];
  };
  observacoes: string;
}

export interface StructuralRelationship {
  source: string;
  target: string;
  mechanism: string;
  affectedStructures: string[];
  severity: 'LEVE' | 'MODERADA' | 'SEVERA';
  interventionPriority?: number;
}

export interface IndirectRelationship {
  source: string;
  intermediate: string;
  target: string;
  mechanism: string;
  chainLength: number;
  severity: 'LEVE' | 'MODERADA' | 'SEVERA';
}

export interface ClinicalPriority {
  priority: number;
  unitId: string;
  score: number;
  action: string;
  durationWeeks: number;
  expectedImprovement: string;
}

export interface DysfunctionChainStep {
  step: number;
  unitId: string;
  dysfunction: string;
  consequence: string;
}

export interface StructuralAssessmentData {
  preferences: StructuralPreferences;
  units: Record<string, UnitAssessment>;
  relationships: {
    direct: StructuralRelationship[];
    indirect: IndirectRelationship[];
  };
  primaryDriver: string | null;
  dysfunctionChain: DysfunctionChainStep[];
  scoreStructuralGeneral: number;
  classification: string;
  clinicalPriorities: ClinicalPriority[];
}

// ---- Constantes: Unidades ----

export interface UnitConfig {
  id: string;
  name: string;
  shortName: string;
  emoji: string;
  region: string;
  structures: {
    muscles: string[];
    joints: string[];
    ligaments: string[];
    nerves: string[];
    viscera: string[];
  };
}

export const UNIT_CONFIGS: UnitConfig[] = [
  {
    id: 'UC-1', name: 'Cabeça & Pescoço', shortName: 'Cabeça-Pescoço', emoji: '🧠',
    region: 'cranio-cervical',
    structures: {
      muscles: ['Escalenos', 'ECM', 'Masseter', 'Suboccipitais', 'Trapézio Superior', 'Temporal'],
      joints: ['ATM', 'C0-C1', 'C1-C2', 'C5-C6', 'C6-C7'],
      ligaments: ['Ligamento alar', 'Lig. cervicais posteriores', 'Lig. transverso atlas'],
      nerves: ['NC V (Trigêmeo)', 'NC XI (Acessório)', 'C3-C4 (raízes)', 'Plexo cervical'],
      viscera: ['Laringe', 'Tireoide', 'Glândulas salivares'],
    },
  },
  {
    id: 'UC-2', name: 'Coluna Torácica', shortName: 'Torácica', emoji: '🫁',
    region: 'torácica',
    structures: {
      muscles: ['Intercostais', 'Diafragma', 'Romboides', 'Serrátil anterior', 'Paravertebrais torácicos'],
      joints: ['T1-T4', 'T5-T8', 'T9-T12', 'Costovertebrais', 'Costoesternais'],
      ligaments: ['Lig. longitudinal anterior', 'Lig. longitudinal posterior', 'Lig. costovertebrais'],
      nerves: ['Nervos intercostais', 'T6-T8 (raízes)', 'Cadeia simpática torácica'],
      viscera: ['Diafragma', 'Pulmões (base)', 'Esôfago'],
    },
  },
  {
    id: 'UC-3', name: 'Coluna Lombar', shortName: 'Lombar', emoji: '💡',
    region: 'lombar',
    structures: {
      muscles: ['Multífidos', 'Quadrado lombar', 'Psoas', 'Transverso abdominal', 'Eretor da espinha'],
      joints: ['L1-L2', 'L3-L4', 'L4-L5', 'L5-S1', 'Facetárias lombares'],
      ligaments: ['Lig. iliolmbar', 'Lig. longitudinal posterior', 'Lig. amarelo', 'Fáscia toracolombar'],
      nerves: ['L4 (raiz)', 'L5 (raiz)', 'S1 (raiz)', 'Nervo ciático (origem)'],
      viscera: ['Rins', 'Cólon descendente', 'Aorta abdominal'],
    },
  },
  {
    id: 'UC-4', name: 'Sacro-Pélvica', shortName: 'Pélvica', emoji: '⚖️',
    region: 'pélvica',
    structures: {
      muscles: ['Glúteo máximo', 'Glúteo médio', 'Piriforme', 'Assoalho pélvico', 'Psoas/Ilíaco'],
      joints: ['SIJ direita', 'SIJ esquerda', 'Sínfise púbica', 'Coccígea'],
      ligaments: ['Lig. sacroilíacos', 'Lig. sacrotuberoso', 'Lig. sacroespinhoso'],
      nerves: ['Plexo sacral', 'Nervo pudendo', 'S2-S4 (raízes)'],
      viscera: ['Bexiga', 'Útero/Próstata', 'Reto'],
    },
  },
  {
    id: 'UA-1', name: 'MSD – Membro Superior Direito', shortName: 'MSD', emoji: '💪',
    region: 'membro-superior-direito',
    structures: {
      muscles: ['Supraespinhoso', 'Infraespinhoso', 'Deltóide', 'Bíceps', 'Flexores punho'],
      joints: ['Glenoumeral D', 'Acromioclavicular D', 'Cotovelo D', 'Punho D'],
      ligaments: ['Lig. glenoumerais', 'Lig. coracoacromial', 'Lig. colaterais cotovelo'],
      nerves: ['Nervo mediano', 'Nervo radial', 'Nervo ulnar', 'Plexo braquial'],
      viscera: [],
    },
  },
  {
    id: 'UA-2', name: 'MSE – Membro Superior Esquerdo', shortName: 'MSE', emoji: '💪',
    region: 'membro-superior-esquerdo',
    structures: {
      muscles: ['Supraespinhoso', 'Infraespinhoso', 'Deltóide', 'Bíceps', 'Flexores punho'],
      joints: ['Glenoumeral E', 'Acromioclavicular E', 'Cotovelo E', 'Punho E'],
      ligaments: ['Lig. glenoumerais', 'Lig. coracoacromial', 'Lig. colaterais cotovelo'],
      nerves: ['Nervo mediano', 'Nervo radial', 'Nervo ulnar', 'Plexo braquial'],
      viscera: [],
    },
  },
  {
    id: 'UA-3', name: 'MID – Membro Inferior Direito', shortName: 'MID', emoji: '🦵',
    region: 'membro-inferior-direito',
    structures: {
      muscles: ['Quadríceps', 'Isquiotibiais', 'Tibial anterior', 'Gastrocnêmio', 'Glúteo médio'],
      joints: ['Coxofemoral D', 'Joelho D', 'Tornozelo D', 'Subtalar D'],
      ligaments: ['LCA', 'LCP', 'Lig. colaterais joelho', 'Lig. talofibular'],
      nerves: ['Nervo femoral', 'Nervo ciático', 'Nervo fibular', 'Nervo tibial'],
      viscera: [],
    },
  },
  {
    id: 'UA-4', name: 'MIE – Membro Inferior Esquerdo', shortName: 'MIE', emoji: '🦵',
    region: 'membro-inferior-esquerdo',
    structures: {
      muscles: ['Quadríceps', 'Isquiotibiais', 'Tibial anterior', 'Gastrocnêmio', 'Glúteo médio'],
      joints: ['Coxofemoral E', 'Joelho E', 'Tornozelo E', 'Subtalar E'],
      ligaments: ['LCA', 'LCP', 'Lig. colaterais joelho', 'Lig. talofibular'],
      nerves: ['Nervo femoral', 'Nervo ciático', 'Nervo fibular', 'Nervo tibial'],
      viscera: [],
    },
  },
];

// ---- Técnicas de Preferência ----

export const TECHNIQUE_OPTIONS = [
  'Mobilização Manual', 'Alongamento', 'Massagem', 'Pilates/Exercício',
  'Liberação Miofascial', 'Agulhamento/Acupuntura', 'Fisioterapia Respiratória',
  'Crioterapia', 'Eletroterapia', 'Tração', 'Manipulação Articular',
];

export const AVERSION_OPTIONS = [
  'Medo de agulha', 'Aversão a tração cervical', 'Medo de manipulação forçada',
  'Baixa tolerância à dor', 'Problema com mudanças de posição',
  'Sensibilidade ao frio', 'Sensibilidade ao calor', 'Sensibilidade ao toque',
];

export const MEDICAL_HISTORY_OPTIONS = [
  'Histórico de vertigem', 'Hipertensão arterial', 'Osteoporose',
  'Artrite/Artrose', 'Fibromialgia', 'Cirurgias recentes',
  'Diabetes', 'Cardiopatia', 'Distúrbio de coagulação',
];

// ---- Testes Baseados em Evidências ----

export interface EvidenceTest {
  id: string;
  name: string;
  category: string;
  evidence: string;
  optional: boolean;
  difficulty: 'Baixo' | 'Médio' | 'Alto';
  time: string;
  scoring: { label: string; value: number }[];
}

export const EVIDENCE_TESTS: Record<string, EvidenceTest[]> = {
  'UC-1': [
    {
      id: 'uc1_a1', name: 'Posicionamento Craniano', category: 'Postura', evidence: 'Verificar alinhamento orelha-ombro', optional: false, difficulty: 'Baixo', time: '1 min',
      scoring: [{ label: 'Neutra', value: 10 }, { label: 'Anteriorizada 1-2cm', value: 6 }, { label: 'Anteriorizada >2cm', value: 2 }]
    },
    {
      id: 'uc1_a2', name: 'Simetria Craniana', category: 'Postura', evidence: 'ASIS alinhadas, mandíbula simétrica', optional: false, difficulty: 'Baixo', time: '1 min',
      scoring: [{ label: 'Simétrica', value: 8 }, { label: 'Desvio leve', value: 4 }, { label: 'Desvio severo', value: 0 }]
    },
    {
      id: 'uc1_b1', name: 'ROM ATM (Abertura)', category: 'Mobilidade', evidence: '40-50mm normal | <30mm limitada', optional: false, difficulty: 'Baixo', time: '2 min',
      scoring: [{ label: '40-50mm (Normal)', value: 4 }, { label: '30-40mm (Reduzida)', value: 2 }, { label: '<30mm (Limitada)', value: 0 }]
    },
    {
      id: 'uc1_b2', name: 'ROM Cervical Global', category: 'Mobilidade', evidence: 'Flexão/Extensão/Rotação em todos os planos', optional: false, difficulty: 'Baixo', time: '3 min',
      scoring: [{ label: 'Normal (completo)', value: 8 }, { label: 'Reduzido 20-40%', value: 4 }, { label: 'Reduzido >40%', value: 1 }]
    },
    {
      id: 'uc1_c1', name: 'Palpação Muscular (ECM/Escalenos/Masseter)', category: 'Neuromuscular', evidence: 'Tônus, trigger points, assimetria', optional: false, difficulty: 'Baixo', time: '3 min',
      scoring: [{ label: 'Relaxados', value: 10 }, { label: 'Discretamente tensos', value: 5 }, { label: 'Hipertônico com TP', value: 0 }]
    },
    {
      id: 'uc1_d1', name: 'Teste Dix-Hallpike', category: 'Vertigem', evidence: 'Especificidade 85-95% para VPPB', optional: true, difficulty: 'Médio', time: '3 min',
      scoring: [{ label: 'Negativo', value: 2 }, { label: 'Leve positivo', value: 1 }, { label: 'Positivo com vertigem', value: 0 }]
    },
    {
      id: 'uc1_d2', name: 'Função Laríngea', category: 'Visceral', evidence: 'Avaliação de voz e deglutição', optional: true, difficulty: 'Baixo', time: '1 min',
      scoring: [{ label: 'Voz clara', value: 1 }, { label: 'Rouquidão leve', value: 0.5 }, { label: 'Rouquidão severa', value: 0 }]
    },
  ],
  'UC-2': [
    {
      id: 'uc2_a1', name: 'Avaliação de Cifose', category: 'Postura', evidence: 'Ângulo de Cobb torácico (gold standard)', optional: false, difficulty: 'Baixo', time: '2 min',
      scoring: [{ label: 'Normal (<40°)', value: 10 }, { label: 'Moderada (40-60°)', value: 5 }, { label: 'Severa (>60°)', value: 2 }]
    },
    {
      id: 'uc2_a2', name: 'Expansão Torácica', category: 'Mobilidade', evidence: 'Normal ≥5cm diferença inspiração-expiração', optional: false, difficulty: 'Baixo', time: '2 min',
      scoring: [{ label: '≥5cm (Normal)', value: 8 }, { label: '3-5cm (Reduzida)', value: 4 }, { label: '<3cm (Severa)', value: 0 }]
    },
    {
      id: 'uc2_b1', name: 'Rotação Torácica', category: 'Mobilidade', evidence: 'Normal 30-50° cada lado', optional: false, difficulty: 'Baixo', time: '2 min',
      scoring: [{ label: 'Normal', value: 6 }, { label: 'Reduzida 20-40%', value: 3 }, { label: 'Reduzida >40%', value: 0 }]
    },
    {
      id: 'uc2_c1', name: 'Palpação Intercostais/Diafragma', category: 'Neuromuscular', evidence: 'Tônus, restrição costal', optional: false, difficulty: 'Baixo', time: '3 min',
      scoring: [{ label: 'Sem restrição', value: 6 }, { label: 'Restrição leve', value: 3 }, { label: 'Restrição severa', value: 0 }]
    },
    {
      id: 'uc2_d1', name: 'Padrão Respiratório', category: 'Visceral', evidence: 'Diafragmático vs Costal', optional: true, difficulty: 'Baixo', time: '2 min',
      scoring: [{ label: 'Diafragmático', value: 4 }, { label: 'Misto', value: 2 }, { label: 'Costal puro', value: 0 }]
    },
  ],
  'UC-3': [
    {
      id: 'uc3_a1', name: 'Lordose Lombar', category: 'Postura', evidence: 'Avaliação da curvatura lombar', optional: false, difficulty: 'Baixo', time: '1 min',
      scoring: [{ label: 'Normal', value: 8 }, { label: 'Hiperlordose leve', value: 4 }, { label: 'Hiperlordose severa', value: 0 }]
    },
    {
      id: 'uc3_b1', name: 'Schober Modificado', category: 'Mobilidade', evidence: 'Gold standard flexão lombar (sens. 80%)', optional: false, difficulty: 'Baixo', time: '2 min',
      scoring: [{ label: '≥5cm (Normal)', value: 6 }, { label: '3-5cm', value: 3 }, { label: '<3cm', value: 0 }]
    },
    {
      id: 'uc3_c1', name: 'Teste de Lasègue (SLR)', category: 'Nervo', evidence: 'Sens. 80%, esp. 40% para hérnia', optional: false, difficulty: 'Baixo', time: '2 min',
      scoring: [{ label: 'Negativo', value: 4 }, { label: 'Positivo >60°', value: 2 }, { label: 'Positivo <30°', value: 0 }]
    },
    {
      id: 'uc3_c2', name: 'Teste Slump', category: 'Nervo', evidence: 'Sens. 84%, esp. 83%', optional: true, difficulty: 'Médio', time: '3 min',
      scoring: [{ label: 'Negativo', value: 4 }, { label: 'Leve positivo', value: 2 }, { label: 'Positivo com irradiação', value: 0 }]
    },
    {
      id: 'uc3_d1', name: 'Palpação Paravertebral Lombar', category: 'Neuromuscular', evidence: 'Tônus, espasmo, trigger points', optional: false, difficulty: 'Baixo', time: '3 min',
      scoring: [{ label: 'Sem tensão', value: 6 }, { label: 'Tensão moderada', value: 3 }, { label: 'Espasmo/TP', value: 0 }]
    },
    {
      id: 'uc3_e1', name: 'Patrick/FABER', category: 'Quadril/SIJ', evidence: 'Sens. 72% para SIJ', optional: true, difficulty: 'Médio', time: '2 min',
      scoring: [{ label: 'Negativo', value: 2 }, { label: 'Leve dor', value: 1 }, { label: 'Positivo', value: 0 }]
    },
  ],
  'UC-4': [
    {
      id: 'uc4_a1', name: 'Alinhamento Pélvico', category: 'Postura', evidence: 'EIAS, cristas ilíacas, assimetria', optional: false, difficulty: 'Baixo', time: '2 min',
      scoring: [{ label: 'Simétrico', value: 8 }, { label: 'Assimetria leve', value: 4 }, { label: 'Assimetria severa', value: 0 }]
    },
    {
      id: 'uc4_b1', name: 'Trendelenburg', category: 'Força Glútea', evidence: 'Sens. 65-75% fraqueza glútea', optional: false, difficulty: 'Baixo', time: '2 min',
      scoring: [{ label: 'Negativo', value: 6 }, { label: 'Leve queda', value: 3 }, { label: 'Positivo', value: 0 }]
    },
    {
      id: 'uc4_b2', name: 'Teste de Thomas', category: 'Flexibilidade', evidence: 'Gold standard encurtamento psoas', optional: false, difficulty: 'Médio', time: '2 min',
      scoring: [{ label: 'Negativo', value: 6 }, { label: 'Encurtamento leve', value: 3 }, { label: 'Encurtamento severo', value: 0 }]
    },
    {
      id: 'uc4_c1', name: 'Compressão/Distração SIJ', category: 'Articulação', evidence: 'Avaliação disfunção SIJ', optional: true, difficulty: 'Médio', time: '2 min',
      scoring: [{ label: 'Negativo', value: 4 }, { label: 'Leve dor', value: 2 }, { label: 'Positivo', value: 0 }]
    },
    {
      id: 'uc4_d1', name: 'Avaliação Assoalho Pélvico', category: 'Visceral', evidence: 'Tônus e força do assoalho', optional: true, difficulty: 'Médio', time: '3 min',
      scoring: [{ label: 'Normal', value: 4 }, { label: 'Fraqueza leve', value: 2 }, { label: 'Fraqueza severa', value: 0 }]
    },
  ],
  'UA-1': [
    {
      id: 'ua1_a1', name: 'ROM Ombro D', category: 'Mobilidade', evidence: 'Flexão, Abdução, Rotações', optional: false, difficulty: 'Baixo', time: '3 min',
      scoring: [{ label: 'Normal', value: 8 }, { label: 'Reduzido 20-40%', value: 4 }, { label: 'Reduzido >40%', value: 0 }]
    },
    {
      id: 'ua1_b1', name: 'Teste Hawkins', category: 'Impacto', evidence: 'Sens. 72%, esp. 93%', optional: true, difficulty: 'Baixo', time: '1 min',
      scoring: [{ label: 'Negativo', value: 4 }, { label: 'Leve dor', value: 2 }, { label: 'Positivo', value: 0 }]
    },
    {
      id: 'ua1_b2', name: 'Teste O\'Brien (SLAP)', category: 'Labrum', evidence: 'Sens. 72%, esp. 96%', optional: true, difficulty: 'Médio', time: '2 min',
      scoring: [{ label: 'Negativo', value: 4 }, { label: 'Leve dor', value: 2 }, { label: 'Positivo', value: 0 }]
    },
    {
      id: 'ua1_c1', name: 'Força Preensão (Dinamômetro)', category: 'Força', evidence: 'Gold standard força de mão', optional: false, difficulty: 'Baixo', time: '2 min',
      scoring: [{ label: 'Normal', value: 6 }, { label: 'Reduzida', value: 3 }, { label: 'Fraca', value: 0 }]
    },
    {
      id: 'ua1_d1', name: 'Palpação Rotador Cuff', category: 'Neuromuscular', evidence: 'Tônus, dor, trigger points', optional: false, difficulty: 'Baixo', time: '2 min',
      scoring: [{ label: 'Sem dor', value: 6 }, { label: 'Dor leve', value: 3 }, { label: 'Dor severa/TP', value: 0 }]
    },
  ],
  'UA-2': [
    {
      id: 'ua2_a1', name: 'ROM Ombro E', category: 'Mobilidade', evidence: 'Flexão, Abdução, Rotações', optional: false, difficulty: 'Baixo', time: '3 min',
      scoring: [{ label: 'Normal', value: 8 }, { label: 'Reduzido 20-40%', value: 4 }, { label: 'Reduzido >40%', value: 0 }]
    },
    {
      id: 'ua2_b1', name: 'Teste Hawkins E', category: 'Impacto', evidence: 'Sens. 72%, esp. 93%', optional: true, difficulty: 'Baixo', time: '1 min',
      scoring: [{ label: 'Negativo', value: 4 }, { label: 'Leve dor', value: 2 }, { label: 'Positivo', value: 0 }]
    },
    {
      id: 'ua2_c1', name: 'Força Preensão E', category: 'Força', evidence: 'Gold standard força de mão', optional: false, difficulty: 'Baixo', time: '2 min',
      scoring: [{ label: 'Normal', value: 6 }, { label: 'Reduzida', value: 3 }, { label: 'Fraca', value: 0 }]
    },
    {
      id: 'ua2_d1', name: 'Palpação Rotador Cuff E', category: 'Neuromuscular', evidence: 'Tônus, dor, trigger points', optional: false, difficulty: 'Baixo', time: '2 min',
      scoring: [{ label: 'Sem dor', value: 6 }, { label: 'Dor leve', value: 3 }, { label: 'Dor severa/TP', value: 0 }]
    },
  ],
  'UA-3': [
    {
      id: 'ua3_a1', name: 'ROM Quadril/Joelho D', category: 'Mobilidade', evidence: 'Flexão, extensão, rotações', optional: false, difficulty: 'Baixo', time: '3 min',
      scoring: [{ label: 'Normal', value: 8 }, { label: 'Reduzido 20-40%', value: 4 }, { label: 'Reduzido >40%', value: 0 }]
    },
    {
      id: 'ua3_b1', name: 'Lachman D', category: 'Joelho', evidence: 'Sens. 85%, esp. 95% para LCA', optional: true, difficulty: 'Médio', time: '2 min',
      scoring: [{ label: 'Negativo', value: 4 }, { label: 'Leve frouxidão', value: 2 }, { label: 'Positivo', value: 0 }]
    },
    {
      id: 'ua3_b2', name: 'McMurray D', category: 'Menisco', evidence: 'Sens. 50-70%, esp. 95%', optional: true, difficulty: 'Médio', time: '2 min',
      scoring: [{ label: 'Negativo', value: 4 }, { label: 'Dor leve', value: 2 }, { label: 'Positivo com click', value: 0 }]
    },
    {
      id: 'ua3_c1', name: 'Tornozelo/Pé D', category: 'Mobilidade', evidence: 'Dorsiflexão, inversão, eversão', optional: false, difficulty: 'Baixo', time: '2 min',
      scoring: [{ label: 'Normal', value: 6 }, { label: 'Reduzido', value: 3 }, { label: 'Limitado', value: 0 }]
    },
    {
      id: 'ua3_d1', name: 'Palpação MID', category: 'Neuromuscular', evidence: 'Quadríceps, isquiotibiais, gastrocnêmio', optional: false, difficulty: 'Baixo', time: '3 min',
      scoring: [{ label: 'Sem tensão', value: 6 }, { label: 'Tensão moderada', value: 3 }, { label: 'Espasmo/TP', value: 0 }]
    },
  ],
  'UA-4': [
    {
      id: 'ua4_a1', name: 'ROM Quadril/Joelho E', category: 'Mobilidade', evidence: 'Flexão, extensão, rotações', optional: false, difficulty: 'Baixo', time: '3 min',
      scoring: [{ label: 'Normal', value: 8 }, { label: 'Reduzido 20-40%', value: 4 }, { label: 'Reduzido >40%', value: 0 }]
    },
    {
      id: 'ua4_b1', name: 'Lachman E', category: 'Joelho', evidence: 'Sens. 85%, esp. 95% para LCA', optional: true, difficulty: 'Médio', time: '2 min',
      scoring: [{ label: 'Negativo', value: 4 }, { label: 'Leve frouxidão', value: 2 }, { label: 'Positivo', value: 0 }]
    },
    {
      id: 'ua4_c1', name: 'Tornozelo/Pé E', category: 'Mobilidade', evidence: 'Dorsiflexão, inversão, eversão', optional: false, difficulty: 'Baixo', time: '2 min',
      scoring: [{ label: 'Normal', value: 6 }, { label: 'Reduzido', value: 3 }, { label: 'Limitado', value: 0 }]
    },
    {
      id: 'ua4_d1', name: 'Palpação MIE', category: 'Neuromuscular', evidence: 'Quadríceps, isquiotibiais, gastrocnêmio', optional: false, difficulty: 'Baixo', time: '3 min',
      scoring: [{ label: 'Sem tensão', value: 6 }, { label: 'Tensão moderada', value: 3 }, { label: 'Espasmo/TP', value: 0 }]
    },
  ],
};

// ---- Relações Estruturais ----

export const UNIT_RELATIONSHIPS: Record<string, { direct: Omit<StructuralRelationship, 'severity' | 'interventionPriority'>[]; indirect: Omit<IndirectRelationship, 'severity'>[]; }> = {
  'UC-1': {
    direct: [
      { source: 'UC-1', target: 'UC-2', mechanism: 'Anteriorização craniana força extensão torácica → aumento de cifose', affectedStructures: ['Músculos torácicos', 'Costelas 6-8'] },
      { source: 'UC-1', target: 'UA-1', mechanism: 'ECM/escalenos tensos comprimem plexo braquial → parestesia MSD', affectedStructures: ['Nervo mediano', 'Nervo radial'] },
      { source: 'UC-1', target: 'UA-2', mechanism: 'ECM/escalenos tensos comprimem plexo braquial → parestesia MSE', affectedStructures: ['Nervo mediano', 'Nervo radial'] },
    ],
    indirect: [
      { source: 'UC-1', intermediate: 'UC-3', target: 'UC-4', mechanism: 'Rigidez lombar força flexão cervical compensatória → retroversão pélvica', chainLength: 3 },
    ],
  },
  'UC-2': {
    direct: [
      { source: 'UC-2', target: 'UC-1', mechanism: 'Cifose excessiva força flexão cervical + anteriorização', affectedStructures: ['Músculos cervicais', 'C6-C7'] },
      { source: 'UC-2', target: 'UC-3', mechanism: 'Perda de extensão torácica compensa com hiperlordose L5', affectedStructures: ['Disco L5-S1', 'Facetárias L5'] },
      { source: 'UC-2', target: 'UC-4', mechanism: 'Restrição diafragmática reduz pressão intra-abdominal → assoalho pélvico fraco', affectedStructures: ['Diafragma', 'Assoalho pélvico'] },
      { source: 'UC-2', target: 'UA-1', mechanism: 'Cifose internaliza ombros → impacto subacromial D', affectedStructures: ['Supraespinhoso', 'Espaço subacromial'] },
      { source: 'UC-2', target: 'UA-2', mechanism: 'Cifose internaliza ombros → impacto subacromial E', affectedStructures: ['Supraespinhoso', 'Espaço subacromial'] },
    ],
    indirect: [
      { source: 'UC-2', intermediate: 'UC-3', target: 'UA-3', mechanism: 'Cifose → hiperlordose → irradiação L5 → fraqueza dorsiflexor D', chainLength: 3 },
      { source: 'UC-2', intermediate: 'UC-3', target: 'UA-4', mechanism: 'Cifose → hiperlordose → irradiação L5 → fraqueza dorsiflexor E', chainLength: 3 },
    ],
  },
  'UC-3': {
    direct: [
      { source: 'UC-3', target: 'UC-4', mechanism: 'Hiperlordose aumenta stress na SIJ', affectedStructures: ['Articulação SIJ', 'Ligamentos SIJ'] },
      { source: 'UC-3', target: 'UA-3', mechanism: 'Irradiação L5-S1 → fraqueza em MID', affectedStructures: ['Raiz L5', 'Tibial anterior'] },
      { source: 'UC-3', target: 'UA-4', mechanism: 'Irradiação L5-S1 → fraqueza em MIE', affectedStructures: ['Raiz L5', 'Tibial anterior'] },
    ],
    indirect: [
      { source: 'UC-3', intermediate: 'UC-4', target: 'UA-3', mechanism: 'Lombar → pélvica → varismo femoral → sobrecarga joelho D', chainLength: 3 },
    ],
  },
  'UC-4': {
    direct: [
      { source: 'UC-4', target: 'UA-3', mechanism: 'Glúteo fraco → varismo femoral → sobrecarga joelho D', affectedStructures: ['Glúteo médio', 'Joelho medial'] },
      { source: 'UC-4', target: 'UA-4', mechanism: 'Glúteo fraco → varismo femoral → sobrecarga joelho E', affectedStructures: ['Glúteo médio', 'Joelho medial'] },
      { source: 'UC-4', target: 'UC-3', mechanism: 'Inclinação pélvica anterior → hiperlordose L5', affectedStructures: ['Lordose lombar', 'L5-S1'] },
    ],
    indirect: [],
  },
  'UA-1': { direct: [], indirect: [] },
  'UA-2': { direct: [], indirect: [] },
  'UA-3': { direct: [], indirect: [] },
  'UA-4': { direct: [], indirect: [] },
};

// ---- Funções de Cálculo ----

// ESCALA INVERTIDA: 0 = Sem Alteração (melhor), 10 = Crítico (pior)
export function classifyScore(score: number): string {
  if (score <= 2) return 'SEM ALTERAÇÃO';
  if (score <= 4) return 'LEVE';
  if (score <= 6) return 'MODERADO';
  if (score <= 8) return 'ALERTA';
  return 'CRÍTICO';
}

export function classifyScoreColor(score: number): string {
  if (score <= 2) return 'text-violet-500';
  if (score <= 4) return 'text-indigo-500';
  if (score <= 6) return 'text-amber-500';
  if (score <= 8) return 'text-orange-600';
  return 'text-red-600';
}

export function getSeverityColorHex(score: number): string {
  if (score <= 2) return '#8b5cf6'; // violet-500
  if (score <= 4) return '#6366f1'; // indigo-500
  if (score <= 6) return '#f59e0b'; // amber-500
  if (score <= 8) return '#ea580c'; // orange-600
  return '#dc2626'; // red-600
}

export function classifyScoreBg(score: number): string {
  if (score <= 2) return 'bg-violet-50 border-violet-200';
  if (score <= 4) return 'bg-indigo-50 border-indigo-200';
  if (score <= 6) return 'bg-amber-50 border-amber-200';
  if (score <= 8) return 'bg-orange-50 border-orange-200';
  return 'bg-red-50 border-red-200';
}

export function calculateUnitScore(tests: TestResult[]): number {
  const performed = tests.filter(t => t.performed);
  if (performed.length === 0) return 0;
  const maxPossible = performed.reduce((acc, t) => {
    // Find the test config to get max score
    for (const unitTests of Object.values(EVIDENCE_TESTS)) {
      const config = unitTests.find(et => et.id === t.testId);
      if (config) {
        const maxScore = Math.max(...config.scoring.map(s => s.value));
        return acc + maxScore;
      }
    }
    return acc;
  }, 0);
  const actual = performed.reduce((acc, t) => acc + t.scoreContribution, 0);
  if (maxPossible === 0) return 0;
  return Math.round((actual / maxPossible) * 10 * 10) / 10;
}

export function calculateGeneralScore(units: Record<string, UnitAssessment>): number {
  const scores = Object.values(units).map(u => u.score);
  if (scores.length === 0) return 0;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

export function mapRelationships(units: Record<string, UnitAssessment>): { direct: StructuralRelationship[]; indirect: IndirectRelationship[] } {
  const directRels: StructuralRelationship[] = [];
  const indirectRels: IndirectRelationship[] = [];

  for (const [unitId, assessment] of Object.entries(units)) {
    if (assessment.score <= 2) continue; // healthy unit (0-2 = sem alteração), skip
    const rels = UNIT_RELATIONSHIPS[unitId];
    if (!rels) continue;

    for (const rel of rels.direct) {
      const targetAssessment = units[rel.target];
      if (!targetAssessment || targetAssessment.score <= 2) continue;
      const severity = assessment.score >= 8 ? 'SEVERA' : assessment.score >= 5 ? 'MODERADA' : 'LEVE';
      directRels.push({ ...rel, severity, interventionPriority: directRels.length + 1 });
    }

    for (const rel of rels.indirect) {
      const targetAssessment = units[rel.target];
      if (!targetAssessment || targetAssessment.score <= 2) continue;
      const severity = assessment.score >= 8 ? 'SEVERA' : assessment.score >= 5 ? 'MODERADA' : 'LEVE';
      indirectRels.push({ ...rel, severity });
    }
  }

  return { direct: directRels, indirect: indirectRels };
}

export function identifyPrimaryDriver(units: Record<string, UnitAssessment>): string | null {
  let worst: string | null = null;
  let worstScore = -1;
  for (const [id, u] of Object.entries(units)) {
    if (u.score > worstScore) {
      worstScore = u.score;
      worst = id;
    }
  }
  return worstScore > 2 ? worst : null; // only return if there's actual compromise
}

export function generateClinicalPriorities(units: Record<string, UnitAssessment>): ClinicalPriority[] {
  const sorted = Object.entries(units)
    .filter(([, u]) => u.score > 2) // score > 2 means there's compromise
    .sort(([, a], [, b]) => b.score - a.score); // highest score = worst = first priority

  return sorted.map(([id, u], i) => ({
    priority: i + 1,
    unitId: id,
    score: u.score,
    action: u.score >= 8 ? 'Release + mobilidade + reeducação' : u.score >= 5 ? 'Estabilização + fortalecimento' : 'Manutenção + prevenção',
    durationWeeks: u.score >= 8 ? 3 : u.score >= 5 ? 4 : 2,
    expectedImprovement: `${id} → ${Math.max(0, u.score - 2).toFixed(1)}`,
  }));
}

export function createDefaultAssessment(): StructuralAssessmentData {
  const units: Record<string, UnitAssessment> = {};
  for (const cfg of UNIT_CONFIGS) {
    units[cfg.id] = {
      unitId: cfg.id,
      score: 0,
      classification: 'SEM ALTERAÇÃO',
      testsPerformed: (EVIDENCE_TESTS[cfg.id] || []).map(t => ({
        testId: t.id,
        testName: t.name,
        result: '',
        scoreContribution: 0,
        notes: '',
        performed: false,
      })),
      affectedStructures: { muscles: [], joints: [], ligaments: [], nerves: [], viscera: [] },
      observacoes: '',
    };
  }
  return {
    preferences: {
      techniquePreference: [],
      techniqueAversion: [],
      medicalHistory: [],
      painTolerance: 5,
      additionalNotes: '',
    },
    units,
    relationships: { direct: [], indirect: [] },
    primaryDriver: null,
    dysfunctionChain: [],
    scoreStructuralGeneral: 0,
    classification: 'SEM ALTERAÇÃO',
    clinicalPriorities: [],
  };
}
