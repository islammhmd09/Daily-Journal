import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { journalRepo } from '../storage';
import { MOODS, todayISO } from '../utils';
import type { JournalEntry, Rating } from '../types';

interface Form { rating: Rating; dayText: string; feelings: string; story: string; forgiveness: string }
const EMPTY: Form = { rating: null, dayText: '', feelings: '', story: '', forgiveness: '' };
type Status = 'idle' | 'saving' | 'saved' | 'empty' | 'error';

const toForm = (e?: JournalEntry): Form =>
  e ? { rating: e.rating, dayText: e.dayText, feelings: e.feelings, story: e.story, forgiveness: e.forgiveness } : EMPTY;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Write({ initialDate }: { initialDate?: string }) {
  const { t } = useI18n();
  const [date, setDate] = useState(initialDate ?? todayISO());
  const [form, setForm] = useState<Form>(EMPTY);
  const [existing, setExisting] = useState<JournalEntry>();
  const [status, setStatus] = useState<Status>('idle');

  // Opening a date that already has a journal loads it for editing.
  useEffect(() => {
    let live = true;
    journalRepo.get(date).then((e) => {
      if (!live) return;
      setExisting(e);
      setForm(toForm(e));
      setStatus('idle');
    }).catch(() => undefined);
    return () => { live = false; };
  }, [date]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    const clean = {
      rating: form.rating,
      dayText: form.dayText.trim(),
      feelings: form.feelings.trim(),
      story: form.story.trim(),
      forgiveness: form.forgiveness.trim(),
    };
    if (clean.rating === null && !clean.dayText && !clean.feelings && !clean.story && !clean.forgiveness) {
      setStatus('empty');
      return;
    }
    setStatus('saving');
    const now = new Date().toISOString();
    try {
      await journalRepo.save({ id: date, date, ...clean, createdAt: existing?.createdAt ?? now, updatedAt: now });
      setStatus('saved');
      setTimeout(() => { location.hash = '#/history'; }, 900);
    } catch {
      setStatus('error');
    }
  }

  const message =
    status === 'saved' ? t.saved
    : status === 'empty' ? t.emptyMsg
    : status === 'error' ? t.saveError
    : existing ? t.editingNote
    : '';

  return (
    <form onSubmit={onSubmit}>
      <h1>{t.writeTitle}</h1>

      <div className="card">
        <Field label={t.date}>
          <input type="date" value={date} max={todayISO()} required
            onChange={(e) => e.target.value && setDate(e.target.value)} />
        </Field>
      </div>

      <div className="card">
        <span className="q">{t.q1}</span>
        <div className="moods" role="group" aria-label={t.q1}>
          {MOODS.map((emoji, i) => {
            const value = (i + 1) as Rating;
            return (
              <button type="button" key={emoji} className="mood-btn" aria-pressed={form.rating === value}
                onClick={() => set('rating', form.rating === value ? null : value)}>
                {emoji}<small>{t.ratings[i]}</small>
              </button>
            );
          })}
        </div>
        <textarea rows={3} aria-label={t.q1} placeholder={t.q1ph} value={form.dayText}
          onChange={(e) => set('dayText', e.target.value)} />
      </div>

      <div className="card">
        <Field label={t.q2}>
          <textarea rows={3} placeholder={t.q2ph} value={form.feelings} onChange={(e) => set('feelings', e.target.value)} />
        </Field>
      </div>

      <div className="card">
        <Field label={t.q3}>
          <textarea rows={7} placeholder={t.q3ph} value={form.story} onChange={(e) => set('story', e.target.value)} />
        </Field>
      </div>

      <div className="card forgive">
        <h2>{t.forgiveTitle}</h2>
        <p className="muted">{t.forgiveHint}</p>
        <textarea rows={4} aria-label={t.forgiveTitle} placeholder={t.forgivePh} value={form.forgiveness}
          onChange={(e) => set('forgiveness', e.target.value)} />
      </div>

      <p className={`msg ${status}`} role="status">{message}</p>
      <button className="btn big" type="submit" disabled={status === 'saving' || status === 'saved'}>
        {status === 'saving' ? t.saving : t.save}
      </button>
    </form>
  );
}
