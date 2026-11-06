import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useI18n } from '../i18n';
import { journalRepo } from '../storage';
import { exportBackup, parseBackup } from '../backup';
import { MOODS, fill, formatDate, formatMonth } from '../utils';
import type { JournalEntry } from '../types';

function Block({ title, text }: { title: string; text: string }) {
  if (!text) return null;
  return (
    <>
      <h3>{title}</h3>
      <p>{text}</p>
    </>
  );
}

export function History() {
  const { t, lang } = useI18n();
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');

  const load = () => journalRepo.list().then(setEntries).catch(() => setEntries([]));
  useEffect(() => { void load(); }, []);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const map = new Map<string, JournalEntry[]>();
    for (const e of entries ?? []) {
      const hay = [e.date, formatDate(e.date, lang), e.dayText, e.feelings, e.story, e.forgiveness].join(' ').toLowerCase();
      if (needle && !hay.includes(needle)) continue;
      const key = e.date.slice(0, 7);
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return Array.from(map);
  }, [entries, query, lang]);

  async function remove(date: string) {
    if (!window.confirm(t.confirmDelete)) return;
    await journalRepo.remove(date);
    await load();
  }

  async function onImport(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const list = parseBackup(await file.text());
      if (!list.length) throw new Error('empty');
      await journalRepo.putMany(list);
      await load();
      setNote(fill(t.importDone, { n: list.length }));
    } catch {
      setNote(t.importFail);
    }
  }

  return (
    <section>
      <h1>{t.historyTitle}</h1>
      <input type="search" placeholder={t.search} aria-label={t.search} value={query}
        onChange={(e) => setQuery(e.target.value)} />

      {entries === null && <p className="muted">{t.loading}</p>}
      {entries?.length === 0 && (
        <p className="muted empty-state">{t.noEntries} <a className="link" href="#/write">{t.newJournal}</a></p>
      )}
      {entries && entries.length > 0 && groups.length === 0 && <p className="muted empty-state">{t.noResults}</p>}

      {groups.map(([key, list]) => (
        <div key={key}>
          <h2 className="month">{formatMonth(key, lang)}</h2>
          {list.map((e) => (
            <details className="card entry" key={e.id}>
              <summary>
                <span className="mood">{e.rating ? MOODS[e.rating - 1] : '📝'}</span>
                <span className="sum">
                  <strong>{formatDate(e.date, lang)}</strong>
                  <small>{(e.story || e.dayText || e.feelings || e.forgiveness).slice(0, 90)}</small>
                </span>
              </summary>
              <div className="body">
                {e.rating && <p>{MOODS[e.rating - 1]} {t.ratings[e.rating - 1]}</p>}
                <Block title={t.q1} text={e.dayText} />
                <Block title={t.q2} text={e.feelings} />
                <Block title={t.q3} text={e.story} />
                <Block title={t.forgiveTitle} text={e.forgiveness} />
                <div className="actions">
                  <a className="btn small" href={`#/write/${e.date}`}>{t.edit}</a>
                  <button className="btn small danger" onClick={() => void remove(e.date)}>{t.del}</button>
                </div>
              </div>
            </details>
          ))}
        </div>
      ))}

      <div className="tools">
        <button className="btn ghost small" disabled={!entries?.length} onClick={() => entries && exportBackup(entries)}>
          {t.exportBtn}
        </button>
        <label className="btn ghost small">
          {t.importBtn}
          <input type="file" accept="application/json,.json" hidden onChange={(e) => void onImport(e)} />
        </label>
      </div>
      <p className="msg" role="status">{note}</p>
    </section>
  );
}
