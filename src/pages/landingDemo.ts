// Dados de exemplo pra mostrar o MyID de verdade (MyIDFingerprint) nas páginas
// públicas (home do cliente e site do profissional), sem precisar de login/dados.
import { getMyIDFingerprintData } from '@/utils/myidCalculations';

export const DEMO_SCORES: Record<string, number> = {
  D: 7.5, EFI: 3, P: 5.5, I: 6.5, R: 5.5, C: 6.8, AF: 7, HID: 8.5, NUT: 7.5, ERG: 4.5, N: 6.2,
};

export const DEMO_RINGS = getMyIDFingerprintData(DEMO_SCORES);
// MyID_score é 0–100 (maior = melhor). 68 = um exemplo saudável/moderado.
export const DEMO_MYID = 68;

// Marcadores de exemplo pro Avatar Clínico (posição em % sobre a imagem do corpo).
export const DEMO_AVATAR_MARKERS: { top: number; left: number; label: string; color: string }[] = [
  { top: 30, left: 63, label: 'Ombro D', color: '#F59E0B' },
  { top: 46, left: 42, label: 'Lombar', color: '#EF4444' },
  { top: 70, left: 57, label: 'Joelho E', color: '#8B5CF6' },
];
