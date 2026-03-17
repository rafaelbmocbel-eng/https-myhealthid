// ═══════════════════════════════════════════════════════════
// Motor de Cálculo MyID-100 v2.0 — Subtração cumulativa de 100
// ═══════════════════════════════════════════════════════════

import type {
  MyIDBloco1Data, MyIDBloco2Data, MyIDBloco3Data,
  MyIDBloco4Data, MyIDBloco5Data, MyIDBloco6Data,
  MyIDResult, RedFlags, FingerprintRing,
} from '@/types/myid';

import {
  calcularPerdaDimensao, classificarMyID100, identificarDriver,
  DIMENSION_LABELS, DIMENSION_COLORS, TEMPLATES_INTERPRETACAO,
} from '@/utils/myid/lossTable';

// ── Score I (Inércia) ──
export function calcularScoreI(bloco1: MyIDBloco1Data): number {
  const mudancasReais = bloco1.mudancasRecentes.filter(m => m !== 'Nenhuma mudança que eu note');
  const iRaw = Math.min(mudancasReais.length * 2, 8);
  return Math.round((iRaw / 8) * 100) / 10;
}

// ── Score D (Dor) ──
export function calcularScoreD_MyID(bloco2: MyIDBloco2Data): number {
  if (bloco2.regioes.length === 0) return 0;
  const somas = bloco2.regioes.reduce(
    (acc, r) => ({ atual: acc.atual + r.intensidadeAtual, max: acc.max + r.intensidadeMaxima }),
    { atual: 0, max: 0 }
  );
  const media = (somas.atual + somas.max) / (2 * bloco2.regioes.length);
  return Math.min(10, Math.round(media * 10) / 10);
}

// ── Red Flags ──
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

// ── Score EFI ──
export function calcularScoreEFI_MyID(bloco3: MyIDBloco3Data): number {
  const raw = (bloco3.trabalho + bloco3.domesticas + bloco3.exercicio + bloco3.independencia + bloco3.vidaSocial) / 5;
  return Math.round(raw * 10) / 10;
}

// ── Score P ──
export function calcularScoreP_MyID(bloco4: MyIDBloco4Data): number {
  const normalize14 = (v: number) => ((v - 1) / 3) * 10;
  const medo = normalize14(bloco4.medoMovimento);
  const catast = normalize14(bloco4.catastrofizacao);
  const evit = normalize14(bloco4.evitacao);
  const autoEfInv = 10 - bloco4.autoeficacia;
  const raw = (medo + catast + evit + autoEfInv) / 4;
  return Math.min(10, Math.max(0, Math.round(raw * 10) / 10));
}

// ── Score R ──
export function calcularScoreR_MyID(bloco5: MyIDBloco5Data): { r: number; r1: number; r2: number; r3: number; c: number } {
  const horasSonoNorm = Math.min(bloco5.horasSono * 1.25, 10);
  const acordaMap: Record<string, number> = { nunca: 0, raramente: 2, frequentemente: 5, sempre: 8 };
  const acordaPenalty = acordaMap[bloco5.acordaPorDor] ?? 0;
  const r1 = Math.max(0, (bloco5.qualidadeSono + horasSonoNorm - acordaPenalty) / 2);

  const exaustoMap: Record<string, number> = { nunca: 0, as_vezes: 3, frequentemente: 6, sempre: 9 };
  const exaustoPenalty = exaustoMap[bloco5.exaustoAoAcordar] ?? 0;
  const r2 = Math.max(0, (10 - bloco5.fadiga + (10 - exaustoPenalty)) / 2);

  const controleMap: Record<string, number> = { muito: 9, moderado: 6, pouco: 3, sem: 0 };
  const controleVal = controleMap[bloco5.controleSaude] ?? 5;
  const r3 = ((10 - bloco5.estresse) + (10 - bloco5.ansiedade) + controleVal) / 3;

  const r = Math.min(10, Math.max(0, Math.round(((r1 + r2 + r3) / 3) * 10) / 10));
  const c = Math.round(((10 - bloco5.trabalhoEstressante) + (10 - bloco5.conflitosFamiliares) + (10 - bloco5.preocupacaoFinanceira)) / 3 * 10) / 10;

  return {
    r: Math.min(10, Math.max(0, r)),
    r1: Math.min(10, Math.max(0, Math.round(r1 * 10) / 10)),
    r2: Math.min(10, Math.max(0, Math.round(r2 * 10) / 10)),
    r3: Math.min(10, Math.max(0, Math.round(r3 * 10) / 10)),
    c: Math.min(10, Math.max(0, c)),
  };
}

