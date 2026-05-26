import { lazy, ComponentType } from 'react';

/**
 * Lazy import com retry automático. Cobre falhas de chunk load (deploys novos,
 * blip de rede, PWA cache stale). Se todas as tentativas falharem, força um
 * hard reload bypassando o cache do Service Worker.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  delayMs = 700,
) {
  return lazy(async () => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await factory();
      } catch (err) {
        lastErr = err;
        const msg = String((err as Error)?.message ?? err);
        const isChunkError =
          msg.includes('Failed to fetch dynamically imported module') ||
          msg.includes('Importing a module script failed') ||
          msg.includes('ChunkLoadError') ||
          msg.includes('Loading chunk') ||
          msg.includes('Loading CSS chunk');

        if (!isChunkError) throw err;
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
          continue;
        }

        // Última tentativa falhou → hard reload uma vez (com guard p/ evitar loop)
        const flag = 'portal-chunk-reload-at';
        const last = Number(sessionStorage.getItem(flag) ?? '0');
        if (Date.now() - last > 30_000) {
          sessionStorage.setItem(flag, String(Date.now()));
          window.location.reload();
          return { default: (() => null) as unknown as T };
        }
        throw lastErr;
      }
    }
    throw lastErr;
  });
}
