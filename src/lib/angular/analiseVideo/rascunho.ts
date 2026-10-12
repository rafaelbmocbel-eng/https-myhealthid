/*
 * Rascunho automático da análise em vídeo no IndexedDB do navegador (a trilha com as correções é grande demais
 * para o localStorage). Tudo falha em silêncio: em janela privada ou sem IndexedDB a análise segue normal,
 * só não é retomada sozinha (o arquivo .json continua valendo).
 */

const BANCO = 'myid-analise-video';
const LOJA = 'rascunhos';

function abrir(): Promise<IDBDatabase | null> {
  return new Promise((ok) => {
    try {
      if (typeof indexedDB === 'undefined') { ok(null); return; }
      const req = indexedDB.open(BANCO, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(LOJA); };
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ok(null);
      req.onblocked = () => ok(null);
    } catch {
      // IndexedDB bloqueado pelo navegador (janela privada, política do aparelho).
      ok(null);
    }
  });
}

function transacao<T>(modo: IDBTransactionMode, fn: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return abrir().then((db) => {
    if (!db) return null;
    return new Promise<T | null>((ok) => {
      try {
        const req = fn(db.transaction(LOJA, modo).objectStore(LOJA));
        req.onsuccess = () => { db.close(); ok((req.result as T) ?? null); };
        req.onerror = () => { db.close(); ok(null); };
      } catch {
        // Falha ao abrir a transação (banco fechado ou cheio).
        db.close();
        ok(null);
      }
    });
  });
}

export const salvarRascunho = (chave: string, texto: string): Promise<boolean> =>
  transacao('readwrite', (l) => l.put(texto, chave)).then((r) => r !== null);

export const lerRascunho = (chave: string): Promise<string | null> =>
  transacao<string>('readonly', (l) => l.get(chave) as IDBRequest<string>).then((r) => (typeof r === 'string' ? r : null));

export const apagarRascunho = (chave: string): Promise<boolean> =>
  transacao('readwrite', (l) => l.delete(chave)).then(() => true);
