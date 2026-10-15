// Vault lifecycle: create, open, lock, auto-lock after inactivity.
import { useCallback, useEffect, useState } from 'react';
import { askPersistentStorage, openDb } from '../core/db.js';
import * as vault from '../core/vault.js';
import { createRepo } from '../core/repo.js';
import { restoreIntoNewVault } from '../core/backup.js';
import { joinAccount } from '../core/sync.js';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

export function useVault() {
  const [db, setDb] = useState(null);
  // loading | error | new | recovery | locked | open
  const [status, setStatus] = useState('loading');
  const [dataKey, setDataKey] = useState(null);
  const [settings, setSettings] = useState(null);
  const [recoveryText, setRecoveryText] = useState('');
  const [persisted, setPersisted] = useState(false);

  // Grows every time the vault opens with a key, so the journal starts fresh.
  const [openCount, setOpenCount] = useState(0);

  const open = useCallback(async (database, key) => {
    setDataKey(key);
    setSettings(await vault.getVaultSettings(database));
    setOpenCount(n => n + 1);
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
    db, status, dataKey, settings, recoveryText, persisted, openCount,

    async create(name = '') {
      const result = await vault.createVault(db);
      if (name.trim()) await createRepo(db, result.dataKey).saveProfile({ name: name.trim().slice(0, 40) });
      setDataKey(result.dataKey);
      setRecoveryText(result.recoveryText);
      setSettings(await vault.getVaultSettings(db));
      setStatus('recovery');
    },

    // New device: the key came from another device or from the recovery key.
    async createFromAccount(key, header, email) {
      await joinAccount(db, null, key, header, email);
      await open(db, key);
    },

    // This device already has a vault and joins an account with another key.
    async adoptAccountKey(key, header, email) {
      await joinAccount(db, dataKey, key, header, email);
      await open(db, key);
    },

    async restoreFromBackup(backup, recoveryKeyText) {
      const key = await vault.unlockHeader(backup.header, recoveryKeyText);
      await restoreIntoNewVault(db, backup, key);
      await open(db, key);
    },

    async markBackup() {
      await vault.updateVaultSettings(db, { lastBackupAt: Date.now() });
      setSettings(await vault.getVaultSettings(db));
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
