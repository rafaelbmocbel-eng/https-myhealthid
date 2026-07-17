// Extrai os scores por dimensão (D, R, P, AF, …) de um resultado_processado.
// O formato variou entre gerações do wizard/motor: o atual grava
// component_scores, versões antigas usaram componentScores ou scores —
// ler só um deles fazia o app achar que o MyID não existia.
export function scoresDoResultado(resultado: unknown): Record<string, number> | null {
  const r = resultado as any;
  const cs = r?.scores || r?.component_scores || r?.componentScores;
  if (cs && typeof cs === 'object' && Object.keys(cs).length > 0) return cs;
  return null;
}
