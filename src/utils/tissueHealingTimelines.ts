// ═══════════════════════════════════════════════════════════════
// EVIDENCE-BASED TISSUE HEALING TIMELINES
// Based on: Magee (2014), Houglum (2016), Khan & Scott (2009),
// Leadbetter (1992), Järvinen et al. (2005), Woo et al. (1999)
// ═══════════════════════════════════════════════════════════════

export interface TissueTimeline {
  tissue: string;
  category: 'muscular' | 'articular' | 'ligamentar' | 'neural' | 'cartilaginosa' | 'tendínea' | 'fascial';
  minWeeks: number;
  maxWeeks: number;
  phases: {
    name: string;
    weeks: string;
    description: string;
  }[];
  evidenceNote: string;
  patientMessage: string;
  icon: string;
  color: string;
}

export const TISSUE_TIMELINES: Record<string, TissueTimeline> = {
  muscular: {
    tissue: 'Fibra Muscular',
    category: 'muscular',
    minWeeks: 3,
    maxWeeks: 8,
    phases: [
      { name: 'Inflamação', weeks: '0-1', description: 'Resposta inflamatória aguda com formação de hematoma e migração celular.' },
      { name: 'Proliferação', weeks: '1-3', description: 'Formação de tecido de granulação e início da regeneração das fibras.' },
      { name: 'Remodelação', weeks: '3-8', description: 'Maturação do colágeno e restauração da arquitetura muscular funcional.' },
    ],
    evidenceNote: 'Järvinen et al. (2005) — Muscle injuries heal relatively fast due to high vascularization. Full return to function typically 3-8 weeks depending on grade.',
    patientMessage: 'Músculos são os tecidos que se recuperam mais rápido! Com boa vascularização, suas fibras musculares podem se regenerar em 3-8 semanas. O segredo é respeitar cada fase: não forçar no início, mas progredir de forma consistente.',
    icon: '💪',
    color: 'emerald',
  },
  tendínea: {
    tissue: 'Tendão',
    category: 'tendínea',
    minWeeks: 6,
    maxWeeks: 26,
    phases: [
      { name: 'Reativa', weeks: '0-2', description: 'Espessamento adaptativo do tendão com aumento de proteoglicanos.' },
      { name: 'Desestruturação', weeks: '2-8', description: 'Remodelamento da matriz com tentativa de reparo tecidual.' },
      { name: 'Remodelação', weeks: '8-26', description: 'Realinhamento das fibras colágenas e restauração da resistência mecânica.' },
    ],
    evidenceNote: 'Cook & Purdam (2009) — Tendons have limited blood supply and require progressive loading for optimal collagen alignment. The continuum model emphasizes load management.',
    patientMessage: 'Tendões precisam de mais paciência que músculos. Com menor irrigação sanguínea, o reparo leva de 6 a 26 semanas. A boa notícia: exercícios de carga progressiva são a melhor evidência para recuperação tendinosa — cada sessão conta!',
    icon: '🔗',
    color: 'amber',
  },
  ligamentar: {
    tissue: 'Ligamento',
    category: 'ligamentar',
    minWeeks: 6,
    maxWeeks: 52,
    phases: [
      { name: 'Inflamação', weeks: '0-3', description: 'Fase hemorrágica e inflamatória com recrutamento de fibroblastos.' },
      { name: 'Proliferação', weeks: '3-8', description: 'Síntese desordenada de colágeno tipo III para tamponamento estrutural.' },
      { name: 'Remodelação', weeks: '8-52', description: 'Substituição gradual por colágeno tipo I e recuperação de resistência (nunca atinge 100% da original).' },
    ],
    evidenceNote: 'Woo et al. (1999) — Ligaments heal with inferior biomechanical properties. Even after 1 year, healed ligament reaches only 50-70% of original tensile strength.',
    patientMessage: '⚠️ Ligamentos são estruturas que exigem respeito ao tempo biológico. A recuperação leva de 6 semanas a 1 ano, e mesmo após cicatrizado, o ligamento atinge apenas 50-70% da resistência original. Por isso, o fortalecimento muscular ao redor é fundamental — seus músculos se tornam os "novos ligamentos"!',
    icon: '🛡️',
    color: 'orange',
  },
  articular: {
    tissue: 'Cartilagem Articular',
    category: 'cartilaginosa',
    minWeeks: 12,
    maxWeeks: 104,
    phases: [
      { name: 'Resposta Inicial', weeks: '0-4', description: 'Mínima resposta inflamatória devido à avascularidade do tecido.' },
      { name: 'Reparo Fibrocartilaginoso', weeks: '4-24', description: 'Formação de fibrocartilagem (inferior à cartilagem hialina original).' },
      { name: 'Maturação', weeks: '24-104', description: 'Integração e adaptação funcional do tecido reparado (quando possível).' },
    ],
    evidenceNote: 'Buckwalter & Mankin (1998) — Articular cartilage has virtually no intrinsic healing capacity due to avascularity. Repair tissue is biomechanically inferior. Minimum 3-6 months for any meaningful recovery.',
    patientMessage: '🔴 Cartilagem articular é o tecido que mais demanda paciência. Sem vasos sanguíneos próprios, a recuperação é lenta: mínimo de 3 meses, podendo chegar a 2 anos. Cada sessão de reabilitação é um investimento — a cartilagem responde a estímulos mecânicos controlados, mas no tempo dela. NÃO EXISTE ATALHO para a biologia.',
    icon: '🦴',
    color: 'red',
  },
  neural: {
    tissue: 'Nervo Periférico',
    category: 'neural',
    minWeeks: 4,
    maxWeeks: 52,
    phases: [
      { name: 'Degeneração Walleriana', weeks: '0-2', description: 'Degeneração distal ao local da lesão e limpeza dos debris.' },
      { name: 'Regeneração Axonal', weeks: '2-12', description: 'Crescimento axonal a ~1mm/dia (1 polegada/mês).' },
      { name: 'Reinervação', weeks: '12-52', description: 'Reconexão às placas motoras e reeducação neuromuscular.' },
    ],
    evidenceNote: 'Sunderland Classification — Nerve regeneration occurs at ~1mm/day. Recovery depends on distance to target organ and grade of injury (neurapraxia to neurotmesis).',
    patientMessage: 'Nervos se regeneram lentamente — cerca de 1mm por dia. Dependendo da distância da lesão ao órgão-alvo, a recuperação pode levar de 1 a 12 meses. A mobilização neural suave e a reeducação sensorial são fundamentais neste processo.',
    icon: '⚡',
    color: 'purple',
  },
  fascial: {
    tissue: 'Fáscia / Tecido Conjuntivo',
    category: 'fascial',
    minWeeks: 4,
    maxWeeks: 16,
    phases: [
      { name: 'Inflamação', weeks: '0-1', description: 'Resposta inflamatória local com edema fascial.' },
      { name: 'Fibroplasia', weeks: '1-6', description: 'Deposição de colágeno e reorganização da matriz fascial.' },
      { name: 'Remodelação', weeks: '6-16', description: 'Alinhamento das fibras colágenas conforme linhas de tensão.' },
    ],
    evidenceNote: 'Langevin (2006) — Fascia responds to mechanical stimulation (stretching, manual therapy). Remodeling follows Wolff\'s law applied to soft tissue.',
    patientMessage: 'A fáscia é como uma "rede" que conecta todo seu corpo. Sua recuperação leva de 4 a 16 semanas e responde muito bem a mobilizações e exercícios de flexibilidade. A consistência do tratamento é o principal fator de sucesso.',
    icon: '🕸️',
    color: 'blue',
  },
};

