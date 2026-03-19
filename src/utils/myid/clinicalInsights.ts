// ═══════════════════════════════════════════════════════════
// MyID-100 v2.0 — Clinical Insights Engine
// Generates phase-based treatment insights & gamification missions
// based on driver primário, MyID score, and dimension losses
// ═══════════════════════════════════════════════════════════

import { calcularPerdaDimensao, identificarDriver, PerdaCalculada, DIMENSION_LABELS } from './lossTable';

export interface ClinicalPhase {
  fase: number;
  titulo: string;
  semanas: string;
  foco: string;
  intervencoes: string[];
  metaMyID: string;
  icone: string;
}

export interface DriverInsight {
  driver: string;
  driverLabel: string;
  perda: number;
  intervencoes: string[];
  encaminhamentos: string[];
}

export interface ClinicalInsightResult {
  classificacao: 'CRÍTICO' | 'MODERADO' | 'BOM' | 'EXCELENTE';
  myidScore: number;
  driverInsight: DriverInsight | null;
  fases: ClinicalPhase[];
  missoes: ClinicalMission[];
  metaFinal: string;
}

export interface ClinicalMission {
  id: string;
  titulo: string;
  descricao: string;
  categoria: 'urgente' | 'importante' | 'oportunidade' | 'consolidacao';
  fase: number;
  xp: number;
  dimensao: string;
  tipo: 'diaria' | 'semanal' | 'marco';
}

// ── Driver-specific interventions ──
const DRIVER_INTERVENTIONS: Record<string, { intervencoes: string[]; encaminhamentos: string[] }> = {
  D: {
    intervencoes: [
      'Educação em neurociência da dor (sessão 1)',
      'Técnicas de modulação (TENS, crioterapia, terapia manual)',
      'Exercícios de amplitude de movimento sem carga',
      'Respiração diafragmática 3×/dia para modulação autonômica',
    ],
    encaminhamentos: ['Avaliação médica se dor > 8/10 persistente', 'Considerar analgesia temporária supervisionada'],
  },
  EFI: {
    intervencoes: [
      'Exercícios de amplitude de movimento sem carga',
      'Adaptações funcionais (tecnologia assistiva se necessário)',
      'Retorno gradual às atividades de vida diária',
      'Fisioterapia 2–3× semana',
    ],
    encaminhamentos: ['Avaliação ocupacional se limitação funcional severa'],
  },
  C: {
    intervencoes: [
      'Estratégias de gerenciamento de stress',
      'Técnicas de relaxamento e mindfulness',
      'Reestruturação da rotina de trabalho',
      'Atividades de lazer e socialização programadas',
    ],
    encaminhamentos: [
      'Encaminhamento psicológico',
      'Apoio social estruturado',
      'Afastamento do trabalho se necessário',
    ],
  },
  R: {
    intervencoes: [
      'Higiene do sono: rotina fixa de horários',
      'Desligar telas 1h antes de dormir',
      'Técnicas de relaxamento pré-sono',
      'Regulação de cafeína (último café até 14h)',
    ],
    encaminhamentos: ['Avaliação médica se insônia crônica', 'Considerar polissonografia'],
  },
  P: {
    intervencoes: [
      'Educação em neurociência da dor (foco: crenças)',
      'Exposição gradual ao movimento temido',
      'Diário de atividades sem dor (evidenciar capacidade)',
      'Reestruturação cognitiva de pensamentos catastróficos',
    ],
    encaminhamentos: ['Psicoterapia cognitivo-comportamental se persistente'],
  },
  AF: {
    intervencoes: [
      'Caminhada progressiva (10→20→30 min/dia)',
      'Exercícios de core e estabilização (3× semana)',
      'Mobilidade articular sistêmica diária',
      'Fortalecimento específico (conforme avaliação estrutural)',
    ],
    encaminhamentos: ['Avaliação cardiológica se sedentário > 6 meses'],
  },
  HID: {
    intervencoes: [
      'Meta: 2L de água/dia (garrafa visível)',
      'Alarmes a cada 2h para hidratação',
      'Monitorar cor da urina (meta: amarelo claro)',
      'Substituir refrigerante/café por água',
    ],
    encaminhamentos: [],
  },
  NUT: {
    intervencoes: [
      '2 porções de vegetais/dia (mínimo)',
      'Redução de ultraprocessados',
      'Proteína em todas as refeições',
      'Redução de açúcar e farinhas refinadas',
    ],
    encaminhamentos: ['Encaminhamento nutricional se déficit severo'],
  },
  ERG: {
    intervencoes: [
      'Micro-pausas a cada 50 minutos',
      'Ajuste definitivo do workstation',
      'Posição neutra de trabalho',
      'Avaliação do colchão e travesseiro',
    ],
    encaminhamentos: ['Avaliação ergonômica profissional do posto de trabalho'],
  },
  N: {
    intervencoes: [
      'Investigação de fatores viscerais/hormonais',
      'Monitoramento do ciclo menstrual (se aplicável)',
      'Atenção a sinais autonômicos',
    ],
    encaminhamentos: ['Avaliação médica para fatores sistêmicos ocultos'],
  },
  I: {
    intervencoes: [
      'Estabilizar rotina antes de progredir carga',
      'Adaptar novo equipamento gradualmente',
      'Evitar múltiplas mudanças simultâneas',
    ],
    encaminhamentos: [],
  },
};

