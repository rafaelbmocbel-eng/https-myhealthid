// ═══════════════════════════════════════════════════════════
// Motor de Cálculo MyID v2
// Fórmula: MyID = [(D + EFI) × (1 + P/10) + P + I] / [(R + C + AF + HID + NUT + ERG) - N - MED]
// ═══════════════════════════════════════════════════════════

import type {
  MyIDBloco1Data, MyIDBloco2Data, MyIDBloco3Data,
  MyIDBloco4Data, MyIDBloco5Data, MyIDBloco6Data,
  MyIDResult, RedFlags, FingerprintRing,
} from '@/types/myid';

// ── Score I (Inércia - Gatilho de Mudança) ──
// Contagem de SIMs × 2, max 8, normalizado 0-10
export function calcularScoreI(bloco1: MyIDBloco1Data): number {
  const mudancasReais = bloco1.mudancasRecentes.filter(
    m => m !== 'Nenhuma mudança que eu note'
  );
  const iRaw = Math.min(mudancasReais.length * 2, 8);
  return Math.round((iRaw / 8) * 100) / 10; // 0-10
}

// ── Score D (Dor) ──
// D = [(Intensidade_Atual + Intensidade_Max) / 2]
export function calcularScoreD_MyID(bloco2: MyIDBloco2Data): number {
  if (bloco2.regioes.length === 0) return 0;
  const somas = bloco2.regioes.reduce(
    (acc, r) => ({
      atual: acc.atual + r.intensidadeAtual,
      max: acc.max + r.intensidadeMaxima,
    }),
    { atual: 0, max: 0 }
  );
  const media = (somas.atual + somas.max) / (2 * bloco2.regioes.length);
  return Math.min(10, Math.round(media * 10) / 10);
}

// ── Red Flags Check ──
export function checkRedFlags(flags: RedFlags): { detected: boolean; alerts: string[] } {
  const alerts: string[] = [];
  if (flags.perdaPeso) alerts.push('Perda de peso não intencional → Possível Malignidade');
  if (flags.febreCalafrios) alerts.push('Febre + Calafrios → Possível Infecção Sistêmica');
  if (flags.dorNoturnaImpedeSono) alerts.push('Dor noturna progressiva → Possível Inflamação');
  if (flags.alteracaoEsfincteriana) alerts.push('Alteração esfincteriana → Possível Compressão Medular');
  if (flags.dorPioraConsistente) alerts.push('Dor piora consistentemente → Investigar causa progressiva');
  if (flags.dormenciaProgressiva) alerts.push('Dormência/formigamento progressivo → Investigar componente neural');
  return { detected: alerts.length > 0, alerts };
}

// ── Score EFI (Funcionalidade) ──
export function calcularScoreEFI_MyID(bloco3: MyIDBloco3Data): number {
  const raw = (bloco3.trabalho + bloco3.domesticas + bloco3.exercicio + bloco3.independencia + bloco3.vidaSocial) / 5;
  return Math.round(raw * 10) / 10;
}

// ── Score P (Psicológico) ──
// Medo(1-4) + Catastrofização(1-4) + Evitação(1-4) → normalizar 1-4 para 0-10
// Autoeficácia: invertida (10 - valor)
export function calcularScoreP_MyID(bloco4: MyIDBloco4Data): number {
  const normalize14 = (v: number) => ((v - 1) / 3) * 10; // 1→0, 4→10
  const medo = normalize14(bloco4.medoMovimento);
  const catast = normalize14(bloco4.catastrofizacao);
  const evit = normalize14(bloco4.evitacao);
  const autoEfInv = 10 - bloco4.autoeficacia;
  const raw = (medo + catast + evit + autoEfInv) / 4;
  return Math.min(10, Math.max(0, Math.round(raw * 10) / 10));
}

