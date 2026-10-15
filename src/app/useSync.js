// Sync lifecycle inside the open journal: connect after login, sync on changes and on a timer,
// show requests from new devices, sign out.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createApi, syncAvailable } from '../core/api.js';
import { approvePairing } from '../core/pairing.js';
import { connectAccount, disableSync, fetchImage, forgetImages, getSyncState, syncOnce } from '../core/sync.js';

const SYNC_EVERY = 45000;
const PAIRING_EVERY = 15000;
const AFTER_CHANGE = 2500;

export function useSync({ db, dataKey, reload, loginPending, clearLogin }) {
  const available = syncAvailable();
  const api = useMemo(() => createApi(), []);
  // off | ok | syncing | offline | error | logged-out | needs-key
  const [status, setStatus] = useState(available ? 'loading' : 'off');
  const [account, setAccount] = useState(null);
  const [requests, setRequests] = useState([]);
  const [join, setJoin] = useState(null);
  const running = useRef(false);
  const queued = useRef(false);
  const timer = useRef(null);

  const readAccount = useCallback(async () => {
    const state = await getSyncState(db);
    setAccount(state?.enabled ? { email: state.email, lastSyncAt: state.lastSyncAt } : null);
    return state;
  }, [db]);

  const fail = useCallback(error => {
    if (error.status === 401) setStatus('logged-out');
    else if (error.status === 0) setStatus('offline');
    else setStatus('error');
  }, []);

  const run = useCallback(async () => {
    if (!available) return;
    if (running.current) {
      queued.current = true;
      return;
    }
    running.current = true;
    try {
      const state = await readAccount();
      if (!state?.enabled) {
        setStatus(s => (s === 'needs-key' ? s : 'off'));
        return;
      }
      setStatus('syncing');
      const result = await syncOnce(db, api);
      if (result?.pulled) await reload();
      setRequests((await api.get('pairing')).requests);
      await readAccount();
      setStatus('ok');
    } catch (error) {
      fail(error);
    } finally {
      running.current = false;
      if (queued.current) {
        queued.current = false;
        run();
      }
    }
  }, [available, db, api, reload, readAccount, fail]);

  const schedule = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(run, AFTER_CHANGE);
  }, [run]);

  const connect = useCallback(async () => {
    try {
      const result = await connectAccount(db, api, dataKey);
      if (result.status === 'needs-key') {
        setJoin({ header: result.header, email: result.email });
        setStatus('needs-key');
        return;
      }
      await run();
    } catch (error) {
      fail(error);
    }
  }, [db, api, dataKey, run, fail]);

  useEffect(() => {
    if (!available) return;
    if (loginPending) {
      clearLogin();
      connect();
    } else {
      run();
    }
    const sync = setInterval(() => document.visibilityState === 'visible' && run(), SYNC_EVERY);
    const pairing = setInterval(async () => {
      if (document.visibilityState !== 'visible' || !(await getSyncState(db))?.enabled) return;
      try {
        setRequests((await api.get('pairing')).requests);
      } catch {
        // The next full sync reports problems.
      }
    }, PAIRING_EVERY);
    const onWake = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('online', run);
    return () => {
      clearInterval(sync);
      clearInterval(pairing);
      clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('online', run);
    };
  }, []);

  const stop = useCallback(async () => {
    await disableSync(db);
    setAccount(null);
    setRequests([]);
    setStatus('off');
  }, [db]);

  return {
    available, status, account, requests, join, api,
    run, schedule,
    fetchImage: id => (account ? fetchImage(db, api, id) : Promise.resolve()),
    forgetImages: ids => forgetImages(db, api, ids).catch(() => {}),

    async approve(request) {
      await api.post(`pairing/${request.id}/approve`, await approvePairing(request.publicKey, dataKey));
      setRequests(list => list.filter(r => r.id !== request.id));
    },
    async reject(request) {
      await api.post(`pairing/${request.id}/reject`);
      setRequests(list => list.filter(r => r.id !== request.id));
    },
    devices: async () => (await api.get('devices')).devices,
    removeDevice: id => api.del(`devices/${id}`),
    async logout() {
      await api.post('auth/logout').catch(() => {});
      await stop();
    },
    async logoutEverywhere() {
      await api.post('auth/logout-all');
      await stop();
    },
    async deleteServerData() {
      await api.del('account');
      await stop();
    },
    cancelJoin: async () => {
      setJoin(null);
      await api.post('auth/logout').catch(() => {});
      setStatus('off');
    }
  };
}
