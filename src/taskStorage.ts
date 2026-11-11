import type { Task } from './types';
import { markRemoved, markSaved, registerStore } from './sync';

export interface TaskRepository {
  list(): Promise<Task[]>;
  save(task: Task): Promise<void>; // insert or update by id
  remove(id: string): Promise<void>;
  putMany(tasks: Task[]): Promise<void>;
}

const DB_NAME = 'daily-tasks';
const STORE = 'tasks';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
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

const local: TaskRepository = {
  list: () => run<Task[]>('readonly', (s) => s.getAll()),
  save: (task) => run('readwrite', (s) => s.put(task)).then(() => undefined),
  remove: (id) => run('readwrite', (s) => s.delete(id)).then(() => undefined),
  putMany: (tasks) =>
    db().then(
      (d) =>
        new Promise<void>((resolve, reject) => {
          const tx = d.transaction(STORE, 'readwrite');
          const store = tx.objectStore(STORE);
          tasks.forEach((t) => store.put(t));
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        })
    ),
};

/** Same repository pattern as the journal: screens use this, sync hooks are added here. */
export const taskRepo: TaskRepository = {
  ...local,
  async save(task) { await local.save(task); markSaved('task', task.id); },
  async remove(id) { await local.remove(id); markRemoved('task', id); },
  async putMany(tasks) { await local.putMany(tasks); tasks.forEach((t) => markSaved('task', t.id)); },
};

registerStore('task', {
  all: () => local.list(),
  put: (items) => local.putMany(items as Task[]),
  del: (id) => local.remove(id),
});
