import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoryDb } from './helpers/memory-db.js';
import { createRepo } from '../src/core/repo.js';
import { createVault, unlockHeader, unlockWithDevice } from '../src/core/vault.js';
import {
  backupNeedsRecoveryKey, backupSummary, createBackup, mergeBackup, parseBackup, restoreIntoNewVault
} from '../src/core/backup.js';
import { crc32, makeZip } from '../src/core/zip.js';
import { buildArchiveFiles, escapeHtml } from '../src/core/archive.js';
import { cleanPerson, cleanStory } from '../src/core/model.js';

async function filledVault() {
  const db = memoryDb();
  const created = await createVault(db);
  const repo = createRepo(db, created.dataKey);
  await repo.save('person', { id: 'p1', firstName: 'Кира' });
  await repo.save('story', { id: 's1', title: 'Рейд', images: [{ id: 'i1' }] });
  await repo.saveImage('i1', new Uint8Array([1, 2, 3]), 'image/webp');
  await repo.saveImage('i1.thumb', new Uint8Array([1]), 'image/webp');
  await repo.remove('p1');
  await repo.save('person', { id: 'p2', firstName: 'Ваня' });
  return { db, repo, ...created };
}

test('backup is encrypted and restores on a new device with the recovery key', async () => {
  const source = await filledVault();
  const text = await createBackup(source.db);
  assert.ok(!text.includes('Рейд') && !text.includes('Ваня'));

  const backup = parseBackup(text);
  assert.deepEqual(backupSummary(backup), { people: 1, stories: 1, images: 1 });

  const db = memoryDb();
  await assert.rejects(unlockHeader(backup.header, '0000-0000-0000-0000-0000-0000-0000-0000'), /wrong-recovery/);
  const key = await unlockHeader(backup.header, source.recoveryText);
  await restoreIntoNewVault(db, backup, key);
  const opened = await unlockWithDevice(db);
  const all = await createRepo(db, opened).loadAll();
  assert.deepEqual(all.people.map(p => p.firstName), ['Ваня']);
  assert.deepEqual([...(await createRepo(db, opened).loadImage('i1')).bytes], [1, 2, 3]);
});

test('merging a backup from another vault re-encrypts and never deletes', async () => {
  const source = await filledVault();
  const backup = parseBackup(await createBackup(source.db));

  const target = memoryDb();
  const own = await createVault(target);
  const repo = createRepo(target, own.dataKey);
  await repo.save('story', { id: 'mine', title: 'Моя' });

  assert.equal(await backupNeedsRecoveryKey(backup, own.dataKey), true);
  assert.equal(await backupNeedsRecoveryKey(backup, source.dataKey), false);
  const backupKey = await unlockHeader(backup.header, source.recoveryText);
  const plan = await mergeBackup(target, backup, backupKey, own.dataKey, { dryRun: true });
  assert.deepEqual(plan, { added: 2, updated: 0, images: 1 });
  await mergeBackup(target, backup, backupKey, own.dataKey);

  const all = await repo.loadAll();
  assert.deepEqual(all.stories.map(s => s.title).sort(), ['Моя', 'Рейд']);
  assert.deepEqual([...(await repo.loadImage('i1')).bytes], [1, 2, 3]);
  assert.deepEqual(await mergeBackup(target, backup, backupKey, own.dataKey, { dryRun: true }), { added: 0, updated: 0, images: 0 });
});

test('broken files are rejected', () => {
  assert.throws(() => parseBackup('not json'), /bad-backup/);
  assert.throws(() => parseBackup('{"format":"other"}'), /bad-backup/);
});

test('zip has correct checksums and structure', async () => {
  assert.equal(crc32(new TextEncoder().encode('hello')), 0x3610a686);
  const blob = makeZip([{ name: 'a.txt', data: 'hello' }, { name: 'b/c.bin', data: new Uint8Array([1, 2]) }]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(bytes.length - 12, true), 2);
});

test('readable archive escapes text and includes every story', async () => {
  const person = cleanPerson({ id: 'p1', firstName: '<b>Кира</b>' });
  const story = cleanStory({ id: 's1', title: 'Рейд <script>', text: 'Текст', people: ['p1'], when: { kind: 'exact', date: '2021-04-02' }, images: [{ id: 'i1' }] });
  const files = await buildArchiveFiles({
    people: [person], stories: [story], lang: 'ru', title: 'Gamefolk',
    loadImage: async id => (id === 'i1' ? { type: 'image/webp', bytes: new Uint8Array([1]) } : null)
  });
  const names = files.map(f => f.name);
  assert.ok(names.includes('book.html') && names.includes('data.json') && names.includes('images/i1.webp'));
  assert.ok(names.some(n => n.startsWith('stories/2021-04-02-')));
  const book = files.find(f => f.name === 'book.html').data;
  assert.ok(!book.includes('<script>') && book.includes('&lt;script&gt;') && book.includes('&lt;b&gt;'));
  assert.equal(escapeHtml(`"'&`), '&quot;&#39;&amp;');
});