// ── Score N ──
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
// Interpretation — MyID-100 scale (0-100, higher = better)
// ═══════════════════════════════════════════════════════════
export interface Interpretation {
  status: string;
  label: string;
  color: string;
  recommendation: string;
  isRedFlagElevated?: boolean;
  dimensionAlerts?: DimensionAlert[];
}

export interface DimensionAlert {
  dimension: string;
  label: string;
  value: number;
  severity: string;
}

export interface DimensionScores {
  D?: number;
  EFI?: number;
  P?: number;
  I?: number;
  N?: number;
}

/**
 * Central interpretation for MyID-100 (0-100 scale).
 * Accepts EITHER old 0-10 scores OR new 0-100 scores and normalizes.
 */
export function getMyIDInterpretation(
  score: number,
  hasRedFlags: boolean = false,
  dimensionScores?: DimensionScores
): Interpretation {
  const val = score ?? 0;

  // Detect if we're on 0-100 scale or legacy 0-10 scale
  // If score > 15, it's the new MyID-100 scale
  const isMyID100 = val > 15;

  let classificacao: string;
  let cor: string;

  if (isMyID100) {
    // MyID-100: higher = better
    if (val >= 85) { classificacao = 'EXCELENTE'; cor = '#10B981'; }
    else if (val >= 70) { classificacao = 'BOM'; cor = '#FBBF24'; }
    else if (val >= 50) { classificacao = 'MODERADO'; cor = '#F59E0B'; }
    else { classificacao = 'CRÍTICO'; cor = '#DC2626'; }
  } else {
    // Legacy 0-10 scale
    if (val < 3) { classificacao = 'EXCELENTE'; cor = '#10B981'; }
    else if (val < 6) { classificacao = 'BOM'; cor = '#FBBF24'; }
    else if (val < 8) { classificacao = 'MODERADO'; cor = '#F59E0B'; }
    else { classificacao = 'CRÍTICO'; cor = '#DC2626'; }
  }

  // Check red flags override
  if (hasRedFlags && (classificacao === 'EXCELENTE' || classificacao === 'BOM')) {
    classificacao = 'MODERADO';
    cor = '#F59E0B';
  }

  // Check dimension alerts (demand dimensions: high = bad)
  const dimensionAlerts: DimensionAlert[] = [];
  if (dimensionScores) {
    for (const [key, dimVal] of Object.entries(dimensionScores)) {
      if (dimVal === undefined || dimVal === null) continue;
      if (dimVal >= 7 && (classificacao === 'EXCELENTE' || classificacao === 'BOM')) {
        classificacao = 'MODERADO';
        cor = '#F59E0B';
        dimensionAlerts.push({
          dimension: key,
          label: DIMENSION_LABELS[key] || key,
          value: dimVal,
          severity: 'MODERADO',
        });
      }
    }
  }

  const template = TEMPLATES_INTERPRETACAO[classificacao] || TEMPLATES_INTERPRETACAO['MODERADO'];

  return {
    status: classificacao,
    label: template.titulo,
    color: cor,
    recommendation: template.recomendacao,
    isRedFlagElevated: hasRedFlags,
    dimensionAlerts: dimensionAlerts.length > 0 ? dimensionAlerts : undefined,
  };
}

