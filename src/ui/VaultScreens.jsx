// Screens shown before the journal opens: first visit, recovery key, locked vault,
// restore from a backup file, connecting a new device to the account.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon.jsx';
import { RecoveryKeyBox } from './DataPage.jsx';
import { JoinPanel } from './JoinPanel.jsx';
import { Campfire } from './Illustrations.jsx';
import { LangSelect } from './common.jsx';
import { useI18n } from '../app/i18n.js';
import { createApi, syncAvailable } from '../core/api.js';
import { backupSummary, parseBackup } from '../core/backup.js';
import { headerFromJson } from '../core/sync.js';

function Frame({ children, onLang, lang }) {
  return (
    <main className="gate">
      <div className="gate-top">
        <span className="logo">Gamefolk</span>
        <LangSelect lang={lang} onChange={onLang} />
      </div>
      <div className="gate-card card">{children}</div>
    </main>
  );
}

export function WelcomeScreen({ onStart, onRestore, onLang, loginFailed }) {
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [restoring, setRestoring] = useState(false);

  if (restoring) return <RestoreScreen onRestore={onRestore} onBack={() => setRestoring(false)} onLang={onLang} />;

  return (
    <Frame onLang={onLang} lang={lang}>
      <Campfire />
      <h1>Gamefolk</h1>
      <p className="lead">{t('welcome.lead')}</p>
      <ul className="points">
        <li><Icon name="lock" size={18} />{t('welcome.point1')}</li>
        <li><Icon name="check" size={18} />{t('welcome.point2')}</li>
        <li><Icon name="people" size={18} />{t('welcome.point3')}</li>
      </ul>
      <form className="form" onSubmit={async event => { event.preventDefault(); setBusy(true); await onStart(name); }}>
        <div className="field">
          <label htmlFor="welcome-name">{t('welcome.name')}</label>
          <input id="welcome-name" value={name} maxLength={40} autoComplete="given-name" onChange={e => setName(e.target.value)} />
          <p className="hint">{t('welcome.nameHint')}</p>
        </div>
        <button type="submit" className="btn btn-primary btn-wide" disabled={busy}>{t('welcome.start')}</button>
      </form>
      {loginFailed && <p className="error" role="alert">{t('sync.loginFailed')}</p>}
      <div className="gate-links">
        {syncAvailable() && <a className="link-btn" href="/api/auth/google/start"><Icon name="sync" size={16} />{t('welcome.haveAccount')}</a>}
        <button type="button" className="link-btn" onClick={() => setRestoring(true)}><Icon name="upload" size={16} />{t('welcome.restore')}</button>
      </div>
    </Frame>
  );
}

function RestoreScreen({ onRestore, onBack, onLang }) {
  const { t, lang } = useI18n();
  const input = useRef(null);
  const [backup, setBackup] = useState(null);
  const [recovery, setRecovery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = async file => {
    if (!file) return;
    setError('');
    try {
      setBackup(parseBackup(await file.text()));
    } catch {
      setBackup(null);
      setError(t('restore.bad'));
    }
  };

  const submit = async event => {
    event.preventDefault();
    if (!backup || !recovery.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onRestore(backup, recovery);
    } catch (err) {
      setError(err.message === 'bad-recovery-format' ? t('unlock.recoveryFormat') : t('unlock.recoveryWrong'));
      setBusy(false);
    }
  };

  return (
    <Frame onLang={onLang} lang={lang}>
      <h1>{t('restore.title')}</h1>
      <p className="muted">{t('restore.newText')}</p>
      <form className="form" onSubmit={submit}>
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => input.current?.click()}><Icon name="upload" size={16} />{t('restore.pick')}</button>
          <input ref={input} type="file" accept=".gamefolk,application/json,application/octet-stream" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {backup && <p>{t('restore.summary', backupSummary(backup))}</p>}
        <div className="field">
          <label htmlFor="restore-new-key">{t('unlock.recoveryLabel')}</label>
          <input id="restore-new-key" value={recovery} spellCheck="false" autoComplete="off" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" onChange={e => setRecovery(e.target.value)} />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-wide" disabled={!backup || busy}>{t('restore.apply')}</button>
      </form>
      <button type="button" className="link-btn" onClick={onBack}><Icon name="back" size={16} />{t('action.cancel')}</button>
    </Frame>
  );
}

