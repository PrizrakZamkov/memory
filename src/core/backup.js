// Encrypted backup file (.gamefolk).
// It holds the encrypted records and images exactly as they are stored,
// plus the vault header, so the recovery key can open it on any device.
import { decryptBytes, decryptJson, encryptBytes, encryptJson } from './crypto.js';
import { boxFromJson, boxToJson, fromBase64, toBase64 } from './encoding.js';
import { createVaultFromKey, keyMatchesHeader, vaultHeader } from './vault.js';

const FORMAT = 'gamefolk-backup';
const ID = /^[A-Za-z0-9.-]{1,80}$/;

export async function createBackup(db) {
  const header = await vaultHeader(db);
  const records = [];
  for (const [id, row] of await db.entries('records')) {
    if (!row.deleted) records.push({ id, kind: row.kind, t: row.t || 0, box: boxToJson(row.box) });
  }
  const blobs = [];
  for (const [id, row] of await db.entries('blobs')) {
    blobs.push({ id, type: row.type, box: boxToJson(row.box) });
  }
  return JSON.stringify({
    format: FORMAT,
    version: 1,
    createdAt: new Date().toISOString(),
    header: {
      recovery: { salt: toBase64(header.recovery.salt), ...boxToJson(header.recovery) },
      recoveryText: boxToJson(header.recoveryText)
    },
    records,
    blobs
  });
}

export function parseBackup(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('bad-backup');
  }
  if (raw?.format !== FORMAT || raw.version !== 1 || !raw.header || !Array.isArray(raw.records) || !Array.isArray(raw.blobs)) {
    throw new Error('bad-backup');
  }
  try {
    return {
      createdAt: String(raw.createdAt || ''),
      header: {
        recovery: { salt: fromBase64(raw.header.recovery.salt), ...boxFromJson(raw.header.recovery) },
        recoveryText: boxFromJson(raw.header.recoveryText)
      },
      records: raw.records
        .filter(r => ID.test(r.id) && (r.kind === 'person' || r.kind === 'story'))
        .map(r => ({ id: r.id, kind: r.kind, t: Number(r.t) || 0, box: boxFromJson(r.box) })),
      blobs: raw.blobs
        .filter(b => ID.test(b.id) && /^image\/[a-z]+$/.test(b.type))
        .map(b => ({ id: b.id, type: b.type, box: boxFromJson(b.box) }))
    };
  } catch {
    throw new Error('bad-backup');
  }
}

export function backupSummary(backup) {
  return {
    people: backup.records.filter(r => r.kind === 'person').length,
    stories: backup.records.filter(r => r.kind === 'story').length,
    images: backup.blobs.filter(b => !b.id.endsWith('.thumb')).length
  };
}

// The current key opens the backup when it was made from the same vault.
export async function backupNeedsRecoveryKey(backup, currentKey) {
  return !(currentKey && (await keyMatchesHeader(currentKey, backup.header)));
}

// First start on a new device: the backup becomes the vault.
export async function restoreIntoNewVault(db, backup, dataKey) {
  if (!(await keyMatchesHeader(dataKey, backup.header))) throw new Error('wrong-recovery');
  await createVaultFromKey(db, dataKey, backup.header);
  for (const r of backup.records) await db.put('records', r.id, { kind: r.kind, box: r.box, t: r.t });
  for (const b of backup.blobs) await db.put('blobs', b.id, { type: b.type, box: b.box });
}

// Adds what is missing and replaces records that are older than in the backup.
// Nothing is deleted. With dryRun it only counts.
export async function mergeBackup(db, backup, backupKey, currentKey, { dryRun = false } = {}) {
  const sameKey = await keyMatchesHeader(currentKey, backup.header);
  const result = { added: 0, updated: 0, images: 0 };

  for (const r of backup.records) {
    const local = await db.get('records', r.id);
    if (local && !local.deleted && local.t >= r.t) continue;
    if (local && !local.deleted) result.updated++;
    else result.added++;
    if (dryRun) continue;
    let box = r.box;
    if (!sameKey) {
      const label = `${r.kind}:${r.id}`;
      box = await encryptJson(currentKey, await decryptJson(backupKey, r.box, label), label);
    }
    await db.put('records', r.id, { kind: r.kind, box, t: Math.max(r.t, Date.now()) });
  }

  for (const b of backup.blobs) {
    if (await db.get('blobs', b.id)) continue;
    if (!b.id.endsWith('.thumb')) result.images++;
    if (dryRun) continue;
    let box = b.box;
    if (!sameKey) {
      const label = `image:${b.id}`;
      box = await encryptBytes(currentKey, await decryptBytes(backupKey, b.box, label), label);
    }
    await db.put('blobs', b.id, { type: b.type, box });
  }
  return result;
}

export function backupFileName(date = new Date()) {
  return `gamefolk-backup-${date.toISOString().slice(0, 10)}.gamefolk`;
}
