import { useRef, useState } from 'react';
import { Icon } from './Icon.jsx';
import { downloadBlob, Modal } from './common.jsx';
import { timeAgo, useI18n } from '../app/i18n.js';
import { useApp } from '../app/context.js';
import { backupFileName, backupNeedsRecoveryKey, backupSummary, createBackup, mergeBackup, parseBackup } from '../core/backup.js';
import { buildArchiveFiles } from '../core/archive.js';
import { makeZip } from '../core/zip.js';
import { unlockHeader } from '../core/vault.js';

export function useBackupDownload() {
  const { t } = useI18n();
  const { vault, ui } = useApp();
  return async () => {
    const text = await createBackup(vault.db);
    downloadBlob(backupFileName(), new Blob([text], { type: 'application/octet-stream' }));
    await vault.markBackup();
    ui.toast(t('backup.done'), null, 'success');
  };
}

export function BackupSection() {
  const { t, lang } = useI18n();
  const { vault, data } = useApp();
  const download = useBackupDownload();
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState(false);
  const last = vault.settings?.lastBackupAt;

  const exportAll = async () => {
    setExporting(true);
    try {
      const files = await buildArchiveFiles({
        people: data.people, stories: data.stories, loadImage: data.loadImage, lang, title: t('export.bookTitle')
      });
      downloadBlob(`gamefolk-export-${new Date().toISOString().slice(0, 10)}.zip`, makeZip(files));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <section className="card settings-card">
        <h2>{t('backup.title')}</h2>
        <p className="muted">{t('backup.text')}</p>
        <p>{last ? t('backup.last', { when: timeAgo(last, lang, t) }) : t('backup.never')}</p>
        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={download}><Icon name="download" size={16} />{t('backup.download')}</button>
          <button type="button" className="btn" onClick={() => setRestoring(true)}><Icon name="upload" size={16} />{t('backup.restore')}</button>
        </div>
      </section>

      <section className="card settings-card">
        <h2>{t('export.title')}</h2>
        <p className="muted">{t('export.text')}</p>
        <p className="warning">{t('export.warning')}</p>
        <div className="row-actions">
          <button type="button" className="btn" onClick={exportAll} disabled={exporting}>
            <Icon name="download" size={16} />{exporting ? t('export.preparing') : t('export.download')}
          </button>
        </div>
      </section>

      {restoring && <RestoreDialog onClose={() => setRestoring(false)} />}
    </>
  );
}

function RestoreDialog({ onClose }) {
  const { t } = useI18n();
  const { vault, data, ui } = useApp();
  const input = useRef(null);
  const [backup, setBackup] = useState(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [recovery, setRecovery] = useState('');
  const [backupKey, setBackupKey] = useState(null);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const makePlan = async (parsed, key) => {
    setBackupKey(key);
    setPlan(await mergeBackup(vault.db, parsed, key, vault.dataKey, { dryRun: true }));
  };

  const pick = async file => {
    if (!file) return;
    setError('');
    setPlan(null);
    try {
      const parsed = parseBackup(await file.text());
      setBackup(parsed);
      const needs = await backupNeedsRecoveryKey(parsed, vault.dataKey);
      setNeedsKey(needs);
      if (!needs) await makePlan(parsed, vault.dataKey);
    } catch {
      setBackup(null);
      setError(t('restore.bad'));
    }
  };

  const check = async event => {
    event.preventDefault();
    setError('');
    try {
      await makePlan(backup, await unlockHeader(backup.header, recovery));
    } catch (err) {
      setError(err.message === 'bad-recovery-format' ? t('unlock.recoveryFormat') : t('unlock.recoveryWrong'));
    }
  };

  const apply = async () => {
    setBusy(true);
    await mergeBackup(vault.db, backup, backupKey, vault.dataKey);
    await data.reload();
    onClose();
    ui.toast(t('restore.done'), null, 'success');
  };

  const summary = backup && backupSummary(backup);
  const nothing = plan && plan.added + plan.updated + plan.images === 0;

  return (
    <Modal title={t('restore.title')} size="md" onClose={onClose}>
      <div className="form">
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => input.current?.click()} data-autofocus>
            <Icon name="upload" size={16} />{t('restore.pick')}
          </button>
          <input ref={input} type="file" accept=".gamefolk,application/json,application/octet-stream" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {summary && <p>{t('restore.summary', summary)}</p>}
        {backup && needsKey && !plan && (
          <form className="form" onSubmit={check}>
            <p className="muted">{t('restore.needKey')}</p>
            <div className="field">
              <label htmlFor="restore-key">{t('unlock.recoveryLabel')}</label>
              <input id="restore-key" value={recovery} spellCheck="false" autoComplete="off" onChange={e => setRecovery(e.target.value)} />
            </div>
            <button type="submit" className="btn">{t('restore.check')}</button>
          </form>
        )}
        {plan && <p className="accent-text">{nothing ? t('restore.nothing') : t('restore.plan', plan)}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="row-actions end">
          <button type="button" className="btn" onClick={onClose}>{t('action.cancel')}</button>
          <button type="button" className="btn btn-primary" disabled={!plan || nothing || busy} onClick={apply}>{t('restore.apply')}</button>
        </div>
      </div>
    </Modal>
  );
}
