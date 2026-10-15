import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryDb } from './helpers/memory-db.js';
import { browser, testServer } from './helpers/server-client.js';
import { createApi } from '../src/core/api.js';
import { createRepo } from '../src/core/repo.js';
import { createVault, unlockHeader } from '../src/core/vault.js';
import { connectAccount, headerFromJson, joinAccount, syncOnce } from '../src/core/sync.js';
import { approvePairing, finishPairing, startPairing } from '../src/core/pairing.js';

async function device(server, name) {
  const db = memoryDb();
  const client = browser(server, name);
  await client.login();
  return { db, client, api: createApi({ fetchImpl: client.fetch }) };
}

test('two devices share records through the server, which stores only ciphertext', async () => {
  const server = testServer();
  const a = await device(server, 'A');
  const { dataKey, recoveryText } = await createVault(a.db);
  const repoA = createRepo(a.db, dataKey);
  await repoA.save('story', { id: 's1', title: 'Ночной рейд', images: [{ id: 'i1' }] });
  await repoA.saveImage('i1', new Uint8Array([9, 9, 9]), 'image/webp');
  assert.equal((await connectAccount(a.db, a.api, dataKey)).status, 'ok');
  assert.deepEqual(await syncOnce(a.db, a.api), { pulled: 0, pushed: 1 });

  const stored = JSON.stringify([...server.store.map.values()]);
  assert.ok(!stored.includes('Ночной') && !stored.includes(recoveryText));

  // Device B joins with the recovery key and gets the story.
  const b = await device(server, 'B');
  const header = headerFromJson(await b.api.get('vault'));
  const keyB = await unlockHeader(header, recoveryText);
  await joinAccount(b.db, null, keyB, header, 'player@example.com');
  assert.deepEqual(await syncOnce(b.db, b.api), { pulled: 1, pushed: 0 });
  const repoB = createRepo(b.db, keyB);
  assert.equal((await repoB.loadAll()).stories[0].title, 'Ночной рейд');

  // Newer edit on B wins on A; a delete on A reaches B.
  await new Promise(r => setTimeout(r, 5));
  await repoB.save('story', { id: 's1', title: 'Ночной рейд, версия 2' });
  await syncOnce(b.db, b.api);
  await syncOnce(a.db, a.api);
  assert.equal((await repoA.loadAll()).stories[0].title, 'Ночной рейд, версия 2');
  await new Promise(r => setTimeout(r, 5));
  await repoA.remove('s1');
  await syncOnce(a.db, a.api);
  await syncOnce(b.db, b.api);
  assert.equal((await repoB.loadAll()).stories.length, 0);
});

test('pairing moves the key; a device with its own data keeps it after joining', async () => {
  const server = testServer();
  const a = await device(server, 'A');
  const { dataKey } = await createVault(a.db);
  await createRepo(a.db, dataKey).save('person', { id: 'p1', firstName: 'Кира' });
  await connectAccount(a.db, a.api, dataKey);
  await syncOnce(a.db, a.api);

  const b = await device(server, 'B');
  const own = await createVault(b.db);
  await createRepo(b.db, own.dataKey).save('person', { id: 'p2', firstName: 'Ваня' });
  const connect = await connectAccount(b.db, b.api, own.dataKey);
  assert.equal(connect.status, 'needs-key');

  const pairing = await startPairing();
  const { id } = await b.api.post('pairing', { publicKey: pairing.publicKey });
  const [request] = (await a.api.get('pairing')).requests;
  assert.equal(request.id, id);
  await a.api.post(`pairing/${id}/approve`, await approvePairing(request.publicKey, dataKey));
  const { response } = await b.api.get(`pairing/${id}`);
  const accountKey = await finishPairing(pairing, response);

  await joinAccount(b.db, own.dataKey, accountKey, connect.header, connect.email);
  await syncOnce(b.db, b.api);
  await syncOnce(a.db, a.api);
  const names = db => createRepo(db, accountKey).loadAll().then(all => all.people.map(p => p.firstName).sort());
  assert.deepEqual(await names(b.db), ['Ваня', 'Кира']);
  assert.deepEqual(await names(a.db), ['Ваня', 'Кира']);
});

test('a wrong key cannot join an account', async () => {
  const server = testServer();
  const a = await device(server, 'A');
  const { dataKey } = await createVault(a.db);
  await connectAccount(a.db, a.api, dataKey);
  const b = await device(server, 'B');
  const other = await createVault(b.db);
  const header = headerFromJson(await b.api.get('vault'));
  await assert.rejects(joinAccount(b.db, null, other.dataKey, header, 'x'), /wrong-key/);
});
