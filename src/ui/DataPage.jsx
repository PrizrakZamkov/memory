import { useEffect, useState } from 'react';
import { Icon } from './Icon.jsx';
import { copyText, downloadText, Modal } from './common.jsx';
import { useI18n } from '../app/i18n.js';
import { useApp } from '../app/context.js';
import { MIN_PASSCODE_LENGTH } from '../core/vault.js';
import { SyncSection } from './SyncSection.jsx';
import { BackupSection } from './BackupSection.jsx';

const LOCK_OPTIONS = [5, 15, 30, 60];

export function DataPage() {
  const { t, lang } = useI18n();
  const { vault, data, ui } = useApp();
  const [dialog, setDialog] = useState(null);
  const settings = vault.settings || {};

  return (
    <div className="page narrow">
      <div className="page-head"><h1>{t('data.title')}</h1></div>

      <ProfileSection />
      <SyncSection />
      <BackupSection />

      <section className="card settings-card">
        <h2>{t('data.vault')}</h2>
        <p className="muted">{t('data.vaultText')}</p>

        <div className="setting">
          <div>
            <h3>{t('data.passcode')}</h3>
            <p className="muted">{settings.hasPasscode ? t('data.passcodeOn') : t('data.passcodeOff')}</p>
          </div>
          <div className="row-actions">
            <button type="button" className="btn" onClick={() => setDialog('passcode')}>
              {settings.hasPasscode ? t('data.changePasscode') : t('data.setPasscode')}
            </button>
            {settings.hasPasscode && (
              <button type="button" className="btn" onClick={async () => { await vault.removePasscode(); ui.toast(t('passcode.removed')); }}>
                {t('data.removePasscode')}
              </button>
            )}
          </div>
        </div>

        {settings.hasPasscode && (
          <div className="setting">
            <label htmlFor="auto-lock"><h3>{t('data.autoLock')}</h3></label>
            <select id="auto-lock" value={settings.autoLockMinutes} onChange={e => vault.updateSettings({ autoLockMinutes: Number(e.target.value) })}>
              {LOCK_OPTIONS.map(m => <option key={m} value={m}>{t('data.minutes', { count: m })}</option>)}
            </select>
          </div>
        )}

        <div className="setting">
          <div>
            <h3>{t('data.recovery')}</h3>
            <p className="muted">{t('data.recoveryText')}</p>
            {!settings.recoverySaved && <p className="warning">{t('data.recoveryNotSaved')}</p>}
          </div>
          <button type="button" className="btn" onClick={() => setDialog('recovery')}>{t('data.showRecovery')}</button>
        </div>

        <div className="setting">
          <div>
            <h3>{t('data.storage')}</h3>
            <p className="muted">{vault.persisted ? t('data.persisted') : t('data.notPersisted')}</p>
          </div>
        </div>
      </section>

      <section className="card settings-card">
        <h2>{t('data.sample')}</h2>
        <div className="setting">
          <p className="muted">{t('data.sampleText')}</p>
          <button type="button" className="btn" onClick={async () => { await data.addSample(lang); ui.toast(t('data.sampleAdded')); }}>{t('data.addSample')}</button>
        </div>
      </section>

      <section className="card settings-card danger-zone">
        <h2>{t('data.danger')}</h2>
        <div className="setting">
          <p className="muted">{t('data.dangerText')}</p>
          <button type="button" className="btn btn-danger" onClick={() => setDialog('wipe')}><Icon name="trash" size={16} />{t('data.wipe')}</button>
        </div>
      </section>

      {dialog === 'passcode' && <PasscodeDialog onClose={() => setDialog(null)} />}
      {dialog === 'recovery' && <RecoveryDialog onClose={() => setDialog(null)} />}
      {dialog === 'wipe' && <WipeDialog onClose={() => setDialog(null)} />}
    </div>
  );
}

function ProfileSection() {
  const { t } = useI18n();
  const { data, ui } = useApp();
  const [name, setName] = useState(data.profile.name || '');
  const changed = name.trim() !== (data.profile.name || '');
  return (
    <section className="card settings-card">
      <h2>{t('data.profile')}</h2>
      <form
        className="setting profile-row"
        onSubmit={async event => {
          event.preventDefault();
          await data.saveProfile({ ...data.profile, name: name.trim().slice(0, 40) });
          ui.toast(t('data.nameSaved'), null, 'success');
        }}
      >
        <div className="field grow">
          <label htmlFor="profile-name">{t('data.name')}</label>
          <input id="profile-name" value={name} maxLength={40} onChange={e => setName(e.target.value)} />
          <p className="hint">{t('data.nameHint')}</p>
        </div>
        <button type="submit" className="btn" disabled={!changed}>{t('action.save')}</button>
      </form>
    </section>
  );
}

