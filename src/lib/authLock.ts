const AUTH_LOCK_PATTERNS = [
  'Navigator LockManager lock',
  'lock:sb-',
  'timed out waiting 10000ms',
] as const;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function extractErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function isAuthLockTimeoutError(error: unknown): boolean {
  const msg = extractErrorMessage(error);
  return AUTH_LOCK_PATTERNS.some(pattern => msg.includes(pattern));
}

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

export async function withAuthLockRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 250 } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isAuthLockTimeoutError(error) || attempt === maxAttempts) {
        throw error;
      }

      await sleep(baseDelayMs * attempt);
    }
  }

  throw lastError;
}
