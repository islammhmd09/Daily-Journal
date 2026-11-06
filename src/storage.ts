import type { JournalEntry } from './types';

/**
 * Storage contract. The UI only talks to this interface, so moving to a cloud
 * database later (Supabase, Vercel Postgres, Firebase...) means writing one new
 * implementation and swapping `journalRepo` below. No screen needs to change.
 */
export interface JournalRepository {
  list(): Promise<JournalEntry[]>; // newest first
  get(date: string): Promise<JournalEntry | undefined>;
  save(entry: JournalEntry): Promise<void>; // insert or update by date
  remove(date: string): Promise<void>;
  putMany(entries: JournalEntry[]): Promise<void>;
}

const DB_NAME = 'daily-journal';
const STORE = 'entries';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'date' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const db = () => (dbPromise ??= openDb());

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(req.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

export const journalRepo: JournalRepository = {
  async list() {
    const all = await run<JournalEntry[]>('readonly', (s) => s.getAll());
    return all.sort((a, b) => b.date.localeCompare(a.date));
  },
  get: (date) => run<JournalEntry | undefined>('readonly', (s) => s.get(date)),
  save: (entry) => run('readwrite', (s) => s.put(entry)).then(() => undefined),
  remove: (date) => run('readwrite', (s) => s.delete(date)).then(() => undefined),
  putMany: (entries) =>
    db().then(
      (d) =>
        new Promise<void>((resolve, reject) => {
          const tx = d.transaction(STORE, 'readwrite');
          const store = tx.objectStore(STORE);
          entries.forEach((e) => store.put(e));
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        })
    ),
};
