// ═══════════════════════════════════════════════════════════
// MyID-100 v2.0 — Tabela de Perdas Não-Lineares
// Cada dimensão subtrai pontos de 100 (saúde perfeita)
// ═══════════════════════════════════════════════════════════

export interface BandaPerda {
  min: number;
  max: number;
  perda: number;
}

export interface DimensionLossConfig {
  peso_maximo: number;
  bandas: BandaPerda[];
  gatilho_critico?: number;
}

export const TABELA_PERDAS: Record<string, DimensionLossConfig> = {
  D: {
    peso_maximo: 20,
    bandas: [
      { min: 0.0, max: 1.0, perda: 0 },
      { min: 1.0, max: 3.0, perda: 3 },
      { min: 3.0, max: 5.0, perda: 8 },
      { min: 5.0, max: 7.0, perda: 14 },
      { min: 7.0, max: 10.01, perda: 20 },
    ],
  },
  EFI: {
    peso_maximo: 15,
    bandas: [
      { min: 0.0, max: 2.0, perda: 0 },
      { min: 2.0, max: 4.0, perda: 5 },
      { min: 4.0, max: 6.0, perda: 10 },
      { min: 6.0, max: 8.0, perda: 13 },
      { min: 8.0, max: 10.01, perda: 15 },
    ],
  },
  P: {
    peso_maximo: 5,
    bandas: [
      { min: 0.0, max: 3.0, perda: 0 },
      { min: 3.0, max: 5.0, perda: 2 },
      { min: 5.0, max: 7.0, perda: 4 },
      { min: 7.0, max: 10.01, perda: 5 },
    ],
  },
  I: {
    peso_maximo: 5,
    bandas: [
      { min: 0.0, max: 0.5, perda: 0 },
      { min: 0.5, max: 1.5, perda: 2 },
      { min: 1.5, max: 2.5, perda: 4 },
      { min: 2.5, max: 10.01, perda: 5 },
    ],
  },
  R: {
    peso_maximo: 15,
    bandas: [
      { min: 0.0, max: 2.0, perda: 0 },
      { min: 2.0, max: 4.0, perda: 5 },
      { min: 4.0, max: 6.0, perda: 10 },
      { min: 6.0, max: 8.0, perda: 13 },
      { min: 8.0, max: 10.01, perda: 15 },
    ],
    gatilho_critico: 7.0,
  },
  C: {
    peso_maximo: 10,
    bandas: [
      { min: 0.0, max: 2.0, perda: 0 },
      { min: 2.0, max: 4.0, perda: 4 },
      { min: 4.0, max: 6.0, perda: 7 },
      { min: 6.0, max: 10.01, perda: 10 },
    ],
  },
  AF: {
    peso_maximo: 8,
    bandas: [
      { min: 0.0, max: 2.0, perda: 0 },
      { min: 2.0, max: 4.0, perda: 3 },
      { min: 4.0, max: 6.0, perda: 6 },
      { min: 6.0, max: 10.01, perda: 8 },
    ],
    gatilho_critico: 7.0,
  },
  HID: {
    peso_maximo: 6,
    bandas: [
      { min: 0.0, max: 2.0, perda: 0 },
      { min: 2.0, max: 4.0, perda: 2 },
      { min: 4.0, max: 6.0, perda: 4 },
      { min: 6.0, max: 10.01, perda: 6 },
    ],
  },
  NUT: {
    peso_maximo: 6,
    bandas: [
      { min: 0.0, max: 2.0, perda: 0 },
      { min: 2.0, max: 4.0, perda: 2 },
      { min: 4.0, max: 6.0, perda: 4 },
      { min: 6.0, max: 10.01, perda: 6 },
    ],
  },
  ERG: {
    peso_maximo: 5,
    bandas: [
      { min: 0.0, max: 2.0, perda: 0 },
      { min: 2.0, max: 4.0, perda: 2 },
      { min: 4.0, max: 6.0, perda: 4 },
      { min: 6.0, max: 10.01, perda: 5 },
    ],
    gatilho_critico: 8.0,
  },
  N: {
    peso_maximo: 5,
    bandas: [
      { min: 0.0, max: 1.0, perda: 0 },
      { min: 1.0, max: 2.0, perda: 2 },
      { min: 2.0, max: 3.0, perda: 4 },
      { min: 3.0, max: 10.01, perda: 5 },
    ],
  },
};

// Medication penalties/bonuses
export const PENALIDADES_MEDICAMENTOS: Record<string, number> = {
  corticoide: -5,
  opioide: -4,
  ainh_cronico: -2,
  ansiolitico: -2,
  antidepressivo: 2,   // BÔNUS
  gabapentina: 2,      // BÔNUS
  ainh_esporadico: 2,  // BÔNUS
  suplementacao: 1,    // BÔNUS leve
};