// A fresh device right after signing in with Google.
export function ConnectScreen({ onKey, onStartFresh, onCancel, onLang }) {
  const { t, lang } = useI18n();
  const api = useMemo(() => createApi(), []);
  const [state, setState] = useState({ phase: 'loading' });

  useEffect(() => {
    (async () => {
      try {
        const me = await api.get('me');
        if (!me.hasVault) return setState({ phase: 'empty', me });
        setState({ phase: 'join', me, header: headerFromJson(await api.get('vault')) });
      } catch {
        setState({ phase: 'error' });
      }
    })();
  }, [api]);

  return (
    <Frame onLang={onLang} lang={lang}>
      {state.phase === 'loading' && <p className="waiting"><span className="dots" aria-hidden="true"><i /><i /><i /></span>{t('join.checking')}</p>}
      {state.phase === 'error' && <p className="error">{t('sync.loginFailed')}</p>}
      {state.phase === 'empty' && (
        <>
          <h1>{t('join.emptyTitle')}</h1>
          <p className="muted">{t('join.emptyText')}</p>
          <button type="button" className="btn btn-primary btn-wide" onClick={onStartFresh}>{t('welcome.start')}</button>
        </>
      )}
      {state.phase === 'join' && (
        <>
          <h1>{t('join.title')}</h1>
          <p className="muted">{t('join.text')}</p>
          <JoinPanel api={api} header={state.header} onKey={key => onKey(key, state.header, state.me.email)} />
        </>
      )}
      <button type="button" className="link-btn" onClick={onCancel}><Icon name="back" size={16} />{t('action.cancel')}</button>
    </Frame>
  );
}

export function RecoveryScreen({ recoveryKey, onDone, onLang }) {
  const { t, lang } = useI18n();
  const [saved, setSaved] = useState(false);
  return (
    <Frame onLang={onLang} lang={lang}>
      <h1>{t('recovery.title')}</h1>
      <p className="muted">{t('recovery.text')}</p>
      <RecoveryKeyBox recoveryKey={recoveryKey} />
      <label className="check">
        <input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />
        <span>{t('recovery.confirm')}</span>
      </label>
      <div className="row-actions">
        <button type="button" className="btn btn-primary" disabled={!saved} onClick={() => onDone(true)}>{t('recovery.continue')}</button>
        <button type="button" className="link-btn" onClick={() => onDone(false)}>{t('recovery.later')}</button>
      </div>
    </Frame>
  );
}

export function UnlockScreen({ onPasscode, onRecovery, onLang }) {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState('code');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async event => {
    event.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError('');
    try {
      if (mode === 'code') await onPasscode(value);
      else await onRecovery(value);
    } catch (err) {
      const code = err?.message;
      setError(code === 'bad-recovery-format' ? t('unlock.recoveryFormat') : mode === 'code' ? t('unlock.wrong') : t('unlock.recoveryWrong'));
      setBusy(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'code' ? 'recovery' : 'code');
    setValue('');
    setError('');
  };

  return (
    <Frame onLang={onLang} lang={lang}>
      <span className="gate-icon"><Icon name="lock" size={26} /></span>
      <h1>{mode === 'code' ? t('unlock.title') : t('unlock.recoveryTitle')}</h1>
      {mode === 'code' && <p className="muted">{t('unlock.text')}</p>}
      {mode === 'recovery' && <p className="muted">{t('unlock.afterRecovery')}</p>}
      <form className="form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="unlock-input">{mode === 'code' ? t('unlock.code') : t('unlock.recoveryLabel')}</label>
          <input
            id="unlock-input" autoFocus value={value} onChange={e => setValue(e.target.value)}
            type={mode === 'code' ? 'password' : 'text'} autoComplete={mode === 'code' ? 'current-password' : 'off'}
            spellCheck="false" placeholder={mode === 'recovery' ? 'XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX' : ''}
          />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary btn-wide" disabled={busy}>{busy ? t('unlock.opening') : t('unlock.open')}</button>
      </form>
      <button type="button" className="link-btn" onClick={switchMode}>{mode === 'code' ? t('unlock.forgot') : t('unlock.useCode')}</button>
    </Frame>
  );
}

export function ErrorScreen({ onLang }) {
  const { t, lang } = useI18n();
  return (
    <Frame onLang={onLang} lang={lang}>
      <p className="error">{t('error.storage')}</p>
    </Frame>
  );
}