// ── Score R (Regulação - Capacidade de Suporte) ──
// R alto = BOM (capacidade). Fórmula do doc:
// R = [(Sono_Qualidade + (Horas_Sono×1.25 limitado a 10) + (10-Fadiga) + (10-Estresse) + (10-Ansiedade) + Controle_Saúde) / 6]
export function calcularScoreR_MyID(bloco5: MyIDBloco5Data): { r: number; r1: number; r2: number; r3: number; c: number } {
  // R1 - Sono
  const horasSonoNorm = Math.min(bloco5.horasSono * 1.25, 10);
  const acordaMap: Record<string, number> = { nunca: 0, raramente: 2, frequentemente: 5, sempre: 8 };
  const acordaPenalty = acordaMap[bloco5.acordaPorDor] ?? 0;
  const r1 = Math.max(0, (bloco5.qualidadeSono + horasSonoNorm - acordaPenalty) / 2);

  // R2 - Energia
  const exaustoMap: Record<string, number> = { nunca: 0, as_vezes: 3, frequentemente: 6, sempre: 9 };
  const exaustoPenalty = exaustoMap[bloco5.exaustoAoAcordar] ?? 0;
  const r2 = Math.max(0, (10 - bloco5.fadiga + (10 - exaustoPenalty)) / 2);

  // R3 - Psicológico
  const controleMap: Record<string, number> = { muito: 9, moderado: 6, pouco: 3, sem: 0 };
  const controleVal = controleMap[bloco5.controleSaude] ?? 5;
  const r3 = ((10 - bloco5.estresse) + (10 - bloco5.ansiedade) + controleVal) / 3;

  // R total
  const r = Math.min(10, Math.max(0, Math.round(((r1 + r2 + r3) / 3) * 10) / 10));

  // C - Contexto (invertido: alto = bom suporte)
  const c = Math.round(((10 - bloco5.trabalhoEstressante) + (10 - bloco5.conflitosFamiliares) + (10 - bloco5.preocupacaoFinanceira)) / 3 * 10) / 10;

  return {
    r: Math.min(10, Math.max(0, r)),
    r1: Math.min(10, Math.max(0, Math.round(r1 * 10) / 10)),
    r2: Math.min(10, Math.max(0, Math.round(r2 * 10) / 10)),
    r3: Math.min(10, Math.max(0, Math.round(r3 * 10) / 10)),
    c: Math.min(10, Math.max(0, c)),
  };
}

// ── Score N (Ruído Sistêmico) ──
export function calcularScoreN(bloco6: MyIDBloco6Data): number {
  let nTotal = 0;
  if (bloco6.traumaAxial) nTotal += 2;
  if (bloco6.cicatrizAbdominal) nTotal += 1.5;

  const sinaisReais = bloco6.sinaisAutonomicos.filter(s => s !== 'Nenhum desses');
  nTotal += sinaisReais.length * 1.5;

  if (bloco6.diagnosticoFeminino === 'endometriose') nTotal += 3;
  else if (bloco6.diagnosticoFeminino === 'pcos') nTotal += 2;
  else if (bloco6.diagnosticoFeminino === 'ambas') nTotal += 4;

  return Math.min(10, Math.round((nTotal / 8) * 100) / 10);
}

// ═══════════════════════════════════════════════════════════
// FÓRMULA FINAL: MyID = [(D + EFI) × (1 + P/10) + P + I] / [(R + C + AF + HID + NUT + ERG) - N - MED]
// ═══════════════════════════════════════════════════════════

export interface Interpretation {
  status: string;
  label: string;
  color: string;
  recommendation: string;
  isRedFlagElevated?: boolean;
}

export function getMyIDInterpretation(score: number, hasRedFlags: boolean = false): Interpretation {
  const val = score ?? 0;
  let interp: Interpretation;

  // Ajuste de thresholds para maior sensibilidade (conforme myid_fix_plan.md)
  if (val < 1.3) {
    interp = {
      status: 'LEVE',
      label: 'Frequência Favorável',
      color: '#8b5cf6', // Violet
      recommendation: 'Sua biologia está em excelente estado de equilíbrio. Continue com os bons hábitos.'
    };
  } else if (val < 3.0) {
    interp = {
      status: 'MODERADO',
      label: 'Sobrecarga Moderada',
      color: '#3b82f6', // Blue
      recommendation: 'Sua demanda está começando a superar sua capacidade. Ajuste o sono e a hidratação.'
    };
  } else if (val < 5.0) {
    interp = {
      status: 'SEVERO',
      label: 'Desequilíbrio Severo',
      color: '#f59e0b', // Amber/Orange
      recommendation: 'Alerta: Seu sistema está operando no limite. Redução imediata de carga é recomendada.'
    };
  } else if (val < 7.5) {
    interp = {
      status: 'CRÍTICO',
      label: 'Risco de Cronificação',
      color: '#ef4444', // Red
      recommendation: 'SITUAÇÃO CRÍTICA - Intervenção multidisciplinar altamente recomendada.'
    };
  } else {
    interp = {
      status: 'EXTREMO',
      label: 'Probabilidade de Cronicidade',
      color: '#7f1d1d', // Deep Red
      recommendation: 'CRÍTICO: Alta probabilidade de falha sistêmica e dor persistente. Intervenção urgente.'
    };
  }

  // --- ELEVAÇÃO POR RED FLAGS ---
  if (hasRedFlags) {
    const severityOrder = ['LEVE', 'MODERADO', 'SEVERO', 'CRÍTICO', 'EXTREMO'];
    const currentIdx = severityOrder.indexOf(interp.status);
    const minIdx = severityOrder.indexOf('SEVERO');

    if (currentIdx < minIdx) {
      return {
        status: 'SEVERO',
        label: `${interp.label} (ALERTA)`,
        color: '#f59e0b',
        recommendation: 'NOTA: Embora o score numérico seja baixo, foram detectados sinais de alerta (Red Flags) que exigem atenção profissional.',
        isRedFlagElevated: true
      };
    } else {
      return {
        ...interp,
        label: `${interp.label} (RED FLAG)`,
        recommendation: `ATENÇÃO: Este estado (${interp.status}) agravado por Red Flags exige avaliação médica imediata.`
      };
    }
  }

  return interp;
}

