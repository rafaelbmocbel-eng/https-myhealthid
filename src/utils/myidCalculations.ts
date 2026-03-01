// ═══════════════════════════════════════════════════════════
// Motor de Cálculo MyID v2
// Fórmula: MyID = [(D + EFI) × (1 + P/10) + I] / [(R + C) - N]
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
// FÓRMULA FINAL: MyID = [(D + EFI) × (1 + P/10) + I] / [(R + C) - N]
// ═══════════════════════════════════════════════════════════
export function calcularMyID(
  d: number, efi: number, p: number, i: number,
  r: number, c: number, n: number
): MyIDResult {
  // Numerador: Demanda
  const numerador = ((d + efi) * (1 + p / 10)) + i;

  // Denominador: Capacidade (mínimo 0.5 para evitar divisão por 0)
  const denominador = Math.max(0.5, (r + c) - n);

  const myidRaw = numerador / denominador;
  const myidScore = Math.round(myidRaw * 10) / 10;

  // Status
  let myidStatus = 'Demanda Baixa com Suporte Alto';
  let classificacao = 'LEVE';
  if (myidScore > 5) { myidStatus = 'Demanda Muito Alta com Suporte Insuficiente'; classificacao = 'EXTREMO'; }
  else if (myidScore > 3.5) { myidStatus = 'Demanda Alta com Suporte Baixo'; classificacao = 'CRÍTICO'; }
  else if (myidScore > 2.5) { myidStatus = 'Demanda Alta com Suporte Moderado'; classificacao = 'SEVERO'; }
  else if (myidScore > 1.5) { myidStatus = 'Demanda Moderada com Suporte Moderado'; classificacao = 'MODERADO'; }

  return {
    myidScore,
    myidStatus,
    componentScores: { D: d, EFI: efi, P: p, I: i, R: r, C: c, N: n },
    redFlagsDetected: false,
    redFlagAlerts: [],
    classificacao,
  };
}

// ── Fingerprint visualization data ──
export function getMyIDFingerprintData(scores: Record<string, number>): FingerprintRing[] {
  return [
    // Inner rings (warm - demand)
    { label: 'D (Dor)', value: scores.D || 0, type: 'inner', color: '#FF4D4D', scoreKey: 'D' },
    { label: 'EFI (Funcionalidade)', value: scores.EFI || 0, type: 'inner', color: '#FF8C00', scoreKey: 'EFI' },
    { label: 'P (Psicológico)', value: scores.P || 0, type: 'inner', color: '#FFA500', scoreKey: 'P' },
    { label: 'I (Inércia)', value: scores.I || 0, type: 'inner', color: '#FFB84D', scoreKey: 'I' },

    // Outer rings (cool/neutral - capacity/support)
    { label: 'R (Regulação)', value: scores.R || 0, type: 'outer', color: '#4DA6FF', scoreKey: 'R' },
    { label: 'C (Contexto)', value: scores.C || 0, type: 'outer', color: '#32CD32', scoreKey: 'C' },
    { label: 'AF (Atividade Física)', value: scores.AF || 5, type: 'outer', color: '#66BD63', scoreKey: 'AF' },
    { label: 'HID (Hidratação)', value: scores.HID || 7, type: 'outer', color: '#1E90FF', scoreKey: 'HID' },
    { label: 'NUT (Nutrição)', value: scores.NUT || 7, type: 'outer', color: '#228B22', scoreKey: 'NUT' },
    { label: 'ERG (Ergonomia)', value: scores.ERG || 7, type: 'outer', color: '#6B8E23', scoreKey: 'ERG' },
    { label: 'N (Ruído)', value: scores.N || 0, type: 'outer', color: '#4682B4', scoreKey: 'N' },
  ];
}

// ── Classification color helpers ──
export function getMyIDSeverityColor(classificacao: string): string {
  switch (classificacao) {
    case 'LEVE': return 'text-green-600 bg-green-50 border-green-200';
    case 'MODERADO': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'SEVERO': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'CRÍTICO': return 'text-red-600 bg-red-50 border-red-200';
    case 'EXTREMO': return 'text-purple-700 bg-purple-50 border-purple-200';
    default: return 'text-muted-foreground bg-muted border-border';
  }
}
