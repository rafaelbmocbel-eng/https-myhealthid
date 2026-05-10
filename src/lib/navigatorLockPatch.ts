const SUPABASE_LOCK_PREFIX = "lock:sb-";
const PATCH_FLAG = "__supabaseLockPatchInstalled";

type PatchableWindow = Window & {
  [PATCH_FLAG]?: boolean;
};

/**
 * Workaround para ambientes onde o Navigator LockManager fica preso
 * e impede a leitura do token de sessão por vários segundos.
 */
export function installSupabaseLockPatch() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;

  const w = window as PatchableWindow;
  if (w[PATCH_FLAG]) return;

  const locks = navigator.locks;
  if (!locks?.request) {
    w[PATCH_FLAG] = true;
    return;
  }

  const originalRequest = locks.request.bind(locks);

  try {
    (locks as LockManager).request = ((name: unknown, optionsOrCallback: unknown, maybeCallback?: unknown) => {
      const callback =
        typeof optionsOrCallback === "function"
          ? optionsOrCallback
          : typeof maybeCallback === "function"
            ? maybeCallback
            : null;

      // Evita timeout de 10s no lock interno do auth token.
      // Passamos um Lock fake (não null) para evitar o warning do gotrue
      // "Navigator LockManager returned a null lock".
      if (typeof name === "string" && name.includes(SUPABASE_LOCK_PREFIX) && callback) {
        const fakeLock = { name, mode: "exclusive" as LockMode };
        return Promise.resolve().then(() => callback(fakeLock as Lock));
      }

      if (typeof optionsOrCallback === "function") {
        return originalRequest(name as string, optionsOrCallback as (lock: Lock | null) => Promise<unknown>);
      }

      return originalRequest(
        name as string,
        optionsOrCallback as LockOptions,
        maybeCallback as (lock: Lock | null) => Promise<unknown>
      );
    }) as LockManager["request"];

    w[PATCH_FLAG] = true;
  } catch (error) {
    console.warn("[Auth] Não foi possível aplicar patch de lock do navegador.", error);
  }
}
