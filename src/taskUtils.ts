import type { Task, TaskStatus } from './types';

export const NEXT: Record<TaskStatus, TaskStatus> = { todo: 'partial', partial: 'done', done: 'todo' };

export function newId(): string {
  const c = globalThis.crypto;
  return c && 'randomUUID' in c ? c.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

/** Does this task show up on `date`? Long-term tasks show every day from their start day. */
export const appliesTo = (t: Task, date: string): boolean => (t.pinned ? date >= t.date : t.date === date);

export const statusOn = (t: Task, date: string): TaskStatus => (t.pinned ? t.log[date] ?? 'todo' : t.status);

export function withStatus(t: Task, date: string, s: TaskStatus, now: string): Task {
  if (!t.pinned) return { ...t, status: s, updatedAt: now };
  const log = { ...t.log };
  if (s === 'todo') delete log[date]; else log[date] = s;
  return { ...t, log, updatedAt: now };
}

export function byTime(a: Task, b: Task): number {
  if (!!a.time !== !!b.time) return a.time ? -1 : 1;
  return a.time.localeCompare(b.time) || a.createdAt.localeCompare(b.createdAt);
}

export interface Sections { pinned: Task[]; groups: { label: string; tasks: Task[] }[]; singles: Task[] }

export function buildSections(visible: Task[]): Sections {
  const sorted = [...visible].sort(byTime);
  const groups = new Map<string, { label: string; tasks: Task[] }>();
  const singles: Task[] = [];
  for (const t of sorted.filter((x) => !x.pinned)) {
    const label = t.group.trim();
    if (!label) { singles.push(t); continue; }
    const entry = groups.get(label.toLowerCase()) ?? { label, tasks: [] };
    entry.tasks.push(t);
    groups.set(label.toLowerCase(), entry);
  }
  return {
    pinned: sorted.filter((x) => x.pinned),
    groups: Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label)),
    singles,
  };
}

export function progress(visible: Task[], date: string) {
  let done = 0, partial = 0;
  for (const t of visible) {
    const s = statusOn(t, date);
    if (s === 'done') done++; else if (s === 'partial') partial++;
  }
  const total = visible.length;
  return { total, done, partial, percent: total ? Math.round(((done + partial / 2) / total) * 100) : 0 };
}