// ── Phase generator ──
function gerarFases(myidScore: number, driverKey: string, perdas: Record<string, PerdaCalculada>): ClinicalPhase[] {
  const driverInterv = DRIVER_INTERVENTIONS[driverKey] || DRIVER_INTERVENTIONS['D'];
  const hasContextIssue = (perdas['C']?.perda_pontos || 0) >= 4;
  const hasRegulationIssue = (perdas['R']?.perda_pontos || 0) >= 5;
  const hasPainIssue = (perdas['D']?.perda_pontos || 0) >= 8;

  const fase1: ClinicalPhase = {
    fase: 1,
    titulo: 'Redução de Sobrecarga',
    semanas: 'Semanas 1–2',
    foco: 'Reduzir o driver primário e proteger o sistema',
    icone: '🛡️',
    metaMyID: `MyID +5–8 pts (meta: ${Math.min(100, myidScore + 8).toFixed(0)})`,
    intervencoes: [
      ...driverInterv.intervencoes.slice(0, 3),
      ...(hasPainIssue && driverKey !== 'D' ? ['Manejo da dor concomitante'] : []),
      ...(hasRegulationIssue && driverKey !== 'R' ? ['Higiene do sono: rotina fixa'] : []),
      'Educação em neurociência da dor (sessão 1)',
    ],
  };

  const fase2: ClinicalPhase = {
    fase: 2,
    titulo: 'Capacidade Física',
    semanas: 'Semanas 3–4',
    foco: 'Aumentar reserva funcional e capacidade musculoesquelética',
    icone: '💪',
    metaMyID: `MyID +10 pts (meta: ${Math.min(100, myidScore + 10).toFixed(0)})`,
    intervencoes: [
      'Exercícios de core e estabilização (3× semana)',
      'Caminhada progressiva (10→20→30 min/dia)',
      'Fortalecimento específico (conforme avaliação estrutural)',
      'Mobilidade articular sistêmica',
      'Retorno ao trabalho e lazer (se estava restrito)',
      ...(hasContextIssue ? ['Reestruturação gradual de contexto social'] : []),
    ],
  };

  const fase3: ClinicalPhase = {
    fase: 3,
    titulo: 'Prevenção e Consolidação',
    semanas: 'Semanas 5–6',
    foco: 'Criar hábitos sustentáveis e prevenir recidivas',
    icone: '🌱',
    metaMyID: `MyID +15–20 pts (meta: ${Math.min(100, myidScore + 20).toFixed(0)})`,
    intervencoes: [
      'Educação em neurociência da dor (2ª sessão)',
      'Reestruturação de crenças sobre dor e movimento',
      'Programa de exercícios domiciliares autônomo',
      'Hidratação (meta: 2L de água/dia)',
      'Nutrição: 2 porções de vegetais/dia, redução de ultraprocessados',
      'Ergonomia: ajuste definitivo do workstation',
    ],
  };

  return [fase1, fase2, fase3];
}

