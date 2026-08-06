import { lazy, ComponentType } from 'react';

/**
 * Lazy import com retry automático. Cobre falhas de chunk load (deploys novos,
 * blip de rede, PWA cache stale). Dois modos de falha são tratados:
 *  1) o import REJEITA (erro de rede/chunk) — captura e tenta de novo;
 *  2) o import RESOLVE mas sem `default` (chunk stale/corrompido que avaliou para
 *     um módulo vazio — é o que gera "undefined is not an object (…_result.default)"
 *     no iOS/PWA depois de um deploy). Tratamos como falha e recarregamos.
 * Se tudo falhar, força UM hard reload (com guard anti-loop) para buscar o index
 * e os chunks novos.
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
        const mod = await factory();
        // Chunk stale que resolveu sem componente default → trata como falha de load.
        if (!mod || (mod as { default?: unknown }).default == null) {
          throw new Error('Loading chunk failed: módulo sem export default (stale)');
        }
        return mod;
      } catch (err) {
        lastErr = err;
        const msg = String((err as Error)?.message ?? err);
        const isChunkError =
          msg.includes('Failed to fetch dynamically imported module') ||
          msg.includes('error loading dynamically imported module') ||
          msg.includes('Importing a module script failed') ||
          msg.includes('ChunkLoadError') ||
          msg.includes('Loading chunk') ||
          msg.includes('Loading CSS chunk') ||
          msg.includes('module script failed');

        // Retry com backoff apenas para erros de chunk (evita re-executar 3x um
        // módulo com bug real de avaliação).
        if (isChunkError && attempt < retries) {
          await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
          continue;
        }

        // Fallback final: qualquer falha ao carregar a tela no cliente é quase
        // sempre chunk stale / rede. Recarrega UMA vez (guard de 30s anti-loop)
        // para pegar o index + chunks novos. Se persistir, deixa o erro subir.
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
