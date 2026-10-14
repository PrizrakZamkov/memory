// The vault keeps one random data key that encrypts everything.
// The data key itself is stored only in wrapped (encrypted) form:
//  - by the device key, so this browser opens without a passcode;
//  - or by a passcode, if the user turned on "passcode to open";
//  - always by the recovery key, the user's way back in.
import {
  decryptBytes, decryptJson, encryptBytes, encryptJson, formatRecoveryKey, generateDataKey, generateDeviceKey,
  keyFromPasscode, keyFromRecovery, newRecoveryBytes, parseRecoveryKey,
  PASSCODE_ITERATIONS, randomBytes, unwrapKey, wrapKey
} from './crypto.js';

const META = 'meta';
export const MIN_PASSCODE_LENGTH = 6;

async function readVault(db) {
  return db.get(META, 'vault');
}

async function writeVault(db, vault) {
  await db.put(META, 'vault', vault);
}

async function deviceKey(db) {
  let key = await db.get(META, 'deviceKey');
  if (!key) {
    key = await generateDeviceKey();
    await db.put(META, 'deviceKey', key);
  }
  return key;
}

// 'new': nothing created yet; 'device': opens by itself; 'passcode': asks for the passcode.
export async function vaultMode(db) {
  const vault = await readVault(db);
  if (!vault) return 'new';
  return vault.passcode ? 'passcode' : 'device';
}

export async function createVault(db) {
  const dataKey = await generateDataKey();
  const recoveryBytes = newRecoveryBytes();
  const recoverySalt = randomBytes(16);
  const recoveryText = formatRecoveryKey(recoveryBytes);
  const vault = {
    version: 1,
    createdAt: new Date().toISOString(),
    device: await wrapKey(dataKey, await deviceKey(db)),
    passcode: null,
    recovery: { salt: recoverySalt, ...(await wrapKey(dataKey, await keyFromRecovery(recoveryBytes, recoverySalt))) },
    recoveryText: await encryptJson(dataKey, recoveryText, 'recovery'),
    recoverySaved: false,
    autoLockMinutes: 15
  };
  await writeVault(db, vault);
  return { dataKey, recoveryText };
}

export async function unlockWithDevice(db) {
  const vault = await readVault(db);
  if (!vault?.device) return null;
  return unwrapKey(vault.device, await deviceKey(db));
}

export async function unlockWithPasscode(db, passcode) {
  const vault = await readVault(db);
  if (!vault?.passcode) throw new Error('no-passcode');
  const { salt, iterations } = vault.passcode;
  try {
    return await unwrapKey(vault.passcode, await keyFromPasscode(passcode, salt, iterations));
  } catch {
    throw new Error('wrong-passcode');
  }
}

export async function unlockWithRecovery(db, text) {
  const vault = await readVault(db);
  if (!vault) throw new Error('no-vault');
  return unlockHeader(vault, text);
}

// The "header" is the part of the vault that is safe to copy anywhere:
// the data key wrapped by the recovery key, and the recovery key text encrypted by the data key.
// It goes into backup files and to the sync server.
export async function vaultHeader(db) {
  const vault = await readVault(db);
  return { recovery: vault.recovery, recoveryText: vault.recoveryText };
}

export async function unlockHeader(header, text) {
  const bytes = parseRecoveryKey(text);
  if (!bytes) throw new Error('bad-recovery-format');
  try {
    return await unwrapKey(header.recovery, await keyFromRecovery(bytes, header.recovery.salt));
  } catch {
    throw new Error('wrong-recovery');
  }
}

// True when this data key belongs to that header.
export async function keyMatchesHeader(dataKey, header) {
  try {
    await decryptJson(dataKey, header.recoveryText, 'recovery');
    return true;
  } catch {
    return false;
  }
}

// Builds a vault on this device from a key that came from a backup or another device.
export async function createVaultFromKey(db, dataKey, header) {
  const old = await readVault(db);
  await writeVault(db, {
    version: 1,
    createdAt: old?.createdAt || new Date().toISOString(),
    device: await wrapKey(dataKey, await deviceKey(db)),
    passcode: null,
    recovery: header.recovery,
    recoveryText: header.recoveryText,
    recoverySaved: true,
    autoLockMinutes: old?.autoLockMinutes ?? 15,
    lastBackupAt: old?.lastBackupAt || null
  });
}

// Re-encrypts everything on this device with another data key.
// Used when this device joins an account whose data uses a different key.
export async function rekeyLocalData(db, oldKey, newKey) {
  for (const [id, row] of await db.entries('records')) {
    if (row.deleted) continue;
    const label = `${row.kind}:${id}`;
    const value = await decryptJson(oldKey, row.box, label);
    await db.put('records', id, { ...row, box: await encryptJson(newKey, value, label), t: Date.now() });
  }
  for (const [id, row] of await db.entries('blobs')) {
    const label = `image:${id}`;
    const bytes = await decryptBytes(oldKey, row.box, label);
    await db.put('blobs', id, { ...row, box: await encryptBytes(newKey, bytes, label) });
  }
  for (const name of ['draft', 'profile']) {
    const box = await db.get(META, name);
    if (box) await db.put(META, name, await encryptJson(newKey, await decryptJson(oldKey, box, name), name));
  }
}

export async function setPasscode(db, dataKey, passcode) {
  if (String(passcode).length < MIN_PASSCODE_LENGTH) throw new Error('short-passcode');
  const vault = await readVault(db);
  const salt = randomBytes(16);
  const wrapped = await wrapKey(dataKey, await keyFromPasscode(passcode, salt));
  vault.passcode = { salt, iterations: PASSCODE_ITERATIONS, ...wrapped };
  // With a passcode on, the device alone must not be able to open the vault.
  vault.device = null;
  await writeVault(db, vault);
}

export async function removePasscode(db, dataKey) {
  const vault = await readVault(db);
  vault.passcode = null;
  vault.device = await wrapKey(dataKey, await deviceKey(db));
  await writeVault(db, vault);
}

export async function getRecoveryKey(db, dataKey) {
  const vault = await readVault(db);
  return decryptJson(dataKey, vault.recoveryText, 'recovery');
}

export async function getVaultSettings(db) {
  const vault = await readVault(db);
  return {
    hasPasscode: Boolean(vault?.passcode),
    recoverySaved: Boolean(vault?.recoverySaved),
    autoLockMinutes: vault?.autoLockMinutes ?? 15,
    lastBackupAt: vault?.lastBackupAt || null
  };
}

export async function updateVaultSettings(db, patch) {
  const vault = await readVault(db);
  if ('recoverySaved' in patch) vault.recoverySaved = Boolean(patch.recoverySaved);
  if ('autoLockMinutes' in patch) vault.autoLockMinutes = Number(patch.autoLockMinutes) || 15;
  if ('lastBackupAt' in patch) vault.lastBackupAt = patch.lastBackupAt;
  await writeVault(db, vault);
}
