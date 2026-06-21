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

  // Fator multi-região
  const nRegioes = bloco2.regioes.length;
  const fatorMulti = 1 + Math.min((nRegioes - 1) * 0.08, 0.40);

  // Variabilidade da dor (melhor dia vs máxima)
  const regiaoMaisGrave = bloco2.regioes.reduce((prev, curr) =>
    curr.intensidadeAtual > prev.intensidadeAtual ? curr : prev
  );
  const variabilidade = regiaoMaisGrave.intensidadeMaxima > 0
    ? (regiaoMaisGrave.intensidadeMaxima - (regiaoMaisGrave.intensidadeMelhorDia ?? regiaoMaisGrave.intensidadeAtual)) / regiaoMaisGrave.intensidadeMaxima
    : 0;

  return Math.min(10, Math.round(media * fatorMulti * (1 - variabilidade * 0.10) * 10) / 10);
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

// ── Helpers de agregação max-weighted ──
// Evita que um item crítico isolado (ex.: finanças 10/10) seja diluído pela média.
// Regra: score = pior_item * 0.6 + média * 0.4
// Para PERDA (maior = pior): pior = max. Para BEM-ESTAR (maior = melhor): pior = min.
const aggLoss = (items: number[]): number => {
  if (items.length === 0) return 0;
  const avg = items.reduce((a, b) => a + b, 0) / items.length;
  return Math.max(...items) * 0.6 + avg * 0.4;
};
const aggWellness = (items: number[]): number => {
  if (items.length === 0) return 0;
  const avg = items.reduce((a, b) => a + b, 0) / items.length;
  return Math.min(...items) * 0.6 + avg * 0.4;
};

// ── Score EFI (bem-estar) ──
export function calcularScoreEFI_MyID(bloco3: MyIDBloco3Data): number {
  const raw = aggWellness([bloco3.trabalho, bloco3.domesticas, bloco3.exercicio, bloco3.independencia, bloco3.vidaSocial]);
  return Math.round(raw * 10) / 10;
}

// ── Score P (perda) ──
export function calcularScoreP_MyID(bloco4: MyIDBloco4Data): number {
  const normalize14 = (v: number) => ((v - 1) / 3) * 10;
  const medo = normalize14(bloco4.medoMovimento);
  const catast = normalize14(bloco4.catastrofizacao);
  const evit = normalize14(bloco4.evitacao);
  const autoEfInv = 10 - bloco4.autoeficacia;
  const raw = aggLoss([medo, catast, evit, autoEfInv]);
  return Math.min(10, Math.max(0, Math.round(raw * 10) / 10));
}

