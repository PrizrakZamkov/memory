// Shapes of people and stories, and cleanup of user input before saving.
export const MAX_IMAGES = 6;
export const MAX_RANDOM_PLAYERS = 99;

export function newId() {
  return globalThis.crypto.randomUUID();
}

const text = (value, max) => String(value ?? '').trim().slice(0, max);
const list = (value, max, itemMax) =>
  [...new Set((Array.isArray(value) ? value : []).map(v => text(v, itemMax)).filter(Boolean))].slice(0, max);
const pairs = (value, a, b) =>
  (Array.isArray(value) ? value : [])
    .map(row => ({ [a]: text(row?.[a], 60), [b]: text(row?.[b], 200) }))
    .filter(row => row[a] || row[b])
    .slice(0, 30);

// when: { kind: 'exact', date: 'YYYY-MM-DD' } or { kind: 'approx', year, season }
export function cleanWhen(when) {
  if (when?.kind === 'exact' && /^\d{4}-\d{2}-\d{2}$/.test(when.date || '')) {
    return { kind: 'exact', date: when.date };
  }
  const year = Number(when?.year);
  if (when?.kind === 'approx' && year >= 1970 && year <= 2100) {
    const season = ['winter', 'spring', 'summer', 'autumn'].includes(when.season) ? when.season : null;
    return { kind: 'approx', year, season };
  }
  return null;
}

export function emptyPerson() {
  return {
    id: '', firstName: '', lastName: '', status: '', games: [], nicks: [], contacts: [],
    note: '', met: { text: '', game: '', when: null }, photo: null
  };
}

export function cleanPerson(input) {
  return {
    id: input.id || newId(),
    firstName: text(input.firstName, 60),
    lastName: text(input.lastName, 60),
    status: text(input.status, 40),
    games: list(input.games, 30, 80),
    nicks: pairs(input.nicks, 'game', 'nick'),
    contacts: pairs(input.contacts, 'label', 'value'),
    note: text(input.note, 5000),
    met: {
      text: text(input.met?.text, 5000),
      game: text(input.met?.game, 80),
      when: cleanWhen(input.met?.when)
    },
    photo: input.photo || null,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function emptyStory() {
  return {
    id: '', title: '', text: '', game: '', tags: [], people: [], names: [],
    randomPlayers: 0, when: null, starred: false, images: []
  };
}

export function cleanStory(input) {
  const randomPlayers = Math.max(0, Math.min(MAX_RANDOM_PLAYERS, Math.floor(Number(input.randomPlayers) || 0)));
  return {
    id: input.id || newId(),
    title: text(input.title, 200),
    text: text(input.text, 20000),
    game: text(input.game, 80),
    tags: list((input.tags || []).map(t => String(t).replace(/^#/, '')), 20, 40),
    people: list(input.people, 50, 64),
    names: list(input.names, 30, 60),
    randomPlayers,
    when: cleanWhen(input.when),
    starred: Boolean(input.starred),
    images: (Array.isArray(input.images) ? input.images : [])
      .filter(img => img?.id)
      .slice(0, MAX_IMAGES)
      .map(img => ({ id: img.id, width: Number(img.width) || 0, height: Number(img.height) || 0 })),
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function fullName(person) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ');
}

export function initials(person) {
  const first = person?.firstName?.[0] || '';
  const last = person?.lastName?.[0] || '';
  return (first + last).toUpperCase() || '?';
}

// Stable soft color per person, picked from a small palette.
const AVATAR_COLORS = ['#E8A0BF', '#9BC7A3', '#F2C27B', '#A9B8F0', '#C9B3E8', '#8FD3D1', '#F0A79A', '#B8D58C'];
export function avatarColor(person) {
  let hash = 0;
  for (const char of person?.id || '') hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
