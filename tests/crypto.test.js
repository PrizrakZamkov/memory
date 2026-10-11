import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptJson, encryptJson, formatRecoveryKey, generateDataKey, newRecoveryBytes, parseRecoveryKey
} from '../src/core/crypto.js';

test('encrypted json decrypts back to the same value', async () => {
  const key = await generateDataKey();
  const value = { title: 'Ночной рейд', tags: ['эпик'] };
  const box = await encryptJson(key, value, 'story:1');
  assert.deepEqual(await decryptJson(key, box, 'story:1'), value);
});

test('ciphertext does not contain the plain text', async () => {
  const key = await generateDataKey();
  const box = await encryptJson(key, 'secret story', 'x');
  assert.ok(!Buffer.from(box.data).toString('utf8').includes('secret'));
});

test('decrypting with another label fails, so records cannot be swapped', async () => {
  const key = await generateDataKey();
  const box = await encryptJson(key, { a: 1 }, 'story:1');
  await assert.rejects(decryptJson(key, box, 'story:2'));
});

test('decrypting with another key fails', async () => {
  const box = await encryptJson(await generateDataKey(), { a: 1 });
  await assert.rejects(decryptJson(await generateDataKey(), box));
});

test('recovery key survives formatting and typing mistakes', () => {
  const bytes = newRecoveryBytes();
  const text = formatRecoveryKey(bytes);
  assert.match(text, /^([0-9A-Z]{4}-){7}[0-9A-Z]{4}$/);
  assert.deepEqual(parseRecoveryKey(text), bytes);
  assert.deepEqual(parseRecoveryKey(` ${text.toLowerCase().replaceAll('-', ' ')} `), bytes);
  assert.equal(parseRecoveryKey('too-short'), null);
});
