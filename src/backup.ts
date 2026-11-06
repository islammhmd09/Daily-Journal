import type { JournalEntry, Rating } from './types';
import { todayISO } from './utils';

export function exportBackup(entries: JournalEntry[]): void {
  const payload = { app: 'daily-journal', version: 1, exportedAt: new Date().toISOString(), entries };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `journal-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Parses a backup file; invalid rows are skipped. Throws on invalid JSON. */
export function parseBackup(text: string): JournalEntry[] {
  const data = JSON.parse(text);
  const raw: unknown[] = Array.isArray(data?.entries) ? data.entries : [];
  const now = new Date().toISOString();
  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  return raw.flatMap((r) => {
    const e = r as Partial<JournalEntry>;
    if (typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return [];
    const rating = [1, 2, 3, 4, 5].includes(e.rating as number) ? (e.rating as Rating) : null;
    return [{
      id: e.date, date: e.date, rating,
      dayText: str(e.dayText), feelings: str(e.feelings), story: str(e.story), forgiveness: str(e.forgiveness),
      createdAt: str(e.createdAt) || now, updatedAt: str(e.updatedAt) || now,
    }];
  });
}
