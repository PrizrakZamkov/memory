import { useEffect, useState } from 'react';
import { Icon } from './Icon.jsx';
import { JoinPanel } from './JoinPanel.jsx';
import { Modal } from './common.jsx';
import { timeAgo, useI18n } from '../app/i18n.js';
import { useApp } from '../app/context.js';
import { pairingCode } from '../core/pairing.js';

const LOGIN_URL = '/api/auth/google/start';

export function SyncSection() {
  const { t, lang } = useI18n();
  const { sync, vault, ui } = useApp();
  const [devices, setDevices] = useState([]);
  const [confirm, setConfirm] = useState(false);
  const signedIn = Boolean(sync.account);

  const loadDevices = () => sync.devices().then(setDevices).catch(() => {});
  useEffect(() => { if (signedIn && sync.status !== 'logged-out') loadDevices(); }, [signedIn, sync.status]);

  if (!sync.available) {
    return (
      <section className="card settings-card">
        <h2>{t('sync.title')}</h2>
        <p className="muted">{t('sync.text')}</p>
        <p className="muted">{t('sync.fileMode')}</p>
      </section>
    );
  }

  if (sync.status === 'needs-key' && sync.join) {
    return (
      <section className="card settings-card">
        <h2>{t('join.title')}</h2>
        <p className="muted">{t('join.text')}</p>
        <JoinPanel
          api={sync.api} header={sync.join.header} showMerge
          onKey={async key => {
            await vault.adoptAccountKey(key, sync.join.header, sync.join.email);
            ui.toast(t('join.done'), null, 'success');
          }}
        />
        <button type="button" className="link-btn" onClick={sync.cancelJoin}>{t('action.cancel')}</button>
      </section>
    );
  }

  if (!signedIn) {
    return (
      <section className="card settings-card">
        <h2>{t('sync.title')}</h2>
        <p className="muted">{t('sync.text')}</p>
        <div className="row-actions">
          <a className="btn btn-primary" href={LOGIN_URL}><GoogleMark />{t('sync.login')}</a>
        </div>
      </section>
    );
  }

  const statusLine = {
    syncing: t('sync.syncing'),
    offline: t('sync.offline'),
    error: t('sync.error'),
    'logged-out': t('sync.loggedOut')
  }[sync.status];

  return (
    <section className="card settings-card">
      <div className="title-row">
        <h2 className="grow">{t('sync.title')}</h2>
        <span className={`sync-dot ${sync.status}`} aria-hidden="true" />
      </div>
      <p>{t('sync.account', { email: sync.account.email })}</p>
      <p className="muted" aria-live="polite">
        {statusLine || (sync.account.lastSyncAt ? t('sync.last', { when: timeAgo(sync.account.lastSyncAt, lang, t) }) : t('sync.never'))}
      </p>
      <div className="row-actions">
        {sync.status === 'logged-out'
          ? <a className="btn btn-primary" href={LOGIN_URL}><GoogleMark />{t('sync.login')}</a>
          : <button type="button" className="btn" disabled={sync.status === 'syncing'} onClick={sync.run}><Icon name="sync" size={16} />{t('sync.now')}</button>}
      </div>

      {devices.length > 0 && (
        <div className="setting devices">
          <h3>{t('sync.devices')}</h3>
          {devices.map(device => (
            <div key={device.id} className="kv">
              <span className="device-name">
                {device.name}
                <span className="muted small">{device.current ? t('sync.thisDevice') : t('sync.seen', { when: timeAgo(device.lastSeenAt, lang, t) })}</span>
              </span>
              {!device.current && (
                <button type="button" className="btn btn-small" onClick={async () => { await sync.removeDevice(device.id); loadDevices(); }}>
                  {t('sync.removeDevice')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="setting">
        <div className="row-actions">
          <button type="button" className="btn" onClick={sync.logout}>{t('sync.logout')}</button>
          <button type="button" className="btn" onClick={sync.logoutEverywhere}>{t('sync.logoutAll')}</button>
          <button type="button" className="btn btn-danger" onClick={() => setConfirm(true)}>{t('sync.deleteServer')}</button>
        </div>
      </div>

      {confirm && (
        <Modal title={t('sync.deleteServer')} size="sm" onClose={() => setConfirm(false)}>
          <div className="form">
            <p className="muted">{t('sync.deleteText')}</p>
            <div className="row-actions end">
              <button type="button" className="btn" onClick={() => setConfirm(false)}>{t('action.cancel')}</button>
              <button type="button" className="btn btn-danger" onClick={async () => { setConfirm(false); await sync.deleteServerData(); ui.toast(t('sync.deleted')); }}>
                {t('sync.deleteServer')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}

// Google "G" in its own colors, as Google asks for sign-in buttons.
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className="google-mark">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function ApproveDialog() {
  const { t } = useI18n();
  const { sync, ui } = useApp();
  const request = sync.requests[0];
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCode('');
    if (request) pairingCode(request.publicKey).then(setCode);
  }, [request?.id]);

  if (!request) return null;
  const close = () => sync.reject(request).catch(() => {});

  return (
    <Modal title={t('approve.title')} size="sm" onClose={close}>
      <div className="form">
        <p>{t('approve.text', { name: request.deviceName })}</p>
        <p className="muted">{t('approve.check')}</p>
        <code className="pair-code">{code}</code>
        <div className="row-actions end">
          <button type="button" className="btn" onClick={close}>{t('approve.no')}</button>
          <button
            type="button" className="btn btn-primary" disabled={busy || !code}
            onClick={async () => {
              setBusy(true);
              try {
                await sync.approve(request);
                ui.toast(t('join.done'), null, 'success');
              } catch {
                ui.toast(t('error.generic'));
              }
              setBusy(false);
            }}
          >
            {t('approve.ok')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
