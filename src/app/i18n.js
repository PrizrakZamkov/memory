// Interface languages and helpers. Texts live in ./locales, one file per language.
// Rule: no typographic arrows, dashes, ellipses or multiplication signs in UI copy.
import { createContext, useContext } from 'react';
import { ru } from './locales/ru.js';
import { en } from './locales/en.js';
import { es } from './locales/es.js';
import { pt } from './locales/pt.js';
import { de } from './locales/de.js';
import { fr } from './locales/fr.js';

// Order of the language menu. Names are written in their own language.
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'pt', name: 'Português' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'ru', name: 'Русский' }
];

export function timeAgo(ms, lang, t) {
  const diff = ms - Date.now();
  const abs = Math.abs(diff);
  if (abs < 60000) return t('time.justNow');
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const steps = [['minute', 60000], ['hour', 3600000], ['day', 86400000], ['month', 2592000000], ['year', 31536000000]];
  let unit = steps[0];
  for (const step of steps) if (abs >= step[1]) unit = step;
  return rtf.format(Math.round(diff / unit[1]), unit[0]);
}

export function greetingKey(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return 'greet.night';
  if (hour < 12) return 'greet.morning';
  if (hour < 18) return 'greet.day';
  if (hour < 23) return 'greet.evening';
  return 'greet.night';
}

const dictionaries = { ru, en, es, pt, de, fr };

export function detectLanguage() {
  try {
    const saved = localStorage.getItem('gamefolk.lang');
    if (dictionaries[saved]) return saved;
  } catch {
    // Storage can be blocked; fall back to the browser language.
  }
  const wanted = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
  for (const tag of wanted) {
    const code = tag.toLowerCase().slice(0, 2);
    if (dictionaries[code]) return code;
  }
  return 'en';
}

export function makeT(lang) {
  const dict = dictionaries[lang] || en;
  return (key, params) => {
    const value = dict[key] ?? en[key] ?? key;
    return typeof value === 'function' ? value(params || {}) : value;
  };
}

export const I18nContext = createContext({ lang: 'en', t: makeT('en') });

export function useI18n() {
  return useContext(I18nContext);
}
