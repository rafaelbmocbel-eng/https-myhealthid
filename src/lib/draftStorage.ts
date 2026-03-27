interface DraftEnvelope<T> {
  version: number;
  updatedAt: number;
  data: T;
}

const DB_NAME = 'myhealthid-drafts';
const STORE_NAME = 'drafts';
const KEY_PREFIX = 'myhealthid:draft:';

const storageKey = (key: string) => `${KEY_PREFIX}${key}`;

const canUseIndexedDb = () => typeof window !== 'undefined' && 'indexedDB' in window;
const canUseLocalStorage = () => typeof window !== 'undefined' && 'localStorage' in window;

async function openDraftDb(): Promise<IDBDatabase | null> {
  if (!canUseIndexedDb()) return null;

  return await new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, 1);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGet<T>(key: string): Promise<DraftEnvelope<T> | null> {
  const db = await openDraftDb();
  if (!db) return null;

  return await new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => resolve((request.result as DraftEnvelope<T> | undefined) ?? null);
    request.onerror = () => resolve(null);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
  });
}

async function idbSet<T>(key: string, envelope: DraftEnvelope<T>) {
  const db = await openDraftDb();
  if (!db) return false;

  return await new Promise<boolean>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(envelope, key);

    transaction.oncomplete = () => {
      db.close();
      resolve(true);
    };
    transaction.onerror = () => {
      db.close();
      resolve(false);
    };
  });
}

async function idbDelete(key: string) {
  const db = await openDraftDb();
  if (!db) return false;

  return await new Promise<boolean>((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(key);

    transaction.oncomplete = () => {
      db.close();
      resolve(true);
    };
    transaction.onerror = () => {
      db.close();
      resolve(false);
    };
  });
}

export async function readDraft<T>(key: string, version: number): Promise<T | null> {
  try {
    const idbDraft = await idbGet<T>(key);
    if (idbDraft) {
      if (idbDraft.version !== version) {
        await clearDraft(key);
        return null;
      }
      return idbDraft.data;
    }

    if (!canUseLocalStorage()) return null;
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as DraftEnvelope<T>;
    if (parsed.version !== version) {
      await clearDraft(key);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

export async function writeDraft<T>(key: string, data: T, version: number) {
  const envelope: DraftEnvelope<T> = {
    version,
    updatedAt: Date.now(),
    data,
  };

  try {
    const storedInIdb = await idbSet(key, envelope);
    if (storedInIdb || !canUseLocalStorage()) return;

    window.localStorage.setItem(storageKey(key), JSON.stringify(envelope));
  } catch {
    if (!canUseLocalStorage()) return;
    try {
      window.localStorage.setItem(storageKey(key), JSON.stringify(envelope));
    } catch {
      // Ignore quota/storage errors silently.
    }
  }
}

export async function clearDraft(key: string) {
  try {
    await idbDelete(key);
  } catch {
    // noop
  }

  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.removeItem(storageKey(key));
  } catch {
    // noop
  }
}