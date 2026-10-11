// Tiny IndexedDB wrapper. Everything stays on this device.

const DB_NAME = 'steady';
const DB_VERSION = 1;
export const STORES = ['kv', 'sessions', 'cache', 'checkins', 'diary', 'experiments', 'trials'] as const;
export type StoreName = (typeof STORES)[number];

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is not available'));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) {
          db.createObjectStore(s, s === 'kv' || s === 'cache' ? undefined : { keyPath: 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export const db = {
  get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
    return tx(store, 'readonly', (s) => s.get(key));
  },
  put<T>(store: StoreName, value: T, key?: IDBValidKey): Promise<IDBValidKey> {
    return tx(store, 'readwrite', (s) => (key === undefined ? s.put(value) : s.put(value, key)));
  },
  all<T>(store: StoreName): Promise<T[]> {
    return tx(store, 'readonly', (s) => s.getAll());
  },
  delete(store: StoreName, key: IDBValidKey): Promise<undefined> {
    return tx(store, 'readwrite', (s) => s.delete(key));
  },
  clear(store: StoreName): Promise<undefined> {
    return tx(store, 'readwrite', (s) => s.clear());
  },
};

export function uid(): string {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}
