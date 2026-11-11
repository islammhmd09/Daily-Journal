import { useState } from 'react';
import { useI18n } from '../i18n';
import { signIn, signOut, signUp, syncNow, useSyncState } from '../sync';
import { RefreshIcon } from '../icons';
import { fill } from '../utils';

export function Sync() {
  const { t, lang } = useI18n();
  const s = useSyncState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [working, setWorking] = useState(false);

  async function auth(mode: 'in' | 'up') {
    setWorking(true);
    setMsg('');
    const r = mode === 'in' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setWorking(false);
    if (r.error) setMsg(r.error);
    else if (r.confirm) setMsg(t.confirmEmail);
  }

  if (!s.enabled) {
    return (
      <section>
        <h1>{t.syncTitle}</h1>
        <p className="card muted">{t.syncOff}</p>
      </section>
    );
  }

  return (
    <section>
      <h1>{t.syncTitle}</h1>
      {s.email ? (
        <div className="card">
          <p>{fill(t.signedInAs, { email: s.email })}</p>
          <p className="muted">
            {s.busy ? t.syncing : s.lastSync ? fill(t.lastSynced, { time: new Date(s.lastSync).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US') }) : t.neverSynced}
          </p>
          {s.error && <p className="msg error" role="alert">{fill(t.syncErr, { msg: s.error })}</p>}
          <div className="actions">
            <button className="btn" disabled={s.busy} onClick={() => void syncNow()}>
              <RefreshIcon width={18} height={18} />&nbsp;{s.busy ? t.syncing : t.syncNow}
            </button>
            <button className="btn ghost" onClick={() => void signOut()}>{t.signOut}</button>
          </div>
        </div>
      ) : (
        <form className="card" onSubmit={(e) => { e.preventDefault(); void auth('in'); }}>
          <p className="muted">{t.syncIntro}</p>
          <label className="field"><span>{t.email}</span>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="field"><span>{t.password}</span>
            <input type="password" autoComplete="current-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <p className="msg error" role="alert">{msg}</p>
          <div className="actions">
            <button className="btn" type="submit" disabled={working}>{t.signIn}</button>
            <button className="btn ghost" type="button" disabled={working} onClick={() => void auth('up')}>{t.signUp}</button>
          </div>
        </form>
      )}
      <p className="muted">{t.syncNote}</p>
    </section>
  );
}