// ── Mission generator ──
function gerarMissoes(myidScore: number, driverKey: string, perdas: Record<string, PerdaCalculada>): ClinicalMission[] {
  const missoes: ClinicalMission[] = [];
  let id = 0;

  // Phase 1 missions (driver-focused)
  const driverLabel = DIMENSION_LABELS[driverKey] || driverKey;

  if (perdas['D']?.perda_pontos >= 8) {
    missoes.push({
      id: `m${++id}`, titulo: 'Respiração Terapêutica', dimensao: 'D', fase: 1, tipo: 'diaria', xp: 15,
      descricao: 'Pratique 5 min de respiração diafragmática (4-7-8) ao acordar e antes de dormir.',
      categoria: perdas['D'].perda_pontos >= 14 ? 'urgente' : 'importante',
    });
    missoes.push({
      id: `m${++id}`, titulo: 'Diário da Dor', dimensao: 'D', fase: 1, tipo: 'diaria', xp: 10,
      descricao: 'Registre no diário quando a dor piora e melhora — ajuda a identificar padrões.',
      categoria: 'importante',
    });
  }

  if (perdas['R']?.perda_pontos >= 5) {
    missoes.push({
      id: `m${++id}`, titulo: 'Ritual do Sono', dimensao: 'R', fase: 1, tipo: 'diaria', xp: 20,
      descricao: 'Desligue telas 1h antes de deitar e durma 30 min mais cedo esta noite.',
      categoria: perdas['R'].gatilho_critico ? 'urgente' : 'importante',
    });
  }

  if (perdas['P']?.perda_pontos >= 4) {
    missoes.push({
      id: `m${++id}`, titulo: 'Desafio da Coragem', dimensao: 'P', fase: 1, tipo: 'diaria', xp: 25,
      descricao: 'Faça UMA atividade que evita por medo da dor — com calma e sem pressa.',
      categoria: 'urgente',
    });
  }

  if (perdas['C']?.perda_pontos >= 4) {
    missoes.push({
      id: `m${++id}`, titulo: 'Válvula de Escape', dimensao: 'C', fase: 1, tipo: 'semanal', xp: 30,
      descricao: 'Identifique UMA fonte de estresse controlável e defina uma ação para reduzi-la.',
      categoria: 'importante',
    });
  }

  // Phase 2 missions (capacity building)
  missoes.push({
    id: `m${++id}`, titulo: 'Caminhada Progressiva', dimensao: 'AF', fase: 2, tipo: 'diaria', xp: 15,
    descricao: 'Comece com 10 min e aumente 5 min a cada 3 dias. Meta: 30 min/dia.',
    categoria: perdas['AF']?.perda_pontos >= 3 ? 'importante' : 'oportunidade',
  });

  missoes.push({
    id: `m${++id}`, titulo: 'Core e Estabilização', dimensao: 'AF', fase: 2, tipo: 'semanal', xp: 25,
    descricao: 'Exercícios de estabilização do core 3× semana conforme orientação do profissional.',
    categoria: 'importante',
  });

  if (perdas['EFI']?.perda_pontos >= 5) {
    missoes.push({
      id: `m${++id}`, titulo: 'Reconquista Funcional', dimensao: 'EFI', fase: 2, tipo: 'semanal', xp: 30,
      descricao: 'Retorne a UMA atividade de vida diária que estava evitando esta semana.',
      categoria: 'importante',
    });
  }

  // Phase 3 missions (consolidation)
  missoes.push({
    id: `m${++id}`, titulo: 'Hidratação Consistente', dimensao: 'HID', fase: 3, tipo: 'diaria', xp: 10,
    descricao: 'Beba ao menos 2L de água hoje. Meta: urina amarelo claro.',
    categoria: perdas['HID']?.perda_pontos >= 2 ? 'importante' : 'oportunidade',
  });

  missoes.push({
    id: `m${++id}`, titulo: 'Nutrição Anti-inflamatória', dimensao: 'NUT', fase: 3, tipo: 'diaria', xp: 10,
    descricao: 'Inclua 2 porções de vegetais hoje e evite ultraprocessados.',
    categoria: perdas['NUT']?.perda_pontos >= 2 ? 'importante' : 'oportunidade',
  });

  if (perdas['ERG']?.perda_pontos >= 2) {
    missoes.push({
      id: `m${++id}`, titulo: 'Micro-Pausas Ativas', dimensao: 'ERG', fase: 3, tipo: 'diaria', xp: 10,
      descricao: 'Faça micro-pausas a cada 50 min: levante, alongue ombros e pescoço por 2 min.',
      categoria: perdas['ERG'].gatilho_critico ? 'urgente' : 'oportunidade',
    });
  }

  // Milestone missions
  missoes.push({
    id: `m${++id}`, titulo: 'Marco: Primeira Semana Completa', dimensao: driverKey, fase: 1, tipo: 'marco', xp: 100,
    descricao: `Complete 7 dias seguidos cumprindo as missões da Fase 1. Meta: ${driverLabel} sob controle.`,
    categoria: 'consolidacao',
  });

  missoes.push({
    id: `m${++id}`, titulo: 'Marco: MyID +10 Pontos', dimensao: driverKey, fase: 2, tipo: 'marco', xp: 200,
    descricao: `Atinja MyID ${Math.min(100, myidScore + 10).toFixed(0)} na próxima reavaliação.`,
    categoria: 'consolidacao',
  });

  missoes.push({
    id: `m${++id}`, titulo: 'Marco: Autonomia Conquistada', dimensao: driverKey, fase: 3, tipo: 'marco', xp: 300,
    descricao: 'Mantenha programa de exercícios domiciliares por 2 semanas sem supervisão.',
    categoria: 'consolidacao',
  });

  return missoes;
}