export function calcularMyID(
  d: number, efi: number, p: number, i: number,
  r: number, c: number, n: number,
  af: number = 5, hid: number = 7, nut: number = 7, erg: number = 7, med: number = 0
): MyIDResult {
  const numerador = ((d + efi) * (1 + p / 10)) + p + i;
  const denominador = Math.max(0.5, (r + c + af + hid + nut + erg) - n - med);
  const myidRaw = numerador / denominador;
  const myidScore = Math.min(10, Math.max(0, Math.round(myidRaw * 10) / 10));

  const interp = getMyIDInterpretation(myidScore);

  return {
    myidScore,
    myidStatus: interp.label,
    componentScores: { D: d, EFI: efi, P: p, I: i, R: r, C: c, N: n, AF: af, HID: hid, NUT: nut, ERG: erg },
    redFlagsDetected: false,
    redFlagAlerts: [],
    classificacao: interp.status,
  };
}

// ── Thermal Color Scale Helper ──
// Color scale: violet (good) → blue → orange → red (bad)
// High value = Hot/Bad for Demands
export function getThermalColor(v: number): string {
  const val = Math.max(0, Math.min(10, v));
  // Same scale as MyIDFingerprint to ensure consistency
  if (val <= 1) return 'hsl(270, 60%, 75%)';   // Light Violet (Safe)
  if (val <= 2.5) return 'hsl(260, 65%, 65%)'; // Violet
  if (v <= 4) return 'hsl(230, 70%, 60%)';     // Indigo
  if (v <= 5.5) return 'hsl(210, 75%, 55%)';   // Blue
  if (v <= 7) return 'hsl(35, 85%, 55%)';      // Amber
  if (v <= 8.5) return 'hsl(15, 90%, 50%)';    // Orange
  return 'hsl(0, 85%, 50%)';                   // Red (Critical)
}

export function getMyIDFingerprintData(scores: Record<string, number>): FingerprintRing[] {
  return [
    // Inner rings (demand)
    { label: 'D (Dor)', value: scores.D || 0, type: 'inner', color: getThermalColor(scores.D || 0), scoreKey: 'D' },
    { label: 'EFI (Funcionalidade)', value: scores.EFI || 0, type: 'inner', color: getThermalColor(scores.EFI || 0), scoreKey: 'EFI' },
    { label: 'P (Psicológico)', value: scores.P || 0, type: 'inner', color: getThermalColor(scores.P || 0), scoreKey: 'P' },
    { label: 'I (Inércia)', value: scores.I || 0, type: 'inner', color: getThermalColor(scores.I || 0), scoreKey: 'I' },

    // Outer rings (capacity) — inverted: low value = bad
    { label: 'R (Regulação)', value: scores.R || 0, type: 'outer', color: getThermalColor(10 - (scores.R || 0)), scoreKey: 'R' },
    { label: 'C (Contexto)', value: scores.C || 0, type: 'outer', color: getThermalColor(10 - (scores.C || 0)), scoreKey: 'C' },
    { label: 'AF (Atividade Física)', value: scores.AF || 5, type: 'outer', color: getThermalColor(10 - (scores.AF || 5)), scoreKey: 'AF' },
    { label: 'HID (Hidratação)', value: scores.HID || 7, type: 'outer', color: getThermalColor(10 - (scores.HID || 7)), scoreKey: 'HID' },
    { label: 'NUT (Nutrição)', value: scores.NUT || 7, type: 'outer', color: getThermalColor(10 - (scores.NUT || 7)), scoreKey: 'NUT' },
    { label: 'ERG (Ergonomia)', value: scores.ERG || 7, type: 'outer', color: getThermalColor(10 - (scores.ERG || 7)), scoreKey: 'ERG' },
    { label: 'N (Ruído)', value: scores.N || 0, type: 'outer', color: getThermalColor(scores.N || 0), scoreKey: 'N' },
    { label: 'MED (Medicação)', value: scores.MED || 0, type: 'outer', color: getThermalColor(scores.MED || 0), scoreKey: 'MED' },
  ];
}

