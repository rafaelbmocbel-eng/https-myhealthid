export const isAuthLockTimeoutError = (error: unknown): boolean => {
  if (!error) return false;

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as { message?: string }).message ?? '');
    return message.includes('Navigator LockManager lock') || message.includes('lock:sb-');
  }

  return false;
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withAuthLockRetry<T>(
  operation: () => Promise<T>,
  retries = 2,
  delayMs = 250,
): Promise<T> {
  let lastLockError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await operation();

      const responseError =
        typeof result === 'object' && result !== null && 'error' in (result as object)
          ? (result as { error?: unknown }).error
          : null;

      if (!responseError || !isAuthLockTimeoutError(responseError)) {
        return result;
      }

      lastLockError = responseError;
    } catch (error) {
      if (!isAuthLockTimeoutError(error)) {
        throw error;
      }
      lastLockError = error;
    }

    if (attempt < retries) {
      await sleep(delayMs * (attempt + 1));
    }
  }

  if (lastLockError instanceof Error) {
    throw lastLockError;
  }

  throw new Error('Auth lock timeout persisted after retries');
}
