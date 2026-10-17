import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES } from '../src/app/i18n.js';
import { en } from '../src/app/locales/en.js';
import { ru } from '../src/app/locales/ru.js';
import { es } from '../src/app/locales/es.js';
import { pt } from '../src/app/locales/pt.js';
import { de } from '../src/app/locales/de.js';
import { fr } from '../src/app/locales/fr.js';

const all = { en, ru, es, pt, de, fr };
const params = { stories: 2, people: 1, games: 0, starred: 1, count: 3, name: 'Kira', index: 1, nick: 'k1ra', date: '2019', when: 'now', years: 5, days: 8, key: 'KEY', email: 'a@b.c', added: 1, updated: 2, images: 0 };

test('every language has the same keys as English', () => {
  assert.deepEqual(LANGUAGES.map(l => l.code).sort(), Object.keys(all).sort());
  for (const [code, dict] of Object.entries(all)) {
    assert.deepEqual(Object.keys(dict).sort(), Object.keys(en).sort(), code);
    for (const key of Object.keys(en)) assert.equal(typeof dict[key], typeof en[key], `${code} ${key}`);
  }
});

test('texts render and avoid banned symbols', () => {
  for (const [code, dict] of Object.entries(all)) {
    for (const [key, value] of Object.entries(dict)) {
      const text = String(typeof value === 'function' ? value(params) : value);
      assert.ok(text && !text.includes('undefined'), `${code} ${key}`);
      assert.doesNotMatch(text, /[×←→—…]/, `${code} ${key}`);
    }
  }
});
