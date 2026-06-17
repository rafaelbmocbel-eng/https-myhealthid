/**
 * Wellness Index Calculator
 * Combines daily diary metrics into a unified wellness score (0-100)
 * and provides trend analysis, correlations with MyID, and alerts.
 */

export interface DailyLogEntry {
  id: string;
  created_at: string;
  mood: number;       // 1-5
  pain: number;       // 0-10
  energy: number;     // 1-5
  sleep_hours: number; // 0-14
  notes: string | null;
}

export interface WellnessSnapshot {
  date: string;
  index: number;        // 0-100
  moodNorm: number;     // 0-100
  painNorm: number;     // 0-100 (inverted: 0 pain = 100)
  energyNorm: number;   // 0-100
  sleepNorm: number;    // 0-100
}

export interface WellnessTrend {
  direction: 'improving' | 'stable' | 'declining';
  slope: number;           // change per day
  weekAvg: number;
  prevWeekAvg: number;
  delta: number;
  streak: number;          // consecutive days with index >= 60
}

export interface WellnessAlert {
  type: 'warning' | 'critical' | 'positive';
  icon: string;
  title: string;
  message: string;
}

export interface MyIDCorrelation {
  dimension: string;
  label: string;
  correlation: number; // -1 to 1 — índice heurístico de consistência, NÃO é correlação estatística calculada
  insight: string;
}

// --- Normalization ---

/** Normalize mood (1-5) to 0-100 */
const normMood = (v: number) => ((v - 1) / 4) * 100;

/** Normalize pain (0-10) INVERTED to 0-100 (0 pain = 100) */
const normPain = (v: number) => ((10 - v) / 10) * 100;

/** Normalize energy (1-5) to 0-100 */
const normEnergy = (v: number) => ((v - 1) / 4) * 100;

/** Normalize sleep (0-14h) to 0-100, with optimal at 7-9h */
const normSleep = (v: number) => {
  if (v >= 7 && v <= 9) return 100;
  if (v < 7) return Math.max(0, (v / 7) * 100);
  // > 9h, slight penalty
  return Math.max(0, 100 - ((v - 9) / 5) * 40);
};

// --- Core Calculation ---

export function calculateWellnessIndex(log: DailyLogEntry): WellnessSnapshot {
  const m = normMood(log.mood);
  const p = normPain(log.pain);
  const e = normEnergy(log.energy);
  const s = normSleep(log.sleep_hours);

  // Weighted: pain 30%, mood 25%, energy 25%, sleep 20%
  const index = Math.round(p * 0.30 + m * 0.25 + e * 0.25 + s * 0.20);

  return {
    date: log.created_at,
    index: Math.min(100, Math.max(0, index)),
    moodNorm: Math.round(m),
    painNorm: Math.round(p),
    energyNorm: Math.round(e),
    sleepNorm: Math.round(s),
  };
}

export function calculateWellnessSeries(logs: DailyLogEntry[]): WellnessSnapshot[] {
  return logs
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(calculateWellnessIndex);
}

// --- Trend Analysis ---

export function analyzeWellnessTrend(snapshots: WellnessSnapshot[]): WellnessTrend {
  if (snapshots.length < 2) {
    return { direction: 'stable', slope: 0, weekAvg: snapshots[0]?.index ?? 0, prevWeekAvg: 0, delta: 0, streak: 0 };
  }

  const recent7 = snapshots.slice(-7);
  const prev7 = snapshots.slice(-14, -7);

  const weekAvg = recent7.reduce((s, x) => s + x.index, 0) / recent7.length;
  const prevWeekAvg = prev7.length > 0 ? prev7.reduce((s, x) => s + x.index, 0) / prev7.length : weekAvg;
  const delta = weekAvg - prevWeekAvg;

  // Simple linear regression slope on last 7
  const n = recent7.length;
  const xMean = (n - 1) / 2;
  const yMean = weekAvg;
  let num = 0, den = 0;
  recent7.forEach((s, i) => {
    num += (i - xMean) * (s.index - yMean);
    den += (i - xMean) ** 2;
  });
  const slope = den !== 0 ? num / den : 0;

  // Streak: consecutive days >= 60 from the end
  let streak = 0;
  for (let i = snapshots.length - 1; i >= 0; i--) {
    if (snapshots[i].index >= 60) streak++;
    else break;
  }

  const direction = delta > 3 ? 'improving' : delta < -3 ? 'declining' : 'stable';

  return { direction, slope: Math.round(slope * 10) / 10, weekAvg: Math.round(weekAvg), prevWeekAvg: Math.round(prevWeekAvg), delta: Math.round(delta), streak };
}

// --- Alerts ---

export function generateAlerts(logs: DailyLogEntry[], trend: WellnessTrend): WellnessAlert[] {
  const alerts: WellnessAlert[] = [];
  if (logs.length === 0) return alerts;

  const last3 = logs.slice(-3);

  // Critical: 3+ days of high pain
  if (last3.length >= 3 && last3.every(l => l.pain >= 7)) {
    alerts.push({ type: 'critical', icon: '🚨', title: 'Dor persistente elevada', message: 'Dor ≥ 7 nos últimos 3 dias. Considere contatar seu profissional.' });
  }

  // Warning: poor sleep
  if (last3.length >= 3 && last3.every(l => l.sleep_hours < 5)) {
    alerts.push({ type: 'warning', icon: '😴', title: 'Sono insuficiente', message: 'Menos de 5h de sono nos últimos 3 dias. Sono afeta diretamente a recuperação.' });
  }

  // Warning: declining trend
  if (trend.direction === 'declining' && trend.delta < -8) {
    alerts.push({ type: 'warning', icon: '📉', title: 'Tendência de queda', message: `Índice caiu ${Math.abs(trend.delta)} pontos em relação à semana anterior.` });
  }

  // Positive: streak
  if (trend.streak >= 5) {
    alerts.push({ type: 'positive', icon: '🔥', title: `${trend.streak} dias em alta!`, message: 'Seu índice de bem-estar está consistentemente bom. Continue assim!' });
  }

  // Positive: improving
  if (trend.direction === 'improving' && trend.delta > 5) {
    alerts.push({ type: 'positive', icon: '📈', title: 'Evolução positiva', message: `Índice subiu ${trend.delta} pontos. Seus hábitos estão fazendo diferença!` });
  }

  return alerts;
}

