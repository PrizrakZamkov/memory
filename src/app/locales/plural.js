// Plural forms. Russian has three, the other languages two.
export function pluralRu(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

// For two-form languages. French and Portuguese treat 0 like 1, Intl knows that.
export function plural(lang) {
  const rules = new Intl.PluralRules(lang);
  return (n, one, many) => (rules.select(n) === 'one' ? one : many);
}