// ── Analyze affected structures and generate engagement insights ──

export interface RehabInsight {
  tissue: string;
  category: string;
  minWeeks: number;
  maxWeeks: number;
  structures: string[];
  severity: string;
  unitId: string;
  patientMessage: string;
  evidenceNote: string;
  icon: string;
  color: string;
  phases: TissueTimeline['phases'];
}

export function generateRehabInsights(
  units: Record<string, import('@/types/structural').UnitAssessment>
): RehabInsight[] {
  const insights: RehabInsight[] = [];
  const seen = new Set<string>();

  Object.entries(units).forEach(([unitId, unit]) => {
    if (!unit || unit.score === 0) return;

    const structureMap: Array<{ type: string; key: keyof typeof TISSUE_TIMELINES; items: import('@/types/structural').AffectedStructure[] }> = [
      { type: 'Muscular', key: 'muscular', items: unit.affectedStructures.muscles },
      { type: 'Articular', key: 'articular', items: unit.affectedStructures.joints },
      { type: 'Ligamentar', key: 'ligamentar', items: unit.affectedStructures.ligaments },
      { type: 'Neural', key: 'neural', items: unit.affectedStructures.nerves },
    ];

    structureMap.forEach(({ type, key, items }) => {
      const affectedItems = items.filter(s => s.severity && s.severity !== 'LEVE' || s.finding);
      if (affectedItems.length === 0) return;

      const dedupKey = `${key}-${unitId}`;
      if (seen.has(dedupKey)) return;
      seen.add(dedupKey);

      const timeline = TISSUE_TIMELINES[key];
      if (!timeline) return;

      // Adjust timeline based on severity
      const maxSeverity = affectedItems.some(s => s.severity === 'SEVERA') ? 'SEVERA'
        : affectedItems.some(s => s.severity === 'MODERADA') ? 'MODERADA' : 'LEVE';

      const severityMultiplier = maxSeverity === 'SEVERA' ? 1.5 : maxSeverity === 'MODERADA' ? 1.2 : 1.0;

      insights.push({
        tissue: timeline.tissue,
        category: type,
        minWeeks: Math.round(timeline.minWeeks * severityMultiplier),
        maxWeeks: Math.round(timeline.maxWeeks * severityMultiplier),
        structures: affectedItems.map(s => s.name),
        severity: maxSeverity,
        unitId,
        patientMessage: timeline.patientMessage,
        evidenceNote: timeline.evidenceNote,
        icon: timeline.icon,
        color: timeline.color,
        phases: timeline.phases,
      });
    });
  });

  // Sort by longest recovery first
  insights.sort((a, b) => b.maxWeeks - a.maxWeeks);

  return insights;
}