// ── Classification color helpers ──
// ── Classification color helpers ──
export function getMyIDSeverityColor(classificacao: string): string {
  switch (classificacao) {
    case 'LEVE': return 'text-violet-600 bg-violet-50 border-violet-200';
    case 'MODERADO': return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'SEVERO': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'CRÍTICO': return 'text-red-600 bg-red-50 border-red-200';
    case 'EXTREMO': return 'text-red-950 bg-red-50 border-red-900';
    default: return 'text-muted-foreground bg-muted border-border';
  }
}

// ── Narrativas de 4 Linhas para MyID e Diretrizes ──

/**
 * Gera um resumo de 4 linhas para o resultado MyID
 */
export function generateMyIDNarrative4Lines(score: number, components: Record<string, number>, hasRedFlags: boolean = false): string[] {
  const interp = getMyIDInterpretation(score, hasRedFlags);

  // Linha 1: Status Geral e Score
  const line1 = `O Índice MyID de ${score.toFixed(1)} aponta para um estado de ${interp.label.toLowerCase()} (${interp.status}).`;

  // Linha 2: Demanda vs Capacidade (O que pesa mais)
  const D = components.D || 0;
  const EFI = components.EFI || 0;
  const P = components.P || 0;
  const demandSource = D > 6 ? 'dor persistente' : EFI > 6 ? 'baixa funcionalidade' : P > 6 ? 'fatores emocionais' : 'carga sistêmica';
  const line2 = `Identificamos uma sobrecarga vinda principalmente de ${demandSource}, elevando sua demanda biológica.`;

  // Linha 3: Capacidade de Recuperação
  const R = components.R || 0;
  const capacityState = R > 7 ? 'está robusta' : R > 4 ? 'necessita de atenção' : 'está crítica';
  const line3 = `Sua capacidade de autorregulação (sono e energia) ${capacityState}, sendo o pilar central para sua recuperação.`;

  // Linha 4: Insight / Ação recomendada
  const line4 = hasRedFlags
    ? "Atenção: Sinais de alerta (Red Flags) detectados exigem acompanhamento profissional próximo."
    : `Recomendamos focar em ${R < 6 ? 'melhorar o sono' : 'progressão gradual'} para equilibrar seu sistema e reduzir o score.`;

  return [line1, line2, line3, line4];
}

/**
 * Gera um resumo de 4 linhas para as Diretrizes de Tratamento
 */
export function generateGuidelineExplanation4Lines(protocol: any): string[] {
  if (!protocol) return ["Nenhuma diretriz ativa no momento.", "", "", ""];

  const objetivo = protocol.objetivo_geral || "Melhoria funcional global.";
  const frequencia = protocol.frequencia || "2-3x por semana";
  const duracao = protocol.duracao_total || "12 semanas";

  // Linha 1: Objetivo Principal
  const line1 = `Objetivo central: ${objetivo}`;

  // Linha 2: Frequência e Duração
  const line2 = `O plano está estruturado para ser executado ${frequencia} durante ${duracao}.`;

  // Linha 3: Foco Terapêutico (Hierarquia)
  const hierarquia = Array.isArray(protocol.hierarquia_terapeutica)
    ? protocol.hierarquia_terapeutica.map((h: any) => h.foco).slice(0, 2).join(' e ')
    : "reajuste biocomportamental";
  const line3 = `A prioridade inicial será o controle de ${hierarquia.toLowerCase()}.`;

  // Linha 4: Expectativa de Evolução
  const line4 = "Buscaremos a redução da carga sistêmica e o aumento da sua régua de tolerância ao esforço.";

  return [line1, line2, line3, line4];
}
