import type { PlayerIdentity } from './playerApi';

/** Where the device identity lives between visits. IndexedDB only: localStorage is not allowed in this project. */
export interface IdentityStorage {
  load: () => Promise<PlayerIdentity | null>;
  save: (identity: PlayerIdentity) => Promise<void>;
}

const DB_NAME = 'typefight';
const STORE = 'identity';
const KEY = 'player';

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export const runIdentityStorage = async <T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

const isIdentity = (value: unknown): value is PlayerIdentity => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['playerId'] === 'string' &&
    typeof candidate['nickname'] === 'string' &&
    typeof candidate['deviceToken'] === 'string'
  );
};

export const indexedDbIdentityStorage: IdentityStorage = {
  load: async () => {
    try {
      const value: unknown = await runIdentityStorage('readonly', (store) => store.get(KEY));
      return isIdentity(value) ? value : null;
    } catch {
      return null;
    }
  },
  save: async (identity) => {
    await runIdentityStorage('readwrite', (store) => store.put(identity, KEY));
  },
};
