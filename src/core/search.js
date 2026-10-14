// Filtering, searching, sorting and counting stories. Pure functions.
import { fullName } from './model.js';
import { currentSeason, sortKey, yearOf } from './dates.js';

export const EMPTY_FILTERS = { query: '', game: '', person: '', tag: '', year: '' };

function normalize(value) {
  return String(value || '').toLocaleLowerCase().replace(/ё/g, 'е');
}

function storyText(story, peopleById) {
  const people = story.people.map(id => peopleById.get(id)).filter(Boolean);
  return normalize([
    story.title, story.text, story.game, ...story.tags, ...story.names,
    ...people.map(fullName), ...people.flatMap(p => p.nicks.map(n => n.nick))
  ].join(' '));
}

export function filterStories(stories, filters, peopleById) {
  const words = normalize(filters.query).split(/\s+/).filter(Boolean);
  return stories.filter(story => {
    if (filters.game && story.game !== filters.game) return false;
    if (filters.person && !story.people.includes(filters.person)) return false;
    if (filters.tag && !story.tags.includes(filters.tag)) return false;
    if (filters.year && String(yearOf(story.when)) !== String(filters.year)) return false;
    if (words.length) {
      const haystack = storyText(story, peopleById);
      if (!words.every(word => haystack.includes(word))) return false;
    }
    return true;
  });
}

export function sortStories(stories, order) {
  const byDate = (a, b) => sortKey(b.when).localeCompare(sortKey(a.when)) || b.createdAt.localeCompare(a.createdAt);
  const list = [...stories];
  if (order === 'oldest') {
    // Stories without a date go to the end in both directions.
    return list.sort((a, b) => {
      const ka = sortKey(a.when) || '9999';
      const kb = sortKey(b.when) || '9999';
      return ka.localeCompare(kb) || a.createdAt.localeCompare(b.createdAt);
    });
  }
  if (order === 'starred') return list.sort((a, b) => Number(b.starred) - Number(a.starred) || byDate(a, b));
  return list.sort(byDate);
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
}

export function facets(stories) {
  return {
    games: countBy(stories.map(s => s.game).filter(Boolean)),
    people: countBy(stories.flatMap(s => s.people)),
    tags: countBy(stories.flatMap(s => s.tags)),
    years: [...new Set(stories.map(s => yearOf(s.when)).filter(Boolean))].sort((a, b) => b - a)
  };
}

export function storiesWith(personId, stories) {
  return stories.filter(story => story.people.includes(personId));
}

// When two people first crossed paths: the "met" date, or the oldest shared story.
export function firstMet(person, stories) {
  if (person.met?.when) return person.met.when;
  const dated = storiesWith(person.id, stories).filter(s => s.when);
  if (!dated.length) return null;
  return dated.reduce((a, b) => (sortKey(a.when) <= sortKey(b.when) ? a : b)).when;
}

export function filterPeople(people, query) {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return people;
  return people.filter(person => {
    const haystack = normalize([fullName(person), person.status, ...person.games, ...person.nicks.map(n => n.nick)].join(' '));
    return words.every(word => haystack.includes(word));
  });
}

// Autocomplete for the "who was there" field: matches by name or nick.
export function suggestPeople(people, query, exclude = []) {
  const q = normalize(query).trim();
  if (!q) return [];
  return people
    .filter(p => !exclude.includes(p.id))
    .map(person => {
      const name = normalize(fullName(person));
      const nick = person.nicks.find(n => normalize(n.nick).includes(q));
      const score = name.startsWith(q) ? 0 : name.includes(q) ? 1 : nick ? 2 : -1;
      return { person, nick: nick || null, score };
    })
    .filter(item => item.score >= 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 6);
}

export function knownStatuses(people, defaults) {
  return [...new Set([...defaults, ...people.map(p => p.status).filter(Boolean)])];
}

export function knownGames(people, stories) {
  return countBy([...stories.map(s => s.game), ...people.flatMap(p => p.games)].filter(Boolean)).map(g => g.value);
}

// A story from past years for the "on this day" block: same day first, else same season.
export function onThisDay(stories, today = new Date()) {
  const year = today.getFullYear();
  const monthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const sameDay = stories.filter(s => s.when?.kind === 'exact' && s.when.date.slice(5) === monthDay && Number(s.when.date.slice(0, 4)) < year);
  if (sameDay.length) {
    const story = sameDay.sort((a, b) => a.when.date.localeCompare(b.when.date))[0];
    return { story, years: year - Number(story.when.date.slice(0, 4)), kind: 'day' };
  }
  const season = currentSeason(today);
  const sameSeason = stories.filter(s => s.when?.kind === 'approx' && s.when.season === season && s.when.year < year);
  if (!sameSeason.length) return null;
  // Changes once a day, so the block does not jump around on every visit.
  const story = sameSeason[(today.getDate() + today.getMonth() * 31) % sameSeason.length];
  return { story, years: year - story.when.year, kind: 'season' };
}

export function knownTags(stories) {
  return countBy(stories.flatMap(s => s.tags)).map(t => t.value);
}
