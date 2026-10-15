// Sync with the server. Only encrypted rows travel; the server cannot read them.
// Rule: the change with the later time `t` wins. Deletions travel as tombstones.
import { boxFromJson, boxToJson, fromBase64, toBase64 } from './encoding.js';
import { createVaultFromKey, keyMatchesHeader, rekeyLocalData, vaultHeader } from './vault.js';

const STATE = 'sync';
const FETCH_BATCH = 200;

export async function getSyncState(db) {
  return (await db.get('meta', STATE)) || null;
}

async function saveState(db, state) {
  await db.put('meta', STATE, state);
}

export async function disableSync(db) {
  await db.delete('meta', STATE);
}

export function headerToJson(header) {
  return {
    recovery: { salt: toBase64(header.recovery.salt), ...boxToJson(header.recovery) },
    recoveryText: boxToJson(header.recoveryText)
  };
}

export function headerFromJson(json) {
  return {
    recovery: { salt: fromBase64(json.recovery.salt), ...boxFromJson(json.recovery) },
    recoveryText: boxFromJson(json.recoveryText)
  };
}

// Rows saved before sync existed have no time yet; give them one so they get uploaded.
async function stampRows(db) {
  const now = Date.now();
  for (const [id, row] of await db.entries('records')) {
    if (!row.t) await db.put('records', id, { ...row, t: now });
  }
}

async function startState(db, email) {
  await stampRows(db);
  await saveState(db, { enabled: true, email, remote: {}, pushed: {}, pushedImages: {}, lastSyncAt: 0 });
}

// Called after login. Returns 'ok', or 'needs-key' when the account was made on
// another device with a different key, and this device first has to be joined.
export async function connectAccount(db, api, dataKey) {
  const me = await api.get('me');
  if (!me.hasVault) {
    try {
      await api.put('vault', headerToJson(await vaultHeader(db)));
    } catch (error) {
      if (error.status !== 409) throw error;
      return connectAccount(db, api, dataKey);
    }
    await startState(db, me.email);
    return { status: 'ok', email: me.email };
  }
  const header = headerFromJson(await api.get('vault'));
  if (await keyMatchesHeader(dataKey, header)) {
    await startState(db, me.email);
    return { status: 'ok', email: me.email };
  }
  return { status: 'needs-key', email: me.email, header };
}

// This device takes the account key. Its own records are re-encrypted and merged in.
export async function joinAccount(db, currentKey, accountKey, header, email) {
  if (!(await keyMatchesHeader(accountKey, header))) throw new Error('wrong-key');
  if (currentKey) await rekeyLocalData(db, currentKey, accountKey);
  await createVaultFromKey(db, accountKey, header);
  await startState(db, email);
}

function toLocalRow(env) {
  return env.deleted
    ? { kind: env.kind, deleted: true, t: env.t }
    : { kind: env.kind, box: boxFromJson(env.box), t: env.t };
}

function toEnvelope(row) {
  return row.deleted
    ? { kind: row.kind, t: row.t, deleted: true }
    : { kind: row.kind, t: row.t, box: boxToJson(row.box) };
}

async function pull(db, api, state) {
  let pulled = 0;
  const { records } = await api.get('records');
  const changed = records.filter(r => state.remote[r.id] !== r.etag).map(r => r.id);
  for (let i = 0; i < changed.length; i += FETCH_BATCH) {
    const { records: found } = await api.post('records/fetch', { ids: changed.slice(i, i + FETCH_BATCH) });
    for (const { id, etag, env } of found) {
      const local = await db.get('records', id);
      if (!local || env.t > (local.t || 0)) {
        await db.put('records', id, toLocalRow(env));
        pulled++;
      }
      if (!local || env.t >= (local.t || 0)) state.pushed[id] = env.t;
      state.remote[id] = etag;
    }
  }
  return pulled;
}

async function push(db, api, state) {
  let pushed = 0;
  let conflicts = 0;
  for (const [id, row] of await db.entries('blobs')) {
    if (state.pushedImages[id]) continue;
    await api.put(`images/${id}`, { type: row.type, box: boxToJson(row.box) });
    state.pushedImages[id] = 1;
  }
  for (const [id, row] of await db.entries('records')) {
    if (!row.t || state.pushed[id] === row.t) continue;
    try {
      const { etag } = await api.put(`records/${id}`, toEnvelope(row));
      state.remote[id] = etag;
      state.pushed[id] = row.t;
      pushed++;
    } catch (error) {
      if (error.status !== 409) throw error;
      delete state.remote[id];
      conflicts++;
    }
  }
  return { pushed, conflicts };
}

export async function syncOnce(db, api) {
  const state = await getSyncState(db);
  if (!state?.enabled) return null;
  let pulled = await pull(db, api, state);
  const { pushed, conflicts } = await push(db, api, state);
  if (conflicts) pulled += await pull(db, api, state);
  state.lastSyncAt = Date.now();
  await saveState(db, state);
  return { pulled, pushed };
}

// Images are downloaded only when they are about to be shown.
export async function fetchImage(db, api, id) {
  const image = await api.get(`images/${id}`);
  await db.put('blobs', id, { type: image.type, box: boxFromJson(image.box) });
  const state = await getSyncState(db);
  if (state) {
    state.pushedImages[id] = 1;
    await saveState(db, state);
  }
}

export async function forgetImages(db, api, ids) {
  const state = await getSyncState(db);
  if (!state?.enabled) return;
  for (const id of ids) {
    if (!state.pushedImages[id]) continue;
    await api.del(`images/${id}`);
    delete state.pushedImages[id];
  }
  await saveState(db, state);
}
