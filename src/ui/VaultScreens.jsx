// Screens shown before the journal opens: first visit, recovery key, locked vault.
import { useState } from 'react';
import { Icon } from './Icon.jsx';
import { RecoveryKeyBox } from './DataPage.jsx';
import { useI18n } from '../app/i18n.js';

function Frame({ children, onLang, lang }) {
  return (
    <main className="gate">
      <div className="gate-top">
        <span className="logo">Gamefolk</span>
        <button type="button" className="icon-btn lang-btn" onClick={onLang}>{lang.toUpperCase()}</button>
      </div>
      <div className="gate-card card">{children}</div>
    </main>
  );
}

export function WelcomeScreen({ onStart, onLang }) {
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <Frame onLang={onLang} lang={lang}>
      <h1>Gamefolk</h1>
      <p className="lead">{t('welcome.lead')}</p>
      <ul className="points">
        <li><Icon name="lock" size={18} />{t('welcome.point1')}</li>
        <li><Icon name="check" size={18} />{t('welcome.point2')}</li>
        <li><Icon name="people" size={18} />{t('welcome.point3')}</li>
      </ul>
      <button type="button" className="btn btn-primary btn-wide" disabled={busy} onClick={async () => { setBusy(true); await onStart(); }}>
        {t('welcome.start')}
      </button>
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
