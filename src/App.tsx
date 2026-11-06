import { useEffect, useState } from 'react';
import { useI18n } from './i18n';
import { Home } from './screens/Home';
import { Write } from './screens/Write';
import { History } from './screens/History';

/** Tiny hash router: #/ , #/write , #/write/2026-01-31 , #/history (works on any static host). */
function useRoute(): [string, string | undefined] {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onChange = () => setHash(location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const [page = '', arg] = hash.replace(/^#\/?/, '').split('/');
  return [page, arg];
}

export function App() {
  const { t, lang, setLang } = useI18n();
  const [page, arg] = useRoute();
  const date = arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : undefined;

  return (
    <div className="app">
      <header className="bar">
        <a className="brand" href="#/">{t.appName}</a>
        <nav>
          <a href="#/history">{t.history}</a>
          <button className="btn ghost small" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>
            {t.otherLang}
          </button>
        </nav>
      </header>
      <main>
        {page === 'write' ? <Write key={date ?? 'today'} initialDate={date} /> : page === 'history' ? <History /> : <Home />}
      </main>
    </div>
  );
}