function PasscodeDialog({ onClose }) {
  const { t } = useI18n();
  const { vault, ui } = useApp();
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async event => {
    event.preventDefault();
    if (first.length < MIN_PASSCODE_LENGTH) return setError(t('passcode.short'));
    if (first !== second) return setError(t('passcode.mismatch'));
    setBusy(true);
    await vault.setPasscode(first);
    onClose();
    ui.toast(t('passcode.saved'));
  };

  return (
    <Modal title={t('passcode.title')} onClose={onClose} size="sm">
      <form className="form" onSubmit={save}>
        <div className="field">
          <label htmlFor="pc-1">{t('passcode.new')}</label>
          <input id="pc-1" type="password" autoComplete="new-password" value={first} onChange={e => setFirst(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pc-2">{t('passcode.repeat')}</label>
          <input id="pc-2" type="password" autoComplete="new-password" value={second} onChange={e => setSecond(e.target.value)} />
        </div>
        <p className="hint">{t('passcode.hint')}</p>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row-actions end">
          <button type="button" className="btn" onClick={onClose}>{t('action.cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{t('passcode.save')}</button>
        </div>
      </form>
    </Modal>
  );
}

export function RecoveryKeyBox({ recoveryKey }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="recovery-box">
      <code className="recovery-key">{recoveryKey}</code>
      <div className="row-actions">
        <button type="button" className="btn" onClick={() => downloadText('gamefolk-recovery-key.txt', t('recovery.file', { key: recoveryKey }))}>
          <Icon name="download" size={16} />{t('recovery.download')}
        </button>
        <button type="button" className="btn" onClick={async () => setCopied(await copyText(recoveryKey))}>
          <Icon name={copied ? 'check' : 'copy'} size={16} />{copied ? t('action.copied') : t('recovery.copy')}
        </button>
      </div>
    </div>
  );
}

function RecoveryDialog({ onClose }) {
  const { t } = useI18n();
  const { vault } = useApp();
  const [recoveryKey, setRecoveryKey] = useState('');
  const [confirmed, setConfirmed] = useState(Boolean(vault.settings?.recoverySaved));
  useEffect(() => { vault.getRecoveryKey().then(setRecoveryKey); }, []);

  const close = async () => {
    if (confirmed !== Boolean(vault.settings?.recoverySaved)) await vault.updateSettings({ recoverySaved: confirmed });
    onClose();
  };

  return (
    <Modal title={t('data.recovery')} onClose={close} size="md">
      <div className="form">
        <p className="muted">{t('recovery.text')}</p>
        {recoveryKey && <RecoveryKeyBox recoveryKey={recoveryKey} />}
        <label className="check">
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
          <span>{t('recovery.confirm')}</span>
        </label>
        <div className="row-actions end">
          <button type="button" className="btn btn-primary" onClick={close}>{t('action.close')}</button>
        </div>
      </div>
    </Modal>
  );
}

function WipeDialog({ onClose }) {
  const { t } = useI18n();
  const { vault } = useApp();
  const [word, setWord] = useState('');
  const ok = word.trim().toUpperCase() === t('data.wipeWord');
  return (
    <Modal title={t('data.danger')} onClose={onClose} size="sm">
      <form className="form" onSubmit={e => { e.preventDefault(); if (ok) vault.wipe(); }}>
        <p className="muted">{t('data.dangerText')}</p>
        <div className="field">
          <label htmlFor="wipe-word">{t('data.wipeConfirm')}</label>
          <input id="wipe-word" value={word} autoComplete="off" onChange={e => setWord(e.target.value)} />
        </div>
        <div className="row-actions end">
          <button type="button" className="btn" onClick={onClose}>{t('action.cancel')}</button>
          <button type="submit" className="btn btn-danger" disabled={!ok}>{t('data.wipe')}</button>
        </div>
      </form>
    </Modal>
  );
}
