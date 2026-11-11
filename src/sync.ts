import { useSyncExternalStore } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SyncEngine, type KV, type Kind, type LocalStore, type PushRow, type Remote, type Row } from './syncCore';

const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabase: SupabaseClient | null = SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null;
export const syncEnabled = supabase !== null;

const kv: KV = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
const engine = new SyncEngine(kv);

// ---------- tiny observable state ----------
export interface SyncState { enabled: boolean; email: string | null; busy: boolean; error: string | null; lastSync: string | null }
let state: SyncState = { enabled: syncEnabled, email: null, busy: false, error: null, lastSync: kv.getItem('sync:last') };
let version = 0; // bumps whenever a sync changed local data, so screens can reload
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
function setState(patch: Partial<SyncState>) { state = { ...state, ...patch }; listeners.forEach((l) => l()); }
export const useSyncState = (): SyncState => useSyncExternalStore(subscribe, () => state);
export const useDataVersion = (): number => useSyncExternalStore(subscribe, () => version);

// ---------- used by the repositories ----------
export const registerStore = (kind: Kind, store: LocalStore) => engine.register(kind, store);
let timer: number | undefined;
function schedule() {
  if (!state.email) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), 1500);
}
export function markSaved(kind: Kind, id: string) { engine.markSaved(kind, id); schedule(); }
export function markRemoved(kind: Kind, id: string) { engine.markRemoved(kind, id); schedule(); }

// ---------- Supabase transport ----------
function remoteFor(sb: SupabaseClient, uid: string): Remote {
  const PAGE = 1000;
  return {
    async pull(since) {
      const out: Row[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await sb.from('records')
          .select('kind,id,data,updated_at,deleted,synced_at')
          .gt('synced_at', since).order('synced_at').order('kind').order('id').range(from, from + PAGE - 1);
        if (error) throw error;
        const page = (data ?? []) as Row[];
        out.push(...page);
        if (page.length < PAGE) break;
      }
      return out;
    },
    async push(rows: PushRow[]) {
      const { error } = await sb.from('records').upsert(rows.map((r) => ({ ...r, user_id: uid })), { onConflict: 'user_id,kind,id' });
      if (error) throw error;
    },
  };
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e));

let running: Promise<void> | null = null;
let again = false;
let lastRun = 0;

async function doSync(sb: SupabaseClient): Promise<void> {
  if (!navigator.onLine) return;
  try {
    const { data } = await sb.auth.getSession();
    const session = data.session;
    if (!session) return;
    setState({ busy: true, error: null });
    const changed = await engine.run(remoteFor(sb, session.user.id), session.user.id);
    const lastSync = new Date().toISOString();
    kv.setItem('sync:last', lastSync);
    if (changed > 0) version++;
    setState({ busy: false, lastSync });
  } catch (e) {
    setState({ busy: false, error: errorMessage(e) });
  } finally {
    lastRun = Date.now();
  }
}

/** Runs a sync now (calls made while one is running are merged into one follow-up run). */
export function syncNow(): Promise<void> {
  if (!supabase) return Promise.resolve();
  if (running) { again = true; return running; }
  running = doSync(supabase).finally(() => {
    running = null;
    if (again) { again = false; void syncNow(); }
  });
  return running;
}

// ---------- auth ----------
export interface AuthResult { error?: string; confirm?: boolean }

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { error: 'Cloud sync is not configured.' };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { error: error.message } : {};
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (!supabase) return { error: 'Cloud sync is not configured.' };
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  return data.session ? {} : { confirm: true };
}

export async function signOut(): Promise<void> { await supabase?.auth.signOut(); }

let started = false;
export function initSync(): void {
  if (!supabase || started) return;
  started = true;
  supabase.auth.onAuthStateChange((event, session) => {
    setState({ email: session?.user.email ?? null });
    if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) setTimeout(() => void syncNow(), 0);
  });
  window.addEventListener('online', () => void syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastRun > 30_000) void syncNow();
  });
}
