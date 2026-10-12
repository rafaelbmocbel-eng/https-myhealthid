/*
 * Gancho de teste: permite que os testes automáticos de navegador troquem o detector de pose (MediaPipe, que
 * precisa de rede) por um detector falso e determinístico. Só existe em build de desenvolvimento: no build de
 * produção `import.meta.env.DEV` é falso, o bundler descarta o corpo e o app nunca lê nada de `window`.
 */

export type DetectorDeTeste = (quadro: unknown, t: number) => Promise<unknown[] | null>;

declare global {
  interface Window { __MYID_DETECTOR_TESTE__?: DetectorDeTeste }
}

export function detectorDeTeste(): DetectorDeTeste | undefined {
  if (!import.meta.env.DEV) return undefined;
  return typeof window !== 'undefined' ? window.__MYID_DETECTOR_TESTE__ : undefined;
}
