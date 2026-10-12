// Vault lifecycle: create, open, lock, auto-lock after inactivity.
import { useCallback, useEffect, useState } from 'react';
import { askPersistentStorage, openDb } from '../core/db.js';
import * as vault from '../core/vault.js';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

export function useVault() {
  const [db, setDb] = useState(null);
  // loading | error | new | recovery | locked | open
  const [status, setStatus] = useState('loading');
  const [dataKey, setDataKey] = useState(null);
  const [settings, setSettings] = useState(null);
  const [recoveryText, setRecoveryText] = useState('');
  const [persisted, setPersisted] = useState(false);

  const open = useCallback(async (database, key) => {
    setDataKey(key);
    setSettings(await vault.getVaultSettings(database));
    setStatus('open');
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const database = await openDb();
        setDb(database);
        const mode = await vault.vaultMode(database);
        if (mode === 'new') return setStatus('new');
        if (mode === 'passcode') return setStatus('locked');
        await open(database, await vault.unlockWithDevice(database));
      } catch (error) {
        console.error(error);
        setStatus('error');
      }
    })();
  }, [open]);

  useEffect(() => {
    if (status === 'open') askPersistentStorage().then(result => setPersisted(Boolean(result)));
  }, [status]);

  const lock = useCallback(() => {
    setDataKey(null);
    setStatus('locked');
  }, []);

  // Auto-lock only makes sense when a passcode is needed to open again.
  const lockMinutes = settings?.hasPasscode ? settings.autoLockMinutes : 0;
  useEffect(() => {
    if (status !== 'open' || !lockMinutes) return;
    let last = Date.now();
    const touch = () => { last = Date.now(); };
    ACTIVITY_EVENTS.forEach(name => window.addEventListener(name, touch, { passive: true }));
    const timer = setInterval(() => {
      if (Date.now() - last > lockMinutes * 60000) lock();
    }, 15000);
    return () => {
      clearInterval(timer);
      ACTIVITY_EVENTS.forEach(name => window.removeEventListener(name, touch));
    };
  }, [status, lockMinutes, lock]);

  return {
    db, status, dataKey, settings, recoveryText, persisted,

    async create() {
      const result = await vault.createVault(db);
      setDataKey(result.dataKey);
      setRecoveryText(result.recoveryText);
      setSettings(await vault.getVaultSettings(db));
      setStatus('recovery');
    },

    async confirmRecovery(saved) {
      if (saved) await vault.updateVaultSettings(db, { recoverySaved: true });
      setRecoveryText('');
      await open(db, dataKey);
    },

    async unlockWithPasscode(passcode) {
      await open(db, await vault.unlockWithPasscode(db, passcode));
    },

    // Forgot passcode: the recovery key opens the vault and turns the passcode off.
    async unlockWithRecovery(text) {
      const key = await vault.unlockWithRecovery(db, text);
      await vault.removePasscode(db, key);
      await open(db, key);
    },

    lock,

    async setPasscode(passcode) {
      await vault.setPasscode(db, dataKey, passcode);
      setSettings(await vault.getVaultSettings(db));
    },

    async removePasscode() {
      await vault.removePasscode(db, dataKey);
      setSettings(await vault.getVaultSettings(db));
    },

    async updateSettings(patch) {
      await vault.updateVaultSettings(db, patch);
      setSettings(await vault.getVaultSettings(db));
    },

    getRecoveryKey: () => vault.getRecoveryKey(db, dataKey),

    async wipe() {
      await db.wipe();
      setDataKey(null);
      setSettings(null);
      setStatus('new');
    }
  };
}