export interface PerdaCalculada {
  score_bruto: number;
  perda_pontos: number;
  percentual_perda: number;
  banda: string;
  interpretacao: string;
  gatilho_critico: boolean;
}

export interface DriverPrimario {
  dimensao: string;
  score_bruto: number;
  perda_pontos: number;
  percentual_impacto: number;
  motivo: string;
}

export interface MyID100Result {
  pontuacao_inicial: 100;
  total_perdas: number;
  pontuacao_final: number;
  classificacao: string;
  cor: string;
  emoji: string;
  gatilhos_criticos_ativados: string[];
  driver_primario: DriverPrimario | null;
}

// Sum of all max weights = 100 (20+15+5+5+15+10+8+6+6+5+5 = 100)
const TOTAL_MAX_LOSS = 100;

const INTERPRETACAO_MAP: Record<string, Record<string, string>> = {
  D: { '0': 'Sem dor', '3': 'Dor leve', '8': 'Dor moderada', '14': 'Dor moderada-alta', '20': 'Dor severa' },
  EFI: { '0': 'Função normal', '5': 'Limitação leve', '10': 'Limitação moderada', '13': 'Limitação significativa', '15': 'Limitação severa' },
  P: { '0': 'Estável', '2': 'Kinesiofobia leve', '4': 'Kinesiofobia moderada', '5': 'Kinesiofobia alta' },
  I: { '0': 'Sem mudanças', '2': 'Mudanças leves', '4': 'Mudanças moderadas', '5': 'Mudanças recentes significativas' },
  R: { '0': 'Regulação ótima', '5': 'Desregulação leve', '10': 'Desregulação moderada', '13': 'Desregulação severa', '15': 'Desregulação crítica' },
  C: { '0': 'Contexto favorável', '4': 'Estresse contextual leve', '7': 'Estressor moderado', '10': 'Contexto adverso' },
  AF: { '0': 'Ativo', '3': 'Atividade insuficiente', '6': 'Inatividade moderada', '8': 'Inatividade crítica' },
  HID: { '0': 'Hidratação ótima', '2': 'Hidratação razoável', '4': 'Hidratação inadequada', '6': 'Desidratação' },
  NUT: { '0': 'Nutrição ótima', '2': 'Nutrição razoável', '4': 'Nutrição inadequada', '6': 'Déficit nutricional' },
  ERG: { '0': 'Ergonomia boa', '2': 'Ergonomia razoável', '4': 'Ergonomia ruim', '5': 'Ergonomia crítica' },
  N: { '0': 'Ruído mínimo', '2': 'Ruído leve', '4': 'Ruído moderado', '5': 'Ruído alto' },
};

function getInterpretacao(dim: string, perda: number): string {
  const map = INTERPRETACAO_MAP[dim];
  if (!map) return '';
  let best = '';
  for (const [threshold, desc] of Object.entries(map)) {
    if (perda >= Number(threshold)) best = desc;
  }
  return best;
}

/** Calculate the loss for a single dimension based on its raw score (0-10) */
export function calcularPerdaDimensao(dimensao: string, scoreBruto: number): PerdaCalculada {
  const config = TABELA_PERDAS[dimensao];
  if (!config) {
    return { score_bruto: scoreBruto, perda_pontos: 0, percentual_perda: 0, banda: '?', interpretacao: '', gatilho_critico: false };
  }

  const banda = config.bandas.find(b => scoreBruto >= b.min && scoreBruto < b.max)
    || config.bandas[config.bandas.length - 1];

  const gatilhoCritico = config.gatilho_critico !== undefined && scoreBruto >= config.gatilho_critico;

  return {
    score_bruto: scoreBruto,
    perda_pontos: banda.perda,
    percentual_perda: (banda.perda / TOTAL_MAX_LOSS) * 100,
    banda: `${banda.min}-${banda.max}`,
    interpretacao: getInterpretacao(dimensao, banda.perda),
    gatilho_critico: gatilhoCritico,
  };
}

