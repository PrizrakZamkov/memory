// Exact and approximate dates ("spring 2021", "2019").
const SEASON_MONTH = { winter: '01', spring: '04', summer: '07', autumn: '10' };

// A string that sorts in time order. Unknown dates sort last.
export function sortKey(when) {
  if (!when) return '';
  if (when.kind === 'exact') return when.date;
  return `${when.year}-${when.season ? SEASON_MONTH[when.season] : '07'}-15`;
}

export function yearOf(when) {
  if (!when) return null;
  return when.kind === 'exact' ? Number(when.date.slice(0, 4)) : when.year;
}

const SEASONS = {
  ru: { winter: 'Зима', spring: 'Весна', summer: 'Лето', autumn: 'Осень' },
  en: { winter: 'Winter', spring: 'Spring', summer: 'Summer', autumn: 'Autumn' },
  es: { winter: 'Invierno', spring: 'Primavera', summer: 'Verano', autumn: 'Otoño' },
  pt: { winter: 'Inverno', spring: 'Primavera', summer: 'Verão', autumn: 'Outono' },
  de: { winter: 'Winter', spring: 'Frühling', summer: 'Sommer', autumn: 'Herbst' },
  fr: { winter: 'Hiver', spring: 'Printemps', summer: 'Été', autumn: 'Automne' }
};

// Season inside a sentence: genitive in Russian ("с весны 2019"), lower case where nouns are not capitalized.
const SEASONS_SINCE = {
  ru: { winter: 'зимы', spring: 'весны', summer: 'лета', autumn: 'осени' },
  en: { winter: 'winter', spring: 'spring', summer: 'summer', autumn: 'autumn' },
  es: { winter: 'invierno', spring: 'primavera', summer: 'verano', autumn: 'otoño' },
  pt: { winter: 'inverno', spring: 'primavera', summer: 'verão', autumn: 'outono' },
  de: SEASONS.de,
  fr: { winter: 'hiver', spring: 'printemps', summer: 'été', autumn: 'automne' }
};

// Spanish and Portuguese say "Primavera de 2019".
const OF_YEAR = { es: ' de ', pt: ' de ' };

export function seasonName(season, lang) {
  return SEASONS[lang]?.[season] || SEASONS.en[season];
}

function seasonYear(season, year, lang) {
  return `${season}${OF_YEAR[lang] || ' '}${year}`;
}

export function formatWhen(when, lang) {
  if (!when) return '';
  if (when.kind === 'approx') {
    return when.season ? seasonYear(seasonName(when.season, lang), when.year, lang) : String(when.year);
  }
  const [y, m, d] = when.date.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const text = new Intl.DateTimeFormat(lang || 'en', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  }).format(date);
  return text.replace(/\s?г\.$/, '');
}

// Text after "since" or a label: "spring 2019", or the genitive form in Russian.
export function formatSince(when, lang) {
  if (!when) return '';
  if (when.kind === 'approx' && when.season) {
    const name = SEASONS_SINCE[lang]?.[when.season] || when.season;
    return seasonYear(name, when.year, lang);
  }
  return formatWhen(when, lang);
}

export function todayIso() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function currentSeason(date = new Date()) {
  const month = date.getMonth();
  if (month === 11 || month <= 1) return 'winter';
  if (month <= 4) return 'spring';
  if (month <= 7) return 'summer';
  return 'autumn';
}
