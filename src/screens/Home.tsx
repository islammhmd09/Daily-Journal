import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { journalRepo } from '../storage';
import { fill } from '../utils';

export function Home() {
  const { t } = useI18n();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    journalRepo.list().then((l) => setCount(l.length)).catch(() => undefined);
  }, []);

  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 12 ? t.greetMorning : hour < 18 ? t.greetAfternoon : t.greetEvening;
  const dayNumber = Math.floor((now.getTime() - now.getTimezoneOffset() * 60000) / 86400000);
  const phrase = t.phrases[dayNumber % t.phrases.length];

  return (
    <section className="hero">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <mask id="moon">
            <rect width="64" height="64" fill="#fff" />
            <circle cx="40" cy="26" r="18" fill="#000" />
          </mask>
        </defs>
        <circle cx="30" cy="32" r="22" fill="#4ade80" mask="url(#moon)" />
      </svg>
      <p className="greet">{greet}</p>
      <blockquote>{phrase}</blockquote>
      <a className="btn big" href="#/write">{t.newJournal}</a>
      <a className="link" href="#/history">{t.history}</a>
      {count !== null && count > 0 && <p className="muted">{fill(t.savedCount, { n: count })}</p>}
      <p className="muted">{t.privacy}</p>
    </section>
  );
}
