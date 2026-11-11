import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from './i18n';
import { useDataVersion, useSyncState } from './sync';
import { BookIcon, ChecklistIcon, CloudIcon } from './icons';
import { Home } from './screens/Home';
import { Write } from './screens/Write';
import { History } from './screens/History';
import { Tasks } from './screens/Tasks';
import { Sync } from './screens/Sync';

/** Tiny hash router: #/ , #/write , #/write/2026-01-31 , #/history , #/tasks , #/tasks/2026-01-31 , #/sync */
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
  const version = useDataVersion(); // changes when a cloud sync brought in new data
  const sync = useSyncState();
  const date = arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : undefined;

  const navIcon = (href: string, current: boolean, label: string, icon: ReactNode, extra?: ReactNode) => (
    <a className="icon-btn" href={href} aria-label={label} title={label} aria-current={current ? 'page' : undefined}>
      {icon}{extra}
    </a>
  );
  const dot = sync.error ? 'err' : sync.busy ? 'busy' : sync.email ? 'on' : '';

  return (
    <div className="app">
      <header className="bar">
        <a className="brand" href="#/">{t.appName}</a>
        <nav>
          {navIcon('#/history', page === 'history' || page === 'write', t.history, <BookIcon />)}
          {navIcon('#/tasks', page === 'tasks', t.navTasks, <ChecklistIcon />)}
          {navIcon('#/sync', page === 'sync', t.navSync, <CloudIcon />, sync.enabled ? <span className={`dot ${dot}`} /> : null)}
          <button className="btn ghost small" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>
            {t.otherLang}
          </button>
        </nav>
      </header>
      <main>
        {page === 'write' ? <Write key={date ?? 'today'} initialDate={date} />
          : page === 'history' ? <History key={version} />
          : page === 'tasks' ? <Tasks date={date} />
          : page === 'sync' ? <Sync />
          : <Home key={version} />}
      </main>
    </div>
  );
}
