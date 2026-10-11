import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanPerson, cleanStory } from '../src/core/model.js';
import { formatSince, formatWhen, sortKey } from '../src/core/dates.js';
import { facets, filterStories, firstMet, sortStories, suggestPeople } from '../src/core/search.js';

const kira = cleanPerson({ id: 'p1', firstName: 'Кира', nicks: [{ game: 'Dota 2', nick: 'k1ra' }] });
const vanya = cleanPerson({ id: 'p2', firstName: 'Ваня' });
const peopleById = new Map([[kira.id, kira], [vanya.id, vanya]]);

const stories = [
  cleanStory({ id: 's1', title: 'Ночной рейд', game: 'Deep Rock Galactic', people: ['p1', 'p2'], tags: ['эпик'], when: { kind: 'approx', year: 2021, season: 'spring' }, starred: true }),
  cleanStory({ id: 's2', title: 'Как нашли Киру', game: 'Dota 2', people: ['p1'], tags: ['знакомство'], when: { kind: 'approx', year: 2019, season: 'autumn' } }),
  cleanStory({ id: 's3', title: 'Драккар', game: 'Valheim', people: ['p2'], when: { kind: 'exact', date: '2022-08-12' } }),
  cleanStory({ id: 's4', title: 'Без даты', game: 'Valheim' })
];

test('dates sort exact and approximate together', () => {
  const order = sortStories(stories, 'newest').map(s => s.id);
  assert.deepEqual(order, ['s3', 's1', 's2', 's4']);
  assert.deepEqual(sortStories(stories, 'oldest').map(s => s.id), ['s2', 's1', 's3', 's4']);
  assert.equal(sortStories(stories, 'starred')[0].id, 's1');
  assert.equal(sortKey(null), '');
});

test('dates are formatted for both languages', () => {
  assert.equal(formatWhen({ kind: 'approx', year: 2021, season: 'spring' }, 'ru'), 'Весна 2021');
  assert.equal(formatWhen({ kind: 'approx', year: 2021, season: null }, 'en'), '2021');
  assert.equal(formatWhen({ kind: 'exact', date: '2022-08-12' }, 'ru'), '12 августа 2022');
  assert.equal(formatWhen({ kind: 'exact', date: '2022-08-12' }, 'en'), 'August 12, 2022');
  assert.equal(formatSince({ kind: 'approx', year: 2019, season: 'autumn' }, 'ru'), 'осени 2019');
});

test('filters combine and search finds names and nicks', () => {
  const by = filters => filterStories(stories, { query: '', game: '', person: '', tag: '', year: '', ...filters }, peopleById).map(s => s.id);
  assert.deepEqual(by({ game: 'Valheim' }), ['s3', 's4']);
  assert.deepEqual(by({ person: 'p1', tag: 'эпик' }), ['s1']);
  assert.deepEqual(by({ year: '2019' }), ['s2']);
  assert.deepEqual(by({ query: 'k1ra рейд' }), ['s1']);
  assert.deepEqual(by({ query: 'ваня' }), ['s1', 's3']);
});

test('facets count games, people, tags and years', () => {
  const f = facets(stories);
  assert.deepEqual(f.games[0], { value: 'Valheim', count: 2 });
  assert.deepEqual(f.years, [2022, 2021, 2019]);
  assert.equal(f.people.find(p => p.value === 'p1').count, 2);
});

test('first meeting falls back to the oldest shared story', () => {
  assert.deepEqual(firstMet(kira, stories), { kind: 'approx', year: 2019, season: 'autumn' });
});

test('people suggestions match by name and by nick', () => {
  assert.equal(suggestPeople([kira, vanya], 'ки')[0].person.id, 'p1');
  assert.equal(suggestPeople([kira, vanya], 'k1')[0].nick.nick, 'k1ra');
  assert.deepEqual(suggestPeople([kira, vanya], 'ки', ['p1']), []);
});

test('story cleanup trims input and limits images', () => {
  const s = cleanStory({ title: '  Title  ', tags: ['#эпик', 'эпик', ''], randomPlayers: 500, images: Array.from({ length: 9 }, (_, i) => ({ id: `i${i}` })) });
  assert.equal(s.title, 'Title');
  assert.deepEqual(s.tags, ['эпик']);
  assert.equal(s.randomPlayers, 99);
  assert.equal(s.images.length, 6);
});