// --- MyID Correlation ---
// IMPORTANTE: isto NÃO é uma correlação estatística (ex: Pearson) entre as
// séries reais de diário e MyID — os intervalos de avaliação MyID são
// esparsos demais (geralmente mensais) para um cálculo estatisticamente
// válido. É um índice heurístico de consistência: classifica a média
// recente do diário em 3 faixas e sugere uma leitura qualitativa. Deve ser
// apresentado ao usuário como estimativa, nunca como estatística calculada.
export function estimateMyIDCorrelation(
  snapshots: WellnessSnapshot[],
  myidScores: { date: string; myid_score: number; score_d?: number; score_f?: number; score_p?: number }[]
): MyIDCorrelation[] {
  if (snapshots.length < 3 || myidScores.length < 1) return [];

  const latest = myidScores[myidScores.length - 1];
  const avgPain = snapshots.slice(-14).reduce((s, x) => s + x.painNorm, 0) / Math.min(snapshots.length, 14);
  const avgMood = snapshots.slice(-14).reduce((s, x) => s + x.moodNorm, 0) / Math.min(snapshots.length, 14);
  const avgSleep = snapshots.slice(-14).reduce((s, x) => s + x.sleepNorm, 0) / Math.min(snapshots.length, 14);

  const correlations: MyIDCorrelation[] = [];

  if (latest.score_d != null) {
    const painCorr = avgPain > 70 ? 0.8 : avgPain > 40 ? 0.5 : 0.2;
    correlations.push({
      dimension: 'D',
      label: 'Dor',
      correlation: painCorr,
      insight: avgPain > 70
        ? 'Seus registros diários de dor são consistentes com boa evolução no score D'
        : 'O controle diário da dor pode melhorar seu próximo score D',
    });
  }

  if (latest.score_p != null) {
    const moodCorr = avgMood > 70 ? 0.7 : avgMood > 40 ? 0.4 : 0.1;
    correlations.push({
      dimension: 'P',
      label: 'Psicológico',
      correlation: moodCorr,
      insight: avgMood > 70
        ? 'Humor estável reflete positivamente no perfil psicológico'
        : 'Trabalhar o humor diário pode impactar positivamente o score P',
    });
  }

  if (latest.score_f != null) {
    const sleepCorr = avgSleep > 70 ? 0.6 : avgSleep > 40 ? 0.3 : 0.1;
    correlations.push({
      dimension: 'F',
      label: 'Funcionalidade',
      correlation: sleepCorr,
      insight: avgSleep > 70
        ? 'Bom sono está associado a melhor funcionalidade'
        : 'Melhorar a qualidade do sono pode impactar sua funcionalidade',
    });
  }

  return correlations;
}

// --- Wellness Level ---

export function getWellnessLevel(index: number): { label: string; color: string; emoji: string } {
  if (index >= 80) return { label: 'Excelente', color: 'text-emerald-600', emoji: '🌟' };
  if (index >= 60) return { label: 'Bom', color: 'text-blue-600', emoji: '👍' };
  if (index >= 40) return { label: 'Regular', color: 'text-amber-500', emoji: '⚠️' };
  if (index >= 20) return { label: 'Baixo', color: 'text-orange-500', emoji: '😟' };
  return { label: 'Crítico', color: 'text-red-600', emoji: '🚨' };
}

// --- Estimativa (NÃO é previsão clínica) ---
// Este NÃO é um modelo preditivo validado — é um ajuste heurístico simples
// (cap de ±5 pontos) baseado na tendência recente do diário de bem-estar.
// Deve sempre ser comunicado ao usuário como estimativa simplificada, com
// "consistência" (baseada na sequência de registros) em vez de "confiança"
// estatística, para não sugerir rigor que a fórmula não tem.
export function projectNextMyID(
  currentMyID: number,
  trend: WellnessTrend,
  weeklyAvg: number
): { projected: number; consistencia: string; message: string; disclaimer: string } {
  let delta = 0;
  if (trend.direction === 'improving' && weeklyAvg >= 60) {
    delta = Math.min(5, trend.delta * 0.3);
  } else if (trend.direction === 'declining' && weeklyAvg < 40) {
    delta = Math.max(-5, trend.delta * 0.3);
  }

  const projected = Math.max(0, Math.min(100, Math.round(currentMyID + delta)));
  const consistencia = trend.streak >= 7 ? 'Alta' : trend.streak >= 3 ? 'Média' : 'Baixa';

  let message = '';
  if (delta > 0) message = `Mantendo esses hábitos, a estimativa é de melhora de ~${Math.round(delta)} pts no próximo MyID`;
  else if (delta < 0) message = 'Atenção: a tendência atual pode impactar negativamente o próximo MyID';
  else message = 'Mantenha a consistência para ver impacto no próximo MyID';

  return {
    projected,
    consistencia,
    message,
    disclaimer: 'Estimativa simplificada com base no seu diário de bem-estar — não é uma previsão clínica nem substitui avaliação profissional.',
  };
}
