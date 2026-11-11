/**
 * Sync engine: local-first, last-write-wins per record, with tombstones for deletes.
 * Pure logic (no React, no Supabase, no browser globals) so it can be unit-tested.
 */
export type Kind = 'journal' | 'task';
export interface Syncable { id: string; updatedAt: string }

export interface LocalStore {
  all(): Promise<Syncable[]>;
  put(items: Syncable[]): Promise<void>;
  del(id: string): Promise<void>;
}
export interface Row {
  kind: Kind; id: string; data: Syncable | null;
  updated_at: string; deleted: boolean; synced_at: string; // synced_at is set by the server
}
export type PushRow = Omit<Row, 'synced_at'>;
export interface Remote {
  pull(sinceISO: string): Promise<Row[]>;
  push(rows: PushRow[]): Promise<void>;
}
export interface KV { getItem(key: string): string | null; setItem(key: string, value: string): void }

type Rec = Record<string, string>;
const DIRTY = 'sync:dirty'; // records changed here, not yet pushed
const TOMB = 'sync:tomb';   // records deleted here, not yet pushed
const OVERLAP_MS = 10 * 60 * 1000; // re-read a safety window on every pull (merging is idempotent)
const EPOCH = '1970-01-01T00:00:00.000Z';
const ms = (s: string) => Date.parse(s);
const key = (kind: string, id: string) => `${kind}:${id}`;

export class SyncEngine {
  private stores = new Map<Kind, LocalStore>();
  private seq = 0;
  private kv: KV;

  constructor(kv: KV) { this.kv = kv; }

  register(kind: Kind, store: LocalStore): void { this.stores.set(kind, store); }

  private stamp(): string { return `${Date.now()}.${this.seq++}`; }
  private load(k: string): Rec {
    try { const v = this.kv.getItem(k); return v ? (JSON.parse(v) as Rec) : {}; } catch { return {}; }
  }
  private save(k: string, v: Rec): void {
    try { this.kv.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ }
  }

  markSaved(kind: Kind, id: string): void {
    const k = key(kind, id);
    const dirty = this.load(DIRTY); dirty[k] = this.stamp(); this.save(DIRTY, dirty);
    const tomb = this.load(TOMB);
    if (tomb[k]) { delete tomb[k]; this.save(TOMB, tomb); }
  }

  markRemoved(kind: Kind, id: string): void {
    const k = key(kind, id);
    const tomb = this.load(TOMB); tomb[k] = new Date().toISOString(); this.save(TOMB, tomb);
    const dirty = this.load(DIRTY);
    if (dirty[k]) { delete dirty[k]; this.save(DIRTY, dirty); }
  }

  hasPending(): boolean {
    return Object.keys(this.load(DIRTY)).length + Object.keys(this.load(TOMB)).length > 0;
  }

  private async snapshot(): Promise<Map<string, Syncable>> {
    const out = new Map<string, Syncable>();
    for (const [kind, store] of this.stores) {
      for (const item of await store.all()) out.set(key(kind, item.id), item);
    }
    return out;
  }

  /** First sync for an account: everything already on this device must be offered to the cloud. */
  private async markAll(): Promise<void> {
    const snap = await this.snapshot();
    const dirty = this.load(DIRTY);
    for (const k of snap.keys()) dirty[k] ??= this.stamp();
    this.save(DIRTY, dirty);
  }

  /** One full sync: pull, merge, push. Returns how many local records were changed by the pull. */
  async run(remote: Remote, uid: string): Promise<number> {
    const initKey = `sync:init:${uid}`;
    const pullKey = `sync:pull:${uid}`;
    if (!this.kv.getItem(initKey)) await this.markAll();

    const since = this.kv.getItem(pullKey) ?? EPOCH;
    const rows = await remote.pull(new Date(Math.max(0, ms(since) - OVERLAP_MS)).toISOString());
    const changed = await this.apply(rows);
    let cursor = since;
    for (const r of rows) if (ms(r.synced_at) > ms(cursor)) cursor = r.synced_at;

    await this.push(remote);
    this.kv.setItem(pullKey, cursor);
    this.kv.setItem(initKey, '1');
    return changed;
  }

  private async apply(rows: Row[]): Promise<number> {
    const local = await this.snapshot();
    const dirty0 = this.load(DIRTY);
    const tomb0 = this.load(TOMB);
    const puts = new Map<Kind, Syncable[]>();
    const clearDirty = new Set<string>();
    const clearTomb = new Set<string>();
    const needPush = new Set<string>();
    let changed = 0;

    for (const r of rows) {
      const store = this.stores.get(r.kind);
      if (!store) continue;
      const k = key(r.kind, r.id);
      const mine = local.get(k);
      const remoteTime = ms(r.updated_at);

      if (tomb0[k] && ms(tomb0[k]) >= remoteTime) continue; // our delete is newer: it will be pushed

      if (r.deleted) {
        if (mine && ms(mine.updatedAt) > remoteTime) { needPush.add(k); continue; } // edited after the delete: keep it
        if (mine) { await store.del(r.id); changed++; }
        clearDirty.add(k); clearTomb.add(k);
        continue;
      }
      if (!r.data) continue;
      if (!mine || remoteTime > ms(mine.updatedAt)) {
        const list = puts.get(r.kind) ?? [];
        list.push({ ...r.data, id: r.id });
        puts.set(r.kind, list);
        clearDirty.add(k); clearTomb.add(k);
        changed++;
      } else if (remoteTime === ms(mine.updatedAt)) {
        clearDirty.add(k);
      } else {
        needPush.add(k); // local is newer
      }
    }
    for (const [kind, items] of puts) await this.stores.get(kind)!.put(items);

    // Re-read right before writing so edits made while we were awaiting are not lost.
    const dirty = this.load(DIRTY);
    const tomb = this.load(TOMB);
    for (const k of clearDirty) if (dirty[k] === dirty0[k]) delete dirty[k];
    for (const k of clearTomb) if (tomb[k] === tomb0[k]) delete tomb[k];
    for (const k of needPush) dirty[k] ??= this.stamp();
    this.save(DIRTY, dirty);
    this.save(TOMB, tomb);
    return changed;
  }

  private async push(remote: Remote): Promise<void> {
    const dirty = this.load(DIRTY);
    const tomb = this.load(TOMB);
    const local = await this.snapshot();
    const rows: PushRow[] = [];
    const split = (k: string) => ({ kind: k.slice(0, k.indexOf(':')) as Kind, id: k.slice(k.indexOf(':') + 1) });

    for (const k of Object.keys(dirty)) {
      const item = local.get(k);
      const { kind, id } = split(k);
      if (item && this.stores.has(kind)) rows.push({ kind, id, data: item, updated_at: item.updatedAt, deleted: false });
    }
    for (const [k, at] of Object.entries(tomb)) {
      const { kind, id } = split(k);
      if (this.stores.has(kind)) rows.push({ kind, id, data: null, updated_at: at, deleted: true });
    }
    for (let i = 0; i < rows.length; i += 100) await remote.push(rows.slice(i, i + 100));

    const dirtyNow = this.load(DIRTY);
    const tombNow = this.load(TOMB);
    for (const [k, s] of Object.entries(dirty)) if (dirtyNow[k] === s) delete dirtyNow[k];
    for (const [k, s] of Object.entries(tomb)) if (tombNow[k] === s) delete tombNow[k];
    this.save(DIRTY, dirtyNow);
    this.save(TOMB, tombNow);
  }
}
