// Getting the account key on this device: approve from another device, or enter the recovery key.
import { useCallback, useEffect, useState } from 'react';
import { Icon } from './Icon.jsx';
import { useI18n } from '../app/i18n.js';
import { finishPairing, startPairing } from '../core/pairing.js';
import { unlockHeader } from '../core/vault.js';

const POLL_MS = 2000;

export function JoinPanel({ api, header, onKey, showMerge }) {
  const { t } = useI18n();
  const [pair, setPair] = useState(null);
  // starting | waiting | rejected | expired | error
  const [phase, setPhase] = useState('starting');
  const [recovery, setRecovery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const start = useCallback(async () => {
    setPhase('starting');
    try {
      const pairing = await startPairing();
      const { id } = await api.post('pairing', { publicKey: pairing.publicKey });
      setPair({ pairing, id });
      setPhase('waiting');
    } catch {
      setPhase('error');
    }
  }, [api]);

  useEffect(() => { start(); }, [start]);

  useEffect(() => {
    if (phase !== 'waiting' || !pair) return;
    let stopped = false;
    let timer;
    const tick = async () => {
      try {
        const result = await api.get(`pairing/${pair.id}`);
        if (stopped) return;
        if (result.status === 'approved') {
          stopped = true;
          setBusy(true);
          try {
            await onKey(await finishPairing(pair.pairing, result.response));
          } catch {
            setError(t('error.generic'));
            setBusy(false);
          }
          return;
        }
        if (result.status === 'rejected') return setPhase('rejected');
      } catch (err) {
        if (err.status === 404) return setPhase('expired');
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [phase, pair]);

  const submitRecovery = async event => {
    event.preventDefault();
    if (!recovery.trim()) return;
    setError('');
    setBusy(true);
    try {
      await onKey(await unlockHeader(header, recovery));
    } catch (err) {
      setError(err.message === 'bad-recovery-format' ? t('unlock.recoveryFormat') : t('unlock.recoveryWrong'));
      setBusy(false);
    }
  };

  return (
    <div className="join">
      {showMerge && <p className="muted">{t('join.merge')}</p>}
      <section className="join-pair">
        <h3>{t('join.pairTitle')}</h3>
        <p className="muted">{t('join.pairText')}</p>
        {phase === 'waiting' && pair && (
          <>
            <code className="pair-code" aria-live="polite">{pair.pairing.code}</code>
            <p className="waiting"><span className="dots" aria-hidden="true"><i /><i /><i /></span>{t('join.waiting')}</p>
          </>
        )}
        {phase === 'starting' && <p className="waiting"><span className="dots" aria-hidden="true"><i /><i /><i /></span></p>}
        {['rejected', 'expired', 'error'].includes(phase) && (
          <div className="row-actions">
            <span className="muted">{phase === 'rejected' ? t('join.rejected') : phase === 'expired' ? t('join.expired') : t('error.generic')}</span>
            <button type="button" className="btn" onClick={start}><Icon name="next" size={16} />{t('join.retry')}</button>
          </div>
        )}
      </section>

      <form className="form join-recovery" onSubmit={submitRecovery}>
        <h3>{t('join.recoveryTitle')}</h3>
        <div className="field">
          <label htmlFor="join-recovery">{t('unlock.recoveryLabel')}</label>
          <input
            id="join-recovery" value={recovery} spellCheck="false" autoComplete="off"
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" onChange={e => setRecovery(e.target.value)}
          />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" className="btn" disabled={busy}>{t('join.useRecovery')}</button>
      </form>
    </div>
  );
}