export function generateEngagementSummary(insights: RehabInsight[]): string {
  if (insights.length === 0) return '';

  const longestRecovery = insights[0];
  const shortestRecovery = insights[insights.length - 1];
  const hasArticular = insights.some(i => i.category === 'Articular');
  const hasLigamentar = insights.some(i => i.category === 'Ligamentar');

  let summary = `📊 TEMPO ESTIMADO DE REABILITAÇÃO BASEADO EM EVIDÊNCIA\n\n`;

  if (hasArticular || hasLigamentar) {
    summary += `⚠️ ATENÇÃO: Estruturas articulares/ligamentares identificadas. Estes tecidos têm tempos de cicatrização significativamente maiores que tecidos musculares. NÃO confunda o alívio dos sintomas com a cura do tecido — o processo biológico continua mesmo quando a dor diminui.\n\n`;
  }

  summary += `🕐 Tempo mínimo estimado: ${longestRecovery.minWeeks} semanas\n`;
  summary += `🕐 Tempo máximo estimado: ${longestRecovery.maxWeeks} semanas\n\n`;

  summary += `📋 TECIDOS IDENTIFICADOS:\n`;
  insights.forEach(i => {
    summary += `${i.icon} ${i.tissue} (${i.severity}): ${i.minWeeks}-${i.maxWeeks} semanas\n`;
    summary += `   Estruturas: ${i.structures.join(', ')}\n`;
    summary += `   📖 ${i.evidenceNote}\n\n`;
  });

  summary += `\n💡 MENSAGEM PARA O PACIENTE:\nA reabilitação é um investimento no seu corpo. Cada tecido tem seu próprio relógio biológico — respeitar esse tempo é a diferença entre uma recuperação completa e uma recidiva.\n`;

  return summary;
}