// ── Main export ──
export function gerarInsightsClinicosMyID(scores: {
  D: number; EFI: number; P: number; I: number;
  R: number; C: number; AF: number; HID: number;
  NUT: number; ERG: number; N: number; MED?: number;
}, myidScore: number): ClinicalInsightResult {
  // Calculate all losses
  const perdas: Record<string, PerdaCalculada> = {};
  // Demand dimensions (high = bad)
  for (const dim of ['D', 'EFI', 'P', 'I', 'N']) {
    perdas[dim] = calcularPerdaDimensao(dim, scores[dim as keyof typeof scores] as number || 0);
  }
  // Capacity dimensions (high = good, loss = 10 - value)
  for (const dim of ['R', 'C', 'AF', 'HID', 'NUT', 'ERG']) {
    const raw = scores[dim as keyof typeof scores] as number || 0;
    perdas[dim] = calcularPerdaDimensao(dim, 10 - raw);
  }

  const driver = identificarDriver(perdas);
  const driverKey = driver?.dimensao || 'D';

  const classificacao = myidScore >= 85 ? 'EXCELENTE' :
    myidScore >= 70 ? 'BOM' :
    myidScore >= 50 ? 'MODERADO' : 'CRÍTICO';

  const driverInterv = DRIVER_INTERVENTIONS[driverKey] || DRIVER_INTERVENTIONS['D'];

  const driverInsight: DriverInsight = {
    driver: driverKey,
    driverLabel: DIMENSION_LABELS[driverKey] || driverKey,
    perda: driver?.perda_pontos || 0,
    intervencoes: driverInterv.intervencoes,
    encaminhamentos: driverInterv.encaminhamentos,
  };

  const fases = gerarFases(myidScore, driverKey, perdas);
  const missoes = gerarMissoes(myidScore, driverKey, perdas);

  return {
    classificacao: classificacao as ClinicalInsightResult['classificacao'],
    myidScore,
    driverInsight,
    fases,
    missoes,
    metaFinal: `MyID ${Math.min(100, myidScore + 20).toFixed(0)} em 6 semanas`,
  };
}