// ── Score R ──
export function calcularScoreR_MyID(bloco5: MyIDBloco5Data): { r: number; r1: number; r2: number; r3: number; c: number } {
  const horasSonoNorm = Math.min(bloco5.horasSono * 1.25, 10);
  const acordaMap: Record<string, number> = { nunca: 0, never: 0, raramente: 2, rarely: 2, frequentemente: 5, frequently: 5, sempre: 8, always: 8 };
  const acordaPenalty = acordaMap[bloco5.acordaPorDor] ?? 0;
  const r1 = Math.max(0, (bloco5.qualidadeSono + horasSonoNorm - acordaPenalty) / 2);

  const exaustoMap: Record<string, number> = { nunca: 0, never: 0, as_vezes: 3, sometimes: 3, frequentemente: 6, frequently: 6, sempre: 9, always: 9 };
  const exaustoPenalty = exaustoMap[bloco5.exaustoAoAcordar] ?? 0;
  const r2 = Math.max(0, (10 - bloco5.fadiga + (10 - exaustoPenalty)) / 2);

  const controleMap: Record<string, number> = { muito: 9, very: 9, moderado: 6, moderate: 6, pouco: 3, little: 3, sem: 0, none: 0 };
  const controleVal = controleMap[bloco5.controleSaude] ?? 5;
  // R3 (psicológico) — bem-estar: o pior item domina (ex.: ansiedade 10 não fica escondida por estresse 3)
  const r3 = aggWellness([10 - bloco5.estresse, 10 - bloco5.ansiedade, controleVal]);

  // R global — agrega sub-blocos por max-weighted (pior sub-bloco puxa o score)
  const r = Math.min(10, Math.max(0, Math.round(aggWellness([r1, r2, r3]) * 10) / 10));
  // Contexto — bem-estar: pior estressor isolado (ex.: finanças) domina
  const c = Math.round(
    aggWellness([10 - bloco5.trabalhoEstressante, 10 - bloco5.conflitosFamiliares, 10 - bloco5.preocupacaoFinanceira]) * 10
  ) / 10;

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
  R?: number;
  AF?: number;
  ERG?: number;
  [key: string]: number | undefined;
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

  // Use classificarMyID100 as single source of truth
  const classif = classificarMyID100(val);
  let classificacao = classif.nome;
  let cor = classif.cor;

  // Alertas críticos/moderados ficam separados da classificação principal.
  // A classificação visual principal deve depender apenas do score total.
  const dimensionAlerts: DimensionAlert[] = [];

  if (dimensionScores) {
    const CRITICAL_THRESHOLDS: Record<string, number> = { R: 7, AF: 7, ERG: 8 };
    for (const [key, dimVal] of Object.entries(dimensionScores)) {
      if (dimVal === undefined || dimVal === null) continue;
      const threshold = CRITICAL_THRESHOLDS[key];

      // EFI é bem-estar/funcionalidade: menor valor = pior (oposto das demais dimensões de demanda aqui).
      if (key === 'EFI') {
        if (dimVal <= 3) {
          dimensionAlerts.push({ dimension: key, label: DIMENSION_LABELS[key] || key, value: dimVal, severity: 'CRÍTICO' });
        } else if (dimVal <= 5) {
          dimensionAlerts.push({ dimension: key, label: DIMENSION_LABELS[key] || key, value: dimVal, severity: 'MODERADO' });
        }
        continue;
      }

      if (threshold !== undefined && dimVal >= threshold) {
        dimensionAlerts.push({
          dimension: key,
          label: DIMENSION_LABELS[key] || key,
          value: dimVal,
          severity: 'CRÍTICO',
        });
      } else if (dimVal >= 7) {
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
  // EFI é bem-estar/funcionalidade: menor valor = pior, por isso usa o déficit (10 - efi), igual às capacidades.
  const perdaEFI = calcularPerdaDimensao('EFI', 10 - efi);
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
  // Layout: CAPACIDADE no centro (suas reservas, base interna) → DEMANDA por fora (o que está pressionando agora).
  // Lê-se do centro pra fora: "o que me sustenta" → "o que está me desafiando".
  return [
    // ── CAPACIDADE (anéis internos) ──
    { label: 'Sono e energia', value: scores.R || 0, type: 'inner', color: getThermalColor(10 - (scores.R || 0)), scoreKey: 'R' },
    { label: 'Vida pessoal', value: scores.C || 0, type: 'inner', color: getThermalColor(10 - (scores.C || 0)), scoreKey: 'C' },
    { label: 'Movimento', value: scores.AF || 5, type: 'inner', color: getThermalColor(10 - (scores.AF || 5)), scoreKey: 'AF' },
    { label: 'Hidratação', value: scores.HID || 7, type: 'inner', color: getThermalColor(10 - (scores.HID || 7)), scoreKey: 'HID' },
    { label: 'Alimentação', value: scores.NUT || 7, type: 'inner', color: getThermalColor(10 - (scores.NUT || 7)), scoreKey: 'NUT' },
    { label: 'Postura no dia', value: scores.ERG || 7, type: 'inner', color: getThermalColor(10 - (scores.ERG || 7)), scoreKey: 'ERG' },
    // ── DEMANDA (anéis externos) ──
    // EFI fica visualmente no grupo "externo", mas é bem-estar/funcionalidade: menor valor = pior.
    { label: 'Suas atividades do dia', value: scores.EFI || 0, type: 'outer', color: getThermalColor(10 - (scores.EFI || 0)), scoreKey: 'EFI', severity: 10 - (scores.EFI || 0) },
    { label: 'Cabeça e emoções', value: scores.P || 0, type: 'outer', color: getThermalColor(scores.P || 0), scoreKey: 'P' },
    { label: 'Mudanças recentes', value: scores.I || 0, type: 'outer', color: getThermalColor(scores.I || 0), scoreKey: 'I' },
    { label: 'Sinais do corpo', value: scores.N || 0, type: 'outer', color: getThermalColor(scores.N || 0), scoreKey: 'N' },
    // MED can be negative (penalty) or positive (bonus).
    // For the ring: encode the PENALTY as demand (higher = worse).
    // A corticoid patient (MED=-5) should show a red, high-demand ring.
    (() => {
      const raw = scores.MED ?? 0;
      const demandValue = raw < 0 ? Math.min(-raw * 1.5, 10) : 0;
      return { label: 'Medicação', value: demandValue, type: 'outer' as const, color: getThermalColor(demandValue), scoreKey: 'MED' };
    })(),
    { label: 'Dor', value: scores.D || 0, type: 'outer', color: getThermalColor(scores.D || 0), scoreKey: 'D' },
  ];
}

// ── Classification color helpers ──
export function getMyIDSeverityColor(classificacao: string): string {
  switch (classificacao) {
    case 'EXCELENTE': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    case 'BOM': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'MODERADO': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'CRÍTICO': return 'text-red-600 bg-red-50 border-red-200';
    case 'CRÍTICO SEVERO': return 'text-red-900 bg-red-100 border-red-400';
    default: return 'text-muted-foreground bg-muted border-border';
  }
}
