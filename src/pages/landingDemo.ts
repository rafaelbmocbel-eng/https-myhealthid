// Dados de exemplo pra mostrar o MyID de verdade (MyIDFingerprint) nas páginas
// públicas (home do cliente e site do profissional), sem precisar de login/dados.
import { getMyIDFingerprintData } from '@/utils/myidCalculations';

export const DEMO_SCORES: Record<string, number> = {
  D: 7.5, EFI: 3, P: 5.5, I: 6.5, R: 5.5, C: 6.8, AF: 7, HID: 8.5, NUT: 7.5, ERG: 4.5, N: 6.2,
};

export const DEMO_RINGS = getMyIDFingerprintData(DEMO_SCORES);
// MyID_score é 0–100 (maior = melhor). 68 = um exemplo saudável/moderado.
export const DEMO_MYID = 68;

// Achados de exemplo pro Avatar Clínico REAL (BodyView): região -> intensidade 0-10.
export const DEMO_AVATAR_POINTS: Record<string, number> = {
  pescoco: 5,
  ombro_d: 7,
  abdomen: 3,
  joelho_e: 6,
};