/** Calculate medication bonus/penalty */
export function calcularPerdaMedicamentos(meds: {
  daily_nsaid?: boolean;
  antidepressant?: boolean;
  muscle_relaxant?: boolean;
  corticoid?: boolean;
  supplementation?: boolean;
}): { perda_pontos: number; medicamentos: string[] } {
  let penalty = 0;
  const medicamentos: string[] = [];

  if (meds.corticoid) { penalty += PENALIDADES_MEDICAMENTOS.corticoide; medicamentos.push('Corticóide'); }
  if (meds.daily_nsaid) { penalty += PENALIDADES_MEDICAMENTOS.ainh_cronico; medicamentos.push('AINE diário'); }
  if (meds.muscle_relaxant) { penalty += PENALIDADES_MEDICAMENTOS.ansiolitico; medicamentos.push('Relaxante muscular'); }
  if (meds.antidepressant) { penalty += PENALIDADES_MEDICAMENTOS.antidepressivo; medicamentos.push('Antidepressivo (bônus)'); }
  if (meds.supplementation) { penalty += PENALIDADES_MEDICAMENTOS.suplementacao; medicamentos.push('Suplementação (bônus)'); }

  return { perda_pontos: penalty, medicamentos };
}

/** Main MyID-100 classification */
export function classificarMyID100(score: number, temGatilhoCritico: boolean): {
  nome: string; cor: string; emoji: string;
} {
  if (temGatilhoCritico || score <= 29) {
    return { nome: 'CRÍTICO', cor: '#DC2626', emoji: '🔴' };
  } else if (score <= 49) {
    return { nome: 'CRÍTICO', cor: '#DC2626', emoji: '🔴' };
  } else if (score <= 69) {
    return { nome: 'MODERADO', cor: '#F59E0B', emoji: '🟠' };
  } else if (score <= 84) {
    return { nome: 'BOM', cor: '#FBBF24', emoji: '🟡' };
  } else {
    return { nome: 'EXCELENTE', cor: '#10B981', emoji: '🟢' };
  }
}

/** Identify the primary driver (dimension causing most loss) */
export function identificarDriver(perdas: Record<string, PerdaCalculada>): DriverPrimario | null {
  let maxPerda = 0;
  let driver: DriverPrimario | null = null;

  for (const [dimensao, dados] of Object.entries(perdas)) {
    if (dimensao === 'MED') continue;
    const pesoAjustado = dados.perda_pontos * (dados.gatilho_critico ? 1.5 : 1);

    if (pesoAjustado > maxPerda) {
      maxPerda = pesoAjustado;
      driver = {
        dimensao,
        score_bruto: dados.score_bruto,
        perda_pontos: dados.perda_pontos,
        percentual_impacto: dados.percentual_perda,
        motivo: dados.gatilho_critico
          ? 'Maior perda de pontos + gatilho crítico'
          : 'Maior perda de pontos',
      };
    }
  }

  return driver;
}

// ── Dimension Labels ──
export const DIMENSION_LABELS: Record<string, string> = {
  D: 'Dor',
  EFI: 'Funcionalidade',
  P: 'Psicológico',
  I: 'Inércia',
  R: 'Regulação',
  C: 'Contexto',
  AF: 'Atividade Física',
  HID: 'Hidratação',
  NUT: 'Nutrição',
  ERG: 'Ergonomia',
  N: 'Ruído Sistêmico',
  MED: 'Medicação',
};

// ── Dimension Colors ──
export const DIMENSION_COLORS: Record<string, string> = {
  D: '#EF4444',
  EFI: '#F97316',
  P: '#F59E0B',
  I: '#FCD34D',
  R: '#8B5CF6',
  C: '#6366F1',
  AF: '#3B82F6',
  HID: '#0EA5E9',
  NUT: '#06B6D4',
  ERG: '#14B8A6',
  N: '#64748B',
  MED: '#10B981',
};

// ── Classification Text Templates ──
export const TEMPLATES_INTERPRETACAO: Record<string, { titulo: string; descricao: string; recomendacao: string }> = {
  EXCELENTE: {
    titulo: '🟢 SAÚDE EXCELENTE',
    descricao: 'Seu perfil de saúde está em ótimo estado. Foco em manutenção e prevenção.',
    recomendacao: 'Continue com seus hábitos saudáveis. Reavaliação em 6-12 meses.',
  },
  BOM: {
    titulo: '🟡 BOA SAÚDE',
    descricao: 'Seu perfil é bom, mas há espaço para otimização.',
    recomendacao: 'Tratamento conservador. Ajustes em estilo de vida podem trazer melhorias significativas.',
  },
  MODERADO: {
    titulo: '🟠 SOBRECARGA MODERADA',
    descricao: 'Seu sistema está sob sobrecarga moderada. Intervenção ativa é recomendada.',
    recomendacao: 'Tratamento fisioterapêutico + ajustes de estilo de vida. Prognóstico bom com adesão.',
  },
  CRÍTICO: {
    titulo: '🔴 SITUAÇÃO CRÍTICA',
    descricao: 'Seu sistema está em sobrecarga crítica. Intervenção urgente é necessária.',
    recomendacao: 'Abordagem multidisciplinar urgente (fisio + psico + médico). Foco no driver primário.',
  },
};
