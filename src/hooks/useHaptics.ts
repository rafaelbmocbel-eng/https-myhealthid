/**
 * Micro-haptics — usa Vibration API quando disponível (mobile/PWA).
 * Silencioso em desktop. Não bloqueia se a API não existir.
 */
type Pattern = 'tick' | 'success' | 'celebrate' | 'warning';

const PATTERNS: Record<Pattern, number | number[]> = {
  tick: 10,
  success: [12, 40, 18],
  celebrate: [20, 60, 20, 60, 40],
  warning: [30, 30, 30],
};

export function useHaptics() {
  const vibrate = (pattern: Pattern = 'tick') => {
    if (typeof window === 'undefined') return;
    const nav = window.navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
    try {
      nav.vibrate?.(PATTERNS[pattern]);
    } catch {
      /* noop */
    }
  };
  return { vibrate };
}
