// Dados de exemplo pra mostrar o MyID de verdade (MyIDFingerprint) nas páginas
// públicas (home do cliente e site do profissional), sem precisar de login/dados.
import { getMyIDFingerprintData } from '@/utils/myidCalculations';
import { calcularPerdaDimensao, gravidadeDimensao } from '@/utils/myid/lossTable';

// Perfil plausível de quem procura ajuda: dor moderada, sono e movimento a melhorar.
// Notas cruas do MyID (dor/emoções/mudanças/sinais: maior = pior; demais: maior = melhor).
export const DEMO_SCORES: Record<string, number> = {
  D: 4, EFI: 7.5, P: 3.5, I: 1, R: 6, C: 7, AF: 6, HID: 8, NUT: 7, ERG: 6.5, N: 1.5,
};

export const DEMO_RINGS = getMyIDFingerprintData(DEMO_SCORES);
// MyID_score (0–100, maior = melhor) calculado pelas MESMAS regras do motor real,
// para o exemplo nunca mostrar uma nota que não bate com os anéis.
export const DEMO_MYID = Math.round(
  100 - Object.entries(DEMO_SCORES).reduce(
    (soma, [k, v]) => soma + calcularPerdaDimensao(k, gravidadeDimensao(k, v)).perda_pontos, 0),
);

// Achados de exemplo pro Avatar Clínico REAL (BodyView): região -> intensidade 0-10.
export const DEMO_AVATAR_POINTS: Record<string, number> = {
  pescoco: 5,
  ombro_d: 7,
  abdomen: 3,
  joelho_e: 6,
};
