// ============================================
// CIF - Classificação Internacional de Funcionalidade
// Mapeamento automático a partir de scores MyID + Avaliações Voz/Estrutural
// ============================================

export interface CIFCode {
  code: string;
  description: string;
  category: 'b' | 's' | 'd' | 'e';
  categoryLabel: string;
  qualifier: number; // 0-4 (0=sem problema, 1=leve, 2=moderado, 3=grave, 4=completo)
  source: 'myid' | 'voz' | 'estrutural' | 'combinado';
  dimension?: string;
  confidence: 'alta' | 'media' | 'baixa';
}

export interface CIFSuggestionResult {
  codes: CIFCode[];
  resumo: string;
  dataGerada: string;
  fontes: {
    myid: boolean;
    voz: boolean;
    estrutural: boolean;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  b: 'Funções do Corpo',
  s: 'Estruturas do Corpo',
  d: 'Atividades e Participação',
  e: 'Fatores Ambientais',
};

// Mapeia score 0-10 para qualificador CIF 0-4
function scoreToQualifier(score: number, inverted = false): number {
  const s = inverted ? 10 - score : score;
  if (s <= 1) return 0;
  if (s <= 3) return 1;
  if (s <= 5) return 2;
  if (s <= 7) return 3;
  return 4;
}

// Qualificador CIF baseado em percentual de perda (0-100 → 0-4)
function lossToQualifier(loss: number): number {
  if (loss <= 4) return 0;
  if (loss <= 24) return 1;
  if (loss <= 49) return 2;
  if (loss <= 95) return 3;
  return 4;
}

function qualifierLabel(q: number): string {
  const labels = ['Sem problema', 'Problema leve', 'Problema moderado', 'Problema grave', 'Problema completo'];
  return labels[Math.min(q, 4)];
}

// ── MAPEAMENTO POR DIMENSÃO MyID ──

function mapDor(scoreD: number): CIFCode[] {
  const q = scoreToQualifier(scoreD);
  if (q === 0) return [];
  const codes: CIFCode[] = [
    { code: 'b280', description: 'Sensação de dor', category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: q, source: 'myid', dimension: 'D', confidence: 'alta' },
    { code: 'b2801', description: 'Dor em parte do corpo', category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: q, source: 'myid', dimension: 'D', confidence: 'alta' },
  ];
  if (q >= 2) {
    codes.push({ code: 'b1342', description: 'Manutenção do sono', category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: Math.max(0, q - 1), source: 'myid', dimension: 'D', confidence: 'media' });
  }
  return codes;
}

function mapFuncionalidade(scoreEFI: number): CIFCode[] {
  const q = scoreToQualifier(scoreEFI);
  if (q === 0) return [];
  return [
    { code: 'd450', description: 'Andar', category: 'd', categoryLabel: CATEGORY_LABELS.d, qualifier: q, source: 'myid', dimension: 'EFI', confidence: 'alta' },
    { code: 'd410', description: 'Mudar a posição básica do corpo', category: 'd', categoryLabel: CATEGORY_LABELS.d, qualifier: q, source: 'myid', dimension: 'EFI', confidence: 'alta' },
    { code: 'd430', description: 'Levantar e transportar objetos', category: 'd', categoryLabel: CATEGORY_LABELS.d, qualifier: q, source: 'myid', dimension: 'EFI', confidence: 'media' },
    { code: 'd445', description: 'Utilização da mão e do braço', category: 'd', categoryLabel: CATEGORY_LABELS.d, qualifier: Math.max(0, q - 1), source: 'myid', dimension: 'EFI', confidence: 'media' },
    { code: 'd850', description: 'Trabalho remunerado', category: 'd', categoryLabel: CATEGORY_LABELS.d, qualifier: q, source: 'myid', dimension: 'EFI', confidence: 'media' },
    { code: 'd920', description: 'Recreação e lazer', category: 'd', categoryLabel: CATEGORY_LABELS.d, qualifier: Math.max(0, q - 1), source: 'myid', dimension: 'EFI', confidence: 'media' },
  ];
}

function mapPsicologico(scoreP: number): CIFCode[] {
  const q = scoreToQualifier(scoreP);
  if (q === 0) return [];
  return [
    { code: 'b152', description: 'Funções emocionais', category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: q, source: 'myid', dimension: 'P', confidence: 'alta' },
    { code: 'b130', description: 'Funções da energia e dos impulsos', category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: Math.max(0, q - 1), source: 'myid', dimension: 'P', confidence: 'media' },
    { code: 'b164', description: 'Funções cognitivas de nível superior', category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: Math.max(0, q - 1), source: 'myid', dimension: 'P', confidence: 'media' },
  ];
  
}

function mapRegulacao(scoreR: number): CIFCode[] {
  const q = scoreToQualifier(scoreR, true); // R is capacity (10=good), invert
  if (q === 0) return [];
  return [
    { code: 'b134', description: 'Funções do sono', category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: q, source: 'myid', dimension: 'R', confidence: 'alta' },
    { code: 'b1300', description: 'Nível de energia', category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: q, source: 'myid', dimension: 'R', confidence: 'alta' },
    { code: 'b455', description: 'Funções de tolerância ao exercício', category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: Math.max(0, q - 1), source: 'myid', dimension: 'R', confidence: 'media' },
  ];
}

function mapContexto(scoreC: number): CIFCode[] {
  const q = scoreToQualifier(scoreC, true);
  if (q === 0) return [];
  return [
    { code: 'e310', description: 'Família imediata', category: 'e', categoryLabel: CATEGORY_LABELS.e, qualifier: q, source: 'myid', dimension: 'C', confidence: 'media' },
    { code: 'e580', description: 'Serviços, sistemas e políticas de saúde', category: 'e', categoryLabel: CATEGORY_LABELS.e, qualifier: Math.max(0, q - 1), source: 'myid', dimension: 'C', confidence: 'baixa' },
  ];
}

function mapAtividadeFisica(scoreAF: number): CIFCode[] {
  const q = scoreToQualifier(scoreAF, true);
  if (q === 0) return [];
  return [
    { code: 'd570', description: 'Cuidar da própria saúde', category: 'd', categoryLabel: CATEGORY_LABELS.d, qualifier: q, source: 'myid', dimension: 'AF', confidence: 'media' },
    { code: 'd920', description: 'Recreação e lazer (atividade física)', category: 'd', categoryLabel: CATEGORY_LABELS.d, qualifier: q, source: 'myid', dimension: 'AF', confidence: 'media' },
  ];
}

function mapErgonomia(scoreERG: number): CIFCode[] {
  const q = scoreToQualifier(scoreERG, true);
  if (q === 0) return [];
  return [
    { code: 'e135', description: 'Produtos e tecnologias para o trabalho', category: 'e', categoryLabel: CATEGORY_LABELS.e, qualifier: q, source: 'myid', dimension: 'ERG', confidence: 'media' },
    { code: 'd845', description: 'Obter, manter e sair de um emprego', category: 'd', categoryLabel: CATEGORY_LABELS.d, qualifier: Math.max(0, q - 1), source: 'myid', dimension: 'ERG', confidence: 'baixa' },
  ];
}

function mapMobilidade(scoreI: number): CIFCode[] {
  const q = scoreToQualifier(scoreI);
  if (q === 0) return [];
  return [
    { code: 'b710', description: 'Funções da mobilidade das articulações', category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: q, source: 'myid', dimension: 'I', confidence: 'alta' },
    { code: 'b730', description: 'Funções da força muscular', category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: Math.max(0, q - 1), source: 'myid', dimension: 'I', confidence: 'media' },
  ];
}

// ── MAPEAMENTO AVALIAÇÃO POR VOZ ──

function mapVoiceAssessment(voiceResult: any): CIFCode[] {
  if (!voiceResult) return [];
  const codes: CIFCode[] = [];
  const resultado = voiceResult.resultado || voiceResult;

  // Extrair severidade
  const severidade = voiceResult.classificacao_severidade || resultado?.classificacao_severidade || '';
  const sevMap: Record<string, number> = { 'Favorável': 0, 'Atenção': 1, 'Moderado': 2, 'Severo': 3, 'Risco de Cronificação': 4 };
  const baseQ = sevMap[severidade] ?? 1;

  // Queixa principal → Dor
  if (resultado?.queixa_principal || voiceResult.queixa_principal) {
    codes.push({ code: 'b280', description: 'Sensação de dor (avaliação clínica)', category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: baseQ, source: 'voz', confidence: 'alta' });
  }

  // Scores extraídos da voz
  const scores = resultado?.scores || resultado?.component_scores || {};
  if (scores.estrutural != null && scores.estrutural > 3) {
    codes.push({ code: 'b710', description: 'Mobilidade articular (achado clínico)', category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: scoreToQualifier(scores.estrutural), source: 'voz', confidence: 'media' });
    codes.push({ code: 'b730', description: 'Força muscular (achado clínico)', category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: scoreToQualifier(scores.estrutural), source: 'voz', confidence: 'media' });
  }
  if (scores.psicologico != null && scores.psicologico > 3) {
    codes.push({ code: 'b152', description: 'Funções emocionais (achado clínico)', category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: scoreToQualifier(scores.psicologico), source: 'voz', confidence: 'media' });
  }
  if (scores.funcionalidade != null && scores.funcionalidade > 3) {
    codes.push({ code: 'd450', description: 'Andar (achado clínico)', category: 'd', categoryLabel: CATEGORY_LABELS.d, qualifier: scoreToQualifier(scores.funcionalidade), source: 'voz', confidence: 'media' });
  }

  // Regiões anatômicas → Estruturas do corpo
  const regioes = resultado?.regioes_afetadas || resultado?.regioes || [];
  const regiaoToStructure: Record<string, { code: string; desc: string }> = {
    'coluna': { code: 's760', desc: 'Estrutura do tronco' },
    'lombar': { code: 's76002', desc: 'Região lombar' },
    'cervical': { code: 's7600', desc: 'Região cervical' },
    'torácica': { code: 's76001', desc: 'Região torácica' },
    'ombro': { code: 's720', desc: 'Estrutura da região do ombro' },
    'joelho': { code: 's750', desc: 'Estrutura da extremidade inferior' },
    'quadril': { code: 's740', desc: 'Estrutura da região pélvica' },
    'tornozelo': { code: 's7502', desc: 'Estrutura da articulação do tornozelo' },
    'punho': { code: 's7301', desc: 'Estrutura do punho' },
    'mão': { code: 's730', desc: 'Estrutura da extremidade superior' },
  };

  for (const regiao of regioes) {
    const lower = (typeof regiao === 'string' ? regiao : regiao.nome || '').toLowerCase();
    for (const [key, val] of Object.entries(regiaoToStructure)) {
      if (lower.includes(key)) {
        codes.push({ code: val.code, description: val.desc, category: 's', categoryLabel: CATEGORY_LABELS.s, qualifier: baseQ, source: 'voz', confidence: 'media' });
      }
    }
  }

  return codes;
}

// ── MAPEAMENTO AVALIAÇÃO ESTRUTURAL ──

function mapStructuralAssessment(structuralData: any): CIFCode[] {
  if (!structuralData) return [];
  const codes: CIFCode[] = [];
  const units: any[] = structuralData.units || structuralData.unidades || [];

  const unitToStructure: Record<string, { code: string; desc: string }> = {
    'cervical': { code: 's7600', desc: 'Região cervical' },
    'torácica': { code: 's76001', desc: 'Região torácica' },
    'toracica': { code: 's76001', desc: 'Região torácica' },
    'lombar': { code: 's76002', desc: 'Região lombar' },
    'sacroilíaca': { code: 's74000', desc: 'Articulação sacroilíaca' },
    'sacroiliaca': { code: 's74000', desc: 'Articulação sacroilíaca' },
    'quadril': { code: 's740', desc: 'Estrutura da região pélvica' },
    'joelho': { code: 's750', desc: 'Estrutura da extremidade inferior' },
    'tornozelo': { code: 's7502', desc: 'Articulação do tornozelo e pé' },
    'ombro': { code: 's720', desc: 'Estrutura do ombro' },
    'cotovelo': { code: 's7300', desc: 'Articulação do cotovelo' },
    'punho': { code: 's7301', desc: 'Articulação do punho e mão' },
    'atm': { code: 's710', desc: 'Estrutura da cabeça e pescoço' },
  };

  for (const unit of units) {
    const id = (unit.unitId || unit.id || '').toLowerCase();
    const score = unit.score || 0;
    if (score <= 1) continue;

    const q = scoreToQualifier(score);

    // Map unit to structure code
    for (const [key, val] of Object.entries(unitToStructure)) {
      if (id.includes(key)) {
        codes.push({ code: val.code, description: val.desc, category: 's', categoryLabel: CATEGORY_LABELS.s, qualifier: q, source: 'estrutural', confidence: 'alta' });
        break;
      }
    }

    // Affected structures within each unit
    const structures = unit.affectedStructures || {};
    if (structures.muscles?.length > 0) {
      codes.push({ code: 'b730', description: `Força muscular — ${id}`, category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: q, source: 'estrutural', confidence: 'alta' });
    }
    if (structures.joints?.length > 0) {
      codes.push({ code: 'b710', description: `Mobilidade articular — ${id}`, category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: q, source: 'estrutural', confidence: 'alta' });
    }
    if (structures.ligaments?.length > 0) {
      codes.push({ code: 'b715', description: `Estabilidade articular — ${id}`, category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: q, source: 'estrutural', confidence: 'alta' });
    }
    if (structures.nerves?.length > 0) {
      codes.push({ code: 'b265', description: `Função tátil — ${id}`, category: 'b', categoryLabel: CATEGORY_LABELS.b, qualifier: q, source: 'estrutural', confidence: 'media' });
    }
  }

  return codes;
}

// ── DEDUPLICATE AND CONSOLIDATE ──

function consolidateCodes(allCodes: CIFCode[]): CIFCode[] {
  const map = new Map<string, CIFCode>();
  for (const c of allCodes) {
    const existing = map.get(c.code);
    if (!existing || c.qualifier > existing.qualifier || (c.qualifier === existing.qualifier && c.confidence === 'alta')) {
      // Merge source
      if (existing && existing.source !== c.source) {
        map.set(c.code, { ...c, source: 'combinado', confidence: 'alta' });
      } else {
        map.set(c.code, c);
      }
    }
  }
  return Array.from(map.values())
    .filter(c => c.qualifier > 0)
    .sort((a, b) => {
      const catOrder = ['b', 's', 'd', 'e'];
      const catDiff = catOrder.indexOf(a.category) - catOrder.indexOf(b.category);
      if (catDiff !== 0) return catDiff;
      return b.qualifier - a.qualifier;
    });
}

// ── MAIN FUNCTION ──

export function generateCIFSuggestions(
  myidResult: any | null,
  voiceAssessment: any | null,
  structuralAssessment: any | null,
): CIFSuggestionResult {
  const allCodes: CIFCode[] = [];

  const hasMyID = !!myidResult;
  const hasVoz = !!voiceAssessment;
  const hasEstrutural = !!structuralAssessment;

  // MyID dimension scores
  if (myidResult) {
    const scores = myidResult.component_scores || myidResult.componentScores || {};
    allCodes.push(...mapDor(scores.D ?? scores.D_pain ?? 0));
    allCodes.push(...mapFuncionalidade(scores.EFI ?? scores.EFI_functionality ?? 0));
    allCodes.push(...mapPsicologico(scores.P ?? scores.P_psychological ?? 0));
    allCodes.push(...mapRegulacao(scores.R ?? scores.R_regulation ?? 0));
    allCodes.push(...mapContexto(scores.C ?? scores.C_context ?? 0));
    allCodes.push(...mapAtividadeFisica(scores.AF ?? scores.AF_activity ?? 0));
    allCodes.push(...mapErgonomia(scores.ERG ?? scores.ERG_ergonomics ?? 0));
    allCodes.push(...mapMobilidade(scores.I ?? scores.I_inertia ?? 0));
  }

  // Voice assessment
  if (voiceAssessment) {
    allCodes.push(...mapVoiceAssessment(voiceAssessment));
  }

  // Structural assessment
  if (structuralAssessment) {
    allCodes.push(...mapStructuralAssessment(structuralAssessment));
  }

  const codes = consolidateCodes(allCodes);

  const fontesList: string[] = [];
  if (hasMyID) fontesList.push('MyID');
  if (hasVoz) fontesList.push('Avaliação por Voz');
  if (hasEstrutural) fontesList.push('Avaliação Estrutural');

  return {
    codes,
    resumo: `${codes.length} códigos CIF sugeridos a partir de ${fontesList.join(', ')}.`,
    dataGerada: new Date().toISOString(),
    fontes: { myid: hasMyID, voz: hasVoz, estrutural: hasEstrutural },
  };
}

export { qualifierLabel, CATEGORY_LABELS };
