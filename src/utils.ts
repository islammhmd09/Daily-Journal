import type { Lang } from './types';

export const MOODS = ['😞', '🙁', '😐', '🙂', '😄'];
const pad = (n: number) => String(n).padStart(2, '0');
const locale = (lang: Lang) => (lang === 'ar' ? 'ar-EG' : 'en-US');

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(lang), {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(y, m - 1, d));
}

export function formatMonth(key: string, lang: Lang): string {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(lang), { year: 'numeric', month: 'long' }).format(new Date(y, m - 1, 1));
}

export const fill = (s: string, v: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ''));
