import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryDb } from './helpers/memory-db.js';
import { decryptJson, encryptJson } from '../src/core/crypto.js';
import {
  createVault, getRecoveryKey, removePasscode, setPasscode, unlockWithDevice,
  unlockWithPasscode, unlockWithRecovery, vaultMode
} from '../src/core/vault.js';
import { createRepo } from '../src/core/repo.js';

test('new vault opens on the same device without a passcode', async () => {
  const db = memoryDb();
  assert.equal(await vaultMode(db), 'new');
  const { dataKey } = await createVault(db);
  assert.equal(await vaultMode(db), 'device');
  const box = await encryptJson(dataKey, 'hello');
  const again = await unlockWithDevice(db);
  assert.equal(await decryptJson(again, box), 'hello');
});

test('recovery key opens the vault and can be shown again', async () => {
  const db = memoryDb();
  const { dataKey, recoveryText } = await createVault(db);
  const box = await encryptJson(dataKey, 42);
  const fromRecovery = await unlockWithRecovery(db, recoveryText);
  assert.equal(await decryptJson(fromRecovery, box), 42);
  assert.equal(await getRecoveryKey(db, dataKey), recoveryText);
  await assert.rejects(unlockWithRecovery(db, '0000-0000-0000-0000-0000-0000-0000-0000'), /wrong-recovery/);
});

test('passcode replaces device unlock and can be removed', async () => {
  const db = memoryDb();
  const { dataKey } = await createVault(db);
  await assert.rejects(setPasscode(db, dataKey, '123'), /short-passcode/);
  await setPasscode(db, dataKey, 'long passcode');
  assert.equal(await vaultMode(db), 'passcode');
  assert.equal(await unlockWithDevice(db), null);
  await assert.rejects(unlockWithPasscode(db, 'wrong one'), /wrong-passcode/);
  const key = await unlockWithPasscode(db, 'long passcode');
  await removePasscode(db, key);
  assert.equal(await vaultMode(db), 'device');
  assert.ok(await unlockWithDevice(db));
});

test('repo stores records and images only in encrypted form', async () => {
  const db = memoryDb();
  const { dataKey } = await createVault(db);
  const repo = createRepo(db, dataKey);
  await repo.save('story', { id: 's1', title: 'Похоронили драккар', images: [{ id: 'img1' }] });
  await repo.save('person', { id: 'p1', firstName: 'Кира', photo: 'ph1' });
  await repo.saveImage('img1', new Uint8Array([1, 2, 3]), 'image/webp');
  await repo.saveImage('img1.thumb', new Uint8Array([4]), 'image/webp');
  await repo.saveImage('ph1', new Uint8Array([5]), 'image/webp');
  await repo.saveImage('orphan', new Uint8Array([6]), 'image/webp');

  const raw = JSON.stringify([...db.stores.records.values()].map(r => Buffer.from(r.box.data).toString('utf8')));
  assert.ok(!raw.includes('драккар') && !raw.includes('Кира'));

  const { people, stories } = await repo.loadAll();
  assert.equal(people[0].firstName, 'Кира');
  assert.equal(stories[0].title, 'Похоронили драккар');
  assert.deepEqual([...(await repo.loadImage('img1')).bytes], [1, 2, 3]);

  await repo.removeUnusedImages(people, stories, null);
  assert.equal(await repo.loadImage('orphan'), null);
  assert.ok(await repo.loadImage('ph1'));
});

test('a damaged record is skipped, the rest still opens', async () => {
  const db = memoryDb();
  const { dataKey } = await createVault(db);
  const repo = createRepo(db, dataKey);
  await repo.save('story', { id: 's1', title: 'Good' });
  await repo.save('story', { id: 's2', title: 'Broken' });
  const row = await db.get('records', 's2');
  row.box.data[0] ^= 1;
  const all = await repo.loadAll();
  assert.deepEqual(all.stories.map(s => s.title), ['Good']);
  assert.equal(all.damaged, 1);
  assert.ok(await db.get('records', 's2'));
});