// ── Calcular MyID (legacy function, now returns MyID-100 result) ──
export function calcularMyID(
  d: number, efi: number, p: number, i: number,
  r: number, c: number, n: number,
  af: number = 5, hid: number = 7, nut: number = 7, erg: number = 7, med: number = 0
): MyIDResult {
  // Calculate losses using the loss table
  const perdaD = calcularPerdaDimensao('D', d);
  const perdaEFI = calcularPerdaDimensao('EFI', efi);
  const perdaP = calcularPerdaDimensao('P', p);
  const perdaI = calcularPerdaDimensao('I', i);
  const perdaN = calcularPerdaDimensao('N', n);
  const perdaR = calcularPerdaDimensao('R', 10 - r);
  const perdaC = calcularPerdaDimensao('C', 10 - c);
  const perdaAF = calcularPerdaDimensao('AF', 10 - af);
  const perdaHID = calcularPerdaDimensao('HID', 10 - hid);
  const perdaNUT = calcularPerdaDimensao('NUT', 10 - nut);
  const perdaERG = calcularPerdaDimensao('ERG', 10 - erg);

  const totalPerdas = perdaD.perda_pontos + perdaEFI.perda_pontos + perdaP.perda_pontos +
    perdaI.perda_pontos + perdaN.perda_pontos + perdaR.perda_pontos + perdaC.perda_pontos +
    perdaAF.perda_pontos + perdaHID.perda_pontos + perdaNUT.perda_pontos + perdaERG.perda_pontos;

  const myid100 = Math.max(0, Math.min(100, 100 - totalPerdas + med));

  const gatilhosCriticos = [perdaR, perdaAF, perdaERG].some(p => p.gatilho_critico);
  const classificacao = classificarMyID100(myid100, gatilhosCriticos);

  const interp = getMyIDInterpretation(myid100, false, { D: d, EFI: efi, P: p, I: i, N: n });

  return {
    myidScore: myid100,
    myidStatus: classificacao.nome,
    componentScores: { D: d, EFI: efi, P: p, I: i, R: r, C: c, N: n, AF: af, HID: hid, NUT: nut, ERG: erg, MED: med },
    redFlagsDetected: false,
    redFlagAlerts: [],
    classificacao: classificacao.nome,
  };
}

// ── Thermal Color Scale Helper ──
export function getThermalColor(v: number): string {
  const val = Math.max(0, Math.min(10, v));
  if (val <= 1) return 'hsl(270, 60%, 75%)';
  if (val <= 2.5) return 'hsl(260, 65%, 65%)';
  if (val <= 4) return 'hsl(230, 70%, 60%)';
  if (val <= 5.5) return 'hsl(210, 75%, 55%)';
  if (val <= 7) return 'hsl(35, 85%, 55%)';
  if (val <= 8.5) return 'hsl(15, 90%, 50%)';
  return 'hsl(0, 85%, 50%)';
}

export function getMyIDFingerprintData(scores: Record<string, number>): FingerprintRing[] {
  return [
    { label: 'D (Dor)', value: scores.D || 0, type: 'inner', color: getThermalColor(scores.D || 0), scoreKey: 'D' },
    { label: 'EFI (Funcionalidade)', value: scores.EFI || 0, type: 'inner', color: getThermalColor(scores.EFI || 0), scoreKey: 'EFI' },
    { label: 'P (Psicológico)', value: scores.P || 0, type: 'inner', color: getThermalColor(scores.P || 0), scoreKey: 'P' },
    { label: 'I (Inércia)', value: scores.I || 0, type: 'inner', color: getThermalColor(scores.I || 0), scoreKey: 'I' },
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
export function getMyIDSeverityColor(classificacao: string): string {
  switch (classificacao) {
    case 'EXCELENTE': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    case 'BOM': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'MODERADO': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'CRÍTICO': return 'text-red-600 bg-red-50 border-red-200';
    default: return 'text-muted-foreground bg-muted border-border';
  }
}
