// Backup contínuo de gravação de áudio em IndexedDB.
// Cada chunk do MediaRecorder é persistido NO MOMENTO em que sai do microfone —
// se a página recarregar, o app fechar ou o navegador travar no meio da
// gravação, o áudio é reconstruído na volta. Nada se perde.

const DB_NAME = 'myhealthid-rec-backup';
const STORE_CHUNKS = 'chunks';
const STORE_META = 'meta';

interface RecMeta {
  mimeType: string;
  seconds: number;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) { resolve(null); return; }
    try {
      const req = window.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
          const st = db.createObjectStore(STORE_CHUNKS, { keyPath: 'id', autoIncrement: true });
          st.createIndex('bySession', 'sessionKey', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'sessionKey' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

export async function backupAppendChunk(sessionKey: string, chunk: Blob): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_CHUNKS, 'readwrite');
    tx.objectStore(STORE_CHUNKS).add({ sessionKey, chunk, ts: Date.now() });
  } catch { /* best-effort */ }
}

export async function backupSetMeta(sessionKey: string, meta: Omit<RecMeta, 'updatedAt'>): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_META, 'readwrite');
    tx.objectStore(STORE_META).put({ sessionKey, ...meta, updatedAt: Date.now() });
  } catch { /* best-effort */ }
}

export async function backupRead(sessionKey: string): Promise<{ blob: Blob; meta: RecMeta } | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const meta = await new Promise<RecMeta | null>((resolve) => {
      const req = db.transaction(STORE_META, 'readonly').objectStore(STORE_META).get(sessionKey);
      req.onsuccess = () => resolve((req.result as RecMeta & { sessionKey: string }) || null);
      req.onerror = () => resolve(null);
    });
    const chunks = await new Promise<Blob[]>((resolve) => {
      const out: Blob[] = [];
      const idx = db.transaction(STORE_CHUNKS, 'readonly').objectStore(STORE_CHUNKS).index('bySession');
      const cur = idx.openCursor(IDBKeyRange.only(sessionKey));
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) { out.push((c.value as { chunk: Blob }).chunk); c.continue(); }
        else resolve(out);
      };
      cur.onerror = () => resolve(out);
    });
    if (!chunks.length) return null;
    const mime = meta?.mimeType || 'audio/webm';
    return {
      blob: new Blob(chunks, { type: mime }),
      meta: meta || { mimeType: mime, seconds: 0, updatedAt: Date.now() },
    };
  } catch { return null; }
}

export async function backupClear(sessionKey: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction([STORE_CHUNKS, STORE_META], 'readwrite');
    const idx = tx.objectStore(STORE_CHUNKS).index('bySession');
    const cur = idx.openCursor(IDBKeyRange.only(sessionKey));
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) { c.delete(); c.continue(); }
    };
    tx.objectStore(STORE_META).delete(sessionKey);
  } catch { /* best-effort */ }
}
